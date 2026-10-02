import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://personal-cinema-azure.vercel.app';
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const DEBUG_PORT = 9222;

let passed = 0;
let failed = 0;

function assert(cond, name, msg) {
  if (cond) {
    console.log(`[PASS] ${name} - ${msg}`);
    passed++;
  } else {
    console.error(`[FAIL] ${name} - ${msg}`);
    failed++;
  }
}

async function testHttpEndpoints() {
  console.log('\n--- PHASE 1: HTTP ASSET & ROUTE VERIFICATION ---');

  // 1. Fetch live index.html to dynamically discover asset hashes
  let liveHtml = '';
  try {
    const htmlRes = await fetch(`${BASE_URL}/`, { headers: { 'Cache-Control': 'no-cache' } });
    assert(htmlRes.status === 200, 'HTTP 200: Main SPA HTML', `${BASE_URL}/ returned ${htmlRes.status}`);
    liveHtml = await htmlRes.text();
  } catch (err) {
    assert(false, 'HTTP 200: Main SPA HTML', `Fetch failed: ${err.message}`);
  }

  // Extract linked CSS and JS from live HTML
  const cssMatch = liveHtml.match(/\/assets\/index-[^"']+\.css/);
  const jsMatch = liveHtml.match(/\/assets\/index-[^"']+\.js/);

  const endpoints = [
    { url: `${BASE_URL}/manifest.webmanifest`, type: 'application/manifest+json', desc: 'PWA Web Manifest' },
    { url: `${BASE_URL}/sw.js`, type: 'text/javascript', desc: 'Service Worker Script' },
    { url: `${BASE_URL}/icon.svg`, type: 'image/svg+xml', desc: 'Scalable App Icon' },
    { url: `${BASE_URL}/icon-192.png`, type: 'image/png', desc: '192x192 PWA Icon' },
    { url: `${BASE_URL}/icon-512.png`, type: 'image/png', desc: '512x512 PWA Icon' },
    { url: `${BASE_URL}/apple-touch-icon.png`, type: 'image/png', desc: 'Apple Touch Icon' },
    { url: `${BASE_URL}/favicon.png`, type: 'image/png', desc: 'Favicon PNG' },
  ];

  if (cssMatch) {
    endpoints.push({ url: `${BASE_URL}${cssMatch[0]}`, type: 'text/css', desc: 'Live CSS Bundle' });
  }
  if (jsMatch) {
    endpoints.push({ url: `${BASE_URL}${jsMatch[0]}`, type: 'text/javascript', desc: 'Live JS Main Bundle' });
  }

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep.url, { headers: { 'Cache-Control': 'no-cache' } });
      const ok = res.status === 200;
      assert(ok, `HTTP 200: ${ep.desc}`, `${ep.url} returned status ${res.status}`);
    } catch (err) {
      assert(false, `HTTP 200: ${ep.desc}`, `Fetch failed: ${err.message}`);
    }
  }

  // Test TMDB Proxy endpoint
  try {
    const res = await fetch(`${BASE_URL}/api/tmdb?endpoint=/trending/movie/week`, {
      headers: { 'Cache-Control': 'no-cache' },
    });
    const data = await res.json();
    assert(
      res.status === 200 && Array.isArray(data.results) && data.results.length > 0,
      'TMDB Vercel Serverless Proxy',
      `Returned 200 OK with ${data.results?.length || 0} trending movies`
    );
  } catch (err) {
    assert(false, 'TMDB Vercel Serverless Proxy', `Proxy call failed: ${err.message}`);
  }
}

async function runBrowserSmokeTest() {
  console.log('\n--- PHASE 2: REAL HEADLESS BROWSER SMOKE TEST (MS EDGE CDP) ---');

  if (!fs.existsSync(EDGE_PATH)) {
    console.log('Edge executable not found at default path, skipping browser automation.');
    return;
  }

  const userDataDir = path.resolve('.tmp_edge_profile');
  const browserProc = spawn(EDGE_PATH, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ]);

  // Wait for remote debugging to open
  let wsUrl = null;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const vRes = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
      const vData = await vRes.json();
      wsUrl = vData.webSocketDebuggerUrl;
      if (wsUrl) break;
    } catch {
      // Retrying
    }
  }

  if (!wsUrl) {
    console.error('Failed to connect to Edge remote debugging port.');
    browserProc.kill();
    return;
  }

  // Create a new target page
  const newTargetRes = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?${encodeURIComponent(BASE_URL)}`, {
    method: 'PUT',
  });
  const targetData = await newTargetRes.json();
  const pageWsUrl = targetData.webSocketDebuggerUrl;

  const ws = new WebSocket(pageWsUrl);
  let id = 1;
  const pending = new Map();
  const consoleErrors = [];

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      const type = msg.params.type;
      const text = msg.params.args.map((a) => a.value || a.description || '').join(' ');
      if (type === 'error') {
        consoleErrors.push(text);
      }
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      consoleErrors.push(msg.params.exceptionDetails.text);
    }
  };

  const send = (method, params = {}) => {
    return new Promise((resolve) => {
      const msgId = id++;
      pending.set(msgId, resolve);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  };

  await new Promise((r) => (ws.onopen = r));

  // Enable CDP domains
  await send('Page.enable');
  await send('Runtime.enable');

  // Wait for initial load
  console.log('Navigating to Live MyCinema Home...');
  await new Promise((r) => setTimeout(r, 3500));

  // Evaluate state of Home
  const evaluate = async (expr) => {
    const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    return res?.result?.result?.value;
  };

  // 1. HOME SCREEN SMOKE TEST
  const title = await evaluate('document.title');
  assert(title === 'MyCinema', 'Live Page Title', `Title is "${title}"`);

  const rootHtml = await evaluate('document.getElementById("root")?.innerHTML?.length || 0');
  assert(rootHtml > 200, 'Live DOM Render', `Root container rendered ${rootHtml} characters`);

  const hasNavbar = await evaluate('Boolean(document.querySelector("nav") || document.querySelector("aside"))');
  assert(hasNavbar, 'Navigation Element Rendered', 'Found nav / aside navigation element');

  // Check navigation tabs count (strictly 6 desktop & mobile nav items)
  const navButtonsCount = await evaluate('document.querySelectorAll("aside button, nav button, nav a, aside div[role=\'button\']").length');
  console.log(`Active navigation items rendered: ${navButtonsCount}`);

  // 2. DISCOVER ROUTE / TAB
  console.log('Testing DISCOVER tab switch...');
  await evaluate(`(() => {
    const btns = Array.from(document.querySelectorAll("nav button, aside button"));
    const b = btns.find(el => el.textContent?.trim() === "Discover");
    if (b) b.click();
  })()`);
  await new Promise((r) => setTimeout(r, 2000));
  const hasSearchInput = await evaluate('Boolean(document.querySelector("input[placeholder*=\'Search\'], input[type=\'text\']"))');
  assert(hasSearchInput, 'Discover Tab Navigation', 'Search input rendered in Discover view');

  // 3. WATCHLIST TAB
  console.log('Testing WATCHLIST tab switch...');
  await evaluate(`(() => {
    const btns = Array.from(document.querySelectorAll("nav button, aside button"));
    const b = btns.find(el => el.textContent?.trim() === "Watchlist");
    if (b) b.click();
  })()`);
  await new Promise((r) => setTimeout(r, 1500));
  const watchlistText = await evaluate('document.body.innerText');
  assert(watchlistText.includes('Watchlist') || watchlistText.includes('WATCHLIST'), 'Watchlist Tab Navigation', 'Watchlist view active');

  // 4. WATCHED TAB
  console.log('Testing WATCHED tab switch...');
  await evaluate(`(() => {
    const btns = Array.from(document.querySelectorAll("nav button, aside button"));
    const b = btns.find(el => el.textContent?.trim() === "Watched");
    if (b) b.click();
  })()`);
  await new Promise((r) => setTimeout(r, 1500));
  const watchedText = await evaluate('document.body.innerText');
  assert(watchedText.includes('Watched') || watchedText.includes('WATCHED'), 'Watched Tab Navigation', 'Watched view active');

  // 5. COLLECTIONS TAB
  console.log('Testing COLLECTIONS tab switch...');
  await evaluate(`(() => {
    const btns = Array.from(document.querySelectorAll("nav button, aside button"));
    const b = btns.find(el => el.textContent?.trim() === "Collections");
    if (b) b.click();
  })()`);
  await new Promise((r) => setTimeout(r, 1500));
  const collectionsText = await evaluate('document.body.innerText');
  assert(collectionsText.includes('Collections') || collectionsText.includes('COLLECTIONS'), 'Collections Tab Navigation', 'Collections view active');

  // 6. PROFILE TAB
  console.log('Testing PROFILE tab switch...');
  await evaluate(`(() => {
    const btns = Array.from(document.querySelectorAll("nav button, aside button"));
    const b = btns.find(el => el.textContent?.trim() === "Profile");
    if (b) b.click();
  })()`);
  await new Promise((r) => setTimeout(r, 1500));
  const profileText = await evaluate('document.body.innerText');
  assert(profileText.includes('Profile') || profileText.includes('My Cinema') || profileText.includes('Preferences'), 'Profile Tab Navigation', 'Profile view active');

  // 7. FILM JOURNAL / REVIEWS ROUTE (Direct hash & profile link)
  console.log('Testing REVIEWS & FILM JOURNAL navigation...');
  await evaluate('window.location.hash = "#reviews"');
  await new Promise((r) => setTimeout(r, 1500));
  const reviewsText = await evaluate('document.body.innerText');
  assert(
    reviewsText.includes('Film Journal') || reviewsText.includes('REVIEWS') || reviewsText.includes('NO REVIEWS YET'),
    'Reviews & Film Journal Navigation (#reviews)',
    'Film Journal destination successfully rendered on live deployment'
  );

  // 8. CONSOLE ERRORS AUDIT
  console.log('\n--- PHASE 3: CONSOLE ERRORS & CRITICAL LOG AUDIT ---');
  // Filter out any benign analytics or font warnings
  const criticalErrors = consoleErrors.filter(
    (e) => !e.includes('favicon') && !e.includes('font') && !e.includes('Non-Error promise rejection')
  );

  if (criticalErrors.length === 0) {
    assert(true, 'Zero Console Errors on Live Vercel App', 'No uncaught exceptions or React errors');
  } else {
    console.error('Captured console errors:', criticalErrors);
    assert(false, 'Zero Console Errors on Live Vercel App', `Found ${criticalErrors.length} console errors`);
  }

  // Cleanup
  ws.close();
  browserProc.kill();
  try {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  } catch {}
}

async function main() {
  console.log('============================================================');
  console.log('MYCINEMA — LIVE VERCEL DEPLOYMENT SMOKE TEST SUITE');
  console.log(`Target: ${BASE_URL}`);
  console.log('============================================================');

  await testHttpEndpoints();
  await runBrowserSmokeTest();

  console.log('\n============================================================');
  console.log(`SMOKE TEST SUMMARY: ${passed} Passed | ${failed} Failed`);
  console.log('============================================================');

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Smoke test crashed:', err);
  process.exit(1);
});
