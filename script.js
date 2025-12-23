// =====================
// New Game Mode: 30s score attack
// =====================

// ----- Config -----
const GAME_DURATION_SEC = 30;   // countdown from 30 -> 0
let SQUARE_SIZE = 140;          // responsive size
const WRONG_FLASH_MS = 120;

const SCORE_GOOD = 50;          // KAPIBARA.png
const SCORE_POOR = -30;         // KAPIBARA_poor.png

// 7:3 ratio
const GOOD_WEIGHT = 7;
const POOR_WEIGHT = 3;

// Local ranking (Top10) for score mode
const RANK_KEY = "kapibara_score_attack_rankings_v1";
const RANK_KEEP_TOP = 10;

// Images
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
const progressEl = document.getElementById("progress"); // left-top (we'll keep but not required)

const scoreEl = document.getElementById("score"); // ✅ added in index.html

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

// responsive square size
function updateSquareSize() {
  const r = areaRect();
  const base = r.width;
  const sq = Math.max(72, Math.min(140, Math.round(base * 0.22)));
  SQUARE_SIZE = sq;
  gameArea.style.setProperty("--sq", `${SQUARE_SIZE}px`);
}

function formatCountdown(sec) {
  // show like 30.0s
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
      .sort((a,b) => b - a) // score higher first
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
  // set image based on currentType
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
      fallbackNum.textContent = "-30";
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

function setUIStart() {
  startScreen.classList.remove("hidden");
  resultScreen.classList.add("hidden");
  targetEl.classList.add("hidden");

  progressEl.textContent = ""; // not used now
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

  finalTimeEl.textContent = `本回合得分：${finalScore}`;

  rankListEl.innerHTML = "";
  rankings.slice(0, RANK_KEEP_TOP).forEach((s) => {
    const li = document.createElement("li");
    li.textContent = `${s} 分`;
    rankListEl.appendChild(li);
  });
}

function wrongFlash() {
  targetEl.classList.add("wrong");
  if (navigator.vibrate) navigator.vibrate(25);
  setTimeout(() => targetEl.classList.remove("wrong"), WRONG_FLASH_MS);
}

// =====================
// Timer loop
// =====================
function tick() {
  if (state !== "PLAYING") return;

  const now = performance.now();
  const elapsed = (now - startTimeMs) / 1000;
  remainingSec = Math.max(0, GAME_DURATION_SEC - elapsed);

  timerEl.textContent = `Time: ${formatCountdown(remainingSec)}`;
  if (scoreEl) scoreEl.textContent = `Score: ${score}`;
  progressEl.textContent = ""; // keep blank or show hint if you want

  if (remainingSec <= 0) {
    finishGame();
    return;
  }

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

// click/tap
gameArea.addEventListener("pointerdown", (e) => {
  if (state !== "PLAYING") return;

  const tRect = targetEl.getBoundingClientRect();
  const hit =
    e.clientX >= tRect.left && e.clientX <= tRect.right &&
    e.clientY >= tRect.top  && e.clientY <= tRect.bottom;

  if (hit) {
    // scoring
    if (currentType === "GOOD") score += SCORE_GOOD;
    else score += SCORE_POOR;

    // spawn next immediately
    spawnNewTarget();
  } else {
    // optional: flash on miss
    wrongFlash();
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
