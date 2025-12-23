// =====================
// Game Mode: 30s score attack + POOR must click outside
// =====================

// ----- Config -----
const GAME_DURATION_SEC = 30;   // countdown from 30 -> 0
let SQUARE_SIZE = 140;          // responsive size
const WRONG_FLASH_MS = 120;

const SCORE_GOOD = 50;          // KAPIBARA.png
const SCORE_POOR_PENALTY = -30; // click POOR square => -30

// 7:3 ratio
const GOOD_WEIGHT = 7;
const POOR_WEIGHT = 3;

// Local ranking (Top10) for score mode
const RANK_KEY = "kapibara_score_attack_rankings_v2";
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
const progressEl = document.getElementById("progress"); // optional left-top
const scoreEl = document.getElementById("score");       // must exist in index.html

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

// current target type: "GOOD" or "POOR"
let currentType = "GOOD";

// preload images
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

// rankings (score desc)
let rankings = loadRankings();

// =====================
// Helpers
// =====================
function areaRect() {
  return gameArea.getBoundingClientRect();
}

function updateSquareSize() {
  const r = areaRect();
  const base = r.width;
  const sq = Math.max(72, Math.min(140, Math.round(base * 0.22)));
  SQUARE_SIZE = sq;
  gameArea.style.setProperty("--sq", `${SQUARE_SIZE}px`);
}

function formatCountdown(sec) {
  return `${sec.toFixed(1)}s`;
}

function loadRankings() {
  try {
    const raw = localStorage.getItem(RANK_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(n => typeof n === "number" && isFinite(n))
      .sort((a,b) => b - a) // higher score first
      .slice(0, RANK_KEEP_TOP);
  } catch {
    return [];
  }
}

function saveRankings() {
  try {
    localStorage.setItem(RANK_KEY, JSON.stringify(rankings.slice(0, RANK_KEEP_TOP)));
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
  const half = SQUARE_SIZE / 2;

  // keep clear of top HUD
  const SAFE_TOP = 64;

  const minX = half;
  const maxX = r.width - half;
  const minY = half + SAFE_TOP;
  const maxY = r.height - half;

  const cx = minX + Math.random() * (maxX - minX);
  const cy = minY + Math.random() * (maxY - minY);

  return { x: cx - half, y: cy - half };
}

function pickTypeByWeight() {
  const total = GOOD_WEIGHT + POOR_WEIGHT;
  const x = Math.random() * total;
  return (x < GOOD_WEIGHT) ? "GOOD" : "POOR";
}

function applyTargetVisual() {
  // Use image if loaded; else fallback text
  if (currentType === "GOOD") {
    if (goodOk) {
      targetImg.src = IMG_GOOD;
      targetImg.classList.remove("hidden");
      fallbackNum.classList.add("hidden");
    } else {
      targetImg.classList.add("hidden");
      fallbackNum.classList.remove("hidden");
      fallbackNum.textContent = "+50";
    }
  } else {
    if (poorOk) {
      targetImg.src = IMG_POOR;
      targetImg.classList.remove("hidden");
      fallbackNum.classList.add("hidden");
    } else {
      targetImg.classList.add("hidden");
      fallbackNum.classList.remove("hidden");
      fallbackNum.textContent = "避開";
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

// feedback
function flashOnTarget() {
  targetEl.classList.add("wrong");
  if (navigator.vibrate) navigator.vibrate(25);
  setTimeout(() => targetEl.classList.remove("wrong"), WRONG_FLASH_MS);
}

function updateHud() {
  if (scoreEl) scoreEl.textContent = `Score: ${score}`;
  timerEl.textContent = `Time: ${formatCountdown(remainingSec)}`;

  // Optional info left-top:
  // Show hint depending on target type (help player)
  if (currentType === "GOOD") {
    progressEl.textContent = "點水豚 +50";
  } else {
    progressEl.textContent = "避開它：點空白";
  }
}

// =====================
// UI
// =====================
function setUIStart() {
  startScreen.classList.remove("hidden");
  resultScreen.classList.add("hidden");
  targetEl.classList.add("hidden");

  remainingSec = GAME_DURATION_SEC;
  score = 0;
  currentType = "GOOD";

  progressEl.textContent = "";
  if (scoreEl) scoreEl.textContent = "Score: 0";
  timerEl.textContent = `Time: ${formatCountdown(GAME_DURATION_SEC)}`;
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
  rankings.slice(0, RANK_KEEP_TOP).forEach((s) => {
    const li = document.createElement("li");
    li.textContent = `${s} 元`;
    rankListEl.appendChild(li);
  });
}

// =====================
// Timer loop
// =====================
function tick() {
  if (state !== "PLAYING") return;

  const now = performance.now();
  const elapsed = (now - startTimeMs) / 1000;
  remainingSec = Math.max(0, GAME_DURATION_SEC - elapsed);

  if (remainingSec <= 0) {
    remainingSec = 0;
    updateHud();
    finishGame();
    return;
  }

  updateHud();
  rafId = requestAnimationFrame(tick);
}

// =====================
// Game flow
// =====================
function startGame() {
  updateSquareSize();

  state = "PLAYING";
  score = 0;
  remainingSec = GAME_DURATION_SEC;

  startTimeMs = performance.now();
  setUIPlaying();
  spawnNewTarget();
  updateHud();

  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(tick);
}

function finishGame() {
  if (state !== "PLAYING") return;

  state = "RESULT";
  cancelAnimationFrame(rafId);

  insertRanking(score);
  setUIResult(score);
}

// =====================
// Input handling
// =====================
btnStart.addEventListener("click", startGame);
btnRetry.addEventListener("click", startGame);

btnExit.addEventListener("click", () => {
  state = "START";
  cancelAnimationFrame(rafId);
  setUIStart();
});

// Main rule change:
// - GOOD: click square => +50, click outside => flash only
// - POOR: click square => -30, click outside => SAFE (no penalty) and spawn next
gameArea.addEventListener("pointerdown", (e) => {
  if (state !== "PLAYING") return;

  const tRect = targetEl.getBoundingClientRect();
  const hit =
    e.clientX >= tRect.left && e.clientX <= tRect.right &&
    e.clientY >= tRect.top  && e.clientY <= tRect.bottom;

  if (currentType === "GOOD") {
    if (hit) {
      score += SCORE_GOOD;
      spawnNewTarget();
      updateHud();
    } else {
      // miss good: no score change
      flashOnTarget();
    }
  } else { // POOR
    if (hit) {
      // clicked poor => penalty
      score += SCORE_POOR_PENALTY;
      flashOnTarget();
      spawnNewTarget();
      updateHud();
    } else {
      // clicked outside => correct action, no penalty, just move on
      spawnNewTarget();
      updateHud();
    }
  }
});

// ESC
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    state = "START";
    cancelAnimationFrame(rafId);
    setUIStart();
  }
});

// resize/orientation
window.addEventListener("resize", () => {
  updateSquareSize();
  if (state === "PLAYING") spawnNewTarget();
});

// init
updateSquareSize();
setUIStart();
