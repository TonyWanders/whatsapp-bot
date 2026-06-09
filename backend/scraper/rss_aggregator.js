const Parser = require('rss-parser');
const crypto = require('crypto');
const db = require('../db/database');
const locations = require('../data/locations');

const parser = new Parser({
  customFields: {
    item: ['description', 'pubDate', 'company', 'category'],
  },
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }
});

async function scrapeRssFeed(feedUrl, sourceName = 'Aggregator') {
  console.log(`[RSS Aggregator] Fetching jobs from ${sourceName}: ${feedUrl}`);
  let totalNewJobs = 0;
  
  try {
    const insertJob = db.prepare('INSERT OR IGNORE INTO jobs (id, title, company, state, city, url, posted_date) VALUES (?, ?, ?, ?, ?, ?, ?)');
    
    const feed = await parser.parseURL(feedUrl);
    
    for (const item of feed.items) {
      const title = item.title ? item.title.trim() : '';
      if (!title) continue;
      
      const url = item.link;
      
      // Some RSS feeds inject the company name into the title "Software Engineer at Google"
      // Or they provide it as a custom tag <company>
      let company = item.company || 'Unknown Company';
      if (company === 'Unknown Company' && title.includes(' at ')) {
        company = title.split(' at ').pop().trim();
      }

      const metaText = `${title} ${item.description || ''} ${item.content || ''} ${item.category || ''}`.toLowerCase();
      
      // Guess location
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
      
      const pubDate = item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString();
      
      if (url) {
        const id = crypto.createHash('md5').update(url).digest('hex');
        const result = insertJob.run(id, title, company, jobState, jobCity, url, pubDate);
        if (result.changes > 0) totalNewJobs++;
      }
    }
    
    console.log(`[RSS Aggregator] Finished ${sourceName}. Added ${totalNewJobs} new jobs.`);
    return { success: true, count: totalNewJobs };
  } catch (error) {
    console.error(`[RSS Aggregator] Error scraping ${feedUrl}:`, error.message);
    return { success: false, error: error.message };
  }
}

module.exports = scrapeRssFeed;
