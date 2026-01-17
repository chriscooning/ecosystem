const blobCanvas = document.getElementById("blobCanvas");
const globeCanvas = document.getElementById("globeCanvas");
const blobCtx = blobCanvas.getContext("2d");
const globeCtx = globeCanvas.getContext("2d");
const container = blobCanvas.closest(".hero-canvas");
const tabs = Array.from(document.querySelectorAll(".globe-tab"));
const mainTabs = tabs.filter((tab) => !tab.classList.contains("sub-tab"));
const subTabs = tabs.filter((tab) => tab.classList.contains("sub-tab"));

const state = {
  width: 0,
  height: 0,
  blobs: [],
  points: [],
  streams: [],
  lastTime: 0,
  pointer: { x: 0, y: 0, targetX: 0, targetY: 0 },
};

const rand = (min, max) => Math.random() * (max - min) + min;

const layout = {
  centerXRatio: 0.5,
  centerYRatio: 0.5,
  radiusRatio: 0.29,
  enableStreams: false,
};

const blobPalette = [
  ["rgba(79, 70, 229, 0.4)", "rgba(56, 189, 248, 0.0)"],
  ["rgba(56, 189, 248, 0.32)", "rgba(14, 116, 144, 0.0)"],
  ["rgba(148, 163, 184, 0.18)", "rgba(15, 23, 42, 0.0)"],
  ["rgba(139, 92, 246, 0.28)", "rgba(15, 23, 42, 0.0)"],
];

const globePalette = ["#38bdf8", "#6366f1", "#94a3b8"];

const createStreamParticle = (side, direction = "in") => {
  const fromEdge = direction === "in";
  const edgeX = side === "left" ? -rand(80, 240) : state.width + rand(80, 240);
  const centerX = state.width * layout.centerXRatio;
  const startX = fromEdge ? edgeX : centerX + rand(-40, 40);
  const endX = fromEdge ? centerX + rand(-40, 40) : edgeX;
  const startY = rand(state.height * 0.25, state.height * 0.75);
  const endY = startY + rand(-80, 80);
  const ctrlX =
    (startX + endX) / 2 +
    (side === "left" ? rand(80, 200) : rand(-200, -80));
  const ctrlY = (startY + endY) / 2 + rand(-120, 120);

  return {
    side,
    direction,
    t: Math.random(),
    speed: rand(0.0025, 0.007),
    startX,
    startY,
    ctrlX,
    ctrlY,
    endX,
    endY,
    size: rand(1.4, 2.8),
    color: globePalette[Math.floor(rand(0, globePalette.length))],
  };
};

const resetStreamParticle = (particle) => {
  Object.assign(particle, createStreamParticle(particle.side, particle.direction));
};

const quadraticAt = (p0, p1, p2, t) =>
  (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2;

const createBlob = (index) => ({
  baseX: rand(0.2, 0.8),
  baseY: rand(0.2, 0.8),
  radius: rand(140, 240),
  driftX: rand(50, 110),
  driftY: rand(40, 100),
  speed: rand(0.00025, 0.0005),
  phase: rand(0, Math.PI * 2),
  colors: blobPalette[index % blobPalette.length],
});

const createPoint = () => {
  const lat = rand(-Math.PI / 2, Math.PI / 2);
  const lon = rand(0, Math.PI * 2);
  return {
    lat,
    lon,
    size: rand(1.2, 2.4),
    color: globePalette[Math.floor(rand(0, globePalette.length))],
  };
};

const resizeCanvas = () => {
  const rect = container.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;

  [blobCanvas, globeCanvas].forEach((canvas) => {
    canvas.width = Math.floor(rect.width * scale);
    canvas.height = Math.floor(rect.height * scale);
  });

  blobCtx.setTransform(scale, 0, 0, scale, 0, 0);
  globeCtx.setTransform(scale, 0, 0, scale, 0, 0);

  state.width = rect.width;
  state.height = rect.height;
  state.blobs = Array.from({ length: 5 }, (_, index) => createBlob(index));

  const pointCount = Math.floor(rect.width / 6);
  state.points = Array.from({ length: pointCount }, createPoint);

  if (layout.enableStreams) {
    const streamCount = Math.floor(rect.width / 12);
    state.streams = Array.from({ length: streamCount }, (_, index) => {
      const side = index % 2 === 0 ? "left" : "right";
      const direction = index % 3 === 0 ? "out" : "in";
      return createStreamParticle(side, direction);
    });
  } else {
    state.streams = [];
  }
};

const drawBlobs = (time) => {
  blobCtx.clearRect(0, 0, state.width, state.height);
  blobCtx.globalCompositeOperation = "lighter";
  blobCtx.filter = "blur(36px)";

  state.blobs.forEach((blob) => {
    const offsetX = Math.sin(time * blob.speed + blob.phase) * blob.driftX;
    const offsetY = Math.cos(time * blob.speed + blob.phase) * blob.driftY;
    const x =
      blob.baseX * state.width +
      offsetX +
      state.pointer.x * 0.4;
    const y =
      blob.baseY * state.height +
      offsetY +
      state.pointer.y * 0.4;
    const radius =
      blob.radius +
      Math.sin(time * blob.speed * 1.2 + blob.phase) * 30;

    const gradient = blobCtx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, blob.colors[0]);
    gradient.addColorStop(1, blob.colors[1]);
    blobCtx.fillStyle = gradient;
    blobCtx.beginPath();
    blobCtx.arc(x, y, radius, 0, Math.PI * 2);
    blobCtx.fill();
  });

  blobCtx.filter = "none";
  blobCtx.globalCompositeOperation = "source-over";
};

const projectPoint = (lat, lon, rotation) => {
  const radius = Math.min(state.width, state.height) * layout.radiusRatio;
  const x = radius * Math.cos(lat) * Math.cos(lon + rotation);
  const y = radius * Math.sin(lat);
  const z = radius * Math.cos(lat) * Math.sin(lon + rotation);
  const scale = 0.8 + z / (radius * 3);
  return { x, y, z, scale, radius };
};

const updateStreams = (delta) => {
  if (!layout.enableStreams || !state.streams.length) {
    return;
  }

  state.streams.forEach((particle) => {
    particle.t += particle.speed * (delta / 16);
    if (particle.t >= 1) {
      resetStreamParticle(particle);
    }
  });
};

const drawStreams = (centerX, centerY) => {
  if (!layout.enableStreams || !state.streams.length) {
    return;
  }

  globeCtx.save();
  globeCtx.globalCompositeOperation = "lighter";

  globeCtx.lineWidth = 1;
  globeCtx.strokeStyle = "rgba(148, 163, 184, 0.14)";
  globeCtx.beginPath();
  globeCtx.moveTo(-160, centerY - 90);
  globeCtx.quadraticCurveTo(centerX - 260, centerY - 170, centerX - 30, centerY - 10);
  globeCtx.stroke();

  globeCtx.beginPath();
  globeCtx.moveTo(-140, centerY + 120);
  globeCtx.quadraticCurveTo(centerX - 220, centerY + 200, centerX - 20, centerY + 30);
  globeCtx.stroke();

  globeCtx.beginPath();
  globeCtx.moveTo(state.width + 160, centerY + 70);
  globeCtx.quadraticCurveTo(centerX + 260, centerY + 160, centerX + 30, centerY + 10);
  globeCtx.stroke();

  globeCtx.beginPath();
  globeCtx.moveTo(state.width + 140, centerY - 120);
  globeCtx.quadraticCurveTo(centerX + 220, centerY - 200, centerX + 20, centerY - 30);
  globeCtx.stroke();
  state.streams.forEach((particle) => {
    const x = quadraticAt(particle.startX, particle.ctrlX, particle.endX, particle.t);
    const y = quadraticAt(particle.startY, particle.ctrlY, particle.endY, particle.t);

    globeCtx.globalAlpha = 0.25 + particle.t * 0.65;
    globeCtx.fillStyle = particle.color;
    globeCtx.shadowBlur = 12;
    globeCtx.shadowColor = particle.color;
    globeCtx.beginPath();
    globeCtx.arc(x, y, particle.size, 0, Math.PI * 2);
    globeCtx.fill();
  });

  globeCtx.restore();
};

const drawGlobe = (time) => {
  globeCtx.clearRect(0, 0, state.width, state.height);
  globeCtx.globalCompositeOperation = "lighter";

  const rotation = -time * 0.00018;
  const centerX = state.width * layout.centerXRatio + state.pointer.x * 0.6;
  const centerY = state.height * layout.centerYRatio + state.pointer.y * 0.6;

  drawStreams(centerX, centerY);

  globeCtx.strokeStyle = "rgba(148, 163, 184, 0.15)";
  globeCtx.lineWidth = 1;
  globeCtx.beginPath();
  const globeRadius = Math.min(state.width, state.height) * layout.radiusRatio;
  globeCtx.ellipse(centerX, centerY, globeRadius, globeRadius, 0, 0, Math.PI * 2);
  globeCtx.stroke();

  state.points.forEach((point) => {
    const projected = projectPoint(point.lat, point.lon, rotation);
    const depth = (projected.z / projected.radius + 1) / 2;
    const alpha = 0.15 + depth * 0.6;
    const size = point.size * projected.scale;
    globeCtx.beginPath();
    globeCtx.fillStyle = point.color;
    globeCtx.globalAlpha = alpha;
    globeCtx.shadowBlur = 12;
    globeCtx.shadowColor = point.color;
    globeCtx.arc(centerX + projected.x, centerY + projected.y, size, 0, Math.PI * 2);
    globeCtx.fill();
  });

  globeCtx.globalAlpha = 1;
  globeCtx.globalCompositeOperation = "source-over";

  const tabPositions = new Map();
  tabs.forEach((tab) => {
    const lat = (Number(tab.dataset.lat) * Math.PI) / 180;
    const lon = (Number(tab.dataset.lon) * Math.PI) / 180;
    const projected = projectPoint(lat, lon, rotation);
    const depth = (projected.z / projected.radius + 1) / 2;
    const isVisible = projected.z > 0;
    tab.style.left = `${centerX + projected.x}px`;
    tab.style.top = `${centerY + projected.y}px`;
    tab.style.opacity = isVisible ? `${0.2 + depth * 0.9}` : "0";
    tab.classList.toggle("is-visible", isVisible);
    tabPositions.set(tab.textContent.trim(), {
      x: centerX + projected.x,
      y: centerY + projected.y,
      z: projected.z,
      visible: isVisible,
      depth,
    });
  });

  globeCtx.globalCompositeOperation = "source-over";
  globeCtx.lineWidth = 1.2;
  globeCtx.strokeStyle = "rgba(148, 163, 184, 0.4)";
  globeCtx.shadowBlur = 6;
  globeCtx.shadowColor = "rgba(148, 163, 184, 0.5)";

  subTabs.forEach((subTab) => {
    const parent = subTab.dataset.parent;
    const parentPos = tabPositions.get(parent);
    const childPos = tabPositions.get(subTab.textContent.trim());
    if (!parentPos || !childPos || !parentPos.visible || !childPos.visible) {
      return;
    }

    const midX = (parentPos.x + childPos.x) / 2;
    const midY = (parentPos.y + childPos.y) / 2 - 12;
    const alpha = 0.35 + Math.min(parentPos.depth, childPos.depth) * 0.45;
    globeCtx.globalAlpha = alpha;
    globeCtx.beginPath();
    globeCtx.moveTo(parentPos.x, parentPos.y);
    globeCtx.quadraticCurveTo(midX, midY, childPos.x, childPos.y);
    globeCtx.stroke();
  });

  globeCtx.globalAlpha = 1;
  globeCtx.shadowBlur = 0;
};

const updateSvgPaths = () => {
  const svg = document.querySelector(".hero-svg");
  if (!svg) {
    return;
  }

  const leftLabels = Array.from(svg.querySelectorAll("[data-left-row]"));
  const rightLabels = Array.from(svg.querySelectorAll("[data-right-row]"));

  const extractYs = (labels) =>
    labels
      .map((label) => Number(label.getAttribute("y")))
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b);

  const buildLeftPaths = (rows) => {
    if (!rows.length) {
      return;
    }

    const startX = 200;
    const endX = 290;
    const controlX = startX + (endX - startX) * 0.45;
    const convergeY = rows.reduce((sum, value) => sum + value, 0) / rows.length;
    const spacing = rows.length > 1 ? rows[1] - rows[0] : 0;
    const mid = (rows.length - 1) / 2;
    const taper = 0.6;
    const guideSegments = [];

    rows.forEach((rowY, index) => {
      const offset = mid === 0 ? 0 : (index - mid) / mid;
      const base = rowY + (convergeY - rowY) * 0.35;
      const controlY = base - offset * spacing * taper;
      const d = `M ${startX} ${rowY} Q ${controlX} ${controlY} ${endX} ${convergeY}`;
      const path = svg.querySelector(`#left-path-${index}`);
      if (path) {
        path.setAttribute("d", d);
      }
      guideSegments.push(d);
    });

    const guide = svg.querySelector("#left-guide");
    if (guide) {
      guide.setAttribute("d", guideSegments.join(" "));
    }
  };

  const buildRightPaths = (rows) => {
    if (!rows.length) {
      return;
    }

    const startX = 610;
    const endX = 700;
    const controlX = startX + (endX - startX) * 0.45;
    const convergeY = rows.reduce((sum, value) => sum + value, 0) / rows.length;
    const spacing = rows.length > 1 ? rows[1] - rows[0] : 0;
    const mid = (rows.length - 1) / 2;
    const taper = 0.6;
    const guideSegments = [];

    rows.forEach((rowY, index) => {
      const offset = mid === 0 ? 0 : (index - mid) / mid;
      const base = convergeY + (rowY - convergeY) * 0.35;
      const controlY = base - offset * spacing * taper;
      const d = `M ${startX} ${convergeY} Q ${controlX} ${controlY} ${endX} ${rowY}`;
      const path = svg.querySelector(`#output-path-${index}`);
      if (path) {
        path.setAttribute("d", d);
      }
      guideSegments.push(d);
    });

    const guide = svg.querySelector("#right-guide");
    if (guide) {
      guide.setAttribute("d", guideSegments.join(" "));
    }
  };

  buildLeftPaths(extractYs(leftLabels));
  buildRightPaths(extractYs(rightLabels));
};

const randomizeSvgTimings = () => {
  const svg = document.querySelector(".hero-svg");
  if (!svg) {
    return;
  }

  const motions = Array.from(svg.querySelectorAll("animatemotion"));
  motions.forEach((motion) => {
    const durAttr = motion.getAttribute("dur") || "3s";
    const duration = Number(durAttr.replace("s", "")) || 3;
    const offset = (Math.random() * duration).toFixed(2);
    motion.setAttribute("begin", `${offset}s`);

    const parent = motion.parentElement;
    if (parent) {
      const opacityAnim = parent.querySelector("animate[attributeName='opacity']");
      if (opacityAnim) {
        opacityAnim.setAttribute("begin", `${offset}s`);
      }
    }
  });
};

const updatePointer = () => {
  state.pointer.x += (state.pointer.targetX - state.pointer.x) * 0.06;
  state.pointer.y += (state.pointer.targetY - state.pointer.y) * 0.06;
};

const render = (time) => {
  const delta = time - state.lastTime;
  state.lastTime = time;
  if (delta > 80) {
    requestAnimationFrame(render);
    return;
  }

  updatePointer();
  updateStreams(delta);
  drawBlobs(time);
  drawGlobe(time);
  requestAnimationFrame(render);
};

const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)");

const handlePointer = (event) => {
  const rect = container.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width - 0.5) * 40;
  const y = ((event.clientY - rect.top) / rect.height - 0.5) * 30;
  state.pointer.targetX = x;
  state.pointer.targetY = y;
};

container.addEventListener("mousemove", handlePointer);
container.addEventListener("mouseleave", () => {
  state.pointer.targetX = 0;
  state.pointer.targetY = 0;
});

window.addEventListener("resize", () => {
  resizeCanvas();
  updateSvgPaths();
});
resizeCanvas();
updateSvgPaths();
randomizeSvgTimings();

if (!prefersReduced.matches) {
  requestAnimationFrame(render);
}
