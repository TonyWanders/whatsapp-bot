const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

axios.get('https://www.jobzilla.ng/jobs', {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
}).then(res => {
  const $ = cheerio.load(res.data);
  fs.writeFileSync('jz_test.html', $.html());
  console.log('Saved to jz_test.html');
}).catch(console.error);
