const petStage = document.querySelector('.pet-stage');
const petButton = document.querySelector('.pet-button');
const closeButton = document.querySelector('.close-button');
const bubble = document.querySelector('.bubble');
const canvas = document.querySelector('.pet-video-canvas');
const context = canvas.getContext('2d', { willReadFrequently: true });

const rawCanvas = document.createElement('canvas');
rawCanvas.width = canvas.width;
rawCanvas.height = canvas.height;
const rawContext = rawCanvas.getContext('2d', { willReadFrequently: true });

const actionVideo = document.createElement('video');
actionVideo.muted = true;
actionVideo.loop = true;
actionVideo.playsInline = true;
actionVideo.preload = 'auto';

const VIDEO_ACTIONS = [
  { src: '../assets/video-actions/action-1.mp4', line: '\u52a8\u4f5c 1' },
  { src: '../assets/video-actions/action-2.mp4', line: '\u52a8\u4f5c 2' },
  { src: '../assets/video-actions/action-3.mp4', line: '\u52a8\u4f5c 3' },
  { src: '../assets/video-actions/action-4.mp4', line: '\u52a8\u4f5c 4' },
  { src: '../assets/video-actions/action-5.mp4', line: '\u52a8\u4f5c 5' }
];

let isDragging = false;
let dragStart = null;
let movedDuringPress = false;
let bubbleTimer = null;
let actionTimer = null;
let frameId = null;
let currentActionIndex = -1;

function showBubble(text, duration = 900) {
  bubble.textContent = text;
  bubble.classList.add('is-visible');

  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => {
    bubble.classList.remove('is-visible');
  }, duration);
}

function median(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] || 0;
}

function estimateBackgroundColor(data, width, height) {
  const red = [];
  const green = [];
  const blue = [];
  const step = 8;

  function sample(x, y) {
    const index = (y * width + x) * 4;
    if (data[index + 3] === 0) return;
    red.push(data[index]);
    green.push(data[index + 1]);
    blue.push(data[index + 2]);
  }

  for (let x = 0; x < width; x += step) {
    sample(x, 0);
    sample(x, height - 1);
  }

  for (let y = 0; y < height; y += step) {
    sample(0, y);
    sample(width - 1, y);
  }

  if (red.length === 0) return [255, 255, 255];

  return [median(red), median(green), median(blue)];
}

function applyBackgroundCutout(frame, width, height) {
  const data = frame.data;
  const [bgR, bgG, bgB] = estimateBackgroundColor(data, width, height);
  const backgroundDistance = 54;
  const pixelCount = width * height;
  const backgroundMask = new Uint8Array(pixelCount);
  const queue = [];
  let queueIndex = 0;

  function isBackgroundLike(pixelIndex) {
    const index = pixelIndex * 4;
    if (data[index + 3] === 0) return true;

    const dr = data[index] - bgR;
    const dg = data[index + 1] - bgG;
    const db = data[index + 2] - bgB;
    const distance = Math.sqrt((dr * dr) + (dg * dg) + (db * db));

    return distance <= backgroundDistance;
  }

  function enqueue(pixelIndex) {
    if (pixelIndex < 0 || pixelIndex >= pixelCount || backgroundMask[pixelIndex]) return;
    if (!isBackgroundLike(pixelIndex)) return;

    backgroundMask[pixelIndex] = 1;
    queue.push(pixelIndex);
  }

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }

  for (let y = 0; y < height; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  while (queueIndex < queue.length) {
    const pixelIndex = queue[queueIndex];
    queueIndex += 1;

    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);

    if (x > 0) enqueue(pixelIndex - 1);
    if (x < width - 1) enqueue(pixelIndex + 1);
    if (y > 0) enqueue(pixelIndex - width);
    if (y < height - 1) enqueue(pixelIndex + width);
  }

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    const index = pixelIndex * 4;
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const greenDominance = green - Math.max(red, blue);
    const isGreenScreenSpill = green > 58 && greenDominance > 18;
    const isStrongGreenScreen = green > 82 && greenDominance > 34;

    if (backgroundMask[pixelIndex] || isStrongGreenScreen) {
      data[index + 3] = 0;
    } else if (isGreenScreenSpill) {
      const opacity = Math.max(0, Math.min(1, (greenDominance - 18) / 16));
      data[index + 3] = Math.round(255 * (1 - opacity));
    } else {
      data[index + 3] = 255;
    }
  }
}

function removeBottomRightWatermark(frame, width, height) {
  const data = frame.data;
  const pixelCount = width * height;
  const labels = new Int32Array(pixelCount);
  const queue = [];
  const components = [];
  let label = 0;

  labels.fill(-1);

  function isForeground(pixelIndex) {
    return data[(pixelIndex * 4) + 3] > 0;
  }

  function addPixel(component, pixelIndex) {
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    const index = pixelIndex * 4;
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const brightness = Math.max(red, green, blue);
    const chroma = brightness - Math.min(red, green, blue);

    component.area += 1;
    component.minX = Math.min(component.minX, x);
    component.minY = Math.min(component.minY, y);
    component.maxX = Math.max(component.maxX, x);
    component.maxY = Math.max(component.maxY, y);
    component.brightness += brightness;
    component.chroma += chroma;
  }

  for (let start = 0; start < pixelCount; start += 1) {
    if (labels[start] !== -1 || !isForeground(start)) continue;

    const component = {
      area: 0,
      minX: width,
      minY: height,
      maxX: 0,
      maxY: 0,
      brightness: 0,
      chroma: 0
    };
    let queueIndex = 0;

    queue.length = 0;
    queue.push(start);
    labels[start] = label;

    while (queueIndex < queue.length) {
      const pixelIndex = queue[queueIndex];
      queueIndex += 1;
      addPixel(component, pixelIndex);

      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);
      const neighbors = [
        x > 0 ? pixelIndex - 1 : -1,
        x < width - 1 ? pixelIndex + 1 : -1,
        y > 0 ? pixelIndex - width : -1,
        y < height - 1 ? pixelIndex + width : -1
      ];

      for (const neighbor of neighbors) {
        if (neighbor === -1 || labels[neighbor] !== -1 || !isForeground(neighbor)) continue;
        labels[neighbor] = label;
        queue.push(neighbor);
      }
    }

    components.push(component);
    label += 1;
  }

  if (components.length <= 1) return;

  const mainLabel = components.reduce((largestLabel, component, index) => {
    return component.area > components[largestLabel].area ? index : largestLabel;
  }, 0);
  const watermarkStartX = Math.floor(width * 0.54);
  const watermarkStartY = Math.floor(height * 0.74);
  const removableLabels = new Set();

  components.forEach((component, index) => {
    if (index === mainLabel) return;

    const componentWidth = component.maxX - component.minX + 1;
    const componentHeight = component.maxY - component.minY + 1;
    const avgBrightness = component.brightness / component.area;
    const avgChroma = component.chroma / component.area;
    const isInWatermarkCorner = component.maxX >= watermarkStartX && component.maxY >= watermarkStartY;
    const looksLikeWatermarkText = avgBrightness > 58 && avgChroma < 56 && component.area <= 900;
    const hasTextLikeShape = componentWidth <= 120 && componentHeight <= 52;

    if (isInWatermarkCorner && looksLikeWatermarkText && hasTextLikeShape) {
      removableLabels.add(index);
    }
  });

  if (removableLabels.size === 0) return;

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    if (removableLabels.has(labels[pixelIndex])) {
      data[(pixelIndex * 4) + 3] = 0;
    }
  }
}

function drawVideoContain(video, targetContext, width, height) {
  const videoRatio = video.videoWidth / video.videoHeight;
  const canvasRatio = width / height;
  let drawWidth = width;
  let drawHeight = height;

  if (videoRatio > canvasRatio) {
    drawHeight = width / videoRatio;
  } else {
    drawWidth = height * videoRatio;
  }

  const x = (width - drawWidth) / 2;
  const y = (height - drawHeight) / 2;
  targetContext.clearRect(0, 0, width, height);
  targetContext.drawImage(video, x, y, drawWidth, drawHeight);
}

function renderFrame() {
  frameId = requestAnimationFrame(renderFrame);

  if (actionVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;

  const width = canvas.width;
  const height = canvas.height;
  drawVideoContain(actionVideo, rawContext, width, height);

  const frame = rawContext.getImageData(0, 0, width, height);
  applyBackgroundCutout(frame, width, height);
  removeBottomRightWatermark(frame, width, height);
  context.putImageData(frame, 0, 0);
  petStage.classList.add('is-video-ready');
}

function playAction(index, announce = true) {
  const normalizedIndex = ((index % VIDEO_ACTIONS.length) + VIDEO_ACTIONS.length) % VIDEO_ACTIONS.length;
  const action = VIDEO_ACTIONS[normalizedIndex];
  currentActionIndex = normalizedIndex;

  if (!actionVideo.src.endsWith(action.src.replace('../', ''))) {
    actionVideo.src = action.src;
    actionVideo.load();
  }

  try {
    actionVideo.currentTime = 0;
  } catch (_error) {
    actionVideo.addEventListener('loadedmetadata', () => {
      actionVideo.currentTime = 0;
    }, { once: true });
  }

  actionVideo.play().catch(() => {
    petStage.classList.remove('is-video-ready');
  });

  if (!frameId) {
    renderFrame();
  }

  if (announce) {
    showBubble(action.line);
  }
}

function scheduleNextAction(delay = 4200) {
  clearTimeout(actionTimer);
  actionTimer = setTimeout(() => {
    if (!document.hidden && !isDragging) {
      playAction(currentActionIndex + 1, false);
    }

    scheduleNextAction();
  }, delay);
}

petStage.classList.remove('is-video-ready');
playAction(0, false);
scheduleNextAction();

petButton.addEventListener('pointerdown', async (event) => {
  if (event.button !== 0) return;

  isDragging = true;
  movedDuringPress = false;
  dragStart = { x: event.screenX, y: event.screenY };
  petButton.setPointerCapture(event.pointerId);
  await window.mimiPet.startDrag();
});

petButton.addEventListener('pointermove', async (event) => {
  if (!isDragging || !dragStart) return;

  const dx = Math.abs(event.screenX - dragStart.x);
  const dy = Math.abs(event.screenY - dragStart.y);
  if (dx + dy > 4) {
    movedDuringPress = true;
    await window.mimiPet.drag();
  }
});

petButton.addEventListener('pointerup', async (event) => {
  if (!isDragging) return;

  isDragging = false;
  dragStart = null;
  petButton.releasePointerCapture(event.pointerId);
  await window.mimiPet.endDrag();

  if (!movedDuringPress) {
    playAction(currentActionIndex + 1);
    scheduleNextAction();
  }
});

petButton.addEventListener('pointercancel', async () => {
  isDragging = false;
  dragStart = null;
  await window.mimiPet.endDrag();
});

closeButton.addEventListener('click', () => {
  window.mimiPet.close();
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    playAction(currentActionIndex, false);
    scheduleNextAction(1000);
  }
});
