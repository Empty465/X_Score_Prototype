const { getBest, saveBest, awardScore } = window.Playground;

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
window.Playground.registerGame('reaction', { onLaunch: resetReaction });
