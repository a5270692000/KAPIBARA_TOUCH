// =====================
// Game Mode: 30s score attack + combo system (GOOD can click blank to skip)
// =====================

// ----- Config -----
const GAME_DURATION_SEC = 30;
let SQUARE_SIZE = 140;

const SCORE_POOR_PENALTY = -30;

// 7:3 ratio
const GOOD_WEIGHT = 7;
const POOR_WEIGHT = 3;

// Ranking
const RANK_KEY = "kapibara_score_attack_rankings_v4";
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
      progressEl.textContent = "點元寶水豚可加分（空白=跳過/斷Combo）";
    } else {
      progressEl.textContent = "避開空錢包水豚（點到會扣分）";
    }
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
      // ✅ Hit GOOD => combo grows, score increases (50->70->100)
      comboCount += 1;
      score += getComboScore(comboCount);
      spawnNewTarget();
    } else {
      // ✅ Click blank on GOOD => no score, combo breaks, spawn next (no flash)
      comboCount = 0;
      spawnNewTarget();
    }
  } else { // POOR
    if (hit) {
      // ❌ Hit POOR => penalty + break combo
      comboCount = 0;
      score += SCORE_POOR_PENALTY;
      if (navigator.vibrate) navigator.vibrate(25);
      spawnNewTarget();
    } else {
      // ✅ Click blank on POOR => safe skip, KEEP combo
      spawnNewTarget();
    }
}

  // Optional: prevent negative score floor
  score = Math.max(0, score);

  updateHud();
});

btnStart.addEventListener("click", startGame);
btnRetry.addEventListener("click", startGame);
btnExit.addEventListener("click", setUIStart);

window.addEventListener("resize", () => {
  updateSquareSize();
  if (state === "PLAYING") spawnNewTarget();
});

// init
updateSquareSize();
setUIStart();
