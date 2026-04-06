const BUBBLE_RADIUS = 20;
const BUBBLE_DIAMETER = BUBBLE_RADIUS * 2;
const ROW_HEIGHT = BUBBLE_RADIUS * Math.sqrt(3);
const BOARD_WIDTH = 12;
const BOARD_HEIGHT = 18;
const COLORS = ['#ff0055', '#00e5ff', '#a200ff', '#ffcc00', '#00ff66'];
const SPEED = 12; // Slowed down from 20 to 12

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const sfx = {
    shoot: () => {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
    },
    pop: () => {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    },
    gameOver: () => {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 1);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 1);
    },
    win: () => {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.setValueAtTime(600, audioCtx.currentTime + 0.2);
        osc.frequency.setValueAtTime(800, audioCtx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.8);
    }
};

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const gameOverEl = document.getElementById('game-over');
const finalScoreEl = document.getElementById('final-score-val');
const gameOverTitleEl = document.getElementById('game-over-title');
const restartBtn = document.getElementById('restart-btn');

let canvasWidth, canvasHeight;
let startX, startY;

let grid = [];
let score = 0;
let gameState = 'playing'; // playing, gameover, win
let currentBubble = null;
let nextBubble = null;
let bubblesToDrop = [];
let particles = [];
let aimAngle = -Math.PI / 2;
let isAiming = false;
let isFiring = false;
let mousePos = { x: 0, y: 0 };
let rect;

function init() {
    canvasWidth = BOARD_WIDTH * BUBBLE_DIAMETER + BUBBLE_RADIUS;
    canvasHeight = BOARD_HEIGHT * ROW_HEIGHT + BUBBLE_DIAMETER * 2 + 20; // Extra room at bottom
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;

    startX = canvasWidth / 2;
    startY = canvasHeight - BUBBLE_RADIUS - 10;

    grid = [];
    for (let r = 0; r < BOARD_HEIGHT; r++) {
        grid[r] = [];
        let cols = (r % 2 === 0) ? BOARD_WIDTH : BOARD_WIDTH - 1;
        for (let c = 0; c < cols; c++) {
            grid[r][c] = null;
        }
    }

    // Fill top 6 rows
    for (let r = 0; r < 6; r++) {
        let cols = (r % 2 === 0) ? BOARD_WIDTH : BOARD_WIDTH - 1;
        for (let c = 0; c < cols; c++) {
            grid[r][c] = {
                color: randomColor(),
                x: getGridX(r, c),
                y: getGridY(r),
                r: r,
                c: c,
                popAnim: 0,
                popping: false
            };
        }
    }

    score = 0;
    gameState = 'playing';
    isFiring = false;
    currentBubble = createShooterBubble();
    nextBubble = createShooterBubble();
    
    gameOverEl.classList.add('hidden');
    scoreEl.innerText = score;
    bubblesToDrop = [];
    particles = [];

    rect = canvas.getBoundingClientRect();
    window.addEventListener('resize', () => {
        rect = canvas.getBoundingClientRect();
    });

    requestAnimationFrame(gameLoop);
}

function randomColor() {
    return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function getGridX(r, c) {
    let offset = (r % 2 === 0) ? 0 : BUBBLE_RADIUS;
    return BUBBLE_RADIUS + c * BUBBLE_DIAMETER + offset;
}

function getGridY(r) {
    return BUBBLE_RADIUS + r * ROW_HEIGHT;
}

function createShooterBubble() {
    return {
        x: startX,
        y: startY,
        color: randomColor(),
        vx: 0,
        vy: 0
    };
}

// Input Handling
function updateAim(clientX, clientY) {
    if (gameState !== 'playing' || isFiring) return;
    
    let scaleX = canvas.width / rect.width;
    let scaleY = canvas.height / rect.height;
    
    let x = (clientX - rect.left) * scaleX;
    let y = (clientY - rect.top) * scaleY;
    
    mousePos = { x, y };
    
    let dx = x - startX;
    let dy = y - startY;
    aimAngle = Math.atan2(dy, dx);
    
    // Constrain angle to pointing upwards
    if (aimAngle > -0.1) aimAngle = -0.1;
    if (aimAngle < -Math.PI + 0.1) aimAngle = -Math.PI + 0.1;
}

function fireBubble() {
    if (gameState !== 'playing' || isFiring) return;
    isFiring = true;
    sfx.shoot();
    currentBubble.vx = Math.cos(aimAngle) * SPEED;
    currentBubble.vy = Math.sin(aimAngle) * SPEED;
}

window.addEventListener('mousemove', (e) => updateAim(e.clientX, e.clientY));
window.addEventListener('mousedown', (e) => {
    isAiming = true;
    updateAim(e.clientX, e.clientY);
});
window.addEventListener('mouseup', () => {
    if (isAiming) {
        fireBubble();
        isAiming = false;
    }
});

// Touch
window.addEventListener('touchstart', (e) => {
    e.preventDefault();
    isAiming = true;
    updateAim(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: false });
window.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if(isAiming) updateAim(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: false });
window.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (isAiming) {
        fireBubble();
        isAiming = false;
    }
}, { passive: false });

restartBtn.addEventListener('click', init);

// Logic
function getNeighbors(r, c) {
    const list = [];
    const isEven = r % 2 === 0;
    const directions = isEven ? 
        [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]] :
        [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]];
        
    for (let [dr, dc] of directions) {
        let nr = r + dr;
        let nc = c + dc;
        if (nr >= 0 && nr < BOARD_HEIGHT) {
            let cols = (nr % 2 === 0) ? BOARD_WIDTH : BOARD_WIDTH - 1;
            if (nc >= 0 && nc < cols) {
                list.push([nr, nc]);
            }
        }
    }
    return list;
}

function findMatches(startR, startC) {
    const targetColor = grid[startR][startC].color;
    const visited = new Set();
    const matches = [];
    const queue = [[startR, startC]];
    visited.add(`${startR},${startC}`);
    
    while(queue.length > 0) {
        let [r, c] = queue.shift();
        matches.push([r, c]);
        
        for (let [nr, nc] of getNeighbors(r, c)) {
            if (grid[nr][nc] !== null && !visited.has(`${nr},${nc}`) && grid[nr][nc].color === targetColor && !grid[nr][nc].popping) {
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
    
    for (let c = 0; c < BOARD_WIDTH; c++) {
        if (grid[0][c] !== null) {
            queue.push([0, c]);
            visited.add(`0,${c}`);
        }
    }
    
    while(queue.length > 0) {
        let [r, c] = queue.shift();
        for (let [nr, nc] of getNeighbors(r, c)) {
            if (grid[nr][nc] !== null && !visited.has(`${nr},${nc}`) && !grid[nr][nc].popping) {
                visited.add(`${nr},${nc}`);
                queue.push([nr, nc]);
            }
        }
    }
    
    for(let r = 0; r < BOARD_HEIGHT; r++) {
        let cols = (r % 2 === 0) ? BOARD_WIDTH : BOARD_WIDTH - 1;
        for(let c = 0; c < cols; c++) {
            if (grid[r][c] !== null && !visited.has(`${r},${c}`) && !grid[r][c].popping) {
                grid[r][c].falling = true;
                grid[r][c].vy = 0;
                grid[r][c].vx = (Math.random() - 0.5) * 4;
                bubblesToDrop.push(grid[r][c]);
                grid[r][c] = null;
            }
        }
    }
}

function snapBubble(x, y) {
    let bestR = 0, bestC = 0, minDist = Infinity;
    
    for(let nr = 0; nr < BOARD_HEIGHT; nr++) {
        let ncols = (nr % 2 === 0) ? BOARD_WIDTH : BOARD_WIDTH - 1;
        for(let nc = 0; nc < ncols; nc++) {
            if (grid[nr][nc] === null) {
                let rx = getGridX(nr, nc);
                let ry = getGridY(nr);
                let d = Math.hypot(x - rx, y - ry);
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

function createParticles(x, y, color) {
    for(let i = 0; i < 8; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            life: 1,
            color: color
        });
    }
}

function checkGameOver() {
    // Check if any bubble is in the bottom row
    for (let c = 0; c < grid[BOARD_HEIGHT-1].length; c++) {
        if (grid[BOARD_HEIGHT-1][c] !== null) {
            gameState = 'gameover';
            sfx.gameOver();
            gameOverTitleEl.innerText = "GAME OVER";
            gameOverTitleEl.style.background = "linear-gradient(to right, #ff007f, #7f00ff)";
            finalScoreEl.innerText = score;
            gameOverEl.classList.remove('hidden');
            return;
        }
    }
    
    // Check win condition
    let hasBubbles = false;
    for(let r = 0; r < BOARD_HEIGHT; r++) {
        for(let c = 0; c < grid[r].length; c++) {
            if (grid[r][c] !== null) {
                hasBubbles = true;
                break;
            }
        }
        if (hasBubbles) break;
    }
    if (!hasBubbles) {
        gameState = 'win';
        sfx.win();
        gameOverTitleEl.innerText = "YOU WIN!";
        gameOverTitleEl.style.background = "linear-gradient(to right, #00ff66, #00e5ff)";
        finalScoreEl.innerText = score;
        gameOverEl.classList.remove('hidden');
    }
}

function update() {
    if (gameState !== 'playing') return;

    if (isFiring) {
        currentBubble.x += currentBubble.vx;
        currentBubble.y += currentBubble.vy;

        // Bounce off walls
        if (currentBubble.x - BUBBLE_RADIUS < 0) {
            currentBubble.x = BUBBLE_RADIUS;
            currentBubble.vx *= -1;
        } else if (currentBubble.x + BUBBLE_RADIUS > canvasWidth) {
            currentBubble.x = canvasWidth - BUBBLE_RADIUS;
            currentBubble.vx *= -1;
        }

        // Collision with top or other bubbles
        let collision = false;
        
        if (currentBubble.y - BUBBLE_RADIUS <= 0) {
            collision = true;
        } else {
            for(let r = 0; r < BOARD_HEIGHT; r++) {
                let cols = (r % 2 === 0) ? BOARD_WIDTH : BOARD_WIDTH - 1;
                for(let c = 0; c < cols; c++) {
                    let b = grid[r][c];
                    if (b !== null && !b.popping) {
                        let d = Math.hypot(currentBubble.x - b.x, currentBubble.y - b.y);
                        if (d <= BUBBLE_DIAMETER - 2) {
                            collision = true;
                            break;
                        }
                    }
                }
                if (collision) break;
            }
        }

        if (collision) {
            let [r, c] = snapBubble(currentBubble.x, currentBubble.y);
            grid[r][c] = {
                color: currentBubble.color,
                x: getGridX(r, c),
                y: getGridY(r),
                r: r,
                c: c,
                popAnim: 0,
                popping: false
            };
            
            // Check matches
            let matches = findMatches(r, c);
            if (matches.length >= 3) {
                sfx.pop();
                matches.forEach(([mr, mc]) => {
                    grid[mr][mc].popping = true;
                });
                score += matches.length * 10;
                scoreEl.innerText = score;
            }

            dropFloatingBubbles();
            checkGameOver();

            // Setup next shot
            currentBubble = nextBubble;
            currentBubble.x = startX;
            currentBubble.y = startY;
            nextBubble = createShooterBubble();
            isFiring = false;
        }
    }

    // Update animations
    for(let r = 0; r < BOARD_HEIGHT; r++) {
        let cols = (r % 2 === 0) ? BOARD_WIDTH : BOARD_WIDTH - 1;
        for(let c = 0; c < cols; c++) {
            let b = grid[r][c];
            if (b && b.popping) {
                b.popAnim += 0.05; // Slowed down from 0.1
                if (b.popAnim >= 1) {
                    createParticles(b.x, b.y, b.color);
                    grid[r][c] = null;
                }
            }
        }
    }

    // Update drops
    for(let i = bubblesToDrop.length - 1; i >= 0; i--) {
        let b = bubblesToDrop[i];
        b.vy += 0.25; // gravity slowed down
        b.x += b.vx;
        b.y += b.vy;
        if (b.y > canvasHeight + BUBBLE_DIAMETER) {
            bubblesToDrop.splice(i, 1);
            score += 20;
            scoreEl.innerText = score;
        }
    }

    // Update particles
    for(let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.025; // Slowed down from 0.05
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function drawBubble(x, y, color, scale = 1, alpha = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    
    ctx.beginPath();
    ctx.arc(0, 0, BUBBLE_RADIUS, 0, Math.PI * 2);
    
    // Create gradient for 3D effect
    let gradient = ctx.createRadialGradient(-BUBBLE_RADIUS/3, -BUBBLE_RADIUS/3, BUBBLE_RADIUS/10, 0, 0, BUBBLE_RADIUS);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.2, color);
    gradient.addColorStop(1, '#000000');
    
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Inner glow
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.stroke();
    
    ctx.restore();
}

function drawAimLine() {
    if (gameState !== 'playing' || isFiring || !isAiming) return;

    ctx.save();
    ctx.setLineDash([10, 10]);

    // Project line toward tap location (full distance)
    let dist = Math.hypot(mousePos.x - startX, mousePos.y - startY);
    let endX = startX + Math.cos(aimAngle) * dist;
    let endY = startY + Math.sin(aimAngle) * dist;

    let grad = ctx.createLinearGradient(startX, startY, endX, endY);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.strokeStyle = grad;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    // Draw target circle at tap location
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(mousePos.x, mousePos.y, 8, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Small center dot
    ctx.beginPath();
    ctx.arc(mousePos.x, mousePos.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fill();

    ctx.restore();
}

function draw() {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Draw grid
    for(let r = 0; r < BOARD_HEIGHT; r++) {
        let cols = (r % 2 === 0) ? BOARD_WIDTH : BOARD_WIDTH - 1;
        for(let c = 0; c < cols; c++) {
            let b = grid[r][c];
            if (b) {
                if (b.popping) {
                    let scale = 1 + b.popAnim;
                    let alpha = 1 - b.popAnim;
                    drawBubble(b.x, b.y, b.color, scale, alpha);
                } else {
                    drawBubble(b.x, b.y, b.color);
                }
            }
        }
    }

    // Draw falling bubbles
    bubblesToDrop.forEach(b => drawBubble(b.x, b.y, b.color));

    // Draw Particles
    particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    });

    // Draw Shooter and Next Bubble
    if (gameState === 'playing') {
        drawAimLine();
        
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.arc(startX, startY, BUBBLE_RADIUS + 10, 0, Math.PI*2);
        ctx.fill();
        
        drawBubble(currentBubble.x, currentBubble.y, currentBubble.color);
        
        // Next bubble preview (small)
        drawBubble(startX + 60, startY, nextBubble.color, 0.5);
    }
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Start game
init();
