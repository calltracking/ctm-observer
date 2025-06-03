// CTM WebSocket listener with socket.io, auth, headers, and post-connect subscriptions
import { io } from 'socket.io-client';

const CTM_AUTH_HOST = process.env.CTM_AUTH_HOST;
const CTM_SOCKET_HOST = process.env.CTM_SOCKET_HOST;
const CTM_TOKEN = process.env.CTM_TOKEN;
const CTM_SECRET = process.env.CTM_SECRET;
const CTM_ACCOUNT_ID = process.env.CTM_ACCOUNT_ID;
const CTM_USER_ID = process.env.CTM_USER_ID;
const EMAIL = process.env.CTM_EMAIL || 'demo@calltrackingmetrics.com';
const SESSION_ID = 'observer-session-1';

async function fetchCapToken() {
  const base64Credentials = Buffer.from(`${CTM_TOKEN}:${CTM_SECRET}`).toString('base64');
  const url = `https://${CTM_AUTH_HOST}/api/v1/accounts/${CTM_ACCOUNT_ID}/phone_access`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${base64Credentials}`
    },
    body: JSON.stringify({
      email: EMAIL,
      first_name: 'Socket',
      last_name: 'Observer',
      session_id: SESSION_ID
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to fetch CAP token: ${response.status} ${errText}`);
  }

  const data = await response.json();
  console.log('[auth] Response:', data);
  return {
    capToken: data.token,
    socketHost: CTM_SOCKET_HOST || data.sockethost || 'https://socks.tctm.co'
  };
}

async function startSocketListener() {
  const { capToken, socketHost } = await fetchCapToken();
  console.log('[connect] Using socketHost:', socketHost);

  const socket = io(socketHost, {
    transports: ['websocket'],
    auth: {
      cap_token: capToken,
    },
  });

  socket.on('connect', () => {
    console.log('[+] Socket.io connected.');

    // Subscribe to account and phone streams
    socket.emit('access.account', {
      account: CTM_ACCOUNT_ID,
      captoken: capToken
    });
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
    console.error('[!] Connection error:', err);
    if (err?.data) console.error('[!] Error data:', err.data);
  });
}

startSocketListener().catch(err => {
  console.error('[!] Initialization error:', err);
});
