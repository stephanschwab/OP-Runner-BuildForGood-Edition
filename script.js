(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const levelEl = document.getElementById('level');
  const restartBtn = document.getElementById('restart');

  // World
  const W = canvas.width, H = canvas.height;
  const groundH = 50;
  const groundY = H - groundH;
  let speed = 6;           // base world speed
  let frame = 0;
  let level = 1;

  // Player
  const player = {
    x: 120,
    y: groundY - 70,
    r: 26,            // radius of head/body
    vy: 0,
    onGround: true,
    jumpsUsed: 0,
    maxJumps: 1,      // 1 -> can jump once; bonus can set to 2 temporarily
    shield: 0,        // hits you can ignore
    boostTime: 0,     // frames of invincibility + speed
    alive: true,
  };

  // Score
  let score = 0;
  let best = +localStorage.getItem('op_runner_best') || 0;
  bestEl.textContent = best;

  // Entities
  const obstacles = [];
  const coins = [];
  const bonuses = []; // {type:'shield'|'double'|'boost', x,y}

  // Spawning control
  let nextSpawn = 90;

  // Input
  let pressed = false;
  function jump() {
    if (!player.alive) return;
    if (player.onGround) {
      player.vy = -15;
      player.onGround = false;
      player.jumpsUsed = 1;
    } else if (player.jumpsUsed < player.maxJumps) {
      player.vy = -14;
      player.jumpsUsed++;
    }
  }
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      jump();
    }
    if (!player.alive && e.code === 'Enter') restart();
  });
  canvas.addEventListener('pointerdown', () => jump());

  restartBtn.addEventListener('click', () => restart());

  function restart() {
    obstacles.length = 0;
    coins.length = 0;
    bonuses.length = 0;
    score = 0;
    speed = 6;
    frame = 0;
    level = 1;
    player.x = 120;
    player.y = groundY - 70;
    player.vy = 0;
    player.onGround = true;
    player.jumpsUsed = 0;
    player.maxJumps = 1;
    player.shield = 0;
    player.boostTime = 0;
    player.alive = true;
    restartBtn.hidden = true;
    loop();
  }

  function spawn() {
    // Randomly choose to spawn obstacle / coin row / bonus
    const r = Math.random();
    const x = W + 30;
    if (r < 0.55) {
      // obstacle of varying height
      const h = 30 + Math.random() * 60;
      obstacles.push({ x, y: groundY - h, w: 28, h });
    } else if (r < 0.85) {
      // coins in an arc
      const baseY = groundY - (80 + Math.random() * 60);
      const n = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        coins.push({ x: x + i * 28, y: baseY + Math.sin(i/ (n-1) * Math.PI) * 18, r: 10, taken: false });
      }
    } else {
      // bonus
      const types = ['shield','double','boost'];
      const type = types[Math.floor(Math.random() * types.length)];
      bonuses.push({ x, y: groundY - (70 + Math.random() * 60), r: 12, type, taken: false });
    }
    // schedule next spawn
    nextSpawn = 70 + Math.random() * 120;
  }

  function collideRectCircle(rx, ry, rw, rh, cx, cy, cr) {
    // clamp circle center to rectangle bounds
    const testX = Math.max(rx, Math.min(cx, rx + rw));
    const testY = Math.max(ry, Math.min(cy, ry + rh));
    const distX = cx - testX;
    const distY = cy - testY;
    return (distX*distX + distY*distY) <= cr*cr;
  }

  function drawBackground() {
    // sky
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    // ground dark line + red stripe
    ctx.fillStyle = '#333';
    ctx.fillRect(0, groundY, W, groundH);
    ctx.fillStyle = '#FF1A1A';
    ctx.fillRect(0, groundY, W, 8);
  }

  function drawPlayer() {
    const cx = player.x;
    const cy = player.y;
    // body
    ctx.fillStyle = '#FF1A1A';
    ctx.beginPath();
    ctx.arc(cx, cy, player.r, 0, Math.PI*2);
    ctx.fill();
    // OP text
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px Inter, Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('OP', cx, cy);
    // legs/arms (simple)
    ctx.strokeStyle = '#FF1A1A';
    ctx.lineWidth = 5;
    ctx.beginPath();
    // legs
    ctx.moveTo(cx-12, cy+player.r-6); ctx.lineTo(cx-18, cy+player.r+10);
    ctx.moveTo(cx+12, cy+player.r-6); ctx.lineTo(cx+18, cy+player.r+10);
    // arms
    ctx.moveTo(cx-16, cy); ctx.lineTo(cx-28, cy+8);
    ctx.moveTo(cx+16, cy); ctx.lineTo(cx+28, cy+8);
    ctx.stroke();

    // shield aura
    if (player.shield > 0 || player.boostTime > 0) {
      ctx.strokeStyle = player.boostTime > 0 ? 'gold' : '#66CCFF';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, player.r + 6, 0, Math.PI*2);
      ctx.stroke();
    }
  }

  function drawObstacles() {
    ctx.fillStyle = '#000';
    obstacles.forEach(o => {
      ctx.fillRect(o.x, o.y, o.w, o.h);
    });
  }

  function drawCoins() {
    coins.forEach(c => {
      if (c.taken) return;
      ctx.fillStyle = 'gold';
      ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = 'orange'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#FF1A1A'; ctx.font = 'bold 10px Inter, Arial';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('OP', c.x, c.y);
    });
  }

  function drawBonuses() {
    bonuses.forEach(b => {
      if (b.taken) return;
      if (b.type === 'shield') ctx.fillStyle = '#FF1A1A';
      if (b.type === 'double') ctx.fillStyle = '#111';
      if (b.type === 'boost') ctx.fillStyle = 'gold';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI*2); ctx.fill();
    });
  }

  function drawHUD() {
    // score / level text rendered in DOM, but also show level banner when changed
    if (frame < 80 && levelBanner.timer > 0) {
      ctx.fillStyle = 'rgba(255,26,26,0.9)';
      ctx.fillRect(W/2 - 90, 20, 180, 34);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 18px Inter, Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('LEVEL ' + level, W/2, 37);
      levelBanner.timer--;
    }
  }

  const levelBanner = { timer: 0 };

  function update() {
    frame++;

    // speed increases a bit with levels; boost temporarily increases speed more
    const currentSpeed = speed + (player.boostTime > 0 ? 3 : 0);

    // gravity
    player.vy += 0.7;
    player.y += player.vy;
    if (player.y > groundY - player.r - 10) {
      player.y = groundY - player.r - 10;
      player.vy = 0;
      if (!player.onGround) {
        player.onGround = true;
        player.jumpsUsed = 0;
      }
    }

    // spawn entities
    if (nextSpawn-- <= 0) spawn();

    // move & cull obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.x -= currentSpeed;
      if (o.x + o.w < -10) obstacles.splice(i, 1);
    }

    // move coins
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i];
      c.x -= currentSpeed;
      // collect
      const hit = collideRectCircle(c.x - c.r, c.y - c.r, c.r*2, c.r*2, player.x, player.y, player.r);
      if (!c.taken && hit) {
        c.taken = true;
        score += 10;
      }
      if (c.x + c.r < -10) coins.splice(i, 1);
    }

    // move bonuses
    for (let i = bonuses.length - 1; i >= 0; i--) {
      const b = bonuses[i];
      b.x -= currentSpeed;
      const hit = collideRectCircle(b.x - b.r, b.y - b.r, b.r*2, b.r*2, player.x, player.y, player.r);
      if (!b.taken && hit) {
        b.taken = true;
        if (b.type === 'shield') player.shield = Math.min(player.shield + 1, 2);
        if (b.type === 'double') player.maxJumps = 2; // persists for a while via timer
        if (b.type === 'boost') player.boostTime = 60 * 5; // ~5 seconds at 60fps
        // add small score for pickup
        score += 5;
      }
      if (b.x + b.r < -10) bonuses.splice(i, 1);
    }

    // timers
    if (player.boostTime > 0) player.boostTime--;
    // Double jump bonus wears off after some time without pickup
    if (player.maxJumps === 2) {
      if (!player._doubleTimer) player._doubleTimer = 60 * 10; // 10 sec
      player._doubleTimer--;
      if (player._doubleTimer <= 0) {
        player.maxJumps = 1;
        player._doubleTimer = 0;
      }
    }

    // collisions with obstacles
    for (let i = 0; i < obstacles.length; i++) {
      const o = obstacles[i];
      const hit = collideRectCircle(o.x, o.y, o.w, o.h, player.x, player.y, player.r-2);
      if (hit) {
        if (player.boostTime > 0) {
          // ignore hit while boosted
          continue;
        } else if (player.shield > 0) {
          player.shield--;
          // knock back slightly
          o.x -= 12;
        } else {
          // dead
          player.alive = false;
        }
      }
    }

    // score from distance
    score += 0.2;
    scoreEl.textContent = Math.floor(score);
    if (score > best) {
      best = Math.floor(score);
      bestEl.textContent = best;
    }

    // level up logic every 200 score
    const newLevel = 1 + Math.floor(score / 200);
    if (newLevel !== level) {
      level = newLevel;
      levelEl.textContent = level;
      speed += 0.8; // increment base speed
      levelBanner.timer = 120; // show banner ~2 sec
    }
  }

  function render() {
    drawBackground();
    drawObstacles();
    drawCoins();
    drawBonuses();
    drawPlayer();
    drawHUD();

    // HUD icons in canvas (active bonuses)
    const iconY = 18;
    let iconX = W - 140;
    // shield counter
    if (player.shield > 0) {
      ctx.fillStyle = '#FF1A1A'; ctx.fillRect(iconX, iconY, 18, 18); ctx.fillStyle='#fff'; ctx.font='bold 12px Inter'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('S', iconX+9, iconY+9);
      ctx.fillStyle='#FF1A1A'; ctx.font='bold 12px Inter'; ctx.textAlign='left'; ctx.fillText('x'+player.shield, iconX+24, iconY+9);
      iconX += 50;
    }
    if (player.maxJumps === 2) {
      ctx.fillStyle = '#111'; ctx.fillRect(iconX, iconY, 18, 18); ctx.fillStyle='#fff'; ctx.font='bold 12px Inter'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('2J', iconX+9, iconY+9);
      iconX += 40;
    }
    if (player.boostTime > 0) {
      ctx.fillStyle = 'gold'; ctx.fillRect(iconX, iconY, 18, 18); ctx.fillStyle='#111'; ctx.font='bold 12px Inter'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('⚡', iconX+9, iconY+9);
    }
  }

  function loop() {
    if (!player.alive) {
      // game over overlay
      render();
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 28px Inter, Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Game Over', W/2, H/2 - 10);
      ctx.font = '16px Inter, Arial';
      ctx.fillText('Press Enter or tap Restart', W/2, H/2 + 20);
      restartBtn.hidden = false;
      localStorage.setItem('op_runner_best', best);
      return;
    }
    update();
    render();
    requestAnimationFrame(loop);
  }

  // Start
  loop();
})();