const scrapeMyJobMag = require('./myjobmag');
const scrapeJobzilla = require('./jobzilla');
const scrapeRss = require('./rss_aggregator');

const locations = require('../data/locations');

const SCRAPE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

const targets = [
  // Nationwide General Jobs (Crucial for all 36 states)
  { type: 'myjobmag', url: 'https://www.myjobmag.com/jobs', name: 'MyJobMag Nationwide' },
  { type: 'jobzilla', url: 'https://www.jobzilla.ng/', name: 'Jobzilla Nationwide' },


  // RSS Aggregators & Explicit Sources (The Super Scaler)
  { type: 'rss', url: 'https://ng.jooble.org/api/rss', name: 'Jooble Aggregator' },
  { type: 'rss', url: 'https://ng.indeed.com/rss?q=', name: 'Indeed Aggregator' },
  { type: 'rss', url: 'https://www.hotnigerianjobs.com/rss.xml', name: 'HotNigerianJobs' },
  { type: 'rss', url: 'https://www.jobberman.com/jobs/rss', name: 'Jobberman' },
  { type: 'rss', url: 'https://ngcareers.com/jobs/rss', name: 'Ngcareers' },
  { type: 'rss', url: 'https://www.jobgurus.com.ng/jobs/rss', name: 'Jobgurus' }
];

// Dynamically generate targets for all 36 States + Abuja
Object.keys(locations).forEach(state => {
  const formattedState = state.toLowerCase().replace(/ /g, '-');
  
  // MyJobMag Locations
  targets.push({ 
    type: 'myjobmag', 
    url: `https://www.myjobmag.com/jobs-location/${formattedState}`, 
    name: `MyJobMag ${state}` 
  });

  // Jobzilla Locations
  const jobzillaUrl = state === 'Abuja' 
    ? 'https://www.jobzilla.ng/jobs-in-abuja' 
    : `https://www.jobzilla.ng/jobs-in-${formattedState}-state`;
    
  targets.push({ 
    type: 'jobzilla', 
    url: jobzillaUrl, 
    name: `Jobzilla ${state}` 
  });
});

let isScraping = false;

async function executeInChunks(tasks, chunkSize = 5) {
  for (let i = 0; i < tasks.length; i += chunkSize) {
    const chunk = tasks.slice(i, i + chunkSize);
    await Promise.all(chunk.map(async (target) => {
      console.log(`[Scheduler] Starting target -> ${target.name}`);
      try {
        if (target.type === 'myjobmag') await scrapeMyJobMag(target.url);
        else if (target.type === 'jobzilla') await scrapeJobzilla(target.url);
        else if (target.type === 'rss') await scrapeRss(target.url, target.name);
      } catch (err) {
        console.error(`[Scheduler] Error running ${target.name}:`, err.message);
      }
    }));
    // Small delay between chunks to avoid rate limits
    await new Promise(r => setTimeout(r, 2000));
  }
}

async function runAggressiveScrape() {
  if (isScraping) {
    console.log('[Scheduler] Skip - Aggressive scrape already in progress.');
    return { success: false, message: 'Already running' };
  }
  isScraping = true;
  console.log('[Scheduler] Initiating MASSIVE aggressive scrape across all sources...');
  
  try {
    await executeInChunks(targets, 5); // Process 5 sources in parallel
    console.log('[Scheduler] Massive aggressive scrape COMPLETED.');
  } finally {
    isScraping = false;
  }
  return { success: true, message: 'Scrape completed successfully' };
}

async function startScheduler() {
  console.log(`[Scheduler] Loaded ${targets.length} targets. Running initial massive scrape...`);
  await runAggressiveScrape();
  
  // Run massive scrape every 4 hours instead of 1 by 1
  setInterval(runAggressiveScrape, 4 * 60 * 60 * 1000);
}

module.exports = { startScheduler, runAggressiveScrape };
