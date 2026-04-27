/* ════════════════════════════════════════════════════════
   ui.js — Panel and widget rendering
   ════════════════════════════════════════════════════════ */

const UI = (() => {

  /* ── CLOCK ─────────────────────────────────────────── */
  function updateClock() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2,'0');
    const m = String(now.getMinutes()).padStart(2,'0');
    const s = String(now.getSeconds()).padStart(2,'0');
    document.getElementById('clock').textContent = `${h}:${m}:${s}`;
    document.getElementById('date-display').textContent =
      now.toLocaleDateString('en-GB', { weekday:'short', day:'2-digit', month:'short', year:'numeric' }).toUpperCase();
  }

  /* ── VEHICLE LIST ──────────────────────────────────── */
  let searchFilter = '';
  let typeFilter   = 'all';

  function renderVehicleList(selectedId) {
    const container = document.getElementById('vehicle-list');
    const term = searchFilter.toLowerCase();

    const filtered = VEHICLES.filter(v => {
      const matchType  = typeFilter === 'all' || v.type === typeFilter;
      const matchSearch = !term
        || v.id.toLowerCase().includes(term)
        || v.routeName.toLowerCase().includes(term)
        || ROUTES.find(r=>r.id===v.route)?.stops
            .map(sid => STOPS.find(s=>s.id===sid)?.name||'')
            .join(' ').toLowerCase().includes(term);
      return matchType && matchSearch;
    });

    // Update header counts
    document.getElementById('hdr-buses').textContent = VEHICLES.filter(v=>v.type==='bus').length;
    document.getElementById('hdr-metro').textContent = VEHICLES.filter(v=>v.type==='metro').length;
    document.getElementById('hdr-alerts').textContent = SERVICE_ALERTS.length;

    // Rebuild only if changed
    const newHTML = filtered.map(v => {
      const occ = Math.round(v.occupancy);
      const occClass = occ >= 80 ? 'high' : occ >= 50 ? 'medium' : 'low';
      const icon = VEHICLE_ICONS[v.type];
      const delay = v.delay > 0 ? `+${v.delay}m` : v.delay < 0 ? `${v.delay}m` : 'On time';
      const delayColor = v.delay > 0 ? 'red' : v.delay < 0 ? 'yellow' : 'green';
      const selected = v.id === selectedId ? 'selected' : '';

      return `<div class="vehicle-card ${v.type} ${selected}" data-id="${v.id}" tabindex="0">
        <div class="vc-top">
          <span class="vc-id">${icon} ${v.id}</span>
          <span class="vc-status ${v.status}">${v.status.replace('-',' ').toUpperCase()}</span>
        </div>
        <div class="vc-route">${v.routeName}</div>
        <div class="vc-meta">
          <div class="vc-meta-item">
            <span class="vc-meta-label">SPEED</span>
            <span class="vc-meta-val">${Math.round(v.speed)} km/h</span>
          </div>
          <div class="vc-meta-item">
            <span class="vc-meta-label">LOAD</span>
            <span class="vc-meta-val ${delayColor}">${occ}%</span>
          </div>
          <div class="vc-meta-item">
            <span class="vc-meta-label">DELAY</span>
            <span class="vc-meta-val ${delayColor}">${delay}</span>
          </div>
        </div>
        <div class="vc-occ-bar">
          <div class="vc-occ-track">
            <div class="vc-occ-fill ${occClass}" style="width:${occ}%"></div>
          </div>
        </div>
      </div>`;
    }).join('');

    container.innerHTML = newHTML;

    container.querySelectorAll('.vehicle-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        if (window._onVehicleSelect) window._onVehicleSelect(id);
      });
    });
  }

  /* ── ALERTS ────────────────────────────────────────── */
  function renderAlerts() {
    const container = document.getElementById('alerts-list');
    container.innerHTML = SERVICE_ALERTS.map(a => `
      <div class="alert-card ${a.type}">
        <div class="alert-title">${a.title}</div>
        <div class="alert-desc">${a.desc}</div>
        <div class="alert-time">${a.time}</div>
      </div>
    `).join('');
  }

  /* ── STATS OVERVIEW ────────────────────────────────── */
  const sparkHistory = { active: [], delayed: [], pass: [], ontime: [] };

  function renderStats() {
    const active   = VEHICLES.filter(v => v.speed > 3).length;
    const delayed  = VEHICLES.filter(v => v.status === 'delayed').length;
    const pass     = VEHICLES.reduce((s, v) => s + Math.round(v.occupancy * 1.2), 0);
    const ontime   = Math.round((VEHICLES.filter(v => v.status !== 'delayed').length / VEHICLES.length) * 100);

    document.getElementById('sv-active').textContent    = active;
    document.getElementById('sv-delayed').textContent   = delayed;
    document.getElementById('sv-passengers').textContent = pass.toLocaleString();
    document.getElementById('sv-ontime').textContent    = `${ontime}%`;

    sparkHistory.active.push(active);
    sparkHistory.delayed.push(delayed);
    sparkHistory.pass.push(Math.min(pass, 5000));
    sparkHistory.ontime.push(ontime);
    ['active','delayed','pass','ontime'].forEach(k => {
      if (sparkHistory[k].length > 30) sparkHistory[k].shift();
    });

    drawSparkline('spark-active',  sparkHistory.active,  '#00d4ff');
    drawSparkline('spark-delayed', sparkHistory.delayed, '#ff3b5c');
    drawSparkline('spark-pass',    sparkHistory.pass,    '#7fff72');
    drawSparkline('spark-ontime',  sparkHistory.ontime,  '#c97bff');

    // Avg speed in footer
    const avgSpd = Math.round(VEHICLES.reduce((s,v)=>s+v.speed,0) / VEHICLES.length);
    document.getElementById('avg-speed').textContent = avgSpd;
    document.getElementById('tracked-count').textContent = VEHICLES.length;

    // GPS latency simulation
    const lat = (Math.random() * 30 + 15).toFixed(0);
    document.getElementById('latency').textContent = `${lat}ms`;
    document.getElementById('gps-sync').textContent = '✓ SYNCED';
    document.getElementById('gps-sync').className = 'sb-val green';
  }

  function drawSparkline(elId, data, color) {
    const el = document.getElementById(elId);
    if (!data.length) return;
    const W = el.clientWidth || 120, H = 20;
    const min = Math.min(...data), max = Math.max(...data) || 1;
    const pts = data.map((v, i) => {
      const x = (i / Math.max(data.length - 1, 1)) * W;
      const y = H - ((v - min) / (max - min + 0.001)) * H;
      return `${x},${y}`;
    }).join(' ');
    el.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <defs>
        <linearGradient id="sg${elId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <polygon points="${pts} ${W},${H} 0,${H}" fill="url(#sg${elId})"/>
      <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5"/>
    </svg>`;
  }

  /* ── HEALTH BARS ───────────────────────────────────── */
  function renderHealthBars() {
    const container = document.getElementById('health-bars');
    const lines = [
      { name: 'Route 42', val: 72 + Math.sin(Date.now()/4000)*10, color: '#00d4ff' },
      { name: 'Route 7',  val: 88 + Math.sin(Date.now()/5000)*8,  color: '#00d4ff' },
      { name: 'Route 15', val: 55 + Math.sin(Date.now()/3500)*15, color: '#00d4ff' },
      { name: 'Metro A',  val: 61 + Math.sin(Date.now()/4500)*12, color: '#c97bff' },
      { name: 'Metro B',  val: 93 + Math.sin(Date.now()/6000)*5,  color: '#c97bff' },
      { name: 'Tram T1',  val: 80 + Math.sin(Date.now()/3000)*8,  color: '#7fff72' },
    ];

    container.innerHTML = lines.map(l => {
      const v = Math.max(0, Math.min(100, Math.round(l.val)));
      const c = v >= 80 ? l.color : v >= 50 ? '#ffe347' : '#ff3b5c';
      return `<div class="hb-row">
        <span class="hb-name">${l.name}</span>
        <div class="hb-track"><div class="hb-fill" style="width:${v}%;background:${c}"></div></div>
        <span class="hb-val">${v}%</span>
      </div>`;
    }).join('');
  }

  /* ── TIMETABLE ─────────────────────────────────────── */
  function renderTimetable() {
    const container = document.getElementById('timetable');
    const now = new Date();
    const rows = VEHICLES.slice(0, 8).map(v => {
      const etaMins = Math.floor(Math.random() * 12) + 1;
      const eta = new Date(now.getTime() + etaMins * 60000);
      const etaStr = `${String(eta.getHours()).padStart(2,'0')}:${String(eta.getMinutes()).padStart(2,'0')}`;
      const delayTxt = v.delay > 0 ? `+${v.delay}m` : 'OK';
      const delayClass = v.delay > 0 ? 'late' : 'ok';
      return `<div class="tt-row" data-id="${v.id}">
        <span class="tt-id">${v.id}</span>
        <span class="tt-route">${v.routeName}</span>
        <span class="tt-eta">${etaStr}</span>
        <span class="tt-delay ${delayClass}">${delayTxt}</span>
      </div>`;
    }).join('');
    container.innerHTML = rows;
    container.querySelectorAll('.tt-row').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.dataset.id;
        if (window._onVehicleSelect) window._onVehicleSelect(id);
      });
    });
  }

  /* ── HEATMAP ───────────────────────────────────────── */
  function renderHeatmap() {
    const container = document.getElementById('heatmap-row');
    const currentHour = new Date().getHours();
    const max = Math.max(...HOURLY_DEMAND);
    container.innerHTML = HOURLY_DEMAND.map((val, h) => {
      const pct = (val / max) * 100;
      const isCurrent = h === currentHour;
      const color = isCurrent ? '#00d4ff' :
        val > 80 ? '#ff3b5c' : val > 60 ? '#ff6b35' : val > 40 ? '#ffe347' : '#39ff8f';
      return `<div class="hm-bar" style="height:${Math.max(4,pct)}%;background:${color};opacity:${isCurrent?1:0.6}"
        data-hour="${String(h).padStart(2,'0')}" title="Hour ${h}: ${val} demand"></div>`;
    }).join('');
  }

  /* ── VEHICLE TOOLTIP ───────────────────────────────── */
  function showTooltip(vehicle) {
    const el = document.getElementById('vehicle-tooltip');
    if (!vehicle) { el.style.display = 'none'; return; }

    el.style.display = 'block';
    document.getElementById('tt-icon').textContent  = VEHICLE_ICONS[vehicle.type];
    document.getElementById('tt-id').textContent    = vehicle.id;
    document.getElementById('tt-route').textContent = `${vehicle.routeName}`;
    document.getElementById('tt-speed').textContent = `${Math.round(vehicle.speed)} km/h`;
    document.getElementById('tt-occ').textContent   = `${Math.round(vehicle.occupancy)}%`;
    document.getElementById('tt-next').textContent  = getNextStop(vehicle);
    document.getElementById('tt-eta').textContent   = getETA(vehicle);

    const statusEl = document.getElementById('tt-status');
    statusEl.textContent  = vehicle.status.replace('-',' ').toUpperCase();
    statusEl.className    = `tooltip-status ${vehicle.status}`;

    const occ = Math.round(vehicle.occupancy);
    const bar = document.getElementById('tt-bar');
    bar.style.width      = `${occ}%`;
    bar.style.background = occ >= 80 ? '#ff3b5c' : occ >= 50 ? '#ffe347' : '#39ff8f';
  }

  /* ── ROUTE DETAIL ──────────────────────────────────── */
  function showRouteDetail(vehicle) {
    if (!vehicle) { document.getElementById('route-detail').style.display = 'none'; return; }
    const route = ROUTES.find(r => r.id === vehicle.route);
    if (!route) return;

    document.getElementById('route-detail').style.display = 'block';
    document.getElementById('rd-title').textContent = `🗺 ${route.name}`;

    const stopsHtml = route.stops.map((sid, i) => {
      const stop = STOPS.find(s => s.id === sid);
      if (!stop) return '';
      const isPassed = i < vehicle.stopIdx;
      const isActive = i === vehicle.stopIdx;
      const dotClass = isPassed ? 'passed' : isActive ? 'active' : '';
      const timeOffset = (i - vehicle.stopIdx) * 4;
      const now = new Date();
      const t = new Date(now.getTime() + timeOffset * 60000);
      const tStr = i < vehicle.stopIdx ? '✓' :
        `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`;
      const lineHtml = i < route.stops.length - 1
        ? `<div class="stop-line" style="background:${isPassed ? 'var(--text-muted)' : 'var(--border)'}"></div>` : '';
      return `<div class="stop-item">
        <div class="stop-dot-wrap">
          <div class="stop-dot ${dotClass}"></div>
          ${lineHtml}
        </div>
        <div class="stop-info">
          <div class="stop-name">${stop.name}</div>
          <div class="stop-time">${tStr}</div>
        </div>
      </div>`;
    }).join('');

    document.getElementById('route-stops').innerHTML = stopsHtml;
  }

  /* ── MARQUEE ───────────────────────────────────────── */
  function updateMarquee() {
    const items = [
      '🚌 Route 42: Delays near City Hall — Allow extra travel time',
      '🚇 Metro Line A: Signal fault at Central Station — Reduced frequency',
      '🚊 Tram T1: Operating normally — All stops served',
      '⚠ Planned maintenance: South Bridge stop closed Saturday 22:00–06:00',
      '✅ Bus Rapid Transit expansion: Tech District ↔ Airport service launching next month',
      '🌧 Weather advisory: Wet roads — All vehicles operating at reduced speed',
    ];
    const delayed = VEHICLES.filter(v=>v.status==='delayed').map(v=>`⚠ ${v.id} delayed on ${v.routeName}`);
    const all = [...items, ...delayed];
    document.getElementById('marquee-text').textContent = all.join('   •   ');
  }

  /* ── SEARCH / FILTER SETUP ─────────────────────────── */
  function initControls() {
    document.getElementById('search-input').addEventListener('input', e => {
      searchFilter = e.target.value;
    });
    document.querySelectorAll('.ftab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.ftab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        typeFilter = btn.dataset.filter;
      });
    });
    document.getElementById('rd-close').addEventListener('click', () => {
      document.getElementById('route-detail').style.display = 'none';
    });
    document.getElementById('theme-toggle').addEventListener('click', () => {
      document.body.classList.toggle('light');
      document.getElementById('theme-toggle').textContent =
        document.body.classList.contains('light') ? '🌙' : '☀';
    });
    document.getElementById('zoom-in').addEventListener('click',  () => MapRenderer.zoomIn());
    document.getElementById('zoom-out').addEventListener('click', () => MapRenderer.zoomOut());
    document.getElementById('zoom-fit').addEventListener('click', () => MapRenderer.zoomFit());
  }

  return {
    updateClock, renderVehicleList, renderAlerts,
    renderStats, renderHealthBars, renderTimetable,
    renderHeatmap, showTooltip, showRouteDetail,
    updateMarquee, initControls,
  };
})();
