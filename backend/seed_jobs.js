const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');
const db = require('./db/database');
const locations = require('./data/locations');

const queries = ['it', 'engineering', 'finance', 'healthcare', 'sales', 'marketing', 'teaching', 'admin', 'customer service', 'hr', 'logistics', 'manager', 'remote', 'driver', 'chef', 'lawyer', 'accountant'];
const maxPages = 5;

async function seedJobs() {
    console.log('Seeding massive list of jobs...');
    let added = 0;
    const insertJob = db.prepare('INSERT OR IGNORE INTO jobs (id, title, company, state, city, url, posted_date) VALUES (?, ?, ?, ?, ?, ?, ?)');

    for (const query of queries) {
        for (let page = 1; page <= maxPages; page++) {
            const searchUrl = `https://www.myjobmag.com/search/jobs?q=${encodeURIComponent(query)}&page=${page}`;
            try {
                const response = await axios.get(searchUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
                });
                const $ = cheerio.load(response.data);
                
                const jobItems = $('.job-list-li');
                if (jobItems.length === 0) break; // no more pages for this query

                jobItems.each((i, element) => {
                    const titleElement = $(element).find('h2 a');
                    const title = titleElement.text().trim();
                    const urlPath = titleElement.attr('href');
                    if (!title || !urlPath) return;
                    
                    const url = urlPath.startsWith('http') ? urlPath : 'https://www.myjobmag.com' + urlPath;
                    const company = $(element).find('.job-logo img').attr('alt') || 'Unknown Company';
                    
                    // Extract text to guess location
                    const metaText = $(element).text().toLowerCase();
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

                    // Fallback to Lagos if totally unknown to avoid empty locations
                    if (jobState === 'Unknown') {
                        jobState = 'Lagos';
                        jobCity = 'Lagos';
                    }

                    const id = crypto.createHash('md5').update(url).digest('hex');
                    const result = insertJob.run(id, title, company, jobState, jobCity, url, new Date().toISOString());
                    if (result.changes > 0) added++;
                });
                
                console.log(`Scraped query="${query}" page=${page}. Total added so far: ${added}`);
                
                // Sleep to avoid rate limiting
                await new Promise(r => setTimeout(r, 1000));
            } catch(err) {
                console.error(`Seed failed for query ${query} page ${page}:`, err.message);
                break;
            }
        }
    }
    console.log(`Finished massive seed. Added ${added} new jobs to the database.`);
}

seedJobs();
