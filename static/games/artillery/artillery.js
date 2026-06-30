(function () {
  const VIRTUAL_WIDTH = 700;
  const VIRTUAL_HEIGHT = 500;
  const METERS_PER_PIXEL = 40;
  const MIN_ALTITUDE_METERS = 300;
  const MAX_ALTITUDE_METERS = 3000;
  const MAX_SLOPE = 1.0;
  const LUMPINESS = 0.15;
  const TEXTURE = 3.0;
  const HOWITZER_WIDTH = 14;
  const HOWITZER_X_PIXELS = 350;
  const DEFAULT_MUZZLE_VELOCITY = 827.0;
  const DEFAULT_PROJECTILE_WEIGHT = 46.7;
  const DEFAULT_PROJECTILE_RADIUS = 0.077545;
  const TARGET_SIZE_PIXELS = 10.0;
  const BARREL_LENGTH_METERS = 20.0;
  const SIMULATION_SUBSTEP = 0.1;
  const ORIGINAL_FRAME_SUBSTEPS = 10;
  const ORIGINAL_FRAME_RATE = 60;
  const SHELL_LENGTH_PIXELS = 11;
  const SHELL_RADIUS_PIXELS = 2.6;
  const EXPLOSION_DURATION = 0.45;
  const DEG_TO_RAD = Math.PI / 180;
  const START_ANGLE = 45 * DEG_TO_RAD;

  const gravityTable = [
    [0, -9.807], [1000, -9.804], [2000, -9.801], [3000, -9.797], [4000, -9.794],
    [5000, -9.791], [6000, -9.788], [7000, -9.785], [8000, -9.782], [9000, -9.779],
    [10000, -9.776], [15000, -9.761], [20000, -9.745], [25000, -9.73], [30000, -9.715],
    [40000, -9.684], [50000, -9.654], [60000, -9.624], [70000, -9.594], [80000, -9.564],
  ];

  const speedOfSoundTable = [
    [0, 340], [1000, 336], [2000, 332], [3000, 328], [4000, 324],
    [5000, 320], [6000, 316], [7000, 312], [8000, 308], [9000, 303],
    [10000, 299], [15000, 295], [20000, 295], [25000, 295], [30000, 305],
    [40000, 324], [50000, 337], [60000, 319], [70000, 289], [80000, 269],
  ];

  const airDensityTable = [
    [0, 1.2250000], [1000, 1.1120000], [2000, 1.0070000], [3000, 0.9093000], [4000, 0.8194000],
    [5000, 0.7364000], [6000, 0.6601000], [7000, 0.5900000], [8000, 0.5258000], [9000, 0.4671000],
    [10000, 0.4135000], [15000, 0.1948000], [20000, 0.0889100], [25000, 0.0400800], [30000, 0.0184100],
    [40000, 0.0039960], [50000, 0.0010270], [60000, 0.0003097], [70000, 0.0000828], [80000, 0.0000185],
  ];

  const dragCoefficientTable = [
    [0.000, 0.0000], [0.300, 0.1629], [0.500, 0.1659], [0.700, 0.2031], [0.890, 0.2597],
    [0.920, 0.3010], [0.960, 0.3287], [0.980, 0.4002], [1.000, 0.4258], [1.020, 0.4335],
    [1.060, 0.4483], [1.240, 0.4064], [1.530, 0.3663], [1.990, 0.2897], [2.870, 0.2297],
    [2.890, 0.2306], [5.000, 0.2656],
  ];

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const menuOverlay = document.getElementById("menuOverlay");
  const startButton = document.getElementById("startButton");
  const resetButton = document.getElementById("resetButton");

  const hud = {
    status: document.getElementById("statusValue"),
    angle: document.getElementById("angleValue"),
    shots: document.getElementById("shotsValue"),
    bestMiss: document.getElementById("bestMissValue"),
    flight: document.getElementById("flightValue"),
    distance: document.getElementById("distanceValue"),
    height: document.getElementById("heightValue"),
    target: document.getElementById("targetValue"),
  };

  const controls = {
    rotateLeft: false,
    rotateRight: false,
    raise: false,
    lower: false,
  };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function normalizeAngle(angle) {
    let radians = angle;
    while (radians < 0) {
      radians += Math.PI * 2;
    }
    while (radians >= Math.PI * 2) {
      radians -= Math.PI * 2;
    }
    return radians;
  }

  function lerp(x0, y0, x1, y1, x) {
    return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }

  function lookup(table, value) {
    if (value <= table[0][0]) {
      return table[0][1];
    }

    for (let i = 0; i < table.length - 1; i += 1) {
      const [d0, r0] = table[i];
      const [d1, r1] = table[i + 1];
      if (value === d0) {
        return r0;
      }
      if (value >= d0 && value <= d1) {
        return lerp(d0, r0, d1, r1, value);
      }
    }

    return table[table.length - 1][1];
  }

  function gravityFromAltitude(altitude) {
    return lookup(gravityTable, altitude);
  }

  function densityFromAltitude(altitude) {
    return lookup(airDensityTable, altitude);
  }

  function speedSoundFromAltitude(altitude) {
    return lookup(speedOfSoundTable, altitude);
  }

  function dragFromMach(speedMach) {
    return lookup(dragCoefficientTable, speedMach);
  }

  function areaFromRadius(radius) {
    return Math.PI * radius * radius;
  }

  function forceFromDrag(density, drag, radius, velocity) {
    return 0.5 * drag * density * areaFromRadius(radius) * velocity * velocity;
  }

  function accelerationFromForce(force, mass) {
    return force / mass;
  }

  function randomRange(min, max) {
    return min + Math.random() * (max - min);
  }

  function randomInt(min, max) {
    return Math.floor(min + Math.random() * (max - min + 1));
  }

  function metersToPixels(meters) {
    return meters / METERS_PER_PIXEL;
  }

  function pixelsToMeters(pixels) {
    return pixels * METERS_PER_PIXEL;
  }

  // Match the original angle convention: 0 points straight up, dx = sin(a), dy = cos(a).
  function directionFromAngle(angle) {
    return {
      dx: Math.sin(angle),
      dy: Math.cos(angle),
    };
  }

  const game = {
    running: false,
    angle: START_ANGLE,
    muzzleVelocity: DEFAULT_MUZZLE_VELOCITY,
    groundPixels: [],
    targetXPixel: 0,
    targetYPixel: 0,
    howitzerYPixel: 0,
    projectileActive: false,
    shellTrail: [],
    currentTime: 0,
    lastFrameTime: 0,
    simulationFrameAccumulator: 0,
    explosionTime: 0,
    explosionAt: null,
    shotsTaken: 0,
    bestMissMeters: Infinity,
    hit: false,
    flightDistanceMeters: 0,
    maxHeightMeters: 0,
    closestApproachMeters: Infinity,
    statusText: "Ready",
    targetText: "Acquire",
    shell: {
      x: 0,
      y: 0,
      dx: 0,
      dy: 0,
    },
  };

  function groundMetersAtPixel(pixelX) {
    const index = clamp(Math.round(pixelX), 0, VIRTUAL_WIDTH - 1);
    return pixelsToMeters(game.groundPixels[index] || 0);
  }

  function targetMeters() {
    return {
      x: pixelsToMeters(game.targetXPixel),
      y: pixelsToMeters(game.targetYPixel),
    };
  }

  function targetCollisionPaddingMeters() {
    return Math.max(
      pixelsToMeters(SHELL_RADIUS_PIXELS * 1.5),
      pixelsToMeters(SHELL_LENGTH_PIXELS * 0.5)
    );
  }

  function distanceToExpandedTarget(px, py, target) {
    const halfTargetSizeMeters = pixelsToMeters(TARGET_SIZE_PIXELS / 2);
    const collisionPadding = targetCollisionPaddingMeters();
    const halfWidth = halfTargetSizeMeters + collisionPadding;
    const halfHeight = halfTargetSizeMeters + collisionPadding;
    const dx = Math.max(Math.abs(px - target.x) - halfWidth, 0);
    const dy = Math.max(Math.abs(py - target.y) - halfHeight, 0);
    return Math.hypot(dx, dy);
  }

  function segmentHitsExpandedTarget(x1, y1, x2, y2, target) {
    const halfTargetSizeMeters = pixelsToMeters(TARGET_SIZE_PIXELS / 2);
    const collisionPadding = targetCollisionPaddingMeters();
    const minX = target.x - halfTargetSizeMeters - collisionPadding;
    const maxX = target.x + halfTargetSizeMeters + collisionPadding;
    const minY = target.y - halfTargetSizeMeters - collisionPadding;
    const maxY = target.y + halfTargetSizeMeters + collisionPadding;

    const dx = x2 - x1;
    const dy = y2 - y1;
    let t0 = 0;
    let t1 = 1;

    function clip(p, q) {
      if (p === 0) {
        return q >= 0;
      }
      const ratio = q / p;
      if (p < 0) {
        if (ratio > t1) {
          return false;
        }
        if (ratio > t0) {
          t0 = ratio;
        }
      } else {
        if (ratio < t0) {
          return false;
        }
        if (ratio < t1) {
          t1 = ratio;
        }
      }
      return true;
    }

    return (
      clip(-dx, x1 - minX) &&
      clip(dx, maxX - x1) &&
      clip(-dy, y1 - minY) &&
      clip(dy, maxY - y1)
    );
  }

  function resetTerrain() {
    const minPixelAltitude = metersToPixels(MIN_ALTITUDE_METERS);
    const maxPixelAltitude = metersToPixels(MAX_ALTITUDE_METERS);

    game.groundPixels = new Array(VIRTUAL_WIDTH);
    game.groundPixels[0] = minPixelAltitude;

    let slope = MAX_SLOPE / 2;
    for (let i = 1; i < VIRTUAL_WIDTH; i += 1) {
      if (i > HOWITZER_X_PIXELS - HOWITZER_WIDTH / 2 && i < HOWITZER_X_PIXELS + HOWITZER_WIDTH / 2) {
        game.groundPixels[i] = game.groundPixels[i - 1];
      } else {
        const percent = (game.groundPixels[i - 1] - minPixelAltitude) / (maxPixelAltitude - minPixelAltitude);
        slope += (1.0 - percent) * randomRange(0.0, LUMPINESS) + percent * randomRange(-LUMPINESS, 0.0);
        slope = clamp(slope, -MAX_SLOPE, MAX_SLOPE);

        const nextHeight = game.groundPixels[i - 1] + slope + randomRange(-TEXTURE, TEXTURE);
        game.groundPixels[i] = clamp(nextHeight, 0, VIRTUAL_HEIGHT - 5);
      }
    }

    game.targetXPixel = randomInt(Math.floor(VIRTUAL_WIDTH * 0.55), Math.floor(VIRTUAL_WIDTH * 0.95));
    game.targetYPixel = game.groundPixels[game.targetXPixel];
    game.howitzerYPixel = game.groundPixels[HOWITZER_X_PIXELS];

    resetShotState();
    game.shotsTaken = 0;
    game.bestMissMeters = Infinity;
    game.statusText = "Ready";
    game.targetText = "Acquire";
    updateHud();
  }

  function resetShotState() {
    game.projectileActive = false;
    game.currentTime = 0;
    game.simulationFrameAccumulator = 0;
    game.explosionTime = 0;
    game.explosionAt = null;
    game.hit = false;
    game.flightDistanceMeters = 0;
    game.maxHeightMeters = 0;
    game.closestApproachMeters = Infinity;
    game.shellTrail = [];
    game.shell.x = pixelsToMeters(HOWITZER_X_PIXELS);
    game.shell.y = pixelsToMeters(game.howitzerYPixel);
    game.shell.dx = 0;
    game.shell.dy = 0;
  }

  function fire() {
    if (!game.running || game.projectileActive) {
      return;
    }

    const direction = directionFromAngle(game.angle);
    const muzzleX = pixelsToMeters(HOWITZER_X_PIXELS) + direction.dx * BARREL_LENGTH_METERS;
    const muzzleY = pixelsToMeters(game.howitzerYPixel) + direction.dy * BARREL_LENGTH_METERS;

    game.shell.x = muzzleX;
    game.shell.y = muzzleY;
    game.shell.dx = direction.dx * game.muzzleVelocity;
    game.shell.dy = direction.dy * game.muzzleVelocity;
    game.projectileActive = true;
    game.currentTime = 0;
    game.hit = false;
    game.flightDistanceMeters = 0;
    game.maxHeightMeters = muzzleY;
    game.closestApproachMeters = Infinity;
    game.shotsTaken += 1;
    game.shellTrail = [{ x: muzzleX, y: muzzleY }];
    game.statusText = "Shell in flight";
    game.targetText = "Tracking";
    updateHud();
  }

  function finishShot(result) {
    game.projectileActive = false;
    game.statusText = result;
    game.targetText = result === "Target hit" ? "Impact" : "Adjust";
    game.explosionTime = EXPLOSION_DURATION;
    game.explosionAt = { x: game.shell.x, y: game.shell.y };

    if (!game.hit && Number.isFinite(game.closestApproachMeters)) {
      game.bestMissMeters = Math.min(game.bestMissMeters, game.closestApproachMeters);
    }

    updateHud();
  }

  function updateProjectile(dt) {
    const previous = {
      x: game.shell.x,
      y: game.shell.y,
    };

    const speed = Math.hypot(game.shell.dx, game.shell.dy);
    const gravity = gravityFromAltitude(game.shell.y);

    let ax = 0;
    let ay = gravity;

    if (speed > 0) {
      const density = densityFromAltitude(game.shell.y);
      const mach = speed / speedSoundFromAltitude(game.shell.y);
      const drag = dragFromMach(mach);
      const force = forceFromDrag(density, drag, DEFAULT_PROJECTILE_RADIUS, speed);
      const acceleration = accelerationFromForce(force, DEFAULT_PROJECTILE_WEIGHT);

      ax = acceleration * -(game.shell.dx / speed);
      ay = gravity + acceleration * -(game.shell.dy / speed);
    }

    game.shell.x += game.shell.dx * dt + 0.5 * ax * dt * dt;
    game.shell.y += game.shell.dy * dt + 0.5 * ay * dt * dt;
    game.shell.dx += ax * dt;
    game.shell.dy += ay * dt;
    game.currentTime += dt;
    game.flightDistanceMeters = Math.max(0, game.shell.x - pixelsToMeters(HOWITZER_X_PIXELS));
    game.maxHeightMeters = Math.max(game.maxHeightMeters, game.shell.y);
    game.shellTrail.push({ x: game.shell.x, y: game.shell.y });
    if (game.shellTrail.length > 240) {
      game.shellTrail.shift();
    }

    const target = targetMeters();
    const segDx = game.shell.x - previous.x;
    const segDy = game.shell.y - previous.y;
    const segLenSq = segDx * segDx + segDy * segDy;

    let closestX = previous.x;
    let closestY = previous.y;

    if (segLenSq > 0) {
      let t = ((target.x - previous.x) * segDx + (target.y - previous.y) * segDy) / segLenSq;
      t = clamp(t, 0, 1);
      closestX = previous.x + t * segDx;
      closestY = previous.y + t * segDy;
    }

    const distanceToTarget = Math.min(
      distanceToExpandedTarget(previous.x, previous.y, target),
      distanceToExpandedTarget(game.shell.x, game.shell.y, target),
      distanceToExpandedTarget(closestX, closestY, target)
    );
    game.closestApproachMeters = Math.min(game.closestApproachMeters, distanceToTarget);

    if (segmentHitsExpandedTarget(previous.x, previous.y, game.shell.x, game.shell.y, target)) {
      game.hit = true;
      finishShot("Target hit");
      return;
    }

    const shellPixelX = metersToPixels(game.shell.x);
    const terrainMeters = groundMetersAtPixel(shellPixelX);
    if (game.shell.y <= terrainMeters || shellPixelX >= VIRTUAL_WIDTH || shellPixelX < 0) {
      finishShot("Missed target");
    }
  }

  function updateSimulation(frameTime) {
    if (!game.running) {
      return;
    }

    if (!game.lastFrameTime) {
      game.lastFrameTime = frameTime;
    }

    const elapsed = clamp((frameTime - game.lastFrameTime) / 1000, 0, 0.05);
    game.lastFrameTime = frameTime;

    if (game.explosionTime > 0) {
      game.explosionTime = Math.max(0, game.explosionTime - elapsed);
    }

    applyControls();

    if (game.projectileActive) {
      game.simulationFrameAccumulator += elapsed * ORIGINAL_FRAME_RATE;
      while (game.simulationFrameAccumulator >= 1) {
        for (let i = 0; i < ORIGINAL_FRAME_SUBSTEPS; i += 1) {
          updateProjectile(SIMULATION_SUBSTEP);
          if (!game.projectileActive) {
            break;
          }
        }
        game.simulationFrameAccumulator -= 1;
        if (!game.projectileActive) {
          break;
        }
      }
    }

    updateHud();
  }

  function drawBackground() {
    const skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    skyGradient.addColorStop(0, "#7ec9f3");
    skyGradient.addColorStop(0.5, "#b9e3ff");
    skyGradient.addColorStop(1, "#f4d8a2");
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const sun = ctx.createRadialGradient(
      canvas.width * 0.78,
      canvas.height * 0.2,
      10,
      canvas.width * 0.78,
      canvas.height * 0.2,
      canvas.height * 0.16
    );
    sun.addColorStop(0, "rgba(255, 245, 208, 0.95)");
    sun.addColorStop(0.35, "rgba(255, 232, 166, 0.55)");
    sun.addColorStop(1, "rgba(255, 232, 166, 0)");
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.beginPath();
    ctx.ellipse(canvas.width * 0.2, canvas.height * 0.16, canvas.width * 0.12, canvas.height * 0.03, 0, 0, Math.PI * 2);
    ctx.ellipse(canvas.width * 0.32, canvas.height * 0.13, canvas.width * 0.09, canvas.height * 0.025, 0, 0, Math.PI * 2);
    ctx.ellipse(canvas.width * 0.56, canvas.height * 0.19, canvas.width * 0.11, canvas.height * 0.028, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawGround() {
    ctx.save();
    ctx.scale(canvas.width / VIRTUAL_WIDTH, canvas.height / VIRTUAL_HEIGHT);

    ctx.strokeStyle = "rgba(113, 82, 38, 0.16)";
    ctx.lineWidth = 1;
    for (let meters = 1000; meters < pixelsToMeters(VIRTUAL_HEIGHT); meters += 1000) {
      const y = VIRTUAL_HEIGHT - metersToPixels(meters);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(VIRTUAL_WIDTH, y);
      ctx.stroke();
    }

    const terrainGradient = ctx.createLinearGradient(0, VIRTUAL_HEIGHT, 0, 0);
    terrainGradient.addColorStop(0, "#8f5d2b");
    terrainGradient.addColorStop(0.5, "#b27a3b");
    terrainGradient.addColorStop(1, "#d8b16f");
    ctx.fillStyle = terrainGradient;

    ctx.beginPath();
    ctx.moveTo(0, VIRTUAL_HEIGHT);
    for (let x = 0; x < VIRTUAL_WIDTH; x += 1) {
      ctx.lineTo(x, VIRTUAL_HEIGHT - game.groundPixels[x]);
    }
    ctx.lineTo(VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(111, 74, 31, 0.55)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = 0; x < VIRTUAL_WIDTH; x += 1) {
      const y = VIRTUAL_HEIGHT - game.groundPixels[x];
      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    drawTarget();
    drawHowitzer();
    drawScaleMarkers();
    ctx.restore();
  }

  function drawScaleMarkers() {
    ctx.fillStyle = "rgba(86, 62, 31, 0.76)";
    ctx.font = "10px monospace";

    for (let meters = 5000; meters < pixelsToMeters(VIRTUAL_WIDTH); meters += 5000) {
      const x = metersToPixels(meters);
      ctx.fillText(`${Math.round(meters / 1000)}km`, x - 10, VIRTUAL_HEIGHT - 10);
    }

    for (let meters = 2000; meters < pixelsToMeters(VIRTUAL_HEIGHT); meters += 2000) {
      const y = VIRTUAL_HEIGHT - metersToPixels(meters);
      ctx.fillText(`${meters}m`, 6, y - 4);
    }
  }

  function drawTarget() {
    const x = game.targetXPixel;
    const y = VIRTUAL_HEIGHT - game.targetYPixel;

    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = "#7f6840";
    ctx.fillRect(-8, -2, 16, 3);

    ctx.fillStyle = "#8f7450";
    ctx.beginPath();
    ctx.moveTo(-11, -2);
    ctx.lineTo(-6, -10);
    ctx.lineTo(-1, -2);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(1, -2);
    ctx.lineTo(7, -11);
    ctx.lineTo(12, -2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#5b4830";
    ctx.fillRect(-10, -2, 20, 2);
    ctx.fillRect(-2, -7, 4, 5);

    ctx.strokeStyle = "#3e321f";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-8, -2);
    ctx.lineTo(-8, -8);
    ctx.lineTo(-4, -8);
    ctx.moveTo(4, -2);
    ctx.lineTo(4, -9);
    ctx.lineTo(8, -9);
    ctx.stroke();
    ctx.restore();
  }

  function drawHowitzer() {
    const originX = HOWITZER_X_PIXELS;
    const originY = VIRTUAL_HEIGHT - game.howitzerYPixel;

    function rotateOffset(x, y, angle) {
      return {
        x: x * Math.cos(angle) + y * Math.sin(angle),
        y: y * Math.cos(angle) - x * Math.sin(angle),
      };
    }

    function drawQuad(points, color, angle = 0) {
      ctx.beginPath();
      points.forEach((point, index) => {
        const rotated = rotateOffset(point[0], point[1], angle);
        const px = originX + rotated.x;
        const py = originY - rotated.y;
        if (index === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      });
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    }

    const muzzle = [
      { points: [[-2.0, 8.0], [2.0, 8.0], [2.0, 6.5], [-2.0, 6.5]], color: "#121409" },
      { points: [[-0.5, 0.0], [0.5, 0.0], [0.5, 18.0], [-0.8, 18.0]], color: "#24290f" },
      { points: [[-1.5, 0.0], [1.5, 0.0], [1.5, 10.0], [-1.5, 10.0]], color: "#4a521f" },
    ];

    const baseLeft = [
      { points: [[-10.0, 0.0], [3.0, 0.0], [3.0, 2.0], [-7.0, 2.0]], color: "#4a521f" },
      { points: [[-5.0, 0.0], [-4.0, 0.0], [-1.0, 5.0], [-1.0, 5.0]], color: "#4a521f" },
      { points: [[3.0, 0.0], [3.0, 3.0], [2.0, 3.0], [2.0, 0.0]], color: "#000000" },
    ];

    const baseRight = [
      { points: [[10.0, 0.0], [-3.0, 0.0], [-3.0, 2.0], [7.0, 2.0]], color: "#4a521f" },
      { points: [[5.0, 0.0], [4.0, 0.0], [1.0, 5.0], [1.0, 5.0]], color: "#4a521f" },
      { points: [[-3.0, 0.0], [-3.0, 3.0], [-2.0, 3.0], [-2.0, 0.0]], color: "#000000" },
    ];

    const base = game.angle > 0 && game.angle < Math.PI ? baseRight : baseLeft;
    base.forEach((quad) => drawQuad(quad.points, quad.color));
    muzzle.forEach((quad) => drawQuad(quad.points, quad.color, game.angle));

    if (game.projectileActive && game.currentTime < 2.0) {
      const flashSegments = [
        [[-11, 21], [11, 21]],
        [[-11, 19], [11, 19]],
        [[-15, 20], [15, 20]],
        [[-7, 21], [7, 21]],
        [[-7, 19], [7, 19]],
        [[-10, 20], [10, 20]],
        [[-2, 21], [2, 21]],
        [[-2, 19], [2, 19]],
        [[-5, 20], [5, 20]],
        [[-2, 20], [2, 20]],
      ];

      flashSegments.forEach((segment, index) => {
        const intensity = (10 - index) / 10;
        const start = rotateOffset(segment[0][0], segment[0][1], game.angle);
        const end = rotateOffset(segment[1][0], segment[1][1], game.angle);
        ctx.strokeStyle = `rgb(255 ${Math.round(intensity * 255)} ${Math.round(intensity * 255)})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(originX + start.x, originY - start.y);
        ctx.lineTo(originX + end.x, originY - end.y);
        ctx.stroke();
      });
    }
  }

  function drawProjectile() {
    if (!game.shellTrail.length) {
      return;
    }

    ctx.save();
    ctx.scale(canvas.width / VIRTUAL_WIDTH, canvas.height / VIRTUAL_HEIGHT);

    ctx.strokeStyle = "rgba(207, 179, 111, 0.35)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    game.shellTrail.forEach((point, index) => {
      const x = metersToPixels(point.x);
      const y = VIRTUAL_HEIGHT - metersToPixels(point.y);
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    const shellX = metersToPixels(game.shell.x);
    const shellY = VIRTUAL_HEIGHT - metersToPixels(game.shell.y);
    const shellAngle = Math.atan2(game.shell.dx, game.shell.dy);
    ctx.save();
    ctx.translate(shellX, shellY);
    ctx.rotate(shellAngle);

    ctx.fillStyle = game.hit ? "#f2d18b" : "#d7d4cf";
    ctx.beginPath();
    ctx.moveTo(0, -SHELL_LENGTH_PIXELS * 0.7);
    ctx.lineTo(SHELL_RADIUS_PIXELS, -SHELL_LENGTH_PIXELS * 0.22);
    ctx.lineTo(SHELL_RADIUS_PIXELS, SHELL_LENGTH_PIXELS * 0.5);
    ctx.lineTo(-SHELL_RADIUS_PIXELS, SHELL_LENGTH_PIXELS * 0.5);
    ctx.lineTo(-SHELL_RADIUS_PIXELS, -SHELL_LENGTH_PIXELS * 0.22);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#a3895e";
    ctx.fillRect(-SHELL_RADIUS_PIXELS, SHELL_LENGTH_PIXELS * 0.22, SHELL_RADIUS_PIXELS * 2, SHELL_LENGTH_PIXELS * 0.18);

    ctx.strokeStyle = "rgba(103, 72, 28, 0.75)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  function drawExplosion() {
    if (!game.explosionAt || game.explosionTime <= 0) {
      return;
    }

    const progress = 1 - game.explosionTime / EXPLOSION_DURATION;
    const x = metersToPixels(game.explosionAt.x) * (canvas.width / VIRTUAL_WIDTH);
    const y = (VIRTUAL_HEIGHT - metersToPixels(game.explosionAt.y)) * (canvas.height / VIRTUAL_HEIGHT);
    const outerRadius = 10 + progress * 18;
    const innerRadius = 4 + progress * 8;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    const blast = ctx.createRadialGradient(x, y, 0, x, y, outerRadius);
    blast.addColorStop(0, `rgba(255, 247, 210, ${0.95 * (1 - progress)})`);
    blast.addColorStop(0.35, `rgba(255, 188, 92, ${0.8 * (1 - progress)})`);
    blast.addColorStop(0.75, `rgba(214, 98, 28, ${0.45 * (1 - progress)})`);
    blast.addColorStop(1, "rgba(214, 98, 28, 0)");
    ctx.fillStyle = blast;
    ctx.beginPath();
    ctx.arc(x, y, outerRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(121, 66, 23, ${0.5 * (1 - progress)})`;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 8; i += 1) {
      const angle = (Math.PI * 2 * i) / 8 + progress * 0.35;
      const start = innerRadius;
      const end = outerRadius * 0.95;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(angle) * start, y + Math.sin(angle) * start);
      ctx.lineTo(x + Math.cos(angle) * end, y + Math.sin(angle) * end);
      ctx.stroke();
    }

    ctx.restore();
  }

  function draw() {
    drawBackground();
    drawGround();
    drawProjectile();
    drawExplosion();
  }

  function updateHud() {
    hud.status.textContent = game.statusText;
    hud.angle.textContent = `${(game.angle / DEG_TO_RAD).toFixed(1)} deg`;
    hud.shots.textContent = String(game.shotsTaken);
    hud.bestMiss.textContent = Number.isFinite(game.bestMissMeters) ? `${Math.round(game.bestMissMeters)} m` : "--";
    hud.flight.textContent = `${game.currentTime.toFixed(1)} s`;
    hud.distance.textContent = `${Math.round(game.flightDistanceMeters)} m`;
    hud.height.textContent = `${Math.round(game.maxHeightMeters)} m`;
    hud.target.textContent = game.targetText;
  }

  function resizeCanvas() {
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    draw();
  }

  function rotateHowitzer(clockwise) {
    if (!game.running) {
      return;
    }

    game.angle = normalizeAngle(game.angle + (clockwise ? 0.01 : -0.01));
    game.statusText = "Aiming";
  }

  function raiseHowitzer(isUp) {
    if (!game.running) {
      return;
    }

    const delta = isUp ? 0.001 : -0.001;
    const isRight = game.angle > 0 && game.angle < Math.PI;
    game.angle = normalizeAngle(game.angle + (isRight ? -delta : delta));
    game.statusText = "Aiming";
  }

  function applyControls() {
    if (controls.rotateRight) {
      rotateHowitzer(true);
    }
    if (controls.rotateLeft) {
      rotateHowitzer(false);
    }
    if (controls.raise) {
      raiseHowitzer(true);
    }
    if (controls.lower) {
      raiseHowitzer(false);
    }

    if (controls.rotateRight || controls.rotateLeft || controls.raise || controls.lower) {
      updateHud();
    }
  }

  function setControlState(key, isPressed) {
    switch (key) {
      case "ArrowLeft":
      case "a":
      case "A":
        controls.rotateLeft = isPressed;
        return true;
      case "ArrowRight":
      case "d":
      case "D":
        controls.rotateRight = isPressed;
        return true;
      case "ArrowUp":
      case "w":
      case "W":
        controls.raise = isPressed;
        return true;
      case "ArrowDown":
      case "s":
      case "S":
        controls.lower = isPressed;
        return true;
      default:
        return false;
    }
  }

  function beginGame() {
    menuOverlay.classList.add("hidden");
    game.running = true;
    game.lastFrameTime = 0;
    game.statusText = "Aiming";
    updateHud();
    window.focus();
  }

  function handleKeyDown(event) {
    if (setControlState(event.key, true)) {
      event.preventDefault();
      return;
    }

    switch (event.key) {
      case " ":
        fire();
        event.preventDefault();
        break;
      case "r":
      case "R":
        resetTerrain();
        if (game.running) {
          game.statusText = "New terrain";
          updateHud();
        }
        event.preventDefault();
        break;
      case "Enter":
        if (!game.running) {
          beginGame();
          event.preventDefault();
        }
        break;
      default:
        break;
    }
  }

  function handleKeyUp(event) {
    if (setControlState(event.key, false)) {
      event.preventDefault();
    }
  }

  function loop(timestamp) {
    updateSimulation(timestamp);
    draw();
    window.requestAnimationFrame(loop);
  }

  startButton.addEventListener("click", () => {
    resetTerrain();
    beginGame();
  });

  resetButton.addEventListener("click", () => {
    resetTerrain();
  });

  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);

  resetTerrain();
  resizeCanvas();
  window.requestAnimationFrame(loop);
})();
