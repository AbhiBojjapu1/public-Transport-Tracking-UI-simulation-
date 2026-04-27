/* ════════════════════════════════════════════════════════
   app.js — Main loop & orchestration
   ════════════════════════════════════════════════════════ */

(function () {

  const canvas = document.getElementById('map-canvas');
  let selectedId = null;
  let lastTime   = performance.now();
  let frameIdx   = 0;

  /* ── VEHICLE SELECTION ─────────────────────────────── */
  window._onVehicleSelect = function (idOrNull) {
    if (!idOrNull || idOrNull === selectedId) {
      // Deselect
      selectedId = null;
      VEHICLES.forEach(v => v.selected = false);
      MapRenderer.setSelectedVehicle(null);
      UI.showTooltip(null);
      UI.showRouteDetail(null);
    } else {
      selectedId = idOrNull;
      VEHICLES.forEach(v => v.selected = v.id === idOrNull);
      MapRenderer.setSelectedVehicle(idOrNull);
      const v = VEHICLES.find(v => v.id === idOrNull);
      UI.showTooltip(v || null);
      UI.showRouteDetail(v || null);
    }
    UI.renderVehicleList(selectedId);
  };

  /* ── MAP INIT ──────────────────────────────────────── */
  MapRenderer.init(canvas, (vehicle) => {
    window._onVehicleSelect(vehicle ? vehicle.id : null);
  });

  /* ── UI INIT ───────────────────────────────────────── */
  UI.initControls();
  UI.renderAlerts();
  UI.renderHeatmap();
  UI.updateMarquee();

  /* ── MAIN LOOP ─────────────────────────────────────── */
  function loop(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.1); // seconds, capped
    lastTime = now;
    frameIdx++;

    // Tick simulation
    tickVehicles(dt);
    MapRenderer.tick(dt);

    // Render map every frame
    const highlightRoute = selectedId
      ? (VEHICLES.find(v => v.id === selectedId)?.route || 'ALL')
      : 'ALL';
    MapRenderer.render(highlightRoute);

    // Update clock every frame
    UI.updateClock();

    // Update panels at lower rate
    if (frameIdx % 30 === 0) {                 // ~1/sec
      UI.renderVehicleList(selectedId);
      UI.renderStats();
      UI.renderHealthBars();
    }
    if (frameIdx % 60 === 0) {                 // ~2/sec
      UI.renderTimetable();
    }
    if (frameIdx % 180 === 0) {                // ~6/sec
      UI.renderHeatmap();
      UI.updateMarquee();
    }

    // Update selected vehicle tooltip in real-time
    if (selectedId) {
      const v = VEHICLES.find(v => v.id === selectedId);
      if (v) UI.showTooltip(v);
    }

    requestAnimationFrame(loop);
  }

  /* ── KEYBOARD SHORTCUTS ────────────────────────────── */
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      document.getElementById('search-input').focus();
    }
    if (e.key === 'Escape') {
      window._onVehicleSelect(null);
      document.getElementById('search-input').blur();
    }
    if (e.key === '+' || e.key === '=') MapRenderer.zoomIn();
    if (e.key === '-')                   MapRenderer.zoomOut();
    if (e.key === '0')                   MapRenderer.zoomFit();
    // Arrow keys to select next/prev vehicle
    if (e.key === 'ArrowRight') {
      const idx = VEHICLES.findIndex(v => v.id === selectedId);
      const next = VEHICLES[(idx + 1) % VEHICLES.length];
      window._onVehicleSelect(next.id);
    }
    if (e.key === 'ArrowLeft') {
      const idx = VEHICLES.findIndex(v => v.id === selectedId);
      const prev = VEHICLES[(idx - 1 + VEHICLES.length) % VEHICLES.length];
      window._onVehicleSelect(prev.id);
    }
  });

  /* ── INITIAL RENDER THEN START ─────────────────────── */
  UI.renderVehicleList(null);
  UI.renderStats();
  UI.renderHealthBars();
  UI.renderTimetable();

  requestAnimationFrame(loop);

})();
