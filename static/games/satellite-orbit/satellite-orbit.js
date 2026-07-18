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
  const EARTH_RADIUS = 6378;
  const MU = .00980665 * EARTH_RADIUS * EARTH_RADIUS;
  const STEP_SECONDS = 48;
  const FRAME_SECONDS = 1 / 30;
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
    Object.assign(ship, createBody("Ship", -25000, 25000, 0, -2, "#c4c4c4", 10), { angle: 0 });
    frameAccumulator = 0;
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
    if (body.kind === "bullet" || body.kind === "fragment" || body === ship) return;
    if (body.kind === "part") { spawnFragments(body, body.fragmentCount); return; }
    const parts = {
      "GPS": [["gps-center",7,3],["gps-left",8,3],["gps-right",8,3]],
      "Hubble": [["hubble-telescope",10,3],["hubble-computer",7,2],["hubble-left",8,2],["hubble-right",8,2]],
      "Starlink": [["starlink-body",2,3],["starlink-array",4,3]],
      "Crew Dragon": [["crew-center",6,4],["crew-left",6,2],["crew-right",6,2]],
    };
    const family = body.name?.startsWith("GPS") ? "GPS" : body.name;
    if (parts[family]) {
      for (const [partType, radius, fragmentCount] of parts[family]) debris.push({
        x: body.x, y: body.y, vx: body.vx, vy: body.vy, radius, alive: true,
        angle: 0, kind: "part", partType, fragmentCount,
      });
      return;
    }
    spawnFragments(body, body.name === "Sputnik" ? 4 : 0);
  }

  function spawnFragments(body, count) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * TAU;
      const impulse = 5 + Math.random() * 4;
      debris.push({ x: body.x + Math.sin(angle) * 400, y: body.y + Math.cos(angle) * 400,
        vx: body.vx + Math.sin(angle) * impulse, vy: body.vy + Math.cos(angle) * impulse,
        radius: 2, color: "#c4c4c4", alive: true, life: 50 + Math.floor(Math.random() * 51),
        angle: 0, spin: -.5 + Math.random(), kind: "fragment" });
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
        if (b.alive && Math.hypot(a.x - b.x, a.y - b.y) <= (a.radius + b.radius) * 100) {
          breakApart(a); breakApart(b); updateHud("Collision detected"); break;
        }
      }
    }
  }

  function fire() {
    if (!running || paused || !ship.alive) return;
    const direction = { x: Math.sin(ship.angle), y: Math.cos(ship.angle) };
    projectiles.push({ x: ship.x + direction.x * 1200, y: ship.y + direction.y * 1200,
      vx: ship.vx + direction.x * 9, vy: ship.vy + direction.y * 9,
      radius: 1, color: "#fff", alive: true, life: 70, kind: "bullet", angle: 0 });
    updateHud("Projectile launched");
  }

  function simulateFrame() {
    if (!running || paused) return;
    if (keys.has("ArrowLeft") || keys.has("KeyA")) ship.angle -= .06;
    if (keys.has("ArrowRight") || keys.has("KeyD")) ship.angle += .06;
    if ((keys.has("ArrowDown") || keys.has("KeyW")) && ship.alive) {
      ship.vx += Math.sin(ship.angle) * .002 * STEP_SECONDS;
      ship.vy += Math.cos(ship.angle) * .002 * STEP_SECONDS;
      updateHud("Thrusters active");
    }
    if (keys.has("Space")) fire();
    if (ship.alive) {
      ship.x += ship.vx * STEP_SECONDS;
      ship.y += ship.vy * STEP_SECONDS;
    }
    for (const body of [...satellites, ...debris, ...projectiles]) {
      if (!body.alive) continue;
      advanceWithGravity(body, STEP_SECONDS);
      if (body.spin) body.angle += body.spin;
      if (body.life !== undefined) { body.life -= 1; if (body.life <= 0) body.alive = false; }
    }
    collide([ship, ...satellites, ...debris, ...projectiles]);
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
    const pixelScaleX = width / 700;
    const pixelScaleY = height / 500;
    return { scaleX: pixelScaleX / 100, scaleY: pixelScaleY / 100,
      pixelScaleX, pixelScaleY, cx: width / 2, cy: height / 2 };
  }

  function point(body, camera) { return { x: camera.cx + body.x * camera.scaleX, y: camera.cy - body.y * camera.scaleY }; }

  function createEarthSprite() {
    const sprite = document.createElement("canvas");
    const map = [
      "00000000000000000000111111111100000000000000000000","00000000000000000133322111122231100000000000000000","00000000000000011122222233333333111000000000000000","00000000000021112222222222222333311111000000000000","00000000000221122222333333333322221111110000000000",
      "00000000021112233333333333333433333313311000000000","00000000111111333333333333333343333332331100000000","00000001111111133333333333333333333333133220000000","00000011111111123333333333333233333333333323000000","00000011112222233333333332333333323322323333000000",
      "00000111112112333332222333233333333313333332300000","00001111112113333333322322333333333113333333330000","00001111121132232333232222223333333333333333333000","00011111111122333333233332333322333323213113333000","00011111112222333222333333333222323333213312333000",
      "00111111111122122232333333333322222333321311333300","00111111111111132233333333343332222333331133133300","01111111111111133333333333331112222223332321233320","01111111112111333333334431111412222223333321133330","01111111111322333331111411114111322223333312133330",
      "01111111111221333334111141111111222221233211133330","11111111111111333314111111111111222222233331233333","11111111111113333111111111111111113322233322233322","11111111111113334111111111114441111133113332133332","11111111111112331111111111144444411111111333133332",
      "11111111111111131111111111111111111111233313333332","11111111111111111111111111144111111111121113333332","11111111111111114111111111144441111111121113233332","11111111111113222211111144444444414111111111113333","01111111111112223311111444144444411111111111113330",
      "01111111111113222311114114114444411111111111112330","01111111111111322224141144111144411111111111111210","01111111111111132222224442441144411111111111111110","00111111111111122232322142444111411111111111111100","00111111111111133333333332224411111111111111111100",
      "00011111111111123222333222122211111111111111111000","00011111111111112222313221123211111111111111111000","00001111111111122222333321113223221111111111110000","00001111111111113223333331122222223111111111110000","00000111111111123233333332212221111111111111100000",
      "00000011111111232233333222222212211111111111000000","00000001111111233333313221222222111111111110000000","00000000111111133333333322222221111111111100000000","00000000011111123333333333332211111111111000000000","00000000001111111333333333322211111111110000000000",
      "00000000000111112333333232222111111111100000000000","00000000000001111133333211122211112120000000000000","00000000000000011113331111112222113000000000000000","00000000000000000111122221111112300000000000000000","00000000000000000000011111111000000000000000000000"
    ];
    const pixels = 100;
    sprite.width = pixels;
    sprite.height = pixels;
    const pixelsContext = sprite.getContext("2d");
    pixelsContext.imageSmoothingEnabled = false;
    const colors = [null, "#0000ff", "#009600", "#b4966e", "#fff"];
    map.forEach((row, y) => [...row].forEach((value, x) => {
      if (value !== "0") { pixelsContext.fillStyle = colors[Number(value)]; pixelsContext.fillRect(x * 2, y * 2, 2, 2); }
    }));
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
    sourceQuad([[-3,4],[4,4],[4,-4],[-3,-4]], "#ffff00");
    sourceQuad([[4,4],[-3,4],[-3,-4],[-4,-4]], "#fff");
    sourceQuad([[4,3],[7,3],[7,1],[4,1]], "#808080");
    sourceQuad([[4,-3],[7,-3],[7,-1],[4,-1]], "#808080");
    drawGpsPanel(0, 12, false); drawGpsPanel(0, -12, true);
  }

  function drawHubble() {
    sourceQuad([[-7,3],[13,3],[13,-3],[-7,-3]], "#c4c4c4");
    sourceQuad([[13,3],[17,6],[18,5],[14,2]], "#808080");
    sourceQuad([[-7,-2],[13,-2],[13,-3],[-7,-3]], "#808080");
    sourceQuad([[-15,5],[-10,5],[-10,-3],[-15,-3]], "#808080");
    sourceQuad([[-15,-5],[-10,-5],[-10,-3],[-15,-3]], "#404040");
    drawHubblePanel(1,8,false); drawHubblePanel(1,-8,true);
  }

  function sourceQuad(points, fill) { polygon(points, fill, null); }
  function sourceLine(points, color="#fff") { ctx.beginPath(); points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y)); ctx.strokeStyle=color; ctx.lineWidth=1; ctx.stroke(); }
  function drawGpsPanel(ox, oy, right) {
    const sy = right ? -1 : 1;
    sourceQuad([[-6,oy+5*sy],[6,oy+5*sy],[6,oy+1*sy],[-6,oy+1*sy]], "#fff");
    sourceQuad([[-6,oy],[6,oy],[6,oy-4*sy],[-6,oy-4*sy]], "#fff");
    sourceQuad([[-5,oy+4*sy],[5,oy+4*sy],[5,oy+2*sy],[-5,oy+2*sy]], "#40409c");
    sourceQuad([[-5,oy-1*sy],[5,oy-1*sy],[5,oy-3*sy],[-5,oy-3*sy]], "#40409c");
    sourceLine([[3,oy+4*sy],[0,oy+8*sy],[-3,oy+4*sy]]);
  }
  function drawHubblePanel(ox,oy,right) {
    const sy=right?-1:1;
    sourceQuad([[ox-8,oy+3*sy],[ox-1,oy+3*sy],[ox-1,oy-1*sy],[ox-8,oy-1*sy]],"#c4c4c4");
    sourceQuad([[ox+8,oy+3*sy],[ox+1,oy+3*sy],[ox+1,oy-1*sy],[ox+8,oy-1*sy]],"#c4c4c4");
    sourceQuad([[ox-7,oy+2*sy],[ox-1,oy+2*sy],[ox-2,oy],[ox-7,oy]],"#404040");
    sourceQuad([[ox+7,oy+2*sy],[ox+1,oy+2*sy],[ox+2,oy],[ox+7,oy]],"#404040");
    sourceLine([[ox,oy+3*sy],[ox,oy-5*sy]]);
  }

  function block(x, y, w, h, fill, stroke = null) {
    ctx.fillStyle = fill; ctx.fillRect(x, y, w, h);
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, w, h); }
  }

  function drawSputnik() {
    polygon([[0,0],[2,6],[6,2],[6,-2],[2,-6],[-2,-6],[-6,-2],[-6,2],[-2,6]], "#808080", null);
    [[[-6,2],[-10,-15]],[[0,1],[-2.5,-15]],[[2,-6],[2.5,-15]],[[6,2],[10,-15]]].forEach(p=>sourceLine(p));
  }

  function drawStarlink() {
    sourceQuad([[0,5],[0,-3],[-2,-5],[-2,3]],"#c4c4c4"); sourceQuad([[-5,-5],[-2,-5],[-2,3],[-5,3]],"#808080");
    sourceQuad([[-5,3],[-3,3],[0,5],[-2,3]],"#fff");
    sourceQuad([[1,5],[16,0],[16,-8],[1,-3]],"#808080"); sourceQuad([[2,4],[15,-1],[15,-7],[2,-2]],"#40409c");
  }

  function drawCrew() {
    sourceQuad([[-5,5],[3,5],[3,-5],[-5,-5]],"#c4c4c4"); sourceQuad([[3,5],[3,-5],[11,-3],[11,3]],"#808080");
    sourceQuad([[12,-3],[12,3],[11,-3],[11,3]],"#404040"); sourceQuad([[4,3],[7,2],[7,-2],[4,-3]],"#404040");
    for (const oy of [11,-11]) { sourceQuad([[-5,oy+5],[3,oy+5],[3,oy+1],[-5,oy+1]],"#40409c"); sourceQuad([[-5,oy-1],[3,oy+1],[3,oy-5],[-5,oy-5]],"#40409c"); sourceQuad([[-1,oy+2],[-1,oy-6],[0,oy-6],[0,oy+2]],"#808080"); }
  }

  function drawPart(type) {
    if (type === "gps-center") { sourceQuad([[-3,4],[4,4],[4,-4],[-3,-4]],"#ffff00"); sourceQuad([[4,4],[-3,4],[-3,-4],[-4,-4]],"#fff"); sourceQuad([[4,3],[7,3],[7,1],[4,1]],"#808080"); sourceQuad([[4,-3],[7,-3],[7,-1],[4,-1]],"#808080"); }
    else if (type === "gps-left") drawGpsPanel(0,0,false);
    else if (type === "gps-right") drawGpsPanel(0,0,true);
    else if (type === "hubble-telescope") { sourceQuad([[-9,3],[11,3],[11,-3],[-9,-3]],"#c4c4c4"); sourceQuad([[11,3],[15,6],[16,5],[12,2]],"#808080"); sourceQuad([[-9,-2],[11,-2],[11,-3],[-9,-3]],"#808080"); }
    else if (type === "hubble-computer") { sourceQuad([[-5,5],[0,5],[0,-3],[-5,-3]],"#808080"); sourceQuad([[-5,-5],[0,-5],[0,-3],[-5,-3]],"#404040"); sourceQuad([[0,4],[3,4],[3,-2],[0,-2]],"#808080"); sourceQuad([[0,-4],[3,-4],[3,-2],[0,-2]],"#404040"); }
    else if (type === "hubble-left") drawHubblePanel(0,0,false);
    else if (type === "hubble-right") drawHubblePanel(0,0,true);
    else if (type === "starlink-body") { sourceQuad([[1,5],[1,-3],[-1,-5],[-1,3]],"#c4c4c4"); sourceQuad([[-4,-5],[-1,-5],[-1,3],[-4,3]],"#808080"); sourceQuad([[-4,3],[-2,3],[1,5],[-1,3]],"#fff"); }
    else if (type === "starlink-array") { sourceQuad([[-7,7],[8,2],[8,-6],[-7,-1]],"#808080"); sourceQuad([[-6,6],[7,1],[7,-5],[-6,0]],"#40409c"); }
    else if (type === "crew-center") { sourceQuad([[-5,5],[3,5],[3,-5],[-5,-5]],"#c4c4c4"); sourceQuad([[3,5],[3,-5],[11,-3],[11,3]],"#808080"); sourceQuad([[12,-3],[12,3],[11,-3],[11,3]],"#404040"); sourceQuad([[4,3],[7,2],[7,-2],[4,-3]],"#404040"); }
    else if (type === "crew-left" || type === "crew-right") { sourceQuad([[-4,5],[4,5],[4,1],[-4,1]],"#40409c"); sourceQuad([[-4,-1],[4,1],[4,-5],[-4,-5]],"#40409c"); sourceQuad([[0,2],[0,-6],[1,-6],[1,2]],"#808080"); }
  }

  function drawShip(body) {
    polygon([[-3,-9],[-12,-12],[-14,-12],[-13,-7],[-8,-2],[-6,3],[-4,11],[-4,14],[-3,16],[-1,18],[1,18],[3,16],[4,14],[4,11],[6,3],[8,-2],[13,-7],[14,-12],[12,-12],[3,-9]], "#c4c4c4", null);
    if (keys.has("ArrowDown") || keys.has("KeyW")) polygon([[-3,-9],[0,-22],[3,-9]], "#f00", null);
    [[[-5,-8],[-12,-11],[-11,-7],[-5,-2]],[[5,-8],[12,-11],[11,-7],[5,-2]],[[0,-13],[-3,11],[-1,15],[1,15]],[[0,-13],[3,11],[1,15],[-1,15]]].forEach(p=>sourceQuad(p,"#40409c"));
  }

  function drawBody(body, camera) {
    if (!body.alive) return;
    const p = point(body, camera);
    if (p.x < -20 || p.x > width + 20 || p.y < -20 || p.y > height + 20) return;
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(camera.pixelScaleX, -camera.pixelScaleY); ctx.rotate(-(body.angle || 0));
    if (body === ship) {
      drawShip(body);
    } else if (body.name && body.name.includes("GPS")) {
      drawGps();
    } else if (body.name === "Hubble") {
      drawHubble();
    } else if (body.name === "Sputnik") {
      drawSputnik();
    } else if (body.name === "Starlink") {
      drawStarlink();
    } else if (body.name === "Crew Dragon") {
      drawCrew();
    } else if (body.kind === "part") {
      drawPart(body.partType);
    } else if (body.kind === "bullet") {
      block(-1, -1, 2, 2, "#fff");
    } else if (!body.name) {
      block(-4, -1, 8, 2, "#c4c4c4");
    } else {
      ctx.fillStyle = body.color; ctx.strokeStyle = "#ccc"; ctx.lineWidth = 2;
      ctx.fillRect(-7, -12, 14, 24); ctx.strokeRect(-7, -12, 14, 24);
    }
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    const camera = view();
    const earthWidth = 100 * camera.pixelScaleX;
    const earthHeight = 100 * camera.pixelScaleY;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(earthSprite, camera.cx - earthWidth / 2, camera.cy - earthHeight / 2, earthWidth, earthHeight);
    for (const body of [...satellites, ...debris, ...projectiles]) drawBody(body, camera);
    drawBody(ship, camera);
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
    if (["ArrowLeft", "ArrowRight", "ArrowDown", "KeyA", "KeyD", "KeyW", "Space"].includes(event.code)) event.preventDefault();
    if (event.code === "Enter" && !running) start();
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
