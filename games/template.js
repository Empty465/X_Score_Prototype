const { getBest, saveBest, awardScore } = window.Playground;

const startButton = document.querySelector('#mygame-start');
let score = 0;

function reset() {
  score = 0;
}

function start() {
  score += 1;
  const previousBest = Number(getBest('mygame') || 0);
  if (score > previousBest) saveBest('mygame', score);
}

async function finish() {
  await awardScore('mygame', score);
}

startButton.addEventListener('click', start);
window.Playground.registerGame('mygame', { onLaunch: reset });
