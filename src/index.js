import { io } from 'socket.io-client';

// Check environment variables
['CTM_HOST', 'CTM_TOKEN', 'CTM_SECRET', 'CTM_ACCOUNT_ID'].forEach(varName => {
  if (!process.env[varName]) {
    throw new Error(`Environment variable ${varName} is not set.`);
  }
});

const CTM_HOST = process.env.CTM_HOST;
const CTM_TOKEN = process.env.CTM_TOKEN;
const CTM_SECRET = process.env.CTM_SECRET;
const CTM_ACCOUNT_ID = process.env.CTM_ACCOUNT_ID;

async function fetchCapToken() {
  const base64Credentials = Buffer.from(`${CTM_TOKEN}:${CTM_SECRET}`).toString('base64');
  const url = `https://${CTM_HOST}/api/v1/accounts/${CTM_ACCOUNT_ID}/phone_access`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${base64Credentials}`,
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to fetch CAP token: ${response.status} ${errText}`);
  }

  const data = await response.json();
  console.log('[auth] Response:', data);
  return data.token;
}

async function startSocketListener() {
  const cap_token = await fetchCapToken();

  if (!cap_token) {
    throw new Error('CAP token is empty. Authentication failed.');
  }

  console.log('[connect] CTM_HOST:', CTM_HOST);
  const wss = `wss://${CTM_HOST}`;
  console.log('[connect] WebSocket URL:', wss);

  const socket = io(wss, {
    transports: ['websocket'],
    auth: { cap_token },
  });
  console.log('[+] Connecting to CTM WebSocket...');

  socket.on('connect', () => {
    console.log('[+] Socket.io connected.');
    socket.emit('access.account', { account: CTM_ACCOUNT_ID, captoken: cap_token });
  });

  socket.on('message', (data) => {
    try {
      const msg = typeof data === 'string' ? JSON.parse(data) : data;
      const action = `ctm.${msg.what}.${msg.action}`;
      console.log(`[event] ${action}`, msg.data);
    } catch (err) {
      console.error('Invalid message:', data);
    }
  });

  socket.on('disconnect', (reason) => {
    console.log(`[x] Disconnected: ${reason}`);
  });

  socket.on('connect_error', (err) => {
    console.error('[!] Connection error:', err.message);
    if (err?.data) console.error('[!] Error data:', err.data);
  });
}

startSocketListener().catch(err => {
  console.error('[!] Initialization error:', err);
});
