const { Client, LocalAuth, Buttons, List } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');
const crypto = require('crypto');
const db = require('./db/database');

let qrCodeData = null;
let isConnected = false;
let clientInstance = null;
const userState = new Map();

const ALLOWED_CHANNELS = [
  'jobzilla nigeria',
  'jobs with aramide',
  'staffle ph',
  'staffle job alerts',
  'workpedia africa'
];

function initWhatsApp() {
  if (clientInstance) return; // Already initializing

  console.log('Initializing WhatsApp Engine...');
  clientInstance = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  clientInstance.on('qr', async (qr) => {
    console.log('WhatsApp QR Code generated. Awaiting scan...');
    qrcodeTerminal.generate(qr, {small: true});
    try {
      qrCodeData = await qrcode.toDataURL(qr);
      await qrcode.toFile('qr.png', qr);
      
      const PDFDocument = require('pdfkit');
      const fs = require('fs');
      const doc = new PDFDocument();
      doc.pipe(fs.createWriteStream('qr.pdf'));
      doc.image('qr.png', 100, 100, {width: 400});
      doc.end();

      setTimeout(() => {
        require('child_process').exec('Invoke-Item qr.pdf', {shell: 'powershell.exe'});
      }, 500);

      console.log('\n=============================================');
      console.log('✅ QR Code saved as an image: qr.png and qr.pdf');
      console.log('Open qr.pdf in your editor to view or share it!');
      console.log('=============================================\n');
    } catch (err) {
      console.error('Failed to generate QR file', err);
    }
  });

  clientInstance.on('ready', async () => {
    console.log('WhatsApp Engine is READY and Connected!');
    isConnected = true;
    qrCodeData = null; // Clear QR code as it's no longer needed

    try {
      console.log('Initiating historical job backfill...');
      const chats = await clientInstance.getChats();
      for (const chat of chats) {
        const chatName = chat.name ? chat.name.toLowerCase() : '';
        const isAllowed = ALLOWED_CHANNELS.some(allowed => chatName.includes(allowed));
        
        if (isAllowed) {
          console.log(`Backfilling from: ${chat.name}`);
          const messages = await chat.fetchMessages({ limit: 50 });
          for (const msg of messages) {
            if (msg.body) {
              parseAndInsertJob(msg.body, chat.name);
            }
          }
        }
      }
      console.log('Historical job backfill complete.');
    } catch (e) {
      console.error('Error during historical backfill:', e);
    }
  });

  clientInstance.on('message_create', async msg => {
    try {
      const chat = await msg.getChat();
      const chatName = chat.name ? chat.name.toLowerCase() : '';

      // Check if it matches our allowed channels
      const isAllowed = ALLOWED_CHANNELS.some(allowed => chatName.includes(allowed));
      
      if (isAllowed) {
        console.log(`Received job posting from allowed channel: ${chat.name}`);
        parseAndInsertJob(msg.body, chat.name);
      } else {
        // Handle user commands
        handleUserCommand(msg);
      }

    } catch (err) {
      console.error('Error processing WhatsApp message:', err);
    }
  });

function handleUserCommand(msg) {
  const text = msg.body.trim();
  const args = text.split(' ');
  const command = args[0].toLowerCase();
  const chatId = msg.from;

  console.log(`[DEBUG] Handling user command: "${command}" from ${chatId}`);

  if (command === '!help' || command === '!menu' || command === 'menu') {
    const textMenu = `🤖 *Ultimate Job Hunter Bot* 🚀\n\nWelcome! What are you looking for today?\n\n*Reply with a command:*\n👉 *!latest* - Get the top 10 most recent jobs\n👉 *!jobs Tech* - Search for Tech jobs\n👉 *!jobs Remote* - Search for Remote jobs\n👉 *!jobs [any keyword]* - Search for anything (e.g. !jobs Lagos)\n👉 *!more* - See the next 10 jobs\n\n_Powered by 20+ Sources_`;
    clientInstance.sendMessage(chatId, textMenu);
    return;
  }

  // Admin Portal Menu
  if (command === '!admin') {
    const password = args[1];
    const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get('access_password');
    if (!password || !setting || password !== setting.value) {
      clientInstance.sendMessage(chatId, '❌ Unauthorized. Usage: *!admin <password>*');
      return;
    }
    
    // Save admin state
    const state = userState.get(chatId) || {};
    state.isAdmin = true;
    userState.set(chatId, state);

    const adminMenu = `🔐 *Admin Portal*\n\nAuthentication Successful!\n\nReply with one of the following commands to manage the database:\n👉 *!delete 30* (Deletes jobs older than 30 days)\n👉 *!delete 14* (Deletes jobs older than 14 days)\n👉 *!clearall* (Wipes the entire database)\n\n_Warning: These actions are irreversible._`;
    clientInstance.sendMessage(chatId, adminMenu);
    return;
  }

  // Admin Deletion Commands
  if (command === '!delete' || command === '!clearall') {
    const state = userState.get(chatId) || {};
    if (state.isAdmin) {
       if (command === '!delete' && args[1] === '30') {
         const result = db.prepare("DELETE FROM jobs WHERE posted_date < datetime('now', '-30 days')").run();
         clientInstance.sendMessage(chatId, `✅ Deleted ${result.changes} jobs older than 30 days.`);
       } else if (command === '!delete' && args[1] === '14') {
         const result = db.prepare("DELETE FROM jobs WHERE posted_date < datetime('now', '-14 days')").run();
         clientInstance.sendMessage(chatId, `✅ Deleted ${result.changes} jobs older than 14 days.`);
       } else if (command === '!clearall') {
         const result = db.prepare("DELETE FROM jobs").run();
         clientInstance.sendMessage(chatId, `☢️ Cleared all ${result.changes} jobs from the database.`);
       }
    } else {
       clientInstance.sendMessage(chatId, '❌ You must login to the admin portal first by typing *!admin <password>*');
    }
    return;
  }

  if (command === '!latest') {
    const jobs = db.prepare('SELECT * FROM jobs ORDER BY date(posted_date) DESC, RANDOM() LIMIT 10').all();
    userState.set(chatId, { type: 'latest', offset: 10 });
    replyWithJobs(msg, jobs, 'Latest Jobs', true);
    return;
  }

  if (command === '!jobs') {
    const rawKeyword = args.slice(1).join(' ');
    if (!rawKeyword) {
      msg.reply('Please specify a keyword or location. For example: *!jobs Tech*, *!jobs Remote*, or *!jobs Lagos*');
      return;
    }

    let keyword = rawKeyword.toLowerCase();
    // Fix common Nigerian location spellings/aliases just in case
    if (keyword === 'ph' || keyword === 'portharcourt' || keyword === 'port-harcourt') keyword = 'port harcourt';
    if (keyword === 'fct') keyword = 'abuja';
    if (keyword === 'akwaibom') keyword = 'akwa ibom';

    let jobs;
    let title;
    
    // Tech expansion
    let sqlKeyword = keyword;
    let techCondition = '';
    if (keyword === 'tech' || keyword === 'it') {
      techCondition = `OR LOWER(title) LIKE '%developer%' OR LOWER(title) LIKE '%software%' OR LOWER(title) LIKE '%engineer%' OR LOWER(title) LIKE '%data%' OR LOWER(title) LIKE '%programmer%'`;
    }

    if (keyword === 'all' || keyword === 'nigeria' || keyword === 'anywhere') {
      jobs = db.prepare('SELECT * FROM jobs ORDER BY date(posted_date) DESC, RANDOM() LIMIT 10').all();
      title = 'Latest Jobs in Nigeria';
    } else if (keyword.includes('/')) {
      const parts = keyword.split('/');
      const rolePart = parts[0].trim();
      const locPart = parts[1].trim();
      
      const rolePattern = `%${rolePart}%`;
      const locPattern = `%${locPart}%`;
      
      jobs = db.prepare(`
        SELECT * FROM jobs 
        WHERE (LOWER(title) LIKE ? OR LOWER(company) LIKE ?)
          AND (LOWER(state) LIKE ? OR LOWER(city) LIKE ?)
        ORDER BY date(posted_date) DESC, RANDOM() LIMIT 10
      `).all(rolePattern, rolePattern, locPattern, locPattern);
      
      title = `Jobs: ${rolePart} in ${locPart}`;
    } else {
      const searchPattern = `%${keyword}%`;
      jobs = db.prepare(`
        SELECT * FROM jobs 
        WHERE LOWER(state) LIKE ? 
           OR LOWER(city) LIKE ? 
           OR LOWER(title) LIKE ? 
           OR LOWER(company) LIKE ?
           ${techCondition}
        ORDER BY date(posted_date) DESC, RANDOM() LIMIT 10
      `).all(searchPattern, searchPattern, searchPattern, searchPattern);
      
      title = `Jobs matching "${keyword.charAt(0).toUpperCase() + keyword.slice(1)}"`;
    }
    
    userState.set(chatId, { type: 'jobs', keyword: keyword, offset: 10 });
    replyWithJobs(msg, jobs, title, true);
    return;
  }

  if (command === '!more') {
    const state = userState.get(chatId);
    if (!state) {
      msg.reply('No recent search found. Please start a new search using *!jobs [keyword]* or *!latest*');
      return;
    }

    let jobs;
    if (state.type === 'latest') {
      jobs = db.prepare(`SELECT * FROM jobs ORDER BY date(posted_date) DESC, RANDOM() LIMIT 10 OFFSET ${state.offset}`).all();
    } else if (state.type === 'jobs') {
      const keyword = state.keyword;
      let techCondition = '';
      if (keyword === 'tech' || keyword === 'it') {
        techCondition = `OR LOWER(title) LIKE '%developer%' OR LOWER(title) LIKE '%software%' OR LOWER(title) LIKE '%engineer%' OR LOWER(title) LIKE '%data%' OR LOWER(title) LIKE '%programmer%'`;
      }

      if (keyword === 'all' || keyword === 'nigeria' || keyword === 'anywhere') {
        jobs = db.prepare(`SELECT * FROM jobs ORDER BY date(posted_date) DESC, RANDOM() LIMIT 10 OFFSET ${state.offset}`).all();
      } else if (keyword.includes('/')) {
        const parts = keyword.split('/');
        const rolePart = parts[0].trim();
        const locPart = parts[1].trim();
        
        const rolePattern = `%${rolePart}%`;
        const locPattern = `%${locPart}%`;
        
        jobs = db.prepare(`
          SELECT * FROM jobs 
          WHERE (LOWER(title) LIKE ? OR LOWER(company) LIKE ?)
            AND (LOWER(state) LIKE ? OR LOWER(city) LIKE ?)
          ORDER BY date(posted_date) DESC, RANDOM() LIMIT 10 OFFSET ${state.offset}
        `).all(rolePattern, rolePattern, locPattern, locPattern);
      } else {
        const searchPattern = `%${keyword}%`;
        jobs = db.prepare(`
          SELECT * FROM jobs 
          WHERE LOWER(state) LIKE ? 
             OR LOWER(city) LIKE ? 
             OR LOWER(title) LIKE ? 
             OR LOWER(company) LIKE ?
             ${techCondition}
          ORDER BY date(posted_date) DESC, RANDOM() LIMIT 10 OFFSET ${state.offset}
        `).all(searchPattern, searchPattern, searchPattern, searchPattern);
      }
    }
    state.offset += 10;
    replyWithJobs(msg, jobs, 'More Jobs', true);
    return;
  }
}

function replyWithJobs(msg, jobs, title, hasMore = false) {
  if (!jobs || jobs.length === 0) {
    msg.reply(`I couldn't find any more jobs matching that request right now. Try another location!`);
    return;
  }

  let replyText = `🎯 *${title}*\n\n`;
  jobs.forEach((job, index) => {
    replyText += `*${index + 1}. ${job.title}*\n`;
    replyText += `🏢 ${job.company}\n`;
    replyText += `📍 ${job.city}, ${job.state}\n`;
    if (job.url && !job.url.startsWith('whatsapp://')) {
       replyText += `🔗 ${job.url}\n`;
    }
    replyText += `\n`;
  });

  if (hasMore && jobs.length === 10) {
    replyText += `\n_Reply with *!more* to see the next 10 jobs_`;
  }

  msg.reply(replyText.trim());
}

  clientInstance.on('disconnected', (reason) => {
    console.log('WhatsApp was disconnected:', reason);
    isConnected = false;
    clientInstance = null;
    qrCodeData = null;
  });

  clientInstance.initialize();
}

function parseAndInsertJob(text, sourceName) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return;

  // Extremely basic heuristic parser for unstructured text blocks
  let title = lines[0]; // Assume first line is title, or extract from "Role: X"
  let company = 'Hidden / WhatsApp Recruit';
  let state = 'Unknown';
  let city = 'Unknown';

  const lowerText = text.toLowerCase();

  // Extract Role
  const roleMatch = text.match(/(?:Role|Job Title|Position|Vacancy):\s*(.+)/i);
  if (roleMatch) title = roleMatch[1].trim();

  // Extract Company
  const compMatch = text.match(/(?:Company|Client|Employer):\s*(.+)/i);
  if (compMatch) company = compMatch[1].trim();

  // Extract Location
  const locMatch = text.match(/(?:Location|Where):\s*(.+)/i);
  if (locMatch) {
    const locString = locMatch[1].trim().toLowerCase();
    if (locString.includes('port harcourt') || locString.includes('ph')) {
      state = 'Rivers';
      city = 'Port Harcourt';
    } else if (locString.includes('lagos')) {
      state = 'Lagos';
    } else if (locString.includes('abuja')) {
      state = 'Abuja';
    }
  }

  // Fallback defaults based on channel origin
  if (state === 'Unknown' && sourceName.toLowerCase().includes('ph')) {
    state = 'Rivers';
    city = 'Port Harcourt';
  } else if (state === 'Unknown' && sourceName.toLowerCase().includes('port-harcourt')) {
    state = 'Rivers';
    city = 'Port Harcourt';
  }
  
  if (state === 'Unknown') {
     state = 'Others';
     city = 'Others';
  }

  // Create a unique URL signature so we don't insert duplicate texts
  const hash = crypto.createHash('md5').update(text).digest('hex');
  const pseudoUrl = `whatsapp://${sourceName}/${hash}`;

  const insertJob = db.prepare('INSERT INTO jobs (id, title, company, state, city, url, posted_date) SELECT ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM jobs WHERE url = ?)');
  const result = insertJob.run(hash, title, company, state, city, pseudoUrl, new Date().toISOString(), pseudoUrl);
  
  if (result.changes > 0) {
    console.log(`[WhatsApp] Inserted new job: ${title} in ${state}`);
  }
}

module.exports = {
  initWhatsApp,
  getQrData: () => qrCodeData,
  getIsConnected: () => isConnected,
  stopWhatsApp: () => {
    if (clientInstance) {
      clientInstance.destroy();
      clientInstance = null;
      isConnected = false;
      qrCodeData = null;
    }
  }
};
