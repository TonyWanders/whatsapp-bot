const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');
const db = require('./db/database');

async function scrapePH() {
  console.log('Manually scraping Port Harcourt jobs to populate database...');
  try {
    const insertJob = db.prepare('INSERT OR IGNORE INTO jobs (id, title, company, state, city, url, posted_date) VALUES (?, ?, ?, ?, ?, ?, ?)');
    let added = 0;

    const response = await axios.get('https://www.myjobmag.com/jobs-location/rivers', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    const $ = cheerio.load(response.data);
    $('.job-list-li').each((i, element) => {
      const titleElement = $(element).find('h2 a');
      const title = titleElement.text().trim();
      if (!title) return;
      
      const urlPath = titleElement.attr('href');
      const url = urlPath.startsWith('http') ? urlPath : 'https://www.myjobmag.com' + urlPath;
      
      const companyElement = $(element).find('.job-logo img');
      let company = companyElement.attr('alt') || $(element).find('.job-desc .job-name').text().trim() || 'Unknown Company';
      company = company.replace(/ jobs$/i, '');

      const id = crypto.createHash('md5').update(url).digest('hex');
      const result = insertJob.run(id, title, company, 'Rivers', 'Port Harcourt', url, new Date().toISOString());
      if (result.changes > 0) added++;
    });

    console.log(`Successfully scraped and added ${added} Port Harcourt jobs!`);
  } catch (err) {
    console.error('Error:', err);
  }
}

scrapePH();
