const container = document.getElementById('preview-container');
const frameLayerEl = document.getElementById('frame-layer');
const colorLayer = document.getElementById('color-layer');
const selectOutline = document.getElementById('select-outline');
const emptyState = document.getElementById('empty-state');
const exportBtn = document.getElementById('export-btn');
const scaleSlider = document.getElementById('scale-slider');
const xSlider = document.getElementById('x-slider');
const ySlider = document.getElementById('y-slider');
const rotSlider = document.getElementById('rot-slider');

let frameImg = null;
let frameW = 0;
let frameH = 0;
let customSize = false;
let bgColor = '#ffffff';
let exportFmt = 'png';
let layers = [];
let selectedId = null;
let multiSelectedIds = new Set();
let nextId = 1;
let listDragId = null;
let cDragging = false;
let cDragStartX = 0;
let cDragStartY = 0;
let cDragOffX = 0;
let cDragOffY = 0;

function getSelected() {
  return layers.find((layer) => layer.id === selectedId) || null;
}

function getActiveLayer() {
  return layers.length === 1 ? layers[0] : getSelected();
}

function toggleCollapse(hId, bId) {
  const header = document.getElementById(hId);
  const body = document.getElementById(bId);
  header.classList.toggle('collapsed', body.classList.toggle('collapsed'));
}

function applyCanvasSize(w, h) {
  frameW = w;
  frameH = h;
  const maxW = Math.min(620, window.innerWidth - 340);
  const displayScale = w > maxW ? maxW / w : 1;
  container.style.width = `${w * displayScale}px`;
  container.style.height = `${h * displayScale}px`;
  container.dataset.displayScale = displayScale;
  emptyState.style.display = 'none';
  applyBgColor();
  layers.forEach((layer) => {
    autoFit(layer);
    renderLayer(layer);
  });
  updateOutline();
  checkExport();
}

function applyCustomSize() {
  if (frameImg) {
    return;
  }
  let w = Math.min(1600, Math.max(1, parseInt(document.getElementById('cw').value, 10) || 800));
  let h = Math.min(1600, Math.max(1, parseInt(document.getElementById('ch').value, 10) || 800));
  document.getElementById('cw').value = w;
  document.getElementById('ch').value = h;
  customSize = true;
  applyCanvasSize(w, h);
  document.getElementById('export-hint').textContent = `輸出尺寸 ${w} × ${h} px`;
  checkExport();
}

function loadFrame(input) {
  const file = input.files[0];
  if (!file) {
    return;
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = function onLoad() {
    frameImg = img;
    customSize = false;
    document.getElementById('custom-size-area').style.display = 'none';
    document.getElementById('frame-status').style.display = 'flex';
    document.getElementById('frame-name').textContent = file.name;
    frameLayerEl.src = url;
    frameLayerEl.style.display = 'block';
    applyCanvasSize(img.naturalWidth, img.naturalHeight);
    document.getElementById('export-hint').textContent = '輸出尺寸與邊框相同';
  };
  img.src = url;
}

function removeFrame() {
  frameImg = null;
  frameLayerEl.src = '';
  frameLayerEl.style.display = 'none';
  document.getElementById('frame-status').style.display = 'none';
  document.getElementById('frame-input').value = '';
  document.getElementById('custom-size-area').style.display = 'block';
  if (!customSize) {
    frameW = 0;
    frameH = 0;
    container.style.width = '';
    container.style.height = '';
    emptyState.style.display = 'flex';
    colorLayer.style.background = 'transparent';
    selectOutline.style.display = 'none';
  }
  checkExport();
}

function addBgImage(input) {
  const file = input.files[0];
  if (!file) {
    return;
  }
  input.value = '';
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = function onLoad() {
    const id = nextId++;
    const layer = {
      id,
      type: 'img',
      img,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      name: file.name
    };
    if (frameW && frameH) {
      autoFit(layer);
    }
    const el = document.createElement('img');
    el.className = 'bg-img-layer';
    el.src = url;
    el.dataset.layerId = id;
    layer.el = el;
    container.insertBefore(el, selectOutline);
    layers.push(layer);
    document.getElementById('bg-upload-label').textContent = '新增底圖';
    selectLayer(id);
    renderLayer(layer);
    renderLayerList();
    checkExport();
  };
  img.src = url;
}

function autoFit(layer) {
  if (!frameW || !frameH || layer.type === 'text') {
    return;
  }
  layer.scale = Math.max(frameW / layer.img.naturalWidth, frameH / layer.img.naturalHeight);
  layer.offsetX = (frameW - layer.img.naturalWidth * layer.scale) / 2;
  layer.offsetY = (frameH - layer.img.naturalHeight * layer.scale) / 2;
  layer.rotation = 0;
}

function selectLayer(id) {
  selectedId = id;
  renderLayerList();
  syncSlidersToSelected();
  updateAdjustUI();
  updateOutline();
  container.classList.toggle('mode-grab', !!getActiveLayer());
}

function syncSlidersToSelected() {
  const layer = getSelected();
  if (!layer) {
    return;
  }
  scaleSlider.min = 30;
  scaleSlider.value = Math.round(layer.scale * 100);
  xSlider.value = layer.offsetX;
  ySlider.value = layer.offsetY;
  rotSlider.value = layer.rotation;
  document.getElementById('scale-val').textContent = `${Math.round(layer.scale * 100)}%`;
  document.getElementById('x-val').textContent = `${Math.round(layer.offsetX)}px`;
  document.getElementById('y-val').textContent = `${Math.round(layer.offsetY)}px`;
  document.getElementById('rot-val').textContent = `${layer.rotation}°`;
}

function updateAdjustUI() {
  const hint = document.getElementById('no-select-hint');
  const controls = document.getElementById('adjust-controls');
  const needSelect = layers.length > 1 && selectedId === null;
  hint.style.display = needSelect ? 'block' : 'none';
  controls.style.display = needSelect ? 'none' : 'block';
}

function renderLayer(layer) {
  if (!layer.el) {
    return;
  }
  const displayScale = parseFloat(container.dataset.displayScale || 1);
  if (layer.type === 'text') {
    layer.el.textContent = layer.text;
    layer.el.style.fontFamily = layer.fontFamily;
    layer.el.style.fontSize = `${layer.fontSize * displayScale}px`;
    layer.el.style.color = layer.color;
    layer.el.style.fontWeight = layer.bold ? 'bold' : 'normal';
    layer.el.style.fontStyle = layer.italic ? 'italic' : 'normal';
    layer.el.style.textAlign = layer.textAlign || 'left';
    layer.el.style.letterSpacing = `${(layer.letterSpacing || 0) * displayScale}px`;
    layer.el.style.lineHeight = layer.lineHeight || 1.25;
    layer.el.style.left = `${layer.offsetX * displayScale}px`;
    layer.el.style.top = `${layer.offsetY * displayScale}px`;
    layer.el.style.transformOrigin = 'top left';
    layer.el.style.transform = `rotate(${layer.rotation}deg)`;
    return;
  }

  const width = layer.img.naturalWidth * layer.scale * displayScale;
  const height = layer.img.naturalHeight * layer.scale * displayScale;
  const centerX = layer.offsetX * displayScale + width / 2;
  const centerY = layer.offsetY * displayScale + height / 2;
  layer.el.style.width = `${width}px`;
  layer.el.style.height = `${height}px`;
  layer.el.style.left = `${centerX - width / 2}px`;
  layer.el.style.top = `${centerY - height / 2}px`;
  layer.el.style.transformOrigin = 'center center';
  layer.el.style.transform = `rotate(${layer.rotation}deg)`;
}

function renderAllLayers() {
  layers.forEach(renderLayer);
}

function syncLayerDOM() {
  layers.forEach((layer) => {
    container.insertBefore(layer.el, selectOutline);
  });
}

function updateOutline() {
  const layer = getActiveLayer();
  if (!layer || !layer.el || !frameW) {
    selectOutline.style.display = 'none';
    return;
  }
  const displayScale = parseFloat(container.dataset.displayScale || 1);
  if (layer.type === 'text') {
    const textWidth = layer.el.scrollWidth || 10;
    const textHeight = layer.el.scrollHeight || layer.fontSize * displayScale;
    selectOutline.style.display = 'block';
    selectOutline.style.width = `${textWidth}px`;
    selectOutline.style.height = `${textHeight}px`;
    selectOutline.style.left = `${layer.offsetX * displayScale}px`;
    selectOutline.style.top = `${layer.offsetY * displayScale}px`;
    selectOutline.style.transform = `rotate(${layer.rotation}deg)`;
    selectOutline.style.transformOrigin = 'top left';
    return;
  }

  const width = layer.img.naturalWidth * layer.scale * displayScale;
  const height = layer.img.naturalHeight * layer.scale * displayScale;
  const centerX = layer.offsetX * displayScale + width / 2;
  const centerY = layer.offsetY * displayScale + height / 2;
  selectOutline.style.display = 'block';
  selectOutline.style.width = `${width}px`;
  selectOutline.style.height = `${height}px`;
  selectOutline.style.left = `${centerX - width / 2}px`;
  selectOutline.style.top = `${centerY - height / 2}px`;
  selectOutline.style.transform = `rotate(${layer.rotation}deg)`;
  selectOutline.style.transformOrigin = 'center center';
}

function hitTest(cx, cy) {
  const displayScale = parseFloat(container.dataset.displayScale || 1);
  for (let index = layers.length - 1; index >= 0; index -= 1) {
    const layer = layers[index];
    if (layer.type === 'text') {
      const width = (layer.el.scrollWidth || 10) / displayScale;
      const height = (layer.el.scrollHeight || layer.fontSize) / displayScale;
      const rad = (-layer.rotation * Math.PI) / 180;
      const dx = cx - layer.offsetX;
      const dy = cy - layer.offsetY;
      const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
      const ly = dx * Math.sin(rad) + dy * Math.cos(rad);
      if (lx >= 0 && lx <= width && ly >= 0 && ly <= height) {
        return layer;
      }
      continue;
    }

    const width = layer.img.naturalWidth * layer.scale;
    const height = layer.img.naturalHeight * layer.scale;
    const centerX = layer.offsetX + width / 2;
    const centerY = layer.offsetY + height / 2;
    const rad = (-layer.rotation * Math.PI) / 180;
    const dx = cx - centerX;
    const dy = cy - centerY;
    const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
    const ly = dx * Math.sin(rad) + dy * Math.cos(rad);
    if (lx >= -width / 2 && lx <= width / 2 && ly >= -height / 2 && ly <= height / 2) {
      return layer;
    }
  }
  return null;
}

container.addEventListener('mousedown', (event) => {
  if (!layers.length || !frameW) {
    return;
  }
  const displayScale = parseFloat(container.dataset.displayScale || 1);
  const rect = container.getBoundingClientRect();
  const cx = (event.clientX - rect.left) / displayScale;
  const cy = (event.clientY - rect.top) / displayScale;
  let target = hitTest(cx, cy);
  if (!target && layers.length === 1) {
    target = layers[0];
  }
  if (target) {
    if (event.shiftKey) {
      toggleMultiSelect(target.id);
    } else {
      if (target.id !== selectedId) {
        multiSelectedIds.clear();
        selectLayer(target.id);
      }
      cDragging = true;
      cDragStartX = event.clientX;
      cDragStartY = event.clientY;
      cDragOffX = target.offsetX;
      cDragOffY = target.offsetY;
      container.classList.add('mode-drag');
      container.classList.remove('mode-grab');
    }
  } else if (!event.shiftKey) {
    selectedId = null;
    multiSelectedIds.clear();
    renderLayerList();
    updateAdjustUI();
    updateOutline();
    updateAlignUI();
    container.classList.remove('mode-grab');
  }
  event.preventDefault();
});

window.addEventListener('mousemove', (event) => {
  if (!cDragging) {
    return;
  }
  const layer = getActiveLayer();
  if (!layer) {
    return;
  }
  const displayScale = parseFloat(container.dataset.displayScale || 1);
  layer.offsetX = cDragOffX + (event.clientX - cDragStartX) / displayScale;
  layer.offsetY = cDragOffY + (event.clientY - cDragStartY) / displayScale;
  xSlider.min = Math.min(-500, Math.floor(layer.offsetX));
  xSlider.max = Math.max(500, Math.ceil(layer.offsetX));
  ySlider.min = Math.min(-500, Math.floor(layer.offsetY));
  ySlider.max = Math.max(500, Math.ceil(layer.offsetY));
  xSlider.value = layer.offsetX;
  ySlider.value = layer.offsetY;
  document.getElementById('x-val').textContent = `${Math.round(layer.offsetX)}px`;
  document.getElementById('y-val').textContent = `${Math.round(layer.offsetY)}px`;
  renderLayer(layer);
  updateOutline();
});

window.addEventListener('mouseup', () => {
  if (cDragging) {
    cDragging = false;
    container.classList.remove('mode-drag');
    container.classList.toggle('mode-grab', !!getActiveLayer());
  }
});

container.addEventListener(
  'touchstart',
  (event) => {
    if (!layers.length || !frameW) {
      return;
    }
    const displayScale = parseFloat(container.dataset.displayScale || 1);
    const rect = container.getBoundingClientRect();
    const touch = event.touches[0];
    const cx = (touch.clientX - rect.left) / displayScale;
    const cy = (touch.clientY - rect.top) / displayScale;
    let target = hitTest(cx, cy);
    if (!target && layers.length === 1) {
      target = layers[0];
    }
    if (target) {
      if (target.id !== selectedId) {
        selectLayer(target.id);
      }
      cDragging = true;
      cDragStartX = touch.clientX;
      cDragStartY = touch.clientY;
      cDragOffX = target.offsetX;
      cDragOffY = target.offsetY;
    }
    event.preventDefault();
  },
  { passive: false }
);

window.addEventListener(
  'touchmove',
  (event) => {
    if (!cDragging) {
      return;
    }
    const layer = getActiveLayer();
    if (!layer) {
      return;
    }
    const displayScale = parseFloat(container.dataset.displayScale || 1);
    const touch = event.touches[0];
    layer.offsetX = cDragOffX + (touch.clientX - cDragStartX) / displayScale;
    layer.offsetY = cDragOffY + (touch.clientY - cDragStartY) / displayScale;
    xSlider.value = layer.offsetX;
    ySlider.value = layer.offsetY;
    document.getElementById('x-val').textContent = `${Math.round(layer.offsetX)}px`;
    document.getElementById('y-val').textContent = `${Math.round(layer.offsetY)}px`;
    renderLayer(layer);
    updateOutline();
    event.preventDefault();
  },
  { passive: false }
);

window.addEventListener('touchend', () => {
  cDragging = false;
});

function updateTransform() {
  const layer = getActiveLayer();
  if (!layer) {
    return;
  }
  layer.scale = scaleSlider.value / 100;
  layer.offsetX = parseInt(xSlider.value, 10);
  layer.offsetY = parseInt(ySlider.value, 10);
  layer.rotation = parseInt(rotSlider.value, 10);
  document.getElementById('scale-val').textContent = `${scaleSlider.value}%`;
  document.getElementById('x-val').textContent = `${layer.offsetX}px`;
  document.getElementById('y-val').textContent = `${layer.offsetY}px`;
  document.getElementById('rot-val').textContent = `${layer.rotation}°`;
  renderLayer(layer);
  updateOutline();
}

function rotateBy(deg) {
  const layer = getActiveLayer();
  if (!layer) {
    return;
  }
  layer.rotation = ((layer.rotation + deg + 180) % 360) - 180;
  rotSlider.value = layer.rotation;
  document.getElementById('rot-val').textContent = `${layer.rotation}°`;
  renderLayer(layer);
  updateOutline();
}

function resetRotation() {
  const layer = getActiveLayer();
  if (!layer) {
    return;
  }
  layer.rotation = 0;
  rotSlider.value = 0;
  document.getElementById('rot-val').textContent = '0°';
  renderLayer(layer);
  updateOutline();
}

function renderLayerList() {
  const list = document.getElementById('layer-list');
  list.innerHTML = '';
  [...layers].reverse().forEach((layer, reverseIndex) => {
    const item = document.createElement('div');
    item.className = `layer-item${
      layer.id === selectedId ? ' selected' : multiSelectedIds.has(layer.id) ? ' multi-selected' : ''
    }`;
    item.dataset.layerId = layer.id;
    item.draggable = true;
    item.onclick = (event) => {
      if (event.shiftKey) {
        toggleMultiSelect(layer.id);
      } else {
        multiSelectedIds.clear();
        selectLayer(layer.id);
      }
    };

    const handle = document.createElement('span');
    handle.className = 'drag-handle';
    handle.textContent = '⠿';
    handle.title = '拖曳排序';
    handle.onmousedown = (event) => {
      event.stopPropagation();
    };
    item.appendChild(handle);

    const typeBadge = document.createElement('span');
    typeBadge.className = `layer-type-badge ${layer.type === 'text' ? 'badge-text' : 'badge-img'}`;
    typeBadge.textContent = layer.type === 'text' ? 'T' : 'IMG';
    item.appendChild(typeBadge);

    if (layer.type !== 'text') {
      const thumb = document.createElement('img');
      thumb.className = 'layer-thumb';
      thumb.src = layer.el.src;
      item.appendChild(thumb);
    } else {
      const textPreview = document.createElement('div');
      textPreview.style.cssText = `width:28px;height:28px;border-radius:4px;border:1px solid var(--border);background:var(--bg);display:flex;align-items:center;justify-content:center;font-size:14px;color:${layer.color};font-family:${layer.fontFamily};flex-shrink:0;overflow:hidden;`;
      textPreview.textContent = layer.text.charAt(0) || 'T';
      item.appendChild(textPreview);
    }

    const info = document.createElement('div');
    info.className = 'layer-info';
    const nameEl = document.createElement('div');
    nameEl.className = 'layer-name';
    nameEl.textContent = layer.name;
    const idxEl = document.createElement('div');
    idxEl.className = 'layer-index';
    idxEl.textContent = `圖層 ${reverseIndex + 1}`;
    info.appendChild(nameEl);
    info.appendChild(idxEl);
    item.appendChild(info);

    const actions = document.createElement('div');
    actions.className = 'layer-actions';
    const delBtn = document.createElement('button');
    delBtn.className = 'layer-btn del';
    delBtn.title = '刪除';
    delBtn.textContent = '✕';
    delBtn.onclick = (event) => {
      event.stopPropagation();
      deleteLayer(layer.id);
    };
    actions.appendChild(delBtn);
    item.appendChild(actions);
    list.appendChild(item);

    item.addEventListener('dragstart', (event) => {
      listDragId = layer.id;
      item.classList.add('dragging-source');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(layer.id));
    });

    item.addEventListener('dragend', () => {
      listDragId = null;
      item.classList.remove('dragging-source');
      list.querySelectorAll('.layer-item').forEach((el) => el.classList.remove('drag-over'));
    });

    item.addEventListener('dragover', (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      list.querySelectorAll('.layer-item').forEach((el) => el.classList.remove('drag-over'));
      if (layer.id !== listDragId) {
        item.classList.add('drag-over');
      }
    });

    item.addEventListener('dragleave', () => {
      item.classList.remove('drag-over');
    });

    item.addEventListener('drop', (event) => {
      event.preventDefault();
      item.classList.remove('drag-over');
      if (listDragId === null || listDragId === layer.id) {
        return;
      }
      const fromIndex = layers.findIndex((entry) => entry.id === listDragId);
      const toIndex = layers.findIndex((entry) => entry.id === layer.id);
      if (fromIndex < 0 || toIndex < 0) {
        return;
      }
      const moved = layers.splice(fromIndex, 1)[0];
      layers.splice(toIndex, 0, moved);
      syncLayerDOM();
      renderLayerList();
    });
  });
}

function deleteLayer(id) {
  const index = layers.findIndex((layer) => layer.id === id);
  if (index < 0) {
    return;
  }
  layers[index].el.remove();
  layers.splice(index, 1);
  if (selectedId === id) {
    selectedId = layers.length > 0 ? layers[layers.length - 1].id : null;
  }
  const imageCount = layers.filter((layer) => layer.type !== 'text').length;
  if (imageCount === 0) {
    document.getElementById('bg-upload-label').textContent = '上傳底圖';
  }
  if (layers.length === 1) {
    selectLayer(layers[0].id);
  }
  renderLayerList();
  updateAdjustUI();
  syncSlidersToSelected();
  updateOutline();
  checkExport();
}

function hsbToRgb(h, s, b) {
  const sat = s / 100;
  const bri = b / 100;
  const k = (n) => (n + h / 60) % 6;
  const f = (n) => bri * (1 - sat * Math.max(0, Math.min(k(n), 4 - k(n), 1)));
  return [Math.round(f(5) * 255), Math.round(f(3) * 255), Math.round(f(1) * 255)];
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

function hexToHsb(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  let h = 0;
  if (delta) {
    if (max === r) {
      h = ((g - b) / delta + 6) % 6;
    } else if (max === g) {
      h = (b - r) / delta + 2;
    } else {
      h = (r - g) / delta + 4;
    }
    h *= 60;
  }
  return [Math.round(h), Math.round(max ? (delta / max) * 100 : 0), Math.round(max * 100)];
}

function applyBgColor() {
  colorLayer.style.background = bgColor === 'transparent' ? 'transparent' : bgColor;
  updateFormatLock();
}

function selectPreset(id, color) {
  ['black', 'white', 'transparent'].forEach((key) => {
    document.getElementById(`sw-${key}`).classList.remove('active');
  });
  document.getElementById(`sw-${id}`).classList.add('active');
  bgColor = color;
  applyBgColor();

  if (color !== 'transparent') {
    const [h, s, b] = hexToHsb(color);
    document.getElementById('hue-slider').value = h;
    document.getElementById('sat-slider').value = s;
    document.getElementById('bri-slider').value = b;
    document.getElementById('h-val').textContent = `${h}°`;
    document.getElementById('s-val').textContent = `${s}%`;
    document.getElementById('b-val').textContent = `${b}%`;
    document.getElementById('hsb-preview').style.background = color;
    document.getElementById('hsb-hex').textContent = color.toUpperCase();
  } else {
    document.getElementById('hsb-preview').style.background =
      'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0 0 / 10px 10px';
    document.getElementById('hsb-hex').textContent = '無底色';
  }
}

function updateHSB() {
  const h = +document.getElementById('hue-slider').value;
  const s = +document.getElementById('sat-slider').value;
  const b = +document.getElementById('bri-slider').value;
  document.getElementById('h-val').textContent = `${h}°`;
  document.getElementById('s-val').textContent = `${s}%`;
  document.getElementById('b-val').textContent = `${b}%`;
  const [r, g, blue] = hsbToRgb(h, s, b);
  const hex = rgbToHex(r, g, blue);
  document.getElementById('hsb-preview').style.background = hex;
  document.getElementById('hsb-hex').textContent = hex;
  bgColor = hex;
  applyBgColor();
  ['black', 'white', 'transparent'].forEach((key) => {
    document.getElementById(`sw-${key}`).classList.remove('active');
  });
}

function setFormat(fmt) {
  if (document.getElementById(`fmt-${fmt}`).disabled) {
    return;
  }
  exportFmt = fmt;
  document.getElementById('fmt-png').classList.toggle('active', fmt === 'png');
  document.getElementById('fmt-jpg').classList.toggle('active', fmt === 'jpg');
}

function updateFormatLock() {
  const isTransparent = bgColor === 'transparent';
  document.getElementById('fmt-jpg').disabled = isTransparent;
  document.getElementById('fmt-note').classList.toggle('visible', isTransparent);
  if (isTransparent) {
    exportFmt = 'png';
    setFormat('png');
  }
}

function checkExport() {
  exportBtn.disabled = !(frameW > 0 && frameH > 0 && layers.length > 0);
}

let modalFmt = 'png';

function openExportModal() {
  if (!frameW || !layers.length) {
    return;
  }
  const isTransparent = bgColor === 'transparent';
  document.getElementById('modal-fmt-jpg').disabled = isTransparent;
  document.getElementById('modal-fmt-note').style.display = isTransparent ? 'block' : 'none';
  if (isTransparent) {
    modalFmt = 'png';
  }
  modalSetFmt(modalFmt);
  document.getElementById('export-modal').classList.remove('hidden');
  document.getElementById('modal-filename').focus();
  document.getElementById('modal-filename').select();
}

function closeExportModal() {
  document.getElementById('export-modal').classList.add('hidden');
}

function modalSetFmt(fmt) {
  if (document.getElementById(`modal-fmt-${fmt}`).disabled) {
    return;
  }
  modalFmt = fmt;
  document.getElementById('modal-fmt-png').classList.toggle('active', fmt === 'png');
  document.getElementById('modal-fmt-jpg').classList.toggle('active', fmt === 'jpg');
}

document.getElementById('export-modal').addEventListener('click', function onOverlayClick(event) {
  if (event.target === this) {
    closeExportModal();
  }
});

document.getElementById('modal-filename').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    confirmExport();
  }
  if (event.key === 'Escape') {
    closeExportModal();
  }
});

function confirmExport() {
  let rawName = document.getElementById('modal-filename').value.trim() || 'output';
  rawName = rawName.replace(/\.(png|jpg|jpeg)$/i, '');
  exportImage(rawName, modalFmt);
  closeExportModal();
}

function exportImage(filename, fmt) {
  const exportName = filename || 'output';
  const useFmt = fmt || exportFmt;
  if (!frameW || !layers.length) {
    return;
  }

  const canvas = document.getElementById('canvas-hidden');
  canvas.width = frameW;
  canvas.height = frameH;
  const ctx = canvas.getContext('2d');

  if (bgColor !== 'transparent') {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, frameW, frameH);
  }

  layers.forEach((layer) => {
    ctx.save();
    if (layer.type === 'text') {
      const fontSize = layer.fontSize;
      const lineHeight = (layer.lineHeight || 1.25) * fontSize;
      const letterSpacing = layer.letterSpacing || 0;
      const align = layer.textAlign || 'left';
      ctx.font = `${layer.bold ? 'bold ' : ''}${layer.italic ? 'italic ' : ''}${fontSize}px ${layer.fontFamily}`;
      ctx.fillStyle = layer.color;
      ctx.textBaseline = 'top';
      ctx.textAlign = align;
      if (ctx.letterSpacing !== undefined) {
        ctx.letterSpacing = `${letterSpacing}px`;
      }
      ctx.translate(layer.offsetX, layer.offsetY);
      ctx.rotate((layer.rotation * Math.PI) / 180);
      const lines = layer.text.split('\n');
      const maxWidth = Math.max(...lines.map((line) => ctx.measureText(line).width));
      const xOffset = align === 'center' ? maxWidth / 2 : align === 'right' ? maxWidth : 0;
      lines.forEach((line, index) => {
        ctx.fillText(line, xOffset, index * lineHeight);
      });
    } else {
      const width = layer.img.naturalWidth * layer.scale;
      const height = layer.img.naturalHeight * layer.scale;
      const centerX = layer.offsetX + width / 2;
      const centerY = layer.offsetY + height / 2;
      ctx.translate(centerX, centerY);
      ctx.rotate((layer.rotation * Math.PI) / 180);
      ctx.drawImage(layer.img, -width / 2, -height / 2, width, height);
    }
    ctx.restore();
  });

  if (frameImg) {
    ctx.drawImage(frameImg, 0, 0, frameW, frameH);
  }

  const usePng = useFmt === 'png' || bgColor === 'transparent';
  const ext = usePng ? 'png' : 'jpg';
  canvas.toBlob(
    (blob) => {
      if (window.electronAPI && window.electronAPI.saveFile) {
        window.electronAPI.saveFile(`${exportName}.${ext}`, blob);
      } else {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${exportName}.${ext}`;
        anchor.click();
        URL.revokeObjectURL(url);
      }
    },
    usePng ? 'image/png' : 'image/jpeg',
    usePng ? undefined : 0.92
  );
}

let allFonts = [
  { family: 'Noto Sans TC', label: 'Noto Sans TC（預設）' },
  { family: 'serif', label: 'Serif' },
  { family: 'sans-serif', label: 'Sans-serif' },
  { family: 'monospace', label: 'Monospace' },
  { family: 'cursive', label: 'Cursive' }
];

function populateFontSelect(fonts) {
  const select = document.getElementById('font-select');
  select.innerHTML = '';
  fonts.forEach((font) => {
    const option = document.createElement('option');
    option.value = font.family;
    option.textContent = font.label || font.family;
    option.style.fontFamily = font.family;
    select.appendChild(option);
  });
  select.value = textFontFamily;
  if (!select.value && fonts.length) {
    select.selectedIndex = 0;
    textFontFamily = fonts[0].family;
  }
}

function filterFonts(query) {
  if (!query) {
    populateFontSelect(allFonts);
    return;
  }
  const lowerQuery = query.toLowerCase();
  const filtered = allFonts.filter((font) => font.family.toLowerCase().includes(lowerQuery));
  populateFontSelect(filtered);
}

async function loadSystemFonts() {
  const loading = document.getElementById('font-loading');
  loading.style.display = 'block';
  const loaded = [];

  if (window.electronAPI && window.electronAPI.getSystemFonts) {
    try {
      const systemFonts = await window.electronAPI.getSystemFonts();
      systemFonts.forEach((font) => {
        loaded.push({ family: font.family, label: font.family, file: font.file });
      });
    } catch (_error) {
      // Ignore font-loading errors and fall back to built-in fonts.
    }
  }

  if (!loaded.length && window.queryLocalFonts) {
    try {
      await navigator.permissions.query({ name: 'local-fonts' }).catch(() => ({ state: 'prompt' }));
      const fonts = await window.queryLocalFonts();
      const seen = new Set();
      fonts.forEach((font) => {
        if (!seen.has(font.family)) {
          seen.add(font.family);
          loaded.push({ family: font.family, label: font.family });
        }
      });
    } catch (_error) {
      // Ignore browser Local Font Access API errors.
    }
  }

  const builtIn = [
    { family: 'Noto Sans TC', label: 'Noto Sans TC' },
    { family: 'serif', label: 'Serif' },
    { family: 'sans-serif', label: 'Sans-serif' },
    { family: 'monospace', label: 'Monospace' },
    { family: 'cursive', label: 'Cursive' }
  ];

  if (loaded.length) {
    const systemSet = new Set(loaded.map((font) => font.family));
    builtIn.forEach((font) => {
      if (!systemSet.has(font.family)) {
        loaded.unshift(font);
      }
    });
    allFonts = loaded.sort((a, b) => a.family.localeCompare(b.family, 'zh-TW'));
    loading.textContent = `✓ 已載入 ${loaded.length} 個字型`;
    setTimeout(() => {
      loading.style.display = 'none';
    }, 2000);
  } else {
    allFonts = builtIn;
    loading.textContent = '（無法讀取系統字型，使用內建字型）';
    setTimeout(() => {
      loading.style.display = 'none';
    }, 3000);
  }

  populateFontSelect(allFonts);
}

document.getElementById('font-search').addEventListener('input', function onFontSearch() {
  filterFonts(this.value);
});

let textFontFamily = 'Noto Sans TC';
let textFontSize = 48;
let textColor = '#000000';
let textAlign = 'left';
let textLetterSpacing = 0;
let textLineHeight = 1.25;

function setTextAlign(value) {
  textAlign = value;
  ['left', 'center', 'right'].forEach((align) => {
    document.getElementById(`align-${align}`).classList.toggle('active', align === value);
  });
  const layer = getActiveLayer();
  if (layer && layer.type === 'text') {
    layer.textAlign = value;
    renderLayer(layer);
  }
}

function updateLetterSpacing() {
  textLetterSpacing = parseInt(document.getElementById('letter-spacing-slider').value, 10);
  document.getElementById('letter-spacing-val').textContent = `${textLetterSpacing}px`;
  const layer = getActiveLayer();
  if (layer && layer.type === 'text') {
    layer.letterSpacing = textLetterSpacing;
    renderLayer(layer);
    updateOutline();
  }
}

function updateLineHeight() {
  textLineHeight = parseFloat(document.getElementById('line-height-slider').value);
  document.getElementById('line-height-val').textContent = textLineHeight.toFixed(2);
  const layer = getActiveLayer();
  if (layer && layer.type === 'text') {
    layer.lineHeight = textLineHeight;
    renderLayer(layer);
    updateOutline();
  }
}

document.getElementById('font-select').addEventListener('change', function onFontChange() {
  textFontFamily = this.value;
  const layer = getActiveLayer();
  if (layer && layer.type === 'text') {
    layer.fontFamily = textFontFamily;
    renderLayer(layer);
    updateOutline();
    renderLayerList();
  }
});

function updateTextSize() {
  textFontSize = parseInt(document.getElementById('font-size-slider').value, 10);
  document.getElementById('font-size-val').textContent = `${textFontSize}px`;
  const layer = getActiveLayer();
  if (layer && layer.type === 'text') {
    layer.fontSize = textFontSize;
    renderLayer(layer);
    updateOutline();
  }
}

function updateTextColor(value) {
  textColor = value;
  document.getElementById('text-color-swatch').style.background = value;
  document.getElementById('text-color-hex').textContent = value.toUpperCase();
  const layer = getActiveLayer();
  if (layer && layer.type === 'text') {
    layer.color = textColor;
    renderLayer(layer);
    renderLayerList();
  }
}

function syncTextPanelToLayer(layer) {
  if (!layer || layer.type !== 'text') {
    return;
  }
  document.getElementById('text-input').value = layer.text;
  document.getElementById('font-select').value = layer.fontFamily;
  document.getElementById('font-size-slider').value = layer.fontSize;
  document.getElementById('font-size-val').textContent = `${layer.fontSize}px`;
  document.getElementById('text-color-picker').value = layer.color;
  document.getElementById('text-color-swatch').style.background = layer.color;
  document.getElementById('text-color-hex').textContent = layer.color.toUpperCase();
  textFontFamily = layer.fontFamily;
  textFontSize = layer.fontSize;
  textColor = layer.color;
  textAlign = layer.textAlign || 'left';
  textLetterSpacing = layer.letterSpacing || 0;
  textLineHeight = layer.lineHeight || 1.25;
  ['left', 'center', 'right'].forEach((align) => {
    document.getElementById(`align-${align}`).classList.toggle('active', align === textAlign);
  });
  document.getElementById('letter-spacing-slider').value = textLetterSpacing;
  document.getElementById('letter-spacing-val').textContent = `${textLetterSpacing}px`;
  document.getElementById('line-height-slider').value = textLineHeight;
  document.getElementById('line-height-val').textContent = textLineHeight.toFixed(2);
}

document.getElementById('text-input').addEventListener('input', function onTextInput() {
  const layer = getActiveLayer();
  if (layer && layer.type === 'text') {
    layer.text = this.value;
    renderLayer(layer);
    updateOutline();
    renderLayerList();
  }
});

function addTextLayer() {
  if (!frameW || !frameH) {
    alert('請先設定圖面（上傳邊框或自訂尺寸）');
    return;
  }
  const rawText = document.getElementById('text-input').value.trim();
  if (!rawText) {
    alert('請輸入文字內容');
    return;
  }
  const id = nextId++;
  const el = document.createElement('div');
  el.className = 'text-layer';
  el.dataset.layerId = id;
  const layer = {
    id,
    type: 'text',
    text: rawText,
    fontFamily: textFontFamily,
    fontSize: textFontSize,
    color: textColor,
    bold: false,
    italic: false,
    textAlign,
    letterSpacing: textLetterSpacing,
    lineHeight: textLineHeight,
    offsetX: frameW * 0.1,
    offsetY: frameH * 0.1,
    rotation: 0,
    scale: 1,
    name: rawText.substring(0, 12) + (rawText.length > 12 ? '…' : ''),
    el
  };
  container.insertBefore(el, selectOutline);
  layers.push(layer);
  renderLayer(layer);
  selectLayer(id);
  renderLayerList();
  checkExport();
}

const originalSelectLayer = selectLayer;
selectLayer = function selectAndSync(id) {
  originalSelectLayer(id);
  const layer = getSelected();
  if (layer && layer.type === 'text') {
    syncTextPanelToLayer(layer);
  }
  updateAlignUI();
};

function getLayerAABB(layer) {
  if (layer.type === 'text') {
    const displayScale = parseFloat(container.dataset.displayScale || 1);
    const width = (layer.el.scrollWidth || 10) / displayScale;
    const height = (layer.el.scrollHeight || layer.fontSize) / displayScale;
    return { x: layer.offsetX, y: layer.offsetY, w: width, h: height };
  }
  const width = layer.img.naturalWidth * layer.scale;
  const height = layer.img.naturalHeight * layer.scale;
  return { x: layer.offsetX, y: layer.offsetY, w: width, h: height };
}

function toggleMultiSelect(id) {
  if (selectedId !== null && !multiSelectedIds.has(selectedId)) {
    multiSelectedIds.add(selectedId);
  }
  if (multiSelectedIds.has(id)) {
    multiSelectedIds.delete(id);
    if (multiSelectedIds.size === 1) {
      selectedId = Array.from(multiSelectedIds)[0];
      multiSelectedIds.clear();
    } else if (multiSelectedIds.size === 0) {
      selectedId = null;
    }
  } else {
    multiSelectedIds.add(id);
    selectedId = null;
  }
  renderLayerList();
  updateAdjustUI();
  updateOutline();
  updateAlignUI();
}

function getAlignTargets() {
  if (multiSelectedIds.size >= 2) {
    return layers.filter((layer) => multiSelectedIds.has(layer.id));
  }
  const single = getSelected() || (layers.length === 1 ? layers[0] : null);
  return single ? [single] : [];
}

function updateAlignUI() {
  const targets = getAlignTargets();
  const hint = document.getElementById('align-mode-hint');
  const buttons = document.querySelectorAll('.align-panel-btn');
  if (targets.length === 0) {
    hint.textContent = '請先選取物件';
    buttons.forEach((button) => {
      button.disabled = true;
    });
  } else if (multiSelectedIds.size >= 2) {
    hint.textContent = `已選取 ${multiSelectedIds.size} 個物件，對齊基準：群組`;
    buttons.forEach((button) => {
      button.disabled = false;
    });
  } else {
    hint.textContent = '已選取 1 個物件，對齊基準：整個畫布';
    buttons.forEach((button) => {
      button.disabled = false;
    });
  }
}

function alignObjects(direction) {
  const targets = getAlignTargets();
  if (!targets.length) {
    return;
  }

  if (multiSelectedIds.size >= 2) {
    const boxes = targets.map(getLayerAABB);
    const gx1 = Math.min(...boxes.map((box) => box.x));
    const gy1 = Math.min(...boxes.map((box) => box.y));
    const gx2 = Math.max(...boxes.map((box) => box.x + box.w));
    const gy2 = Math.max(...boxes.map((box) => box.y + box.h));
    const groupWidth = gx2 - gx1;
    const groupHeight = gy2 - gy1;

    targets.forEach((layer) => {
      const box = getLayerAABB(layer);
      if (direction === 'left') layer.offsetX = gx1;
      if (direction === 'right') layer.offsetX = gx2 - box.w;
      if (direction === 'hcenter') layer.offsetX = gx1 + (groupWidth - box.w) / 2;
      if (direction === 'top') layer.offsetY = gy1;
      if (direction === 'bottom') layer.offsetY = gy2 - box.h;
      if (direction === 'vcenter') layer.offsetY = gy1 + (groupHeight - box.h) / 2;
      renderLayer(layer);
    });
  } else {
    const layer = targets[0];
    const box = getLayerAABB(layer);
    if (direction === 'left') layer.offsetX = 0;
    if (direction === 'right') layer.offsetX = frameW - box.w;
    if (direction === 'hcenter') layer.offsetX = (frameW - box.w) / 2;
    if (direction === 'top') layer.offsetY = 0;
    if (direction === 'bottom') layer.offsetY = frameH - box.h;
    if (direction === 'vcenter') layer.offsetY = (frameH - box.h) / 2;
    renderLayer(layer);
    syncSlidersToSelected();
  }
  updateOutline();
}

document.getElementById('custom-size-area').style.display = 'block';
loadSystemFonts();
updateAlignUI();

window.toggleCollapse = toggleCollapse;
window.applyCustomSize = applyCustomSize;
window.loadFrame = loadFrame;
window.removeFrame = removeFrame;
window.addBgImage = addBgImage;
window.updateTransform = updateTransform;
window.rotateBy = rotateBy;
window.resetRotation = resetRotation;
window.selectPreset = selectPreset;
window.updateHSB = updateHSB;
window.setFormat = setFormat;
window.openExportModal = openExportModal;
window.closeExportModal = closeExportModal;
window.modalSetFmt = modalSetFmt;
window.confirmExport = confirmExport;
window.setTextAlign = setTextAlign;
window.updateLetterSpacing = updateLetterSpacing;
window.updateLineHeight = updateLineHeight;
window.updateTextSize = updateTextSize;
window.updateTextColor = updateTextColor;
window.addTextLayer = addTextLayer;
window.alignObjects = alignObjects;
