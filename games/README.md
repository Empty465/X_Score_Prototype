# 게임 모듈 추가

게임 로직은 `games/<id>.js` 한 파일에 두고, 기존 앱의 화면·점수판과 호스트 API로 연결합니다. `template.js`를 복사해 시작할 수 있습니다.

## 모듈 규약

- 게임 ID는 소문자 영문/숫자/하이픈으로 정하고, 화면 ID `view-<id>` 및 점수 키와 동일하게 씁니다.
- `window.Playground`에서 `getBest(id)`, `saveBest(id, value)`, `awardScore(id, points)`, `registerGame(id, lifecycle)`를 사용할 수 있습니다.
- 게임의 DOM 이벤트와 상태는 해당 모듈 안에 둡니다. `registerGame`의 `onLaunch`는 시작 화면 진입 시 초기화, `onShow`/`onHide`는 화면 표시/이탈 처리가 필요할 때 사용합니다.
- 화면 전환/카드 markup은 `index.html`, 게임별 스타일은 `styles.css`의 게임 영역에 추가합니다.
- 모듈을 만든 뒤 `games/index.js`에 import 한 줄을 추가합니다. 서버는 `games/<id>.js` 경로를 자동으로 제공합니다.

## 앱 연결 체크리스트

1. `games/<id>.js`에 게임 로직과 `window.Playground.registerGame('<id>', ...)`를 작성합니다.
2. `games/index.js`에서 모듈을 import 합니다.
3. `index.html`에 `data-view="<id>"`, `data-launch="<id>"`, `id="view-<id>"` 화면을 추가합니다.
4. `app.js`의 `titles`, `bestKeys`, `scoreGames`에 게임 정보를 추가합니다.
5. 서버 점수 적립을 사용한다면 `server.js`의 게임 목록, SQLite `score_events` 제약 및 집계도 갱신합니다.

기존 게임 예시: `snake.js`, `memory.js`, `reaction.js`, `mole.js`, `baseball.js`, `rocket.js`.
