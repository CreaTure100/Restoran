const { runScenario } = require('./scenarios');

const BASE_URL = process.env.LOAD_BASE_URL || 'http://localhost:3001';
const DURATION = Number(process.env.LOAD_DURATION_SECONDS || 20);
const CONNECTIONS = Number(process.env.LOAD_CONNECTIONS || 20);
const MAX_ERROR_RATE = Number(process.env.LOAD_MAX_ERROR_RATE || 0.05);
const MAX_P95_MS = Number(process.env.LOAD_MAX_P95_MS || 800);

const adminEmail = process.env.LOAD_ADMIN_EMAIL || 'admin@restaurant.com';
const adminPassword = process.env.LOAD_ADMIN_PASSWORD || 'admin123';
const clientEmail = process.env.LOAD_CLIENT_EMAIL || 'client@example.com';
const clientPassword = process.env.LOAD_CLIENT_PASSWORD || 'client123';

async function login(email, password) {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(`Login failed for ${email}: ${response.status}`);
  }

  const body = await response.json();
  return body.accessToken;
}

async function main() {
  const clientToken = await login(clientEmail, clientPassword);
  const adminToken = await login(adminEmail, adminPassword);

  const scenarios = [
    {
      title: 'GET /api/menu',
      url: `${BASE_URL}/api/menu`,
      method: 'GET',
      duration: DURATION,
      connections: CONNECTIONS,
    },
    {
      title: 'GET /api/tables',
      url: `${BASE_URL}/api/tables`,
      method: 'GET',
      headers: { Authorization: `Token ${clientToken}` },
      duration: DURATION,
      connections: CONNECTIONS,
    },
    {
      title: 'GET /api/orders',
      url: `${BASE_URL}/api/orders`,
      method: 'GET',
      headers: { Authorization: `Token ${adminToken}` },
      duration: DURATION,
      connections: CONNECTIONS,
    },
    {
      title: 'GET /api/kitchen/queue',
      url: `${BASE_URL}/api/kitchen/queue`,
      method: 'GET',
      headers: { Authorization: `Token ${adminToken}` },
      duration: DURATION,
      connections: CONNECTIONS,
    },
    {
      title: 'Parallel booking attempt /api/tables/10/book',
      url: `${BASE_URL}/api/tables/10/book`,
      method: 'POST',
      headers: {
        Authorization: `Token ${clientToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ timeSlot: '20:00-21:00' }),
      duration: DURATION,
      connections: CONNECTIONS,
    },
    {
      title: 'Order creation under load /api/orders',
      url: `${BASE_URL}/api/orders`,
      method: 'POST',
      headers: {
        Authorization: `Token ${clientToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tableId: 10, timeSlot: '20:00-21:00', dishes: [{ dishId: 1, quantity: 1 }] }),
      duration: DURATION,
      connections: Math.max(5, Math.floor(CONNECTIONS / 2)),
    },
  ];

  const results = [];
  for (const scenario of scenarios) {
    const result = await runScenario(scenario);
    results.push(result);
  }

  const failed = results.filter(
    (result) => result.error || result.errorRate > MAX_ERROR_RATE || result.latencyP95 > MAX_P95_MS,
  );

  console.table(
    results.map((result) => ({
      scenario: result.title,
      p95_ms: result.latencyP95,
      requests: result.requests,
      non2xx: result.non2xx,
      errorRate: result.errorRate,
    })),
  );

  if (failed.length > 0) {
    console.error('Load SLA failed', failed);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
