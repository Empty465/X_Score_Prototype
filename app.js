const views = [...document.querySelectorAll('.view')];
const navItems = [...document.querySelectorAll('.nav-item')];
const breadcrumbCurrent = document.querySelector('#breadcrumb-current');
const titles = { home: '오늘의 게임', snake: '스네이크 런', memory: '짝꿍 찾기', reaction: '순간 포착', mole: '두더지 잡기', baseball: '숫자 야구', rocket: '로켓 착륙' };
const bestKeys = { snake: 'playground-best-snake', memory: 'playground-best-memory', reaction: 'playground-best-reaction', mole: 'playground-best-mole', baseball: 'playground-best-baseball', rocket: 'playground-best-rocket' };
const scoreGames = [
  { id: 'snake', label: '스네이크 런', icon: '↝' },
  { id: 'memory', label: '짝꿍 찾기', icon: '▦' },
  { id: 'reaction', label: '순간 포착', icon: '✳' },
  { id: 'mole', label: '두더지 잡기', icon: '⌁' },
  { id: 'baseball', label: '숫자 야구', icon: '#' },
  { id: 'rocket', label: '로켓 착륙', icon: '▲' }
];
let activePlayer = null;
try { activePlayer = JSON.parse(localStorage.getItem('playground-player') || 'null'); } catch { activePlayer = null; }

document.querySelector('#today-date').textContent = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date());

function getBest(game) {
  try { return localStorage.getItem(bestKeys[game]); } catch { return null; }
}

function saveBest(game, value) {
  try { localStorage.setItem(bestKeys[game], String(value)); } catch { /* Storage may be unavailable in private browsing. */ }
  renderBests();
}

function renderBests() {
  document.querySelectorAll('[data-best]').forEach((element) => {
    const game = element.dataset.best;
    const value = getBest(game);
    element.textContent = value === null ? (game === 'snake' ? '0' : '—') : value;
  });
}

function formatPoints(points) {
  return new Intl.NumberFormat('ko-KR').format(points);
}

function setPlayerMessage(message, isError = false) {
  const status = document.querySelector('#player-message');
  status.textContent = message;
  status.classList.toggle('is-error', isError);
}

function ensureScoreServer() {
  if (location.protocol !== 'http:' || location.port !== '3000') {
    throw new Error('점수 저장은 http://127.0.0.1:3000 에서 이용할 수 있어요.');
  }
}

function renderScoreboard(data) {
  const currentUser = data.currentUser;
  document.querySelector('#total-score').textContent = formatPoints(currentUser?.total || 0);
  document.querySelector('#current-player-label').textContent = currentUser
    ? `${currentUser.name} · ${currentUser.rank}위`
    : activePlayer ? `${activePlayer.name} · 기록을 불러오는 중` : '이름을 등록하면 순위에 참여할 수 있어요.';
  document.querySelector('.avatar').textContent = currentUser?.name?.slice(0, 1) || 'P';

  const rankingList = document.querySelector('#score-rankings');
  const playerRows = data.players.map((player) => {
    const row = document.createElement('li');
    row.className = 'ranking-row';
    if (player.id === currentUser?.id) row.classList.add('is-current-player');
    const rank = document.createElement('span');
    rank.className = 'ranking-number';
    rank.textContent = String(player.rank).padStart(2, '0');
    const name = document.createElement('span');
    name.className = 'ranking-name';
    name.textContent = player.name;
    const points = document.createElement('strong');
    points.textContent = formatPoints(player.total);
    const unit = document.createElement('small');
    unit.textContent = ' PTS';
    points.append(unit);
    row.append(rank, name, points);
    return row;
  });
  if (playerRows.length === 0) {
    const emptyRow = document.createElement('li');
    emptyRow.className = 'ranking-empty';
    emptyRow.textContent = '아직 등록된 플레이어가 없어요.';
    playerRows.push(emptyRow);
  }
  rankingList.replaceChildren(...playerRows);

  const gameBreakdown = document.querySelector('#score-game-breakdown');
  gameBreakdown.replaceChildren(...scoreGames.map((game) => {
    const row = document.createElement('li');
    row.className = 'score-game-item';
    const label = document.createElement('span');
    label.textContent = `${game.icon} ${game.label}`;
    const points = document.createElement('strong');
    points.textContent = formatPoints(currentUser?.scores?.[game.id] || 0);
    row.append(label, points);
    return row;
  }));
}

async function refreshScoreboard() {
  const query = activePlayer ? `?userId=${encodeURIComponent(activePlayer.id)}` : '';
  ensureScoreServer();
  const response = await fetch(`/api/leaderboard${query}`);
  if (!response.ok) throw new Error('점수판을 불러오지 못했습니다.');
  const data = await response.json();
  renderScoreboard(data);
  setPlayerMessage(data.currentUser
    ? `${data.currentUser.name}님의 점수판을 불러왔어요.`
    : '서버 연결됨 · 이름을 등록해 순위에 참여하세요.');
}

async function registerPlayer(event) {
  event.preventDefault();
  const form = document.querySelector('#player-form');
  const input = document.querySelector('#player-name');
  const button = form.querySelector('button');
  button.disabled = true;
  setPlayerMessage('이름을 확인하고 있습니다.');
  try {
    ensureScoreServer();
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: input.value.trim() })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '이름 등록에 실패했습니다.');
    activePlayer = result.user;
    localStorage.setItem('playground-player', JSON.stringify(activePlayer));
    setPlayerMessage(`${activePlayer.name}님, 기록을 불러왔어요.`);
    await refreshScoreboard();
  } catch (error) {
    setPlayerMessage(error.message || '점수 서버에 연결할 수 없습니다.', true);
  } finally {
    button.disabled = false;
  }
}

async function awardScore(game, points) {
  const earned = Math.max(0, Math.floor(points));
  if (!activePlayer || !earned) {
    setPlayerMessage('점수를 저장하려면 먼저 플레이어 이름을 등록하세요.', true);
    return null;
  }
  try {
    ensureScoreServer();
    const response = await fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: activePlayer.id, game, points: earned })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '점수 저장에 실패했습니다.');
    await refreshScoreboard();
  } catch (error) {
    setPlayerMessage(error.message || '점수 서버에 연결할 수 없습니다.', true);
    return null;
  }
  return earned;
}

function showView(name) {
  views.forEach((view) => view.classList.toggle('is-visible', view.id === `view-${name}`));
  navItems.forEach((item) => item.classList.toggle('is-active', item.dataset.view === name));
  breadcrumbCurrent.textContent = titles[name];
  if (name === 'snake') drawSnake();
  if (name === 'rocket') {
    drawRocketScene();
    if (rocketRunning && rocketFrame === null) rocketFrame = requestAnimationFrame(animateRocket);
  } else if (rocketFrame !== null) {
    cancelAnimationFrame(rocketFrame);
    rocketFrame = null;
    clearRocketInput();
  }
}

document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => showView(button.dataset.view)));
document.querySelectorAll('[data-launch]').forEach((button) => button.addEventListener('click', () => {
  const game = button.dataset.launch;
  showView(game);
  if (game === 'memory') resetMemory();
  if (game === 'reaction') resetReaction();
  if (game === 'rocket') resetRocket();
}));
renderBests();
document.querySelector('#player-name').value = activePlayer?.name || '';
document.querySelector('#player-form').addEventListener('submit', registerPlayer);
renderScoreboard({ players: [], currentUser: null });
refreshScoreboard().catch((error) => setPlayerMessage(error.message || 'SQLite 서버를 실행해 주세요: node server.js', true));

document.querySelectorAll('[data-launch="mole"]').forEach((button) => button.addEventListener('click', resetMole));
document.querySelectorAll('[data-launch="baseball"]').forEach((button) => button.addEventListener('click', resetBaseball));

// Snake
const snakeCanvas = document.querySelector('#snake-canvas');
const snakeContext = snakeCanvas.getContext('2d');
const snakeOverlay = document.querySelector('#snake-overlay');
const snakeScore = document.querySelector('#snake-score');
const snakeGridSize = 21;
let snake = [];
let snakeFood = { x: 15, y: 10 };
let snakeDirection = { x: 1, y: 0 };
let nextSnakeDirection = { x: 1, y: 0 };
let snakeTimer = null;
let snakePoints = 0;
let snakeRunning = false;

function resetSnake() {
  clearInterval(snakeTimer);
  snakeRunning = false;
  snakePoints = 0;
  snake = [{ x: 9, y: 10 }, { x: 8, y: 10 }, { x: 7, y: 10 }];
  snakeDirection = { x: 1, y: 0 };
  nextSnakeDirection = { x: 1, y: 0 };
  snakeScore.textContent = '00';
  document.querySelector('#snake-overlay-title').textContent = '준비됐나요?';
  document.querySelector('#snake-overlay-copy').textContent = '방향키 또는 WASD로 움직여요.';
  document.querySelector('#snake-start').textContent = '게임 시작 ↗';
  snakeOverlay.classList.remove('is-hidden');
  placeSnakeFood();
  drawSnake();
}

function placeSnakeFood() {
  do {
    snakeFood = { x: Math.floor(Math.random() * snakeGridSize), y: Math.floor(Math.random() * snakeGridSize) };
  } while (snake.some((part) => part.x === snakeFood.x && part.y === snakeFood.y));
}

function drawSnake() {
  if (!snakeContext) return;
  const cell = snakeCanvas.width / snakeGridSize;
  snakeContext.clearRect(0, 0, snakeCanvas.width, snakeCanvas.height);
  snakeContext.fillStyle = '#eaf0df';
  snakeContext.fillRect(0, 0, snakeCanvas.width, snakeCanvas.height);
  snakeContext.strokeStyle = '#dfe8d2';
  snakeContext.lineWidth = 1;
  for (let index = 1; index < snakeGridSize; index += 1) {
    snakeContext.beginPath();
    snakeContext.moveTo(index * cell, 0);
    snakeContext.lineTo(index * cell, snakeCanvas.height);
    snakeContext.stroke();
    snakeContext.beginPath();
    snakeContext.moveTo(0, index * cell);
    snakeContext.lineTo(snakeCanvas.width, index * cell);
    snakeContext.stroke();
  }
  snakeContext.fillStyle = '#f07b53';
  snakeContext.beginPath();
  snakeContext.arc((snakeFood.x + .5) * cell, (snakeFood.y + .5) * cell, cell * .34, 0, Math.PI * 2);
  snakeContext.fill();
  snake.forEach((part, index) => {
    snakeContext.fillStyle = index === 0 ? '#456a3c' : `hsl(96 27% ${42 + Math.min(index, 5) * 4}%)`;
    snakeContext.beginPath();
    snakeContext.roundRect(part.x * cell + 1.5, part.y * cell + 1.5, cell - 3, cell - 3, cell * .3);
    snakeContext.fill();
  });
  const head = snake[0];
  snakeContext.fillStyle = '#f8f7ef';
  snakeContext.beginPath();
  snakeContext.arc((head.x + .65) * cell, (head.y + .34) * cell, 1.7, 0, Math.PI * 2);
  snakeContext.fill();
}

async function finishSnake() {
  clearInterval(snakeTimer);
  snakeRunning = false;
  const previousBest = Number(getBest('snake') || 0);
  if (snakePoints > previousBest) saveBest('snake', snakePoints);
  const earned = await awardScore('snake', snakePoints * 100);
  document.querySelector('#snake-overlay-title').textContent = '게임 끝!';
  const receipt = earned === null ? '이름 등록 후 기록돼요.' : `+${earned}P 적립`;
  document.querySelector('#snake-overlay-copy').textContent = `먹이 ${snakePoints}개 · ${receipt}`;
  document.querySelector('#snake-start').textContent = '다시 도전 ↗';
  snakeOverlay.classList.remove('is-hidden');
}

function tickSnake() {
  snakeDirection = nextSnakeDirection;
  const head = { x: snake[0].x + snakeDirection.x, y: snake[0].y + snakeDirection.y };
  const ateFood = head.x === snakeFood.x && head.y === snakeFood.y;
  if (head.x < 0 || head.x >= snakeGridSize || head.y < 0 || head.y >= snakeGridSize || snake.slice(0, ateFood ? snake.length : -1).some((part) => part.x === head.x && part.y === head.y)) {
    finishSnake();
    return;
  }
  snake.unshift(head);
  if (ateFood) {
    snakePoints += 1;
    snakeScore.textContent = String(snakePoints).padStart(2, '0');
    placeSnakeFood();
  } else {
    snake.pop();
  }
  drawSnake();
}

function changeSnakeDirection(direction) {
  const moves = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
  const candidate = moves[direction];
  if (!candidate || candidate.x === -snakeDirection.x && candidate.y === -snakeDirection.y) return;
  nextSnakeDirection = candidate;
}

function startSnake() {
  if (snakeRunning) return;
  if (snake.length === 0 || snakeOverlay.classList.contains('is-hidden') === false && document.querySelector('#snake-overlay-title').textContent === '게임 끝!') resetSnake();
  snakeRunning = true;
  snakeOverlay.classList.add('is-hidden');
  snakeTimer = setInterval(tickSnake, 125);
}

document.querySelector('#snake-start').addEventListener('click', startSnake);
document.querySelector('#snake-restart').addEventListener('click', resetSnake);
document.querySelectorAll('[data-direction]').forEach((button) => {
  button.addEventListener('click', () => changeSnakeDirection(button.dataset.direction));
  button.addEventListener('pointerdown', (event) => event.preventDefault());
});
document.addEventListener('keydown', (event) => {
  const keys = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
  if (keys[event.key] && document.querySelector('#view-snake').classList.contains('is-visible')) {
    event.preventDefault();
    changeSnakeDirection(keys[event.key]);
  }
});
resetSnake();

// Memory
const memorySymbols = ['✿', '☀', '☁', '♫', '🍓', '☾', '♣', '✦'];
let memoryOpen = [];
let memoryMatched = 0;
let memoryMoves = 0;
let memorySeconds = 0;
let memoryTimer = null;
let memoryLocked = false;
let memoryStarted = false;

function formatTime(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function resetMemory() {
  clearInterval(memoryTimer);
  memoryOpen = [];
  memoryMatched = 0;
  memoryMoves = 0;
  memorySeconds = 0;
  memoryLocked = false;
  memoryStarted = false;
  document.querySelector('#memory-moves').textContent = '00';
  document.querySelector('#memory-time').textContent = '00:00';
  document.querySelector('#memory-pairs').textContent = '08';
  document.querySelector('#memory-status').textContent = 'READY';
  document.querySelector('#memory-start').textContent = '게임 시작 ↗';
  const deck = [...memorySymbols, ...memorySymbols].sort(() => Math.random() - .5);
  document.querySelector('#memory-grid').innerHTML = deck.map((symbol, index) => `<button class="memory-card" data-symbol="${symbol}" aria-label="${index + 1}번째 카드, 뒤집혀 있음">?</button>`).join('');
  document.querySelectorAll('.memory-card').forEach((card) => card.addEventListener('click', () => flipMemoryCard(card)));
}

function beginMemoryTimer() {
  if (memoryStarted) return;
  memoryStarted = true;
  document.querySelector('#memory-status').textContent = 'PLAYING';
  document.querySelector('#memory-start').textContent = '게임 진행 중';
  memoryTimer = setInterval(() => {
    memorySeconds += 1;
    document.querySelector('#memory-time').textContent = formatTime(memorySeconds);
  }, 1000);
}

function flipMemoryCard(card) {
  if (memoryLocked || card.classList.contains('is-open') || card.classList.contains('is-matched')) return;
  beginMemoryTimer();
  card.classList.add('is-open');
  card.textContent = card.dataset.symbol;
  card.setAttribute('aria-label', `${card.dataset.symbol}, 열린 카드`);
  memoryOpen.push(card);
  if (memoryOpen.length < 2) return;
  memoryMoves += 1;
  document.querySelector('#memory-moves').textContent = String(memoryMoves).padStart(2, '0');
  const [first, second] = memoryOpen;
  if (first.dataset.symbol === second.dataset.symbol) {
    first.classList.add('is-matched');
    second.classList.add('is-matched');
    first.disabled = true;
    second.disabled = true;
    memoryMatched += 1;
    document.querySelector('#memory-pairs').textContent = String(8 - memoryMatched).padStart(2, '0');
    memoryOpen = [];
    if (memoryMatched === 8) finishMemory();
  } else {
    memoryLocked = true;
    setTimeout(() => {
      [first, second].forEach((openCard) => {
        openCard.classList.remove('is-open');
        openCard.textContent = '?';
        openCard.setAttribute('aria-label', '뒤집힌 카드');
      });
      memoryOpen = [];
      memoryLocked = false;
    }, 750);
  }
}

async function finishMemory() {
  clearInterval(memoryTimer);
  document.querySelector('#memory-status').textContent = 'COMPLETE';
  document.querySelector('#memory-start').textContent = '성공했어요!';
  const previousBest = Number(getBest('memory') || Infinity);
  if (memoryMoves < previousBest) saveBest('memory', memoryMoves);
  const earned = await awardScore('memory', Math.max(100, 1200 - memoryMoves * 40 - memorySeconds * 5));
  const receipt = earned === null ? '이름 등록 후 저장' : `+${earned}P 적립`;
  document.querySelector('#memory-start').textContent = `완료 · ${receipt}`;
}

document.querySelector('#memory-reset').addEventListener('click', resetMemory);
document.querySelector('#memory-start').addEventListener('click', () => {
  if (memoryStarted) return;
  const firstCard = document.querySelector('.memory-card:not(.is-matched)');
  if (firstCard) flipMemoryCard(firstCard);
});
resetMemory();

// Reaction test
let reactionTimeout = null;
let reactionReadyAt = 0;
let reactionState = 'idle';
const reactionArena = document.querySelector('#reaction-arena');

function resetReaction() {
  clearTimeout(reactionTimeout);
  reactionState = 'idle';
  reactionArena.className = 'reaction-arena';
  document.querySelector('#reaction-instruction').textContent = '준비되면 시작 버튼을 눌러요';
  document.querySelector('#reaction-hint').textContent = '초록색으로 바뀌면 클릭!';
  document.querySelector('#reaction-status').textContent = 'READY';
  document.querySelector('#reaction-score').innerHTML = '—<small> ms</small>';
  document.querySelector('#reaction-start').textContent = '도전 시작 ↗';
}

function startReaction() {
  clearTimeout(reactionTimeout);
  reactionState = 'waiting';
  reactionArena.className = 'reaction-arena is-waiting';
  document.querySelector('#reaction-instruction').textContent = '초록색이 될 때까지 기다려요';
  document.querySelector('#reaction-hint').textContent = '아직 누르지 마세요';
  document.querySelector('#reaction-status').textContent = 'WAIT';
  document.querySelector('#reaction-start').textContent = '신호 대기 중';
  reactionTimeout = setTimeout(() => {
    if (reactionState !== 'waiting') return;
    reactionState = 'ready';
    reactionReadyAt = performance.now();
    reactionArena.className = 'reaction-arena is-ready';
    document.querySelector('#reaction-instruction').textContent = '지금 클릭!';
    document.querySelector('#reaction-status').textContent = 'GO!';
  }, 1200 + Math.random() * 2200);
}

reactionArena.addEventListener('click', async () => {
  if (reactionState === 'waiting') {
    clearTimeout(reactionTimeout);
    reactionState = 'early';
    reactionArena.className = 'reaction-arena is-result';
    document.querySelector('#reaction-instruction').textContent = '너무 빨라요!';
    document.querySelector('#reaction-hint').textContent = '시작 버튼을 눌러 다시 도전';
    document.querySelector('#reaction-status').textContent = 'FALSE START';
    document.querySelector('#reaction-start').textContent = '다시 도전 ↗';
    return;
  }
  if (reactionState !== 'ready') return;
  const elapsed = Math.round(performance.now() - reactionReadyAt);
  reactionState = 'result';
  reactionArena.className = 'reaction-arena is-result';
  document.querySelector('#reaction-instruction').textContent = `${elapsed} ms`;
  document.querySelector('#reaction-hint').textContent = '다시 도전해서 기록을 줄여봐요';
  document.querySelector('#reaction-status').textContent = 'RESULT';
  document.querySelector('#reaction-score').innerHTML = `${elapsed}<small> ms</small>`;
  document.querySelector('#reaction-start').textContent = '다시 도전 ↗';
  const previousBest = Number(getBest('reaction') || Infinity);
  if (elapsed < previousBest) saveBest('reaction', elapsed);
  const earned = await awardScore('reaction', Math.max(1, 1000 - elapsed));
  document.querySelector('#reaction-hint').textContent = earned === null
    ? '이름 등록 후 점수를 저장할 수 있어요.'
    : `+${earned}P 적립 · 다시 도전해 기록을 줄여봐요`;
});

document.querySelector('#reaction-start').addEventListener('click', startReaction);
resetReaction();

// Whack-a-mole
const moleButtons = [...document.querySelectorAll('.mole-hole')];
let moleActiveIndex = -1;
let moleScore = 0;
let moleSecondsLeft = 20;
let moleTimer = null;
let moleSpawnTimer = null;
let moleRunning = false;

function renderMole() {
  moleButtons.forEach((button, index) => {
    button.classList.toggle('is-active', index === moleActiveIndex);
    button.disabled = !moleRunning;
  });
}

function resetMole() {
  clearInterval(moleTimer);
  clearTimeout(moleSpawnTimer);
  moleRunning = false;
  moleActiveIndex = -1;
  moleScore = 0;
  moleSecondsLeft = 20;
  document.querySelector('#mole-score').textContent = '00';
  document.querySelector('#mole-time').innerHTML = '20<small> 초</small>';
  document.querySelector('#mole-status').textContent = 'READY';
  document.querySelector('#mole-start').textContent = '게임 시작 ↗';
  renderMole();
}

function showNextMole() {
  if (!moleRunning) return;
  const nextIndex = Math.floor(Math.random() * moleButtons.length);
  moleActiveIndex = nextIndex === moleActiveIndex ? (nextIndex + 1) % moleButtons.length : nextIndex;
  renderMole();
  moleSpawnTimer = setTimeout(showNextMole, 650 + Math.random() * 500);
}

async function finishMole() {
  clearInterval(moleTimer);
  clearTimeout(moleSpawnTimer);
  moleRunning = false;
  moleActiveIndex = -1;
  document.querySelector('#mole-status').textContent = 'COMPLETE';
  const earned = await awardScore('mole', moleScore * 20);
  const receipt = earned === null ? '이름 등록 후 저장' : `+${earned}P 적립`;
  document.querySelector('#mole-start').textContent = `${moleScore}마리 · ${receipt}`;
  if (moleScore > Number(getBest('mole') || 0)) saveBest('mole', moleScore);
  renderMole();
}

function startMole() {
  if (moleRunning) return;
  resetMole();
  moleRunning = true;
  document.querySelector('#mole-status').textContent = 'PLAYING';
  document.querySelector('#mole-start').textContent = '잡아보세요!';
  showNextMole();
  moleTimer = setInterval(() => {
    moleSecondsLeft -= 1;
    document.querySelector('#mole-time').innerHTML = `${String(moleSecondsLeft).padStart(2, '0')}<small> 초</small>`;
    if (moleSecondsLeft <= 0) finishMole();
  }, 1000);
}

moleButtons.forEach((button, index) => button.addEventListener('click', () => {
  if (!moleRunning || index !== moleActiveIndex) return;
  moleScore += 1;
  document.querySelector('#mole-score').textContent = String(moleScore).padStart(2, '0');
  clearTimeout(moleSpawnTimer);
  moleActiveIndex = -1;
  renderMole();
  moleSpawnTimer = setTimeout(showNextMole, 120);
}));
document.querySelector('#mole-start').addEventListener('click', startMole);
resetMole();

// Number baseball
let baseballAnswer = '';
let baseballAttempts = 0;
let baseballFinished = false;
const baseballInput = document.querySelector('#baseball-input');

function resetBaseball() {
  baseballAnswer = [...'123456789'].sort(() => Math.random() - .5).slice(0, 3).join('');
  baseballAttempts = 0;
  baseballFinished = false;
  baseballInput.value = '';
  baseballInput.disabled = false;
  document.querySelector('#baseball-form button').disabled = false;
  document.querySelector('#baseball-status').textContent = 'PLAYING';
  document.querySelector('#baseball-attempts').textContent = '0';
  document.querySelector('#baseball-remaining').textContent = '09';
  document.querySelector('#baseball-message').textContent = '1부터 9까지 숫자 세 개를 입력하세요.';
  document.querySelector('#guess-log').innerHTML = '<li class="guess-empty">아직 기록이 없어요.</li>';
  document.querySelector('#baseball-input').focus();
}

async function submitBaseballGuess(event) {
  event.preventDefault();
  if (baseballFinished) return;
  const guess = baseballInput.value.trim();
  const message = document.querySelector('#baseball-message');
  if (!/^[1-9]{3}$/.test(guess) || new Set(guess).size !== 3) {
    message.textContent = '1부터 9까지 서로 다른 숫자 세 개를 입력하세요.';
    baseballInput.focus();
    return;
  }

  baseballAttempts += 1;
  let strikes = 0;
  let balls = 0;
  [...guess].forEach((digit, index) => {
    if (digit === baseballAnswer[index]) strikes += 1;
    else if (baseballAnswer.includes(digit)) balls += 1;
  });
  const log = document.querySelector('#guess-log');
  if (baseballAttempts === 1) log.innerHTML = '';
  const row = document.createElement('li');
  row.innerHTML = `<span class="guess-number">${String(baseballAttempts).padStart(2, '0')}</span><strong>${guess}</strong><span class="guess-result">${strikes ? `${strikes} 스트라이크` : ''}${strikes && balls ? ' · ' : ''}${balls ? `${balls} 볼` : ''}${!strikes && !balls ? '아웃' : ''}</span>`;
  log.prepend(row);
  baseballInput.value = '';
  document.querySelector('#baseball-attempts').textContent = String(baseballAttempts);
  document.querySelector('#baseball-remaining').textContent = String(9 - baseballAttempts).padStart(2, '0');

  if (strikes === 3) {
    baseballFinished = true;
    document.querySelector('#baseball-status').textContent = 'WIN';
    const earned = await awardScore('baseball', (10 - baseballAttempts) * 100);
    const receipt = earned === null ? '이름 등록 후 점수를 저장할 수 있어요.' : `+${earned}P 적립`;
    message.textContent = `${baseballAttempts}번 만에 맞혔어요! ${receipt}`;
    if (baseballAttempts < Number(getBest('baseball') || Infinity)) saveBest('baseball', baseballAttempts);
  } else if (baseballAttempts === 9) {
    baseballFinished = true;
    document.querySelector('#baseball-status').textContent = 'GAME OVER';
    message.textContent = `기회가 끝났어요. 정답은 ${baseballAnswer}였습니다.`;
  } else {
    message.textContent = strikes || balls ? `${strikes} 스트라이크, ${balls} 볼` : '아웃! 같은 숫자가 하나도 없어요.';
  }
  if (baseballFinished) {
    baseballInput.disabled = true;
    document.querySelector('#baseball-form button').disabled = true;
  } else {
    baseballInput.focus();
  }
}

document.querySelector('#baseball-form').addEventListener('submit', submitBaseballGuess);
document.querySelector('#baseball-reset').addEventListener('click', resetBaseball);
document.querySelectorAll('[data-launch="baseball"]').forEach((button) => button.addEventListener('click', () => setTimeout(() => baseballInput.focus(), 0)));
resetBaseball();

// Rocket landing
const rocketCanvas = document.querySelector('#rocket-canvas');
const rocketContext = rocketCanvas.getContext('2d');
const rocketEngine = Matter.Engine.create({ enableSleeping: false });
rocketEngine.gravity.x = 0;
rocketEngine.gravity.y = 1;
rocketEngine.gravity.scale = 0.00009;
const rocketWidth = rocketCanvas.width;
const rocketHeight = rocketCanvas.height;
const rocketPadX = 470;
const rocketPadWidth = 180;
const rocketGroundY = 424;
const rocketStars = Array.from({ length: 70 }, () => ({ x: Math.random() * rocketWidth, y: Math.random() * 320, size: .5 + Math.random() * 1.5, alpha: .25 + Math.random() * .65 }));
const rocketInput = { rotate: 0, thrust: false };
let rocketBody = null;
let rocketPad = null;
let rocketObstacles = [];
let rocketFuel = 100;
let rocketRunning = false;
let rocketFrame = null;
let rocketPoints = 0;
let rocketHudFrame = 0;

function setupRocketWorld() {
  Matter.Composite.clear(rocketEngine.world, false, true);
  rocketPad = Matter.Bodies.rectangle(rocketPadX, rocketGroundY - 10, rocketPadWidth, 12, {
    isStatic: true,
    friction: .9,
    label: 'landing-pad'
  });
  rocketObstacles = [
    Matter.Bodies.rectangle(190, 452, 380, 56, { isStatic: true, label: 'terrain' }),
    Matter.Bodies.rectangle(645, 452, 150, 56, { isStatic: true, label: 'terrain' }),
    Matter.Bodies.rectangle(-14, 220, 28, 440, { isStatic: true, label: 'boundary' }),
    Matter.Bodies.rectangle(734, 220, 28, 440, { isStatic: true, label: 'boundary' })
  ];
  rocketBody = Matter.Bodies.rectangle(270, 112, 22, 38, {
    density: .002,
    friction: .55,
    frictionAir: .002,
    restitution: .02,
    label: 'lander'
  });
  Matter.Body.setVelocity(rocketBody, { x: .15, y: .7 });
  Matter.Composite.add(rocketEngine.world, [...rocketObstacles, rocketPad, rocketBody]);
}

function clearRocketInput() {
  rocketInput.rotate = 0;
  rocketInput.thrust = false;
  document.querySelectorAll('.rocket-control').forEach((button) => button.classList.remove('is-held'));
}

function resetRocket() {
  if (rocketFrame !== null) cancelAnimationFrame(rocketFrame);
  rocketFrame = null;
  rocketRunning = false;
  rocketFuel = 100;
  rocketPoints = 0;
  rocketHudFrame = 0;
  clearRocketInput();
  setupRocketWorld();
  document.querySelector('#rocket-status').textContent = 'READY';
  document.querySelector('#rocket-score').textContent = '—';
  document.querySelector('#rocket-altitude').innerHTML = '—<small> m</small>';
  document.querySelector('#rocket-vertical-speed').innerHTML = '—<small> m/s</small>';
  document.querySelector('#rocket-horizontal-speed').innerHTML = '—<small> m/s</small>';
  document.querySelector('#rocket-fuel-label').textContent = '100%';
  document.querySelector('#rocket-fuel-meter').value = 100;
  document.querySelector('#rocket-overlay-title').textContent = '착륙 준비 완료';
  document.querySelector('#rocket-overlay-copy').textContent = '추력으로 속도를 줄이고 패드 위에 착륙하세요.';
  document.querySelector('#rocket-start').textContent = '발사하기 ↗';
  document.querySelector('#rocket-overlay').classList.remove('is-hidden');
  drawRocketScene();
}

function drawRocketScene() {
  const context = rocketContext;
  const sky = context.createLinearGradient(0, 0, 0, rocketHeight);
  sky.addColorStop(0, '#1e2934');
  sky.addColorStop(1, '#46515a');
  context.fillStyle = sky;
  context.fillRect(0, 0, rocketWidth, rocketHeight);
  rocketStars.forEach((star) => {
    context.globalAlpha = star.alpha;
    context.fillStyle = '#f4f1d8';
    context.beginPath();
    context.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    context.fill();
  });
  context.globalAlpha = 1;
  context.fillStyle = '#d3c7a5';
  context.beginPath();
  context.arc(592, 102, 34, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#b8ad8e';
  context.beginPath();
  context.arc(580, 94, 7, 0, Math.PI * 2);
  context.arc(606, 111, 10, 0, Math.PI * 2);
  context.arc(600, 87, 4, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#77745f';
  context.fillRect(0, rocketGroundY, rocketWidth, rocketHeight - rocketGroundY);
  context.fillStyle = '#a9a17c';
  context.fillRect(0, rocketGroundY, rocketPadX - rocketPadWidth / 2, 5);
  context.fillRect(rocketPadX + rocketPadWidth / 2, rocketGroundY, rocketWidth - rocketPadX - rocketPadWidth / 2, 5);
  context.fillStyle = '#c5e67a';
  context.fillRect(rocketPadX - rocketPadWidth / 2, rocketGroundY - 10, rocketPadWidth, 7);
  context.fillStyle = '#e3daa9';
  for (let stripe = 0; stripe < 5; stripe += 1) context.fillRect(rocketPadX - 64 + stripe * 32, rocketGroundY - 8, 12, 3);

  if (!rocketBody) return;
  context.save();
  context.translate(rocketBody.position.x, rocketBody.position.y);
  context.rotate(rocketBody.angle);
  if (rocketRunning && rocketInput.thrust && rocketFuel > 0) {
    const flameLength = 19 + Math.random() * 10;
    context.fillStyle = '#ff8053';
    context.beginPath();
    context.moveTo(-6, 17);
    context.lineTo(0, 17 + flameLength);
    context.lineTo(6, 17);
    context.closePath();
    context.fill();
    context.fillStyle = '#ffd56f';
    context.beginPath();
    context.moveTo(-3, 17);
    context.lineTo(0, 17 + flameLength * .68);
    context.lineTo(3, 17);
    context.fill();
  }
  context.fillStyle = '#edf0e1';
  context.beginPath();
  context.moveTo(0, -24);
  context.lineTo(10, -8);
  context.lineTo(8, 15);
  context.lineTo(-8, 15);
  context.lineTo(-10, -8);
  context.closePath();
  context.fill();
  context.fillStyle = '#ef7959';
  context.beginPath();
  context.moveTo(0, -24);
  context.lineTo(6, -13);
  context.lineTo(-6, -13);
  context.closePath();
  context.fill();
  context.fillRect(-13, 8, 5, 10);
  context.fillRect(8, 8, 5, 10);
  context.fillStyle = '#80b9c0';
  context.beginPath();
  context.arc(0, -4, 4, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function updateRocketReadout() {
  const velocity = Matter.Body.getVelocity(rocketBody);
  const altitude = Math.max(0, Math.round((rocketGroundY - rocketBody.position.y) / 10));
  document.querySelector('#rocket-altitude').innerHTML = `${altitude}<small> m</small>`;
  document.querySelector('#rocket-vertical-speed').innerHTML = `${Math.max(0, velocity.y).toFixed(1)}<small> m/s</small>`;
  document.querySelector('#rocket-horizontal-speed').innerHTML = `${Math.abs(velocity.x).toFixed(1)}<small> m/s</small>`;
  const heading = Math.round(Math.atan2(Math.sin(rocketBody.angle), Math.cos(rocketBody.angle)) * 180 / Math.PI);
  document.querySelector('#rocket-direction').textContent = `${heading}°`;
  document.querySelector('#rocket-fuel-label').textContent = `${Math.ceil(rocketFuel)}%`;
  document.querySelector('#rocket-fuel-meter').value = rocketFuel;
}

async function finishRocket(safeLanding) {
  if (!rocketRunning) return;
  rocketRunning = false;
  rocketFrame = null;
  clearRocketInput();
  const velocity = Matter.Body.getVelocity(rocketBody);
  const verticalSpeed = Math.max(0, velocity.y);
  const horizontalSpeed = Math.abs(velocity.x);
  const angle = Math.abs(Math.atan2(Math.sin(rocketBody.angle), Math.cos(rocketBody.angle)));
  document.querySelector('#rocket-status').textContent = safeLanding ? 'LANDED' : 'CRASH';
  if (safeLanding) {
    rocketPoints = Math.max(100, Math.round(1200 - verticalSpeed * 120 - horizontalSpeed * 110 - angle * 220));
    document.querySelector('#rocket-score').textContent = String(rocketPoints);
    if (rocketPoints > Number(getBest('rocket') || 0)) saveBest('rocket', rocketPoints);
    const earned = await awardScore('rocket', rocketPoints);
    document.querySelector('#rocket-overlay-title').textContent = '착륙 성공!';
    document.querySelector('#rocket-overlay-copy').textContent = earned === null
      ? `속도 ${verticalSpeed.toFixed(1)} m/s · 이름 등록 후 점수를 저장할 수 있어요.`
      : `속도 ${verticalSpeed.toFixed(1)} m/s · +${earned}P 적립`;
  } else {
    document.querySelector('#rocket-score').textContent = '0';
    document.querySelector('#rocket-overlay-title').textContent = '착륙 실패';
    document.querySelector('#rocket-overlay-copy').textContent = '패드 중앙에서 기체를 수평으로 하고 하강 속도를 낮춰보세요.';
  }
  document.querySelector('#rocket-start').textContent = '다시 비행 ↗';
  document.querySelector('#rocket-overlay').classList.remove('is-hidden');
  drawRocketScene();
}

function checkRocketCollision(event) {
  if (!rocketRunning) return;
  let touchedPad = false;
  let touchedHazard = false;
  event.pairs.forEach(({ bodyA, bodyB }) => {
    if (bodyA !== rocketBody && bodyB !== rocketBody) return;
    const other = bodyA === rocketBody ? bodyB : bodyA;
    if (other === rocketPad) touchedPad = true;
    else if (rocketObstacles.includes(other)) touchedHazard = true;
  });
  if (touchedPad) {
    const velocity = Matter.Body.getVelocity(rocketBody);
    const normalizedAngle = Math.atan2(Math.sin(rocketBody.angle), Math.cos(rocketBody.angle));
    const centered = Math.abs(rocketBody.position.x - rocketPadX) <= rocketPadWidth / 2 - 14;
    const safe = centered && velocity.y >= -.2 && velocity.y <= 2.8 && Math.abs(velocity.x) <= 2.4 && Math.abs(normalizedAngle) <= .22;
    finishRocket(safe);
  } else if (touchedHazard) {
    finishRocket(false);
  }
}

Matter.Events.on(rocketEngine, 'collisionStart', checkRocketCollision);

function animateRocket() {
  if (!rocketRunning) {
    rocketFrame = null;
    return;
  }
  if (rocketInput.rotate !== 0) Matter.Body.setAngle(rocketBody, rocketBody.angle + rocketInput.rotate * .018);
  if (rocketInput.thrust && rocketFuel > 0) {
    const force = rocketBody.mass * .00017;
    Matter.Body.applyForce(rocketBody, rocketBody.position, {
      x: Math.sin(rocketBody.angle) * force,
      y: -Math.cos(rocketBody.angle) * force
    });
    rocketFuel = Math.max(0, rocketFuel - .18);
  }
  Matter.Engine.update(rocketEngine, 1000 / 60);
  if (rocketBody.position.y > rocketHeight + 30 || rocketBody.position.x < -5 || rocketBody.position.x > rocketWidth + 5) finishRocket(false);
  if (performance.now() - rocketHudFrame > 100) {
    updateRocketReadout();
    rocketHudFrame = performance.now();
  }
  drawRocketScene();
  if (rocketRunning) rocketFrame = requestAnimationFrame(animateRocket);
}

function startRocket() {
  if (rocketRunning) return;
  resetRocket();
  rocketRunning = true;
  document.querySelector('#rocket-status').textContent = 'FLIGHT';
  document.querySelector('#rocket-overlay').classList.add('is-hidden');
  rocketFrame = requestAnimationFrame(animateRocket);
}

function setRocketControl(control, isPressed) {
  if (!rocketRunning) return;
  if (control === 'left') rocketInput.rotate = isPressed ? -1 : rocketInput.rotate === -1 ? 0 : rocketInput.rotate;
  if (control === 'right') rocketInput.rotate = isPressed ? 1 : rocketInput.rotate === 1 ? 0 : rocketInput.rotate;
  if (control === 'thrust') rocketInput.thrust = isPressed;
  document.querySelector(`[data-rocket-control="${control}"]`)?.classList.toggle('is-held', isPressed);
}

document.querySelector('#rocket-start').addEventListener('click', startRocket);
document.querySelector('#rocket-reset').addEventListener('click', resetRocket);
document.querySelectorAll('[data-rocket-control]').forEach((button) => {
  const control = button.dataset.rocketControl;
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    setRocketControl(control, true);
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((eventName) => button.addEventListener(eventName, () => setRocketControl(control, false)));
});
const rocketKeys = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'thrust', w: 'thrust', W: 'thrust' };
document.addEventListener('keydown', (event) => {
  const control = rocketKeys[event.key];
  if (!control || !document.querySelector('#view-rocket').classList.contains('is-visible')) return;
  event.preventDefault();
  setRocketControl(control, true);
});
document.addEventListener('keyup', (event) => {
  if (rocketKeys[event.key]) setRocketControl(rocketKeys[event.key], false);
});
window.addEventListener('blur', clearRocketInput);
resetRocket();