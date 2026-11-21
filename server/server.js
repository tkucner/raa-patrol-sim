/* Patrol Unit Simulator: shared classroom server (Node >= 18, no dependencies).
   One process runs every group's simulation; participants join from a browser. */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const C = require('./core.js');

const PORT = process.env.PORT || 8080;
const PUB = path.join(__dirname, 'public');
const KINDS = ['drone', 'ground', 'mast'];
const ROLES = ['commander', 'operator1', 'operator2', 'drone', 'ground', 'mast'];
const classes = {};

function newCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c; do { c = ''; for (let i = 0; i < 5; i++) c += A[crypto.randomInt(A.length)]; } while (classes[c]);
  return c;
}
function newGroup(name) {
  return { name, cfg: C.defaultConfig(), sim: null, ready: false, texts: { op: '', dir: { drone: '', ground: '', mast: '' } },
           corrections: [], workload: [3, 3, 3], seen: {}, results: {} };
}
function newClass() {
  const code = newCode();
  classes[code] = { code, token: crypto.randomBytes(12).toString('hex'), created: Date.now(), touched: Date.now(), round: 1,
                    ov: { seed: '', length: 360, weather: '' }, phase: 'setup', running: false, speed: 1, groups: {} };
  return classes[code];
}
function spec(cl) { return C.roundSpec(cl.round, cl.ov); }
function active(g, role) { return !!g.seen[role] && Date.now() - g.seen[role] < 10000; }
function opAssets(g, role) {
  if (role === 'operator2') return active(g, 'operator2') ? ['ground'] : [];
  if (role === 'operator1') return active(g, 'operator2') ? ['drone', 'mast'] : KINDS.slice();
  return KINDS.slice();
}

/* ---------- simulation clock ---------- */
let lastTick = Date.now();
setInterval(() => {
  const now = Date.now(), dt = Math.min(1, (now - lastTick) / 1000); lastTick = now;
  Object.values(classes).forEach(cl => {
    if (cl.phase !== 'mission' || !cl.running) return;
    let allDone = true;
    Object.values(cl.groups).forEach(g => {
      if (!g.sim || g.sim.done) return;
      let t = dt * cl.speed; while (t > 1e-6) { const s = Math.min(0.25, t); C.step(g.sim, s); t -= s; }
      if (!g.sim.done) allDone = false;
    });
    if (allDone) cl.running = false;
  });
  Object.keys(classes).forEach(k => { if (now - classes[k].touched > 12 * 3600e3) delete classes[k]; });
}, 200);

/* ---------- phase control ---------- */
function toPhase(cl, phase) {
  if (phase === 'mission') {
    Object.values(cl.groups).forEach(g => {
      const errs = C.validate(g.cfg);
      KINDS.forEach(k => { if (C.validate(g.cfg).some(e => e.indexOf(C.ASSETS[k].name) === 0)) C.applyPreset(g.cfg, k, 'A'); });
      g.sim = C.createSim(g.cfg, spec(cl));
      if (errs.length) g.sim.events.push({ t: 0, text: 'Facilitator: invalid settings replaced by preset A (' + errs[0] + ')', kind: 'warn' });
    });
    cl.running = false;
  }
  if (phase === 'debrief') Object.values(cl.groups).forEach(g => { if (g.sim) { const sc = C.score(g.sim); g.results[cl.round] = { total: sc.total, found: sc.found, falseConf: sc.falseConf, expired: sc.expired, area: sc.area, dropped: sc.dropped, ops: sc.ops }; } });
  if (phase === 'setup') { Object.values(cl.groups).forEach(g => { g.sim = null; g.ready = false; g.texts.op = ''; }); cl.running = false; }
  cl.phase = phase;
}

/* ---------- views ---------- */
function pubReport(r, truth) {
  const o = { id: r.id, asset: r.asset, sensor: r.sensor, x: +r.x.toFixed(2), y: +r.y.toFixed(2), square: r.square, conf: r.conf, desc: r.desc, look: r.look,
              moving: r.moving, wx: r.wx, tArr: r.tArr, exp: r.exp, status: r.status, verdict: r.verdict, note: r.note, by: r.by, tAss: r.tAss, cmdExp: r.cmdExp, tDec: r.tDec, expiredAt: r.expiredAt };
  if (truth) { o.real = r.real; o.tx = r.tx; o.ty = r.ty; }
  return o;
}
function mapString(S) { let s = ''; for (let i = 0; i < C.W * C.H; i++) s += S.observed[i] ? (S.returned[i] ? '2' : '1') : '0'; return s; }
function truthList(S) { return C.CONTACTS.map(c => { const p = C.contactPos(c, S.t); return { id: c.id, real: c.real, label: c.label, x: p.x, y: p.y }; }); }
function groupView(cl, g, role, full) {
  const S = g.sim, v = { phase: cl.phase, round: cl.round, running: cl.running, speed: cl.speed, spec: spec(cl), cfg: g.cfg, ready: g.ready,
    texts: g.texts, corrections: g.corrections, workload: g.workload, active: ROLES.filter(r => active(g, r)), myAssets: opAssets(g, role) };
  if (!S) return v;
  const truth = cl.phase === 'debrief';
  let reps;
  if (cl.phase === 'mission' && !full) {
    const recent = S.reports.filter(r => ['open', 'assessed', 'filtered', 'confirmed'].indexOf(r.status) < 0).slice(-12).map(r => r.id);
    reps = S.reports.filter(r => r.status === 'open' || r.status === 'assessed' || r.status === 'confirmed' || recent.indexOf(r.id) >= 0);
  } else reps = S.reports;
  v.sim = { t: S.t, length: S.spec.length, done: S.done, weather: S.weather, commsDown: S.commsDown, events: S.events.slice(-40),
            assets: KINDS.map(k => { const st = S.assets[k]; return { kind: k, x: st.x + (truth ? 0 : st.off[0]), y: st.y + (truth ? 0 : st.off[1]), alive: st.alive, gpsLost: st.gpsLost, charging: !!st.charging, goingHome: !!st.goingHome, battery: st.battery ? Math.round(st.battery) : 0, cap: st.cap || 0 }; }),
            reports: reps.map(r => pubReport(r, truth)), map: mapString(S), nReports: S.reports.length };
  if (truth) { v.score = C.score(S); delete v.score.foundIds; v.found = C.score(S).foundIds; v.truth = truthList(S); }
  return v;
}
function facView(cl) {
  return { code: cl.code, phase: cl.phase, round: cl.round, running: cl.running, speed: cl.speed, ov: cl.ov, spec: spec(cl),
    groups: Object.values(cl.groups).map(g => {
      const o = { name: g.name, ready: g.ready, active: ROLES.filter(r => active(g, r)), results: g.results };
      if (g.sim) { const sc = C.score(g.sim); o.live = { t: g.sim.t, total: sc.total, found: sc.found, falseConf: sc.falseConf, expired: sc.expired, waiting: C.queue(g.sim).length, atCommand: C.cqueue(g.sim).length, done: g.sim.done }; }
      return o; }) };
}

/* ---------- actions ---------- */
const CFG_FIELDS = { drone: ['preset', 'primary', 'fallback', 'speed', 'onDet', 'alt', 'lostRule', 'path', 'route'], ground: ['preset', 'primary', 'fallback', 'speed', 'onDet', 'lostRule', 'path', 'route'], mast: ['preset', 'primary', 'fallback', 'pos', 'route', 'lostRule'] };
function canEdit(role, part) { return role === 'facilitator' || role === 'commander' || role === part || (part === 'operator' && /^operator/.test(role)); }
function act(cl, g, role, a) {
  const S = g && g.sim;
  switch (a.type) {
    case 'cfg': {
      if (cl.phase !== 'setup' || !canEdit(role, a.part)) return 'Not allowed now.';
      const v = a.value || {};
      if (a.part === 'command') g.cfg.command = { zones: { drone: +v.zones.drone, ground: +v.zones.ground, mast: +v.zones.mast }, threshold: +v.threshold, interval: +v.interval, budget: +v.budget, revisit: !!v.revisit, decideWithin: +v.decideWithin || 40 };
      else if (a.part === 'operator') g.cfg.operator = { order: String(v.order), filter: +v.filter, expiry: +v.expiry };
      else if (KINDS.indexOf(a.part) >= 0) { const dst = {}; CFG_FIELDS[a.part].forEach(f => { if (v[f] !== undefined) dst[f] = v[f]; }); g.cfg[a.part] = dst; }
      else return 'Unknown setting.';
      g.ready = false; return null;
    }
    case 'ready': if (role !== 'commander' && role !== 'facilitator') return 'Only the commander can mark the unit ready.'; g.ready = !!a.value; return null;
    case 'assess': if (!S || (!/^operator/.test(role) && role !== 'facilitator')) return 'Only operators assess reports.'; return C.assess(S, +a.id, a.verdict === 'real' ? 'real' : 'false', String(a.note || '').slice(0, 200), role) ? null : 'That report is no longer open.';
    case 'decide': {
      if (!S || (role !== 'commander' && role !== 'facilitator')) return 'Only the commander decides.';
      if (a.decision === 'recheck') { const r = S.reports.find(x => x.id === +a.id); if (!r) return 'Unknown report.'; if (r.status !== 'assessed') return 'Already decided.'; if (!C.retask(S, a.asset || r.asset, r.x, r.y)) return 'That asset cannot re-check now.'; C.decide(S, +a.id, 'rejected'); S.reports.find(x => x.id === +a.id).recheck = true; return null; }
      return C.decide(S, +a.id, a.decision === 'confirmed' ? 'confirmed' : 'rejected') ? null : 'Already decided.';
    }
    case 'text': if (a.key === 'op') g.texts.op = String(a.value).slice(0, 5000); else if (KINDS.indexOf(a.key) >= 0) g.texts.dir[a.key] = String(a.value).slice(0, 3000); else return 'Unknown text.'; return null;
    case 'corr': if (cl.phase !== 'gap') return 'Map corrections are made in the gap.'; if (a.remove != null) g.corrections.splice(+a.remove, 1); else g.corrections.push({ x: +a.x, y: +a.y, type: String(a.kind).slice(0, 20) }); return null;
    case 'workload': g.workload = (a.value || []).slice(0, 3).map(x => Math.max(1, Math.min(5, +x || 3))); return null;
    default: return 'Unknown action.';
  }
}
function facAct(cl, a) {
  switch (a.type) {
    case 'phase': if (['setup', 'mission', 'gap', 'debrief'].indexOf(a.phase) < 0) return 'Unknown phase.'; toPhase(cl, a.phase); return null;
    case 'run': if (cl.phase !== 'mission') return 'Not in the mission phase.'; cl.running = !!a.value; return null;
    case 'speed': cl.speed = [1, 2, 4].indexOf(+a.value) >= 0 ? +a.value : 1; return null;
    case 'round': if (cl.phase !== 'setup') return 'Change the round during setup.'; cl.round = [1, 2, 3].indexOf(+a.value) >= 0 ? +a.value : 1; return null;
    case 'ov': cl.ov = { seed: (a.value && a.value.seed) || '', length: +(a.value && a.value.length) || 360, weather: (a.value && a.value.weather) || '' }; return null;
    case 'removeGroup': delete cl.groups[a.name]; return null;
    default: return 'Unknown action.';
  }
}

/* ---------- http ---------- */
function send(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); }
function readBody(req) { return new Promise((ok, bad) => { let d = ''; req.on('data', c => { d += c; if (d.length > 2e5) req.destroy(); }); req.on('end', () => { try { ok(d ? JSON.parse(d) : {}); } catch (e) { bad(e); } }); }); }
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
function staticFile(res, file) { fs.readFile(file, (err, data) => { if (err) { res.writeHead(404); res.end('Not found'); return; } res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(data); }); }
function groupName(s) { return String(s || '').trim().replace(/\s+/g, ' ').slice(0, 30); }

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  try {
    if (req.method === 'GET' && (u.pathname === '/' || u.pathname === '/index.html')) return staticFile(res, path.join(PUB, 'play.html'));
    if (req.method === 'GET' && u.pathname === '/core.js') return staticFile(res, path.join(__dirname, 'core.js'));
    if (req.method === 'GET' && u.pathname === '/views.js') return staticFile(res, path.join(PUB, 'views.js'));
    if (req.method === 'GET' && u.pathname === '/health') return send(res, 200, { ok: true, classes: Object.keys(classes).length });
    if (req.method === 'POST' && u.pathname === '/api/class') { const cl = newClass(); return send(res, 200, { code: cl.code, token: cl.token }); }
    if (u.pathname.indexOf('/api/') !== 0) { res.writeHead(404); res.end('Not found'); return; }
    const q = req.method === 'GET' ? Object.fromEntries(u.searchParams) : await readBody(req);
    const cl = classes[String(q.code || '').trim().toUpperCase()];
    if (!cl) return send(res, 404, { error: 'No class with that code. Check the code with your facilitator.' });
    cl.touched = Date.now();
    const isFac = !!q.token && q.token === cl.token;
    if (u.pathname === '/api/groups') return send(res, 200, { groups: Object.keys(cl.groups) });
    if (u.pathname === '/api/join') {
      const name = groupName(q.group); if (!name) return send(res, 400, { error: 'Enter a group name.' });
      if (ROLES.indexOf(q.role) < 0) return send(res, 400, { error: 'Choose a role.' });
      if (!cl.groups[name]) { if (Object.keys(cl.groups).length >= 16) return send(res, 400, { error: 'This class already has 16 groups.' }); cl.groups[name] = newGroup(name); }
      cl.groups[name].seen[q.role] = Date.now();
      return send(res, 200, { ok: true, group: name });
    }
    if (u.pathname === '/api/state') {
      if (q.role === 'facilitator') {
        if (!isFac) return send(res, 403, { error: 'Facilitator key missing.' });
        const v = facView(cl), wg = q.watch && cl.groups[q.watch];
        if (wg) { v.watch = groupView(cl, wg, 'facilitator', false); if (q.truth === '1' && wg.sim) v.watch.truth = truthList(wg.sim); }
        return send(res, 200, v);
      }
      const g = cl.groups[groupName(q.group)]; if (!g) return send(res, 404, { error: 'Unknown group.' });
      if (ROLES.indexOf(q.role) >= 0) g.seen[q.role] = Date.now();
      return send(res, 200, groupView(cl, g, q.role, q.full === '1'));
    }
    if (u.pathname === '/api/act') {
      if (q.role === 'facilitator') {
        if (!isFac) return send(res, 403, { error: 'Facilitator key missing.' });
        let e;
        if (q.group) { const g = cl.groups[groupName(q.group)]; if (!g) return send(res, 404, { error: 'Unknown group.' }); e = act(cl, g, 'facilitator', q); }
        else e = facAct(cl, q);
        return send(res, e ? 400 : 200, e ? { error: e } : { ok: true });
      }
      const g = cl.groups[groupName(q.group)]; if (!g) return send(res, 404, { error: 'Unknown group.' });
      if (ROLES.indexOf(q.role) < 0) return send(res, 400, { error: 'Unknown role.' });
      g.seen[q.role] = Date.now();
      const e = act(cl, g, q.role, q); return send(res, e ? 400 : 200, e ? { error: e } : { ok: true });
    }
    return send(res, 404, { error: 'Unknown API call.' });
  } catch (e) { send(res, 500, { error: 'Server error: ' + e.message }); }
});
if (require.main === module) server.listen(PORT, () => console.log('Patrol Unit Simulator server on port ' + PORT));
module.exports = { server, classes, toPhase };
