/* Patrol Unit Simulator: simulation core (shared by server and browser) */
/* ================= SIMULATION CORE (no DOM) ================= */
(function (root) {
'use strict';
var W = 60, H = 40, CELL_M = 10;
var T = { OPEN: 0, BUILD: 1, TREES: 2, RIDGE: 3, ROAD: 4, MARSH: 5, WATER: 6 };
function idx(x, y) { return y * W + x; }
function inb(x, y) { return x >= 0 && y >= 0 && x < W && y < H; }
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rngFor(seed, name) { return mulberry32(((seed >>> 0) ^ hashStr(name)) >>> 0); }
function gauss(r) { var u = 0; while (u === 0) u = r(); var v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function zoneOf(x, y) { return (x < 30 ? 0 : 1) + (y < 20 ? 0 : 2); }
var ZONES = [{ id: 0, name: 'Z1', x0: 0, y0: 0, x1: 29, y1: 19 }, { id: 1, name: 'Z2', x0: 30, y0: 0, x1: 59, y1: 19 },
             { id: 2, name: 'Z3', x0: 0, y0: 20, x1: 29, y1: 39 }, { id: 3, name: 'Z4', x0: 30, y0: 20, x1: 59, y1: 39 }];
function square(x, y) { return 'ABCDEF'.charAt(clamp(Math.floor(x / 10), 0, 5)) + (clamp(Math.floor(y / 10), 0, 3) + 1); }

function buildWorld() {
  var truth = new Uint8Array(W * H), brief = new Uint8Array(W * H);
  function fill(g, x0, y0, w, h, v) { for (var y = y0; y < y0 + h; y++) for (var x = x0; x < x0 + w; x++) if (inb(x, y)) g[idx(x, y)] = v; }
  [truth, brief].forEach(function (g) {
    fill(g, 18, 0, 4, 17, T.TREES);
    fill(g, 34, 22, 26, 3, T.RIDGE);
    fill(g, 44, 29, 15, 10, T.MARSH);
    fill(g, 0, 18, 60, 2, T.ROAD);
    fill(g, 29, 0, 2, 40, T.ROAD);
    [36, 42, 48].forEach(function (bx) { [4, 10].forEach(function (by) { fill(g, bx, by, bx === 48 ? 5 : 4, by === 4 ? 3 : 4, T.BUILD); }); });
    fill(g, 4, 34, 4, 3, T.BUILD);
  });
  fill(brief, 36, 14, 4, 3, T.BUILD);   // demolished in reality
  fill(truth, 10, 28, 4, 3, T.BUILD);   // unmapped structure
  fill(truth, 29, 30, 2, 4, T.WATER);   // flooded road
  var errors = [
    { type: 'demolished', label: 'Block shown on the map is demolished', x: 36, y: 14, w: 4, h: 3 },
    { type: 'unmapped', label: 'Structure missing from the map', x: 10, y: 28, w: 4, h: 3 },
    { type: 'flooded', label: 'Road shown as open is flooded', x: 29, y: 30, w: 2, h: 4 }];
  return { truth: truth, brief: brief, errors: errors };
}
var WORLD = buildWorld();

var CONTACTS = [
  { id: 'R1', real: true, kind: 'vehicle', label: 'Parked vehicle, engine on and off', path: [[44, 8]], speed: 0, engine: 'cycle' },
  { id: 'R2', real: true, kind: 'person', label: 'Two people walking by the tree line', path: [[16, 2], [16, 15]], speed: 0.25 },
  { id: 'R3', real: true, kind: 'vehicle', label: 'Vehicle driving on the road', path: [[3, 18], [27, 18]], speed: 0.5, engine: 'on' },
  { id: 'R4', real: true, kind: 'person', label: 'Person hidden behind the ridge', path: [[45, 26]], speed: 0 },
  { id: 'R5', real: true, kind: 'person', label: 'Person in the demolished block', path: [[37, 15]], speed: 0 },
  { id: 'R6', real: true, kind: 'vehicle', label: 'Vehicle by the unmapped structure', path: [[15, 31]], speed: 0, engine: 'off' },
  { id: 'F1', real: false, kind: 'heat', label: 'Hot roof vent (false)', path: [[50, 5]], speed: 0 },
  { id: 'F2', real: false, kind: 'animal', label: 'Animal in the marsh (false)', path: [[46, 31], [56, 36]], speed: 0.2 },
  { id: 'F3', real: false, kind: 'debris', label: 'Debris pile (false)', path: [[6, 8]], speed: 0 },
  { id: 'F4', real: false, kind: 'metal', label: 'Metal shed roof (false)', path: [[24, 27]], speed: 0 }];

var SENSORS = {
  camera:   { name: 'Daylight camera', cost: 2, range: 10, posErr: 1.0, spur: 0.010, map: true,  los: true,  vendor: 4.2 },
  thermal:  { name: 'Thermal imager',  cost: 3, range: 8,  posErr: 1.0, spur: 0.012, map: true,  los: true,  vendor: 4.0 },
  lidar:    { name: 'Lidar',           cost: 5, range: 7,  posErr: 0.5, spur: 0.006, map: true,  los: true,  vendor: 4.4 },
  radar:    { name: 'Radar',           cost: 4, range: 12, posErr: 3.0, spur: 0.015, map: true,  los: true,  vendor: 3.6 },
  acoustic: { name: 'Acoustic',        cost: 1, range: 10, posErr: 4.0, spur: 0.020, map: false, los: false, vendor: 3.1 } };
var DET = { camera: { person: 0.55, vehicle: 0.65 }, thermal: { person: 0.65, vehicle: 0.6 }, lidar: { person: 0.5, vehicle: 0.7 },
            radar: { person: 0.2, vehicle: 0.55 }, acoustic: { person: 0.2, vehicle: 0.5 } };
var CLUT = { heat:   { camera: 0.03, thermal: 0.6,  lidar: 0.03, radar: 0.03, acoustic: 0.02 },
             animal: { camera: 0.25, thermal: 0.5,  lidar: 0.2,  radar: 0.3,  acoustic: 0.5 },
             debris: { camera: 0.2,  thermal: 0.05, lidar: 0.35, radar: 0.4,  acoustic: 0.02 },
             metal:  { camera: 0.3,  thermal: 0.1,  lidar: 0.2,  radar: 0.6,  acoustic: 0.02 } };
var WEATHER = {
  clear: { label: 'Clear day', m: { camera: 1, thermal: 1, lidar: 1, radar: 1, acoustic: 1 } },
  night: { label: 'Night', m: { camera: 0.08, thermal: 1.1, lidar: 1, radar: 1, acoustic: 1.1 } },
  rain:  { label: 'Heavy rain', m: { camera: 0.6, thermal: 0.55, lidar: 0.35, radar: 0.9, acoustic: 0.25 } },
  dust:  { label: 'Dust or smoke', m: { camera: 0.12, thermal: 0.6, lidar: 0.12, radar: 1, acoustic: 1 } },
  heat:  { label: 'Midday heat', m: { camera: 1, thermal: 0.12, lidar: 1, radar: 1, acoustic: 0.9 } } };
var ASSETS = {
  drone:  { name: 'Drone', speeds: { slow: 1.0, normal: 1.6, fast: 2.4 } },
  ground: { name: 'Ground robot', speeds: { slow: 0.5, normal: 0.8, fast: 1.2 } },
  mast:   { name: 'Sensor mast', speeds: null } };
var DESC = {
  person:  { camera: 'person-sized shape', thermal: 'warm, person-sized', lidar: 'upright shape, about 1.8 m', radar: 'small echo', acoustic: 'footsteps or voices' },
  vehicle: { camera: 'vehicle-shaped object', thermal: 'warm, vehicle-sized', lidar: 'box shape, about 4 m', radar: 'large echo', acoustic: 'engine noise' },
  heat:    { camera: 'unclear shape on a roof', thermal: 'hot spot, not moving', lidar: 'small object on a roof', radar: 'weak echo', acoustic: 'humming' },
  animal:  { camera: 'small moving shape', thermal: 'warm, small, moving', lidar: 'low moving shape', radar: 'small slow echo', acoustic: 'rustling' },
  debris:  { camera: 'irregular heap', thermal: 'cool object', lidar: 'low irregular object', radar: 'echo, not moving', acoustic: 'unclear sound' },
  metal:   { camera: 'bright reflection', thermal: 'cool flat surface', lidar: 'flat surface', radar: 'strong echo, not moving', acoustic: 'unclear sound' } };
var VAGUE = ['unclear signal', 'brief contact, then gone', 'faint shape'];
function describe(c, s, moving, r) {
  var roll = r();
  if (c.real && roll < 0.2) return ['unclear shape', 'unclear'];
  var kind = (!c.real && roll < 0.2) ? 'person' : c.kind;
  var d = DESC[kind][s];
  if (s === 'radar') d = (moving ? 'moving ' : 'still ') + d;
  return [d, kind];
}
var SPEEDQ = { slow: 1.15, normal: 1.0, fast: 0.75 };
var REVISIT = { carry: 0, once: 8, three: 24, orbit: 45 };
var PAYLOAD = 6;

function rating(m) { return m >= 0.8 ? 'good' : m >= 0.3 ? 'weak' : 'blind'; }
function payloadOf(a) { var c = 0; if (a.primary) c += SENSORS[a.primary].cost; if (a.fallback) c += SENSORS[a.fallback].cost; return c; }
function droneEndurance(a) { return 520 - 25 * payloadOf(a) - (a.speed === 'fast' ? 90 : a.speed === 'slow' ? -40 : 0) - (a.alt === 'high' ? 20 : 0); }

function contactPos(c, t) {
  if (!c.speed || c.path.length < 2) return { x: c.path[0][0] + 0.5, y: c.path[0][1] + 0.5, moving: false };
  var segs = [], L = 0;
  for (var i = 0; i < c.path.length - 1; i++) { var dx = c.path[i + 1][0] - c.path[i][0], dy = c.path[i + 1][1] - c.path[i][1], l = Math.hypot(dx, dy); segs.push(l); L += l; }
  var d = (t * c.speed) % (2 * L); if (d > L) d = 2 * L - d;
  for (var j = 0; j < segs.length; j++) { if (d <= segs[j] || j === segs.length - 1) { var f = segs[j] ? d / segs[j] : 0; return { x: c.path[j][0] + (c.path[j + 1][0] - c.path[j][0]) * f + 0.5, y: c.path[j][1] + (c.path[j + 1][1] - c.path[j][1]) * f + 0.5, moving: true }; } d -= segs[j]; }
  return { x: c.path[0][0] + 0.5, y: c.path[0][1] + 0.5, moving: true };
}
function engineOn(c, t) { return c.engine === 'on' || (c.engine === 'cycle' && Math.floor(t / 60) % 2 === 0); }

/* line of sight on the true map; returns factor 0..1 */
function losFactor(x0, y0, x1, y1, obs) {
  var cx0 = Math.floor(x0), cy0 = Math.floor(y0), cx1 = Math.floor(x1), cy1 = Math.floor(y1);
  var dx = Math.abs(cx1 - cx0), sx = cx0 < cx1 ? 1 : -1, dy = -Math.abs(cy1 - cy0), sy = cy0 < cy1 ? 1 : -1, err = dx + dy, x = cx0, y = cy0, f = 1;
  while (!(x === cx1 && y === cy1)) {
    var e2 = 2 * err; if (e2 >= dy) { err += dy; x += sx; } if (e2 <= dx) { err += dx; y += sy; }
    if (x === cx1 && y === cy1) break;
    var v = WORLD.truth[idx(x, y)];
    if (v === T.BUILD) { if (obs.high) continue; return 0; }
    if (v === T.RIDGE) { if (obs.air || obs.onRidge) continue; return 0; }
    if (v === T.TREES) { f *= obs.high ? 0.92 : obs.air ? 0.8 : obs.mast ? 0.85 : 0.7; if (f < 0.25) return 0; }
  }
  return f;
}
function soundFactor(x0, y0, x1, y1) {
  var n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0, f = 1;
  for (var i = 1; i < n; i++) { var x = Math.floor(x0 + (x1 - x0) * i / n), y = Math.floor(y0 + (y1 - y0) * i / n); if (WORLD.truth[idx(x, y)] === T.BUILD) f *= 0.85; }
  return Math.max(f, 0.3);
}

/* road routing on a given grid; returns array of [x,y] cells or null */
function bfsRoad(grid, a, b) {
  if (grid[idx(a[0], a[1])] !== T.ROAD || grid[idx(b[0], b[1])] !== T.ROAD) return null;
  var prev = new Int32Array(W * H).fill(-1), q = [idx(a[0], a[1])], seen = new Uint8Array(W * H), goal = idx(b[0], b[1]);
  seen[q[0]] = 1;
  for (var qi = 0; qi < q.length; qi++) {
    var c = q[qi]; if (c === goal) break;
    var cx = c % W, cy = (c / W) | 0;
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { var nx = cx + d[0], ny = cy + d[1]; if (!inb(nx, ny)) return; var n = idx(nx, ny); if (seen[n] || grid[n] !== T.ROAD) return; seen[n] = 1; prev[n] = c; q.push(n); });
  }
  if (!seen[goal]) return null;
  var out = [], k = goal; while (k !== -1) { out.push([k % W, (k / W) | 0]); k = prev[k]; } return out.reverse();
}
function groundRoute(grid, wps) {
  if (!wps || wps.length < 2) return { cells: wps && wps.length ? [wps[0]] : [], blocked: false, loop: false };
  var cells = [], loopPts = wps.concat([wps[0]]), blocked = false, blockedAt = null;
  for (var i = 0; i < loopPts.length - 1; i++) {
    var seg = bfsRoad(grid, loopPts[i], loopPts[i + 1]);
    if (!seg) { blocked = true; blockedAt = loopPts[i + 1]; break; }
    if (cells.length) seg.shift(); cells = cells.concat(seg);
  }
  return { cells: cells, blocked: blocked, blockedAt: blockedAt, loop: !blocked };
}
function pathLength(pts, closed) { var L = 0; for (var i = 0; i < pts.length - 1; i++) L += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); if (closed && pts.length > 1) L += Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]); return L; }

function zoneCenterCell(z, kind, grid) {
  var Z = ZONES[z], cx = (Z.x0 + Z.x1) / 2 | 0, cy = (Z.y0 + Z.y1) / 2 | 0, best = null, bd = 1e9;
  for (var y = Z.y0; y <= Z.y1; y++) for (var x = Z.x0; x <= Z.x1; x++) {
    var v = grid[idx(x, y)]; if (v === T.BUILD || v === T.WATER) continue;
    if (kind === 'ground' && v !== T.ROAD) continue;
    var d = Math.hypot(x - cx, y - cy) - (kind === 'mast' && v === T.RIDGE ? 6 : 0); if (d < bd) { bd = d; best = [x, y]; } }
  return best;
}
function defaultPath(kind, z) {
  var Z = ZONES[z];
  if (kind === 'drone') return [[Z.x0 + 3, Z.y0 + 3], [Z.x1 - 3, Z.y0 + 3], [Z.x1 - 3, Z.y1 - 3], [Z.x0 + 3, Z.y1 - 3]];
  if (kind === 'mast') return [zoneCenterCell(z, 'mast', WORLD.brief)];
  var road = [];
  for (var y = Z.y0; y <= Z.y1; y++) for (var x = Z.x0; x <= Z.x1; x++) if (WORLD.brief[idx(x, y)] === T.ROAD) road.push([x, y]);
  var c = [road.reduce(function (a, b) { return b[0] < a[0] ? b : a; }), road.reduce(function (a, b) { return b[0] > a[0] ? b : a; }),
           road.reduce(function (a, b) { return b[1] < a[1] ? b : a; }), road.reduce(function (a, b) { return b[1] > a[1] ? b : a; })];
  var best = [c[0], c[1]], bd = -1;
  for (var i = 0; i < 4; i++) for (var j = i + 1; j < 4; j++) { var d = Math.hypot(c[i][0] - c[j][0], c[i][1] - c[j][1]); if (d > bd) { bd = d; best = [c[i], c[j]]; } }
  return best;
}

var ROUTES = {
  drone: [['loop', 'Perimeter loop'], ['sweep', 'Sweep back and forth'], ['tight', 'Tight loop round the centre'], ['cross', 'Diagonal cross']],
  ground: [['long', 'End to end'], ['short', 'Short shuttle'], ['junction', 'Shuttle to the junction']],
  mast: [['centre', 'Zone centre'], ['high', 'On the ridge (zone Z4 only)'], ['corner', 'Corner facing the other zones']] };
function nearestValid(z, tx, ty, kind, pred) {
  var Z = ZONES[z], best = null, bd = 1e9;
  for (var y = Z.y0; y <= Z.y1; y++) for (var x = Z.x0; x <= Z.x1; x++) {
    var v = WORLD.brief[idx(x, y)]; if (v === T.BUILD || v === T.WATER) continue; if (kind === 'ground' && v !== T.ROAD) continue; if (pred && !pred(v)) continue;
    var d = Math.hypot(x - tx, y - ty); if (d < bd) { bd = d; best = [x, y]; } }
  return best;
}
function routeTemplate(kind, z, name) {
  var Z = ZONES[z], cx = (Z.x0 + Z.x1) / 2 | 0, cy = (Z.y0 + Z.y1) / 2 | 0;
  if (kind === 'drone') {
    var a = Z.x0 + 3, b = Z.x1 - 3, c = Z.y0 + 3, d = Z.y1 - 3, m = (c + d) / 2 | 0;
    if (name === 'sweep') return [[a, c], [b, c], [b, m], [a, m], [a, d], [b, d]];
    if (name === 'tight') return [[cx - 6, cy - 4], [cx + 6, cy - 4], [cx + 6, cy + 4], [cx - 6, cy + 4]];
    if (name === 'cross') return [[a, c], [b, d], [b, c], [a, d]];
    return [[a, c], [b, c], [b, d], [a, d]];
  }
  if (kind === 'mast') {
    if (name === 'high') { var h = nearestValid(z, cx, cy, 'mast', function (v) { return v === T.RIDGE; }); if (h) return [h]; }
    if (name === 'corner') { var mx = Z.x0 === 0 ? Z.x1 - 2 : Z.x0 + 2, my = Z.y0 === 0 ? Z.y1 - 2 : Z.y0 + 2; return [nearestValid(z, mx, my, 'mast')]; }
    return [zoneCenterCell(z, 'mast', WORLD.brief)];
  }
  var lp = defaultPath('ground', z);
  if (name === 'short') { var rt = bfsRoad(WORLD.brief, lp[0], lp[1]); if (rt && rt.length > 2) return [lp[0], rt[rt.length / 2 | 0]]; }
  if (name === 'junction') { var j = nearestValid(z, 29.5, 18.5, 'ground'); var far = Math.hypot(lp[0][0] - j[0], lp[0][1] - j[1]) > Math.hypot(lp[1][0] - j[0], lp[1][1] - j[1]) ? lp[0] : lp[1]; if (j[0] !== far[0] || j[1] !== far[1]) return [far, j]; }
  return lp;
}
var PRESETS = {
  drone: { A: { label: 'High and wide', primary: 'camera', fallback: 'thermal', alt: 'high', speed: 'normal', onDet: 'carry' },
           B: { label: 'Low and close', primary: 'camera', fallback: 'acoustic', alt: 'low', speed: 'slow', onDet: 'once' },
           C: { label: 'Fast sweep', primary: 'thermal', fallback: 'acoustic', alt: 'high', speed: 'fast', onDet: 'carry' } },
  ground: { A: { label: 'Road patrol', primary: 'lidar', fallback: 'acoustic', speed: 'normal', onDet: 'carry' },
            B: { label: 'Stop and look', primary: 'camera', fallback: 'thermal', speed: 'slow', onDet: 'once' },
            C: { label: 'Radar runner', primary: 'radar', fallback: 'acoustic', speed: 'fast', onDet: 'carry' } },
  mast: { A: { label: 'Thermal post', primary: 'thermal', fallback: 'camera' },
          B: { label: 'Radar post', primary: 'radar', fallback: 'acoustic' },
          C: { label: 'Lidar post', primary: 'lidar', fallback: 'acoustic' } } };

function defaultConfig() {
  var zones = { drone: 1, ground: 0, mast: 2 };
  var cfg = { command: { zones: zones, threshold: 50, interval: 0, budget: 8, revisit: true },
              operator: { order: 'oldest', filter: 0, expiry: 22 }, drone: {}, ground: {}, mast: {} };
  ['drone', 'ground', 'mast'].forEach(function (k) { applyPreset(cfg, k, 'A'); });
  return cfg;
}
function applyPreset(cfg, kind, key) {
  var p = PRESETS[kind][key], old = cfg[kind] || {}, z = cfg.command.zones[kind];
  var a = { preset: key, primary: p.primary, fallback: p.fallback, lostRule: old.lostRule || 'carry' };
  if (kind !== 'mast') { a.speed = p.speed; a.onDet = p.onDet; }
  if (kind === 'drone') a.alt = p.alt;
  if (kind === 'mast') { var keepPos = old.pos && zoneOf(old.pos[0], old.pos[1]) === z; a.pos = keepPos ? old.pos : routeTemplate('mast', z, 'centre')[0]; a.route = keepPos ? (old.route || 'centre') : 'centre'; }
  else { var keep = old.path && old.path.length >= 2 && old.path.every(function (q) { return zoneOf(q[0], q[1]) === z; }); a.path = keep ? old.path : routeTemplate(kind, z, kind === 'drone' ? 'loop' : 'long'); a.route = keep ? (old.route || 'custom') : (kind === 'drone' ? 'loop' : 'long'); }
  cfg[kind] = a;
}

var ROUNDS = {
  1: { seed: 1101, weather: 'clear', injects: [] },
  2: { seed: 2202, weather: 'night', injects: [{ t: 100, type: 'comms', dur: 30 }, { t: 170, type: 'sensor', asset: 'drone' }, { t: 230, type: 'gps', asset: 'ground' }] },
  3: { seed: 3303, weather: 'rain', injects: [{ t: 80, type: 'comms', dur: 25 }, { t: 140, type: 'weather', w: 'dust' }, { t: 200, type: 'lost', asset: 'drone' }, { t: 250, type: 'sensor', asset: 'mast' }] } };
function roundSpec(r, ov) {
  ov = ov || {}; var b = ROUNDS[r] || ROUNDS[1];
  return { round: r, seed: ov.seed != null && ov.seed !== '' ? +ov.seed : b.seed, weather: ov.weather || b.weather, length: +(ov.length || 360), injects: b.injects.slice() };
}

function validate(cfg) {
  var errs = [];
  ['drone', 'ground', 'mast'].forEach(function (k) {
    var a = cfg[k], n = ASSETS[k].name;
    if (!a.primary) errs.push(n + ': choose a primary sensor.');
    if (a.primary && a.primary === a.fallback) errs.push(n + ': primary and fallback must be different.');
    if (payloadOf(a) > PAYLOAD) errs.push(n + ': sensors weigh ' + payloadOf(a) + ', the limit is ' + PAYLOAD + '.');
    if (k === 'mast' && !a.pos) errs.push('Sensor mast: place it on the map.');
    if (k !== 'mast' && (!a.path || a.path.length < 2)) errs.push(n + ': draw at least two patrol points.');
  });
  return errs;
}

/* ---------- mission ---------- */
function createSim(cfg, spec) {
  var S = { cfg: JSON.parse(JSON.stringify(cfg)), spec: spec, t: 0, done: false, weather: spec.weather,
    observed: new Uint8Array(W * H), lastSeen: new Float32Array(W * H).fill(-1e9), watchSum: 0, watchN: 0, returned: new Uint8Array(W * H), obsBy: {}, reports: [], pending: [], outbox: [], events: [],
    counters: { belowTh: 0, dropped: 0, dedup: 0, detections: 0 }, commsDown: false, commsUntil: 0, nextId: 1, maxQueue: 0,
    injectIdx: 0, contactRng: rngFor(spec.seed, 'contacts'), assets: {} };
  var cmd = S.cfg.command;
  ['drone', 'ground', 'mast'].forEach(function (k) {
    var a = S.cfg[k], st = { kind: k, name: ASSETS[k].name, alive: true, landed: false, primaryFailed: false, gpsLost: false, halted: false,
      off: [0, 0], drift: 0, revisit: null, cooldown: 0, tokens: cmd.budget, lastSent: {}, rng: rngFor(spec.seed, 'asset:' + k),
      notes: {}, failed: {}, wp: 0, stats: { reports: 0, realDet: {}, falseSent: 0, observed: 0 } };
    st.driftAng = st.rng() * Math.PI * 2;
    S.obsBy[k] = new Uint8Array(W * H);
    if (k === 'mast') { st.x = a.pos[0] + 0.5; st.y = a.pos[1] + 0.5; st.launch = [st.x, st.y]; st.onRidge = WORLD.truth[idx(a.pos[0], a.pos[1])] === T.RIDGE; }
    else if (k === 'drone') { st.route = a.path.map(function (p) { return [p[0] + 0.5, p[1] + 0.5]; }); st.x = st.route[0][0]; st.y = st.route[0][1]; st.launch = [st.x, st.y]; st.wp = 1 % st.route.length; st.endurance = droneEndurance(a); }
    else { var r = groundRoute(WORLD.truth, a.path); st.route = r.cells.map(function (p) { return [p[0] + 0.5, p[1] + 0.5]; }); st.loop = r.loop; st.blocked = r.blocked; st.blockedAt = r.blockedAt; st.dir = 1;
      if (!st.route.length) st.route = [[a.path[0][0] + 0.5, a.path[0][1] + 0.5]]; st.x = st.route[0][0]; st.y = st.route[0][1]; st.launch = [st.x, st.y]; st.wp = st.route.length > 1 ? 1 : 0; }
    S.assets[k] = st;
  });
  ev(S, 'Mission start. Weather: ' + WEATHER[S.weather].label + '.');
  return S;
}
function ev(S, text, kind) { S.events.push({ t: Math.round(S.t * 10) / 10, text: text, kind: kind || 'info' }); }
function activeSensor(S, st) {
  var a = S.cfg[st.kind], m = WEATHER[S.weather].m;
  var pOk = a.primary && !st.primaryFailed && m[a.primary] >= 0.3;
  if (pOk) { if (st.notes.fb) { st.notes.fb = false; ev(S, st.name + ': primary sensor working again.'); } return a.primary; }
  if (!st.notes.fb) { st.notes.fb = true; ev(S, st.name + ': ' + (st.primaryFailed ? 'primary sensor fault' : 'primary sensor blinded by ' + WEATHER[S.weather].label.toLowerCase()) + (a.fallback ? ', fallback ' + SENSORS[a.fallback].name.toLowerCase() + ' active.' : ', no fallback fitted.'), 'warn'); }
  if (a.fallback && m[a.fallback] >= 0.3 && !st.failed[a.fallback]) return a.fallback;
  if (!st.notes.none) { st.notes.none = true; ev(S, st.name + ': no working sensor left.', 'warn'); }
  return null;
}
function moveToward(st, tx, ty, dist) { var dx = tx - st.x, dy = ty - st.y, d = Math.hypot(dx, dy); if (d <= dist) { st.x = tx; st.y = ty; return true; } st.x += dx / d * dist; st.y += dy / d * dist; return false; }

function stepAsset(S, st, dt) {
  if (!st.alive || st.landed || st.kind === 'mast') return;
  var a = S.cfg[st.kind];
  if (st.kind === 'drone' && S.t >= st.endurance) { st.landed = true; ev(S, 'Drone: battery empty, drone has landed.', 'warn'); return; }
  var v = ASSETS[st.kind].speeds[a.speed] * dt, moved = false;
  if (st.halted) return;
  if (st.revisit) {
    var R = st.revisit;
    if (st.kind === 'drone' && !R.arrived) { R.arrived = moveToward(st, R.x, R.y, v); moved = true; }
    else { if (R.until == null) R.until = S.t + (R.ordered ? 15 : REVISIT[a.onDet]); if (S.t >= R.until) { st.revisit = null; st.cooldown = S.t + 10; } }
  } else if (st.returning) {
    if (moveToward(st, st.launch[0], st.launch[1], v)) { st.halted = true; ev(S, st.name + ': back at its start point, holding.'); } moved = true;
  } else if (st.route.length > 1) {
    var tgt = st.route[st.wp];
    if (moveToward(st, tgt[0], tgt[1], v)) {
      if (st.kind === 'drone' || st.loop) st.wp = (st.wp + 1) % st.route.length;
      else { if (st.wp === st.route.length - 1 && st.dir === 1) { st.dir = -1; if (st.blocked && !st.notes.blk) { st.notes.blk = true; ev(S, 'Ground robot: route blocked near ' + square(st.blockedAt ? st.blockedAt[0] : st.x, st.blockedAt ? st.blockedAt[1] : st.y) + ', turning back.', 'warn'); } }
             else if (st.wp === 0 && st.dir === -1) st.dir = 1; st.wp += st.dir; }
    }
    moved = true;
  }
  if (moved && st.gpsLost) { st.off[0] += (Math.cos(st.driftAng) * 0.09 + gauss(st.rng) * 0.04) * dt; st.off[1] += (Math.sin(st.driftAng) * 0.09 + gauss(st.rng) * 0.04) * dt; }
}

function sense(S, st) {
  if (!st.alive || st.landed) return;
  var a = S.cfg[st.kind], s = activeSensor(S, st); if (!s) return;
  var SN = SENSORS[s], m = WEATHER[S.weather].m[s], high = st.kind === 'drone' && a.alt === 'high';
  var obs = { air: st.kind === 'drone', high: high, mast: st.kind === 'mast', onRidge: !!st.onRidge };
  var R = SN.range * (high ? 1.3 : 1) * (st.kind === 'mast' ? 1.15 : 1), altQ = high ? 0.65 : 1, spdQ = st.kind === 'mast' ? 1.1 : SPEEDQ[a.speed];
  var rb = st.revisit ? 1.3 : 1, r = st.rng, cmd = S.cfg.command;
  if (SN.map) {
    var x0 = Math.max(0, Math.floor(st.x - R)), x1 = Math.min(W - 1, Math.ceil(st.x + R)), y0 = Math.max(0, Math.floor(st.y - R)), y1 = Math.min(H - 1, Math.ceil(st.y + R));
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
      if (Math.hypot(x + 0.5 - st.x, y + 0.5 - st.y) > R) continue;
      var i = idx(x, y);
      if (losFactor(st.x, st.y, x + 0.5, y + 0.5, obs) <= 0) continue;
      S.lastSeen[i] = S.t; S.observed[i] = 1; S.obsBy[st.kind][i] = 1; var v = WORLD.truth[i]; if (v === T.BUILD || v === T.TREES) S.returned[i] = 1;
    }
  }
  CONTACTS.forEach(function (c) {
    var p = contactPos(c, S.t), d = Math.hypot(p.x - st.x, p.y - st.y); if (d > R) { r(); r(); return; }
    var f = SN.los ? losFactor(st.x, st.y, p.x, p.y, obs) : soundFactor(st.x, st.y, p.x, p.y);
    var base;
    if (c.real) { base = DET[s][c.kind]; if (s === 'acoustic' && c.kind === 'vehicle' && !engineOn(c, S.t)) base *= 0.15; if (s === 'radar' && p.moving) base = Math.min(0.95, base * 1.6); }
    else base = CLUT[c.kind][s];
    var q = base * m * f * (1 - 0.5 * d / R) * altQ * spdQ * rb, roll = r(), n = gauss(r);
    if (f <= 0 || roll >= Math.min(0.9, q * 0.5)) return;
    var conf = c.real ? clamp(0.3 + 0.6 * q + 0.12 * n, 0.05, 0.99) : clamp(0.2 + 0.6 * q + 0.12 * n, 0.05, 0.95);
    var pe = SN.posErr * (high ? 1.5 : 1);
    var dd = describe(c, s, p.moving, r);
    detect(S, st, s, { x: p.x + gauss(r) * pe + st.off[0], y: p.y + gauss(r) * pe + st.off[1], conf: Math.round(conf * 100), src: c.id, real: c.real, tx: p.x, ty: p.y, desc: dd[0], look: dd[1], moving: p.moving });
    if (c.real) st.stats.realDet[c.id] = 1;
  });
  var spur = SN.spur * ((S.weather === 'rain' && (s === 'acoustic' || s === 'lidar')) ? 1.6 : 1);
  if (r() < spur) {
    var ang = r() * Math.PI * 2, dd = Math.sqrt(r()) * R, sx = clamp(st.x + Math.cos(ang) * dd, 0, W - 0.01), sy = clamp(st.y + Math.sin(ang) * dd, 0, H - 0.01);
    detect(S, st, s, { x: sx + st.off[0], y: sy + st.off[1], conf: Math.round(15 + r() * 47), src: 'S' + (S.nextId + S.counters.detections), real: false, tx: sx, ty: sy, desc: VAGUE[Math.floor(r() * VAGUE.length)], look: 'unclear', moving: false });
  }
  void cmd;
}
function detect(S, st, sensor, d) {
  S.counters.detections++;
  var cmd = S.cfg.command;
  d.x = clamp(d.x, 0, W - 0.01); d.y = clamp(d.y, 0, H - 0.01);
  if (d.conf < cmd.threshold) { S.counters.belowTh++; return; }
  if (st.lastSent[d.src] != null && S.t - st.lastSent[d.src] < 25) { S.counters.dedup++; return; }
  st.lastSent[d.src] = S.t;
  var a = S.cfg[st.kind];
  if (cmd.revisit && a.onDet && a.onDet !== 'carry' && !st.revisit && S.t >= st.cooldown && st.kind !== 'mast' && !st.halted)
    st.revisit = { x: clamp(d.x, 0, W - 1), y: clamp(d.y, 0, H - 1), arrived: st.kind !== 'drone' };
  S.outbox.push({ asset: st.kind, sensor: sensor, tDet: S.t, x: d.x, y: d.y, conf: d.conf, src: d.src, real: d.real, tx: d.tx, ty: d.ty, desc: d.desc, look: d.look, moving: d.moving, wx: S.weather });
  if (!cmd.interval) flushOutbox(S);
}
function flushOutbox(S) {
  var box = S.outbox; S.outbox = [];
  if (S.cfg.command.interval) { var best = {}; box.forEach(function (r) { var k = r.asset + '|' + r.src; if (!best[k] || best[k].conf < r.conf) best[k] = r; }); box = Object.keys(best).map(function (k) { return best[k]; }).sort(function (a, b) { return a.tDet - b.tDet; }); }
  box.forEach(function (r) {
    var st = S.assets[r.asset];
    if (st.tokens < 1) { S.counters.dropped++; return; }
    st.tokens -= 1;
    if (S.commsDown) S.pending.push(r); else deliver(S, r);
  });
}
function deliver(S, r) {
  var op = S.cfg.operator;
  r.id = S.nextId++; r.tArr = S.t; r.square = square(r.x, r.y); r.exp = S.t + op.expiry;
  r.status = r.conf < op.filter ? 'filtered' : 'open';
  S.reports.push(r); S.assets[r.asset].stats.reports++; if (!r.real) S.assets[r.asset].stats.falseSent++;
}
function applyInject(S, inj) {
  var st = inj.asset ? S.assets[inj.asset] : null;
  if (inj.type === 'comms') { S.commsDown = true; S.commsUntil = S.t + inj.dur; ev(S, 'Comms: link to all robots lost. Reports are being held.', 'warn'); }
  if (inj.type === 'sensor' && st) { var cur = activeSensor(S, st); if (cur) { st.failed[cur] = true; if (cur === S.cfg[st.kind].primary) st.primaryFailed = true; ev(S, st.name + ': ' + SENSORS[cur].name.toLowerCase() + ' has failed.', 'warn'); } }
  if (inj.type === 'gps' && st) { st.gpsLost = true; ev(S, st.name + ': satellite positioning lost.', 'warn'); var rule = S.cfg[st.kind].lostRule || 'carry';
    if (rule === 'stop') { st.halted = true; st.revisit = null; ev(S, st.name + ': rule "stop" applied, holding position.'); } else if (rule === 'return') { st.returning = true; st.revisit = null; ev(S, st.name + ': rule "return" applied, heading back.'); } else ev(S, st.name + ': rule "carry on" applied.'); }
  if (inj.type === 'lost' && st) { st.alive = false; ev(S, st.name + ': contact with the platform lost.', 'warn'); }
  if (inj.type === 'weather') { S.weather = inj.w; ev(S, 'Weather changed: ' + WEATHER[inj.w].label + '.', 'warn'); }
}
function step(S, dt) {
  if (S.done) return;
  var prev = S.t; S.t = Math.round((S.t + dt) * 1000) / 1000;
  while (S.injectIdx < S.spec.injects.length && S.spec.injects[S.injectIdx].t <= S.t) applyInject(S, S.spec.injects[S.injectIdx++]);
  if (S.commsDown && S.t >= S.commsUntil) { S.commsDown = false; var n = S.pending.length; S.pending.forEach(function (r) { deliver(S, r); }); S.pending = []; ev(S, 'Comms restored. ' + n + ' held report' + (n === 1 ? '' : 's') + ' delivered late.'); }
  ['drone', 'ground', 'mast'].forEach(function (k) { stepAsset(S, S.assets[k], dt); });
  if (Math.floor(S.t) > Math.floor(prev)) {
    var cmd = S.cfg.command;
    ['drone', 'ground', 'mast'].forEach(function (k) { var st = S.assets[k]; st.tokens = Math.min(cmd.budget, st.tokens + cmd.budget / 60); sense(S, st); });
    if (cmd.interval && Math.floor(S.t) % cmd.interval === 0) flushOutbox(S);
    var w = 0; for (var c = 0; c < W * H; c++) if (S.t - S.lastSeen[c] <= 60) w++; S.watchSum += w; S.watchN++;
    var open = 0; S.reports.forEach(function (r) { if (r.status === 'open') open++; }); if (open > S.maxQueue) S.maxQueue = open;
  }
  S.reports.forEach(function (r) { if (r.status === 'open' && S.t >= r.exp) { r.status = 'expired'; r.tDec = r.exp; r.expiredAt = 'operator'; } else if (r.status === 'assessed' && S.t >= r.cmdExp) { r.status = 'expired'; r.tDec = r.cmdExp; r.expiredAt = 'command'; } });
  if (S.t >= S.spec.length) {
    S.done = true; if (S.cfg.command.interval) flushOutbox(S);
    S.reports.forEach(function (r) { if (r.status === 'open' || r.status === 'assessed') { r.expiredAt = r.status === 'open' ? 'operator' : 'command'; r.status = 'expired'; r.tDec = S.t; } });
    ev(S, 'Mission over.');
  }
}
function assess(S, id, verdict, note, by) {
  for (var i = 0; i < S.reports.length; i++) { var r = S.reports[i]; if (r.id === id && r.status === 'open') { r.status = 'assessed'; r.verdict = verdict; r.note = note || ''; r.by = by || ''; r.tAss = S.t; r.cmdExp = S.t + (S.cfg.command.decideWithin || 40); return true; } }
  return false;
}
function cqueue(S) { return S.reports.filter(function (r) { return r.status === 'assessed'; }).sort(function (a, b) { return a.tAss - b.tAss; }); }
function retask(S, asset, x, y) {
  var st = S.assets[asset]; if (!st || !st.alive || st.landed || st.kind === 'mast' || st.halted || st.returning) return false;
  st.revisit = { x: clamp(x, 0, W - 1), y: clamp(y, 0, H - 1), arrived: st.kind !== 'drone', until: null, ordered: true };
  ev(S, st.name + ': ordered to re-check square ' + square(x, y) + '.'); return true;
}
function decide(S, id, decision) {
  for (var i = 0; i < S.reports.length; i++) { var r = S.reports[i]; if (r.id === id && (r.status === 'open' || r.status === 'assessed')) { r.status = decision; r.tDec = S.t; return true; } }
  return false;
}
function queue(S) {
  var o = S.cfg.operator.order, q = S.reports.filter(function (r) { return r.status === 'open'; });
  q.sort(o === 'confidence' ? function (a, b) { return b.conf - a.conf || a.tArr - b.tArr; } : o === 'newest' ? function (a, b) { return b.tArr - a.tArr; } : function (a, b) { return a.tArr - b.tArr || a.id - b.id; });
  return q;
}
function score(S) {
  var ops = { n: 0, ok: 0 }, found = {}, badSrc = {}, falseConf = 0, misplaced = 0, expired = 0, tFirst = null, decTimes = [];
  S.reports.forEach(function (r) {
    if (r.status === 'expired') expired++;
    if (r.status === 'confirmed' || r.status === 'rejected') decTimes.push(r.tDec - r.tArr);
    if (r.verdict) { ops.n++; var ok = (r.verdict === 'real') === (r.real && Math.hypot(r.x - r.tx, r.y - r.ty) <= 5); if (ok) ops.ok++; }
    if (r.status !== 'confirmed') return;
    var err = Math.hypot(r.x - r.tx, r.y - r.ty);
    if (r.real && err <= 5) { if (!found[r.src]) found[r.src] = r.tDec; if (tFirst == null || r.tDec < tFirst) tFirst = r.tDec; }
    else { badSrc[r.src] = r.real ? 'm' : 'f'; }
  });
  Object.keys(badSrc).forEach(function (k) { if (found[k] != null) return; falseConf++; if (badSrc[k] === 'm') misplaced++; });
  var obs = 0; for (var i = 0; i < W * H; i++) obs += S.observed[i];
  var area = S.watchN ? Math.round(S.watchSum / S.watchN / (W * H) * 100) : 0, seenOnce = Math.round(obs / (W * H) * 100), nFound = Object.keys(found).length;
  var pts = { found: nFound * 30, falseConf: -20 * falseConf, expired: -4 * expired, area: area, first: tFirst == null ? 0 : Math.max(0, Math.round(30 - tFirst / 8)), dropped: -S.counters.dropped };
  var total = 0; Object.keys(pts).forEach(function (k) { total += pts[k]; });
  var perAsset = {};
  ['drone', 'ground', 'mast'].forEach(function (k) { var st = S.assets[k], o = 0; for (var i = 0; i < W * H; i++) o += S.obsBy[k][i]; perAsset[k] = { area: Math.round(o / (W * H) * 100), realDetected: Object.keys(st.stats.realDet).length, reports: st.stats.reports, falseSent: st.stats.falseSent }; });
  var meanDec = decTimes.length ? decTimes.reduce(function (a, b) { return a + b; }, 0) / decTimes.length : 0;
  return { seenOnce: seenOnce, found: nFound, foundIds: Object.keys(found), falseConf: falseConf, misplaced: misplaced, expired: expired, area: area, tFirst: tFirst, dropped: S.counters.dropped,
           pts: pts, total: total, perAsset: perAsset, ops: ops, workload: { expired: expired, meanDecision: Math.round(meanDec * 10) / 10, maxQueue: S.maxQueue, reports: S.reports.length, filtered: S.reports.filter(function (r) { return r.status === 'filtered'; }).length } };
}
function runHeadless(cfg, spec, policy) {
  var S = createSim(cfg, spec);
  while (!S.done) { step(S, 0.25); if (policy) policy(S); }
  return S;
}
function logHash(S) { return hashStr(JSON.stringify(S.reports.map(function (r) { return [r.id, r.asset, r.sensor, r.tArr, r.conf, r.src, r.status, Math.round(r.x * 100)]; })) + JSON.stringify(S.events)); }

root.SimCore = { DET: DET, CLUT: CLUT, W: W, H: H, CELL_M: CELL_M, T: T, WORLD: WORLD, ZONES: ZONES, CONTACTS: CONTACTS, SENSORS: SENSORS, WEATHER: WEATHER, ASSETS: ASSETS, PRESETS: PRESETS,
  REVISIT: REVISIT, PAYLOAD: PAYLOAD, idx: idx, inb: inb, zoneOf: zoneOf, square: square, rating: rating, payloadOf: payloadOf, droneEndurance: droneEndurance,
  contactPos: contactPos, ROUTES: ROUTES, routeTemplate: routeTemplate, groundRoute: groundRoute, bfsRoad: bfsRoad, pathLength: pathLength, defaultPath: defaultPath, defaultConfig: defaultConfig,
  applyPreset: applyPreset, roundSpec: roundSpec, validate: validate, createSim: createSim, step: step, decide: decide, assess: assess, cqueue: cqueue, retask: retask, queue: queue, score: score,
  runHeadless: runHeadless, logHash: logHash, hashStr: hashStr };
if (typeof module !== 'undefined' && module.exports) module.exports = root.SimCore;
})(typeof window !== 'undefined' ? window : globalThis);
