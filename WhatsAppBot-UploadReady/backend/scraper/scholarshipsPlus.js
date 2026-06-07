const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');
const db = require('../db/database');

async function scrapeScholarshipsPlus() {
  console.log('Starting scholarships.plus scraper...');

  let newJobsCount = 0;
  const targetUrl = 'https://scholarships.plus/scholarships/all-degrees/nigeria/';

  try {
    const response = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const jobs = [];

    $('.schcard').each((i, element) => {
      const title = $(element).find('.scsTitHome').text().trim();
      const relativeLink = $(element).find('a').attr('href');
      
      if (!title || !relativeLink) return;

      const link = `https://scholarships.plus${relativeLink}`;
      // Extract location from the list items, typically the one with the location SVG
      let location = 'Nigeria'; 
      const listItems = $(element).find('.list__item3').text();
      if (listItems.toLowerCase().includes('nigeria')) {
         location = 'Nigeria';
      }

      jobs.push({
        title: title,
        company: 'Scholarships.plus (Educational)',
        location: location,
        link: link,
        source: 'Scholarships.plus'
      });
    });

    console.log(`Found ${jobs.length} potential scholarships on page 1.`);

    const insertJob = db.prepare(`
      INSERT INTO jobs (id, title, company, state, city, url, posted_date)
      SELECT ?, ?, ?, ?, ?, ?, datetime('now')
      WHERE NOT EXISTS (
        SELECT 1 FROM jobs WHERE url = ?
      )
    `);

    const insertMany = db.transaction((jobsArray) => {
      let count = 0;
      for (const job of jobsArray) {
        const hashId = crypto.createHash('md5').update(job.link).digest('hex');
        const info = insertJob.run(hashId, job.title, job.company, job.location, 'Unknown', job.link, job.link);
        if (info.changes > 0) count++;
      }
      return count;
    });

    newJobsCount = insertMany(jobs);

  } catch (error) {
    console.error('Error scraping scholarships.plus:', error.message);
  } finally {
    console.log(`Scholarships.plus scraper finished. Added ${newJobsCount} new entries.`);
    return { count: newJobsCount };
  }
}

module.exports = scrapeScholarshipsPlus;

// If run directly for testing
if (require.main === module) {
  scrapeScholarshipsPlus();
}
