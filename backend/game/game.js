const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game state
const keys = {};
const mouse = { x: 0, y: 0, pressed: false };
const worldSize = 4000;
let score = 0;
let victory = false;

// Utility for collision detection (AABB)
function rectIntersect(x1, y1, w1, h1, x2, y2, w2, h2) {
    return x2 < x1 + w1 && x2 + w2 > x1 && y2 < y1 + h1 && y2 + h2 > y1;
}

// Line of sight utility
function hasLineOfSight(x1, y1, x2, y2, obstacles) {
    const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    const steps = Math.floor(dist / 15);
    for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const cx = x1 + (x2 - x1) * t;
        const cy = y1 + (y2 - y1) * t;
        for (const obs of obstacles) {
            if (!obs.active || obs.type === 'bush' || (obs.type === 'door' && obs.isOpen)) continue;
            if (cx > obs.x && cx < obs.x + obs.width && cy > obs.y && cy < obs.y + obs.height) {
                return false;
            }
        }
    }
    return true;
}

// Static obstacle class
class Obstacle {
    constructor(x, y, width, height, color = '#7f8c8d', type = 'wall', health = Infinity, loot = []) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
        this.type = type; // 'wall', 'furniture', 'bush', 'door'
        this.health = health;
        this.maxHealth = health;
        this.active = true;
        this.loot = loot; // Array of item configs to drop
        this.isOpen = false; // For doors
    }

    takeDamage(amount) {
        if (this.health === Infinity) return;
        this.health -= amount;
        if (this.health <= 0) {
            this.health = 0;
            this.active = false;
        }
    }

    toggle() {
        if (this.type === 'door' && this.active) {
            this.isOpen = !this.isOpen;
        }
    }

    draw(camera) {
        if (!this.active) return;
        
        if (this.type === 'door' && this.isOpen) {
            ctx.globalAlpha = 0.3;
        }

        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - camera.x, this.y - camera.y, this.width, this.height);
        
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x - camera.x, this.y - camera.y, this.width, this.height);
        
        if (this.type === 'furniture') {
            ctx.fillStyle = 'rgba(0,0,0,0.1)';
            ctx.fillRect(this.x - camera.x + 5, this.y - camera.y + 5, this.width - 10, this.height - 10);
        }

        if (this.type === 'door') {
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(this.x - camera.x + 2, this.y - camera.y + 2, this.width - 4, this.height - 4);
            ctx.strokeStyle = '#34495e';
            ctx.lineWidth = 4;
            
            if (!this.isOpen) {
                ctx.beginPath();
                ctx.moveTo(this.x - camera.x, this.y - camera.y);
                ctx.lineTo(this.x + this.width - camera.x, this.y + this.height - camera.y);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(this.x + this.width - camera.x, this.y - camera.y);
                ctx.lineTo(this.x - camera.x, this.y + this.height - camera.y);
                ctx.stroke();
            } else {
                ctx.fillStyle = '#2c3e50';
                ctx.fillRect(this.x - camera.x, this.y - camera.y, 10, 10);
            }
        }

        ctx.globalAlpha = 1.0;

        if (this.maxHealth !== Infinity && this.health < this.maxHealth) {
            const barWidth = this.width;
            const barHeight = 4;
            const healthPercent = this.health / this.maxHealth;
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(this.x - camera.x, this.y - camera.y - 10, barWidth, barHeight);
            ctx.fillStyle = '#2ecc71';
            ctx.fillRect(this.x - camera.x, this.y - camera.y - 10, barWidth * healthPercent, barHeight);
        }
    }
}

// Item/Weapon Data
const ITEM_TYPES = {
    PISTOL: {
        name: 'Pistol',
        color: '#95a5a6',
        length: 25,
        width: 10,
        fireRate: 400, // ms
        bulletSpeed: 15,
        bulletColor: '#f1c40f',
        bulletDamage: 10,
        type: 'weapon'
    },
    RIFLE: {
        name: 'Assault Rifle',
        color: '#2c3e50',
        length: 45,
        width: 12,
        fireRate: 150,
        bulletSpeed: 20,
        bulletColor: '#e67e22',
        bulletDamage: 15,
        type: 'weapon'
    },
    SNIPER: {
        name: 'Sniper',
        color: '#34495e',
        length: 70,
        width: 8,
        fireRate: 1200,
        bulletSpeed: 35,
        bulletColor: '#e74c3c',
        bulletDamage: 50,
        type: 'weapon'
    },
    SMG: {
        name: 'SMG',
        color: '#7f8c8d',
        length: 30,
        width: 14,
        fireRate: 80,
        bulletSpeed: 12,
        bulletColor: '#f1c40f',
        bulletDamage: 5,
        type: 'weapon'
    },
    AMMO: {
        name: 'Ammunition',
        color: '#f1c40f',
        type: 'ammo'
    }
};

const WEAPON_TYPES = {
    PISTOL: ITEM_TYPES.PISTOL,
    RIFLE: ITEM_TYPES.RIFLE,
    SNIPER: ITEM_TYPES.SNIPER,
    SMG: ITEM_TYPES.SMG
};

class Item {
    constructor(x, y, config) {
        this.x = x;
        this.y = y;
        this.name = config.name;
        this.color = config.color;
        this.config = config;
        this.radius = 15;
    }

    draw(camera) {
        ctx.beginPath();
        ctx.arc(this.x - camera.x, this.y - camera.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.closePath();

        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.name, this.x - camera.x, this.y - camera.y - 20);
    }
}

class Projectile {
    constructor(x, y, angle, speed, color, damage, owner) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.speed = speed;
        this.color = color;
        this.damage = damage;
        this.owner = owner; // Reference to who shot it
        this.radius = 4;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.active = true;
    }

    update(obstacles) {
        this.x += this.vx;
        this.y += this.vy;

        for (const obs of obstacles) {
            if (!obs.active || obs.type === 'bush' || (obs.type === 'door' && obs.isOpen)) continue;
            if (this.x > obs.x && this.x < obs.x + obs.width &&
                this.y > obs.y && this.y < obs.y + obs.height) {
                obs.takeDamage(this.damage);
                this.active = false;
                return;
            }
        }

        if (this.x < 0 || this.x > worldSize || this.y < 0 || this.y > worldSize) {
            this.active = false;
        }
    }

    draw(camera) {
        ctx.save();
        ctx.translate(this.x - camera.x, this.y - camera.y);
        ctx.rotate(this.angle);
        ctx.beginPath();
        ctx.fillStyle = this.color;
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.5;
        ctx.fillRect(-10, -this.radius/2, 10, this.radius);
        ctx.restore();
    }
}

class Enemy {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 22;
        this.color = '#e74c3c';
        this.speed = 2.5 + Math.random();
        this.maxHealth = 40;
        this.health = this.maxHealth;
        this.active = true;
        this.angle = 0;
        
        // AI State
        this.state = 'WANDER';
        this.wanderAngle = Math.random() * Math.PI * 2;
        this.wanderTime = 0;
        this.target = null;
        this.detectionRange = 1000;
        this.attackRange = 60;
        this.lastAttack = 0;
        this.attackCooldown = 800;
        this.strafeDirection = Math.random() < 0.5 ? 1 : -1;
        this.strafeTimer = 0;
    }

    findTarget(player, enemies) {
        let nearest = null;
        let minDist = this.detectionRange;

        // Check player
        if (player.active) {
            const distToPlayer = Math.sqrt((player.x - this.x) ** 2 + (player.y - this.y) ** 2);
            if (distToPlayer < minDist && hasLineOfSight(this.x, this.y, player.x, player.y, allObstacles)) {
                minDist = distToPlayer;
                nearest = player;
            }
        }

        // Check other enemies
        for (const other of enemies) {
            if (other === this || !other.active) continue;
            const dist = Math.sqrt((other.x - this.x) ** 2 + (other.y - this.y) ** 2);
            if (dist < minDist && hasLineOfSight(this.x, this.y, other.x, other.y, allObstacles)) {
                minDist = dist;
                nearest = other;
            }
        }

        this.target = nearest;
        if (nearest) this.state = 'CHASE';
        else if (this.state === 'CHASE') this.state = 'WANDER';
    }

    update(player, enemies, obstacles) {
        if (!this.active) return;
        this.findTarget(player, enemies);

        let vx = 0;
        let vy = 0;

        if (this.state === 'WANDER') {
            this.wanderTime--;
            if (this.wanderTime <= 0) {
                this.wanderAngle = Math.random() * Math.PI * 2;
                this.wanderTime = 60 + Math.random() * 120;
            }
            vx = Math.cos(this.wanderAngle) * (this.speed * 0.5);
            vy = Math.sin(this.wanderAngle) * (this.speed * 0.5);
            this.angle = this.wanderAngle;
        } else if (this.state === 'CHASE' && this.target) {
            const dx = this.target.x - this.x;
            const dy = this.target.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            this.angle = Math.atan2(dy, dx);

            if (dist > this.attackRange * 0.8) {
                // Movement with strafing
                this.strafeTimer--;
                if (this.strafeTimer <= 0) {
                    this.strafeDirection *= -1;
                    this.strafeTimer = 30 + Math.random() * 60;
                }
                
                const moveAngle = this.angle + (Math.PI / 4) * this.strafeDirection;
                vx = Math.cos(moveAngle) * this.speed;
                vy = Math.sin(moveAngle) * this.speed;
            }

            // Attack logic
            const now = Date.now();
            if (dist < this.attackRange && now - this.lastAttack > this.attackCooldown) {
                this.target.health -= 10;
                this.lastAttack = now;
            }
        }

        // Apply movement with collision
        const nextX = this.x + vx;
        const nextY = this.y + vy;
        
        let canMoveX = true;
        for (const obs of obstacles) {
            if (!obs.active || obs.type === 'bush' || (obs.type === 'door' && obs.isOpen)) continue;
            if (rectIntersect(nextX - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2, obs.x, obs.y, obs.width, obs.height)) {
                canMoveX = false;
                this.wanderTime = 0; // Force new direction if stuck
                break;
            }
        }
        if (canMoveX) this.x = nextX;

        let canMoveY = true;
        for (const obs of obstacles) {
            if (!obs.active || obs.type === 'bush' || (obs.type === 'door' && obs.isOpen)) continue;
            if (rectIntersect(this.x - this.radius, nextY - this.radius, this.radius * 2, this.radius * 2, obs.x, obs.y, obs.width, obs.height)) {
                canMoveY = false;
                this.wanderTime = 0;
                break;
            }
        }
        if (canMoveY) this.y = nextY;

        // Keep in world
        this.x = Math.max(this.radius, Math.min(worldSize - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(worldSize - this.radius, this.y));
    }

    draw(camera) {
        if (!this.active) return;
        ctx.save();
        ctx.translate(this.x - camera.x, this.y - camera.y);
        ctx.rotate(this.angle);

        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = '#c0392b';
        ctx.lineWidth = 3;
        ctx.stroke();

        const handRadius = this.radius * 0.35;
        const handDist = this.radius * 0.8;
        const handAngle = 0.6;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(handDist * Math.cos(handAngle), handDist * Math.sin(handAngle), handRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(handDist * Math.cos(-handAngle), handDist * Math.sin(-handAngle), handRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.restore();

        const barWidth = 40;
        const barHeight = 6;
        const healthPercent = this.health / this.maxHealth;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(this.x - camera.x - barWidth/2, this.y - camera.y - this.radius - 15, barWidth, barHeight);
        ctx.fillStyle = healthPercent > 0.5 ? '#2ecc71' : (healthPercent > 0.2 ? '#f1c40f' : '#e74c3c');
        ctx.fillRect(this.x - camera.x - barWidth/2, this.y - camera.y - this.radius - 15, barWidth * healthPercent, barHeight);
    }
}

class Lootable {
    constructor(x, y, width, height, items = []) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.items = items;
        this.opened = false;
        this.color = '#e67e22';
    }

    draw(camera) {
        ctx.fillStyle = this.opened ? '#d35400' : this.color;
        ctx.fillRect(this.x - camera.x, this.y - camera.y, this.width, this.height);
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 3;
        ctx.strokeRect(this.x - camera.x, this.y - camera.y, this.width, this.height);
        if (!this.opened) {
            ctx.beginPath();
            ctx.moveTo(this.x - camera.x, this.y - camera.y);
            ctx.lineTo(this.x + this.width - camera.x, this.y + this.height - camera.y);
            ctx.moveTo(this.x + this.width - camera.x, this.y - camera.y);
            ctx.lineTo(this.x - camera.x, this.y + this.height - camera.y);
            ctx.stroke();
        }
    }

    open() {
        if (this.opened) return [];
        this.opened = true;
        return this.items;
    }
}

class House {
    constructor(x, y, width, height, doorPos = 'bottom') {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.wallThickness = 15;
        this.doorSize = 60;
        this.floorColor = '#bdc3c7'; 
        this.wallColor = '#ecf0f1';
        this.walls = [];
        this.furniture = [];
        this.lootables = [];
        this.doors = [];
        this.generate(doorPos);
    }

    generate(doorPos) {
        const wt = this.wallThickness;
        const ds = this.doorSize;
        let mainDoorX = -1000, mainDoorY = -1000, mainDoorW = 0, mainDoorH = 0;

        if (doorPos === 'bottom') {
            this.walls.push(new Obstacle(this.x, this.y, this.width, wt, this.wallColor));
            this.walls.push(new Obstacle(this.x, this.y + wt, wt, this.height - 2*wt, this.wallColor));
            this.walls.push(new Obstacle(this.x + this.width - wt, this.y + wt, wt, this.height - 2*wt, this.wallColor));
            const sideWidth = (this.width - ds) / 2;
            this.walls.push(new Obstacle(this.x, this.y + this.height - wt, sideWidth, wt, this.wallColor));
            this.walls.push(new Obstacle(this.x + sideWidth + ds, this.y + this.height - wt, sideWidth, wt, this.wallColor));
            mainDoorX = this.x + sideWidth;
            mainDoorY = this.y + this.height - wt;
            mainDoorW = ds;
            mainDoorH = wt;
            this.doors.push(new Obstacle(mainDoorX, mainDoorY, mainDoorW, mainDoorH, '#a04000', 'door', 50));
        } else if (doorPos === 'top') {
            this.walls.push(new Obstacle(this.x, this.y + this.height - wt, this.width, wt, this.wallColor));
            this.walls.push(new Obstacle(this.x, this.y + wt, wt, this.height - 2*wt, this.wallColor));
            this.walls.push(new Obstacle(this.x + this.width - wt, this.y + wt, wt, this.height - 2*wt, this.wallColor));
            const sideWidth = (this.width - ds) / 2;
            this.walls.push(new Obstacle(this.x, this.y, sideWidth, wt, this.wallColor));
            this.walls.push(new Obstacle(this.x + sideWidth + ds, this.y, sideWidth, wt, this.wallColor));
            mainDoorX = this.x + sideWidth;
            mainDoorY = this.y;
            mainDoorW = ds;
            mainDoorH = wt;
            this.doors.push(new Obstacle(mainDoorX, mainDoorY, mainDoorW, mainDoorH, '#a04000', 'door', 50));
        }

        const innerX = this.x + wt;
        const innerY = this.y + wt;
        const innerW = this.width - 2 * wt;
        const innerH = this.height - 2 * wt;
        let rooms = [{ x: innerX, y: innerY, w: innerW, h: innerH }];
        const numRooms = 3 + Math.floor(Math.random() * 2);

        for (let i = 0; i < 10 && rooms.length < numRooms; i++) {
            rooms.sort((a, b) => (b.w * b.h) - (a.w * a.h));
            const room = rooms.shift();
            let splitVertical = Math.random() > 0.5;
            if (room.w > room.h * 1.5) splitVertical = true;
            else if (room.h > room.w * 1.5) splitVertical = false;

            if (splitVertical) {
                const minW = 80;
                if (room.w > 2 * minW + wt) {
                    let splitX = room.x + minW + Math.random() * (room.w - 2 * minW - wt);
                    if (splitX + wt > mainDoorX - 30 && splitX < mainDoorX + mainDoorW + 30) {
                        splitX = (splitX < mainDoorX + mainDoorW / 2) ? mainDoorX - 30 - wt : mainDoorX + mainDoorW + 30;
                    }
                    if (splitX > room.x + minW && splitX < room.x + room.w - minW) {
                        const doorY = room.y + Math.random() * (room.h - ds);
                        this.walls.push(new Obstacle(splitX, room.y, wt, doorY - room.y, this.wallColor));
                        this.walls.push(new Obstacle(splitX, doorY + ds, wt, room.y + room.h - (doorY + ds), this.wallColor));
                        this.doors.push(new Obstacle(splitX, doorY, wt, ds, '#a04000', 'door', 50));
                        rooms.push({ x: room.x, y: room.y, w: splitX - room.x, h: room.h });
                        rooms.push({ x: splitX + wt, y: room.y, w: room.x + room.w - (splitX + wt), h: room.h });
                    } else rooms.push(room);
                } else rooms.push(room);
            } else {
                const minH = 80;
                if (room.h > 2 * minH + wt) {
                    const splitY = room.y + minH + Math.random() * (room.h - 2 * minH - wt);
                    const doorX = room.x + Math.random() * (room.w - ds);
                    this.walls.push(new Obstacle(room.x, splitY, doorX - room.x, wt, this.wallColor));
                    this.walls.push(new Obstacle(doorX + ds, splitY, room.x + room.w - (doorX + ds), wt, this.wallColor));
                    this.doors.push(new Obstacle(doorX, splitY, ds, wt, '#a04000', 'door', 50));
                    rooms.push({ x: room.x, y: room.y, w: room.w, h: splitY - room.y });
                    rooms.push({ x: room.x, y: splitY + wt, w: room.w, h: room.y + room.h - (splitY + wt) });
                } else rooms.push(room);
            }
        }

        const weaponKeys = Object.keys(WEAPON_TYPES);
        rooms.forEach((room, index) => {
            const numFurniture = 1 + Math.floor(Math.random() * 2);
            for(let j=0; j<numFurniture; j++) {
                const fW = 30 + Math.random() * 40, fH = 30 + Math.random() * 40;
                const fX = room.x + 10 + Math.random() * (room.w - fW - 20);
                const fY = room.y + 10 + Math.random() * (room.h - fH - 20);
                const colors = ['#8e44ad', '#a04000', '#2c3e50', '#7f8c8d'];
                this.furniture.push(new Obstacle(fX, fY, fW, fH, colors[Math.floor(Math.random() * colors.length)], 'furniture', 40, [ITEM_TYPES.AMMO]));
            }
            if (Math.random() > 0.4 || index === 0) {
                const lootSize = 40;
                this.lootables.push(new Lootable(room.x + room.w/2 - lootSize/2, room.y + room.h/2 - lootSize/2, lootSize, lootSize, [new Item(0, 0, WEAPON_TYPES[weaponKeys[Math.floor(Math.random() * weaponKeys.length)]])]));
            }
        });
    }

    drawFloor(camera) {
        ctx.fillStyle = this.floorColor;
        ctx.fillRect(this.x - camera.x, this.y - camera.y, this.width, this.height);
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 1;
        for (let i = 20; i < this.width; i += 20) {
            ctx.beginPath(); ctx.moveTo(this.x + i - camera.x, this.y - camera.y); ctx.lineTo(this.x + i - camera.x, this.y + this.height - camera.y); ctx.stroke();
        }
        for (let j = 20; j < this.height; j += 20) {
            ctx.beginPath(); ctx.moveTo(this.x - camera.x, this.y + j - camera.y); ctx.lineTo(this.x + this.width - camera.x, this.y + j - camera.y); ctx.stroke();
        }
    }

    drawWalls(camera) {
        for (const wall of this.walls) wall.draw(camera);
        for (const door of this.doors) door.draw(camera);
        for (const item of this.furniture) item.draw(camera);
        for (const loot of this.lootables) loot.draw(camera);
    }

    getObstacles() { return [...this.walls, ...this.doors, ...this.furniture]; }
}

class Player {
    constructor(x, y, radius, color) {
        this.x = x; this.y = y; this.radius = radius; this.color = color;
        this.speed = 5; this.inventory = []; this.equippedWeapon = null;
        this.angle = 0; this.lastFired = 0;
        this.maxHealth = 100; this.health = 100;
        this.active = true;
        this.isPunching = false; this.punchSide = 1; this.punchAnim = 0;
        this.punchDuration = 150; this.punchCooldown = 300; this.lastPunch = 0; this.fistDamage = 15;
    }

    getBounds(targetX = this.x, targetY = this.y) {
        return { x: targetX - this.radius, y: targetY - this.radius, width: this.radius * 2, height: this.radius * 2 };
    }

    update(obstacles, lootables, items, projectiles, enemies, camera) {
        if (!this.active) return;
        let dx = 0, dy = 0;
        if (keys['w']) dy -= 1; if (keys['s']) dy += 1; if (keys['a']) dx -= 1; if (keys['d']) dx += 1;
        if (dx !== 0 || dy !== 0) {
            const length = Math.sqrt(dx * dx + dy * dy);
            dx = (dx / length) * this.speed; dy = (dy / length) * this.speed;
        }

        let newX = this.x + dx, newY = this.y + dy;
        newX = Math.max(this.radius, Math.min(worldSize - this.radius, newX));
        newY = Math.max(this.radius, Math.min(worldSize - this.radius, newY));

        let collisionX = false;
        const boundsX = this.getBounds(newX, this.y);
        for (const obs of obstacles) {
            if (!obs.active || obs.type === 'bush' || (obs.type === 'door' && obs.isOpen)) continue;
            if (rectIntersect(boundsX.x, boundsX.y, boundsX.width, boundsX.height, obs.x, obs.y, obs.width, obs.height)) { collisionX = true; break; }
        }
        if (!collisionX) this.x = newX;

        let collisionY = false;
        const boundsY = this.getBounds(this.x, newY);
        for (const obs of obstacles) {
            if (!obs.active || obs.type === 'bush' || (obs.type === 'door' && obs.isOpen)) continue;
            if (rectIntersect(boundsY.x, boundsY.y, boundsY.width, boundsY.height, obs.x, obs.y, obs.width, obs.height)) { collisionY = true; break; }
        }
        if (!collisionY) this.y = newY;

        const screenX = this.x - camera.x, screenY = this.y - camera.y;
        this.angle = Math.atan2(mouse.y - screenY, mouse.x - screenX);

        const now = Date.now();
        if (mouse.pressed) {
            if (this.equippedWeapon) {
                if (now - this.lastFired > this.equippedWeapon.fireRate) { this.shoot(projectiles); this.lastFired = now; }
            } else if (!this.isPunching && now - this.lastPunch > this.punchCooldown) this.punch(enemies, obstacles);
        }

        if (this.isPunching) {
            const elapsed = now - this.lastPunch;
            if (elapsed < this.punchDuration) this.punchAnim = Math.sin((elapsed / this.punchDuration) * Math.PI);
            else { this.isPunching = false; this.punchAnim = 0; }
        }

        if (keys['f']) {
            for (const loot of lootables) {
                const dist = Math.sqrt((this.x - (loot.x + loot.width/2))**2 + (this.y - (loot.y + loot.height/2))**2);
                if (dist < 100 && !loot.opened) {
                    const droppedItems = loot.open();
                    droppedItems.forEach(item => { item.x = loot.x + loot.width / 2 + (Math.random() - 0.5) * 40; item.y = loot.y + loot.height / 2 + (Math.random() - 0.5) * 40; items.push(item); });
                }
            }
            for (let i = items.length - 1; i >= 0; i--) {
                const item = items[i]; const dist = Math.sqrt((this.x - item.x)**2 + (this.y - item.y)**2);
                if (dist < 50) { if (item.config.type === 'weapon') this.equippedWeapon = item.config; this.inventory.push(item); items.splice(i, 1); }
            }
            for (const obs of obstacles) {
                if (obs.type === 'door' && obs.active) {
                    const dist = Math.sqrt((this.x - (obs.x + obs.width/2))**2 + (this.y - (obs.y + obs.height/2))**2);
                    if (dist < 100) obs.toggle();
                }
            }
            keys['f'] = false;
        }

        if (this.health <= 0) { this.health = 0; this.active = false; }
    }

    punch(enemies, obstacles) {
        this.isPunching = true; this.lastPunch = Date.now(); this.punchSide *= -1;
        const punchDist = this.radius + 25, punchX = this.x + Math.cos(this.angle) * punchDist, punchY = this.y + Math.sin(this.angle) * punchDist, punchRadius = 20;
        for (const enemy of enemies) {
            const dist = Math.sqrt((punchX - enemy.x)**2 + (punchY - enemy.y)**2);
            if (dist < enemy.radius + punchRadius) enemy.health -= this.fistDamage;
        }
        for (const obs of obstacles) {
            if (!obs.active || obs.type === 'bush' || obs.health === Infinity) continue;
            const closestX = Math.max(obs.x, Math.min(punchX, obs.x + obs.width)), closestY = Math.max(obs.y, Math.min(punchY, obs.y + obs.height));
            if (Math.sqrt((punchX - closestX)**2 + (punchY - closestY)**2) < punchRadius) obs.takeDamage(this.fistDamage);
        }
    }

    shoot(projectiles) {
        const weapon = this.equippedWeapon, barrelDist = this.radius + weapon.length - 10;
        projectiles.push(new Projectile(this.x + Math.cos(this.angle) * barrelDist, this.y + Math.sin(this.angle) * barrelDist, this.angle, weapon.bulletSpeed, weapon.bulletColor, weapon.bulletDamage, this));
    }

    draw(camera) {
        if (!this.active) return;
        ctx.save(); ctx.translate(this.x - camera.x, this.y - camera.y); ctx.rotate(this.angle);
        if (this.equippedWeapon) {
            const w = this.equippedWeapon; ctx.lineCap = 'round'; ctx.strokeStyle = w.color; ctx.lineWidth = w.width; ctx.beginPath(); ctx.moveTo(this.radius - 5, 0); ctx.lineTo(this.radius + w.length, 0); ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2); ctx.fillStyle = this.color; ctx.fill(); ctx.strokeStyle = '#2c3e50'; ctx.lineWidth = 3; ctx.stroke();
        const handRadius = this.radius * 0.35, handDistBase = this.radius * 0.8, handAngle = 0.6;
        let rDist = handDistBase + (this.isPunching && this.punchSide === 1 ? this.punchAnim * 25 : 0);
        ctx.beginPath(); ctx.arc(rDist * Math.cos(handAngle), rDist * Math.sin(handAngle), handRadius, 0, Math.PI * 2); ctx.fillStyle = this.color; ctx.fill(); ctx.stroke();
        let lDist = handDistBase + (this.isPunching && this.punchSide === -1 ? this.punchAnim * 25 : 0);
        ctx.beginPath(); ctx.arc(lDist * Math.cos(-handAngle), lDist * Math.sin(-handAngle), handRadius, 0, Math.PI * 2); ctx.fillStyle = this.color; ctx.fill(); ctx.stroke();
        ctx.restore();

        const barWidth = 100, barHeight = 10;
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(canvas.width/2 - barWidth/2, canvas.height - 40, barWidth, barHeight);
        ctx.fillStyle = '#2ecc71'; ctx.fillRect(canvas.width/2 - barWidth/2, canvas.height - 40, barWidth * (this.health/this.maxHealth), barHeight);
    }
}

class Camera {
    constructor(x, y, width, height) { this.x = x; this.y = y; this.width = width; this.height = height; }
    follow(target) {
        this.x = target.x - this.width / 2; this.y = target.y - this.height / 2;
        this.x = Math.max(0, Math.min(worldSize - this.width, this.x)); this.y = Math.max(0, Math.min(worldSize - this.height, this.y));
    }
}

function findSafeSpawn(radius, obstacles) {
    let spawnX, spawnY, attempts = 0, collision = true;
    while (collision && attempts < 1000) {
        spawnX = Math.random() * (worldSize - 2 * radius) + radius; spawnY = Math.random() * (worldSize - 2 * radius) + radius;
        collision = false; attempts++;
        for (const obs of obstacles) { if (obs.type !== 'bush' && rectIntersect(spawnX - radius, spawnY - radius, radius*2, radius*2, obs.x, obs.y, obs.width, obs.height)) { collision = true; break; } }
    }
    return { x: spawnX, y: spawnY };
}

const houses = [new House(1700, 1700, 400, 300, 'bottom'), new House(2300, 1800, 350, 350, 'top'), new House(1500, 2300, 500, 400, 'bottom'), new House(2500, 2500, 400, 300, 'top')];
let allObstacles = [new Obstacle(2000, 1500, 120, 120, '#2ecc71', 'bush'), new Obstacle(2800, 2000, 100, 100, '#2ecc71', 'bush'), new Obstacle(1200, 1800, 150, 150, '#2ecc71', 'bush')];
let allLootables = [], allItems = [];
for (const house of houses) { allObstacles = allObstacles.concat(house.getObstacles()); allLootables = allLootables.concat(house.lootables); }
const playerSpawn = findSafeSpawn(25, allObstacles), player = new Player(playerSpawn.x, playerSpawn.y, 25, '#3498db'), camera = new Camera(0, 0, window.innerWidth, window.innerHeight);
const projectiles = [], enemies = [];
const maxEnemies = 15;

function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; camera.width = canvas.width; camera.height = canvas.height; }
window.addEventListener('resize', resizeCanvas); resizeCanvas();
window.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true); window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);
window.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; }); window.addEventListener('mousedown', () => mouse.pressed = true); window.addEventListener('mouseup', () => mouse.pressed = false);

function spawnInitialEnemies() {
    for (let i = 0; i < maxEnemies; i++) {
        const pos = findSafeSpawn(22, allObstacles);
        if (Math.sqrt((pos.x - player.x)**2 + (pos.y - player.y)**2) > 800) {
            enemies.push(new Enemy(pos.x, pos.y));
        } else {
            i--; // Retry spawn
        }
    }
}

spawnInitialEnemies();

function drawGrid(camera) {
    const gridSize = 100, startX = Math.max(0, Math.floor(camera.x / gridSize) * gridSize), startY = Math.max(0, Math.floor(camera.y / gridSize) * gridSize), endX = Math.min(worldSize, camera.x + camera.width), endY = Math.min(worldSize, camera.y + camera.height);
    ctx.strokeStyle = '#dfe6e9'; ctx.lineWidth = 1;
    for (let x = startX; x <= endX; x += gridSize) { ctx.beginPath(); ctx.moveTo(x - camera.x, 0); ctx.lineTo(x - camera.x, canvas.height); ctx.stroke(); }
    for (let y = startY; y <= endY; y += gridSize) { ctx.beginPath(); ctx.moveTo(0, y - camera.y); ctx.lineTo(canvas.width, y - camera.y); ctx.stroke(); }
    ctx.strokeStyle = '#d63031'; ctx.lineWidth = 10; ctx.strokeRect(-camera.x, -camera.y, worldSize, worldSize);
}

function gameLoop() {
    player.update(allObstacles, allLootables, allItems, projectiles, enemies, camera);
    camera.follow(player);

    if (player.active && enemies.length === 0) {
        victory = true;
    }

    for (let i = allObstacles.length - 1; i >= 0; i--) {
        const obs = allObstacles[i];
        if (!obs.active) {
            if (obs.loot) obs.loot.forEach(itemConfig => allItems.push(new Item(obs.x + obs.width/2 + (Math.random()-0.5)*40, obs.y + obs.height/2 + (Math.random()-0.5)*40, itemConfig)));
            allObstacles.splice(i, 1);
        }
    }

    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i]; p.update(allObstacles);
        if (p.owner !== player && player.active && Math.sqrt((p.x-player.x)**2 + (p.y-player.y)**2) < player.radius + p.radius) { player.health -= p.damage; p.active = false; }
        for (const e of enemies) if (p.owner !== e && Math.sqrt((p.x-e.x)**2 + (p.y-e.y)**2) < e.radius + p.radius) { e.health -= p.damage; p.active = false; break; }
        if (!p.active) projectiles.splice(i, 1);
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i]; e.update(player, enemies, allObstacles);
        if (e.health <= 0) { enemies.splice(i, 1); score += 10; }
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height); drawGrid(camera);
    for (const h of houses) h.drawFloor(camera);
    for (const l of allLootables) l.draw(camera);
    for (const it of allItems) it.draw(camera);
    for (const o of allObstacles) o.draw(camera);
    for (const e of enemies) e.draw(camera);
    for (const p of projectiles) p.draw(camera);
    player.draw(camera);

    // UI Overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(10, 10, 200, 60);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'left';
    ctx.fillText("Enemies Left: " + enemies.length, 25, 35);
    ctx.fillText("Score: " + score, 25, 60);

    if (!player.active) { 
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0,0,canvas.width,canvas.height); 
        ctx.fillStyle = '#e74c3c'; ctx.font = 'bold 64px Arial'; ctx.textAlign = 'center'; ctx.fillText("GAME OVER", canvas.width/2, canvas.height/2); 
        ctx.fillStyle = '#fff'; ctx.font = 'bold 24px Arial'; ctx.fillText("Final Score: " + score, canvas.width/2, canvas.height/2 + 60);
    } else if (victory) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0,0,canvas.width,canvas.height); 
        ctx.fillStyle = '#2ecc71'; ctx.font = 'bold 64px Arial'; ctx.textAlign = 'center'; ctx.fillText("VICTORY", canvas.width/2, canvas.height/2); 
        ctx.fillStyle = '#fff'; ctx.font = 'bold 24px Arial'; ctx.fillText("You are the Last Man Standing!", canvas.width/2, canvas.height/2 + 60);
        ctx.fillText("Final Score: " + score, canvas.width/2, canvas.height/2 + 100);
    }
    
    requestAnimationFrame(gameLoop);
}
gameLoop();
