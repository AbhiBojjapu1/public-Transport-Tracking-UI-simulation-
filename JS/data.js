/* ════════════════════════════════════════════════════════
   data.js — Simulation data for CityTransit Live
   ════════════════════════════════════════════════════════ */

const STOPS = [
  { id: 'S01', name: 'Central Station',     x: 0.50, y: 0.50 },
  { id: 'S02', name: 'Airport Terminal',    x: 0.85, y: 0.12 },
  { id: 'S03', name: 'University Campus',   x: 0.22, y: 0.20 },
  { id: 'S04', name: 'City Hall',           x: 0.55, y: 0.34 },
  { id: 'S05', name: 'Harbor Docks',        x: 0.78, y: 0.68 },
  { id: 'S06', name: 'West Market',         x: 0.18, y: 0.55 },
  { id: 'S07', name: 'North Park',          x: 0.42, y: 0.15 },
  { id: 'S08', name: 'Tech District',       x: 0.70, y: 0.40 },
  { id: 'S09', name: 'Stadium',             x: 0.30, y: 0.74 },
  { id: 'S10', name: 'Old Town',            x: 0.60, y: 0.62 },
  { id: 'S11', name: 'South Bridge',        x: 0.45, y: 0.85 },
  { id: 'S12', name: 'East Gate',           x: 0.82, y: 0.52 },
  { id: 'S13', name: 'Medical Center',      x: 0.35, y: 0.42 },
  { id: 'S14', name: 'Shopping Mall',       x: 0.65, y: 0.22 },
  { id: 'S15', name: 'Industrial Zone',     x: 0.10, y: 0.80 },
];

const ROUTES = [
  {
    id: 'R01', name: 'Route 42', type: 'bus', color: '#00d4ff',
    stops: ['S03','S07','S04','S01','S10','S05'],
  },
  {
    id: 'R02', name: 'Route 7', type: 'bus', color: '#00d4ff',
    stops: ['S06','S13','S01','S08','S12'],
  },
  {
    id: 'R03', name: 'Route 15', type: 'bus', color: '#00d4ff',
    stops: ['S15','S09','S11','S01','S04','S14','S02'],
  },
  {
    id: 'R04', name: 'Metro Line A', type: 'metro', color: '#c97bff',
    stops: ['S03','S13','S01','S08','S02'],
  },
  {
    id: 'R05', name: 'Metro Line B', type: 'metro', color: '#c97bff',
    stops: ['S15','S09','S06','S13','S04','S14'],
  },
  {
    id: 'R06', name: 'Tram T1', type: 'tram', color: '#7fff72',
    stops: ['S07','S04','S13','S06','S09'],
  },
  {
    id: 'R07', name: 'Route 22', type: 'bus', color: '#00d4ff',
    stops: ['S02','S14','S08','S10','S11'],
  },
  {
    id: 'R08', name: 'Metro Line C', type: 'metro', color: '#c97bff',
    stops: ['S07','S04','S01','S10','S05','S12'],
  },
];

const VEHICLE_ICONS = { bus: '🚌', metro: '🚇', tram: '🚊' };

const STATUSES = ['on-time', 'on-time', 'on-time', 'delayed', 'early'];

const SERVICE_ALERTS = [
  { id: 'A1', type: 'warning', title: 'Delays on Route 42', desc: 'Heavy traffic near City Hall. Expect 8-12 min delays.', time: '2 min ago', route: 'R01' },
  { id: 'A2', type: 'critical', title: 'Metro Line A Disruption', desc: 'Signal failure at Central Station. Engineers on site.', time: '7 min ago', route: 'R04' },
  { id: 'A3', type: 'info', title: 'Route 7 Diversion', desc: 'Temporary stop closure at West Market due to road works.', time: '14 min ago', route: 'R02' },
  { id: 'A4', type: 'warning', title: 'High Passenger Load', desc: 'Route 15 buses running at full capacity. Next bus in 4 min.', time: '19 min ago', route: 'R03' },
];

const HOURLY_DEMAND = [
  12, 8, 5, 4, 6, 15, 45, 82, 95, 87, 70, 65,
  73, 68, 60, 72, 88, 95, 90, 75, 55, 40, 28, 18
];

// Vehicles state (will be mutated by simulation)
const VEHICLES = [];

function _rand(min, max) { return Math.random() * (max - min) + min; }
function _randInt(min, max) { return Math.floor(_rand(min, max)); }
function _pick(arr) { return arr[_randInt(0, arr.length)]; }

function initVehicles() {
  const ids = [
    'B-101','B-102','B-103','B-104','B-105','B-106','B-107','B-108',
    'B-109','B-110','B-111','B-112','B-113','B-114','B-115','B-116',
    'M-201','M-202','M-203','M-204','M-205','M-206',
    'T-301','T-302','T-303','T-304',
  ];

  ids.forEach(id => {
    const type = id.startsWith('B') ? 'bus' : id.startsWith('M') ? 'metro' : 'tram';
    const routePool = ROUTES.filter(r => r.type === type);
    const route = _pick(routePool);
    const stopIdx = _randInt(0, route.stops.length - 1);
    const nextStopId = route.stops[Math.min(stopIdx + 1, route.stops.length - 1)];
    const currStop = STOPS.find(s => s.id === route.stops[stopIdx]);
    const nextStop = STOPS.find(s => s.id === nextStopId);

    const t = _rand(0, 1);
    VEHICLES.push({
      id,
      type,
      route: route.id,
      routeName: route.name,
      status: _pick(STATUSES),
      stopIdx,
      t,                           // interpolation param along current segment
      x: lerp(currStop.x, nextStop.x, t),
      y: lerp(currStop.y, nextStop.y, t),
      speed: type === 'metro' ? _rand(55, 85) : type === 'tram' ? _rand(25, 40) : _rand(20, 60),
      occupancy: _randInt(10, 100),
      delay: _randInt(-3, 15),     // minutes
      heading: 0,
      selected: false,
      color: route.color,
    });
  });
}

function lerp(a, b, t) { return a + (b - a) * t; }

// Advance simulation by dt seconds
function tickVehicles(dt) {
  VEHICLES.forEach(v => {
    const route = ROUTES.find(r => r.id === v.route);
    if (!route) return;

    const stops = route.stops;
    if (v.stopIdx >= stops.length - 1) {
      v.stopIdx = 0;
      v.t = 0;
    }

    const currStop = STOPS.find(s => s.id === stops[v.stopIdx]);
    const nextStop = STOPS.find(s => s.id === stops[Math.min(v.stopIdx + 1, stops.length - 1)]);
    if (!currStop || !nextStop) return;

    const segSpeed = v.speed / 3600; // deg/sec (canvas units)
    const dx = nextStop.x - currStop.x;
    const dy = nextStop.y - currStop.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.001) { v.stopIdx++; v.t = 0; return; }

    v.t += (segSpeed * dt * 0.4) / dist;
    if (v.t >= 1) {
      v.t = 0;
      v.stopIdx = (v.stopIdx + 1) % (stops.length - 1);
    }

    const newX = lerp(currStop.x, nextStop.x, v.t);
    const newY = lerp(currStop.y, nextStop.y, v.t);
    v.heading = Math.atan2(newY - v.y, newX - v.x) * 180 / Math.PI;
    v.x = newX;
    v.y = newY;

    // Slow drift in speed / occupancy
    v.speed = Math.max(5, Math.min(100, v.speed + _rand(-2, 2)));
    v.occupancy = Math.max(5, Math.min(100, v.occupancy + _rand(-3, 3)));
  });
}

function getNextStop(vehicle) {
  const route = ROUTES.find(r => r.id === vehicle.route);
  if (!route) return '—';
  const nextIdx = Math.min(vehicle.stopIdx + 1, route.stops.length - 1);
  const stop = STOPS.find(s => s.id === route.stops[nextIdx]);
  return stop ? stop.name : '—';
}

function getETA(vehicle) {
  const mins = Math.floor(_rand(1, 8));
  return `${mins} min`;
}

initVehicles();
