const scrapeMyJobMag = require('./myjobmag');
const scrapeJobzilla = require('./jobzilla');
const scrapeRss = require('./rss_aggregator');

const locations = require('../data/locations');

const SCRAPE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

const targets = [
  // Nationwide General Jobs (Crucial for all 36 states)
  { type: 'myjobmag', url: 'https://www.myjobmag.com/jobs', name: 'MyJobMag Nationwide' },
  { type: 'jobzilla', url: 'https://www.jobzilla.ng/', name: 'Jobzilla Nationwide' },

  // Specialized Fields
  { type: 'myjobmag', url: 'https://www.myjobmag.com/jobs-by-field/information-technology', name: 'MyJobMag Tech' },
  { type: 'myjobmag', url: 'https://www.myjobmag.com/jobs-by-field/oil-and-gas-energy', name: 'MyJobMag Oil & Gas' },
  { type: 'myjobmag', url: 'https://www.myjobmag.com/jobs-by-field/banking', name: 'MyJobMag Finance' },
  
  { type: 'jobzilla', url: 'https://www.jobzilla.ng/category/software-web-development', name: 'Jobzilla Software' },
  { type: 'jobzilla', url: 'https://www.jobzilla.ng/category/oil-and-gas-jobs', name: 'Jobzilla Oil & Gas' },
  { type: 'jobzilla', url: 'https://www.jobzilla.ng/category/cybersecurity-networking', name: 'Jobzilla Cybersecurity' },
  { type: 'jobzilla', url: 'https://www.jobzilla.ng/category/scholarships', name: 'Jobzilla Scholarships' },
  { type: 'jobzilla', url: 'https://www.jobzilla.ng/category/entrepreneurship', name: 'Jobzilla Startups' },

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

let currentIndex = 0;
let isScraping = false;

async function runNextScrape() {
  if (isScraping) {
    console.log('[Scheduler] Skip - Scraper is still running the previous job');
    return;
  }
  
  isScraping = true;
  const target = targets[currentIndex];
  console.log(`[Scheduler] Starting target ${currentIndex + 1}/${targets.length} -> ${target.name}`);

  try {
    if (target.type === 'myjobmag') {
      await scrapeMyJobMag(target.url);
    } else if (target.type === 'jobzilla') {
      await scrapeJobzilla(target.url);
    } else if (target.type === 'rss') {
      await scrapeRss(target.url, target.name);
    }
  } catch (error) {
    console.error(`[Scheduler] Error running ${target.name}:`, error.message);
  } finally {
    isScraping = false;
    currentIndex++;
    if (currentIndex >= targets.length) {
      currentIndex = 0; // Loop back to the beginning
      console.log('[Scheduler] Completed full cycle of all sources. Restarting loop.');
    }
  }
}

async function startScheduler() {
  console.log('[Scheduler] Initializing massive multi-source background crawler.');
  console.log(`[Scheduler] Loaded ${targets.length} targets. Running bootstrap sequence now...`);

  // Run a rapid bootstrap sequence on startup (5 seconds apart) to instantly populate all sources
  for (let i = 0; i < targets.length; i++) {
    await runNextScrape();
    await new Promise(resolve => setTimeout(resolve, 5000)); // 5 seconds between targets on boot
  }

  console.log('[Scheduler] Bootstrap complete. Switching to safe 5-minute background loop.');
  
  // Now fall back to the safe 5-minute loop
  setInterval(runNextScrape, 300 * 1000);
}

module.exports = { startScheduler };
