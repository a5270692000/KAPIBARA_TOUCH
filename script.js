// =====================
// Game Mode: 30s score attack + combo + floating score + last-5s hurry + low beep
// Mobile fix: resize will NOT re-roll target type
// =====================

// ----- Config -----
const GAME_DURATION_SEC = 30;
let SQUARE_SIZE = 140;

// Score rules
const SCORE_POOR_PENALTY = -30;

// 7:3 ratio
const GOOD_WEIGHT = 7;
const POOR_WEIGHT = 3;

// Ranking
const RANK_KEY = "kapibara_score_attack_rankings_v7";
const RANK_KEEP_TOP = 10;

// Images (case-sensitive on Netlify)
const IMG_GOOD = "picture/KAPIBARA.png";
const IMG_POOR = "picture/KAPIBARA_poor.png";

// ----- DOM -----
const gameArea = document.getElementById("gameArea");
const startScreen = document.getElementById("startScreen");
const resultScreen = document.getElementById("resultScreen");

const btnStart = document.getElementById("btnStart");
const btnRetry = document.getElementById("btnRetry");
const btnExit = document.getElementById("btnExit");

const timerEl = document.getElementById("timer");
const progressEl = document.getElementById("progress");
const scoreEl = document.getElementById("score");

const targetEl = document.getElementById("target");
const targetImg = document.getElementById("targetImg");
const fallbackNum = document.getElementById("fallbackNum");

const finalTimeEl = document.getElementById("finalTime");
const rankListEl = document.getElementById("rankList");

// ----- State -----
let state = "START"; // START | PLAYING | RESULT
let rafId = 0;

let startTimeMs = 0;
let remainingSec = GAME_DURATION_SEC;

let score = 0;
let comboCount = 0;
let currentType = "GOOD"; // GOOD | POOR

// last-5s
let inHurry = false;
let lastHurrySecond = -1; // to trigger once per second

// ----- Preload Images -----
let goodOk = false;
let poorOk = false;

const goodImg = new Image();
const poorImg = new Image();
goodImg.src = IMG_GOOD;
poorImg.src = IMG_POOR;

goodImg.onload = () => { goodOk = true; };
goodImg.onerror = () => { goodOk = false; };
poorImg.onload = () => { poorOk = true; };
poorImg.onerror = () => { poorOk = false; };

// ----- Ranking -----
let rankings = loadRankings();

// =====================
// Helpers
// =====================
function areaRect() {
  return gameArea.getBoundingClientRect();
}

function updateSquareSize() {
  const r = areaRect();
  const sq = Math.max(72, Math.min(140, Math.round(r.width * 0.22)));
  SQUARE_SIZE = sq;
  gameArea.style.setProperty("--sq", `${sq}px`);
}

function formatCountdown(sec) {
  return `${sec.toFixed(1)}s`;
}

// Combo score rule: +50 -> +70 -> +100 (cap 100)
function getComboScore(combo) {
  if (combo >= 3) return 100;
  if (combo === 2) return 70;
  return 50;
}

function loadRankings() {
  try {
    const raw = localStorage.getItem(RANK_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(n => typeof n === "number" && isFinite(n))
      .sort((a,b) => b - a)
      .slice(0, RANK_KEEP_TOP);
  } catch {
    return [];
  }
}

function saveRankings() {
  try {
    localStorage.setItem(RANK_KEY, JSON.stringify(rankings));
  } catch {}
}

function insertRanking(s) {
  rankings.push(s);
  rankings.sort((a,b) => b - a);
  rankings = rankings.slice(0, RANK_KEEP_TOP);
  saveRankings();
}

function randomPos() {
  const r = areaRect();
  const SAFE_TOP = 64;

  const x = Math.random() * (r.width - SQUARE_SIZE);
  const y = SAFE_TOP + Math.random() * (r.height - SQUARE_SIZE - SAFE_TOP);

  return { x, y };
}

function clampTargetPosition() {
  const r = areaRect();
  const SAFE_TOP = 64;

  let left = parseFloat(targetEl.style.left);
  let top = parseFloat(targetEl.style.top);

  if (!isFinite(left)) left = 0;
  if (!isFinite(top)) top = SAFE_TOP;

  const maxLeft = Math.max(0, r.width - SQUARE_SIZE);
  const maxTop = Math.max(SAFE_TOP, r.height - SQUARE_SIZE);

  left = Math.min(Math.max(0, left), maxLeft);
  top = Math.min(Math.max(SAFE_TOP, top), maxTop);

  targetEl.style.left = `${left}px`;
  targetEl.style.top = `${top}px`;
}

function pickTypeByWeight() {
  return (Math.random() * (GOOD_WEIGHT + POOR_WEIGHT) < GOOD_WEIGHT)
    ? "GOOD"
    : "POOR";
}

function applyTargetVisual() {
  if (currentType === "GOOD") {
    if (goodOk) {
      targetImg.src = IMG_GOOD;
      targetImg.classList.remove("hidden");
      fallbackNum.classList.add("hidden");
    } else {
      targetImg.classList.add("hidden");
      fallbackNum.classList.remove("hidden");
      fallbackNum.textContent = "+";
    }
  } else {
    if (poorOk) {
      targetImg.src = IMG_POOR;
      targetImg.classList.remove("hidden");
      fallbackNum.classList.add("hidden");
    } else {
      targetImg.classList.add("hidden");
      fallbackNum.classList.remove("hidden");
      fallbackNum.textContent = "X";
    }
  }
}

function spawnNewTarget() {
  currentType = pickTypeByWeight();
  const { x, y } = randomPos();
  targetEl.style.left = `${x}px`;
  targetEl.style.top = `${y}px`;
  applyTargetVisual();
}

function updateHud() {
  if (scoreEl) scoreEl.textContent = `Score: ${score}`;
  if (timerEl) timerEl.textContent = `Time: ${formatCountdown(remainingSec)}`;

  if (progressEl) {
    if (currentType === "GOOD") {
      progressEl.textContent = "點元寶水豚加分（空白=跳過/斷Combo）";
    } else {
      progressEl.textContent = "避開空錢包水豚（點到會扣分；空白=跳過不斷Combo）";
    }
  }
}

// =====================
// Floating score text
// =====================
function showFloatScore(text, clientX, clientY) {
  const r = areaRect();
  const x = clientX - r.left;
  const y = clientY - r.top;

  const el = document.createElement("div");
  el.className = "float-score";
  el.textContent = text;

  if (String(text).startsWith("+")) el.style.color = "#0a7a2f";
  else if (String(text).startsWith("-")) el.style.color = "#c00000";
  else el.style.color = "#333";

  el.style.left = `${x}px`;
  el.style.top = `${y}px`;

  gameArea.appendChild(el);
  el.addEventListener("animationend", () => el.remove());
}

// =====================
// Low beep sound (Web Audio)
// =====================
let audioCtx = null;

function playLowBeep() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.frequency.value = 140;
    osc.type = "sine";
    gain.gain.value = 0.12;

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
  } catch {
    // ignore
  }
}

// =====================
// Last 5 seconds hurry mode
// =====================
function setHurryMode(on) {
  inHurry = on;
  if (on) {
    gameArea.classList.add("hurry");
    timerEl.classList.add("danger");
  } else {
    gameArea.classList.remove("hurry");
    timerEl.classList.remove("danger");
    lastHurrySecond = -1;
  }
}

// =====================
// UI
// =====================
function setUIStart() {
  state = "START";
  cancelAnimationFrame(rafId);

  startScreen.classList.remove("hidden");
  resultScreen.classList.add("hidden");
  targetEl.classList.add("hidden");

  score = 0;
  comboCount = 0;
  remainingSec = GAME_DURATION_SEC;
  currentType = "GOOD";

  setHurryMode(false);
  updateHud();
}

function setUIPlaying() {
  startScreen.classList.add("hidden");
  resultScreen.classList.add("hidden");
  targetEl.classList.remove("hidden");
}

function setUIResult(finalScore) {
  startScreen.classList.add("hidden");
  resultScreen.classList.remove("hidden");
  targetEl.classList.add("hidden");

  finalTimeEl.textContent = `瓜瓜可能會得到：${finalScore} 元`;

  rankListEl.innerHTML = "";
  rankings.forEach(s => {
    const li = document.createElement("li");
    li.textContent = `${s} 元`;
    rankListEl.appendChild(li);
  });
}

// =====================
// Game loop
// =====================
function tick() {
  if (state !== "PLAYING") return;

  const elapsed = (performance.now() - startTimeMs) / 1000;
  remainingSec = Math.max(0, GAME_DURATION_SEC - elapsed);

  const shouldHurry = remainingSec > 0 && remainingSec <= 5.0;
  if (shouldHurry && !inHurry) setHurryMode(true);
  if (!shouldHurry && inHurry) setHurryMode(false);

  if (inHurry) {
    const secInt = Math.ceil(remainingSec); // 5..1
    if (secInt !== lastHurrySecond) {
      lastHurrySecond = secInt;
      if (navigator.vibrate) navigator.vibrate(15);
      playLowBeep();
    }
  }

  updateHud();

  if (remainingSec <= 0) {
    finishGame();
    return;
  }

  rafId = requestAnimationFrame(tick);
}

function startGame() {
  updateSquareSize();

  state = "PLAYING";
  score = 0;
  comboCount = 0;
  remainingSec = GAME_DURATION_SEC;
  currentType = "GOOD";

  setHurryMode(false);

  startTimeMs = performance.now();

  setUIPlaying();
  spawnNewTarget();

  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(tick);
}

function finishGame() {
  if (state !== "PLAYING") return;

  state = "RESULT";
  cancelAnimationFrame(rafId);

  setHurryMode(false);
  insertRanking(score);
  setUIResult(score);
}

// =====================
// Input
// =====================
gameArea.addEventListener("pointerdown", (e) => {
  if (state !== "PLAYING") return;

  const r = targetEl.getBoundingClientRect();
  const hit =
    e.clientX >= r.left && e.clientX <= r.right &&
    e.clientY >= r.top  && e.clientY <= r.bottom;

  if (currentType === "GOOD") {
    if (hit) {
      comboCount += 1;
      const gain = getComboScore(comboCount);
      score += gain;
      showFloatScore(`+${gain}`, e.clientX, e.clientY);
      spawnNewTarget();
    } else {
      // blank click on GOOD => skip + break combo
      comboCount = 0;
      spawnNewTarget();
    }
  } else { // POOR
    if (hit) {
      // hit POOR => -30 + break combo
      comboCount = 0;
      score += SCORE_POOR_PENALTY;
      showFloatScore(`${SCORE_POOR_PENALTY}`, e.clientX, e.clientY);
      if (navigator.vibrate) navigator.vibrate(25);
      spawnNewTarget();
    } else {
      // blank click on POOR => skip, KEEP combo
      spawnNewTarget();
    }
  }

  score = Math.max(0, score);
  updateHud();
});

btnStart.addEventListener("click", startGame);
btnRetry.addEventListener("click", startGame);
btnExit.addEventListener("click", setUIStart);

// ✅ Mobile fix: do NOT re-roll target on resize (avoid GOOD suddenly becomes POOR)
window.addEventListener("resize", () => {
  updateSquareSize();
  if (state === "PLAYING") clampTargetPosition();
});

// init
updateSquareSize();
setUIStart();
