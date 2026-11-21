/* Builds the single-file offline simulator (index.html) from the shared sources:
   single/single.html + server/core.js + server/public/views.js.  Run: node tools/build_single.js */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let html = read('single/single.html');
const core = read('server/core.js'), views = read('server/public/views.js');
for (const [mark, code] of [['/*@CORE@*/', core], ['/*@VIEWS@*/', views]]) {
  if (html.indexOf(mark) < 0) throw new Error('marker missing: ' + mark);
  if (/<\/script/i.test(code)) throw new Error('source contains a closing script tag');
  html = html.replace(mark, () => code);
}
fs.writeFileSync(path.join(root, 'index.html'), html);
console.log('index.html written,', html.length, 'bytes');
