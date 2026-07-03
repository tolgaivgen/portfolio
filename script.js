const loader = document.getElementById('loader');
const cursor = document.getElementById('cursor');
const cursorText = cursor.querySelector('span');
const wrap = document.getElementById('portraitWrap');
const portrait = document.getElementById('portrait');
portrait.setAttribute('draggable', 'false');

const FRAME_COUNT = 144;
const CENTER_FRAME = Math.floor((FRAME_COUNT - 1) / 2);
const FRAME_PATH = (i) => `assets/sequence/gif${String(i).padStart(3, '0')}.png`;

let mouseX = 0;
let mouseY = 0;
let currentX = 0;
let currentY = 0;
// The PNG sequence is a loop: front → right → front → left → front.
// For mouse control we only use the useful half-arcs and clamp them,
// so the portrait stays left/right until the mouse returns to center.
const LEFT_CENTER_FRAME = 143;
const LEFT_END_FRAME = 120;
const RIGHT_CENTER_FRAME = 0;
const RIGHT_END_FRAME = 48;

let targetAngle = 0; // -1 = left profile, 0 = front, 1 = right profile
let currentAngle = 0;
let lastFrame = -1;
let isPointerDown = false;
let isTouchDevice = window.matchMedia('(pointer: coarse)').matches;

const archiveCinema = document.getElementById('archiveCinema');
function updateArchiveCinema() {
  if (!archiveCinema) return;
  const rect = archiveCinema.getBoundingClientRect();
  const total = window.innerHeight + rect.height;
  const progress = clamp((window.innerHeight - rect.top) / total, 0, 1);
  archiveCinema.style.setProperty('--p', progress.toFixed(3));
}


function preloadFrames() {
  for (let i = 0; i < FRAME_COUNT; i++) {
    const img = new Image();
    img.src = FRAME_PATH(i);
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function frameFromAngle(angle) {
  const a = clamp(angle, -1, 1);

  if (a < 0) {
    const t = Math.abs(a);
    return Math.round(LEFT_CENTER_FRAME + (LEFT_END_FRAME - LEFT_CENTER_FRAME) * t);
  }

  const t = a;
  return Math.round(RIGHT_CENTER_FRAME + (RIGHT_END_FRAME - RIGHT_CENTER_FRAME) * t);
}

function setPointerPosition(clientX, clientY) {
  const x = clamp(clientX / window.innerWidth, 0, 1);
  const y = clamp(clientY / window.innerHeight, 0, 1);

  mouseX = (x - 0.5) * 2;
  mouseY = (y - 0.5) * 2;

  // Target angle is clamped.
  // Mouse left = left profile, mouse right = right profile.
  // Sequence direction is inverted, so we flip mouseX before mapping.
  // It only returns to front when the mouse comes back to the center.
  targetAngle = -mouseX;
}

window.addEventListener('load', () => {
  preloadFrames();
  setTimeout(() => loader.classList.add('hide'), 2350);
});

window.addEventListener('mousemove', (e) => {
  // In paint mode the portrait stays locked; mouse only controls the brush.
  if (!paintMode) setPointerPosition(e.clientX, e.clientY);
  cursor.style.left = e.clientX + 'px';
  cursor.style.top = e.clientY + 'px';
});

wrap.addEventListener('touchstart', (e) => {
  isPointerDown = true;
  if (!paintMode && e.touches[0]) setPointerPosition(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: true });

wrap.addEventListener('touchmove', (e) => {
  if (!paintMode && e.touches[0]) setPointerPosition(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: true });

wrap.addEventListener('touchend', () => {
  isPointerDown = false;
  // Keep the last touched angle. It should not auto-return to front.
});

function animatePortrait() {
  const frameEase = isTouchDevice ? 0.16 : 0.11;
  const motionEase = isTouchDevice ? 0.12 : 0.08;

  currentX += (mouseX - currentX) * motionEase;
  currentY += (mouseY - currentY) * motionEase;
  currentAngle += (targetAngle - currentAngle) * frameEase;

  const frameIndex = frameFromAngle(currentAngle);
  if (frameIndex !== lastFrame) {
    portrait.src = FRAME_PATH(frameIndex);
    lastFrame = frameIndex;
  }

  const scroll = window.scrollY;
  document.body.classList.toggle('is-dark', scroll > window.innerHeight * 0.88);
  const heroScroll = Math.min(scroll / 520, 1);
  const scale = 1 - heroScroll * 0.22;
  const lift = heroScroll * -120;
  const opacity = 1 - Math.max(0, (scroll - 420) / 280);

  // The sequence already contains the real side angles. These transforms are deliberately subtle,
  // only adding weight and depth without making the portrait feel like a flat card.
  const rotateX = -currentY * 5;
  const moveX = currentX * 10;
  const moveY = currentY * 8;
  const microScale = 1 + Math.abs(currentX) * 0.018;

  wrap.style.transform = `translateY(${lift}px) scale(${scale}) rotateX(${rotateX}deg)`;
  wrap.style.opacity = Math.max(opacity, 0);
  portrait.style.transform = `translate3d(${moveX}px, ${moveY}px, 80px) scale(${microScale})`;

  updateArchiveCinema();

  requestAnimationFrame(animatePortrait);
}
animatePortrait();




// Paint mode: draw with mouse/touch on a fixed canvas behind the interface.
const paintCanvas = document.getElementById('paintCanvas');
const paintCtx = paintCanvas.getContext('2d');
const brushCursor = document.getElementById('brushCursor');
const paintToggle = document.getElementById('paintToggle');
const paintPanel = document.getElementById('paintPanel');
const paintClose = document.getElementById('paintClose');
const paintClear = document.getElementById('paintClear');
const paintButtons = document.querySelectorAll('[data-color]');
const brushSizeButtons = document.querySelectorAll('[data-size]');

let paintMode = false;
let isPainting = false;
let brushColor = '#FF3B30';
let brushSize = 28;
let lastPaintPoint = null;

function resizePaintCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const snapshot = document.createElement('canvas');
  snapshot.width = paintCanvas.width;
  snapshot.height = paintCanvas.height;
  if (paintCanvas.width && paintCanvas.height) {
    snapshot.getContext('2d').drawImage(paintCanvas, 0, 0);
  }

  paintCanvas.width = Math.floor(window.innerWidth * dpr);
  paintCanvas.height = Math.floor(window.innerHeight * dpr);
  paintCanvas.style.width = window.innerWidth + 'px';
  paintCanvas.style.height = window.innerHeight + 'px';
  paintCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  paintCtx.lineCap = 'round';
  paintCtx.lineJoin = 'round';

  if (snapshot.width && snapshot.height) {
    paintCtx.drawImage(snapshot, 0, 0, snapshot.width / dpr, snapshot.height / dpr, 0, 0, window.innerWidth, window.innerHeight);
  }
}
resizePaintCanvas();
window.addEventListener('resize', resizePaintCanvas);

function setBrushColor(color) {
  brushColor = color;
  document.documentElement.style.setProperty('--brush-color', color);
  paintButtons.forEach(btn => btn.classList.toggle('is-active', btn.dataset.color.toLowerCase() === color.toLowerCase()));
}

function setBrushSize(size) {
  brushSize = Number(size);
  brushCursor.style.width = `${brushSize}px`;
  brushCursor.style.height = `${brushSize}px`;
  brushSizeButtons.forEach(btn => btn.classList.toggle('is-active', Number(btn.dataset.size) === brushSize));
}

function setPaintMode(active) {
  paintMode = active;
  if (active) {
    // Freeze portrait exactly where it is when entering paint mode.
    mouseX = currentX;
    mouseY = currentY;
    targetAngle = currentAngle;
  }
  paintPanel.classList.toggle('is-open', active);
  paintPanel.setAttribute('aria-hidden', String(!active));
  paintToggle.classList.toggle('is-active', active);
  document.body.classList.toggle('paint-mode', active);
  if (!active) {
    isPainting = false;
    lastPaintPoint = null;
    document.body.classList.remove('is-painting');
  }
}

function isInsidePaintUi(target) {
  return target.closest && (target.closest('#paintPanel') || target.closest('#paintToggle'));
}

function drawPoint(x, y) {
  paintCtx.globalCompositeOperation = 'source-over';
  paintCtx.strokeStyle = brushColor;
  paintCtx.fillStyle = brushColor;
  paintCtx.lineWidth = brushSize;
  paintCtx.globalAlpha = 0.88;

  if (!lastPaintPoint) {
    paintCtx.beginPath();
    paintCtx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    paintCtx.fill();
    lastPaintPoint = { x, y };
    return;
  }

  // Slightly imperfect double stroke gives it a dry sketch/brush feeling.
  paintCtx.beginPath();
  paintCtx.moveTo(lastPaintPoint.x, lastPaintPoint.y);
  paintCtx.lineTo(x, y);
  paintCtx.stroke();

  paintCtx.globalAlpha = 0.22;
  paintCtx.lineWidth = Math.max(2, brushSize * 0.28);
  paintCtx.beginPath();
  paintCtx.moveTo(lastPaintPoint.x + 2, lastPaintPoint.y - 1);
  paintCtx.lineTo(x + 2, y - 1);
  paintCtx.stroke();

  paintCtx.globalAlpha = 1;
  lastPaintPoint = { x, y };
}

function moveBrushCursor(x, y) {
  brushCursor.style.left = x + 'px';
  brushCursor.style.top = y + 'px';
}

setBrushColor(brushColor);
setBrushSize(brushSize);

paintToggle.addEventListener('click', () => setPaintMode(!paintMode));
paintClose.addEventListener('click', () => setPaintMode(false));

paintButtons.forEach(btn => {
  btn.addEventListener('click', () => setBrushColor(btn.dataset.color));
});

brushSizeButtons.forEach(btn => {
  btn.addEventListener('click', () => setBrushSize(btn.dataset.size));
});

paintClear.addEventListener('click', () => {
  paintCtx.clearRect(0, 0, paintCanvas.width, paintCanvas.height);
});


// Prevent the browser from selecting/dragging the portrait while painting.
document.addEventListener('dragstart', (e) => {
  if (paintMode) e.preventDefault();
});

document.addEventListener('selectstart', (e) => {
  if (paintMode) e.preventDefault();
});

document.addEventListener('contextmenu', (e) => {
  if (paintMode && !isInsidePaintUi(e.target)) e.preventDefault();
});

document.addEventListener('pointerdown', (e) => {
  if (!paintMode || isInsidePaintUi(e.target)) return;
  e.preventDefault();
  isPainting = true;
  document.body.classList.add('is-painting');
  lastPaintPoint = null;
  moveBrushCursor(e.clientX, e.clientY);
  drawPoint(e.clientX, e.clientY);
});

document.addEventListener('pointermove', (e) => {
  if (!paintMode) return;
  if (isPainting) e.preventDefault();
  moveBrushCursor(e.clientX, e.clientY);
  if (isPainting) drawPoint(e.clientX, e.clientY);
});

document.addEventListener('pointerup', () => {
  isPainting = false;
  lastPaintPoint = null;
  document.body.classList.remove('is-painting');
});

document.addEventListener('pointerleave', () => {
  isPainting = false;
  lastPaintPoint = null;
  document.body.classList.remove('is-painting');
});

const hoverItems = document.querySelectorAll('a, button, .file');
hoverItems.forEach(item => {
  item.addEventListener('mouseenter', () => {
    cursor.classList.add('is-hover');
    cursorText.textContent = item.classList.contains('file') ? 'VIEW' : 'OPEN';
  });
  item.addEventListener('mouseleave', () => {
    cursor.classList.remove('is-hover');
    cursorText.textContent = '';
  });
});
