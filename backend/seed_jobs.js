const { runAggressiveScrape } = require('./scraper/scheduler');

async function seedJobs() {
    console.log('[Seed] Starting massive seeding across all 80+ sources...');
    try {
        await runAggressiveScrape();
        console.log('[Seed] Seeding completed successfully!');
    } catch (err) {
        console.error('[Seed] Seeding failed:', err.message);
    }
    process.exit(0);
}

seedJobs();
