// ============================================================
// CUTIE RACERS - Baby Animal Racing Game
// ============================================================

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

// ============================================================
// GAME STATE
// ============================================================
let gameState = 'title'; // title, charSelect, carDesign, countdown, racing, results

// Safe modulo that always returns a positive result
function mod(n, m) { return ((n % m) + m) % m; }
let selectedCharacter = null;
let carDesign = { bodyColor: '#FF6B9D', wheelColor: '#333', accentColor: '#FFD700', bodyStyle: 0 };
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
    roadWidth: 2200,
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
        this.maxSpeed = character.speed * 25 + 100;
        this.accel = character.accel * 15;
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
            bodyStyle: Math.floor(Math.random() * 3)
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
            // Player controls
            if (keys['ArrowUp'] || keys['w'] || keys['W']) {
                this.speed += this.accel * dt * 60;
            } else {
                this.speed -= this.accel * 0.3 * dt * 60;
            }
            if (keys['ArrowDown'] || keys['s'] || keys['S']) {
                this.speed -= this.accel * 2 * dt * 60;
            }
            if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
                this.steerInput = -1;
            } else if (keys['ArrowRight'] || keys['d'] || keys['D']) {
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

        // Apply steering with curve influence
        const steerForce = this.steerInput * this.handling * 0.03 * dt * 60;
        const curveForce = seg.curve * this.speed * 0.0003 * dt * 60;
        this.x += steerForce - curveForce;

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
canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    mouseX = (touch.clientX - rect.left) * (W / rect.width);
    mouseY = (touch.clientY - rect.top) * (H / rect.height);
    mouseDown = true;
    mouseClicked = true;
});
canvas.addEventListener('touchend', e => { e.preventDefault(); mouseDown = false; });

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

    // Animated animals crossing
    const animalX = ((frameCount * 2) % (W + 200)) - 100;
    ctx.font = '40px serif';
    ctx.fillText('🐰', animalX, H - 70);
    ctx.fillText('🐱', animalX - 80, H - 65);
    ctx.fillText('🐤', animalX - 160, H - 72);
    ctx.fillText('🐶', animalX - 240, H - 68);
    ctx.fillText('🐼', animalX - 320, H - 70);
    ctx.fillText('🐧', animalX - 400, H - 66);

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
    ctx.fillText('Arrow Keys / WASD to drive  •  Space to use items', W / 2, 420);
    ctx.fillText('Throw food to lure other animals off course!', W / 2, 445);
}

// ============================================================
// CHARACTER SELECT SCREEN
// ============================================================
let charSelectHover = -1;

function drawCharSelect() {
    // Background
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#2d1b69');
    grad.addColorStop(1, '#1a0a2e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    drawStars();

    // Title
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 42px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Choose Your Racer!', W / 2, 55);

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

        // Emoji
        ctx.font = '52px serif';
        ctx.textAlign = 'center';
        const emojiY = y + 55;
        // Bounce if hovered
        const emojiBounce = (hovered || selected) ? Math.sin(frameCount * 0.1) * 5 : 0;
        ctx.fillText(char.emoji, x + cardW / 2, emojiY + emojiBounce);

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
        // Rounded kart
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
        // Sporty
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
        // Cute wagon
        ctx.beginPath();
        roundRect(-42, -25, 84, 40, 12, true);
    }

    // Accent stripe
    ctx.fillStyle = design.accentColor;
    ctx.fillRect(-30, -5, 60, 6);

    // Windshield
    ctx.fillStyle = 'rgba(135, 206, 235, 0.6)';
    ctx.beginPath();
    ctx.moveTo(-18, -28);
    ctx.quadraticCurveTo(-15, -38, 0, -40);
    ctx.quadraticCurveTo(15, -38, 18, -28);
    ctx.lineTo(12, -20);
    ctx.lineTo(-12, -20);
    ctx.closePath();
    ctx.fill();

    // Character emoji on car
    if (character) {
        ctx.font = '24px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(character.emoji, 0, -12);
    }

    // Headlights
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.ellipse(35, -12, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-35, -12, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function drawCarDesign() {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#1a0a2e');
    grad.addColorStop(1, '#2d1b69');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    drawStars();

    // Title
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 38px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Design Your Car!', W / 2, 45);

    // Car preview
    const char = characters[selectedCharacter];
    const previewX = W / 2;
    const previewY = 160;
    const wobble = Math.sin(frameCount * 0.03) * 2;

    // Preview background circle
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath();
    ctx.arc(previewX, previewY, 100, 0, Math.PI * 2);
    ctx.fill();

    drawCarPreview(previewX, previewY + wobble, 2, carDesign, char);

    // Color pickers
    const sectionY = 290;

    // Body Color
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 16px Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Body Color:', 60, sectionY);
    bodyColors.forEach((color, i) => {
        const cx = 60 + i * 42;
        const cy = sectionY + 20;
        const selected = carDesign.bodyColor === color;

        if (selected) {
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(cx + 14, cy + 14, 18, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx + 14, cy + 14, 14, 0, Math.PI * 2);
        ctx.fill();

        if (mouseClicked && Math.hypot(mouseX - (cx + 14), mouseY - (cy + 14)) < 16) {
            carDesign.bodyColor = color;
        }
    });

    // Wheel Color
    ctx.fillStyle = '#FFF';
    ctx.fillText('Wheel Color:', 60, sectionY + 65);
    wheelColors.forEach((color, i) => {
        const cx = 60 + i * 42;
        const cy = sectionY + 85;
        const selected = carDesign.wheelColor === color;

        if (selected) {
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(cx + 14, cy + 14, 18, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx + 14, cy + 14, 14, 0, Math.PI * 2);
        ctx.fill();

        // White outline for dark colors
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx + 14, cy + 14, 14, 0, Math.PI * 2);
        ctx.stroke();

        if (mouseClicked && Math.hypot(mouseX - (cx + 14), mouseY - (cy + 14)) < 16) {
            carDesign.wheelColor = color;
        }
    });

    // Accent Color
    ctx.fillStyle = '#FFF';
    ctx.fillText('Accent Color:', 60, sectionY + 130);
    accentColors.forEach((color, i) => {
        const cx = 60 + i * 42;
        const cy = sectionY + 150;
        const selected = carDesign.accentColor === color;

        if (selected) {
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(cx + 14, cy + 14, 18, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx + 14, cy + 14, 14, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx + 14, cy + 14, 14, 0, Math.PI * 2);
        ctx.stroke();

        if (mouseClicked && Math.hypot(mouseX - (cx + 14), mouseY - (cy + 14)) < 16) {
            carDesign.accentColor = color;
        }
    });

    // Body Style
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 16px Segoe UI, sans-serif';
    ctx.fillText('Body Style:', 500, sectionY);
    const styleNames = ['Rounded', 'Sporty', 'Wagon'];
    styleNames.forEach((name, i) => {
        const bx = 500;
        const by = sectionY + 15 + i * 52;
        const selected = carDesign.bodyStyle === i;
        const hovered = mouseX >= bx && mouseX <= bx + 160 && mouseY >= by && mouseY <= by + 44;

        ctx.fillStyle = selected ? '#FF69B4' : (hovered ? '#3a2a6a' : '#2a1a5a');
        roundRect(bx, by, 160, 44, 10, true);

        if (selected) {
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 2;
            roundRect(bx, by, 160, 44, 10, false);
        }

        // Mini car preview
        const tempDesign = { ...carDesign, bodyStyle: i };
        drawCarPreview(bx + 40, by + 22, 0.6, tempDesign, null);

        ctx.fillStyle = '#FFF';
        ctx.font = '14px Segoe UI, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(name, bx + 80, by + 26);

        if (hovered && mouseClicked) {
            carDesign.bodyStyle = i;
        }
    });

    // Character info
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 18px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${char.emoji} ${char.name}`, 730, sectionY + 10);
    ctx.font = '14px Segoe UI, sans-serif';
    ctx.fillStyle = '#BBB';
    ctx.fillText(char.desc, 730, sectionY + 35);
    ctx.fillStyle = '#FF69B4';
    ctx.fillText(`Weak to: ${char.weaknessName}`, 730, sectionY + 58);

    // Back button
    if (drawButton(50, H - 60, 150, 48, '← Back', '#9C27B0', '#7B1FA2')) {
        gameState = 'charSelect';
    }

    // Race button
    if (drawButton(W / 2 - 120, H - 60, 240, 48, '🏁  START RACE!', '#4CAF50', '#388E3C')) {
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
    const scale = 120 / z;
    return {
        x: W / 2 + (x - camX) * scale,
        y: H / 2 - (y - camY) * scale + H * 0.33,
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
    // Sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.65);
    skyGrad.addColorStop(0, '#87CEEB');
    skyGrad.addColorStop(0.6, '#E0F7FA');
    skyGrad.addColorStop(1, '#81C784');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    // Sun
    ctx.fillStyle = '#FFD54F';
    ctx.beginPath();
    ctx.arc(700, 60, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,213,79,0.2)';
    ctx.beginPath();
    ctx.arc(700, 60, 60, 0, Math.PI * 2);
    ctx.fill();

    // Clouds
    for (let i = 0; i < 5; i++) {
        const cx = ((i * 200 + frameCount * 0.3) % (W + 100)) - 50;
        const cy = 40 + i * 25;
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 40 + i * 5, 18, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx + 25, cy - 5, 30, 15, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Background hills
    ctx.fillStyle = '#66BB6A';
    ctx.beginPath();
    ctx.moveTo(0, H * 0.5);
    for (let i = 0; i <= W; i += 20) {
        ctx.lineTo(i, H * 0.45 + Math.sin(i * 0.008 + frameCount * 0.001) * 20 + Math.sin(i * 0.02) * 10);
    }
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.fill();

    // Render the track using pseudo-3D
    const playerSeg = Math.floor(player.position / track.segmentLength);
    const camHeight = 1500;
    const drawDist = 150;

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

        // Road markings (center line dashes)
        if (isAlt) {
            const centerX = (p1.x + p2.x) / 2;
            const centerNextX = (p3.x + p4.x) / 2;
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = Math.max(1, p1.scale * 2);
            ctx.beginPath();
            ctx.moveTo(centerX, p1.y);
            ctx.lineTo(centerNextX, p3.y);
            ctx.stroke();
        }

        // Item boxes
        if (seg.hasItem && n < 100) {
            const itemX = (p1.x + p2.x) / 2;
            const itemY = p1.y - 15 * p1.scale;
            const itemSize = Math.max(4, 18 * p1.scale);
            const bob = Math.sin(frameCount * 0.08 + segIdx) * 3 * p1.scale;

            // Question box
            ctx.fillStyle = '#FFD700';
            ctx.save();
            ctx.translate(itemX, itemY + bob);
            ctx.rotate(frameCount * 0.03);
            ctx.fillRect(-itemSize / 2, -itemSize / 2, itemSize, itemSize);
            ctx.fillStyle = '#FFA000';
            ctx.font = `bold ${Math.max(6, itemSize * 0.7)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('?', 0, 0);
            ctx.restore();
        }

        // Roadside decorations (trees, flowers)
        if (segIdx % 15 === 0 && n < 80) {
            const treeScale = p1.scale * 40;
            if (treeScale > 2) {
                // Left tree
                const treeX = p1.x - (p2.x - p1.x) * 0.3;
                const treeY = p1.y;
                ctx.fillStyle = '#5D4037';
                ctx.fillRect(treeX - treeScale * 0.15, treeY - treeScale * 2, treeScale * 0.3, treeScale * 2);
                ctx.fillStyle = '#388E3C';
                ctx.beginPath();
                ctx.arc(treeX, treeY - treeScale * 2.2, treeScale * 0.8, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#43A047';
                ctx.beginPath();
                ctx.arc(treeX + treeScale * 0.3, treeY - treeScale * 2.5, treeScale * 0.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        if (segIdx % 8 === 0 && n < 60) {
            const flowerScale = p1.scale * 20;
            if (flowerScale > 1) {
                const flowerX = p2.x + (p2.x - p1.x) * 0.15;
                const flowerY = p2.y;
                const flowerHue = (segIdx * 137) % 360;
                ctx.fillStyle = `hsl(${flowerHue}, 80%, 70%)`;
                ctx.beginPath();
                ctx.arc(flowerX, flowerY - flowerScale, flowerScale * 0.4, 0, Math.PI * 2);
                ctx.fill();
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
        const p = project(worldX, seg.y, z, camX, 1500, 0);

        const carScale = p.scale * 35;
        if (carScale < 2) return;

        // Draw kart
        ctx.save();
        ctx.translate(p.x, p.y);
        const s = carScale / 35;

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

        // Character emoji
        const emojiSize = Math.max(8, 20 * s);
        ctx.font = `${emojiSize}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(r.character.emoji, 0, -6 * s);

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

    // Draw player car at bottom center (always visible)
    const playerScreenY = H * 0.82;
    ctx.save();
    ctx.translate(W / 2, playerScreenY);

    // Steering tilt
    const tilt = player.steerInput * -0.15;
    ctx.rotate(tilt);

    if (player.spinTimer > 0) {
        ctx.rotate(player.spinTimer * 10);
    }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 20, 45, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    drawCarPreview(0, 0, 1.5, carDesign, characters[selectedCharacter]);

    // Boost flames
    if (player.boostTimer > 0) {
        ctx.fillStyle = '#FF6600';
        ctx.beginPath();
        ctx.moveTo(-8, 30);
        ctx.lineTo(0, 50 + Math.random() * 15);
        ctx.lineTo(8, 30);
        ctx.fill();
        ctx.fillStyle = '#FFFF00';
        ctx.beginPath();
        ctx.moveTo(-4, 30);
        ctx.lineTo(0, 40 + Math.random() * 10);
        ctx.lineTo(4, 30);
        ctx.fill();
    }

    if (player.lured) {
        ctx.font = '28px serif';
        ctx.textAlign = 'center';
        ctx.fillText('💫', 0, -50);
    }

    ctx.restore();

    // === HUD ===
    // Position indicator
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    roundRect(10, 10, 100, 55, 10, true);
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 36px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(getOrdinal(player.place), 60, 38);
    ctx.fillStyle = '#FFF';
    ctx.font = '14px Segoe UI, sans-serif';
    ctx.fillText(`of ${racers.length}`, 60, 56);

    // Lap counter
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    roundRect(W / 2 - 70, 10, 140, 40, 10, true);
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 20px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Lap ${Math.min(player.lap + 1, totalLaps)} / ${totalLaps}`, W / 2, 36);

    // Speed
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    roundRect(W - 140, 10, 130, 55, 10, true);
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 28px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    const displaySpeed = Math.floor(player.speed * 1.8);
    ctx.fillText(`${displaySpeed}`, W - 75, 38);
    ctx.font = '13px Segoe UI, sans-serif';
    ctx.fillText('km/h', W - 75, 56);

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

    // Item box
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

    // Mini map
    drawMiniMap();

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

function drawMiniMap() {
    const mapX = W - 130;
    const mapY = H - 130;
    const mapSize = 110;

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
