/* Dedicated Pages artifact. Never rewrites the original Brand Studio index. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'studio'), { recursive: true });
fs.copyFileSync(path.join(root, 'content-engine.html'), path.join(dist, 'index.html'));
fs.copyFileSync(path.join(root, 'content-engine.html'), path.join(dist, 'content-engine.html'));
fs.cpSync(path.join(root, 'engine'), path.join(dist, 'engine'), { recursive: true });
for (const name of ['index.html','app.js','style.css','guide.js','guide.css','library.js','library.css','content-studio.js','content-studio.css','templates-render.js','lib','data','assets']) {
  fs.cpSync(path.join(root, name), path.join(dist, 'studio', name), { recursive: true });
}
fs.writeFileSync(path.join(dist, '_headers'), `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'
`);
console.log('Content Engine built in dist/; Brand Studio preserved in dist/studio/.');

require('esbuild').buildSync({entryPoints:[path.join(root,'server/worker.mjs')],outfile:path.join(dist,'_worker.js'),bundle:true,format:'esm',platform:'browser',target:'es2022'});
fs.writeFileSync(path.join(dist,'_routes.json'),JSON.stringify({version:1,include:['/api/*','/r/*'],exclude:[]}));
