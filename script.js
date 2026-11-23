// ============================================================
// Neon Bubble Shooter v2 — Coco Games
// ============================================================

const BUBBLE_RADIUS = 20;
const BUBBLE_DIAMETER = BUBBLE_RADIUS * 2;
const ROW_HEIGHT = BUBBLE_RADIUS * Math.sqrt(3);
const BOARD_WIDTH = 12;
const BOARD_HEIGHT = 17; // Rows 0..16; row 16 is danger/game-over row
const SPEED = 14;

const ALL_COLORS = [
    { hex: '#ff0055', symbol: '★', name: 'Pink' },
    { hex: '#00e5ff', symbol: '◆', name: 'Cyan' },
    { hex: '#a200ff', symbol: '♥', name: 'Purple' },
    { hex: '#ffcc00', symbol: '▲', name: 'Gold' },
    { hex: '#00ff66', symbol: '●', name: 'Green' },
    { hex: '#ff6b00', symbol: '✦', name: 'Orange' }
];

const DIFFICULTIES = {
    easy:    { label: 'Easy',    colorCount: 4, ceilingDropShots: 0, maxBounces: 2 },
    classic: { label: 'Classic', colorCount: 5, ceilingDropShots: 6, maxBounces: 2 },
    hard:    { label: 'Hard',    colorCount: 6, ceilingDropShots: 4, maxBounces: 1 }
};

// 3 Handcrafted Levels ('.' = empty, '0'..'5' = color index modulo difficulty colorCount)
const LEVELS = [
    {
        id: 1,
        name: 'Neon Wave',
        bonus: 250,
        pattern: [
            '000111222333',
            '00111222333',
            '.1122233300.',
            '.122333001.',
            '..23300011..'
        ]
    },
    {
        id: 2,
        name: 'Cosmic Diamond',
        bonus: 400,
        pattern: [
            '001122334400',
            '01122334400',
            '.1122443311.',
            '..22334422..',
            '...330011...',
            '....0011...'
        ]
    },
    {
        id: 3,
        name: 'Starburst Fortress',
        bonus: 600,
        pattern: [
            '001122334455',
            '01122334455',
            '220044115533',
            '20044115533',
            '.0033552211.',
            '..33114400..',
            '...112233...'
        ]
    }
];

// ============================================================
// Storage Helpers
// ============================================================
const STORAGE_KEYS = {
    best: 'coco_bubble_high_score',
    muted: 'coco_bubble_muted',
    symbols: 'coco_bubble_symbols',
    difficulty: 'coco_bubble_difficulty'
};

function loadSetting(key, fallback) {
    try {
        const v = localStorage.getItem(key);
        return v !== null ? v : fallback;
    } catch {
        return fallback;
    }
}

function saveSetting(key, val) {
    try {
        localStorage.setItem(key, String(val));
    } catch { /* ignore storage quota errors */ }
}

// ============================================================
// Web Audio SFX Engine (Zero External Dependencies)
// ============================================================
let audioCtx = null;
let isMuted = loadSetting(STORAGE_KEYS.muted, 'false') === 'true';

function ensureAudio() {
    if (isMuted) return null;
    if (!audioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        audioCtx = new Ctx();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}

const sfx = {
    shoot: () => {
        const ctx = ensureAudio();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(580, now);
        osc.frequency.exponentialRampToValueAtTime(210, now + 0.16);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.005, now + 0.16);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.16);
    },
    bounce: () => {
        const ctx = ensureAudio();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.exponentialRampToValueAtTime(640, now + 0.06);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.005, now + 0.06);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.06);
    },
    swap: () => {
        const ctx = ensureAudio();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(340, now);
        osc.frequency.exponentialRampToValueAtTime(560, now + 0.07);
        gain.gain.setValueAtTime(0.13, now);
        gain.gain.exponentialRampToValueAtTime(0.005, now + 0.07);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.07);
    },
    pop: (combo = 1) => {
        const ctx = ensureAudio();
        if (!ctx) return;
        const now = ctx.currentTime;
        const pitchBoost = Math.min(combo - 1, 6) * 90;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(640 + pitchBoost, now);
        osc.frequency.exponentialRampToValueAtTime(1180 + pitchBoost, now + 0.12);
        gain.gain.setValueAtTime(0.16, now);
        gain.gain.exponentialRampToValueAtTime(0.005, now + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.12);
    },
    drop: (count = 1) => {
        const ctx = ensureAudio();
        if (!ctx) return;
        const notes = [523.25, 659.25, 783.99, 1046.5];
        const steps = Math.min(count, notes.length);
        const now = ctx.currentTime;
        for (let i = 0; i < steps; i++) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(notes[i], now + i * 0.055);
            gain.gain.setValueAtTime(0.12, now + i * 0.055);
            gain.gain.exponentialRampToValueAtTime(0.005, now + i * 0.055 + 0.18);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + i * 0.055);
            osc.stop(now + i * 0.055 + 0.18);
        }
    },
    bomb: () => {
        const ctx = ensureAudio();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(170, now);
        osc.frequency.exponentialRampToValueAtTime(38, now + 0.35);
        gain.gain.setValueAtTime(0.24, now);
        gain.gain.exponentialRampToValueAtTime(0.005, now + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.35);
    },
    levelUp: () => {
        const ctx = ensureAudio();
        if (!ctx) return;
        const notes = [523.25, 659.25, 783.99, 1046.5];
        const now = ctx.currentTime;
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + i * 0.1);
            gain.gain.setValueAtTime(0.18, now + i * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.005, now + i * 0.1 + 0.25);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + i * 0.1);
            osc.stop(now + i * 0.1 + 0.25);
        });
    },
    win: () => {
        const ctx = ensureAudio();
        if (!ctx) return;
        const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
        const now = ctx.currentTime;
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + i * 0.11);
            gain.gain.setValueAtTime(0.2, now + i * 0.11);
            gain.gain.exponentialRampToValueAtTime(0.005, now + i * 0.11 + 0.35);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + i * 0.11);
            osc.stop(now + i * 0.11 + 0.35);
        });
    },
    gameOver: () => {
        const ctx = ensureAudio();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(280, now);
        osc.frequency.exponentialRampToValueAtTime(55, now + 0.85);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.005, now + 0.85);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.85);
    }
};

// ============================================================
// DOM References
// ============================================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestScoreEl = document.getElementById('best-score');
const levelDisplayEl = document.getElementById('level-display');
const difficultySelect = document.getElementById('difficulty-select');
const symbolsBtn = document.getElementById('symbols-btn');
const muteBtn = document.getElementById('mute-btn');
const resetBtn = document.getElementById('reset-btn');

const gameOverEl = document.getElementById('game-over');
const modalBadgeEl = document.getElementById('modal-badge');
const gameOverTitleEl = document.getElementById('game-over-title');
const modalSubtitleEl = document.getElementById('modal-subtitle');
const finalScoreEl = document.getElementById('final-score-val');
const finalBestEl = document.getElementById('final-best-val');
const nextLevelBtn = document.getElementById('next-level-btn');
const restartBtn = document.getElementById('restart-btn');

// ============================================================
// Game State
// ============================================================
const canvasWidth = BOARD_WIDTH * BUBBLE_DIAMETER + BUBBLE_RADIUS; // 500
const canvasHeight = Math.round(BOARD_HEIGHT * ROW_HEIGHT + BUBBLE_DIAMETER * 2 + 32); // ~700
canvas.width = canvasWidth;
canvas.height = canvasHeight;

const startX = canvasWidth / 2;
const startY = canvasHeight - BUBBLE_RADIUS - 18;
const swapPos = { x: startX + 74, y: startY };

let difficultyKey = loadSetting(STORAGE_KEYS.difficulty, 'easy');
if (!DIFFICULTIES[difficultyKey]) difficultyKey = 'easy';
let showSymbols = loadSetting(STORAGE_KEYS.symbols, 'false') === 'true';
let highScore = parseInt(loadSetting(STORAGE_KEYS.best, '0'), 10) || 0;

let currentLevelIndex = 0; // 0, 1, 2
let rowOffset = 0; // Parity offset (0 or 1) so ceiling drops preserve hex alignment
let grid = [];
let score = 0;
let combo = 0;
let missesSinceDrop = 0;
let nextSpecialToggle = 0; // Alternates rainbow / bomb rewards
let gameState = 'playing'; // 'playing' | 'levelcomplete' | 'win' | 'gameover'

let currentBubble = null;
let nextBubble = null;
let bubblesToDrop = [];
let particles = [];
let shockwaves = [];
let floatingTexts = [];

let aimAngle = -Math.PI / 2;
let isAiming = false;
let showAimPreview = true;
let isFiring = false;
let frameCount = 0;
const keysHeld = { left: false, right: false };

// ============================================================
// Hex Grid Helpers (Parity-Aware)
// ============================================================
function isRowShifted(r) {
    return (r + rowOffset) % 2 === 1;
}

function getRowCols(r) {
    return isRowShifted(r) ? BOARD_WIDTH - 1 : BOARD_WIDTH;
}

function getGridX(r, c) {
    return BUBBLE_RADIUS + c * BUBBLE_DIAMETER + (isRowShifted(r) ? BUBBLE_RADIUS : 0);
}

function getGridY(r) {
    return BUBBLE_RADIUS + r * ROW_HEIGHT;
}

function getActivePalette() {
    return ALL_COLORS.slice(0, DIFFICULTIES[difficultyKey].colorCount);
}

function getSymbolForColor(hex) {
    const found = ALL_COLORS.find(c => c.hex === hex);
    return found ? found.symbol : '';
}

function getRemainingBoardColors() {
    const set = new Set();
    for (let r = 0; r < BOARD_HEIGHT; r++) {
        for (let c = 0; c < grid[r].length; c++) {
            const b = grid[r][c];
            if (b && !b.popping && b.color) set.add(b.color);
        }
    }
    return Array.from(set);
}

function pickShooterColor() {
    const active = getRemainingBoardColors();
    if (active.length > 0) {
        return active[Math.floor(Math.random() * active.length)];
    }
    const palette = getActivePalette();
    return palette[Math.floor(Math.random() * palette.length)].hex;
}

function createShooterBubble(special = null) {
    return {
        x: startX,
        y: startY,
        color: special ? '#ffffff' : pickShooterColor(),
        special, // null | 'rainbow' | 'bomb'
        vx: 0,
        vy: 0
    };
}

function getNeighbors(r, c) {
    const list = [];
    const shifted = isRowShifted(r);
    const directions = shifted
        ? [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]]
        : [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]];

    for (const [dr, dc] of directions) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < BOARD_HEIGHT && nc >= 0 && nc < getRowCols(nr)) {
            list.push([nr, nc]);
        }
    }
    return list;
}

// ============================================================
// Level Loading & Initialization
// ============================================================
function loadLevel(levelIdx, keepScore = false) {
    currentLevelIndex = levelIdx;
    rowOffset = 0;
    combo = 0;
    missesSinceDrop = 0;
    isFiring = false;
    isAiming = false;
    gameState = 'playing';

    if (!keepScore) score = 0;

    grid = [];
    for (let r = 0; r < BOARD_HEIGHT; r++) {
        grid[r] = new Array(getRowCols(r)).fill(null);
    }

    const level = LEVELS[currentLevelIndex];
    const palette = getActivePalette();
    // Randomize palette rotation per run so replays feel fresh
    const colorShift = Math.floor(Math.random() * palette.length);

    level.pattern.forEach((rowStr, r) => {
        const cols = getRowCols(r);
        for (let c = 0; c < Math.min(cols, rowStr.length); c++) {
            const ch = rowStr[c];
            if (ch !== '.' && ch !== ' ') {
                const idx = (parseInt(ch, 10) + colorShift) % palette.length;
                grid[r][c] = {
                    color: palette[idx].hex,
                    x: getGridX(r, c),
                    y: getGridY(r),
                    r,
                    c,
                    popAnim: 0,
                    popping: false
                };
            }
        }
    });

    bubblesToDrop = [];
    particles = [];
    shockwaves = [];
    floatingTexts = [];

    currentBubble = createShooterBubble();
    nextBubble = createShooterBubble();

    updateHUD();
    gameOverEl.classList.add('hidden');
    addFloatingText(startX, canvasHeight * 0.45, `LEVEL ${level.id}: ${level.name.toUpperCase()}`, '#00e5ff', 22);
}

function updateHUD() {
    scoreEl.innerText = score;
    if (score > highScore) {
        highScore = score;
        saveSetting(STORAGE_KEYS.best, highScore);
    }
    bestScoreEl.innerText = highScore;
    levelDisplayEl.innerText = `${currentLevelIndex + 1}/${LEVELS.length}`;
}

function syncControlUI() {
    difficultySelect.value = difficultyKey;
    symbolsBtn.classList.toggle('active', showSymbols);
    muteBtn.innerText = isMuted ? '🔇' : '🔊';
    muteBtn.classList.toggle('muted', isMuted);
}

// ============================================================
// Floating Text & Visual Effects
// ============================================================
function addFloatingText(x, y, text, color = '#ffffff', size = 18) {
    floatingTexts.push({
        x: Math.max(70, Math.min(canvasWidth - 70, x)),
        y,
        text,
        color,
        size,
        life: 1,
        vy: -1.1
    });
}

function createParticles(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = 2 + Math.random() * 6;
        particles.push({
            x,
            y,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd,
            life: 1,
            radius: 2.5 + Math.random() * 2.5,
            color
        });
    }
}

function createShockwave(x, y, color = '#ff6b00', maxR = BUBBLE_DIAMETER * 2.4) {
    shockwaves.push({ x, y, r: BUBBLE_RADIUS * 0.5, maxR, color, life: 1 });
}

// ============================================================
// Core Gameplay Mechanics
// ============================================================
function swapBubbles() {
    if (gameState !== 'playing' || isFiring || !currentBubble || !nextBubble) return;
    const temp = currentBubble;
    currentBubble = nextBubble;
    nextBubble = temp;
    currentBubble.x = startX;
    currentBubble.y = startY;
    currentBubble.vx = 0;
    currentBubble.vy = 0;
    sfx.swap();
}

function findColorCluster(startR, startC, targetColor) {
    const visited = new Set([`${startR},${startC}`]);
    const matches = [];
    const queue = [[startR, startC]];

    while (queue.length > 0) {
        const [r, c] = queue.shift();
        matches.push([r, c]);
        for (const [nr, nc] of getNeighbors(r, c)) {
            const nb = grid[nr][nc];
            if (nb && !nb.popping && !visited.has(`${nr},${nc}`) && nb.color === targetColor) {
                visited.add(`${nr},${nc}`);
                queue.push([nr, nc]);
            }
        }
    }
    return matches;
}

function dropFloatingBubbles() {
    const visited = new Set();
    const queue = [];

    for (let c = 0; c < grid[0].length; c++) {
        if (grid[0][c] && !grid[0][c].popping) {
            queue.push([0, c]);
            visited.add(`0,${c}`);
        }
    }

    while (queue.length > 0) {
        const [r, c] = queue.shift();
        for (const [nr, nc] of getNeighbors(r, c)) {
            const nb = grid[nr][nc];
            if (nb && !nb.popping && !visited.has(`${nr},${nc}`)) {
                visited.add(`${nr},${nc}`);
                queue.push([nr, nc]);
            }
        }
    }

    let droppedCount = 0;
    for (let r = 0; r < BOARD_HEIGHT; r++) {
        for (let c = 0; c < grid[r].length; c++) {
            const b = grid[r][c];
            if (b && !b.popping && !visited.has(`${r},${c}`)) {
                b.vy = -1.5;
                b.vx = (Math.random() - 0.5) * 4;
                bubblesToDrop.push(b);
                grid[r][c] = null;
                droppedCount++;
            }
        }
    }

    if (droppedCount > 0) {
        const dropBonus = droppedCount * 20;
        score += dropBonus;
        updateHUD();
        sfx.drop(droppedCount);
        addFloatingText(startX, startY - 90, `DROP BONUS +${dropBonus}!`, '#00ff66', 20);
    }
    return droppedCount;
}

function dropCeilingRow() {
    rowOffset = (rowOffset + 1) % 2;
    const palette = getActivePalette();
    const cols = getRowCols(0);
    const newRow = [];
    for (let c = 0; c < cols; c++) {
        const color = palette[Math.floor(Math.random() * palette.length)].hex;
        newRow.push({
            color,
            x: getGridX(0, c),
            y: getGridY(0),
            r: 0,
            c,
            popAnim: 0,
            popping: false
        });
    }

    // Shift existing rows down by 1
    grid.pop();
    grid.unshift(newRow);
    for (let r = 0; r < BOARD_HEIGHT; r++) {
        for (let c = 0; c < grid[r].length; c++) {
            const b = grid[r][c];
            if (b) {
                b.r = r;
                b.c = c;
                b.x = getGridX(r, c);
                b.y = getGridY(r);
            }
        }
    }
    addFloatingText(startX, 65, 'CEILING DROP!', '#ff0055', 18);
}

function snapBubble(x, y) {
    let bestR = 0, bestC = 0, minDist = Infinity;
    for (let nr = 0; nr < BOARD_HEIGHT; nr++) {
        const ncols = getRowCols(nr);
        for (let nc = 0; nc < ncols; nc++) {
            if (grid[nr][nc] === null) {
                const d = Math.hypot(x - getGridX(nr, nc), y - getGridY(nr));
                if (d < minDist) {
                    minDist = d;
                    bestR = nr;
                    bestC = nc;
                }
            }
        }
    }
    return [bestR, bestC];
}

function awardPowerUpIfEarned(droppedCount) {
    const earned = (combo > 0 && combo % 4 === 0) || droppedCount >= 5;
    if (earned && !nextBubble.special) {
        const type = nextSpecialToggle % 2 === 0 ? 'rainbow' : 'bomb';
        nextSpecialToggle++;
        nextBubble.special = type;
        nextBubble.color = '#ffffff';
        const label = type === 'rainbow' ? '🌈 RAINBOW NEXT!' : '💣 BOMB NEXT!';
        addFloatingText(startX, startY - 55, label, '#ffcc00', 19);
    }
}

function checkWinOrGameOver() {
    if (gameState !== 'playing') return;

    // 1. Check Game Over (any non-popping bubble in bottom danger row)
    for (let c = 0; c < grid[BOARD_HEIGHT - 1].length; c++) {
        const b = grid[BOARD_HEIGHT - 1][c];
        if (b && !b.popping) {
            gameState = 'gameover';
            sfx.gameOver();
            showModal('gameover');
            return;
        }
    }

    // 2. Check Win (no active non-popping bubbles left on board)
    let hasActiveBubbles = false;
    for (let r = 0; r < BOARD_HEIGHT; r++) {
        for (let c = 0; c < grid[r].length; c++) {
            const b = grid[r][c];
            if (b && !b.popping) {
                hasActiveBubbles = true;
                break;
            }
        }
        if (hasActiveBubbles) break;
    }

    if (!hasActiveBubbles) {
        const level = LEVELS[currentLevelIndex];
        score += level.bonus;
        updateHUD();

        if (currentLevelIndex < LEVELS.length - 1) {
            gameState = 'levelcomplete';
            sfx.levelUp();
            showModal('levelcomplete');
        } else {
            gameState = 'win';
            sfx.win();
            showModal('win');
        }
    }
}

function showModal(mode) {
    const level = LEVELS[currentLevelIndex];
    modalBadgeEl.innerText = `LEVEL ${level.id} — ${level.name.toUpperCase()}`;
    finalScoreEl.innerText = score;
    finalBestEl.innerText = highScore;

    if (mode === 'levelcomplete') {
        gameOverTitleEl.innerText = 'LEVEL CLEAR!';
        gameOverTitleEl.style.background = 'linear-gradient(to right, #00ff66, #00e5ff)';
        modalSubtitleEl.innerText = `Clear Bonus +${level.bonus} pts!`;
        nextLevelBtn.classList.remove('hidden');
        restartBtn.innerText = 'RESTART FROM LVL 1';
    } else if (mode === 'win') {
        gameOverTitleEl.innerText = 'YOU WIN!';
        gameOverTitleEl.style.background = 'linear-gradient(to right, #ffcc00, #00ff66)';
        modalSubtitleEl.innerText = `All 3 Levels Cleared! (+${level.bonus} bonus)`;
        nextLevelBtn.classList.add('hidden');
        restartBtn.innerText = 'PLAY AGAIN';
    } else {
        gameOverTitleEl.innerText = 'GAME OVER';
        gameOverTitleEl.style.background = 'linear-gradient(to right, #ff007f, #a200ff)';
        modalSubtitleEl.innerText = 'Bubbles reached the danger line!';
        nextLevelBtn.classList.add('hidden');
        restartBtn.innerText = 'TRY AGAIN';
    }
    gameOverTitleEl.style.webkitBackgroundClip = 'text';
    gameOverTitleEl.style.backgroundClip = 'text';
    gameOverEl.classList.remove('hidden');
}

// ============================================================
// Wall-Bouncing Aim Raycast
// ============================================================
function computeAimTrajectory() {
    const maxBounces = DIFFICULTIES[difficultyKey].maxBounces;
    const points = [{ x: startX, y: startY }];
    let x = startX;
    let y = startY;
    let vx = Math.cos(aimAngle);
    let vy = Math.sin(aimAngle);
    let bounces = 0;
    const step = 4;

    for (let i = 0; i < 420; i++) {
        x += vx * step;
        y += vy * step;

        if (x - BUBBLE_RADIUS < 0) {
            x = BUBBLE_RADIUS;
            points.push({ x, y });
            if (bounces >= maxBounces) return { points, snapCell: null };
            vx *= -1;
            bounces++;
        } else if (x + BUBBLE_RADIUS > canvasWidth) {
            x = canvasWidth - BUBBLE_RADIUS;
            points.push({ x, y });
            if (bounces >= maxBounces) return { points, snapCell: null };
            vx *= -1;
            bounces++;
        }

        if (y - BUBBLE_RADIUS <= 0) {
            points.push({ x, y: BUBBLE_RADIUS });
            return { points, snapCell: snapBubble(x, BUBBLE_RADIUS) };
        }

        let hit = false;
        for (let r = 0; r < BOARD_HEIGHT; r++) {
            for (let c = 0; c < grid[r].length; c++) {
                const b = grid[r][c];
                if (b && !b.popping) {
                    if (Math.hypot(x - b.x, y - b.y) <= BUBBLE_DIAMETER - 3) {
                        hit = true;
                        break;
                    }
                }
            }
            if (hit) break;
        }
        if (hit) {
            points.push({ x, y });
            return { points, snapCell: snapBubble(x, y) };
        }
    }

    points.push({ x, y });
    return { points, snapCell: null };
}

// ============================================================
// Input Handling (Canvas-Scoped Mouse/Touch + Keyboard)
// ============================================================
function getCanvasCoords(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top) * (canvas.height / rect.height)
    };
}

function isNearSwapButton(x, y) {
    return Math.hypot(x - swapPos.x, y - swapPos.y) <= 30;
}

function updateAimFromCoords(x, y) {
    if (gameState !== 'playing' || isFiring) return;
    const dx = x - startX;
    const dy = y - startY;
    aimAngle = Math.atan2(dy, dx);
    if (aimAngle > -0.12) aimAngle = -0.12;
    if (aimAngle < -Math.PI + 0.12) aimAngle = -Math.PI + 0.12;
    showAimPreview = true;
}

function fireBubble() {
    if (gameState !== 'playing' || isFiring || !currentBubble) return;
    isFiring = true;
    sfx.shoot();
    currentBubble.vx = Math.cos(aimAngle) * SPEED;
    currentBubble.vy = Math.sin(aimAngle) * SPEED;
}

canvas.addEventListener('mousemove', (e) => {
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);
    if (!isNearSwapButton(x, y)) updateAimFromCoords(x, y);
});

canvas.addEventListener('mousedown', (e) => {
    if (e.button === 2) return; // Right click handled by contextmenu
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);
    if (isNearSwapButton(x, y)) {
        swapBubbles();
        return;
    }
    isAiming = true;
    updateAimFromCoords(x, y);
});

canvas.addEventListener('mouseup', () => {
    if (isAiming) {
        isAiming = false;
        fireBubble();
    }
});

canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    swapBubbles();
});

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.touches[0];
    const { x, y } = getCanvasCoords(t.clientX, t.clientY);
    if (isNearSwapButton(x, y)) {
        swapBubbles();
        return;
    }
    isAiming = true;
    updateAimFromCoords(x, y);
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!isAiming) return;
    const t = e.touches[0];
    const { x, y } = getCanvasCoords(t.clientX, t.clientY);
    updateAimFromCoords(x, y);
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (isAiming) {
        isAiming = false;
        fireBubble();
    }
}, { passive: false });

// Keyboard Controls
window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT')) return;
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        keysHeld.left = true;
        showAimPreview = true;
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        keysHeld.right = true;
        showAimPreview = true;
    } else if (e.key === ' ' || e.key === 'Enter') {
        if (gameState === 'playing') {
            e.preventDefault();
            fireBubble();
        }
    } else if (e.key === 'ArrowUp' || e.key === 'Shift' || e.key === 'w' || e.key === 'W') {
        if (gameState === 'playing') {
            e.preventDefault();
            swapBubbles();
        }
    }
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keysHeld.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keysHeld.right = false;
});

// UI Button Listeners (registered once)
difficultySelect.addEventListener('change', () => {
    difficultyKey = difficultySelect.value;
    saveSetting(STORAGE_KEYS.difficulty, difficultyKey);
    loadLevel(0, false);
});

symbolsBtn.addEventListener('click', () => {
    showSymbols = !showSymbols;
    saveSetting(STORAGE_KEYS.symbols, showSymbols);
    syncControlUI();
});

muteBtn.addEventListener('click', () => {
    isMuted = !isMuted;
    saveSetting(STORAGE_KEYS.muted, isMuted);
    syncControlUI();
});

resetBtn.addEventListener('click', () => loadLevel(0, false));
restartBtn.addEventListener('click', () => loadLevel(0, false));
nextLevelBtn.addEventListener('click', () => loadLevel(currentLevelIndex + 1, true));

// ============================================================
// Update Loop
// ============================================================
function resolveCollision() {
    const [r, c] = snapBubble(currentBubble.x, currentBubble.y);
    const sx = getGridX(r, c);
    const sy = getGridY(r);
    const special = currentBubble.special;

    grid[r][c] = {
        color: currentBubble.color,
        special,
        x: sx,
        y: sy,
        r,
        c,
        popAnim: 0,
        popping: false
    };

    let poppedCount = 0;

    if (special === 'bomb') {
        // Clear all bubbles within 2-cell radius
        const blastR = BUBBLE_DIAMETER * 2.15;
        for (let nr = 0; nr < BOARD_HEIGHT; nr++) {
            for (let nc = 0; nc < grid[nr].length; nc++) {
                const nb = grid[nr][nc];
                if (nb && !nb.popping && Math.hypot(nb.x - sx, nb.y - sy) <= blastR) {
                    nb.popping = true;
                    poppedCount++;
                }
            }
        }
        sfx.bomb();
        createShockwave(sx, sy, '#ff6b00', blastR);
        const pts = poppedCount * 15;
        score += pts;
        combo++;
        missesSinceDrop = 0;
        addFloatingText(sx, sy - 10, `💣 BOOM! +${pts}`, '#ff6b00', 22);
    } else if (special === 'rainbow') {
        // Match every adjacent color cluster (size >= 2); fallback to popping direct neighbors
        const toPop = new Set([`${r},${c}`]);
        const checkedColors = new Set();
        for (const [nr, nc] of getNeighbors(r, c)) {
            const nb = grid[nr][nc];
            if (nb && !nb.popping && !checkedColors.has(nb.color)) {
                checkedColors.add(nb.color);
                const cluster = findColorCluster(nr, nc, nb.color);
                if (cluster.length >= 2) {
                    cluster.forEach(([mr, mc]) => toPop.add(`${mr},${mc}`));
                }
            }
        }
        if (toPop.size === 1) {
            for (const [nr, nc] of getNeighbors(r, c)) {
                if (grid[nr][nc] && !grid[nr][nc].popping) toPop.add(`${nr},${nc}`);
            }
        }
        toPop.forEach((key) => {
            const [mr, mc] = key.split(',').map(Number);
            if (grid[mr][mc]) {
                grid[mr][mc].popping = true;
                poppedCount++;
            }
        });
        combo++;
        missesSinceDrop = 0;
        const pts = poppedCount * 15;
        score += pts;
        sfx.pop(combo);
        createShockwave(sx, sy, '#00e5ff', BUBBLE_DIAMETER * 1.6);
        addFloatingText(sx, sy - 10, `🌈 WILD +${pts}`, '#00e5ff', 20);
    } else {
        const matches = findColorCluster(r, c, currentBubble.color);
        if (matches.length >= 3) {
            combo++;
            missesSinceDrop = 0;
            sfx.pop(combo);
            matches.forEach(([mr, mc]) => {
                grid[mr][mc].popping = true;
            });
            poppedCount = matches.length;
            const multiplier = Math.min(combo, 4);
            const pts = poppedCount * 10 * multiplier;
            score += pts;
            const label = combo >= 2 ? `+${pts} (x${multiplier}!)` : `+${pts}`;
            addFloatingText(sx, sy - 10, label, currentBubble.color, combo >= 2 ? 20 : 17);
        } else {
            combo = 0;
            missesSinceDrop++;
        }
    }

    updateHUD();
    const droppedCount = dropFloatingBubbles();
    awardPowerUpIfEarned(droppedCount);

    // Optional ceiling drop in Classic / Hard
    const dropLimit = DIFFICULTIES[difficultyKey].ceilingDropShots;
    if (dropLimit > 0 && missesSinceDrop >= dropLimit) {
        missesSinceDrop = 0;
        dropCeilingRow();
    }

    checkWinOrGameOver();

    // Prepare next shot (ensure active color if board still has bubbles)
    if (gameState === 'playing') {
        currentBubble = nextBubble;
        if (!currentBubble.special) {
            const remaining = getRemainingBoardColors();
            if (remaining.length > 0 && !remaining.includes(currentBubble.color)) {
                currentBubble.color = pickShooterColor();
            }
        }
        currentBubble.x = startX;
        currentBubble.y = startY;
        currentBubble.vx = 0;
        currentBubble.vy = 0;
        nextBubble = createShooterBubble();
    }
    isFiring = false;
}

function update() {
    frameCount++;

    // Keyboard smooth aiming
    if (gameState === 'playing' && !isFiring) {
        const rotSpeed = 0.035;
        if (keysHeld.left) aimAngle = Math.max(-Math.PI + 0.12, aimAngle - rotSpeed);
        if (keysHeld.right) aimAngle = Math.min(-0.12, aimAngle + rotSpeed);
    }

    if (gameState === 'playing' && isFiring) {
        currentBubble.x += currentBubble.vx;
        currentBubble.y += currentBubble.vy;

        // Bounce off walls
        if (currentBubble.x - BUBBLE_RADIUS < 0) {
            currentBubble.x = BUBBLE_RADIUS;
            currentBubble.vx *= -1;
            sfx.bounce();
        } else if (currentBubble.x + BUBBLE_RADIUS > canvasWidth) {
            currentBubble.x = canvasWidth - BUBBLE_RADIUS;
            currentBubble.vx *= -1;
            sfx.bounce();
        }

        // Collision with ceiling or board bubbles
        let collision = currentBubble.y - BUBBLE_RADIUS <= 0;
        if (!collision) {
            for (let r = 0; r < BOARD_HEIGHT; r++) {
                for (let c = 0; c < grid[r].length; c++) {
                    const b = grid[r][c];
                    if (b && !b.popping && Math.hypot(currentBubble.x - b.x, currentBubble.y - b.y) <= BUBBLE_DIAMETER - 2) {
                        collision = true;
                        break;
                    }
                }
                if (collision) break;
            }
        }

        if (collision) resolveCollision();
    }

    // Popping animations
    for (let r = 0; r < BOARD_HEIGHT; r++) {
        for (let c = 0; c < grid[r].length; c++) {
            const b = grid[r][c];
            if (b && b.popping) {
                b.popAnim += 0.07;
                if (b.popAnim >= 1) {
                    createParticles(b.x, b.y, b.special === 'bomb' ? '#ff6b00' : b.color, 10);
                    grid[r][c] = null;
                }
            }
        }
    }

    // Falling floating bubbles
    for (let i = bubblesToDrop.length - 1; i >= 0; i--) {
        const b = bubblesToDrop[i];
        b.vy += 0.35;
        b.x += b.vx;
        b.y += b.vy;
        if (b.y > canvasHeight + BUBBLE_DIAMETER) {
            bubblesToDrop.splice(i, 1);
        }
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08;
        p.life -= 0.03;
        if (p.life <= 0) particles.splice(i, 1);
    }

    // Shockwaves
    for (let i = shockwaves.length - 1; i >= 0; i--) {
        const sw = shockwaves[i];
        sw.r += (sw.maxR - sw.r) * 0.18;
        sw.life -= 0.05;
        if (sw.life <= 0) shockwaves.splice(i, 1);
    }

    // Floating score popups
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const ft = floatingTexts[i];
        ft.y += ft.vy;
        ft.life -= 0.018;
        if (ft.life <= 0) floatingTexts.splice(i, 1);
    }
}

// ============================================================
// Rendering
// ============================================================
function drawBubble(x, y, color, scale = 1, alpha = 1, special = null) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;

    ctx.beginPath();
    ctx.arc(0, 0, BUBBLE_RADIUS, 0, Math.PI * 2);

    if (special === 'rainbow') {
        const hue = (frameCount * 4) % 360;
        const grad = ctx.createRadialGradient(-BUBBLE_RADIUS / 3, -BUBBLE_RADIUS / 3, 2, 0, 0, BUBBLE_RADIUS);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.35, `hsl(${hue}, 100%, 60%)`);
        grad.addColorStop(0.7, `hsl(${(hue + 120) % 360}, 100%, 55%)`);
        grad.addColorStop(1, `hsl(${(hue + 240) % 360}, 100%, 40%)`);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', 0, 1);
    } else if (special === 'bomb') {
        const grad = ctx.createRadialGradient(-BUBBLE_RADIUS / 3, -BUBBLE_RADIUS / 3, 2, 0, 0, BUBBLE_RADIUS);
        grad.addColorStop(0, '#ffd166');
        grad.addColorStop(0.35, '#ff4d00');
        grad.addColorStop(1, '#1a0a0a');
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#ffcc00';
        ctx.stroke();

        ctx.font = '18px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💣', 0, 1);
    } else {
        const grad = ctx.createRadialGradient(-BUBBLE_RADIUS / 3, -BUBBLE_RADIUS / 3, BUBBLE_RADIUS / 10, 0, 0, BUBBLE_RADIUS);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.22, color);
        grad.addColorStop(1, '#050510');
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.lineWidth = 1.8;
        ctx.strokeStyle = 'rgba(255,255,255,0.42)';
        ctx.stroke();

        if (showSymbols) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
            ctx.font = 'bold 15px Outfit, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(0,0,0,0.7)';
            ctx.shadowBlur = 4;
            ctx.fillText(getSymbolForColor(color), 0, 1);
        }
    }

    ctx.restore();
}

function drawDangerLine() {
    // Find lowest active bubble row
    let lowestRow = -1;
    for (let r = BOARD_HEIGHT - 1; r >= 0; r--) {
        if (grid[r].some(b => b && !b.popping)) {
            lowestRow = r;
            break;
        }
    }

    const dangerY = getGridY(BOARD_HEIGHT - 1) - BUBBLE_RADIUS;
    const isWarning = lowestRow >= BOARD_HEIGHT - 3;
    const pulse = isWarning ? 0.45 + 0.45 * Math.sin(frameCount * 0.15) : 0.22;

    ctx.save();
    ctx.setLineDash([8, 8]);
    ctx.lineWidth = isWarning ? 2.5 : 1.5;
    ctx.strokeStyle = isWarning ? `rgba(255, 0, 85, ${pulse})` : 'rgba(255, 255, 255, 0.16)';
    ctx.beginPath();
    ctx.moveTo(10, dangerY);
    ctx.lineTo(canvasWidth - 10, dangerY);
    ctx.stroke();
    ctx.restore();
}

function drawCeilingCounter() {
    const dropLimit = DIFFICULTIES[difficultyKey].ceilingDropShots;
    if (dropLimit <= 0) return;

    const remaining = dropLimit - missesSinceDrop;
    const baseX = 24;
    const baseY = startY;

    ctx.save();
    ctx.font = '700 10px Outfit, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.textAlign = 'left';
    ctx.fillText('NEXT DROP', baseX, baseY - 14);

    for (let i = 0; i < dropLimit; i++) {
        ctx.beginPath();
        ctx.arc(baseX + 6 + i * 14, baseY + 4, 4.5, 0, Math.PI * 2);
        if (i < remaining) {
            ctx.fillStyle = remaining <= 2 ? '#ff0055' : '#00e5ff';
        } else {
            ctx.fillStyle = 'rgba(255,255,255,0.16)';
        }
        ctx.fill();
    }
    ctx.restore();
}

function drawAimGuide() {
    if (gameState !== 'playing' || isFiring || !showAimPreview) return;

    const { points, snapCell } = computeAimTrajectory();
    if (points.length < 2) return;

    ctx.save();
    ctx.setLineDash([7, 7]);
    ctx.lineDashOffset = -(frameCount * 0.8);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = currentBubble.special === 'bomb'
        ? 'rgba(255, 160, 0, 0.75)'
        : 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();

    // Draw snap ghost ring
    if (snapCell) {
        const gx = getGridX(snapCell[0], snapCell[1]);
        const gy = getGridY(snapCell[0]);
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(gx, gy, BUBBLE_RADIUS - 2, 0, Math.PI * 2);
        ctx.strokeStyle = currentBubble.special ? 'rgba(255, 204, 0, 0.7)' : currentBubble.color;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 2.5;
        ctx.stroke();
    }
    ctx.restore();
}

function draw() {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    drawDangerLine();

    // Grid bubbles
    for (let r = 0; r < BOARD_HEIGHT; r++) {
        for (let c = 0; c < grid[r].length; c++) {
            const b = grid[r][c];
            if (!b) continue;
            if (b.popping) {
                drawBubble(b.x, b.y, b.color, 1 + b.popAnim * 0.65, 1 - b.popAnim, b.special);
            } else {
                drawBubble(b.x, b.y, b.color, 1, 1, b.special);
            }
        }
    }

    // Falling bubbles
    bubblesToDrop.forEach(b => drawBubble(b.x, b.y, b.color, 1, 0.9, b.special));

    // Shockwaves
    shockwaves.forEach(sw => {
        ctx.save();
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
        ctx.strokeStyle = sw.color;
        ctx.globalAlpha = Math.max(0, sw.life);
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.restore();
    });

    // Particles
    particles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });

    // Shooter, Aim Guide, Swap Pad & Ceiling Counter
    if (gameState === 'playing') {
        drawAimGuide();
        drawCeilingCounter();

        // Shooter ring
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(startX, startY, BUBBLE_RADIUS + 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        if (currentBubble) {
            drawBubble(currentBubble.x, currentBubble.y, currentBubble.color, 1, 1, currentBubble.special);
        }

        // Next Bubble + Swap Pad
        if (nextBubble) {
            ctx.save();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(swapPos.x, swapPos.y, 24, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();

            drawBubble(swapPos.x, swapPos.y, nextBubble.color, 0.68, 1, nextBubble.special);

            ctx.save();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
            ctx.font = '700 10px Outfit, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('⇄ SWAP', swapPos.x, swapPos.y - 29);
            ctx.restore();
        }
    }

    // Floating score / combo popups
    floatingTexts.forEach(ft => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, ft.life);
        ctx.font = `900 ${ft.size}px Outfit, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.85)';
        ctx.shadowBlur = 8;
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
    });
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// ============================================================
// Boot Once
// ============================================================
syncControlUI();
loadLevel(0, false);
requestAnimationFrame(gameLoop);
