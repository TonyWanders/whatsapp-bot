const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const cheerio = require('cheerio');
const crypto = require('crypto');
const db = require('../db/database');
const locations = require('../data/locations');

async function scrapeJobzillaCategory(categoryUrl) {
  console.log(`[Jobzilla] Scraping category (STEALTH): ${categoryUrl}`);
  let totalNewJobs = 0;
  const maxPages = 10; // Deep scrape
  
  let browser;
  try {
    const insertJob = db.prepare('INSERT OR IGNORE INTO jobs (id, title, company, state, city, url, posted_date) VALUES (?, ?, ?, ?, ?, ?, ?)');

    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const pageObj = await browser.newPage();
    // Jobzilla might be slow, give it generous timeout
    await pageObj.setDefaultNavigationTimeout(60000);

    for (let page = 1; page <= maxPages; page++) {
      const pageUrl = page === 1 ? categoryUrl : `${categoryUrl}?page=${page}`;
      
      try {
        await pageObj.goto(pageUrl, { waitUntil: 'networkidle2' });
      } catch (err) {
        console.log(`[Jobzilla] Failed to navigate to ${pageUrl} - ${err.message}`);
        continue;
      }
      
      const content = await pageObj.content();
      const $ = cheerio.load(content);
      const jobCards = $('.card.border-0.shadow.overflow-hidden');
      
      if (jobCards.length === 0) {
        console.log(`[Jobzilla] No job cards found at ${pageUrl}. Could be a 404 or block.`);
        break;
      }

      jobCards.each((i, element) => {
        const titleElement = $(element).find('h2 a');
        const title = titleElement.text().trim();
        if (!title) return;
        
        const urlPath = titleElement.attr('href');
        const url = urlPath.startsWith('http') ? urlPath : 'https://www.jobzilla.ng' + urlPath;
        
        const companyElement = $(element).find('a[href^="/company/"]');
        let company = companyElement.length > 0 ? companyElement.text().trim() : 'Unknown Company';
        if (!company) company = 'Unknown Company';

        const metaText = $(element).text().toLowerCase();
        
        // Try to guess the state
        let jobState = 'Unknown';
        let jobCity = 'Unknown';
        for (const [state, cities] of Object.entries(locations)) {
          if (metaText.includes(state.toLowerCase())) {
            jobState = state;
          }
          for (const city of cities) {
            if (metaText.includes(city.toLowerCase())) {
              jobState = state;
              jobCity = city;
              break; 
            }
          }
          if (jobCity !== 'Unknown') break;
        }

        const id = crypto.createHash('md5').update(url).digest('hex');
        const result = insertJob.run(id, title, company, jobState, jobCity, url, new Date().toISOString());
        if (result.changes > 0) totalNewJobs++;
      });
      
      await new Promise(r => setTimeout(r, 2000));
    }
    
    console.log(`[Jobzilla] Finished ${categoryUrl}. Added ${totalNewJobs} new jobs.`);
    if (browser) await browser.close();
    return { success: true, count: totalNewJobs };
  } catch (error) {
    if (browser) await browser.close();
    console.error(`[Jobzilla] Error scraping ${categoryUrl}:`, error.message);
    return { success: false, error: error.message };
  }
}

module.exports = scrapeJobzillaCategory;
