const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3000);
const database = new DatabaseSync(path.join(__dirname, 'scores.sqlite'));
const games = ['snake', 'memory', 'reaction', 'mole', 'baseball', 'rocket'];
const publicFiles = new Map([
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/node_modules/matter-js/build/matter.min.js', ['node_modules/matter-js/build/matter.min.js', 'text/javascript; charset=utf-8']]
]);

database.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(name) BETWEEN 1 AND 24),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS score_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game TEXT NOT NULL CHECK (game IN ('snake', 'memory', 'reaction', 'mole', 'baseball', 'rocket')),
    points INTEGER NOT NULL CHECK (points > 0 AND points <= 100000),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const scoreTable = database.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'score_events'").get();
if (!scoreTable.sql.includes("'rocket'")) {
  database.exec(`
    BEGIN IMMEDIATE;
    ALTER TABLE score_events RENAME TO score_events_previous;
    CREATE TABLE score_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      game TEXT NOT NULL CHECK (game IN ('snake', 'memory', 'reaction', 'mole', 'baseball', 'rocket')),
      points INTEGER NOT NULL CHECK (points > 0 AND points <= 100000),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO score_events (id, user_id, game, points, created_at)
      SELECT id, user_id, game, points, created_at FROM score_events_previous;
    DROP TABLE score_events_previous;
    COMMIT;
  `);
}
database.exec('CREATE INDEX IF NOT EXISTS score_events_user_game_idx ON score_events(user_id, game)');

const findUserByName = database.prepare('SELECT id, name FROM users WHERE name = ?');
const findUserById = database.prepare('SELECT id, name FROM users WHERE id = ?');
const insertUser = database.prepare('INSERT INTO users (name) VALUES (?) ON CONFLICT(name) DO NOTHING');
const insertScore = database.prepare('INSERT INTO score_events (user_id, game, points) VALUES (?, ?, ?)');
const getPlayers = database.prepare(`
  SELECT
    users.id,
    users.name,
    users.created_at,
    COALESCE(SUM(score_events.points), 0) AS total,
    COALESCE(SUM(CASE WHEN score_events.game = 'snake' THEN score_events.points ELSE 0 END), 0) AS snake,
    COALESCE(SUM(CASE WHEN score_events.game = 'memory' THEN score_events.points ELSE 0 END), 0) AS memory,
    COALESCE(SUM(CASE WHEN score_events.game = 'reaction' THEN score_events.points ELSE 0 END), 0) AS reaction,
    COALESCE(SUM(CASE WHEN score_events.game = 'mole' THEN score_events.points ELSE 0 END), 0) AS mole,
    COALESCE(SUM(CASE WHEN score_events.game = 'baseball' THEN score_events.points ELSE 0 END), 0) AS baseball,
    COALESCE(SUM(CASE WHEN score_events.game = 'rocket' THEN score_events.points ELSE 0 END), 0) AS rocket
  FROM users
  LEFT JOIN score_events ON score_events.user_id = users.id
  GROUP BY users.id
  ORDER BY total DESC, users.created_at ASC, users.id ASC
`);

function sendJson(response, status, data) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  response.end(JSON.stringify(data));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 4096) reject(new Error('요청 크기가 너무 큽니다.'));
    });
    request.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('올바른 JSON 형식이 아닙니다.')); }
    });
    request.on('error', reject);
  });
}

function serializePlayer(row, rank) {
  return {
    id: row.id,
    name: row.name,
    rank,
    total: Number(row.total),
    scores: Object.fromEntries(games.map((game) => [game, Number(row[game])]))
  };
}

async function handleApi(request, response, url) {
  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/health') {
    sendJson(response, 200, { status: 'ok', database: 'sqlite' });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/users') {
    const payload = await readJson(request);
    const name = typeof payload.name === 'string' ? payload.name.trim() : '';
    if (!name || name.length > 24) {
      sendJson(response, 400, { error: '이름은 1자 이상 24자 이하로 입력해 주세요.' });
      return;
    }
    insertUser.run(name);
    const user = findUserByName.get(name);
    sendJson(response, 200, { user });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/leaderboard') {
    const rows = getPlayers.all();
    const players = rows.map(serializePlayer);
    players.forEach((player, index) => { player.rank = index + 1; });
    const userId = Number(url.searchParams.get('userId'));
    sendJson(response, 200, {
      players: players.slice(0, 10),
      currentUser: Number.isInteger(userId) ? players.find((player) => player.id === userId) || null : null
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/scores') {
    const payload = await readJson(request);
    const userId = Number(payload.userId);
    const points = Number(payload.points);
    if (!Number.isInteger(userId) || !findUserById.get(userId)) {
      sendJson(response, 400, { error: '플레이어를 먼저 등록해 주세요.' });
      return;
    }
    if (!games.includes(payload.game) || !Number.isInteger(points) || points < 1 || points > 100000) {
      sendJson(response, 400, { error: '게임 점수 정보가 올바르지 않습니다.' });
      return;
    }
    insertScore.run(userId, payload.game, points);
    sendJson(response, 201, { saved: true });
    return;
  }

  sendJson(response, 404, { error: '요청한 API를 찾을 수 없습니다.' });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${host}:${port}`);
  if (url.pathname.startsWith('/api/')) {
    try { await handleApi(request, response, url); } catch (error) {
      if (!response.headersSent) sendJson(response, 400, { error: error.message || '요청을 처리하지 못했습니다.' });
      else response.destroy();
    }
    return;
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end();
    return;
  }

  const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
  const asset = publicFiles.get(pathname);
  if (!asset) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  const [fileName, contentType] = asset;
  fs.readFile(path.join(__dirname, fileName), (error, contents) => {
    if (error) {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Unable to read application file');
      return;
    }
    response.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache' });
    response.end(request.method === 'HEAD' ? undefined : contents);
  });
});

server.listen(port, host, () => {
  console.log(`Playground running at http://${host}:${port}`);
  console.log(`SQLite database: ${path.join(__dirname, 'scores.sqlite')}`);
});

function shutdown() {
  server.close(() => {
    database.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);