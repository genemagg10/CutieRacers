// ============================================================
// CUTIE RACERS - Baby Animal Racing Game
// ============================================================

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = 900;
const H = 600;
canvas.width = W;
canvas.height = H;

// Mobile detection & responsive scaling
const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || ('ontouchstart' in window && window.innerWidth < 1024);

function resizeCanvas() {
    const windowW = window.innerWidth;
    const windowH = window.innerHeight;
    const aspect = W / H;
    let displayW, displayH;
    if (windowW / windowH > aspect) {
        displayH = windowH;
        displayW = displayH * aspect;
    } else {
        displayW = windowW;
        displayH = displayW / aspect;
    }
    canvas.style.width = displayW + 'px';
    canvas.style.height = displayH + 'px';
}
window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 100));
resizeCanvas();

// ============================================================
// GAME STATE
// ============================================================
let gameState = 'title'; // title, charSelect, carDesign, countdown, racing, results

// Safe modulo that always returns a positive result
function mod(n, m) { return ((n % m) + m) % m; }
let selectedCharacter = null;
let carDesign = { bodyColor: '#FF6B9D', wheelColor: '#333', accentColor: '#FFD700', bodyStyle: 0, eyes: 0, mouth: 0, nose: 0, bodyShape: 0 };
let keys = {};
let mouseX = 0, mouseY = 0, mouseDown = false, mouseClicked = false;
let frameCount = 0;
let raceTime = 0;
let countdownTimer = 0;
let lapCount = 0;
let totalLaps = 3;
let raceFinished = false;
let finalPositions = [];
let sparkles = [];
let floatingTexts = [];

// ============================================================
// CHARACTERS
// ============================================================
const characters = [
    {
        name: 'Bun-Bun', animal: 'bunny', emoji: '🐰',
        color: '#FFB6C1', darkColor: '#E8909A', accentColor: '#FFF0F3',
        speed: 8, accel: 0.12, handling: 0.85,
        desc: 'Quick & nimble!',
        weakness: 'carrot', weaknessName: 'Carrots'
    },
    {
        name: 'Whiskers', animal: 'kitten', emoji: '🐱',
        color: '#FFD89B', darkColor: '#E8B86D', accentColor: '#FFF5E0',
        speed: 7, accel: 0.10, handling: 0.95,
        desc: 'Great handling!',
        weakness: 'fish', weaknessName: 'Fish'
    },
    {
        name: 'Puddles', animal: 'duckling', emoji: '🐤',
        color: '#FFEB3B', darkColor: '#D4C020', accentColor: '#FFFDE7',
        speed: 6, accel: 0.15, handling: 0.80,
        desc: 'Fast acceleration!',
        weakness: 'bread', weaknessName: 'Bread'
    },
    {
        name: 'Patches', animal: 'puppy', emoji: '🐶',
        color: '#A0522D', darkColor: '#7B3F22', accentColor: '#D2B48C',
        speed: 9, accel: 0.08, handling: 0.75,
        desc: 'Top speed!',
        weakness: 'bone', weaknessName: 'Bones'
    },
    {
        name: 'Bamboo', animal: 'panda', emoji: '🐼',
        color: '#E0E0E0', darkColor: '#333333', accentColor: '#FFFFFF',
        speed: 7, accel: 0.09, handling: 0.90,
        desc: 'Well balanced!',
        weakness: 'bamboo', weaknessName: 'Bamboo'
    },
    {
        name: 'Waddles', animal: 'penguin', emoji: '🐧',
        color: '#37474F', darkColor: '#1a1a2e', accentColor: '#ECEFF1',
        speed: 6, accel: 0.14, handling: 0.88,
        desc: 'Ice cold moves!',
        weakness: 'fish', weaknessName: 'Fish'
    }
];

// ============================================================
// TRACK DEFINITION - Oval-style Mario Kart track
// ============================================================
const track = {
    // Track is defined as a series of segments with curvature
    // Each segment: { length, curve } where curve is turning rate
    segments: [],
    roadWidth: 4000,
    segmentLength: 200,
    totalSegments: 0,
    colors: {
        road: '#555555',
        roadLight: '#666666',
        rumble: '#FF0000',
        rumbleLight: '#FFFFFF',
        grass: '#4CAF50',
        grassLight: '#66BB6A',
        sand: '#C8A96E'
    }
};

function buildTrack() {
    track.segments = [];
    // Build a fun circuit with curves and straights
    const layout = [
        // length, curve
        { len: 50, curve: 0 },       // start straight
        { len: 30, curve: 0.5 },     // gentle right
        { len: 20, curve: 0 },       // short straight
        { len: 40, curve: -0.8 },    // left turn
        { len: 30, curve: 0 },       // straight
        { len: 25, curve: 0.6 },     // right curve
        { len: 35, curve: -0.3 },    // gentle left
        { len: 40, curve: 0 },       // long straight
        { len: 30, curve: 0.9 },     // sharp right
        { len: 20, curve: 0 },       // straight
        { len: 35, curve: -0.7 },    // left curve
        { len: 25, curve: 0.4 },     // right curve
        { len: 30, curve: 0 },       // straight
        { len: 40, curve: -0.5 },    // left turn
        { len: 20, curve: 0.3 },     // gentle right
        { len: 30, curve: 0 },       // final straight
    ];

    // Add hills
    let idx = 0;
    for (const section of layout) {
        for (let i = 0; i < section.len; i++) {
            const hill = Math.sin(idx * 0.02) * 30 + Math.sin(idx * 0.05) * 15;
            track.segments.push({
                curve: section.curve,
                y: hill,
                index: idx,
                hasItem: false,
                itemType: null
            });
            idx++;
        }
    }

    track.totalSegments = track.segments.length;

    // Place item boxes every ~40 segments
    for (let i = 40; i < track.totalSegments; i += 35 + Math.floor(Math.random() * 20)) {
        track.segments[i].hasItem = true;
    }
}

// ============================================================
// RACER CLASS
// ============================================================
class Racer {
    constructor(character, isPlayer = false) {
        this.character = character;
        this.isPlayer = isPlayer;
        this.position = 0; // track position (segment index * segLen + offset)
        this.speed = 0;
        this.maxSpeed = character.speed * 200 + 800;
        this.accel = character.accel * 120;
        this.handling = character.handling;
        this.x = 0; // lateral position (-1 to 1)
        this.lane = 0;
        this.lap = 0;
        this.lapTimes = [];
        this.lastLapPos = 0;
        this.finished = false;
        this.finishTime = 0;
        this.item = null;
        this.lured = false;
        this.lureTimer = 0;
        this.lureTarget = 0;
        this.boostTimer = 0;
        this.spinTimer = 0;
        this.scale = 1;
        this.place = 0;
        this.steerInput = 0;
        this.totalDistance = 0;
        this.carDesign = isPlayer ? { ...carDesign } : {
            bodyColor: character.color,
            wheelColor: '#333',
            accentColor: character.darkColor,
            bodyStyle: Math.floor(Math.random() * 3),
            eyes: Math.floor(Math.random() * 4),
            mouth: Math.floor(Math.random() * 4),
            nose: Math.floor(Math.random() * 4),
            bodyShape: Math.floor(Math.random() * 4)
        };
        // AI properties
        this.aiSteer = 0;
        this.aiThrottle = 0.9 + Math.random() * 0.1;
        this.aiSkill = 0.6 + Math.random() * 0.35;
        this.aiLaneTarget = (Math.random() - 0.5) * 0.5;
        this.aiLaneChangeTimer = 0;
    }

    update(dt) {
        if (this.finished) return;

        if (this.spinTimer > 0) {
            this.spinTimer -= dt;
            this.speed *= 0.95;
            return;
        }

        if (this.lured) {
            this.lureTimer -= dt;
            // Move toward lure
            this.x += (this.lureTarget - this.x) * 0.05;
            this.speed *= 0.92;
            if (this.lureTimer <= 0) {
                this.lured = false;
            }
            return;
        }

        const segIdx = mod(Math.floor(this.position / track.segmentLength), track.totalSegments);
        const seg = track.segments[segIdx];

        if (this.isPlayer) {
            // Player controls (keyboard + touch)
            const gasPressed = keys['ArrowUp'] || keys['w'] || keys['W'] || touchButtons.gas.active;
            const leftPressed = keys['ArrowLeft'] || keys['a'] || keys['A'] || touchButtons.left.active;
            const rightPressed = keys['ArrowRight'] || keys['d'] || keys['D'] || touchButtons.right.active;

            if (gasPressed) {
                this.speed += this.accel * dt * 60;
            } else {
                // Gentle coast-down when not pressing gas
                this.speed *= (1 - 0.25 * dt);
            }
            if (leftPressed) {
                this.steerInput = -1;
            } else if (rightPressed) {
                this.steerInput = 1;
            } else {
                this.steerInput = 0;
            }
        } else {
            // AI driving
            this.aiLaneChangeTimer -= dt;
            if (this.aiLaneChangeTimer <= 0) {
                this.aiLaneTarget = (Math.random() - 0.5) * 0.6;
                this.aiLaneChangeTimer = 2 + Math.random() * 3;
            }

            // Steer towards target lane, also react to curves
            const targetX = this.aiLaneTarget - seg.curve * 0.3 * this.aiSkill;
            const steerDiff = targetX - this.x;
            this.steerInput = Math.max(-1, Math.min(1, steerDiff * 3 * this.aiSkill));

            // Throttle
            this.speed += this.accel * this.aiThrottle * dt * 60;

            // Slow down for sharp curves
            if (Math.abs(seg.curve) > 0.5) {
                this.speed *= (1 - Math.abs(seg.curve) * 0.003 * this.aiSkill);
            }

            // Use items
            if (this.item && Math.random() < 0.02) {
                this.useItem();
            }
        }

        // Apply boost
        if (this.boostTimer > 0) {
            this.boostTimer -= dt;
            this.speed = this.maxSpeed * 1.5;
        }

        // Clamp speed
        this.speed = Math.max(0, Math.min(this.speed, this.maxSpeed));

        // Apply steering (visual road curve naturally requires player to steer into turns)
        const steerForce = this.steerInput * this.handling * 0.08 * dt * 60;
        this.x += steerForce;

        // Off-road penalty
        if (Math.abs(this.x) > 0.8) {
            this.speed *= 0.97;
            this.x = Math.max(-1.2, Math.min(1.2, this.x));
        }
        if (Math.abs(this.x) > 1.2) {
            this.x = Math.sign(this.x) * 1.2;
        }

        // Move forward
        this.position += this.speed * dt;
        this.totalDistance += this.speed * dt;

        // Lap detection
        const trackLen = track.totalSegments * track.segmentLength;
        if (this.position >= trackLen) {
            this.position -= trackLen;
            this.lap++;
            if (this.isPlayer) {
                floatingTexts.push({ text: `Lap ${this.lap}/${totalLaps}!`, x: W / 2, y: H / 3, timer: 2, color: '#FFD700', size: 48 });
            }
            if (this.lap >= totalLaps) {
                this.finished = true;
                this.finishTime = raceTime;
                finalPositions.push(this);
                if (this.isPlayer) {
                    gameState = 'results';
                }
            }
        }

        // Pick up items
        if (seg.hasItem && !this.item) {
            const itemTypes = ['carrot', 'fish', 'bone', 'bread', 'bamboo', 'boost', 'banana', 'star'];
            this.item = itemTypes[Math.floor(Math.random() * itemTypes.length)];
            // Don't permanently remove - respawn after delay
            seg.hasItem = false;
            setTimeout(() => { seg.hasItem = true; }, 8000);
            if (this.isPlayer) {
                floatingTexts.push({ text: `Got: ${this.item}!`, x: W / 2, y: H / 2, timer: 1.5, color: '#FFF', size: 32 });
            }
        }
    }

    useItem() {
        if (!this.item) return;
        const item = this.item;
        this.item = null;

        switch (item) {
            case 'boost':
            case 'star':
                this.boostTimer = 2;
                if (this.isPlayer) {
                    floatingTexts.push({ text: 'BOOST!', x: W / 2, y: H / 2, timer: 1, color: '#FFD700', size: 48 });
                }
                break;
            case 'banana':
                // Drop behind - spin out nearest racer behind
                for (const r of racers) {
                    if (r === this) continue;
                    if (r.totalDistance < this.totalDistance && this.totalDistance - r.totalDistance < 3000) {
                        r.spinTimer = 1.5;
                        if (r.isPlayer) {
                            floatingTexts.push({ text: 'SLIP!', x: W / 2, y: H / 2, timer: 1, color: '#FF4444', size: 48 });
                        }
                        break;
                    }
                }
                break;
            default:
                // Food items - lure matching animals
                const lureMap = {
                    carrot: 'bunny', fish: 'kitten', bone: 'puppy',
                    bread: 'duckling', bamboo: 'panda'
                };
                // Also lure penguin with fish
                const animal = lureMap[item];
                if (animal) {
                    for (const r of racers) {
                        if (r === this) continue;
                        if (r.character.animal === animal || (item === 'fish' && r.character.animal === 'penguin')) {
                            r.lured = true;
                            r.lureTimer = 2.5;
                            r.lureTarget = (Math.random() - 0.5) * 1.5;
                            if (this.isPlayer) {
                                floatingTexts.push({ text: `${r.character.name} is lured!`, x: W / 2, y: H / 2 - 40, timer: 2, color: '#FF69B4', size: 36 });
                            }
                            if (r.isPlayer) {
                                floatingTexts.push({ text: `Can't resist the ${item}!`, x: W / 2, y: H / 2, timer: 2, color: '#FF6347', size: 36 });
                            }
                        }
                    }
                }
                break;
        }
    }
}

let racers = [];
let player = null;
let camera = { x: 0, y: 0, z: 0 };

// ============================================================
// INPUT
// ============================================================
document.addEventListener('keydown', e => {
    keys[e.key] = true;
    if (e.key === ' ' && gameState === 'racing' && player) {
        player.useItem();
    }
});
document.addEventListener('keyup', e => { keys[e.key] = false; });
canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mouseX = (e.clientX - rect.left) * (W / rect.width);
    mouseY = (e.clientY - rect.top) * (H / rect.height);
});
canvas.addEventListener('mousedown', () => { mouseDown = true; mouseClicked = true; });
canvas.addEventListener('mouseup', () => { mouseDown = false; });

// ============================================================
// TOUCH CONTROLS
// ============================================================
// Virtual button definitions (in canvas coordinates)
const touchButtons = {
    left:  { x: 20,  y: H - 160, w: 100, h: 100, active: false, label: '◀' },
    right: { x: 130, y: H - 160, w: 100, h: 100, active: false, label: '▶' },
    gas:   { x: W - 160, y: H - 200, w: 140, h: 140, active: false, label: 'GO' },
    item:  { x: W / 2 - 40, y: H - 145, w: 80, h: 65, active: false, label: '🎯' }
};
let activeTouches = {};

function canvasCoords(touch) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (touch.clientX - rect.left) * (W / rect.width),
        y: (touch.clientY - rect.top) * (H / rect.height)
    };
}

function hitTest(tx, ty, btn) {
    // Generous hit area for touch (20px padding)
    const pad = 20;
    return tx >= btn.x - pad && tx <= btn.x + btn.w + pad &&
           ty >= btn.y - pad && ty <= btn.y + btn.h + pad;
}

function updateTouchButtons() {
    // Reset all buttons
    for (const key in touchButtons) touchButtons[key].active = false;

    // Check each active touch against buttons
    for (const id in activeTouches) {
        const t = activeTouches[id];
        for (const key in touchButtons) {
            if (hitTest(t.x, t.y, touchButtons[key])) {
                touchButtons[key].active = true;
            }
        }
    }
}

canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    for (const touch of e.changedTouches) {
        const coords = canvasCoords(touch);
        activeTouches[touch.identifier] = coords;
    }
    // Use first touch for menu interactions
    const first = canvasCoords(e.changedTouches[0]);
    mouseX = first.x;
    mouseY = first.y;
    mouseDown = true;
    mouseClicked = true;

    updateTouchButtons();

    // Item use on touch
    if ((gameState === 'racing' || gameState === 'countdown') && isMobile && player) {
        if (touchButtons.item.active) {
            player.useItem();
        }
    }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const touch of e.changedTouches) {
        const coords = canvasCoords(touch);
        activeTouches[touch.identifier] = coords;
    }
    // Update mouse pos for menu hover states
    const first = canvasCoords(e.touches[0]);
    mouseX = first.x;
    mouseY = first.y;

    updateTouchButtons();
}, { passive: false });

canvas.addEventListener('touchend', e => {
    e.preventDefault();
    for (const touch of e.changedTouches) {
        delete activeTouches[touch.identifier];
    }
    if (e.touches.length === 0) {
        mouseDown = false;
        activeTouches = {};
    }
    updateTouchButtons();
}, { passive: false });

canvas.addEventListener('touchcancel', e => {
    e.preventDefault();
    for (const touch of e.changedTouches) {
        delete activeTouches[touch.identifier];
    }
    updateTouchButtons();
}, { passive: false });

// ============================================================
// UI HELPERS
// ============================================================
function drawButton(x, y, w, h, text, hoverColor = '#FF69B4', baseColor = '#E91E63') {
    const hovered = mouseX >= x && mouseX <= x + w && mouseY >= y && mouseY <= y + h;
    const color = hovered ? hoverColor : baseColor;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    roundRect(x + 3, y + 3, w, h, 12, true);

    // Button
    ctx.fillStyle = color;
    roundRect(x, y, w, h, 12, true);

    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    roundRect(x + 4, y + 2, w - 8, h * 0.4, 8, true);

    // Text
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 22px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, y + h / 2);

    return hovered && mouseClicked;
}

function roundRect(x, y, w, h, r, fill) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) ctx.fill();
    else ctx.stroke();
}

function drawStars(count) {
    if (frameCount % 2 === 0) {
        sparkles.push({
            x: Math.random() * W,
            y: Math.random() * H * 0.3,
            size: Math.random() * 3 + 1,
            life: 1,
            speed: Math.random() * 0.5 + 0.2
        });
    }
    for (let i = sparkles.length - 1; i >= 0; i--) {
        const s = sparkles[i];
        s.life -= 0.01 * s.speed;
        if (s.life <= 0) { sparkles.splice(i, 1); continue; }
        ctx.globalAlpha = s.life;
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        const size = s.size * s.life;
        // Draw star shape
        for (let j = 0; j < 5; j++) {
            const angle = (j * 4 * Math.PI / 5) - Math.PI / 2;
            const px = s.x + Math.cos(angle) * size;
            const py = s.y + Math.sin(angle) * size;
            if (j === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

// ============================================================
// TITLE SCREEN
// ============================================================
function drawTitle() {
    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#1a0a2e');
    grad.addColorStop(0.5, '#2d1b69');
    grad.addColorStop(1, '#1a0a2e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    drawStars();

    // Road at bottom
    ctx.fillStyle = '#444';
    ctx.fillRect(0, H - 100, W, 100);
    // Road lines
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 3;
    ctx.setLineDash([20, 15]);
    ctx.beginPath();
    ctx.moveTo(0, H - 50);
    ctx.lineTo(W, H - 50);
    ctx.stroke();
    ctx.setLineDash([]);

    // Animated kawaii animals crossing
    const animalX = ((frameCount * 2) % (W + 500)) - 100;
    const defaultD = { eyes: 0, mouth: 0, nose: 0, bodyShape: 0 };
    characters.forEach((c, i) => {
        const ax = animalX - i * 90;
        const bounce = Math.sin(frameCount * 0.12 + i) * 3;
        drawKawaiiAnimal(ax, H - 60 + bounce, 2.2, c, defaultD);
    });

    // Floating hearts & sparkles
    for (let i = 0; i < 8; i++) {
        const hx = (i * 123 + frameCount * 0.5) % W;
        const hy = (Math.sin(i * 1.7 + frameCount * 0.02) * 30) + 280 + i * 15;
        const ha = 0.3 + Math.sin(frameCount * 0.05 + i) * 0.2;
        ctx.fillStyle = `rgba(255,182,193,${ha})`;
        ctx.font = '14px serif';
        ctx.fillText(i % 3 === 0 ? '♥' : i % 3 === 1 ? '✦' : '♡', hx, hy);
    }

    // Title
    const bounce = Math.sin(frameCount * 0.05) * 8;
    ctx.save();
    ctx.translate(W / 2, 140 + bounce);

    // Title shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.font = 'bold 72px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Cutie Racers', 3, 3);

    // Title rainbow
    const gradient = ctx.createLinearGradient(-200, 0, 200, 0);
    const hue = (frameCount * 2) % 360;
    gradient.addColorStop(0, `hsl(${hue}, 100%, 70%)`);
    gradient.addColorStop(0.25, `hsl(${(hue + 60) % 360}, 100%, 70%)`);
    gradient.addColorStop(0.5, `hsl(${(hue + 120) % 360}, 100%, 70%)`);
    gradient.addColorStop(0.75, `hsl(${(hue + 180) % 360}, 100%, 70%)`);
    gradient.addColorStop(1, `hsl(${(hue + 240) % 360}, 100%, 70%)`);
    ctx.fillStyle = gradient;
    ctx.fillText('Cutie Racers', 0, 0);

    ctx.restore();

    // Subtitle
    ctx.fillStyle = '#FFB6C1';
    ctx.font = '24px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Baby Animal Racing Adventure! 🏁', W / 2, 200);

    // Start button
    if (drawButton(W / 2 - 120, 300, 240, 60, '🏁  START RACE!')) {
        gameState = 'charSelect';
    }

    // Instructions
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '16px Segoe UI, sans-serif';
    if (isMobile) {
        ctx.fillText('Tap GO to drive, arrows to steer, center to use items!', W / 2, 420);
    } else {
        ctx.fillText('↑ / W to go  •  ← → / A D to steer  •  Space for items', W / 2, 420);
    }
    ctx.fillText('Throw food to lure other animals off course!', W / 2, 445);
}

// ============================================================
// CHARACTER SELECT SCREEN
// ============================================================
let charSelectHover = -1;

function drawCharSelect() {
    // Pastel cute background
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#2d1b69');
    grad.addColorStop(0.5, '#3d2580');
    grad.addColorStop(1, '#1a0a2e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    drawStars();

    // Floating sparkles
    for (let i = 0; i < 12; i++) {
        const sx = (i * 83 + frameCount * 0.3) % W;
        const sy = (Math.sin(i * 2.3 + frameCount * 0.015) * 20) + 30 + (i * 47) % (H - 60);
        const sa = 0.2 + Math.sin(frameCount * 0.08 + i * 1.1) * 0.2;
        ctx.fillStyle = `rgba(255,220,255,${sa})`;
        ctx.font = '10px serif';
        ctx.textAlign = 'center';
        ctx.fillText(i % 2 === 0 ? '✦' : '♡', sx, sy);
    }

    // Title
    ctx.fillStyle = '#FFB6D9';
    ctx.font = 'bold 42px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Choose Your Cutie!', W / 2, 55);

    // Character cards
    const cols = 3;
    const cardW = 240;
    const cardH = 200;
    const gap = 25;
    const startX = (W - (cols * cardW + (cols - 1) * gap)) / 2;
    const startY = 85;

    characters.forEach((char, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = startX + col * (cardW + gap);
        const y = startY + row * (cardH + gap);

        const hovered = mouseX >= x && mouseX <= x + cardW && mouseY >= y && mouseY <= y + cardH;
        const selected = selectedCharacter === i;

        // Card shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        roundRect(x + 4, y + 4, cardW, cardH, 16, true);

        // Card background
        ctx.fillStyle = selected ? char.color : (hovered ? '#3a2a6a' : '#2a1a5a');
        roundRect(x, y, cardW, cardH, 16, true);

        // Border
        if (selected || hovered) {
            ctx.strokeStyle = selected ? '#FFD700' : 'rgba(255,255,255,0.3)';
            ctx.lineWidth = selected ? 3 : 1;
            roundRect(x, y, cardW, cardH, 16, false);
        }

        // Kawaii pixel character (replaces emoji)
        const charBounce = (hovered || selected) ? Math.sin(frameCount * 0.1) * 5 : 0;
        const defaultDesign = { eyes: 0, mouth: 0, nose: 0, bodyShape: 0 };
        drawKawaiiAnimal(x + cardW / 2, y + 45 + charBounce, 2.5, char, defaultDesign);

        // Name
        ctx.fillStyle = selected ? '#1a0a2e' : '#FFF';
        ctx.font = 'bold 20px Segoe UI, sans-serif';
        ctx.fillText(char.name, x + cardW / 2, y + 95);

        // Description
        ctx.fillStyle = selected ? '#1a0a2e' : '#BBB';
        ctx.font = '14px Segoe UI, sans-serif';
        ctx.fillText(char.desc, x + cardW / 2, y + 118);

        // Stats bars
        const statY = y + 135;
        const statLabels = ['SPD', 'ACC', 'HND'];
        const statValues = [char.speed / 10, char.accel / 0.16, char.handling];
        const statColors = ['#FF6B6B', '#FFD93D', '#6BCB77'];

        statLabels.forEach((label, si) => {
            const sy = statY + si * 18;
            ctx.fillStyle = selected ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.3)';
            ctx.font = '11px Segoe UI, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(label, x + 20, sy + 4);

            // Bar bg
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            roundRect(x + 55, sy - 5, 150, 12, 6, true);

            // Bar fill
            ctx.fillStyle = statColors[si];
            roundRect(x + 55, sy - 5, 150 * statValues[si], 12, 6, true);
        });

        // Weakness
        ctx.fillStyle = selected ? 'rgba(0,0,0,0.5)' : 'rgba(255,182,193,0.6)';
        ctx.font = '11px Segoe UI, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`Weak to: ${char.weaknessName}`, x + cardW / 2, y + cardH - 10);

        if (hovered && mouseClicked) {
            selectedCharacter = i;
        }
    });

    // Next button
    if (selectedCharacter !== null) {
        if (drawButton(W / 2 - 100, H - 60, 200, 48, 'Design Your Car →', '#4CAF50', '#388E3C')) {
            gameState = 'carDesign';
        }
    } else {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '18px Segoe UI, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Click a character to select!', W / 2, H - 36);
    }
}

// ============================================================
// CAR DESIGN SCREEN
// ============================================================
const bodyColors = ['#FF6B9D', '#4FC3F7', '#81C784', '#FFD54F', '#CE93D8', '#FF8A65', '#F44336', '#00BCD4'];
const wheelColors = ['#333333', '#555555', '#8D6E63', '#CFD8DC', '#FFD700'];
const accentColors = ['#FFD700', '#FF4081', '#00E5FF', '#76FF03', '#FFFFFF', '#FF6D00'];

// Pixel art helper - draw a filled pixel block
function px(x, y, size) {
    ctx.fillRect(Math.round(x), Math.round(y), size, size);
}

// Draw a kawaii pixel art animal character
function drawKawaiiAnimal(x, y, scale, character, design) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.imageSmoothingEnabled = false;

    const d = design || {};
    const eyeStyle = d.eyes || 0;
    const mouthStyle = d.mouth || 0;
    const cheekStyle = d.nose || 0;  // repurposed as cheek/blush style
    const bodyShape = d.bodyShape || 0;
    const p = 2; // pixel size

    const headColors = {
        'bunny': '#FFD4E0', 'kitten': '#FFE0C0', 'duckling': '#FFF3A0',
        'puppy': '#D4A574', 'panda': '#F8F8F8', 'penguin': '#2A2A3A'
    };
    const irisColors = {
        'bunny': '#CC3366', 'kitten': '#44AA55', 'duckling': '#332211',
        'puppy': '#553311', 'panda': '#333333', 'penguin': '#334455'
    };
    const irisHighlightColors = {
        'bunny': '#FF6699', 'kitten': '#66CC88', 'duckling': '#665544',
        'puppy': '#886644', 'panda': '#555555', 'penguin': '#556688'
    };
    const headColor = character ? headColors[character.animal] || '#FFD4E0' : '#FFD4E0';
    const darkColor = character ? character.darkColor || '#333' : '#333';
    const animal = character ? character.animal : 'bunny';

    // -- EARS (drawn behind head) --
    ctx.fillStyle = headColor;
    if (animal === 'bunny') {
        // Long floppy bunny ears - taller and wider
        ctx.fillStyle = headColor;
        for (let ey = -38; ey < -14; ey += p) {
            px(-10, ey, p); px(-8, ey, p); px(-6, ey, p);
            px(6, ey, p); px(8, ey, p); px(10, ey, p);
        }
        // Inner ear pink
        ctx.fillStyle = '#FFB0C4';
        for (let ey = -36; ey < -16; ey += p) { px(-8, ey, p); px(8, ey, p); }
    } else if (animal === 'kitten') {
        // Pointy cat ears - bigger triangles
        ctx.fillStyle = headColor;
        // Left ear
        px(-14, -16, p); px(-12, -16, p); px(-10, -16, p); px(-8, -16, p); px(-6, -16, p);
        px(-13, -18, p); px(-11, -18, p); px(-9, -18, p); px(-7, -18, p);
        px(-12, -20, p); px(-10, -20, p); px(-8, -20, p);
        px(-11, -22, p); px(-9, -22, p);
        px(-10, -24, p);
        // Right ear
        px(14, -16, p); px(12, -16, p); px(10, -16, p); px(8, -16, p); px(6, -16, p);
        px(13, -18, p); px(11, -18, p); px(9, -18, p); px(7, -18, p);
        px(12, -20, p); px(10, -20, p); px(8, -20, p);
        px(11, -22, p); px(9, -22, p);
        px(10, -24, p);
        // Inner ear pink
        ctx.fillStyle = '#FFB0C4';
        px(-11, -18, p); px(-9, -18, p); px(-10, -20, p);
        px(11, -18, p); px(9, -18, p); px(10, -20, p);
    } else if (animal === 'puppy') {
        // Floppy puppy ears - bigger
        ctx.fillStyle = darkColor;
        for (let ey = -12; ey < 8; ey += p) {
            px(-16, ey, p); px(-14, ey, p); px(-12, ey, p);
            px(12, ey, p); px(14, ey, p); px(16, ey, p);
        }
        // Rounded bottom
        px(-14, 8, p); px(14, 8, p);
    } else if (animal === 'panda') {
        // Round panda ears - bigger
        ctx.fillStyle = '#222';
        for (let ey = -18; ey <= -12; ey += p) {
            px(-12, ey, p); px(-10, ey, p); px(-8, ey, p);
            px(8, ey, p); px(10, ey, p); px(12, ey, p);
        }
    } else if (animal === 'penguin') {
        // No visible ears
    } else if (animal === 'duckling') {
        // Fluffy tuft on top - bigger
        ctx.fillStyle = '#FFD700';
        px(-2, -20, p); px(0, -22, p); px(2, -20, p);
        px(-4, -18, p); px(0, -20, p); px(4, -18, p);
    }

    // -- HEAD/BODY (big round chibi head = body) --
    ctx.fillStyle = headColor;
    if (bodyShape === 0) {
        // Round (default kawaii) - bigger
        for (let row = -14; row <= 14; row += p) {
            const t = (row + 14) / 28;
            const halfW = Math.round(Math.sin(t * Math.PI) * 16);
            for (let col = -halfW; col <= halfW; col += p) {
                px(col, row, p);
            }
        }
    } else if (bodyShape === 1) {
        // Tall/egg
        for (let row = -18; row <= 14; row += p) {
            const t = (row + 18) / 32;
            const halfW = Math.round(Math.sin(t * Math.PI) * 14);
            for (let col = -halfW; col <= halfW; col += p) {
                px(col, row, p);
            }
        }
    } else if (bodyShape === 2) {
        // Chubby square
        for (let row = -12; row <= 14; row += p) {
            const halfW = (row <= -10 || row >= 12) ? 12 : 15;
            for (let col = -halfW; col <= halfW; col += p) {
                px(col, row, p);
            }
        }
    } else {
        // Bean/blob
        for (let row = -14; row <= 16; row += p) {
            const t = (row + 14) / 30;
            const halfW = Math.round((Math.sin(t * Math.PI) * 14 + Math.sin(t * Math.PI * 2) * 3));
            for (let col = -halfW; col <= halfW; col += p) {
                px(col, row, p);
            }
        }
    }

    // Belly patch for some animals
    if (animal === 'penguin') {
        ctx.fillStyle = '#E8E8F0';
        for (let row = 0; row <= 12; row += p) {
            const halfW = row < 4 ? 8 : row < 8 ? 10 : 8;
            for (let col = -halfW; col <= halfW; col += p) { px(col, row, p); }
        }
    } else if (animal === 'panda') {
        ctx.fillStyle = '#FFF';
        for (let row = 0; row <= 10; row += p) {
            for (let col = -8; col <= 8; col += p) { px(col, row, p); }
        }
    }

    // -- TINY STUB LIMBS --
    ctx.fillStyle = headColor;
    if (animal === 'penguin') ctx.fillStyle = '#2A2A3A';
    // Left arm/paw
    px(-17, 4, p); px(-17, 6, p); px(-17, 8, p);
    // Right arm/paw
    px(17, 4, p); px(17, 6, p); px(17, 8, p);
    // Feet
    if (animal === 'duckling' || animal === 'penguin') {
        ctx.fillStyle = '#FF9800';
    } else {
        ctx.fillStyle = headColor;
    }
    px(-8, 16, p); px(-6, 16, p); px(-4, 16, p);
    px(4, 16, p); px(6, 16, p); px(8, 16, p);

    // Duck bill (drawn before eyes so it's behind the face)
    if (animal === 'duckling') {
        ctx.fillStyle = '#FF9800';
        px(-4, 4, p); px(-2, 4, p); px(0, 4, p); px(2, 4, p); px(4, 4, p);
        px(-3, 6, p); px(-1, 6, p); px(1, 6, p); px(3, 6, p);
    }

    // Panda eye patches (drawn before eyes)
    if (animal === 'panda') {
        ctx.fillStyle = '#333';
        // Left patch
        for (let ey = -10; ey <= 0; ey += p) {
            for (let ex = -14; ex <= -2; ex += p) { px(ex, ey, p); }
        }
        // Right patch
        for (let ey = -10; ey <= 0; ey += p) {
            for (let ex = 2; ex <= 14; ex += p) { px(ex, ey, p); }
        }
    }

    // ====== EYES (HUGE kawaii eyes - THE dominant feature) ======
    // Eyes span from roughly y=-12 to y=2 and x=-14 to x=14
    // Each eye is about 10px wide, 14px tall - nearly half the face
    const eyeL = -8;  // left eye center X
    const eyeR = 8;   // right eye center X
    const eyeY = -5;  // eye center Y

    if (eyeStyle === 0) {
        // === SPARKLE EYES (default) - huge with gradient iris + double highlight ===
        // White sclera base - oval shaped, very large
        ctx.fillStyle = '#FFF';
        [-1, 1].forEach(side => {
            const cx = side === -1 ? eyeL : eyeR;
            for (let ey = -7; ey <= 7; ey += p) {
                const t = (ey + 7) / 14;
                const halfW = Math.round(Math.sin(t * Math.PI) * 6);
                for (let ex = -halfW; ex <= halfW; ex += p) {
                    px(cx + ex, eyeY + ey, p);
                }
            }
        });

        // Dark iris/pupil - large circle filling most of the eye
        const irisColor = irisColors[animal] || '#443322';
        const irisHi = irisHighlightColors[animal] || '#775544';
        [-1, 1].forEach(side => {
            const cx = side === -1 ? eyeL : eyeR;
            // Main dark iris
            ctx.fillStyle = irisColor;
            for (let ey = -5; ey <= 5; ey += p) {
                const t = (ey + 5) / 10;
                const halfW = Math.round(Math.sin(t * Math.PI) * 5);
                for (let ex = -halfW; ex <= halfW; ex += p) {
                    px(cx + ex, eyeY + ey, p);
                }
            }
            // Lighter iris ring at top
            ctx.fillStyle = irisHi;
            for (let ex = -3; ex <= 3; ex += p) { px(cx + ex, eyeY - 4, p); }
            for (let ex = -4; ex <= 4; ex += p) { px(cx + ex, eyeY - 2, p); }

            // BIG white highlight (top-left, 3x3 block)
            ctx.fillStyle = '#FFF';
            px(cx - 3, eyeY - 4, p); px(cx - 1, eyeY - 4, p);
            px(cx - 3, eyeY - 2, p); px(cx - 1, eyeY - 2, p);
            px(cx - 3, eyeY, p);

            // Small white highlight (bottom-right, 1x1)
            px(cx + 3, eyeY + 2, p);
            px(cx + 3, eyeY + 4, p);
        });

    } else if (eyeStyle === 1) {
        // === HAPPY CLOSED EYES (^_^) - thick arcs ===
        ctx.fillStyle = '#222';
        [-1, 1].forEach(side => {
            const cx = side === -1 ? eyeL : eyeR;
            // Thick upward arc
            px(cx - 5, eyeY, p); px(cx - 3, eyeY - 2, p); px(cx - 1, eyeY - 4, p);
            px(cx + 1, eyeY - 4, p); px(cx + 3, eyeY - 2, p); px(cx + 5, eyeY, p);
            // Second row for thickness
            px(cx - 4, eyeY - 2, p); px(cx - 2, eyeY - 4, p);
            px(cx + 2, eyeY - 4, p); px(cx + 4, eyeY - 2, p);
        });

    } else if (eyeStyle === 2) {
        // === HEART EYES - large pixel hearts ===
        ctx.fillStyle = '#FF4081';
        [-1, 1].forEach(side => {
            const cx = side === -1 ? eyeL : eyeR;
            // Row -6: two bumps of heart
            px(cx - 4, eyeY - 6, p); px(cx - 2, eyeY - 6, p);
            px(cx + 2, eyeY - 6, p); px(cx + 4, eyeY - 6, p);
            // Row -4: full width
            px(cx - 5, eyeY - 4, p); px(cx - 3, eyeY - 4, p); px(cx - 1, eyeY - 4, p);
            px(cx + 1, eyeY - 4, p); px(cx + 3, eyeY - 4, p); px(cx + 5, eyeY - 4, p);
            // Row -2
            px(cx - 5, eyeY - 2, p); px(cx - 3, eyeY - 2, p); px(cx - 1, eyeY - 2, p);
            px(cx + 1, eyeY - 2, p); px(cx + 3, eyeY - 2, p); px(cx + 5, eyeY - 2, p);
            // Row 0: narrowing
            px(cx - 4, eyeY, p); px(cx - 2, eyeY, p); px(cx, eyeY, p);
            px(cx + 2, eyeY, p); px(cx + 4, eyeY, p);
            // Row 2
            px(cx - 3, eyeY + 2, p); px(cx - 1, eyeY + 2, p); px(cx + 1, eyeY + 2, p); px(cx + 3, eyeY + 2, p);
            // Row 4
            px(cx - 2, eyeY + 4, p); px(cx, eyeY + 4, p); px(cx + 2, eyeY + 4, p);
            // Row 6: point
            px(cx, eyeY + 6, p);

            // Highlight on heart
            ctx.fillStyle = '#FF80AA';
            px(cx - 3, eyeY - 4, p);
            ctx.fillStyle = '#FF4081';
        });

    } else {
        // === BIG ROUND EYES with single highlight ===
        [-1, 1].forEach(side => {
            const cx = side === -1 ? eyeL : eyeR;
            // Large black circle
            ctx.fillStyle = '#222';
            for (let ey = -6; ey <= 6; ey += p) {
                const t = (ey + 6) / 12;
                const halfW = Math.round(Math.sin(t * Math.PI) * 6);
                for (let ex = -halfW; ex <= halfW; ex += p) {
                    px(cx + ex, eyeY + ey, p);
                }
            }
            // Big white highlight
            ctx.fillStyle = '#FFF';
            px(cx - 3, eyeY - 4, p); px(cx - 1, eyeY - 4, p);
            px(cx - 3, eyeY - 2, p);
            // Small highlight
            px(cx + 2, eyeY + 2, p);
        });
    }

    // -- NOSE --
    if (animal === 'duckling') {
        // Bill already drawn
    } else if (animal === 'penguin') {
        ctx.fillStyle = '#FF9800';
        px(-2, 4, p); px(0, 4, p); px(2, 4, p);
        px(-1, 6, p); px(1, 6, p);
    } else if (animal === 'puppy' || animal === 'kitten') {
        ctx.fillStyle = animal === 'puppy' ? '#222' : '#FF8899';
        px(-2, 4, p); px(0, 4, p); px(2, 4, p);
        px(-1, 3, p); px(1, 3, p);
    } else {
        ctx.fillStyle = '#FF9999';
        px(-1, 4, p); px(1, 4, p);
    }

    // -- MOUTH --
    ctx.fillStyle = '#555';
    if (mouthStyle === 0) {
        // Tiny smile
        px(-3, 7, p); px(-1, 8, p); px(1, 8, p); px(3, 7, p);
    } else if (mouthStyle === 1) {
        // Open happy mouth - round "o"
        ctx.fillStyle = '#FF6B6B';
        px(-2, 7, p); px(0, 7, p); px(2, 7, p);
        px(-2, 9, p); px(0, 9, p); px(2, 9, p);
        ctx.fillStyle = '#FF9999';
        px(0, 8, p);
    } else if (mouthStyle === 2) {
        // Cat mouth w
        ctx.fillStyle = '#555';
        px(-4, 7, p); px(-2, 9, p); px(0, 7, p); px(2, 9, p); px(4, 7, p);
    } else {
        // Blep tongue
        ctx.fillStyle = '#555';
        px(-3, 7, p); px(-1, 8, p); px(1, 8, p); px(3, 7, p);
        ctx.fillStyle = '#FF7088';
        px(-1, 9, p); px(1, 9, p); px(0, 11, p);
    }

    // -- CHEEKS/BLUSH --
    if (cheekStyle === 0) {
        // Round rosy cheeks - bigger
        ctx.fillStyle = 'rgba(255,130,140,0.55)';
        for (let ey = 2; ey <= 6; ey += p) {
            px(-14, ey, p); px(-12, ey, p);
            px(12, ey, p); px(14, ey, p);
        }
    } else if (cheekStyle === 1) {
        // Heart blush
        ctx.fillStyle = 'rgba(255,100,130,0.5)';
        // Left heart
        px(-14, 1, p); px(-12, 1, p); px(-15, 3, p); px(-13, 3, p); px(-11, 3, p);
        px(-14, 5, p); px(-12, 5, p); px(-13, 7, p);
        // Right heart
        px(12, 1, p); px(14, 1, p); px(11, 3, p); px(13, 3, p); px(15, 3, p);
        px(12, 5, p); px(14, 5, p); px(13, 7, p);
    } else if (cheekStyle === 2) {
        // Star sparkle cheeks
        ctx.fillStyle = 'rgba(255,210,100,0.65)';
        // Left star
        px(-13, 2, p); px(-14, 4, p); px(-13, 4, p); px(-12, 4, p); px(-15, 4, p); px(-11, 4, p); px(-13, 6, p);
        // Right star
        px(13, 2, p); px(14, 4, p); px(13, 4, p); px(12, 4, p); px(15, 4, p); px(11, 4, p); px(13, 6, p);
    } else {
        // Line blush (anime // marks)
        ctx.fillStyle = 'rgba(255,130,140,0.55)';
        px(-14, 1, p); px(-13, 3, p); px(-12, 5, p);
        px(-12, 1, p); px(-11, 3, p); px(-10, 5, p);
        px(10, 1, p); px(11, 3, p); px(12, 5, p);
        px(12, 1, p); px(13, 3, p); px(14, 5, p);
    }

    // -- TAIL for some animals --
    if (animal === 'bunny') {
        ctx.fillStyle = '#FFF';
        px(-1, 14, p); px(0, 15, p); px(1, 14, p); px(0, 13, p);
    }

    // Whiskers for kitten
    if (animal === 'kitten') {
        ctx.fillStyle = '#AA9988';
        // Left whiskers
        px(-14, 3, p); px(-12, 4, p); px(-14, 5, p); px(-12, 6, p);
        // Right whiskers
        px(14, 3, p); px(12, 4, p); px(14, 5, p); px(12, 6, p);
    }

    ctx.imageSmoothingEnabled = true;
    ctx.restore();
}

function drawCarPreview(x, y, scale, design, character) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    const bodyStyle = design.bodyStyle || 0;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 25, 50, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wheels
    ctx.fillStyle = design.wheelColor;
    [[-38, 15], [38, 15], [-35, -15], [35, -15]].forEach(([wx, wy]) => {
        ctx.beginPath();
        ctx.ellipse(wx, wy, 10, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.ellipse(wx - 2, wy - 2, 4, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = design.wheelColor;
    });

    // Car body
    ctx.fillStyle = design.bodyColor;
    if (bodyStyle === 0) {
        ctx.beginPath();
        ctx.moveTo(-40, 10);
        ctx.quadraticCurveTo(-45, -5, -35, -20);
        ctx.quadraticCurveTo(-20, -30, 0, -32);
        ctx.quadraticCurveTo(20, -30, 35, -20);
        ctx.quadraticCurveTo(45, -5, 40, 10);
        ctx.quadraticCurveTo(30, 18, 0, 20);
        ctx.quadraticCurveTo(-30, 18, -40, 10);
        ctx.fill();
    } else if (bodyStyle === 1) {
        ctx.beginPath();
        ctx.moveTo(-45, 8);
        ctx.lineTo(-38, -18);
        ctx.lineTo(-15, -28);
        ctx.lineTo(15, -28);
        ctx.lineTo(42, -10);
        ctx.lineTo(45, 8);
        ctx.lineTo(30, 16);
        ctx.lineTo(-30, 16);
        ctx.closePath();
        ctx.fill();
    } else {
        ctx.beginPath();
        roundRect(-42, -25, 84, 40, 12, true);
    }

    // Accent stripe
    ctx.fillStyle = design.accentColor;
    ctx.fillRect(-30, -5, 60, 6);

    // Draw kawaii pixel character sitting on the car
    if (character) {
        drawKawaiiAnimal(0, -32, 1.1, character, design);
    }

    // Taillights
    ctx.fillStyle = '#FF3333';
    ctx.beginPath(); ctx.ellipse(32, 8, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-32, 8, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,50,50,0.3)';
    ctx.beginPath(); ctx.ellipse(32, 8, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-32, 8, 8, 5, 0, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
}

function drawCarDesign() {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#1a0a2e');
    grad.addColorStop(0.5, '#2d1860');
    grad.addColorStop(1, '#2d1b69');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    drawStars();

    // Floating sparkles
    for (let i = 0; i < 8; i++) {
        const sx = (i * 120 + frameCount * 0.4) % W;
        const sy = (Math.sin(i * 1.9 + frameCount * 0.02) * 15) + 20 + (i * 70) % (H - 40);
        ctx.fillStyle = `rgba(255,220,255,${0.15 + Math.sin(frameCount * 0.06 + i) * 0.15})`;
        ctx.font = '10px serif';
        ctx.textAlign = 'center';
        ctx.fillText(i % 2 === 0 ? '✦' : '♡', sx, sy);
    }

    // Title
    ctx.fillStyle = '#FFB6D9';
    ctx.font = 'bold 32px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✨ Design Your Cutie! ✨', W / 2, 35);

    // Car + character preview
    const char = characters[selectedCharacter];
    const previewX = W / 2;
    const previewY = 130;
    const wobble = Math.sin(frameCount * 0.03) * 2;

    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath();
    ctx.arc(previewX, previewY, 90, 0, Math.PI * 2);
    ctx.fill();

    drawCarPreview(previewX, previewY + wobble, 2.2, carDesign, char);

    // Character name
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 16px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${char.emoji} ${char.name} - ${char.desc}`, W / 2, previewY + 65);

    // --- LEFT COLUMN: Car options ---
    const colL = 30;
    const sectionY = 210;

    // Body Color
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 13px Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Body Color:', colL, sectionY);
    bodyColors.forEach((color, i) => {
        const cx = colL + i * 36;
        const cy = sectionY + 8;
        const selected = carDesign.bodyColor === color;
        if (selected) {
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cx + 12, cy + 12, 15, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx + 12, cy + 12, 11, 0, Math.PI * 2);
        ctx.fill();
        if (mouseClicked && Math.hypot(mouseX - (cx + 12), mouseY - (cy + 12)) < 13) {
            carDesign.bodyColor = color;
        }
    });

    // Wheel Color
    ctx.fillStyle = '#FFF';
    ctx.fillText('Wheels:', colL, sectionY + 48);
    wheelColors.forEach((color, i) => {
        const cx = colL + i * 36;
        const cy = sectionY + 56;
        const selected = carDesign.wheelColor === color;
        if (selected) {
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cx + 12, cy + 12, 15, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx + 12, cy + 12, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx + 12, cy + 12, 11, 0, Math.PI * 2);
        ctx.stroke();
        if (mouseClicked && Math.hypot(mouseX - (cx + 12), mouseY - (cy + 12)) < 13) {
            carDesign.wheelColor = color;
        }
    });

    // Accent Color
    ctx.fillStyle = '#FFF';
    ctx.fillText('Accent:', colL, sectionY + 96);
    accentColors.forEach((color, i) => {
        const cx = colL + i * 36;
        const cy = sectionY + 104;
        const selected = carDesign.accentColor === color;
        if (selected) {
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cx + 12, cy + 12, 15, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx + 12, cy + 12, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx + 12, cy + 12, 11, 0, Math.PI * 2);
        ctx.stroke();
        if (mouseClicked && Math.hypot(mouseX - (cx + 12), mouseY - (cy + 12)) < 13) {
            carDesign.accentColor = color;
        }
    });

    // Body Style
    ctx.fillStyle = '#FFF';
    ctx.fillText('Car Style:', colL, sectionY + 148);
    const styleNames = ['Rounded', 'Sporty', 'Wagon'];
    styleNames.forEach((name, i) => {
        const bx = colL + i * 100;
        const by = sectionY + 156;
        const selected = carDesign.bodyStyle === i;
        const hovered = mouseX >= bx && mouseX <= bx + 92 && mouseY >= by && mouseY <= by + 38;
        ctx.fillStyle = selected ? '#FF69B4' : (hovered ? '#3a2a6a' : '#2a1a5a');
        roundRect(bx, by, 92, 38, 8, true);
        if (selected) {
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 2;
            roundRect(bx, by, 92, 38, 8, false);
        }
        const tempDesign = { ...carDesign, bodyStyle: i };
        drawCarPreview(bx + 24, by + 19, 0.45, tempDesign, null);
        ctx.fillStyle = '#FFF';
        ctx.font = '12px Segoe UI, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(name, bx + 50, by + 23);
        if (hovered && mouseClicked) carDesign.bodyStyle = i;
    });

    // --- RIGHT COLUMN: Character appearance ---
    const colR = 480;

    // Helper to draw option row with preview mini-faces
    const drawOptionRow = (label, propName, options, startY) => {
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 13px Segoe UI, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(label, colR, startY);

        options.forEach((opt, i) => {
            const bx = colR + i * 100;
            const by = startY + 8;
            const bw = 92;
            const bh = 38;
            const selected = carDesign[propName] === i;
            const hovered = mouseX >= bx && mouseX <= bx + bw && mouseY >= by && mouseY <= by + bh;

            ctx.fillStyle = selected ? '#FF69B4' : (hovered ? '#3a2a6a' : '#2a1a5a');
            roundRect(bx, by, bw, bh, 8, true);
            if (selected) {
                ctx.strokeStyle = '#FFD700';
                ctx.lineWidth = 2;
                roundRect(bx, by, bw, bh, 8, false);
            }

            ctx.fillStyle = '#FFF';
            ctx.font = '11px Segoe UI, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(opt.icon, bx + 20, by + 24);
            ctx.fillText(opt.name, bx + 58, by + 23);

            if (hovered && mouseClicked) carDesign[propName] = i;
        });
    };

    // Eyes
    drawOptionRow('Eyes:', 'eyes', [
        { name: 'Sparkle', icon: '✨' },
        { name: 'Happy', icon: '^_^' },
        { name: 'Heart', icon: '💕' },
        { name: 'Round', icon: '●●' }
    ], sectionY);

    // Mouth
    drawOptionRow('Mouth:', 'mouth', [
        { name: 'Smile', icon: 'ω' },
        { name: 'Gasp', icon: 'o' },
        { name: 'Kitty', icon: 'w' },
        { name: 'Blep', icon: ':p' }
    ], sectionY + 56);

    // Blush/Cheeks
    drawOptionRow('Cheeks:', 'nose', [
        { name: 'Rosy', icon: '●' },
        { name: 'Hearts', icon: '♥' },
        { name: 'Stars', icon: '★' },
        { name: 'Lines', icon: '//' }
    ], sectionY + 112);

    // Body/Head Shape
    drawOptionRow('Shape:', 'bodyShape', [
        { name: 'Round', icon: '○' },
        { name: 'Egg', icon: '🥚' },
        { name: 'Chubby', icon: '■' },
        { name: 'Bean', icon: '~' }
    ], sectionY + 168);

    // Back button
    if (drawButton(50, H - 55, 150, 44, '← Back', '#9C27B0', '#7B1FA2')) {
        gameState = 'charSelect';
    }

    // Race button
    if (drawButton(W / 2 - 120, H - 55, 240, 44, '🏁  START RACE!', '#4CAF50', '#388E3C')) {
        startRace();
    }
}

// ============================================================
// START RACE
// ============================================================
function startRace() {
    buildTrack();
    racers = [];
    finalPositions = [];
    raceTime = 0;
    raceFinished = false;

    // Create player
    player = new Racer(characters[selectedCharacter], true);
    player.position = 0;
    player.x = 0;
    racers.push(player);

    // Create AI opponents (all other characters)
    const aiChars = characters.filter((_, i) => i !== selectedCharacter);
    aiChars.forEach((char, i) => {
        const ai = new Racer(char, false);
        const trackLen = track.totalSegments * track.segmentLength;
        ai.position = trackLen - (i + 1) * 300; // Stagger start behind player
        ai.x = (Math.random() - 0.5) * 0.4;
        racers.push(ai);
    });

    countdownTimer = 3.99;
    gameState = 'countdown';
}

// ============================================================
// PSEUDO-3D RENDERING
// ============================================================
function project(x, y, z, camX, camY, camZ) {
    const scale = 300 / z;
    return {
        x: W / 2 + (x - camX) * scale,
        y: H * 0.38 - (y - camY) * scale,
        scale: scale
    };
}

function drawRacing(dt) {
    if (gameState === 'countdown') {
        countdownTimer -= dt;
        if (countdownTimer <= 0) {
            gameState = 'racing';
        }
    }

    if (gameState === 'racing') {
        raceTime += dt;
        // Update all racers
        racers.forEach(r => r.update(dt));

        // Calculate positions
        const sorted = [...racers].sort((a, b) => {
            const aTotal = a.lap * track.totalSegments * track.segmentLength + a.position;
            const bTotal = b.lap * track.totalSegments * track.segmentLength + b.position;
            return bTotal - aTotal;
        });
        sorted.forEach((r, i) => r.place = i + 1);

        // Check if all racers finished
        if (racers.every(r => r.finished) && !raceFinished) {
            raceFinished = true;
            gameState = 'results';
        }
    }

    // === RENDER ===
    const horizonY = H * 0.38;

    // Sky gradient - vibrant retro sunset/tropical
    const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
    skyGrad.addColorStop(0, '#1a1a4e');
    skyGrad.addColorStop(0.2, '#3d5a9e');
    skyGrad.addColorStop(0.5, '#6dacdf');
    skyGrad.addColorStop(0.75, '#a8dce6');
    skyGrad.addColorStop(1, '#f0d8b8');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    // Large sun near horizon
    const sunX = W / 2;
    const sunY = horizonY - 30;
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 15, sunX, sunY, 100);
    sunGlow.addColorStop(0, 'rgba(255,240,180,1)');
    sunGlow.addColorStop(0.3, 'rgba(255,200,100,0.6)');
    sunGlow.addColorStop(0.6, 'rgba(255,150,80,0.2)');
    sunGlow.addColorStop(1, 'rgba(255,100,50,0)');
    ctx.fillStyle = sunGlow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 100, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFF4CC';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 28, 0, Math.PI * 2);
    ctx.fill();

    // Clouds (big fluffy retro clouds)
    const drawCloud = (cx, cy, scaleC) => {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 50 * scaleC, 18 * scaleC, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx - 30 * scaleC, cy + 4 * scaleC, 35 * scaleC, 14 * scaleC, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx + 35 * scaleC, cy + 2 * scaleC, 38 * scaleC, 16 * scaleC, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx + 10 * scaleC, cy - 12 * scaleC, 30 * scaleC, 14 * scaleC, 0, 0, Math.PI * 2);
        ctx.fill();
    };
    drawCloud(((frameCount * 0.15 + 100) % (W + 300)) - 150, 55, 1.3);
    drawCloud(((frameCount * 0.1 + 500) % (W + 300)) - 150, 35, 1.5);
    drawCloud(((frameCount * 0.2 + 300) % (W + 300)) - 150, 80, 1.0);
    drawCloud(((frameCount * 0.12 + 700) % (W + 300)) - 150, 100, 0.8);

    // ---- CITY SKYLINE (parallax behind-car) ----
    const skylineScroll = (player.position * 0.01) % W;

    // Far buildings (dark silhouettes)
    const drawBuilding = (bx, bw, bh, color) => {
        const by = horizonY;
        ctx.fillStyle = color;
        ctx.fillRect(bx, by - bh, bw, bh);
        // Windows
        ctx.fillStyle = 'rgba(255,255,200,0.4)';
        for (let wy = by - bh + 5; wy < by - 4; wy += 8) {
            for (let wx = bx + 3; wx < bx + bw - 3; wx += 7) {
                if (Math.random() > 0.3) ctx.fillRect(wx, wy, 3, 4);
            }
        }
    };

    // Skyline buildings - scrolling
    const buildings = [
        { x: 30, w: 35, h: 70 }, { x: 80, w: 25, h: 50 }, { x: 115, w: 40, h: 90 },
        { x: 170, w: 30, h: 55 }, { x: 215, w: 50, h: 110 }, { x: 280, w: 28, h: 45 },
        { x: 320, w: 35, h: 75 }, { x: 370, w: 45, h: 95 }, { x: 430, w: 30, h: 60 },
        { x: 475, w: 55, h: 120 }, { x: 545, w: 30, h: 50 }, { x: 590, w: 40, h: 80 },
        { x: 645, w: 35, h: 65 }, { x: 695, w: 50, h: 100 }, { x: 760, w: 28, h: 55 },
        { x: 800, w: 40, h: 85 }, { x: 855, w: 35, h: 70 }
    ];
    const buildColors = ['#2a3a5c', '#354870', '#1e2d4e', '#283a60', '#1c2844'];
    buildings.forEach((b, i) => {
        const scrolled = ((b.x - skylineScroll) % (W + 100) + W + 100) % (W + 100) - 50;
        drawBuilding(scrolled, b.w, b.h, buildColors[i % buildColors.length]);
    });

    // Bridge/overpass silhouette
    ctx.fillStyle = '#1e2844';
    ctx.fillRect(0, horizonY - 3, W, 6);

    // Palm trees along the horizon edges (closer, bigger, parallax)
    const drawPalmTree = (px, baseY, treeScale) => {
        ctx.save();
        ctx.translate(px, baseY);
        // Trunk
        ctx.strokeStyle = '#5D4037';
        ctx.lineWidth = 4 * treeScale;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(-5 * treeScale, -40 * treeScale, 3 * treeScale, -75 * treeScale);
        ctx.stroke();
        // Fronds
        const frondColor = '#2E7D32';
        for (let f = 0; f < 7; f++) {
            const angle = (f / 7) * Math.PI * 2 + Math.sin(frameCount * 0.02 + f) * 0.1;
            ctx.strokeStyle = frondColor;
            ctx.lineWidth = 2.5 * treeScale;
            ctx.beginPath();
            const tipX = Math.cos(angle) * 35 * treeScale + 3 * treeScale;
            const tipY = -75 * treeScale + Math.sin(angle) * 20 * treeScale;
            ctx.moveTo(3 * treeScale, -75 * treeScale);
            ctx.quadraticCurveTo(tipX * 0.6, tipY - 10 * treeScale, tipX, tipY);
            ctx.stroke();
            // Leaf fill
            ctx.fillStyle = frondColor;
            ctx.beginPath();
            ctx.ellipse(tipX * 0.7 + 3 * treeScale, tipY - 5 * treeScale + (-75 * treeScale * 0.3), 12 * treeScale, 4 * treeScale, angle, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    };

    // Palm trees at different depths (parallax scroll)
    const palmScroll = (player.position * 0.03) % 400;
    const palms = [
        { x: -40, scale: 1.3, side: 'L' }, { x: 50, scale: 0.8, side: 'L' },
        { x: W + 40, scale: 1.3, side: 'R' }, { x: W - 50, scale: 0.8, side: 'R' },
        { x: 160, scale: 0.5, side: 'L' }, { x: W - 160, scale: 0.5, side: 'R' }
    ];
    palms.forEach(p => {
        const px = p.x + (p.side === 'L' ? -1 : 1) * Math.sin(palmScroll * 0.01) * 10;
        drawPalmTree(px, horizonY + 5, p.scale);
    });

    // Water/ocean strip at horizon (tropical theme)
    ctx.fillStyle = 'rgba(100,180,220,0.3)';
    ctx.fillRect(0, horizonY + 3, W, 12);

    // Ground fill below horizon
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(0, horizonY + 10, W, H - horizonY - 10);

    // Render the track using pseudo-3D
    const playerSeg = Math.floor(player.position / track.segmentLength);
    const camHeight = 1200;
    const drawDist = 200;

    // Store projected segments for racer rendering
    const segProjections = [];

    for (let n = drawDist; n > 0; n--) {
        const segIdx = mod(playerSeg + n, track.totalSegments);
        const seg = track.segments[segIdx];
        const nextSegIdx = mod(segIdx + 1, track.totalSegments);
        const nextSeg = track.segments[nextSegIdx];

        const z = n * track.segmentLength - (player.position % track.segmentLength);
        const nextZ = z - track.segmentLength;

        if (z <= 0 || nextZ <= 0) continue;

        // Cumulative curve for x offset
        let cumulativeCurve = 0;
        for (let c = 0; c <= n; c++) {
            const ci = mod(playerSeg + c, track.totalSegments);
            cumulativeCurve += track.segments[ci].curve * 0.05;
        }

        const camX = player.x * track.roadWidth * 0.5;

        const p1 = project(-track.roadWidth / 2 + cumulativeCurve * z, seg.y, z, camX, camHeight, 0);
        const p2 = project(track.roadWidth / 2 + cumulativeCurve * z, seg.y, z, camX, camHeight, 0);
        const p3 = project(-track.roadWidth / 2 + cumulativeCurve * nextZ, nextSeg.y, nextZ, camX, camHeight, 0);
        const p4 = project(track.roadWidth / 2 + cumulativeCurve * nextZ, nextSeg.y, nextZ, camX, camHeight, 0);

        const pCenter = project(cumulativeCurve * z, seg.y, z, camX, camHeight, 0);

        segProjections[segIdx] = { center: pCenter, z: z, scale: p1.scale };

        // Ground/grass
        const isAlt = Math.floor(segIdx / 3) % 2 === 0;
        ctx.fillStyle = isAlt ? track.colors.grass : track.colors.grassLight;
        ctx.fillRect(0, p1.y, W, p3.y - p1.y + 2);

        // Road
        ctx.fillStyle = isAlt ? track.colors.road : track.colors.roadLight;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p4.x, p4.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.fill();

        // Rumble strips
        const rumbleW = (p2.x - p1.x) * 0.06;
        ctx.fillStyle = isAlt ? track.colors.rumble : track.colors.rumbleLight;
        // Left rumble
        ctx.fillRect(p1.x - rumbleW, p1.y, rumbleW * 2, Math.max(1, p3.y - p1.y + 1));
        // Right rumble
        ctx.fillRect(p2.x - rumbleW, p2.y, rumbleW * 2, Math.max(1, p4.y - p2.y + 1));

        // Road markings - center line and lane dividers
        if (isAlt) {
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = Math.max(1, p1.scale * 3);

            // Center line
            const centerX = (p1.x + p2.x) / 2;
            const centerNextX = (p3.x + p4.x) / 2;
            ctx.beginPath();
            ctx.moveTo(centerX, p1.y);
            ctx.lineTo(centerNextX, p3.y);
            ctx.stroke();

            // Left lane divider
            ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            ctx.lineWidth = Math.max(1, p1.scale * 1.5);
            const l1x = p1.x + (p2.x - p1.x) * 0.25;
            const l1nx = p3.x + (p4.x - p3.x) * 0.25;
            ctx.beginPath();
            ctx.moveTo(l1x, p1.y);
            ctx.lineTo(l1nx, p3.y);
            ctx.stroke();

            // Right lane divider
            const r1x = p1.x + (p2.x - p1.x) * 0.75;
            const r1nx = p3.x + (p4.x - p3.x) * 0.75;
            ctx.beginPath();
            ctx.moveTo(r1x, p1.y);
            ctx.lineTo(r1nx, p3.y);
            ctx.stroke();
        }

        // Item boxes
        if (seg.hasItem && n < 120) {
            const itemX = (p1.x + p2.x) / 2;
            const itemY = p1.y - 60 * p1.scale;
            const itemSize = Math.max(10, 80 * p1.scale);
            const bob = Math.sin(frameCount * 0.08 + segIdx) * 8 * p1.scale;

            // Glowing question box
            ctx.fillStyle = 'rgba(255,215,0,0.3)';
            ctx.save();
            ctx.translate(itemX, itemY + bob);
            ctx.beginPath();
            ctx.arc(0, 0, itemSize * 0.9, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#FFD700';
            ctx.rotate(frameCount * 0.03);
            ctx.fillRect(-itemSize / 2, -itemSize / 2, itemSize, itemSize);
            ctx.fillStyle = '#FFA000';
            ctx.font = `bold ${Math.max(8, itemSize * 0.65)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('?', 0, 0);
            ctx.restore();
        }

        // Roadside cherry blossom trees
        if (segIdx % 10 === 0 && n < 120) {
            const objScale = p1.scale * 280;
            if (objScale > 5) {
                const drawCherryTree = (treeX, treeY) => {
                    ctx.save();
                    ctx.translate(treeX, treeY);

                    // Trunk - dark brown, slightly curved
                    ctx.fillStyle = '#5D3A1A';
                    ctx.fillRect(-objScale * 0.06, -objScale * 2.2, objScale * 0.12, objScale * 2.2);
                    // Branch left
                    ctx.fillRect(-objScale * 0.5, -objScale * 1.8, objScale * 0.45, objScale * 0.05);
                    // Branch right
                    ctx.fillRect(objScale * 0.06, -objScale * 1.6, objScale * 0.4, objScale * 0.05);

                    // Cherry blossom canopy - multiple pink/white clusters
                    const blossomColors = ['#FFB7C5', '#FF9CAD', '#FFC0CB', '#FFD4DE', '#FFF0F3'];
                    const sway = Math.sin(frameCount * 0.02 + treeX * 0.01) * objScale * 0.05;

                    // Main canopy blobs
                    const blobs = [
                        [0, -2.4, 0.7], [-0.4, -2.1, 0.5], [0.35, -2.0, 0.55],
                        [-0.2, -2.6, 0.45], [0.25, -2.5, 0.4], [-0.5, -1.9, 0.35],
                        [0.5, -1.85, 0.3]
                    ];
                    blobs.forEach(([bx, by, br], i) => {
                        ctx.fillStyle = blossomColors[i % blossomColors.length];
                        ctx.beginPath();
                        ctx.arc(
                            bx * objScale + sway,
                            by * objScale,
                            br * objScale,
                            0, Math.PI * 2
                        );
                        ctx.fill();
                    });

                    // Darker pink spots for depth
                    ctx.fillStyle = 'rgba(255,120,150,0.3)';
                    for (let i = 0; i < 6; i++) {
                        const sx = (Math.sin(i * 2.5 + segIdx) * 0.3) * objScale + sway;
                        const sy = (-2.1 - Math.cos(i * 1.7) * 0.4) * objScale;
                        ctx.beginPath();
                        ctx.arc(sx, sy, objScale * 0.15, 0, Math.PI * 2);
                        ctx.fill();
                    }

                    // Falling petals
                    ctx.fillStyle = '#FFB7C5';
                    for (let i = 0; i < 3; i++) {
                        const petalT = ((frameCount * 0.01 + i * 0.33 + segIdx * 0.1) % 1);
                        const petalX = (Math.sin(petalT * 4 + i) * 0.5) * objScale + sway;
                        const petalY = (-2.4 + petalT * 3.0) * objScale;
                        const ps = objScale * 0.04;
                        ctx.fillRect(petalX - ps / 2, petalY - ps / 2, ps, ps);
                    }

                    ctx.restore();
                };

                // Left tree
                drawCherryTree(p1.x - (p2.x - p1.x) * 0.18, p1.y);
                // Right tree
                drawCherryTree(p2.x + (p2.x - p1.x) * 0.18, p1.y);
            }
        }

        // Street lamps
        if (segIdx % 20 === 5 && n < 100) {
            const lampScale = p1.scale * 220;
            if (lampScale > 4) {
                // Left lamp
                const lx = p1.x - (p2.x - p1.x) * 0.08;
                ctx.fillStyle = '#757575';
                ctx.fillRect(lx - lampScale * 0.03, p1.y - lampScale * 2, lampScale * 0.06, lampScale * 2);
                ctx.fillStyle = '#BDBDBD';
                ctx.fillRect(lx - lampScale * 0.15, p1.y - lampScale * 2, lampScale * 0.3, lampScale * 0.08);
                // Right lamp
                const rx = p2.x + (p2.x - p1.x) * 0.08;
                ctx.fillStyle = '#757575';
                ctx.fillRect(rx - lampScale * 0.03, p2.y - lampScale * 2, lampScale * 0.06, lampScale * 2);
                ctx.fillStyle = '#BDBDBD';
                ctx.fillRect(rx - lampScale * 0.15, p2.y - lampScale * 2, lampScale * 0.3, lampScale * 0.08);
            }
        }
    }

    // Render racers sorted by distance (far to near)
    const racerRender = racers.map(r => {
        const rSeg = mod(Math.floor(r.position / track.segmentLength), track.totalSegments);
        let relPos = r.position - player.position;
        if (relPos < -track.totalSegments * track.segmentLength / 2) relPos += track.totalSegments * track.segmentLength;
        if (relPos > track.totalSegments * track.segmentLength / 2) relPos -= track.totalSegments * track.segmentLength;
        return { racer: r, relPos, segIdx: rSeg };
    }).filter(r => r.relPos > -500 && r.relPos < drawDist * track.segmentLength)
      .sort((a, b) => b.relPos - a.relPos);

    racerRender.forEach(({ racer: r, relPos }) => {
        if (relPos <= 0) return;
        const z = relPos;
        const camX = player.x * track.roadWidth * 0.5;

        const segIdx = mod(Math.floor(r.position / track.segmentLength), track.totalSegments);
        let cumulativeCurve = 0;
        const playerSegIdx = Math.floor(player.position / track.segmentLength);
        const segDist = Math.floor(relPos / track.segmentLength);
        for (let c = 0; c <= segDist; c++) {
            const ci = mod(playerSegIdx + c, track.totalSegments);
            cumulativeCurve += track.segments[ci].curve * 0.05;
        }

        const worldX = r.x * track.roadWidth * 0.5 + cumulativeCurve * z;
        const seg = track.segments[segIdx];
        const p = project(worldX, seg.y, z, camX, camHeight, 0);

        const carScale = p.scale * 180;
        if (carScale < 3) return;

        // Draw kart
        ctx.save();
        ctx.translate(p.x, p.y);
        const s = carScale / 22;

        // Spin animation
        if (r.spinTimer > 0) {
            ctx.rotate(r.spinTimer * 10);
        }

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(0, 4 * s, 30 * s, 8 * s, 0, 0, Math.PI * 2);
        ctx.fill();

        // Simplified car body
        ctx.fillStyle = r.carDesign.bodyColor;
        roundRect(-20 * s, -16 * s, 40 * s, 24 * s, 6 * s, true);

        // Accent
        ctx.fillStyle = r.carDesign.accentColor;
        ctx.fillRect(-15 * s, -4 * s, 30 * s, 4 * s);

        // Wheels
        ctx.fillStyle = r.carDesign.wheelColor;
        [[-18, 6], [18, 6], [-16, -10], [16, -10]].forEach(([wx, wy]) => {
            ctx.fillRect((wx - 4) * s, (wy - 4) * s, 8 * s, 8 * s);
        });

        // Draw kawaii pixel character on the car (0,0 is already at p.x,p.y from translate)
        drawKawaiiAnimal(0, -18 * s, s * 0.85, r.character, r.carDesign);

        // Lure indicator
        if (r.lured) {
            ctx.fillStyle = 'rgba(255,105,180,0.8)';
            ctx.font = `bold ${Math.max(6, 12 * s)}px sans-serif`;
            ctx.fillText('💫', 0, -25 * s);
        }

        // Boost flames
        if (r.boostTimer > 0) {
            ctx.fillStyle = '#FF6600';
            ctx.beginPath();
            ctx.moveTo(-5 * s, 12 * s);
            ctx.lineTo(0, (20 + Math.random() * 10) * s);
            ctx.lineTo(5 * s, 12 * s);
            ctx.fill();
            ctx.fillStyle = '#FFFF00';
            ctx.beginPath();
            ctx.moveTo(-3 * s, 12 * s);
            ctx.lineTo(0, (16 + Math.random() * 6) * s);
            ctx.lineTo(3 * s, 12 * s);
            ctx.fill();
        }

        // Name tag
        if (carScale > 8 && !r.isPlayer) {
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            const nameWidth = ctx.measureText(r.character.name).width;
            roundRect(-nameWidth / 2 - 4, -30 * s, nameWidth + 8, 14, 4, true);
            ctx.fillStyle = '#FFF';
            ctx.font = `bold ${Math.max(8, 11)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(r.character.name, 0, -22 * s);
        }

        ctx.restore();
    });

    // Draw player car at bottom center (always visible) - classic behind-car view
    const playerScreenY = H * 0.82;
    ctx.save();
    ctx.translate(W / 2 + player.steerInput * -20, playerScreenY);

    const playerCarScale = 1.6;

    // Steering tilt
    const tilt = player.steerInput * -0.15;
    ctx.rotate(tilt);

    if (player.spinTimer > 0) {
        ctx.rotate(player.spinTimer * 10);
    }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 15 * playerCarScale, 35 * playerCarScale, 10 * playerCarScale, 0, 0, Math.PI * 2);
    ctx.fill();

    drawCarPreview(0, 0, playerCarScale, carDesign, characters[selectedCharacter]);

    // Boost flames
    if (player.boostTimer > 0) {
        ctx.fillStyle = '#FF6600';
        ctx.beginPath();
        ctx.moveTo(-5, 20 * playerCarScale);
        ctx.lineTo(0, (35 + Math.random() * 10) * playerCarScale);
        ctx.lineTo(5, 20 * playerCarScale);
        ctx.fill();
        ctx.fillStyle = '#FFFF00';
        ctx.beginPath();
        ctx.moveTo(-3, 20 * playerCarScale);
        ctx.lineTo(0, (28 + Math.random() * 7) * playerCarScale);
        ctx.lineTo(3, 20 * playerCarScale);
        ctx.fill();
    }

    if (player.lured) {
        ctx.font = '20px serif';
        ctx.textAlign = 'center';
        ctx.fillText('💫', 0, -35 * playerCarScale);
    }

    ctx.restore();

    // === SPEED EFFECTS ===
    const speedRatio = player.speed / player.maxSpeed;

    // Speed lines at edges when going fast
    if (speedRatio > 0.3) {
        const lineAlpha = (speedRatio - 0.3) * 0.7;
        const lineCount = Math.floor(speedRatio * 12);
        ctx.save();
        ctx.strokeStyle = `rgba(255,255,255,${lineAlpha})`;
        ctx.lineWidth = 2;
        for (let i = 0; i < lineCount; i++) {
            const seed = (frameCount * 3 + i * 137) % 100;
            const side = i % 2 === 0 ? 1 : -1;
            const baseX = side > 0 ? W - 10 - seed * 0.8 : 10 + seed * 0.8;
            const yStart = H * 0.3 + (seed * 4.7) % (H * 0.5);
            const lineLen = 30 + speedRatio * 60;
            ctx.globalAlpha = lineAlpha * (0.3 + (seed % 30) / 30 * 0.7);
            ctx.beginPath();
            ctx.moveTo(baseX, yStart);
            ctx.lineTo(baseX + side * -15, yStart + lineLen);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    // Vignette effect at high speeds
    if (speedRatio > 0.6) {
        const vigAlpha = (speedRatio - 0.6) * 0.3;
        const grad = ctx.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.7);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, `rgba(0,0,0,${vigAlpha})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
    }

    // Brake flash
    // (brake removed - single button controls)

    // === HUD ===
    // Race standings leaderboard
    const standings = [...racers].sort((a, b) => {
        const aTotal = a.lap * track.totalSegments * track.segmentLength + a.position;
        const bTotal = b.lap * track.totalSegments * track.segmentLength + b.position;
        return bTotal - aTotal;
    });
    const lbX = 10, lbY = 10;
    const lbRowH = 22;
    const lbH = 8 + standings.length * lbRowH + 4;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    roundRect(lbX, lbY, 130, lbH, 10, true);

    standings.forEach((r, i) => {
        const rowY = lbY + 8 + i * lbRowH;
        const isMe = r.isPlayer;

        // Highlight player row
        if (isMe) {
            ctx.fillStyle = 'rgba(255,215,0,0.2)';
            roundRect(lbX + 3, rowY - 2, 124, lbRowH - 2, 4, true);
        }

        // Place number
        const placeColors = ['#FFD700', '#C0C0C0', '#CD7F32', '#888', '#888', '#888'];
        ctx.fillStyle = placeColors[i] || '#888';
        ctx.font = `${isMe ? 'bold ' : ''}13px Segoe UI, sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(`${i + 1}.`, lbX + 8, rowY + 12);

        // Character emoji
        ctx.font = '13px serif';
        ctx.fillText(r.character.emoji, lbX + 26, rowY + 13);

        // Name
        ctx.fillStyle = isMe ? '#FFD700' : '#FFF';
        ctx.font = `${isMe ? 'bold ' : ''}12px Segoe UI, sans-serif`;
        ctx.fillText(isMe ? 'YOU' : r.character.name, lbX + 42, rowY + 12);
    });

    // Lap counter
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    roundRect(W / 2 - 70, 10, 140, 40, 10, true);
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 20px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Lap ${Math.min(player.lap + 1, totalLaps)} / ${totalLaps}`, W / 2, 36);

    // Speed (color-coded by speed ratio)
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    roundRect(W - 140, 10, 130, 55, 10, true);

    // Speed bar background
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    roundRect(W - 134, 52, 118, 8, 4, true);
    // Speed bar fill
    const spdColor = speedRatio < 0.4 ? '#66BB6A' : speedRatio < 0.7 ? '#FDD835' : speedRatio < 0.9 ? '#FF9800' : '#F44336';
    ctx.fillStyle = spdColor;
    roundRect(W - 134, 52, 118 * speedRatio, 8, 4, true);

    ctx.fillStyle = spdColor;
    ctx.font = 'bold 28px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    const displaySpeed = Math.floor(player.speed * 0.09);
    ctx.fillText(`${displaySpeed}`, W - 75, 38);
    ctx.fillStyle = '#CCC';
    ctx.font = '11px Segoe UI, sans-serif';
    ctx.fillText('km/h', W - 75, 48);

    // Time
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    roundRect(120, 10, 120, 35, 10, true);
    ctx.fillStyle = '#FFF';
    ctx.font = '18px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    const mins = Math.floor(raceTime / 60);
    const secs = Math.floor(raceTime % 60);
    const ms = Math.floor((raceTime % 1) * 100);
    ctx.fillText(`${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`, 180, 33);

    // Item box (only show keyboard-style HUD on desktop; mobile uses touch button)
    if (!isMobile) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        roundRect(W / 2 - 30, H - 70, 60, 60, 10, true);
        if (player.item) {
            const itemEmojis = {
                carrot: '🥕', fish: '🐟', bone: '🦴', bread: '🍞',
                bamboo: '🎋', boost: '⚡', banana: '🍌', star: '⭐'
            };
            ctx.font = '32px serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(itemEmojis[player.item] || '❓', W / 2, H - 40);

            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = '10px sans-serif';
            ctx.fillText('[SPACE]', W / 2, H - 15);
        } else {
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.font = '24px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('?', W / 2, H - 40);
        }
    }

    // Mini map (repositioned on mobile to avoid touch controls)
    drawMiniMap();

    // Mobile touch controls
    if (isMobile) {
        drawTouchControls();
    }

    // Countdown overlay
    if (gameState === 'countdown') {
        const num = Math.ceil(countdownTimer);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, W, H);

        const countScale = 1 + (countdownTimer % 1) * 0.5;
        ctx.save();
        ctx.translate(W / 2, H / 2);
        ctx.scale(countScale, countScale);
        ctx.fillStyle = num > 0 ? '#FFD700' : '#4CAF50';
        ctx.font = 'bold 120px Segoe UI, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(num > 0 ? num : 'GO!', 0, 0);
        ctx.restore();
    }

    // Floating texts
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const ft = floatingTexts[i];
        ft.timer -= dt;
        if (ft.timer <= 0) { floatingTexts.splice(i, 1); continue; }
        ctx.globalAlpha = Math.min(1, ft.timer);
        ctx.fillStyle = ft.color;
        ctx.font = `bold ${ft.size}px Segoe UI, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(ft.text, ft.x, ft.y - (1 - ft.timer) * 30);
        ctx.globalAlpha = 1;
    }
}

function drawTouchControls() {
    ctx.save();

    // Draw each virtual button
    function drawVButton(btn, icon, color, fontSize) {
        const alpha = btn.active ? 0.6 : 0.25;
        const radius = btn.w / 2;
        const cx = btn.x + btn.w / 2;
        const cy = btn.y + btn.h / 2;

        // Button background
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();

        // Border
        ctx.strokeStyle = `rgba(255,255,255,${alpha + 0.15})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();

        // Active glow
        if (btn.active) {
            ctx.fillStyle = `${color}44`;
            ctx.beginPath();
            ctx.arc(cx, cy, radius + 8, 0, Math.PI * 2);
            ctx.fill();
        }

        // Icon
        ctx.fillStyle = btn.active ? color : 'rgba(255,255,255,0.7)';
        ctx.font = `bold ${fontSize || 32}px Segoe UI, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(icon, cx, cy);
    }

    // Steering buttons (left side) - bigger
    drawVButton(touchButtons.left, '◀', '#4FC3F7', 36);
    drawVButton(touchButtons.right, '▶', '#4FC3F7', 36);

    // Big GO button (right side) - much larger, easy to hold
    drawVButton(touchButtons.gas, 'GO', '#66BB6A', 42);

    // Item button (center bottom) - draw as rounded rect
    const ib = touchButtons.item;
    const ibAlpha = ib.active ? 0.6 : 0.3;
    ctx.fillStyle = `rgba(255,255,255,${ibAlpha})`;
    roundRect(ib.x, ib.y, ib.w, ib.h, 14, true);
    ctx.strokeStyle = `rgba(255,255,255,${ibAlpha + 0.15})`;
    ctx.lineWidth = 2;
    roundRect(ib.x, ib.y, ib.w, ib.h, 14, false);

    if (player && player.item) {
        const itemEmojis = {
            carrot: '🥕', fish: '🐟', bone: '🦴', bread: '🍞',
            bamboo: '🎋', boost: '⚡', banana: '🍌', star: '⭐'
        };
        ctx.font = '26px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(itemEmojis[player.item] || '❓', ib.x + ib.w / 2, ib.y + ib.h / 2);
    } else {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '14px Segoe UI, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('ITEM', ib.x + ib.w / 2, ib.y + ib.h / 2);
    }

    ctx.restore();
}

function drawMiniMap() {
    // On mobile, move minimap up to avoid touch controls
    const mapX = isMobile ? W - 120 : W - 130;
    const mapY = isMobile ? 70 : H - 130;
    const mapSize = isMobile ? 85 : 110;

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.arc(mapX + mapSize / 2, mapY + mapSize / 2, mapSize / 2 + 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(mapX + mapSize / 2, mapY + mapSize / 2, mapSize / 2 + 5, 0, Math.PI * 2);
    ctx.stroke();

    // Draw track path on minimap
    const cx = mapX + mapSize / 2;
    const cy = mapY + mapSize / 2;
    const scale = mapSize / 2 * 0.8;

    // Calculate track path positions
    let tx = 0, ty = 0, angle = 0;
    const trackPoints = [];

    for (let i = 0; i < track.totalSegments; i++) {
        const seg = track.segments[i];
        angle += seg.curve * 0.02;
        tx += Math.cos(angle) * 0.3;
        ty += Math.sin(angle) * 0.3;
        trackPoints.push({ x: tx, y: ty, idx: i });
    }

    // Normalize to fit
    let minTx = Infinity, maxTx = -Infinity, minTy = Infinity, maxTy = -Infinity;
    trackPoints.forEach(p => {
        minTx = Math.min(minTx, p.x);
        maxTx = Math.max(maxTx, p.x);
        minTy = Math.min(minTy, p.y);
        maxTy = Math.max(maxTy, p.y);
    });
    const rangeX = maxTx - minTx || 1;
    const rangeY = maxTy - minTy || 1;
    const mapScale = Math.min(scale / rangeX, scale / rangeY) * 1.6;

    const offsetX = (minTx + maxTx) / 2;
    const offsetY = (minTy + maxTy) / 2;

    // Draw track line
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    trackPoints.forEach((p, i) => {
        const px = cx + (p.x - offsetX) * mapScale;
        const py = cy + (p.y - offsetY) * mapScale;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.stroke();

    // Draw racers on minimap
    racers.forEach(r => {
        const segIdx = mod(Math.floor(r.position / track.segmentLength), track.totalSegments);
        const tp = trackPoints[segIdx];
        if (!tp) return;
        const px = cx + (tp.x - offsetX) * mapScale;
        const py = cy + (tp.y - offsetY) * mapScale;

        ctx.fillStyle = r.isPlayer ? '#FF0' : r.character.color;
        ctx.beginPath();
        ctx.arc(px, py, r.isPlayer ? 5 : 3, 0, Math.PI * 2);
        ctx.fill();

        if (r.isPlayer) {
            ctx.strokeStyle = '#FFF';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(px, py, 5, 0, Math.PI * 2);
            ctx.stroke();
        }
    });
}

function getOrdinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ============================================================
// RESULTS SCREEN
// ============================================================
function drawResults() {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#1a0a2e');
    grad.addColorStop(0.5, '#2d1b69');
    grad.addColorStop(1, '#1a0a2e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    drawStars();

    const playerWon = player.place === 1;

    // Title
    ctx.fillStyle = playerWon ? '#FFD700' : '#FF6B6B';
    ctx.font = 'bold 52px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    const bounce = Math.sin(frameCount * 0.05) * 5;
    ctx.fillText(playerWon ? '🏆 YOU WIN! 🏆' : 'Race Complete!', W / 2, 70 + bounce);

    if (playerWon) {
        // Confetti
        for (let i = 0; i < 3; i++) {
            sparkles.push({
                x: Math.random() * W,
                y: -10,
                size: Math.random() * 5 + 2,
                life: 1,
                speed: Math.random() * 0.3 + 0.1
            });
        }
    }

    // Results table
    const sorted = [...racers].sort((a, b) => a.place - b.place);
    const tableY = 110;
    const rowH = 60;

    sorted.forEach((r, i) => {
        const y = tableY + i * rowH;
        const isPlayer = r.isPlayer;

        // Row background
        ctx.fillStyle = isPlayer ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.05)';
        roundRect(100, y, W - 200, rowH - 5, 10, true);

        if (isPlayer) {
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 2;
            roundRect(100, y, W - 200, rowH - 5, 10, false);
        }

        // Place
        const placeColors = ['#FFD700', '#C0C0C0', '#CD7F32', '#888', '#888', '#888'];
        ctx.fillStyle = placeColors[i] || '#888';
        ctx.font = 'bold 28px Segoe UI, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(getOrdinal(i + 1), 150, y + 35);

        // Character emoji & name
        ctx.font = '30px serif';
        ctx.fillText(r.character.emoji, 210, y + 35);
        ctx.fillStyle = isPlayer ? '#FFD700' : '#FFF';
        ctx.font = `${isPlayer ? 'bold ' : ''}20px Segoe UI, sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(r.character.name + (isPlayer ? ' (YOU)' : ''), 245, y + 35);

        // Time
        ctx.fillStyle = '#BBB';
        ctx.font = '18px Segoe UI, sans-serif';
        ctx.textAlign = 'right';
        if (r.finished) {
            const t = r.finishTime;
            const m = Math.floor(t / 60);
            const s = Math.floor(t % 60);
            const ms = Math.floor((t % 1) * 100);
            ctx.fillText(`${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`, W - 140, y + 35);
        } else {
            ctx.fillText('DNF', W - 140, y + 35);
        }
    });

    // Buttons
    const btnY = tableY + sorted.length * rowH + 20;
    if (drawButton(W / 2 - 230, btnY, 200, 50, '🏠  Main Menu', '#9C27B0', '#7B1FA2')) {
        resetGame();
        gameState = 'title';
    }
    if (drawButton(W / 2 + 30, btnY, 200, 50, '🔄  Race Again!', '#4CAF50', '#388E3C')) {
        startRace();
    }
}

function resetGame() {
    selectedCharacter = null;
    carDesign = { bodyColor: '#FF6B9D', wheelColor: '#333', accentColor: '#FFD700', bodyStyle: 0 };
    racers = [];
    player = null;
    raceTime = 0;
    finalPositions = [];
    raceFinished = false;
    floatingTexts = [];
}

// ============================================================
// MAIN GAME LOOP
// ============================================================
let lastTime = performance.now();

function gameLoop(time) {
    const dt = Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;
    frameCount++;

    mouseClicked = false;
    // Check if mouse was clicked this frame
    if (mouseDown && !prevMouseDown) mouseClicked = true;
    prevMouseDown = mouseDown;

    ctx.clearRect(0, 0, W, H);

    switch (gameState) {
        case 'title':
            drawTitle();
            break;
        case 'charSelect':
            drawCharSelect();
            break;
        case 'carDesign':
            drawCarDesign();
            break;
        case 'countdown':
        case 'racing':
            drawRacing(dt);
            break;
        case 'results':
            drawResults();
            break;
    }

    requestAnimationFrame(gameLoop);
}

let prevMouseDown = false;

// Start!
requestAnimationFrame(gameLoop);
