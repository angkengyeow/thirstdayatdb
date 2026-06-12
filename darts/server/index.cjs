const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db.cjs');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// --- API Routes ---

// Bulk load all data
app.get('/api/data/load', (req, res) => {
  try {
    const data = db.loadAll();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk save all data (full snapshot)
app.post('/api/data/save', (req, res) => {
  try {
    db.saveAll(req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Players
app.get('/api/data/players', (req, res) => res.json(db.getPlayers()));
app.post('/api/data/players', (req, res) => { db.savePlayer(req.body); res.json({ ok: true }); });
app.delete('/api/data/players/:id', (req, res) => { db.deletePlayer(req.params.id); res.json({ ok: true }); });

// Sessions
app.get('/api/data/sessions', (req, res) => res.json(db.getSessions()));
app.post('/api/data/sessions', (req, res) => { db.saveSession(req.body); res.json({ ok: true }); });
app.delete('/api/data/sessions/:id', (req, res) => { db.deleteSession(req.params.id); res.json({ ok: true }); });

// Attendance
app.get('/api/data/attendance', (req, res) => res.json(db.getAttendance()));
app.put('/api/data/attendance', (req, res) => { db.setAttendance(req.body); res.json({ ok: true }); });
app.post('/api/data/attendance', (req, res) => { db.saveAttendanceRecord(req.body); res.json({ ok: true }); });

// Match Performances
app.get('/api/data/performances', (req, res) => res.json(db.getPerformances()));
app.put('/api/data/performances', (req, res) => { db.setPerformances(req.body); res.json({ ok: true }); });
app.post('/api/data/performances', (req, res) => { db.savePerformance(req.body); res.json({ ok: true }); });

// Game Performances
app.get('/api/data/game-performances', (req, res) => res.json(db.getGamePerformances()));
app.put('/api/data/game-performances', (req, res) => { db.setGamePerformances(req.body); res.json({ ok: true }); });
app.post('/api/data/game-performances', (req, res) => { db.saveGamePerformance(req.body); res.json({ ok: true }); });

// Responses
app.get('/api/data/responses', (req, res) => res.json(db.getResponses()));
app.post('/api/data/responses', (req, res) => { db.saveResponse(req.body); res.json({ ok: true }); });

// Serve static files in production
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// Catch-all: serve index.html for non-API routes (SPA support)
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) next();
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});