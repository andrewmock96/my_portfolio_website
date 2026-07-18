(function () {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const menu = document.getElementById("menuOverlay");
  const startButton = document.getElementById("startButton");
  const hud = {
    status: document.getElementById("statusValue"),
    altitude: document.getElementById("altitudeValue"),
    velocity: document.getElementById("velocityValue"),
    objects: document.getElementById("objectsValue"),
  };

  const TAU = Math.PI * 2;
  const EARTH_RADIUS = 6371;
  const MU = 398600.44;
  const STEP_SECONDS = 48;
  const FRAME_SECONDS = 1 / 60;
  const keys = new Set();
  let width = 700;
  let height = 500;
  let running = false;
  let lastTime = 0;
  let frameAccumulator = 0;
  let earthSprite = null;
  let satellites = [];
  let debris = [];
  let projectiles = [];
  let flash = null;
  let fireCooldown = 0;
  let paused = false;

  const ship = { name: "Ship", x: 0, y: 0, vx: 0, vy: 0, angle: 0, radius: 10, alive: true };
  const satelliteSpecs = [
    ["Sputnik", -36515.09513, 21082, 2.05, 2.68468, "#dce5ed", 4],
    ["Hubble", 0, -42164, 3.1, 0, "#9fc4db", 10],
    ["GPS I", 0, 26560, -3.88, 0, "#8ca8be", 12],
    ["GPS II", 23001.63472, 13280, -1.94, 3.36018, "#8ca8be", 12],
    ["GPS III", 23001.63472, -13280, 1.94, 3.36018, "#8ca8be", 12],
    ["GPS IV", 0, -26560, 3.88, 0, "#8ca8be", 12],
    ["GPS V", -23001.63472, -13280, 1.94, -3.36018, "#8ca8be", 12],
    ["GPS VI", -23001.63472, 13280, -1.94, -3.36018, "#8ca8be", 12],
    ["Starlink", 0, -13020, 5.8, 0, "#d8e2ea", 6],
    ["Crew Dragon", 0, 8000, -7.9, 0, "#f0f3f6", 7],
  ];

  function createBody(name, x, y, vx, vy, color, radius) {
    return { name, x, y, vx, vy, radius, color, angle: 0, alive: true };
  }

  function reset() {
    satellites = satelliteSpecs.map((spec) => createBody(...spec));
    debris = [];
    projectiles = [];
    const x = -19000;
    const y = 12500;
    const radius = Math.hypot(x, y);
    const orbitalSpeed = Math.sqrt(MU / radius);
    Object.assign(ship, createBody("Ship", x, y, -y / radius * orbitalSpeed,
      x / radius * orbitalSpeed, "#b5f44a", 10), { angle: 2.15 });
    frameAccumulator = 0;
    fireCooldown = 0;
    paused = false;
    flash = null;
    updateHud("Orbit stable");
  }

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    earthSprite = createEarthSprite();
  }

  function advanceWithGravity(body, dt) {
    const distance = Math.hypot(body.x, body.y);
    const factor = -MU / (distance * distance * distance);
    const ax = body.x * factor;
    const ay = body.y * factor;
    body.x += body.vx * dt + .5 * ax * dt * dt;
    body.y += body.vy * dt + .5 * ay * dt * dt;
    body.vx += ax * dt;
    body.vy += ay * dt;
    if (body !== ship) body.angle += .01;
  }

  function breakApart(body) {
    if (!body.alive) return;
    body.alive = false;
    flash = { x: body.x, y: body.y, life: 1 };
    const count = body.name?.startsWith("GPS") ? 8 : 5;
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * TAU;
      const impulse = .12 + Math.random() * .42;
      debris.push({ x: body.x, y: body.y, vx: body.vx + Math.cos(angle) * impulse,
        vy: body.vy + Math.sin(angle) * impulse, radius: 2,
        color: i % 3 ? "#bbb" : "#24249e", alive: true, life: 110 + Math.random() * 90,
        angle: Math.random() * TAU, spin: (Math.random() - .5) * .08 });
    }
  }

  function collide(objects) {
    for (const body of objects) {
      if (body.alive && Math.hypot(body.x, body.y) <= EARTH_RADIUS + body.radius * 100) breakApart(body);
    }
    for (let i = 0; i < objects.length; i += 1) {
      const a = objects[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < objects.length; j += 1) {
        const b = objects[j];
        if (b.alive && Math.hypot(a.x - b.x, a.y - b.y) < (a.radius + b.radius) * 100) {
          breakApart(a); breakApart(b); updateHud("Collision detected"); break;
        }
      }
    }
  }

  function fire() {
    if (!running || paused || !ship.alive || fireCooldown > 0) return;
    const direction = { x: Math.sin(ship.angle), y: Math.cos(ship.angle) };
    projectiles.push({ x: ship.x + direction.x * 1200, y: ship.y + direction.y * 1200,
      vx: ship.vx + direction.x * 9, vy: ship.vy + direction.y * 9,
      radius: 1, color: "#ffdf73", alive: true, life: 70 });
    fireCooldown = 7;
    updateHud("Projectile launched");
  }

  function simulateFrame() {
    if (!running || paused) return;
    if (keys.has("ArrowLeft") || keys.has("KeyA")) ship.angle -= .06;
    if (keys.has("ArrowRight") || keys.has("KeyD")) ship.angle += .06;
    if ((keys.has("ArrowDown") || keys.has("KeyS")) && ship.alive) {
      ship.vx += Math.sin(ship.angle) * .002 * STEP_SECONDS;
      ship.vy += Math.cos(ship.angle) * .002 * STEP_SECONDS;
      updateHud("Thrusters active");
    }
    for (const body of [ship, ...satellites, ...debris, ...projectiles]) {
      if (!body.alive) continue;
      advanceWithGravity(body, STEP_SECONDS);
      if (body.spin) body.angle += body.spin;
      if (body.life !== undefined) { body.life -= 1; if (body.life <= 0) body.alive = false; }
    }
    fireCooldown = Math.max(0, fireCooldown - 1);
    collide([ship, ...satellites, ...projectiles]);
    satellites = satellites.filter((body) => body.alive);
    debris = debris.filter((body) => body.alive);
    projectiles = projectiles.filter((body) => body.alive);
    updateHud();
  }

  function update(dt) {
    frameAccumulator = Math.min(frameAccumulator + dt, .1);
    while (frameAccumulator >= FRAME_SECONDS) {
      simulateFrame();
      frameAccumulator -= FRAME_SECONDS;
    }
    if (flash) { flash.life -= dt * 1.8; if (flash.life <= 0) flash = null; }
  }

  function view() {
    const scale = Math.min(width / 700, height / 500) / 100;
    return { scale, cx: width / 2, cy: height / 2 };
  }

  function point(body, camera) { return { x: camera.cx + body.x * camera.scale, y: camera.cy - body.y * camera.scale }; }

  function createEarthSprite() {
    const sprite = document.createElement("canvas");
    const pixels = 72;
    sprite.width = pixels;
    sprite.height = pixels;
    const pixelsContext = sprite.getContext("2d");
    pixelsContext.imageSmoothingEnabled = false;
    pixelsContext.fillStyle = "#0909e8";
    pixelsContext.beginPath();
    pixelsContext.arc(pixels / 2, pixels / 2, pixels / 2 - 1, 0, TAU);
    pixelsContext.fill();
    pixelsContext.save();
    pixelsContext.beginPath();
    pixelsContext.arc(pixels / 2, pixels / 2, pixels / 2 - 1, 0, TAU);
    pixelsContext.clip();
    const land = [
      [28, 1, 18, 7], [20, 7, 28, 8], [24, 14, 18, 8], [15, 20, 26, 7],
      [9, 27, 22, 6], [5, 40, 27, 7], [13, 47, 34, 7], [19, 54, 39, 8],
      [30, 62, 28, 7], [51, 22, 20, 7], [45, 31, 25, 7], [48, 39, 18, 7],
    ];
    for (const [x, y, w, h] of land) {
      pixelsContext.fillStyle = (x + y) % 3 ? "#0b9d13" : "#c8b98d";
      pixelsContext.fillRect(x, y, w, h);
    }
    pixelsContext.fillStyle = "#eee";
    pixelsContext.fillRect(29, 20, 13, 5);
    pixelsContext.fillRect(34, 25, 16, 6);
    pixelsContext.fillRect(39, 31, 11, 5);
    pixelsContext.restore();
    return sprite;
  }

  function polygon(points, fill, stroke = "#d7d7d7", lineWidth = 2) {
    ctx.beginPath();
    points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
  }

  function drawGps() {
    ctx.fillStyle = "#17179d";
    ctx.strokeStyle = "#ddd";
    ctx.lineWidth = 2;
    for (const x of [-25, -17, 15, 23]) { ctx.fillRect(x, -8, 7, 16); ctx.strokeRect(x, -8, 7, 16); }
    polygon([[-13, -8], [13, -5], [9, 8], [-11, 5]], "#ffff00", "#eee", 1.5);
  }

  function drawHubble() {
    ctx.fillStyle = "#17179d";
    ctx.strokeStyle = "#aaa";
    ctx.lineWidth = 2;
    ctx.fillRect(-23, -5, 14, 10); ctx.strokeRect(-23, -5, 14, 10);
    ctx.fillRect(9, -5, 14, 10); ctx.strokeRect(9, -5, 14, 10);
    polygon([[-8, -7], [8, -7], [11, 7], [0, 12], [-10, 6]], "#ccc", "#999", 1.5);
  }

  function block(x, y, w, h, fill, stroke = null) {
    ctx.fillStyle = fill; ctx.fillRect(x, y, w, h);
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, w, h); }
  }

  function drawSputnik() {
    block(-5, -5, 10, 10, "#ffff00", "#eee");
    ctx.strokeStyle = "#ddd"; ctx.lineWidth = 2;
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * 6, Math.sin(a) * 6);
      ctx.lineTo(Math.cos(a) * 17, Math.sin(a) * 17); ctx.stroke();
    }
    block(-2, -18, 4, 7, "#ddd"); block(-2, 11, 4, 7, "#ddd");
  }

  function drawStarlink() {
    block(-7, -10, 14, 20, "#bbb", "#eee");
    block(7, -5, 25, 10, "#24249e", "#aaa");
    ctx.strokeStyle = "#777"; ctx.beginPath(); ctx.moveTo(15, -5); ctx.lineTo(15, 5); ctx.moveTo(23, -5); ctx.lineTo(23, 5); ctx.stroke();
  }

  function drawCrew() {
    polygon([[-8,-13],[8,-13],[11,-3],[8,10],[0,15],[-8,10],[-11,-3]], "#ddd", "#888", 2);
    block(-20, 3, 12, 7, "#24249e", "#aaa"); block(8, 3, 12, 7, "#24249e", "#aaa");
  }

  function drawShip(body) {
    ctx.rotate(body.angle);
    polygon([[0, -25], [7, -16], [9, 5], [22, 14], [22, 21], [5, 16], [0, 25], [-5, 16], [-22, 21], [-22, 14], [-9, 5], [-7, -16]], "#23239f", "#ccc", 3);
    ctx.fillStyle = "#bcbcbc";
    ctx.fillRect(-4, -18, 8, 30);
      if (keys.has("ArrowDown") || keys.has("KeyS")) polygon([[-4, 22], [0, 34], [4, 22]], "#ffff00", null);
  }

  function drawBody(body, camera) {
    if (!body.alive) return;
    const p = point(body, camera);
    if (p.x < -20 || p.x > width + 20 || p.y < -20 || p.y > height + 20) return;
    ctx.save(); ctx.translate(p.x, p.y);
    if (body === ship) {
      drawShip(body);
    } else if (body.name && body.name.includes("GPS")) {
      ctx.rotate(body.angle); drawGps();
    } else if (body.name === "Hubble") {
      ctx.rotate(body.angle); drawHubble();
    } else if (body.name === "Sputnik") {
      ctx.rotate(body.angle); drawSputnik();
    } else if (body.name === "Starlink") {
      ctx.rotate(body.angle); drawStarlink();
    } else if (body.name === "Crew Dragon") {
      ctx.rotate(body.angle); drawCrew();
    } else if (!body.name) {
      ctx.rotate(body.angle || 0); block(-3, -2, 7, 5, body.color, "#777");
    } else {
      ctx.rotate(body.angle);
      ctx.fillStyle = body.color; ctx.strokeStyle = "#ccc"; ctx.lineWidth = 2;
      ctx.fillRect(-7, -12, 14, 24); ctx.strokeRect(-7, -12, 14, 24);
    }
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    const camera = view();
    const earthRadius = EARTH_RADIUS * camera.scale;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(earthSprite, camera.cx - earthRadius, camera.cy - earthRadius, earthRadius * 2, earthRadius * 2);
    for (const body of [...satellites, ...debris, ...projectiles]) drawBody(body, camera);
    drawBody(ship, camera);
    if (flash) { const p = point(flash, camera); ctx.fillStyle = `rgba(255,220,80,${flash.life})`; for (let i=0;i<10;i+=1) { const a=i/10*TAU; ctx.fillRect(p.x+Math.cos(a)*(18-flash.life*12),p.y+Math.sin(a)*(18-flash.life*12),3,3); } }
  }

  function updateHud(message) {
    if (message) hud.status.textContent = message;
    if (!ship.alive) hud.status.textContent = "Ship destroyed — press R";
    const altitude = Math.max(0, Math.hypot(ship.x, ship.y) - EARTH_RADIUS);
    hud.altitude.textContent = `${Math.round(altitude).toLocaleString()} km`;
    hud.velocity.textContent = `${Math.hypot(ship.vx, ship.vy).toFixed(2)} km/s`;
    hud.objects.textContent = `${satellites.length + debris.length + projectiles.length + (ship.alive ? 1 : 0)} tracked`;
  }

  function frame(time) {
    const dt = Math.min((time - lastTime) / 1000 || 0, .04); lastTime = time;
    update(dt); draw(); requestAnimationFrame(frame);
  }

  function start() { running = true; menu.classList.add("hidden"); canvas.focus(); updateHud("Orbit stable"); }
  window.addEventListener("resize", resize);
  window.addEventListener("keydown", (event) => {
    if (["ArrowLeft", "ArrowRight", "ArrowDown", "Space"].includes(event.code)) event.preventDefault();
    if (event.code === "Enter" && !running) start();
    if (event.code === "Space" && !event.repeat) fire();
    if (event.code === "KeyR") reset();
    if (event.code === "KeyP" && running) { paused = !paused; updateHud(paused ? "Simulation paused" : "Orbit stable"); }
    keys.add(event.code);
  });
  window.addEventListener("keyup", (event) => keys.delete(event.code));
  window.addEventListener("blur", () => keys.clear());
  startButton.addEventListener("click", start);
  resize(); reset();
  if (new URLSearchParams(window.location.search).has("autostart")) start();
  requestAnimationFrame(frame);
}());
