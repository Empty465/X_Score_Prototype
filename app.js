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
  try { return localStorage.getItem(bestKeys[game] || `playground-best-${game}`); } catch { return null; }
}

function saveBest(game, value) {
  try { localStorage.setItem(bestKeys[game] || `playground-best-${game}`, String(value)); } catch { /* Storage may be unavailable in private browsing. */ }
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

const gameModules = new Map();
let gameModulesReady = Promise.resolve();
window.Playground = {
  getBest,
  saveBest,
  awardScore,
  registerGame(id, lifecycle) {
    gameModules.set(id, lifecycle);
  }
};

function showView(name) {
  views.forEach((view) => view.classList.toggle('is-visible', view.id === `view-${name}`));
  navItems.forEach((item) => item.classList.toggle('is-active', item.dataset.view === name));
  breadcrumbCurrent.textContent = titles[name];
  gameModules.forEach((lifecycle, id) => {
    if (id === name) lifecycle.onShow?.();
    else lifecycle.onHide?.();
  });
}

document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => showView(button.dataset.view)));
document.querySelectorAll('[data-launch]').forEach((button) => button.addEventListener('click', async () => {
  const game = button.dataset.launch;
  await gameModulesReady;
  showView(game);
  gameModules.get(game)?.onLaunch?.();
}));
renderBests();
document.querySelector('#player-name').value = activePlayer?.name || '';
document.querySelector('#player-form').addEventListener('submit', registerPlayer);
renderScoreboard({ players: [], currentUser: null });
refreshScoreboard().catch((error) => setPlayerMessage(error.message || 'SQLite 서버를 실행해 주세요: node server.js', true));

gameModulesReady = import('./games/index.js').catch((error) => {
  setPlayerMessage(error.message || '게임 모듈을 불러오지 못했습니다.', true);
});
