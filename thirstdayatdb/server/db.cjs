const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'darts.db');

let db;

function getDb() {
  if (!db) {
    // Ensure data directory exists
    const fs = require('fs');
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      rating REAL DEFAULT 0,
      notes TEXT DEFAULT '',
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      notes TEXT DEFAULT '',
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      playerId TEXT NOT NULL,
      sessionId TEXT NOT NULL,
      status TEXT NOT NULL,
      FOREIGN KEY (playerId) REFERENCES players(id),
      FOREIGN KEY (sessionId) REFERENCES sessions(id)
    );

    CREATE TABLE IF NOT EXISTS match_performances (
      id TEXT PRIMARY KEY,
      playerId TEXT NOT NULL,
      sessionId TEXT NOT NULL,
      score REAL DEFAULT 0,
      FOREIGN KEY (playerId) REFERENCES players(id),
      FOREIGN KEY (sessionId) REFERENCES sessions(id)
    );

    CREATE TABLE IF NOT EXISTS game_performances (
      id TEXT PRIMARY KEY,
      playerId TEXT NOT NULL,
      sessionId TEXT NOT NULL,
      gameId INTEGER NOT NULL,
      gameType TEXT NOT NULL,
      format TEXT NOT NULL,
      partnerIds TEXT DEFAULT '[]',
      won INTEGER DEFAULT 0,
      legsWon INTEGER DEFAULT 0,
      legsLost INTEGER DEFAULT 0,
      stats01 REAL DEFAULT 0,
      statsCricket REAL DEFAULT 0,
      FOREIGN KEY (playerId) REFERENCES players(id),
      FOREIGN KEY (sessionId) REFERENCES sessions(id)
    );

    CREATE TABLE IF NOT EXISTS player_responses (
      id TEXT PRIMARY KEY,
      playerId TEXT NOT NULL,
      playerName TEXT DEFAULT '',
      sessionId TEXT NOT NULL,
      status TEXT NOT NULL,
      respondedAt TEXT NOT NULL,
      method TEXT DEFAULT 'link',
      FOREIGN KEY (playerId) REFERENCES players(id),
      FOREIGN KEY (sessionId) REFERENCES sessions(id)
    );
  `);
}

// --- CRUD helpers ---

function allRows(table) {
  return getDb().prepare(`SELECT * FROM ${table}`).all();
}

function getRow(table, id) {
  return getDb().prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
}

function deleteRow(table, id) {
  getDb().prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
}

function upsertRow(table, data, columns) {
  const existing = getRow(table, data.id);
  if (existing) {
    const sets = columns.map(c => `${c} = @${c}`).join(', ');
    getDb().prepare(`UPDATE ${table} SET ${sets} WHERE id = @id`).run(data);
  } else {
    const cols = columns.join(', ');
    const vals = columns.map(c => `@${c}`).join(', ');
    getDb().prepare(`INSERT INTO ${table} (${cols}) VALUES (${vals})`).run(data);
  }
}

// --- Export API ---

module.exports = {
  // Players
  getPlayers: () => allRows('players'),
  savePlayer: (p) => upsertRow('players', p, ['id', 'name', 'rating', 'notes', 'createdAt']),
  deletePlayer: (id) => deleteRow('players', id),

  // Sessions
  getSessions: () => allRows('sessions'),
  saveSession: (s) => upsertRow('sessions', s, ['id', 'date', 'type', 'notes', 'createdAt']),
  deleteSession: (id) => deleteRow('sessions', id),

  // Attendance
  getAttendance: () => allRows('attendance'),
  setAttendance: (records) => {
    const db2 = getDb();
    const tx = db2.transaction((recs) => {
      db2.prepare('DELETE FROM attendance').run();
      const insert = db2.prepare('INSERT INTO attendance (id, playerId, sessionId, status) VALUES (@id, @playerId, @sessionId, @status)');
      for (const r of recs) insert.run(r);
    });
    tx(records);
  },
  saveAttendanceRecord: (r) => upsertRow('attendance', r, ['id', 'playerId', 'sessionId', 'status']),

  // Match Performances
  getPerformances: () => allRows('match_performances'),
  setPerformances: (records) => {
    const db2 = getDb();
    const tx = db2.transaction((recs) => {
      db2.prepare('DELETE FROM match_performances').run();
      const insert = db2.prepare('INSERT INTO match_performances (id, playerId, sessionId, score) VALUES (@id, @playerId, @sessionId, @score)');
      for (const r of recs) insert.run(r);
    });
    tx(records);
  },
  savePerformance: (p) => upsertRow('match_performances', p, ['id', 'playerId', 'sessionId', 'score']),

  // Game Performances
  getGamePerformances: () => allRows('game_performances'),
  setGamePerformances: (records) => {
    const db2 = getDb();
    const tx = db2.transaction((recs) => {
      db2.prepare('DELETE FROM game_performances').run();
      const insert = db2.prepare(`INSERT INTO game_performances (id, playerId, sessionId, gameId, gameType, format, partnerIds, won, legsWon, legsLost, stats01, statsCricket) VALUES (@id, @playerId, @sessionId, @gameId, @gameType, @format, @partnerIds, @won, @legsWon, @legsLost, @stats01, @statsCricket)`);
      for (const r of recs) insert.run(r);
    });
    tx(records);
  },
  saveGamePerformance: (g) => upsertRow('game_performances', g, ['id', 'playerId', 'sessionId', 'gameId', 'gameType', 'format', 'partnerIds', 'won', 'legsWon', 'legsLost', 'stats01', 'statsCricket']),

  // Player Responses
  getResponses: () => allRows('player_responses'),
  saveResponse: (r) => upsertRow('player_responses', r, ['id', 'playerId', 'playerName', 'sessionId', 'status', 'respondedAt', 'method']),

  // Bulk load / save
  loadAll: () => ({
    players: allRows('players'),
    sessions: allRows('sessions'),
    attendance: allRows('attendance'),
    performances: allRows('match_performances'),
    gamePerformances: allRows('game_performances').map(g => ({ ...g, won: !!g.won, partnerIds: JSON.parse(g.partnerIds || '[]') })),
    responses: allRows('player_responses'),
  }),

  saveAll: (data) => {
    const db2 = getDb();
    const tx = db2.transaction(() => {
      db2.prepare('DELETE FROM players').run();
      db2.prepare('DELETE FROM sessions').run();
      db2.prepare('DELETE FROM attendance').run();
      db2.prepare('DELETE FROM match_performances').run();
      db2.prepare('DELETE FROM game_performances').run();
      db2.prepare('DELETE FROM player_responses').run();

      const insP = db2.prepare('INSERT INTO players (id, name, rating, notes, createdAt) VALUES (@id, @name, @rating, @notes, @createdAt)');
      for (const r of (data.players || [])) insP.run(r);

      const insS = db2.prepare('INSERT INTO sessions (id, date, type, notes, createdAt) VALUES (@id, @date, @type, @notes, @createdAt)');
      for (const r of (data.sessions || [])) insS.run(r);

      const insA = db2.prepare('INSERT INTO attendance (id, playerId, sessionId, status) VALUES (@id, @playerId, @sessionId, @status)');
      for (const r of (data.attendance || [])) insA.run(r);

      const insM = db2.prepare('INSERT INTO match_performances (id, playerId, sessionId, score) VALUES (@id, @playerId, @sessionId, @score)');
      for (const r of (data.performances || [])) insM.run(r);

      const insG = db2.prepare(`INSERT INTO game_performances (id, playerId, sessionId, gameId, gameType, format, partnerIds, won, legsWon, legsLost, stats01, statsCricket) VALUES (@id, @playerId, @sessionId, @gameId, @gameType, @format, @partnerIds, @won, @legsWon, @legsLost, @stats01, @statsCricket)`);
      for (const r of (data.gamePerformances || [])) insG.run(r);

      const insR = db2.prepare('INSERT INTO player_responses (id, playerId, playerName, sessionId, status, respondedAt, method) VALUES (@id, @playerId, @playerName, @sessionId, @status, @respondedAt, @method)');
      for (const r of (data.responses || [])) insR.run(r);
    });
    tx();
  },
};