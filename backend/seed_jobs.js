const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');
const db = require('./db/database');

async function seedJobs() {
    const searchUrl = 'https://www.myjobmag.com/search/jobs?q=executive+assistant';
    console.log('Seeding Executive Assistant jobs...');
    let added = 0;
    try {
        const insertJob = db.prepare('INSERT OR IGNORE INTO jobs (id, title, company, state, city, url, posted_date) VALUES (?, ?, ?, ?, ?, ?, ?)');
        const response = await axios.get(searchUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        const $ = cheerio.load(response.data);
        $('.job-list-li').each((i, element) => {
            const titleElement = $(element).find('h2 a');
            const title = titleElement.text().trim();
            const urlPath = titleElement.attr('href');
            if (!title || !urlPath) return;
            const url = urlPath.startsWith('http') ? urlPath : 'https://www.myjobmag.com' + urlPath;
            const company = $(element).find('.job-logo img').attr('alt') || 'Unknown Company';
            const id = crypto.createHash('md5').update(url).digest('hex');
            const result = insertJob.run(id, title, company, 'Lagos', 'Lagos', url, new Date().toISOString());
            if (result.changes > 0) added++;
        });
        console.log(`Successfully added ${added} new Executive Assistant jobs to the database.`);
    } catch(err) {
        console.error('Seed failed:', err.message);
    }
}
seedJobs();
