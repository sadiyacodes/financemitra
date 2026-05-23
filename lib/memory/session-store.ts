import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export interface SessionData {
  conversationHistory: { role: "user" | "assistant"; content: string }[];
  lastToolResults?: Record<string, any>;
  sessionStartedAt: string;
}

// ── Singleton DB connection ──────────────────────────────────────────────────
let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;

  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  _db = new Database(path.join(dataDir, 'sessions.db'));

  _db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      session_id   TEXT PRIMARY KEY,
      history      TEXT NOT NULL DEFAULT '[]',
      started_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL
    );
  `);

  return _db;
}

// ── Public API ───────────────────────────────────────────────────────────────
export function getSession(sessionId: string): SessionData {
  const db = getDb();
  const row = db
    .prepare('SELECT history, started_at FROM sessions WHERE session_id = ?')
    .get(sessionId) as { history: string; started_at: string } | undefined;

  if (!row) {
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO sessions (session_id, history, started_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run(sessionId, '[]', now, now);
    return { conversationHistory: [], lastToolResults: {}, sessionStartedAt: now };
  }

  return {
    conversationHistory: JSON.parse(row.history),
    lastToolResults: {},
    sessionStartedAt: row.started_at,
  };
}

export function updateSessionHistory(
  sessionId: string,
  newMessages: { role: "user" | "assistant"; content: string }[]
) {
  const db = getDb();
  const session = getSession(sessionId);

  session.conversationHistory.push(...newMessages);

  // Keep last 20 messages (doubled from old 10)
  if (session.conversationHistory.length > 20) {
    session.conversationHistory = session.conversationHistory.slice(-20);
  }

  db.prepare(
    'UPDATE sessions SET history = ?, updated_at = ? WHERE session_id = ?'
  ).run(JSON.stringify(session.conversationHistory), new Date().toISOString(), sessionId);
}

export function clearSession(sessionId: string) {
  getDb().prepare('DELETE FROM sessions WHERE session_id = ?').run(sessionId);
}
