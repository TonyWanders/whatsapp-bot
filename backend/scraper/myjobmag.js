const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');
const db = require('../db/database');
const locations = require('../data/locations');

async function scrapeMyJobMagCategory(categoryUrl) {
  console.log(`[MyJobMag] Scraping category: ${categoryUrl}`);
  let totalNewJobs = 0;
  const maxPages = 3; // Reduced for faster initial scrape
  
  try {
    const insertJob = db.prepare('INSERT OR IGNORE INTO jobs (id, title, company, state, city, url, posted_date) VALUES (?, ?, ?, ?, ?, ?, ?)');

    for (let page = 1; page <= maxPages; page++) {
      // e.g. https://www.myjobmag.com/jobs-location/lagos
      const pageUrl = page === 1 ? categoryUrl : `${categoryUrl}/${page}`;
      
      let response;
      try {
        response = await axios.get(pageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
      } catch (err) {
        if (err.response && err.response.status === 404) {
          // If the page doesn't exist (e.g. state has no jobs right now), just skip gracefully
          console.log(`[MyJobMag] No jobs found at ${pageUrl} (404)`);
          break;
        }
        throw err;
      }
      
      const $ = cheerio.load(response.data);
      
      const jobCards = $('.job-list-li');
      if (jobCards.length === 0) break; // End of pagination

      jobCards.each((i, element) => {
        const titleElement = $(element).find('h2 a');
        const title = titleElement.text().trim();
        const urlPath = titleElement.attr('href');
        if (!urlPath) return;
        const url = urlPath.startsWith('http') ? urlPath : 'https://www.myjobmag.com' + urlPath;
        
        const companyElement = $(element).find('.job-logo img');
        let company = companyElement.attr('alt') || $(element).find('.job-desc .job-name').text().trim() || 'Unknown Company';
        company = company.replace(/ jobs$/i, '');

        const metaText = $(element).text(); 
        
        // Strict freshness filter
        const dateText = $(element).find('.job-date').text().trim().toLowerCase() || metaText.toLowerCase();
        
        if (dateText.includes('month') || dateText.match(/\b[3-9]\s+weeks?\b/) || dateText.match(/\b\d{2,}\s+days?\b/)) {
            return;
        }
        
        let jobState = 'Unknown';
        let jobCity = 'Unknown';
        
        for (const [state, cities] of Object.entries(locations)) {
          if (metaText.toLowerCase().includes(state.toLowerCase())) {
            jobState = state;
          }
          for (const city of cities) {
            if (metaText.toLowerCase().includes(city.toLowerCase())) {
              jobState = state;
              jobCity = city;
              break; 
            }
          }
          if (jobCity !== 'Unknown') break;
        }
        
        if (title) {
           const id = crypto.createHash('md5').update(url).digest('hex');
           const result = insertJob.run(id, title, company, jobState, jobCity, url, new Date().toISOString());
           if (result.changes > 0) totalNewJobs++;
        }
      });
      
      await new Promise(r => setTimeout(r, 500));
    }
    
    console.log(`[MyJobMag] Finished ${categoryUrl}. Added ${totalNewJobs} new jobs.`);
    return { success: true, count: totalNewJobs };
  } catch (error) {
    console.error(`[MyJobMag] Error scraping ${categoryUrl}:`, error.message);
    return { success: false, error: error.message };
  }
}

module.exports = scrapeMyJobMagCategory;
