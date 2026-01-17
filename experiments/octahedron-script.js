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
  edges: [],
  streams: [],
  attachedPoints: [],
  lastTime: 0,
  showPoints: true,
  showEdges: true,
  pointer: { x: 0, y: 0, targetX: 0, targetY: 0 },
};

const rand = (min, max) => Math.random() * (max - min) + min;

const layout = {
  centerXRatio: 0.5,
  centerYRatio: 0.5,
  radiusRatio: 0.29,
  enableStreams: false,
  showOutline: false,
};

const showControls = true;

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

const normalizePoint = (point) => {
  const length = Math.hypot(point.x, point.y, point.z) || 1;
  return { x: point.x / length, y: point.y / length, z: point.z / length };
};

const buildEdgesByDistance = (points, thresholdScale = 1.05) => {
  let minDistance = Infinity;
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const dx = points[i].x - points[j].x;
      const dy = points[i].y - points[j].y;
      const dz = points[i].z - points[j].z;
      const distance = Math.hypot(dx, dy, dz);
      if (distance > 0 && distance < minDistance) {
        minDistance = distance;
      }
    }
  }
  const threshold = minDistance * thresholdScale;
  const edges = [];
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const dx = points[i].x - points[j].x;
      const dy = points[i].y - points[j].y;
      const dz = points[i].z - points[j].z;
      const distance = Math.hypot(dx, dy, dz);
      if (distance <= threshold) {
        edges.push([i, j]);
      }
    }
  }
  return edges;
};

const buildOctahedronData = () => {
  const rawPoints = [
    { x: 1, y: 0, z: 0 },
    { x: -1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: -1, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: 0, y: 0, z: -1 },
  ];

  const points = rawPoints.map((point) => ({
    ...normalizePoint(point),
    size: 2.6,
    color: "#38bdf8",
  }));
  const edges = buildEdgesByDistance(points, 1.2);
  return { points, edges };
};

const shapeData = buildOctahedronData();

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

  state.points = shapeData.points;
  state.edges = shapeData.edges;

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

const projectCartesian = (point, rotation) => {
  const radius = Math.min(state.width, state.height) * layout.radiusRatio;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const rotatedX = point.x * cos - point.z * sin;
  const rotatedZ = point.x * sin + point.z * cos;
  const rotatedY = point.y;
  const x = rotatedX * radius;
  const y = rotatedY * radius;
  const z = rotatedZ * radius;
  const scale = 0.8 + z / (radius * 3);
  return { x, y, z, scale, radius };
};

const drawShapeEdges = (centerX, centerY, rotation) => {
  if (!state.showEdges || !state.edges.length) {
    return;
  }
  globeCtx.save();
  globeCtx.lineWidth = 1;
  globeCtx.strokeStyle = "rgba(148, 163, 184, 0.35)";
  state.edges.forEach(([startIndex, endIndex]) => {
    const start = projectCartesian(state.points[startIndex], rotation);
    const end = projectCartesian(state.points[endIndex], rotation);
    const depth = (start.z + end.z) / (2 * start.radius);
    const alpha = 0.18 + Math.max(0, depth) * 0.5;
    if (start.z < -start.radius && end.z < -start.radius) {
      return;
    }
    globeCtx.globalAlpha = alpha;
    globeCtx.beginPath();
    globeCtx.moveTo(centerX + start.x, centerY + start.y);
    globeCtx.lineTo(centerX + end.x, centerY + end.y);
    globeCtx.stroke();
  });
  globeCtx.restore();
};

const drawShapePoints = (centerX, centerY, rotation) => {
  if (!state.showPoints || !state.points.length) {
    return;
  }
  globeCtx.save();
  state.points.forEach((point) => {
    const projected = projectCartesian(point, rotation);
    const depth = (projected.z / projected.radius + 1) / 2;
    const alpha = 0.2 + depth * 0.6;
    globeCtx.beginPath();
    globeCtx.fillStyle = point.color;
    globeCtx.globalAlpha = alpha;
    globeCtx.shadowBlur = 10;
    globeCtx.shadowColor = point.color;
    globeCtx.arc(
      centerX + projected.x,
      centerY + projected.y,
      point.size * projected.scale,
      0,
      Math.PI * 2
    );
    globeCtx.fill();
  });
  globeCtx.restore();
};

const svgPointToCanvas = (svg, point, canvasWidth, canvasHeight) => {
  const viewBox = svg.viewBox.baseVal;
  return {
    x: ((point.x - viewBox.x) / viewBox.width) * canvasWidth,
    y: ((point.y - viewBox.y) / viewBox.height) * canvasHeight,
  };
};

const spawnAttachedPoint = (pathId, size) => {
  const svg = document.querySelector(".hero-svg");
  const path = svg?.querySelector(pathId);
  if (!svg || !path) {
    return;
  }

  const end = path.getPointAtLength(path.getTotalLength());
  const canvasPos = svgPointToCanvas(svg, end, state.width, state.height);
  const centerX = state.width * layout.centerXRatio + state.pointer.x * 0.6;
  const centerY = state.height * layout.centerYRatio + state.pointer.y * 0.6;
  const radius = Math.min(state.width, state.height) * layout.radiusRatio;

  let dx = canvasPos.x - centerX;
  let dy = canvasPos.y - centerY;
  const distance = Math.hypot(dx, dy);
  if (distance > radius) {
    dx = (dx / distance) * radius;
    dy = (dy / distance) * radius;
  }

  const z = Math.sqrt(Math.max(radius * radius - dx * dx - dy * dy, 0));
  const lat = Math.asin(dy / radius);
  const lon = Math.atan2(z, dx);

  state.attachedPoints.push({
    lat,
    lon,
    bornAt: performance.now(),
    life: 3200,
    size,
    color: "#38bdf8",
  });
};

const renderAttachedPoints = (centerX, centerY, rotation) => {
  const now = performance.now();
  state.attachedPoints = state.attachedPoints.filter((point) => {
    const age = now - point.bornAt;
    if (age > point.life) {
      return false;
    }

    const projected = projectPoint(point.lat, point.lon, rotation);
    const alpha = (1 - age / point.life) * 0.7;
    const size = point.size * projected.scale;

    globeCtx.globalAlpha = alpha;
    globeCtx.fillStyle = point.color;
    globeCtx.beginPath();
    globeCtx.arc(centerX + projected.x, centerY + projected.y, size, 0, Math.PI * 2);
    globeCtx.fill();
    return true;
  });
  globeCtx.globalAlpha = 1;
};

const setupControls = () => {
  const panel = document.createElement("div");
  panel.id = "shape-controls";
  panel.style.cssText =
    "position:fixed;top:12px;left:12px;z-index:10;font-family:\"IBM Plex Mono\",\"SFMono-Regular\",Menlo,Consolas,monospace;font-size:10px;color:rgba(226, 232, 240, 0.7);background:rgba(2, 6, 23, 0.45);padding:6px 8px;border-radius:6px;border:1px solid rgba(148, 163, 184, 0.2);display:flex;gap:8px;align-items:center;";
  panel.innerHTML =
    '<label style="display:flex;gap:4px;align-items:center;cursor:pointer;"><input type="checkbox" id="toggle-points" checked />Points</label>' +
    '<label style="display:flex;gap:4px;align-items:center;cursor:pointer;"><input type="checkbox" id="toggle-edges" checked />Edges</label>';

  document.body.append(panel);

  const pointsToggle = panel.querySelector("#toggle-points");
  const edgesToggle = panel.querySelector("#toggle-edges");
  pointsToggle.addEventListener("change", () => {
    state.showPoints = pointsToggle.checked;
  });
  edgesToggle.addEventListener("change", () => {
    state.showEdges = edgesToggle.checked;
  });

  if (!showControls) {
    panel.style.display = "none";
  }
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

  const rotation = -time * 0.00015;
  const centerX = state.width * layout.centerXRatio + state.pointer.x * 0.6;
  const centerY = state.height * layout.centerYRatio + state.pointer.y * 0.6;

  drawStreams(centerX, centerY);

  const globeRadius = Math.min(state.width, state.height) * layout.radiusRatio;
  if (layout.showOutline) {
    globeCtx.strokeStyle = "rgba(148, 163, 184, 0.15)";
    globeCtx.lineWidth = 1;
    globeCtx.beginPath();
    globeCtx.ellipse(centerX, centerY, globeRadius, globeRadius, 0, 0, Math.PI * 2);
    globeCtx.stroke();
  }

  drawShapeEdges(centerX, centerY, rotation);
  drawShapePoints(centerX, centerY, rotation);

  globeCtx.globalAlpha = 1;
  globeCtx.globalCompositeOperation = "source-over";

  renderAttachedPoints(centerX, centerY, rotation);

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

const buildSvgRows = () => {
  const svg = document.querySelector(".hero-svg");
  if (!svg) {
    return;
  }

  const leftContainer = svg.querySelector("#left-rows");
  const rightContainer = svg.querySelector("#right-rows");
  if (!leftContainer || !rightContainer) {
    return;
  }

  leftContainer.textContent = "";
  rightContainer.textContent = "";

  const svgNS = "http://www.w3.org/2000/svg";
  const createSvgElement = (tag, attrs = {}) => {
    const element = document.createElementNS(svgNS, tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        element.setAttribute(key, String(value));
      }
    });
    return element;
  };

  const leftRows = [
    { label: "Traces", y: 100, begin: 0 },
    { label: "Spans", y: 128, begin: 0.35 },
    { label: "Sessions", y: 156, begin: 0.7 },
    { label: "Metrics", y: 184, begin: 1.05 },
    { label: "Logs", y: 212, begin: 1.4 },
    { label: "Alerts", y: 240, begin: 1.75 },
  ];

  leftRows.forEach((row, index) => {
    const group = createSvgElement("g");

    const label = createSvgElement("text", {
      x: 110,
      y: row.y,
      fill: "currentColor",
      "font-size": 7,
      opacity: 0.4,
      "dominant-baseline": "middle",
      "data-left-row": "",
      class: "shimmer-text",
    });
    label.textContent = row.label;
    group.append(label);

    [150, 162, 174].forEach((x, indexOffset) => {
      const opacity = [0.12, 0.18, 0.24][indexOffset];
      group.append(
        createSvgElement("circle", {
          cx: x,
          cy: row.y,
          r: 3,
          fill: "currentColor",
          opacity,
        })
      );
    });

    const movingDot = createSvgElement("circle", {
      r: 3,
      fill: "var(--secondary)",
      opacity: 0,
    });
    const motion = createSvgElement("animateMotion", {
      dur: "3s",
      begin: `${row.begin}s`,
      repeatCount: "indefinite",
      calcMode: "spline",
      keyTimes: "0;1",
      keySplines: "0.4 0 0.2 1",
    });
    motion.addEventListener("repeatEvent", () => {
      spawnAttachedPoint(`#left-path-${index}`, 3);
    });
    motion.append(
      createSvgElement("mpath", { href: `#left-path-${index}` })
    );
    const opacityAnim = createSvgElement("animate", {
      attributeName: "opacity",
      values: "0;0.7;0.4;0",
      dur: "3s",
      begin: `${row.begin}s`,
      repeatCount: "indefinite",
      keyTimes: "0;0.1;0.7;1",
    });
    const radiusAnim = createSvgElement("animate", {
      attributeName: "r",
      values: "3;1.4",
      dur: "3s",
      begin: `${row.begin}s`,
      repeatCount: "indefinite",
      keyTimes: "0;1",
      keySplines: "0.4 0 0.2 1",
      calcMode: "spline",
    });
    movingDot.append(motion, opacityAnim, radiusAnim);
    group.append(movingDot);

    leftContainer.append(group);
  });

  const rightRows = [
    { label: "Open File Formats", y: 120, begin: 0.5, staticBegin: 0 },
    { label: "Agent Replays", y: 148, begin: 0.9, staticBegin: 0.3 },
    { label: "Eval Datasets", y: 176, begin: 1.3, staticBegin: 0.6 },
    { label: "Feedback Stores", y: 204, begin: 1.7, staticBegin: 0.9 },
  ];

  rightRows.forEach((row, index) => {
    const group = createSvgElement("g");

    const movingDot = createSvgElement("circle", {
      r: 3,
      fill: "var(--secondary)",
      opacity: 0,
    });
    const motion = createSvgElement("animateMotion", {
      dur: "2.5s",
      begin: `${row.begin}s`,
      repeatCount: "indefinite",
      calcMode: "spline",
      keyTimes: "0;1",
      keySplines: "0.4 0 0.2 1",
    });
    motion.addEventListener("repeatEvent", () => {
      spawnAttachedPoint(`#output-path-${index}`, 1.4);
    });
    motion.append(
      createSvgElement("mpath", { href: `#output-path-${index}` })
    );
    const opacityAnim = createSvgElement("animate", {
      attributeName: "opacity",
      values: "0;0.8;0.8;0",
      dur: "2.5s",
      begin: `${row.begin}s`,
      repeatCount: "indefinite",
      keyTimes: "0;0.1;0.8;1",
    });
    const radiusAnim = createSvgElement("animate", {
      attributeName: "r",
      values: "1.4;3",
      dur: "2.5s",
      begin: `${row.begin}s`,
      repeatCount: "indefinite",
      keyTimes: "0;1",
      keySplines: "0.4 0 0.2 1",
      calcMode: "spline",
    });
    movingDot.append(motion, opacityAnim, radiusAnim);
    group.append(movingDot);

    const staticDot = createSvgElement("circle", {
      cx: 700,
      cy: row.y,
      r: 3,
      fill: "var(--secondary)",
      opacity: 0.85,
    });
    staticDot.append(
      createSvgElement("animate", {
        attributeName: "opacity",
        values: "0.7;0.95;0.7",
        dur: "3s",
        begin: `${row.staticBegin}s`,
        repeatCount: "indefinite",
      })
    );
    group.append(staticDot);

    const label = createSvgElement("text", {
      x: 708,
      y: row.y,
      fill: "currentColor",
      "font-size": 7,
      opacity: 0.7,
      "dominant-baseline": "middle",
      "font-weight": 500,
      "data-right-row": "",
      class: "shimmer-text",
    });
    label.textContent = row.label;
    group.append(label);

    rightContainer.append(group);
  });
};

const updateSvgPaths = () => {
  const svg = document.querySelector(".hero-svg");
  if (!svg) {
    return;
  }

  let leftConvergeX = 290;
  let rightConvergeX = 610;
  const rect = container?.getBoundingClientRect();
  const viewBox = svg.viewBox.baseVal;
  if (rect?.width && rect?.height && viewBox?.width && viewBox?.height) {
    const scaleX = viewBox.width / rect.width;
    const scaleY = viewBox.height / rect.height;
    const scale = Math.min(scaleX, scaleY);
    const globeCenterX = viewBox.x + rect.width * layout.centerXRatio * scaleX;
    const globeRadius = Math.min(rect.width, rect.height) * layout.radiusRatio * scale;
    const inset = 1.05;
    leftConvergeX = globeCenterX - globeRadius * inset;
    rightConvergeX = globeCenterX + globeRadius * inset;
  }

  const leftLabels = Array.from(svg.querySelectorAll("[data-left-row]"));
  const rightLabels = Array.from(svg.querySelectorAll("[data-right-row]"));

  const extractYs = (labels) =>
    labels
      .map((label) => Number(label.getAttribute("y")))
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b);

  const buildPaths = ({
    rows,
    startX,
    endX,
    pathPrefix,
    guideId,
    convergeAtStart,
  }) => {
    if (!rows.length) {
      return;
    }

    const controlX = startX + (endX - startX) * 0.45;
    const convergeY = rows.reduce((sum, value) => sum + value, 0) / rows.length;
    const spacing = rows.length > 1 ? rows[1] - rows[0] : 0;
    const mid = (rows.length - 1) / 2;
    const taper = 0.6;
    const guideSegments = [];

    rows.forEach((rowY, index) => {
      const offset = mid === 0 ? 0 : (index - mid) / mid;
      const base = convergeAtStart
        ? convergeY + (rowY - convergeY) * 0.35
        : rowY + (convergeY - rowY) * 0.35;
      const controlY = base - offset * spacing * taper;
      const d = convergeAtStart
        ? `M ${startX} ${convergeY} Q ${controlX} ${controlY} ${endX} ${rowY}`
        : `M ${startX} ${rowY} Q ${controlX} ${controlY} ${endX} ${convergeY}`;
      const path = svg.querySelector(`#${pathPrefix}-${index}`);
      if (path) {
        path.setAttribute("d", d);
      }
      guideSegments.push(d);
    });

    const guide = svg.querySelector(guideId);
    if (guide) {
      guide.setAttribute("d", guideSegments.join(" "));
    }
  };

  buildPaths({
    rows: extractYs(leftLabels),
    startX: 200,
    endX: leftConvergeX,
    pathPrefix: "left-path",
    guideId: "#left-guide",
    convergeAtStart: false,
  });
  buildPaths({
    rows: extractYs(rightLabels),
    startX: rightConvergeX,
    endX: 700,
    pathPrefix: "output-path",
    guideId: "#right-guide",
    convergeAtStart: true,
  });
};

const randomizeSvgTimings = () => {
  const svg = document.querySelector(".hero-svg");
  if (!svg) {
    return;
  }

  const motions = Array.from(svg.querySelectorAll("animateMotion"));
  motions.forEach((motion) => {
    const durAttr = motion.getAttribute("dur") || "3s";
    const duration = Number(durAttr.replace("s", "")) || 3;
    const offset = (Math.random() * duration).toFixed(2);
    motion.setAttribute("begin", `${offset}s`);

    const parent = motion.parentElement;
    if (parent) {
      parent.querySelectorAll("animate").forEach((animation) => {
        animation.setAttribute("begin", `${offset}s`);
      });
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
setupControls();
buildSvgRows();
resizeCanvas();
updateSvgPaths();
randomizeSvgTimings();

if (!prefersReduced.matches) {
  requestAnimationFrame(render);
}
