// server/metrics.js
// Lightweight, low-impact metrics collector.
// - Keeps in-memory rolling counts for the last N days (default 7)
// - Persists snapshots to disk periodically (every minute) to avoid data loss
// - Exposes simple increment and snapshot APIs
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(new URL('.', import.meta.url).pathname, 'data');
const METRICS_FILE = path.join(DATA_DIR, 'metrics.json');
const PAYMENTS_LOG = path.join(DATA_DIR, 'payments.log');

// Days to keep in the rolling window
const WINDOW_DAYS = 7;

function todayKey(offset = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function ensureDataDir() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) { /* ignore */ }
}

// Default metrics shape
function emptyMetrics() {
  return {
    // per-day counters: { 'YYYY-MM-DD': { lobby:{}, goblin:{}, color:{} } }
    days: {},
    // low-traffic cumulative payments are stored separately as appended log lines
    last_persist: null
  };
}

let metrics = emptyMetrics();
ensureDataDir();

// Try load existing metrics file (best-effort, not critical)
try {
  if (fs.existsSync(METRICS_FILE)) {
    const raw = fs.readFileSync(METRICS_FILE, 'utf8');
    metrics = JSON.parse(raw);
  }
} catch (e) {
  console.warn('metrics: failed to load previous metrics file, starting fresh');
  metrics = emptyMetrics();
}

function pruneOldDays() {
  const keep = new Set();
  for (let i = 0; i < WINDOW_DAYS; i++) keep.add(todayKey(i));
  for (const day of Object.keys(metrics.days)) {
    if (!keep.has(day)) delete metrics.days[day];
  }
}

function ensureDay(day) {
  if (!metrics.days[day]) metrics.days[day] = { lobby: {}, goblin: {}, color: {} };
}

export function incrLobby(lobbyType, n = 1) {
  try {
    const day = todayKey(0);
    ensureDay(day);
    const cur = metrics.days[day].lobby;
    cur[lobbyType] = (cur[lobbyType] || 0) + n;
  } catch (e) { /* swallow to avoid impacting runtime */ }
}

export function incrGoblin(shape, n = 1) {
  try {
    const day = todayKey(0);
    ensureDay(day);
    const cur = metrics.days[day].goblin;
    cur[shape] = (cur[shape] || 0) + n;
  } catch (e) { }
}

export function incrColor(color, n = 1) {
  try {
    const day = todayKey(0);
    ensureDay(day);
    const cur = metrics.days[day].color;
    cur[color] = (cur[color] || 0) + n;
  } catch (e) { }
}

export function snapshot() {
  // Return a copy of current rolling-window aggregates
  pruneOldDays();
  return JSON.parse(JSON.stringify(metrics));
}

function persistSync() {
  try {
    metrics.last_persist = new Date().toISOString();
    fs.writeFileSync(METRICS_FILE, JSON.stringify(metrics, null, 2), { encoding: 'utf8' });
  } catch (e) {
    // don't crash the server for metrics write failures
    console.warn('metrics: persist failed', e?.message || e);
  }
}

// Periodically persist to disk (every 10 minutes). Keep interval low-impact.
const PERSIST_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
setInterval(() => { pruneOldDays(); persistSync(); }, PERSIST_INTERVAL_MS).unref();

// Expose a small helper to append payment records (JSON-lines) - low-frequency
export function appendPaymentRecord(obj) {
  try {
    ensureDataDir();
    const line = JSON.stringify(obj) + '\n';
    fs.appendFileSync(PAYMENTS_LOG, line, { encoding: 'utf8' });
  } catch (e) {
    console.warn('metrics: failed to append payment record', e?.message || e);
  }
}

// Ensure a final sync on process exit
try {
  process.on && process.on('exit', () => { persistSync(); });
} catch (e) {}

export default { incrLobby, incrGoblin, incrColor, snapshot, appendPaymentRecord };
