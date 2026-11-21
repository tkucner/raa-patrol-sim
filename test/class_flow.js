/* End-to-end check of the classroom server: node test/class_flow.js [baseUrl] [seconds] */
const B = (process.argv[2] || 'http://localhost:8091') + '/';
const SECS = +(process.argv[3] || 40);
const j = (m, u, d) => fetch(B + u, { method: m, headers: { 'Content-Type': 'application/json' }, body: d ? JSON.stringify(d) : undefined }).then(r => r.json());
(async () => {
  console.log('health', await (await fetch(B + 'health')).json());
  const c = await j('POST', 'api/class', {}); console.log('class', c.code);
  for (const role of ['commander', 'operator1', 'operator2', 'drone']) console.log('join', role, (await j('POST', 'api/join', { code: c.code, group: 'Alpha', role })).ok);
  console.log('join beta', (await j('POST', 'api/join', { code: c.code, group: 'Beta', role: 'commander' })).ok);
  const st = await j('GET', `api/state?code=${c.code}&group=Alpha&role=drone`);
  const d = Object.assign(st.cfg.drone, { route: 'custom', path: [[33, 3], [56, 3], [56, 9], [33, 9]] });
  console.log('cfg drone', JSON.stringify(await j('POST', 'api/act', { code: c.code, group: 'Alpha', role: 'drone', type: 'cfg', part: 'drone', value: d })));
  console.log('cfg forbidden', JSON.stringify(await j('POST', 'api/act', { code: c.code, group: 'Alpha', role: 'drone', type: 'cfg', part: 'command', value: st.cfg.command })));
  const fac = (type, extra) => j('POST', 'api/act', Object.assign({ code: c.code, token: c.token, role: 'facilitator', type }, extra));
  console.log('mission', JSON.stringify(await fac('phase', { phase: 'mission' })), 'speed', JSON.stringify(await fac('speed', { value: 4 })), 'run', JSON.stringify(await fac('run', { value: true })));
  const t0 = Date.now(); let a = 0, dd = 0, rc = 0;
  while (Date.now() - t0 < SECS * 1000) {
    for (const op of ['operator1', 'operator2']) {
      const s = await j('GET', `api/state?code=${c.code}&group=Alpha&role=${op}`);
      const q = s.sim.reports.filter(r => r.status === 'open' && s.myAssets.includes(r.asset));
      if (q[0]) { const r = await j('POST', 'api/act', { code: c.code, group: 'Alpha', role: op, type: 'assess', id: q[0].id, verdict: q[0].conf > 55 ? 'real' : 'false', note: 'Two sensors agree' }); if (r.ok) a++; }
    }
    const s = await j('GET', `api/state?code=${c.code}&group=Alpha&role=commander`);
    const q = s.sim.reports.filter(r => r.status === 'assessed');
    if (q[0]) { const dec = (dd === 3 && q[0].asset !== 'mast') ? 'recheck' : (q[0].verdict === 'real' ? 'confirmed' : 'rejected'); const r = await j('POST', 'api/act', { code: c.code, group: 'Alpha', role: 'commander', type: 'decide', id: q[0].id, decision: dec }); if (r.ok) { dd++; if (dec === 'recheck') rc++; } else console.log('decide err', r.error); }
    await new Promise(r => setTimeout(r, 500));
  }
  const f = await j('GET', `api/state?code=${c.code}&role=facilitator&token=${c.token}&watch=Alpha`);
  console.log('fac live', JSON.stringify(f.groups.map(g => [g.name, g.active, g.live])));
  console.log('assessed', a, 'decided', dd, 'rechecks', rc);
  console.log('last events:', f.watch.sim.events.map(e => Math.round(e.t) + ' ' + e.text).slice(-4).join(' | '));
  console.log(JSON.stringify({ code: c.code, token: c.token }));
})().catch(e => { console.log('ERR', e); process.exit(1); });
