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
  const TIME_SCALE = 42;
  const keys = new Set();
  let width = 700;
  let height = 500;
  let running = false;
  let lastTime = 0;
  let stars = [];
  let satellites = [];
  let debris = [];
  let projectiles = [];
  let flash = null;

  const ship = { name: "Ship", x: 0, y: 0, vx: 0, vy: 0, angle: 0, radius: 34, alive: true };
  const satelliteSpecs = [
    ["Sputnik", 7000, 0.18, "#dce5ed"], ["Hubble", 7350, 1.25, "#9fc4db"],
    ["GPS I", 26560, 2.0, "#8ca8be"], ["GPS II", 26560, 3.05, "#8ca8be"],
    ["GPS III", 26560, 4.1, "#8ca8be"], ["GPS IV", 26560, 5.12, "#8ca8be"],
    ["Starlink", 6920, 2.75, "#d8e2ea"], ["Crew Dragon", 6800, 4.9, "#f0f3f6"],
  ];

  function circularBody(name, orbitRadius, phase, color) {
    const speed = Math.sqrt(MU / orbitRadius);
    return { name, x: Math.cos(phase) * orbitRadius, y: Math.sin(phase) * orbitRadius,
      vx: -Math.sin(phase) * speed, vy: Math.cos(phase) * speed, radius: name.includes("GPS") ? 78 : 60,
      color, alive: true };
  }

  function reset() {
    satellites = satelliteSpecs.map((spec) => circularBody(...spec));
    debris = [];
    projectiles = [];
    Object.assign(ship, circularBody("Ship", 7200, -0.72, "#b5f44a"), { radius: 44, angle: 2.29 });
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
    stars = Array.from({ length: Math.max(70, Math.floor(width * height / 7000)) }, () => ({
      x: Math.random() * width, y: Math.random() * height, r: Math.random() * 1.25 + .25, a: Math.random() * .65 + .2,
    }));
  }

  function gravity(body, dt) {
    const distance = Math.hypot(body.x, body.y);
    const factor = -MU / (distance * distance * distance);
    body.vx += body.x * factor * dt;
    body.vy += body.y * factor * dt;
    body.x += body.vx * dt;
    body.y += body.vy * dt;
  }

  function breakApart(body) {
    if (!body.alive) return;
    body.alive = false;
    flash = { x: body.x, y: body.y, life: 1 };
    for (let i = 0; i < 7; i += 1) {
      const angle = Math.random() * TAU;
      const impulse = .12 + Math.random() * .42;
      debris.push({ x: body.x, y: body.y, vx: body.vx + Math.cos(angle) * impulse,
        vy: body.vy + Math.sin(angle) * impulse, radius: 10 + Math.random() * 15,
        color: "#ffb84d", alive: true, life: 80 + Math.random() * 80 });
    }
  }

  function collide(objects) {
    for (const body of objects) {
      if (body.alive && Math.hypot(body.x, body.y) <= EARTH_RADIUS + body.radius) breakApart(body);
    }
    for (let i = 0; i < objects.length; i += 1) {
      const a = objects[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < objects.length; j += 1) {
        const b = objects[j];
        if (b.alive && Math.hypot(a.x - b.x, a.y - b.y) < a.radius + b.radius) {
          breakApart(a); breakApart(b); updateHud("Collision detected"); break;
        }
      }
    }
  }

  function fire() {
    if (!running || !ship.alive) return;
    const direction = { x: Math.cos(ship.angle), y: Math.sin(ship.angle) };
    projectiles.push({ x: ship.x + direction.x * 80, y: ship.y + direction.y * 80,
      vx: ship.vx + direction.x * 2.2, vy: ship.vy + direction.y * 2.2,
      radius: 20, color: "#ffdf73", alive: true, life: 48 });
    updateHud("Projectile launched");
  }

  function update(dt) {
    if (!running) return;
    if (keys.has("ArrowLeft") || keys.has("KeyA")) ship.angle -= 2.4 * dt;
    if (keys.has("ArrowRight") || keys.has("KeyD")) ship.angle += 2.4 * dt;
    if ((keys.has("ArrowUp") || keys.has("KeyW")) && ship.alive) {
      ship.vx += Math.cos(ship.angle) * 0.018 * TIME_SCALE * dt;
      ship.vy += Math.sin(ship.angle) * 0.018 * TIME_SCALE * dt;
      updateHud("Thrusters active");
    }
    const simDt = dt * TIME_SCALE;
    const moving = [ship, ...satellites, ...debris, ...projectiles];
    for (const body of moving) {
      if (!body.alive) continue;
      gravity(body, simDt);
      if (body.life !== undefined) { body.life -= simDt; if (body.life <= 0) body.alive = false; }
    }
    collide([ship, ...satellites, ...projectiles]);
    satellites = satellites.filter((body) => body.alive);
    debris = debris.filter((body) => body.alive);
    projectiles = projectiles.filter((body) => body.alive);
    if (flash) { flash.life -= dt * 1.8; if (flash.life <= 0) flash = null; }
    updateHud();
  }

  function view() {
    const farthest = Math.max(11000, ...satellites.map((body) => Math.hypot(body.x, body.y) * 1.12));
    const scale = Math.min(width, height) * .46 / farthest;
    return { scale, cx: width / 2, cy: height / 2 + Math.min(38, height * .04) };
  }

  function point(body, camera) { return { x: camera.cx + body.x * camera.scale, y: camera.cy - body.y * camera.scale }; }

  function drawOrbit(radius, camera) {
    ctx.beginPath(); ctx.arc(camera.cx, camera.cy, radius * camera.scale, 0, TAU);
    ctx.strokeStyle = "rgba(129, 168, 200, .14)"; ctx.lineWidth = 1; ctx.stroke();
  }

  function drawBody(body, camera) {
    if (!body.alive) return;
    const p = point(body, camera);
    if (p.x < -20 || p.x > width + 20 || p.y < -20 || p.y > height + 20) return;
    const size = body === ship ? 8 : body.radius <= 25 ? 2.2 : 4.3;
    ctx.save(); ctx.translate(p.x, p.y);
    if (body === ship) {
      ctx.rotate(-body.angle);
      ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-7, -5); ctx.lineTo(-4, 0); ctx.lineTo(-7, 5); ctx.closePath();
      ctx.fillStyle = body.alive ? "#b5f44a" : "#687784"; ctx.shadowColor = "#b5f44a"; ctx.shadowBlur = 10; ctx.fill();
      if (keys.has("ArrowUp") || keys.has("KeyW")) { ctx.beginPath(); ctx.moveTo(-5, -3); ctx.lineTo(-14, 0); ctx.lineTo(-5, 3); ctx.fillStyle = "#ffb84d"; ctx.fill(); }
    } else {
      ctx.fillStyle = body.color; ctx.shadowColor = body.color; ctx.shadowBlur = body.radius <= 25 ? 3 : 7;
      ctx.fillRect(-size / 2, -size / 2, size, size);
      if (body.radius > 25) { ctx.fillStyle = "#668ca8"; ctx.fillRect(-size * 1.5, -1, size * 3, 2); }
    }
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    for (const star of stars) { ctx.globalAlpha = star.a; ctx.fillStyle = "#e9f2fa"; ctx.beginPath(); ctx.arc(star.x, star.y, star.r, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
    const camera = view();
    [6800, 7200, 26560].forEach((radius) => drawOrbit(radius, camera));
    const earthRadius = EARTH_RADIUS * camera.scale;
    const gradient = ctx.createRadialGradient(camera.cx - earthRadius * .28, camera.cy - earthRadius * .32, earthRadius * .08, camera.cx, camera.cy, earthRadius);
    gradient.addColorStop(0, "#8cd5ec"); gradient.addColorStop(.42, "#2477ae"); gradient.addColorStop(.78, "#135184"); gradient.addColorStop(1, "#071b37");
    ctx.beginPath(); ctx.arc(camera.cx, camera.cy, earthRadius, 0, TAU); ctx.fillStyle = gradient; ctx.shadowColor = "rgba(72, 174, 230, .55)"; ctx.shadowBlur = 24; ctx.fill(); ctx.shadowBlur = 0;
    ctx.globalAlpha = .3; ctx.fillStyle = "#9cbf80"; ctx.beginPath(); ctx.ellipse(camera.cx - earthRadius * .22, camera.cy - earthRadius * .05, earthRadius * .18, earthRadius * .33, -.55, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    for (const body of [...satellites, ...debris, ...projectiles]) drawBody(body, camera);
    drawBody(ship, camera);
    if (flash) { const p = point(flash, camera); ctx.beginPath(); ctx.arc(p.x, p.y, (1 - flash.life) * 28 + 5, 0, TAU); ctx.strokeStyle = `rgba(255,184,77,${flash.life})`; ctx.lineWidth = 3; ctx.stroke(); }
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
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "Space"].includes(event.code)) event.preventDefault();
    if (event.code === "Enter" && !running) start();
    if (event.code === "Space" && !event.repeat) fire();
    if (event.code === "KeyR") reset();
    keys.add(event.code);
  });
  window.addEventListener("keyup", (event) => keys.delete(event.code));
  window.addEventListener("blur", () => keys.clear());
  startButton.addEventListener("click", start);
  resize(); reset(); requestAnimationFrame(frame);
}());
