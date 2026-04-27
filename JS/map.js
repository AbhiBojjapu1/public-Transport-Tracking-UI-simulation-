/* ════════════════════════════════════════════════════════
   map.js — Canvas-based city map renderer
   ════════════════════════════════════════════════════════ */

const MapRenderer = (() => {

  let canvas, ctx, W, H;
  let zoom = 1;
  let panX = 0, panY = 0;
  let isDragging = false;
  let dragStart = { x: 0, y: 0 };
  let lastPan   = { x: 0, y: 0 };
  let selectedVehicleId = null;
  let glowPhase = 0;
  let frameCount = 0;
  let trailMap = {};   // vehicle trails

  // Convert world coords [0..1] to canvas pixels
  function toCanvasX(wx) { return (wx * W * zoom) + panX; }
  function toCanvasY(wy) { return (wy * H * zoom) + panY; }

  // Inverse
  function toWorldX(cx) { return (cx - panX) / (W * zoom); }
  function toWorldY(cy) { return (cy - panY) / (H * zoom); }

  /* ── CITY GRID ─────────────────────────────────────── */
  function drawCityGrid() {
    const cols = 20, rows = 14;
    const bW = W / cols, bH = H / rows;

    const isDark = !document.body.classList.contains('light');

    // Base city background
    const grad = ctx.createLinearGradient(0, 0, W, H);
    if (isDark) {
      grad.addColorStop(0, '#040a12');
      grad.addColorStop(1, '#080f1c');
    } else {
      grad.addColorStop(0, '#d4e3f7');
      grad.addColorStop(1, '#c2d4ee');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // City blocks
    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);

    const blockColor = isDark ? '#080f1c' : '#b8ccee';
    const blockBorder = isDark ? '#0c1624' : '#a5bde6';
    const roadColor   = isDark ? '#040a10' : '#8aabd4';
    const roadAlpha   = isDark ? 0.8 : 0.6;

    // Draw road grid first
    ctx.strokeStyle = roadColor;
    ctx.lineWidth = 6 / zoom;
    ctx.globalAlpha = roadAlpha;
    for (let c = 0; c <= cols; c++) {
      ctx.beginPath();
      ctx.moveTo(c * bW * W / W, 0);
      ctx.lineTo(c * bW * W / W, H);
      ctx.stroke();
    }
    for (let r = 0; r <= rows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * bH * H / H);
      ctx.lineTo(W, r * bH * H / H);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // City blocks
    const blockW = (W / cols) * 0.82;
    const blockH = (H / rows) * 0.75;
    const bOffX  = (W / cols) * 0.09;
    const bOffY  = (H / rows) * 0.125;

    ctx.fillStyle = blockColor;
    ctx.strokeStyle = blockBorder;
    ctx.lineWidth = 0.5 / zoom;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (Math.random() < 0.05) continue; // random gaps (parks)
        const x = c * (W / cols) + bOffX;
        const y = r * (H / rows) + bOffY;
        ctx.fillRect(x, y, blockW, blockH);
        ctx.strokeRect(x, y, blockW, blockH);

        // Random building detail
        if (isDark && Math.random() < 0.3) {
          ctx.fillStyle = '#0f1e30';
          const bx = x + blockW * 0.1;
          const by = y + blockH * 0.1;
          const bw = blockW * 0.8;
          const bh = blockH * 0.8;
          ctx.fillRect(bx, by, bw, bh);
          ctx.fillStyle = blockColor;
        }
      }
    }

    // Central landmark (station)
    const cx = W * 0.5, cy = H * 0.5;
    ctx.fillStyle = isDark ? '#0e2240' : '#a0bce0';
    ctx.strokeStyle = isDark ? '#1a4080' : '#7ea8d0';
    ctx.lineWidth = 1.5 / zoom;
    ctx.beginPath();
    ctx.roundRect(cx - 30, cy - 24, 60, 48, 6);
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = isDark ? '#1b4a8a66' : '#7ea8d066';
    ctx.beginPath();
    ctx.arc(cx, cy, 80, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /* ── ROUTE LINES ───────────────────────────────────── */
  function drawRoutes(highlighted) {
    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);

    ROUTES.forEach(route => {
      if (highlighted && route.id !== highlighted && !highlighted.startsWith('ALL')) return;

      const pts = route.stops.map(sid => {
        const s = STOPS.find(s => s.id === sid);
        return s ? { x: s.x * W, y: s.y * H } : null;
      }).filter(Boolean);

      if (pts.length < 2) return;

      const alpha = highlighted && route.id !== highlighted ? 0.12 : 0.55;

      // Draw glow
      ctx.beginPath();
      pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.strokeStyle = route.color;
      ctx.lineWidth = 8 / zoom;
      ctx.globalAlpha = alpha * 0.3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.filter = `blur(${4 / zoom}px)`;
      ctx.stroke();

      // Draw core line
      ctx.beginPath();
      pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.strokeStyle = route.color;
      ctx.lineWidth = 2.5 / zoom;
      ctx.globalAlpha = alpha;
      ctx.filter = 'none';
      ctx.stroke();

      // Dashes for metro
      if (route.type === 'metro') {
        ctx.setLineDash([8 / zoom, 4 / zoom]);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.8 / zoom;
        ctx.globalAlpha = alpha * 0.3;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.globalAlpha = 1;
    });

    ctx.restore();
  }

  /* ── STOPS ─────────────────────────────────────────── */
  function drawStops() {
    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);

    STOPS.forEach(stop => {
      const x = stop.x * W, y = stop.y * H;
      const r = 5 / zoom;

      // Glow ring
      const grd = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
      grd.addColorStop(0, '#ff6b3544');
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(x, y, r * 3, 0, Math.PI * 2);
      ctx.fill();

      // Core dot
      ctx.fillStyle = '#ff6b35';
      ctx.strokeStyle = '#060c14';
      ctx.lineWidth = 1.5 / zoom;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();

      // Label (only at zoom > 0.8)
      if (zoom > 0.6) {
        ctx.fillStyle = document.body.classList.contains('light') ? '#0d1f3c' : '#c8daf5';
        ctx.font = `${10 / zoom}px 'Space Mono', monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(stop.name, x, y - 8 / zoom);
      }
    });

    ctx.restore();
  }

  /* ── VEHICLE TRAILS ────────────────────────────────── */
  function updateTrails() {
    VEHICLES.forEach(v => {
      if (!trailMap[v.id]) trailMap[v.id] = [];
      trailMap[v.id].push({ x: v.x, y: v.y });
      if (trailMap[v.id].length > 20) trailMap[v.id].shift();
    });
  }

  function drawTrails() {
    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);

    VEHICLES.forEach(v => {
      const trail = trailMap[v.id];
      if (!trail || trail.length < 2) return;
      if (!v.selected && selectedVehicleId) return;

      ctx.beginPath();
      trail.forEach((pt, i) => {
        const px = pt.x * W, py = pt.y * H;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      });
      ctx.strokeStyle = v.color;
      ctx.lineWidth = 1.5 / zoom;
      ctx.globalAlpha = 0.25;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.globalAlpha = 1;
    });

    ctx.restore();
  }

  /* ── VEHICLES ──────────────────────────────────────── */
  function drawVehicles() {
    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);

    const glow = Math.sin(glowPhase) * 0.5 + 0.5; // 0..1

    VEHICLES.forEach(v => {
      const x = v.x * W, y = v.y * H;
      const size = (v.type === 'metro' ? 9 : v.type === 'tram' ? 7 : 7) / zoom;
      const isSelected = v.id === selectedVehicleId;
      const isDelayed  = v.status === 'delayed';

      // Ping on delayed
      if (isDelayed) {
        const pingR = (size * 2.5) + glow * size;
        ctx.beginPath();
        ctx.arc(x, y, pingR, 0, Math.PI * 2);
        ctx.strokeStyle = '#ff3b5c';
        ctx.lineWidth = 1 / zoom;
        ctx.globalAlpha = (1 - glow) * 0.7;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Selection ring
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(x, y, size * 2.2 + glow * 3, 0, Math.PI * 2);
        ctx.strokeStyle = v.color;
        ctx.lineWidth = 1.5 / zoom;
        ctx.globalAlpha = 0.7 + glow * 0.3;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Vehicle body
      ctx.save();
      ctx.translate(x, y);

      if (v.type === 'metro') {
        // Pill shape
        ctx.fillStyle = v.color;
        ctx.shadowColor = v.color;
        ctx.shadowBlur = isSelected ? 14 : 6;
        ctx.beginPath();
        const hw = size * 1.4, hh = size * 0.7;
        ctx.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2);
        ctx.fill();

        // Windows
        ctx.fillStyle = '#ffffff33';
        for (let i = -1; i <= 1; i++) {
          ctx.fillRect(i * hw * 0.45 - hw * 0.12, -hh * 0.5, hw * 0.2, hh * 0.9);
        }
      } else {
        // Bus / Tram box
        ctx.fillStyle = v.color;
        ctx.shadowColor = v.color;
        ctx.shadowBlur = isSelected ? 14 : 5;
        ctx.beginPath();
        ctx.roundRect(-size, -size * 0.6, size * 2, size * 1.2, 2 / zoom);
        ctx.fill();

        // Window strip
        ctx.fillStyle = '#ffffff22';
        ctx.fillRect(-size * 0.7, -size * 0.45, size * 1.4, size * 0.5);

        // Status LED
        ctx.fillStyle = isDelayed ? '#ff3b5c' : v.status === 'early' ? '#ffe347' : '#39ff8f';
        ctx.beginPath();
        ctx.arc(-size * 0.6, -size * 0.7, 1.5 / zoom, 0, Math.PI * 2);
        ctx.fill();
      }

      // ID label (selected only or zoom > 1.2)
      if (isSelected || zoom > 1.1) {
        ctx.fillStyle = '#ffffffcc';
        ctx.font = `bold ${7 / zoom}px 'Space Mono', monospace`;
        ctx.textAlign = 'center';
        ctx.shadowBlur = 0;
        ctx.fillText(v.id, 0, size + 9 / zoom);
      }

      ctx.restore();
    });

    ctx.restore();
  }

  /* ── FRAME ─────────────────────────────────────────── */
  function render(highlightRoute) {
    W = canvas.width;
    H = canvas.height;

    ctx.clearRect(0, 0, W, H);
    drawCityGrid();
    drawRoutes(highlightRoute || 'ALL');
    drawTrails();
    drawStops();
    drawVehicles();

    // Crosshair radar ring at center when nothing selected
    if (!selectedVehicleId) {
      const cx = W / 2 + panX * 0, cy = H / 2 + panY * 0;
      // Minimal HUD corner brackets
      const bSize = 20;
      ctx.strokeStyle = '#00d4ff22';
      ctx.lineWidth = 1;
      [[12, 12], [W - 12, 12], [12, H - 12], [W - 12, H - 12]].forEach(([bx, by]) => {
        const sx = bx < W / 2 ? 1 : -1;
        const sy = by < H / 2 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(bx, by); ctx.lineTo(bx + sx * bSize, by);
        ctx.moveTo(bx, by); ctx.lineTo(bx, by + sy * bSize);
        ctx.stroke();
      });
    }
  }

  /* ── RESIZE ────────────────────────────────────────── */
  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width  = rect.width;
    canvas.height = rect.height;
  }

  /* ── INTERACTION ───────────────────────────────────── */
  function initInteraction(onVehicleClick) {
    canvas.addEventListener('mousedown', e => {
      isDragging = true;
      dragStart = { x: e.clientX, y: e.clientY };
      lastPan   = { x: panX, y: panY };
      canvas.style.cursor = 'grabbing';
    });

    canvas.addEventListener('mousemove', e => {
      if (isDragging) {
        panX = lastPan.x + (e.clientX - dragStart.x);
        panY = lastPan.y + (e.clientY - dragStart.y);
      } else {
        // Hover detection
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const wx = toWorldX(mx);
        const wy = toWorldY(my);
        let hit = false;
        VEHICLES.forEach(v => {
          const dx = (v.x - wx) * canvas.width;
          const dy = (v.y - wy) * canvas.height;
          if (Math.sqrt(dx*dx + dy*dy) < 12) hit = true;
        });
        canvas.style.cursor = hit ? 'pointer' : 'grab';
      }
    });

    canvas.addEventListener('mouseup', e => {
      if (!isDragging) return;
      const moved = Math.abs(e.clientX - dragStart.x) + Math.abs(e.clientY - dragStart.y);
      isDragging = false;
      canvas.style.cursor = 'grab';
      if (moved < 5) {
        // Click — check vehicle hit
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const wx = toWorldX(mx);
        const wy = toWorldY(my);
        let closest = null, closestDist = Infinity;
        VEHICLES.forEach(v => {
          const dx = (v.x - wx) * canvas.width * zoom;
          const dy = (v.y - wy) * canvas.height * zoom;
          const d  = Math.sqrt(dx*dx + dy*dy);
          if (d < 18 && d < closestDist) { closestDist = d; closest = v; }
        });
        if (closest) onVehicleClick(closest);
        else { selectedVehicleId = null; onVehicleClick(null); }
      }
    });

    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      panX = mx - (mx - panX) * factor;
      panY = my - (my - panY) * factor;
      zoom = Math.max(0.3, Math.min(4, zoom * factor));
    }, { passive: false });

    canvas.addEventListener('mouseleave', () => { isDragging = false; canvas.style.cursor = 'grab'; });
  }

  /* ── PUBLIC API ────────────────────────────────────── */
  function init(canvasEl, onVehicleClick) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    canvas.style.cursor = 'grab';
    resize();
    initInteraction(onVehicleClick);
    window.addEventListener('resize', resize);
  }

  function tick(dt) {
    glowPhase += dt * 2.5;
    frameCount++;
    if (frameCount % 2 === 0) updateTrails();
  }

  function setSelectedVehicle(id) { selectedVehicleId = id; }

  function zoomIn()  { zoom = Math.min(4,   zoom * 1.2); }
  function zoomOut() { zoom = Math.max(0.3, zoom * 0.83); }
  function zoomFit() { zoom = 1; panX = 0; panY = 0; }

  return { init, tick, render, resize, zoomIn, zoomOut, zoomFit, setSelectedVehicle };
})();
