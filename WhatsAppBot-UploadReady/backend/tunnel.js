const localtunnel = require('localtunnel');
const axios = require('axios');

const PORT = 3001;
const SUBDOMAIN = 'ngjobhunter-live';

let tunnelInstance = null;
let healthCheckInterval = null;

async function startTunnel() {
  console.log(`Starting Localtunnel on port ${PORT} with subdomain ${SUBDOMAIN}...`);
  
  try {
    tunnelInstance = await localtunnel({ port: PORT, subdomain: SUBDOMAIN });
    
    if (!tunnelInstance.url.includes(SUBDOMAIN)) {
      console.log(`WARNING: Requested subdomain was in use. Got: ${tunnelInstance.url}`);
      console.log(`Killing ghost tunnel and retrying in 5 seconds...`);
      tunnelInstance.close();
      setTimeout(startTunnel, 5000);
      return;
    }

    console.log(`Success! Tunnel is active at: ${tunnelInstance.url}`);

    tunnelInstance.on('close', () => {
      console.log('Tunnel closed unexpectedly.');
      handleReconnect();
    });

    tunnelInstance.on('error', (err) => {
      console.error('Tunnel error:', err);
    });

    // Start aggressive health checking
    if (healthCheckInterval) clearInterval(healthCheckInterval);
    healthCheckInterval = setInterval(checkHealth, 15000); // Check every 15 seconds

  } catch (err) {
    console.error('Failed to create tunnel:', err.message);
    setTimeout(startTunnel, 5000);
  }
}

async function checkHealth() {
  if (!tunnelInstance) return;
  
  try {
    // Ping the tunnel url. Using a timeout of 5 seconds to ensure we don't hang.
    const res = await axios.get(tunnelInstance.url, { timeout: 5000 });
    // If it succeeds, the tunnel is up. (A 503 from localtunnel would throw an error in Axios)
  } catch (error) {
    if (error.response && error.response.status === 503) {
      console.log('CRITICAL: Tunnel returned 503 Unavailable. Force rebooting tunnel...');
      handleReconnect();
    } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      console.log('CRITICAL: Tunnel connection timed out. Force rebooting tunnel...');
      handleReconnect();
    }
    // Other errors might just be our backend acting up (e.g., 500 internal server error), which shouldn't kill the tunnel.
  }
}

let isReconnecting = false;

function handleReconnect() {
  if (isReconnecting) return;
  isReconnecting = true;
  
  if (healthCheckInterval) clearInterval(healthCheckInterval);
  if (tunnelInstance) {
    tunnelInstance.removeAllListeners('close');
    tunnelInstance.close();
    tunnelInstance = null;
  }
  console.log('Reconnecting in 5 seconds...');
  setTimeout(() => {
    isReconnecting = false;
    startTunnel();
  }, 5000);
}

startTunnel();
