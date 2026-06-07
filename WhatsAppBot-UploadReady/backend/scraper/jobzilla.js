const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');
const db = require('../db/database');
const locations = require('../data/locations');

async function scrapeJobzillaCategory(categoryUrl) {
  console.log(`[Jobzilla] Scraping category: ${categoryUrl}`);
  let totalNewJobs = 0;
  const maxPages = 2; // Keep it light for continuous background scraping
  
  try {
    const insertJob = db.prepare('INSERT OR IGNORE INTO jobs (id, title, company, state, city, url, posted_date) VALUES (?, ?, ?, ?, ?, ?, ?)');

    for (let page = 1; page <= maxPages; page++) {
      // e.g. https://www.jobzilla.ng/jobs or https://www.jobzilla.ng/jobs-in-rivers-state?page=2
      const pageUrl = page === 1 ? categoryUrl : `${categoryUrl}?page=${page}`;
      
      let response;
      try {
        response = await axios.get(pageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
      } catch (err) {
        if (err.response && err.response.status === 404) {
          console.log(`[Jobzilla] No jobs found at ${pageUrl} (404)`);
          break;
        }
        throw err;
      }
      
      const $ = cheerio.load(response.data);
      const jobCards = $('.card.border-0.shadow.overflow-hidden');
      
      if (jobCards.length === 0) break;

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
      
      await new Promise(r => setTimeout(r, 500));
    }
    
    console.log(`[Jobzilla] Finished ${categoryUrl}. Added ${totalNewJobs} new jobs.`);
    return { success: true, count: totalNewJobs };
  } catch (error) {
    console.error(`[Jobzilla] Error scraping ${categoryUrl}:`, error.message);
    return { success: false, error: error.message };
  }
}

module.exports = scrapeJobzillaCategory;
