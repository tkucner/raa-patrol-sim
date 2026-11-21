/* Patrol Unit Simulator: sensor views (what each sensor returns, seen from its platform).
   Shared by the classroom client and the single-file version. Needs window.SimCore. */
(function (root) {
'use strict';
var C = root.SimCore;
var CAPTION = { camera: 'Shape and colour, if there is light. Cannot see heat.', thermal: 'Heat only. Shows that something is warm, not what it is.',
  lidar: 'Exact shape and distance as points. No colour, no heat.', radar: 'Something is there, and whether it moves. Not what it is.',
  acoustic: 'A sound and roughly where it came from. No position, no shape.' };
var VIEWPOINT = { eye: 'eye level', mast: 'from the mast, about 10 m up', oblique: 'from the drone, low and angled', nadir: 'from the drone, high and looking down' };
function vrng(seed) { var a = seed >>> 0; return function () { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; }
function viewMode(o) { if (o.platform === 'drone') return o.alt === 'low' ? 'oblique' : 'nadir'; if (o.platform === 'mast') return 'mast'; return 'eye'; }

/* side view (ground robot, mast) */
function sideShape(g, look, cx, cy, k, r) {
  g.beginPath();
  if (look === 'person') { g.arc(cx, cy - 34 * k, 7 * k, 0, 7); g.rect(cx - 8 * k, cy - 27 * k, 16 * k, 26 * k); g.rect(cx - 7 * k, cy - 2 * k, 5 * k, 20 * k); g.rect(cx + 2 * k, cy - 2 * k, 5 * k, 20 * k); }
  else if (look === 'vehicle') { g.rect(cx - 44 * k, cy - 14 * k, 88 * k, 22 * k); g.rect(cx - 18 * k, cy - 30 * k, 36 * k, 17 * k); g.moveTo(cx - 20 * k, cy + 10 * k); g.arc(cx - 26 * k, cy + 10 * k, 8 * k, 0, 7); g.moveTo(cx + 34 * k, cy + 10 * k); g.arc(cx + 26 * k, cy + 10 * k, 8 * k, 0, 7); }
  else if (look === 'heat') { g.arc(cx + 18 * k, cy - 22 * k, 7 * k, 0, 7); }
  else if (look === 'animal') { g.ellipse(cx, cy, 20 * k, 9 * k, 0, 0, 7); g.moveTo(cx + 26 * k, cy - 6 * k); g.arc(cx + 22 * k, cy - 8 * k, 6 * k, 0, 7); g.rect(cx - 14 * k, cy + 6 * k, 4 * k, 12 * k); g.rect(cx + 10 * k, cy + 6 * k, 4 * k, 12 * k); }
  else if (look === 'debris') { g.moveTo(cx - 40 * k, cy + 16 * k); g.lineTo(cx - 24 * k, cy - 6 * k); g.lineTo(cx - 6 * k, cy + 2 * k); g.lineTo(cx + 10 * k, cy - 14 * k); g.lineTo(cx + 36 * k, cy + 16 * k); g.closePath(); }
  else if (look === 'metal') { g.rect(cx - 46 * k, cy - 20 * k, 92 * k, 10 * k); }
  else { for (var i = 0; i < 5; i++) { var x = cx + (r() - 0.5) * 40 * k, y = cy + (r() - 0.5) * 24 * k; g.moveTo(x + 10 * k, y); g.arc(x, y, (5 + r() * 8) * k, 0, 7); } }
  g.fill();
}
/* seen from above (drone); sq < 1 squashes for an oblique angle */
function topShape(g, look, cx, cy, k, r, sq) {
  g.beginPath();
  if (look === 'person') { g.ellipse(cx, cy + 1 * k, 7 * k, 4 * k * sq, 0, 0, 7); g.moveTo(cx + 3.4 * k, cy - 2 * k * sq); g.arc(cx, cy - 2 * k * sq, 3.4 * k, 0, 7); }
  else if (look === 'vehicle') { g.rect(cx - 10 * k, cy - 20 * k * sq, 20 * k, 40 * k * sq); }
  else if (look === 'heat') { g.rect(cx - 3 * k, cy - 3 * k * sq, 6 * k, 6 * k * sq); }
  else if (look === 'animal') { g.ellipse(cx, cy, 9 * k, 4 * k * sq, 0.3, 0, 7); g.moveTo(cx + 12 * k, cy - 2 * k); g.arc(cx + 10 * k, cy - 2 * k * sq, 2.5 * k, 0, 7); }
  else if (look === 'debris') { g.moveTo(cx - 12 * k, cy + 6 * k * sq); g.lineTo(cx - 6 * k, cy - 8 * k * sq); g.lineTo(cx + 4 * k, cy - 4 * k * sq); g.lineTo(cx + 12 * k, cy - 9 * k * sq); g.lineTo(cx + 10 * k, cy + 8 * k * sq); g.closePath(); }
  else if (look === 'metal') { g.rect(cx - 26 * k, cy - 14 * k * sq, 52 * k, 28 * k * sq); }
  else { for (var i = 0; i < 4; i++) { var x = cx + (r() - 0.5) * 16 * k, y = cy + (r() - 0.5) * 10 * k; g.moveTo(x + 4 * k, y); g.arc(x, y, (2 + r() * 4) * k, 0, 7); } }
  g.fill();
}
function geometry(mode, w, h) {
  if (mode === 'mast') return { cx: w * 0.55, cy: h * 0.66, k: h / 240, top: false, sq: 1, horizon: 0.16 };
  if (mode === 'oblique') return { cx: w * 0.52, cy: h * 0.62, k: h / 85, top: true, sq: 0.7, horizon: -1 };
  if (mode === 'nadir') return { cx: w * 0.52, cy: h * 0.56, k: h / 190, top: true, sq: 1, horizon: -1 };
  return { cx: w * 0.55, cy: h * 0.62, k: h / 170, top: false, sq: 1, horizon: 0.55 };
}
function drawTarget(g, look, G, r) { if (G.top) topShape(g, look, G.cx, G.cy, G.k, r, G.sq); else sideShape(g, look, G.cx, G.cy, G.k, r); }
function shadow(g, look, G) {
  if (look === 'unclear' || look === 'heat') return;
  g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath();
  if (G.top) { var s = look === 'vehicle' ? 1.5 : look === 'metal' ? 0 : 1; if (!s) return; g.ellipse(G.cx + 9 * G.k, G.cy + 7 * G.k, (look === 'vehicle' ? 12 : 8) * G.k, (look === 'vehicle' ? 22 : 4) * G.k * G.sq, 0.5, 0, 7); }
  else g.ellipse(G.cx + 10 * G.k, G.cy + 20 * G.k, (look === 'vehicle' ? 50 : 16) * G.k, 5 * G.k, 0, 0, 7);
  g.fill();
}
/* ground seen by a camera from each viewpoint */
function cameraGround(g, w, h, mode, G, r, look) {
  if (mode === 'eye' || mode === 'mast') {
    var hz = h * G.horizon, sky = g.createLinearGradient(0, 0, 0, hz); sky.addColorStop(0, '#9cc3e6'); sky.addColorStop(1, '#dfe9f1'); g.fillStyle = sky; g.fillRect(0, 0, w, hz);
    var gr = g.createLinearGradient(0, hz, 0, h); gr.addColorStop(0, '#a49a7a'); gr.addColorStop(1, '#7d7458'); g.fillStyle = gr; g.fillRect(0, hz, w, h - hz);
    g.strokeStyle = 'rgba(60,50,30,.18)'; g.lineWidth = 1;
    for (var i = -8; i <= 8; i++) { g.beginPath(); g.moveTo(w / 2 + i * 8, hz); g.lineTo(w / 2 + i * w * 0.25, h); g.stroke(); }
    for (var j = 1; j < 8; j++) { var y = hz + (h - hz) * Math.pow(j / 8, 1.8); g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    if (look === 'heat' || look === 'metal') { g.fillStyle = '#6b5b6e'; g.fillRect(G.cx - 70 * G.k, G.cy - 20 * G.k, 140 * G.k, 60 * G.k); }
    return;
  }
  g.fillStyle = '#8f8a66'; g.fillRect(0, 0, w, h);
  for (var p = 0; p < 26; p++) { g.fillStyle = 'rgba(' + (110 + r() * 40 | 0) + ',' + (110 + r() * 40 | 0) + ',' + (70 + r() * 30 | 0) + ',.55)'; var pw = (40 + r() * 120) * (mode === 'nadir' ? 0.8 : 1.3), ph = (30 + r() * 80) * (mode === 'nadir' ? 0.8 : 0.9); g.fillRect(r() * w - 20, r() * h - 20, pw, ph); }
  g.fillStyle = '#a8a8a0';
  if (mode === 'nadir') { g.fillRect(0, h * 0.78, w, h * 0.06); g.fillRect(w * 0.2, 0, w * 0.05, h); }
  else { g.beginPath(); g.moveTo(w * 0.05, h); g.lineTo(w * 0.42, 0); g.lineTo(w * 0.5, 0); g.lineTo(w * 0.25, h); g.closePath(); g.fill(); }
  if (mode === 'oblique') { g.strokeStyle = 'rgba(40,40,20,.15)'; for (var q = 1; q < 6; q++) { var yy = h * Math.pow(q / 6, 1.4); g.beginPath(); g.moveTo(0, yy); g.lineTo(w, yy); g.stroke(); } }
  if (look === 'heat' || look === 'metal') { g.fillStyle = '#6b5b6e'; var bw = (mode === 'nadir' ? 60 : 90) * G.k, bh = (mode === 'nadir' ? 44 : 60) * G.k * G.sq; g.fillRect(G.cx - bw / 2, G.cy - bh / 2, bw, bh); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(G.cx + bw / 2, G.cy - bh / 2 + 6, 10 * G.k, bh); }
}
function sensorView(cvs, o) {
  var g = cvs.getContext('2d'), w = cvs.width, h = cvs.height, r = vrng(o.seed || 7), m = C.WEATHER[o.weather].m[o.sensor], blind = m < 0.3;
  var q = Math.max(0.08, Math.min(1, (o.conf || 60) / 100)), look = o.look || 'unclear', mode = viewMode(o), G = geometry(mode, w, h), kk = h / 170;
  g.save(); g.clearRect(0, 0, w, h);
  if (o.sensor === 'camera') {
    cameraGround(g, w, h, mode, G, r, look);
    shadow(g, look, G);
    g.fillStyle = look === 'metal' ? 'rgba(255,255,255,' + (0.5 + 0.5 * q) + ')' : look === 'vehicle' && G.top ? 'rgba(60,70,70,' + (0.35 + 0.65 * q) + ')' : 'rgba(40,40,40,' + (0.25 + 0.75 * q) + ')';
    drawTarget(g, look, G, r);
    if (look === 'vehicle' && G.top) { g.fillStyle = 'rgba(160,190,210,.8)'; g.fillRect(G.cx - 8 * G.k, G.cy - 15 * G.k * G.sq, 16 * G.k, 7 * G.k * G.sq); }
    if (o.weather === 'rain') { g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1; for (var i = 0; i < 160; i++) { var x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 4, y + 12); g.stroke(); } g.fillStyle = 'rgba(120,130,140,.35)'; g.fillRect(0, 0, w, h); }
    if (o.weather === 'dust') { g.fillStyle = 'rgba(170,140,95,.86)'; g.fillRect(0, 0, w, h); }
    if (o.weather === 'night') { g.fillStyle = 'rgba(0,0,8,.9)'; g.fillRect(0, 0, w, h); for (var j = 0; j < 900; j++) { g.fillStyle = 'rgba(255,255,255,' + r() * 0.18 + ')'; g.fillRect(r() * w, r() * h, 1.5, 1.5); } }
  } else if (o.sensor === 'thermal') {
    g.fillStyle = o.weather === 'heat' ? '#8a5a6a' : '#140a2a'; g.fillRect(0, 0, w, h);
    if (G.top) { for (var p = 0; p < 14; p++) { g.fillStyle = 'rgba(70,40,110,' + (0.2 + r() * 0.3) + ')'; g.fillRect(r() * w, r() * h, 40 + r() * 100, 30 + r() * 60); } }
    if (o.weather === 'heat') { for (var a = 0; a < 40; a++) { g.fillStyle = 'rgba(255,180,90,' + r() * 0.35 + ')'; g.beginPath(); g.arc(r() * w, r() * h, 8 + r() * 30, 0, 7); g.fill(); } }
    if ((look === 'heat' || look === 'metal') && G.top) { g.fillStyle = '#2c1e48'; g.fillRect(G.cx - 40 * G.k, G.cy - 28 * G.k * G.sq, 80 * G.k, 56 * G.k * G.sq); }
    var cool = look === 'debris' || look === 'metal', rad = (G.top ? 24 : 60) * G.k;
    var hot = g.createRadialGradient(G.cx, G.cy - (G.top ? 0 : 10 * G.k), 1, G.cx, G.cy, rad); hot.addColorStop(0, cool ? '#3a3a70' : 'rgba(255,245,160,' + q + ')'); hot.addColorStop(1, cool ? '#26264f' : 'rgba(255,80,0,' + (0.4 + 0.5 * q) + ')');
    g.fillStyle = hot; g.shadowColor = cool ? 'transparent' : '#ff9a00'; g.shadowBlur = 14 * q; drawTarget(g, look, G, r); g.shadowBlur = 0;
    if (o.weather === 'rain' || o.weather === 'dust') { g.fillStyle = 'rgba(70,50,90,.55)'; g.fillRect(0, 0, w, h); }
  } else if (o.sensor === 'lidar') {
    g.fillStyle = '#05080c'; g.fillRect(0, 0, w, h);
    var off = document.createElement('canvas'); off.width = w; off.height = h; var og = off.getContext('2d'); og.fillStyle = '#fff'; drawTarget(og, look, G, r);
    if ((look === 'heat' || look === 'metal') && G.top) og.fillRect(G.cx - 40 * G.k, G.cy - 28 * G.k * G.sq, 80 * G.k, 56 * G.k * G.sq);
    og.strokeStyle = '#fff'; og.lineWidth = 2;
    if (mode === 'eye') og.fillRect(0, G.cy + 18 * G.k, w, 3);
    else if (mode === 'mast') { for (var l = 1; l < 7; l++) { var yl = h * G.horizon + (h - h * G.horizon) * Math.pow(l / 7, 1.6); og.beginPath(); og.moveTo(0, yl); og.quadraticCurveTo(w / 2, yl + 8, w, yl); og.stroke(); } }
    else { for (var ring = 1; ring < 9; ring++) { og.beginPath(); og.ellipse(w / 2, mode === 'nadir' ? h / 2 : h * 1.1, ring * w / 14, ring * w / 14 * (mode === 'nadir' ? 1 : 0.55), 0, 0, 7); og.stroke(); } }
    var data = og.getImageData(0, 0, w, h).data, step = Math.max(3, Math.round(5 / q));
    g.fillStyle = '#4fe3ff';
    if (!blind) for (var yy = 0; yy < h; yy += step) for (var xx = (yy / step % 2) * step / 2; xx < w; xx += step) if (data[(yy * w + (xx | 0)) * 4 + 3] > 0 && r() < 0.35 + 0.6 * m) g.fillRect(xx, yy, 2, 2);
    var noise = o.weather === 'rain' ? 380 : o.weather === 'dust' ? 900 : 25; for (var n = 0; n < noise; n++) { g.fillStyle = 'rgba(79,227,255,' + (0.3 + r() * 0.5) + ')'; g.fillRect(r() * w, r() * h * 0.9, 2, 2); }
  } else if (o.sensor === 'radar') {
    g.fillStyle = '#020d05'; g.fillRect(0, 0, w, h);
    var R = h * 0.44, ox = h * 0.5, oy = h * 0.5; g.strokeStyle = 'rgba(80,255,120,.35)'; g.lineWidth = 1;
    [0.33, 0.66, 1].forEach(function (f) { g.beginPath(); g.arc(ox, oy, R * f, 0, 7); g.stroke(); });
    g.beginPath(); g.moveTo(ox - R, oy); g.lineTo(ox + R, oy); g.moveTo(ox, oy - R); g.lineTo(ox, oy + R); g.stroke();
    var ang = r() * 6.28, dist = R * (0.35 + r() * 0.5), bx = ox + Math.cos(ang) * dist, by = oy + Math.sin(ang) * dist, size = (look === 'vehicle' || look === 'metal' ? 9 : look === 'unclear' ? 4 : 5) * (0.6 + q);
    if (o.moving) for (var t = 1; t < 5; t++) { g.fillStyle = 'rgba(80,255,120,' + (0.35 - t * 0.07) + ')'; g.beginPath(); g.arc(bx - t * 6, by + t * 3, size * 0.8, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(120,255,150,' + (0.5 + 0.5 * q) + ')'; g.shadowColor = '#5f5'; g.shadowBlur = 10; g.beginPath(); g.arc(bx, by, size, 0, 7); g.fill(); g.shadowBlur = 0;
    for (var c2 = 0; c2 < 14; c2++) { g.fillStyle = 'rgba(80,255,120,' + r() * 0.4 + ')'; var aa = r() * 6.28, dd = r() * R; g.fillRect(ox + Math.cos(aa) * dd, oy + Math.sin(aa) * dd, 2, 2); }
    g.strokeStyle = 'rgba(120,255,150,.8)'; g.lineWidth = 2; g.beginPath(); g.moveTo(ox, oy); g.lineTo(ox + Math.cos(ang + 0.3) * R, oy + Math.sin(ang + 0.3) * R); g.stroke();
    g.fillStyle = 'rgba(120,255,150,.9)'; g.font = (12 * kk) + 'px Arial'; g.fillText('echo at ~' + Math.round(dist / R * 120) + ' m', h + 10, oy);
  } else {
    g.fillStyle = '#10101a'; g.fillRect(0, 0, w, h);
    var mid = h * 0.5, noiseA = o.weather === 'rain' ? 0.9 : o.weather === 'night' ? 0.15 : 0.3, sig = blind ? 0.05 : q;
    g.strokeStyle = '#ffd34d'; g.lineWidth = 1.5; g.beginPath();
    for (var x3 = 0; x3 < w * 0.68; x3++) { var burst = (look === 'vehicle' ? Math.sin(x3 * 0.9) : (Math.floor(x3 / 14) % 3 === 0 ? Math.sin(x3 * 0.5) : 0)) * sig * h * 0.32; var yv = mid + burst + (r() - 0.5) * noiseA * h * 0.4; if (x3) g.lineTo(x3, yv); else g.moveTo(x3, yv); }
    g.stroke();
    var px = w * 0.84, py = mid, rr = h * 0.3, br = r() * 6.28; g.strokeStyle = '#666'; g.beginPath(); g.arc(px, py, rr, 0, 7); g.stroke();
    g.fillStyle = 'rgba(255,211,77,.45)'; g.beginPath(); g.moveTo(px, py); g.arc(px, py, rr, br - 0.45, br + 0.45); g.closePath(); g.fill();
    g.fillStyle = '#ccc'; g.font = (11 * kk) + 'px Arial'; g.fillText('direction', px - rr * 0.6, py + rr + 14 * kk);
  }
  if (blind) { g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, h - 30 * kk, w, 30 * kk); g.fillStyle = '#fff'; g.font = 'bold ' + (13 * kk) + 'px Arial'; g.fillText('Blinded by ' + C.WEATHER[o.weather].label.toLowerCase(), 8, h - 10 * kk); }
  g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, 0, w, 22 * kk); g.fillStyle = '#fff'; g.font = 'bold ' + (12 * kk) + 'px Arial';
  var who = o.platform ? C.ASSETS[o.platform].name + (o.platform === 'drone' ? (o.alt === 'low' ? ' (low)' : ' (high)') : '') + ' · ' : '';
  g.fillText(who + C.SENSORS[o.sensor].name + ' · ' + C.WEATHER[o.weather].label + (o.conf != null ? ' · ' + o.conf + '%' : ''), 8, 15 * kk);
  g.restore();
}
var PREVIEW_T = [['person', 'Person'], ['vehicle', 'Vehicle'], ['heat', 'Hot roof vent (false)'], ['animal', 'Animal (false)'], ['debris', 'Debris pile (false)'], ['metal', 'Metal roof (false)']];
function previewConf(sensor, look, w) { var real = look === 'person' || look === 'vehicle', b = real ? C.DET[sensor][look] : C.CLUT[look][sensor]; return Math.round(100 * Math.min(0.95, (real ? 0.3 : 0.2) + 0.6 * b * C.WEATHER[w].m[sensor])); }
function caption(sensor, platform, alt) {
  var mode = viewMode({ platform: platform, alt: alt });
  return CAPTION[sensor] + (sensor === 'camera' || sensor === 'thermal' || sensor === 'lidar' ? ' Seen ' + VIEWPOINT[mode] + '.' : '');
}
root.SimViews = { sensorView: sensorView, CAPTION: CAPTION, caption: caption, PREVIEW_T: PREVIEW_T, previewConf: previewConf, viewMode: viewMode };
})(typeof window !== 'undefined' ? window : globalThis);
