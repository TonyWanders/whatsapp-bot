const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const compression = require('compression');
const db = require('./db/database');
const locations = require('./data/locations');
const whatsapp = require('./whatsapp');
const { startScheduler } = require('./scraper/scheduler');

const app = express();
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/dist')));

const JWT_SECRET = 'super-secret-key-for-now';

// --- AUTHENTICATION & SETUP ---
app.get('/api/auth/setup-status', (req, res) => {
  const isSetup = db.prepare('SELECT count(*) as count FROM users').get().count > 0;
  res.json({ isSetup });
});

app.post('/api/auth/setup', (req, res) => {
  const { adminUsername, adminPassword, publicPassword, recoveryPhrase } = req.body;
  const isSetup = db.prepare('SELECT count(*) as count FROM users').get().count > 0;
  
  if (isSetup) return res.status(400).json({ error: 'App is already setup' });
  if (!adminUsername || !adminPassword || !publicPassword || !recoveryPhrase) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  
  const hash = bcrypt.hashSync(adminPassword, 10);
  db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(adminUsername, hash);
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('access_password', publicPassword);
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('recovery_phrase', recoveryPhrase);
  
  res.json({ success: true });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  
  if (user && bcrypt.compareSync(password, user.password)) {
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- PUBLIC ROUTES ---
app.get('/api/locations', (req, res) => {
  res.json(locations);
});

app.get('/api/jobs', (req, res) => {
  const { state, city } = req.query;
  let query = 'SELECT * FROM jobs ORDER BY posted_date DESC LIMIT 200';
  let params = [];

  if (city && city !== 'All') {
    query = 'SELECT * FROM jobs WHERE city = ? ORDER BY posted_date DESC LIMIT 200';
    params = [city];
  } else if (state && state !== 'All') {
    query = 'SELECT * FROM jobs WHERE state = ? ORDER BY posted_date DESC LIMIT 200';
    params = [state];
  }

  const jobs = db.prepare(query).all(...params);
  res.json(jobs);
});

app.post('/api/auth/verify-access', (req, res) => {
  const { password } = req.body;
  const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get('access_password');
  if (setting && setting.value === password) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Incorrect access password' });
  }
});

// --- ADMIN ROUTES ---
app.post('/api/admin/trigger-scraper', authenticateToken, async (req, res) => {
  res.json({ count: 0, message: "Scraper is now running continuously 24/7 in the background!" });
});

app.delete('/api/admin/jobs/:id', authenticateToken, (req, res) => {
  const result = db.prepare('DELETE FROM jobs WHERE id = ?').run(req.params.id);
  res.json({ success: result.changes > 0 });
});

app.post('/api/admin/change-access-password', authenticateToken, (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword) return res.status(400).json({ error: 'Password required' });
  
  db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(newPassword, 'access_password');
  res.json({ success: true });
});

app.post('/api/admin/change-credentials', authenticateToken, (req, res) => {
  const { newUsername, newPassword } = req.body;
  if (!newUsername || !newPassword) return res.status(400).json({ error: 'Missing fields' });
  
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET username = ?, password = ? WHERE id = ?').run(newUsername, hash, req.user.id);
  res.json({ success: true });
});

app.get('/api/admin/export', authenticateToken, (req, res) => {
  const jobs = db.prepare('SELECT * FROM jobs ORDER BY posted_date DESC').all();
  res.json(jobs);
});

// WhatsApp Admin Routes
app.get('/api/admin/whatsapp-status', authenticateToken, (req, res) => {
  res.json({
    isConnected: whatsapp.getIsConnected(),
    qrData: whatsapp.getQrData()
  });
});

app.post('/api/admin/whatsapp-start', authenticateToken, (req, res) => {
  whatsapp.initWhatsApp();
  res.json({ success: true });
});

// The new multi-source background scheduler handles everything 24/7.
// We just need a cron to prune expired jobs occasionally.
const cron = require('node-cron');
cron.schedule('0 */12 * * *', async () => {
    console.log('Pruning expired jobs (older than 30 days)...');
    db.prepare("DELETE FROM jobs WHERE posted_date < datetime('now', '-30 days')").run();
});

const fs = require('fs');

// React Catch-all route
app.use((req, res) => {
  const indexPath = path.join(__dirname, '../frontend/dist/index.html');
  try {
    const html = fs.readFileSync(indexPath, 'utf8');
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    res.status(500).send(`Fatal Error: Cannot read index.html at ${indexPath}. Detail: ${err.message}`);
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Pruning expired jobs (older than 30 days)...');
  db.prepare("DELETE FROM jobs WHERE posted_date < datetime('now', '-30 days')").run();

  // Start the 24/7 multi-source background crawler
  startScheduler();

  // Start WhatsApp automatically since we are now a bot!
  whatsapp.initWhatsApp();
});
