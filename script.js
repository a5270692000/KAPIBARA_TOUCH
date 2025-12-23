// =====================
// Config
// =====================
const TARGET_MAX = 10;
let SQUARE_SIZE = 140;           // ✅ will be recalculated by screen size
const WRONG_FLASH_MS = 150;

const RANK_KEY = "number_touch_rankings_v1";
const RANK_KEEP_TOP = 10;

// ✅ Image path (MAKE SURE case matches your repo filename)
const IMG_PATH = "picture/KAPIBARA.png";

// =====================
// DOM
// =====================
const gameArea = document.getElementById("gameArea");
const startScreen = document.getElementById("startScreen");
const resultScreen = document.getElementById("resultScreen");

const btnStart = document.getElementById("btnStart");
const btnRetry = document.getElementById("btnRetry");
const btnExit = document.getElementById("btnExit");

const timerEl = document.getElementById("timer");
const progressEl = document.getElementById("progress");

const targetEl = document.getElementById("target");
const targetImg = document.getElementById("targetImg");
const fallbackNum = document.getElementById("fallbackNum");

const finalTimeEl = document.getElementById("finalTime");
const rankListEl = document.getElementById("rankList");

// =====================
// State
// =====================
let state = "START"; // START | PLAYING | RESULT
let currentTarget = 1;
let startTimeMs = 0;
let rafId = 0;
let elapsedSec = 0;
let rankings = loadRankings();

// preload image
let imgOk = false;
targetImg.src = IMG_PATH;
targetImg.onload = () => { imgOk = true; };
targetImg.onerror = () => { imgOk = false; };

// =====================
// Helpers
// =====================
function formatTime(seconds) {
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60);
    const s = seconds - m * 60;
    return String(m).padStart(2, "0") + ":" + s.toFixed(2).padStart(5, "0");
  }
  return seconds.toFixed(2) + "s";
}

function loadRankings() {
  try {
    const raw = localStorage.getItem(RANK_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(n => typeof n === "number" && isFinite(n))
      .sort((a,b)=>a-b)
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

function insertRanking(t) {
  rankings.push(t);
  rankings.sort((a,b)=>a-b);
  rankings = rankings.slice(0, RANK_KEEP_TOP);
  saveRankings();
}

function areaRect() {
  return gameArea.getBoundingClientRect();
}

// ✅ Recalculate square size based on current gameArea width
function updateSquareSize() {
  const r = areaRect();

  // Square takes about 22% of width; clamp between 72 and 140
  const base = r.width;
  const sq = Math.max(72, Math.min(140, Math.round(base * 0.22)));

  SQUARE_SIZE = sq;

  // Sync to CSS variable
  gameArea.style.setProperty("--sq", `${SQUARE_SIZE}px`);
}

// random position inside the square area, keeping within bounds
function randomPos() {
  const r = areaRect();
  const half = SQUARE_SIZE / 2;

  // ✅ Leave space at top so target doesn't block Timer/Progress
  const SAFE_TOP = 56;

  const minX = half;
  const maxX = r.width - half;
  const minY = half + SAFE_TOP;
  const maxY = r.height - half;

  const cx = minX + Math.random() * (maxX - minX);
  const cy = minY + Math.random() * (maxY - minY);

  return { x: cx - half, y: cy - half };
}

function placeTargetRandomly() {
  const { x, y } = randomPos();
  targetEl.style.left = `${x}px`;
  targetEl.style.top = `${y}px`;

  // show image if available, else show number
  if (imgOk) {
    targetImg.classList.remove("hidden");
    fallbackNum.classList.add("hidden");
  } else {
    targetImg.classList.add("hidden");
    fallbackNum.classList.remove("hidden");
    fallbackNum.textContent = String(currentTarget);
  }
}

function setUIPlaying() {
  startScreen.classList.add("hidden");
  resultScreen.classList.add("hidden");
  targetEl.classList.remove("hidden");
}

function setUIStart() {
  startScreen.classList.remove("hidden");
  resultScreen.classList.add("hidden");
  targetEl.classList.add("hidden");
  timerEl.textContent = "Time: 0.00s";
  progressEl.textContent = "";
}

function setUIResult(finalSec) {
  startScreen.classList.add("hidden");
  resultScreen.classList.remove("hidden");
  targetEl.classList.add("hidden");

  finalTimeEl.textContent = `完成：${formatTime(finalSec)}`;

  rankListEl.innerHTML = "";
  rankings.slice(0, RANK_KEEP_TOP).forEach((t) => {
    const li = document.createElement("li");
    li.textContent = formatTime(t);
    rankListEl.appendChild(li);
  });
}

// timer loop
function tick() {
  if (state !== "PLAYING") return;
  const now = performance.now();
  elapsedSec = (now - startTimeMs) / 1000;
  timerEl.textContent = `Time: ${formatTime(elapsedSec)}`;
  progressEl.textContent = `${currentTarget}/${TARGET_MAX}`;
  rafId = requestAnimationFrame(tick);
}

// =====================
// Game flow
// =====================
function startGame() {
  updateSquareSize(); // ✅ ensure correct size before placing

  state = "PLAYING";
  currentTarget = 1;
  elapsedSec = 0;

  startTimeMs = performance.now();
  setUIPlaying();
  placeTargetRandomly();

  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(tick);
}

function finishGame() {
  state = "RESULT";
  cancelAnimationFrame(rafId);

  const finalSec = elapsedSec;
  insertRanking(finalSec);
  setUIResult(finalSec);
}

function wrongFlash() {
  targetEl.classList.add("wrong");
  if (navigator.vibrate) navigator.vibrate(30); // ✅ mobile feedback
  setTimeout(() => targetEl.classList.remove("wrong"), WRONG_FLASH_MS);
}

// =====================
// Input handling
// =====================
btnStart.addEventListener("click", startGame);
btnRetry.addEventListener("click", startGame);

btnExit.addEventListener("click", () => {
  // "exit" = back to start screen
  state = "START";
  cancelAnimationFrame(rafId);
  setUIStart();
});

// Clicking anywhere: if click hits target, advance; else wrong flash
gameArea.addEventListener("pointerdown", (e) => {
  if (state !== "PLAYING") return;

  const tRect = targetEl.getBoundingClientRect();
  const hit =
    e.clientX >= tRect.left && e.clientX <= tRect.right &&
    e.clientY >= tRect.top  && e.clientY <= tRect.bottom;

  if (hit) {
    if (currentTarget < TARGET_MAX) {
      currentTarget += 1;
      placeTargetRandomly();
    } else {
      finishGame();
    }
  } else {
    wrongFlash();
  }
});

// ESC to leave back to start
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    state = "START";
    cancelAnimationFrame(rafId);
    setUIStart();
  }
});

// ✅ Recalculate square size on resize/orientation change
window.addEventListener("resize", () => {
  updateSquareSize();
  if (state === "PLAYING") placeTargetRandomly();
});

// initial UI
updateSquareSize();
setUIStart();
