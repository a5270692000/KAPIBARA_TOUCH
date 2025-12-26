// =====================
// 30s score attack
// - Normal / Hard mode
// - Combo + floating score + last-5s hurry + low beep
// - Hard mode: Golden & Devil kapibara
// =====================

// ----- Config -----
const GAME_DURATION_SEC = 30;
let SQUARE_SIZE = 140;

// Base penalties
const SCORE_POOR_PENALTY_BASE = -30;
const SCORE_DEVIL_PENALTY_BASE = -60;

// Weights (normal / hard)
const NORMAL_GOOD_WEIGHT = 7;
const NORMAL_POOR_WEIGHT = 3;

// Hard mode aggregated ratio:
// (GOOD + GOLD) : (POOR + DEVIL) = 7 : 3
// 其中壞陣營內部：POOR / DEVIL 各 1/2
const HARD_GOODISH_WEIGHT = 7;
const HARD_BAD_WEIGHT = 3;

// Ranking
const RANK_KEY = "kapibara_score_attack_rankings_v_golddevil_v1";
const RANK_KEEP_TOP = 10;

// Images (case-sensitive on Netlify)
const IMG_GOOD  = "picture/KAPIBARA.png";
const IMG_POOR  = "picture/KAPIBARA_poor.png";
const IMG_GOLD  = "picture/GOLD_KAPIBARA.png";
const IMG_DEVIL = "picture/DEVIL_KAPIBARA.png";

// ----- DOM -----
const gameArea     = document.getElementById("gameArea");
const startScreen  = document.getElementById("startScreen");
const resultScreen = document.getElementById("resultScreen");

const btnStartNormal = document.getElementById("btnStartNormal");
const btnStartHard   = document.getElementById("btnStartHard");
const btnRetry       = document.getElementById("btnRetry");
const btnExit        = document.getElementById("btnExit");

const timerEl   = document.getElementById("timer");
const progressEl= document.getElementById("progress");
const scoreEl   = document.getElementById("score");

const targetEl  = document.getElementById("target");
const targetImg = document.getElementById("targetImg");
const fallbackNum = document.getElementById("fallbackNum");

const finalTimeEl = document.getElementById("finalTime");
const rankListEl  = document.getElementById("rankList");

// ----- State -----
let state = "START"; // START | PLAYING | RESULT
let rafId = 0;

let startTimeMs  = 0;
let remainingSec = GAME_DURATION_SEC;

let score      = 0;
let comboCount = 0;
let currentType = "GOOD"; // "GOOD" | "POOR" | "GOLD" | "DEVIL"

// mode: "normal" | "hard"
let currentMode = "normal";

// last-5s
let inHurry = false;
let lastHurrySecond = -1;

// hard-mode: golden ready flag
let pendingGold = false;

// ----- Preload Images -----
let goodOk  = false;
let poorOk  = false;
let goldOk  = false;
let devilOk = false;

const goodImg  = new Image();
const poorImg  = new Image();
const goldImg  = new Image();
const devilImg = new Image();

goodImg.src  = IMG_GOOD;
poorImg.src  = IMG_POOR;
goldImg.src  = IMG_GOLD;
devilImg.src = IMG_DEVIL;

goodImg.onload  = () => { goodOk  = true; };
goodImg.onerror = () => { goodOk  = false; };

poorImg.onload  = () => { poorOk  = true; };
poorImg.onerror = () => { poorOk  = false; };

goldImg.onload  = () => { goldOk  = true; };
goldImg.onerror = () => { goldOk  = false; };

devilImg.onload  = () => { devilOk = true; };
devilImg.onerror = () => { devilOk = false; };

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

// Combo base rule: +50 -> +70 -> +100 (cap 100)
function getComboBaseScore(combo) {
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
  let top  = parseFloat(targetEl.style.top);

  if (!isFinite(left)) left = 0;
  if (!isFinite(top))  top  = SAFE_TOP;

  const maxLeft = Math.max(0, r.width - SQUARE_SIZE);
  const maxTop  = Math.max(SAFE_TOP, r.height - SQUARE_SIZE);

  left = Math.min(Math.max(0, left), maxLeft);
  top  = Math.min(Math.max(SAFE_TOP, top), maxTop);

  targetEl.style.left = `${left}px`;
  targetEl.style.top  = `${top}px`;
}

// pick type by mode
function pickType() {
  // 如果有 pendingGold，下一個「好陣營」就一定是 GOLD
  if (currentMode === "hard" && pendingGold) {
    // 直接強制 GOLD，不再抽比例
    pendingGold = false;
    return "GOLD";
  }

  if (currentMode === "normal") {
    // 單純 GOOD : POOR = 7 : 3
    const total = NORMAL_GOOD_WEIGHT + NORMAL_POOR_WEIGHT;
    const r = Math.random() * total;
    return r < NORMAL_GOOD_WEIGHT ? "GOOD" : "POOR";
  } else {
    // Hard mode:
    // (GOOD + GOLD) : (POOR + DEVIL) = 7 : 3
    const total = HARD_GOODISH_WEIGHT + HARD_BAD_WEIGHT;
    const r = Math.random() * total;
    const goodish = (r < HARD_GOODISH_WEIGHT);
    if (goodish) {
      // 在 goodish 中，預設就是 GOOD
      return "GOOD";
    } else {
      // bad side: POOR / DEVIL 各 1/2
      return Math.random() < 0.5 ? "POOR" : "DEVIL";
    }
  }
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
  } else if (currentType === "POOR") {
    if (poorOk) {
      targetImg.src = IMG_POOR;
      targetImg.classList.remove("hidden");
      fallbackNum.classList.add("hidden");
    } else {
      targetImg.classList.add("hidden");
      fallbackNum.classList.remove("hidden");
      fallbackNum.textContent = "-30";
    }
  } else if (currentType === "GOLD") {
    if (goldOk) {
      targetImg.src = IMG_GOLD;
      targetImg.classList.remove("hidden");
      fallbackNum.classList.add("hidden");
    } else {
      targetImg.classList.add("hidden");
      fallbackNum.classList.remove("hidden");
      fallbackNum.textContent = "+300";
    }
  } else if (currentType === "DEVIL") {
    if (devilOk) {
      targetImg.src = IMG_DEVIL;
      targetImg.classList.remove("hidden");
      fallbackNum.classList.add("hidden");
    } else {
      targetImg.classList.add("hidden");
      fallbackNum.classList.remove("hidden");
      fallbackNum.textContent = "-60";
    }
  }
}

function spawnNewTarget() {
  currentType = pickType();
  const { x, y } = randomPos();
  targetEl.style.left = `${x}px`;
  targetEl.style.top  = `${y}px`;
  applyTargetVisual();
}

function updateHud() {
  if (scoreEl) scoreEl.textContent = `Score: ${score}`;
  if (timerEl) timerEl.textContent = `Time: ${formatCountdown(remainingSec)}`;

  if (!progressEl) return;

  if (currentMode === "normal") {
    if (currentType === "GOOD") {
      progressEl.textContent = "普通：點元寶水豚加分（空白=跳過/斷Combo）";
    } else if (currentType === "POOR") {
      progressEl.textContent = "普通：避開空錢包水豚（點到會扣分；空白=跳過不斷Combo）";
    } else {
      // 理論上 normal 不會出現 GOLD/DEVIL，但以防萬一
      progressEl.textContent = "普通模式";
    }
  } else {
    // Hard mode
    if (currentType === "GOOD") {
      progressEl.textContent = "困難：點元寶水豚加分（空白=跳過/斷Combo）";
    } else if (currentType === "POOR") {
      progressEl.textContent = "困難：避開空錢包水豚（點到 -30；空白安全）";
    } else if (currentType === "GOLD") {
      progressEl.textContent = "黃金水豚！點中 +300（空白不扣分但 Combo 會斷）";
    } else if (currentType === "DEVIL") {
      progressEl.textContent = "惡魔水豚！點到 -60 且斷 Combo（空白安全）";
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
  el.style.top  = `${y}px`;

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

    const osc  = audioCtx.createOscillator();
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

  score      = 0;
  comboCount = 0;
  remainingSec = GAME_DURATION_SEC;
  currentType = "GOOD";
  pendingGold = false;

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

  const modeText = currentMode === "hard" ? "【困難模式】" : "【普通模式】";
  finalTimeEl.textContent = `${modeText} 瓜瓜可能會得到：${finalScore} 元`;

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
  remainingSec  = Math.max(0, GAME_DURATION_SEC - elapsed);

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

function startGame(mode) {
  if (mode) {
    currentMode = mode;  // "normal" or "hard"
  }

  updateSquareSize();

  state = "PLAYING";
  score = 0;
  comboCount = 0;
  remainingSec = GAME_DURATION_SEC;
  currentType = "GOOD";
  pendingGold = false;

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
      // GOOD 命中：Combo++，依 Combo 加分
      comboCount += 1;
      const gain = getComboBaseScore(comboCount);
      score += gain;
      showFloatScore(`+${gain}`, e.clientX, e.clientY);

      // 困難模式：Combo 達 5 次後，儲存一次黃金機會
      if (currentMode === "hard" && comboCount >= 5) {
        pendingGold = true;
        comboCount = 0; // 清空 Combo，等待黃金水豚出現後再重新累積
      }

      spawnNewTarget();
    } else {
      // 點空白：跳過 GOOD，但 Combo 斷掉
      comboCount = 0;
      spawnNewTarget();
    }
  } else if (currentType === "POOR") {
    if (hit) {
      // 點到 POOR：扣分 + Combo 歸零
      comboCount = 0;
      score += SCORE_POOR_PENALTY_BASE;
      showFloatScore(`${SCORE_POOR_PENALTY_BASE}`, e.clientX, e.clientY);
      if (navigator.vibrate) navigator.vibrate(25);
      spawnNewTarget();
    } else {
      // 點空白：安全跳過，Combo 保留
      spawnNewTarget();
    }
  } else if (currentType === "GOLD") {
    if (hit) {
      // 黃金水豚：+300，不影響 Combo 累積（當作額外獎勵）
      const gain = 300;
      score += gain;
      showFloatScore(`+${gain}`, e.clientX, e.clientY);
      spawnNewTarget();
    } else {
      // 按空白：不扣分，但 Combo 斷掉（黃金機會浪費）
      comboCount = 0;
      spawnNewTarget();
    }
  } else if (currentType === "DEVIL") {
    if (hit) {
      // 惡魔水豚：重罰 -60，Combo 歸零
      comboCount = 0;
      score += SCORE_DEVIL_PENALTY_BASE;
      showFloatScore(`${SCORE_DEVIL_PENALTY_BASE}`, e.clientX, e.clientY);
      if (navigator.vibrate) navigator.vibrate(40);
      spawnNewTarget();
    } else {
      // 點空白：安全跳過，Combo 保留
      spawnNewTarget();
    }
  }

  if (score < 0) score = 0;

  updateHud();
});

// Mode buttons
btnStartNormal.addEventListener("click", () => startGame("normal"));
btnStartHard.addEventListener("click",   () => startGame("hard"));

// Retry: 保留上一場模式
btnRetry.addEventListener("click", () => startGame());

// Exit 回到選單
btnExit.addEventListener("click", setUIStart);

// Mobile fix: do NOT re-roll target on resize
window.addEventListener("resize", () => {
  updateSquareSize();
  if (state === "PLAYING") clampTargetPosition();
});

// init
updateSquareSize();
setUIStart();
