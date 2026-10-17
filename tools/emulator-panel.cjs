#!/usr/bin/env node
/* Vela 模拟器可视化面板（不依赖 AIoT-IDE）
   - 浏览器实时看 336×480 画面（gRPC getScreenshot → SSE）
   - 点击/拖拽 → gRPC sendMouse（实测 Vela 镜像对 sendTouch 无响应，鼠标事件可用）
   - 重启应用 / 重装当前 rpk / 保存帧
   用法：node tools/emulator-panel.cjs [port]     默认 8770
   先决条件：tools/emulator-run.cjs 已启动 VVD。
*/
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');
const grpc = require('@grpc/grpc-js');
const pl = require('@grpc/proto-loader');

const ROOT = path.resolve(__dirname, '..');
const EMU = path.join(ROOT, 'node_modules/@aiot-toolkit/emulator');
const ADB = path.join(ROOT, 'node_modules/@miwt/adb/bin/linux/adb');
const RPK = path.join(ROOT, 'vela-weather-336x480.debug.rpk');
const PKG = 'com.bluebridge.review.weather';
const PORT = Number(process.argv[2] || 8770);
const EOL = String.fromCharCode(10);
const NL2 = EOL + EOL;

function runningConfig() {
  const dirs = [path.join(os.homedir(), '.android/avd/running'), path.join('/tmp', 'android-' + (process.env.USER || 'root'), 'avd/running')];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!/^pid_\d+\.ini$/.test(f)) continue;
      const text = fs.readFileSync(path.join(dir, f), 'utf-8');
      if (!text.includes('avd.name=VelaWeather')) continue;
      const cfg = {};
      text.split(EOL).forEach((line) => {
        const i = line.indexOf('=');
        if (i > 0) cfg[line.slice(0, i).trim()] = line.slice(i + 1).trim();
      });
      return cfg;
    }
  }
  return null;
}

const cfg = runningConfig();
if (!cfg || !cfg['grpc.port']) {
  console.error('未找到运行中的 VelaWeather 模拟器，请先运行: node tools/emulator-run.cjs');
  process.exit(1);
}
const SN = 'emulator-' + (cfg['port.serial'] || '5554');
const def = pl.loadSync(path.join(EMU, 'lib/static/proto/emulator_controller.proto'), {
  keepCase: true, longs: String, enums: String, defaults: true, oneofs: true,
});
const ctl = grpc.loadPackageDefinition(def).android.emulation.control;
const client = new ctl.EmulatorController('127.0.0.1:' + cfg['grpc.port'], grpc.credentials.createInsecure());
const meta = new grpc.Metadata();
if (cfg['grpc.token']) meta.set('Authorization', 'Bearer ' + cfg['grpc.token']);
const call = (fn, req) => new Promise((resolve, reject) => fn.call(client, req, meta, (e, r) => (e ? reject(e) : resolve(r))));
const mouse = (x, y, buttons) => call(client.sendMouse, { x: Math.round(x), y: Math.round(y), buttons, display: 0 });

function adb(args, timeoutMs) {
  return new Promise((resolve) => {
    const ps = spawn(ADB, ['-s', SN].concat(args));
    let out = '';
    let done = false;
    ps.stdout.on('data', (d) => (out += d));
    ps.stderr.on('data', (d) => (out += d));
    const timer = setTimeout(() => { if (!done) { done = true; ps.kill('SIGKILL'); resolve({ code: -1, out: out + ' (timeout)' }); } }, timeoutMs || 15000);
    ps.on('close', (code) => { if (!done) { done = true; clearTimeout(timer); resolve({ code, out }); } });
  });
}

const sseClients = new Set();
let lastHash = '';
let seq = 0;
let lastPng = null;
let lastError = '';

async function frameLoop() {
  try {
    const res = await call(client.getScreenshot, ctl.ImageFormat);
    const buf = Buffer.from(res.image || []);
    if (buf.length < 100) return;
    const hash = crypto.createHash('md5').update(buf).digest('hex');
    if (hash === lastHash) return;
    lastHash = hash;
    lastPng = buf;
    seq += 1;
    const payload = 'data: ' + JSON.stringify({ seq, img: buf.toString('base64') }) + NL2;
    for (const r of sseClients) r.write(payload);
  } catch (e) {
    lastError = e.message;
  }
}
setInterval(frameLoop, 250);

const PAGE = fs.readFileSync(path.join(__dirname, 'panel-ui.html'), 'utf8');

function readBody(req, cb) {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => cb(body));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(PAGE);
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/stream') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
    res.write('retry: 1000' + NL2);
    if (lastPng) res.write('data: ' + JSON.stringify({ seq, img: lastPng.toString('base64') }) + NL2);
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/status') {
    let booted = false;
    try {
      const st = await call(client.getStatus, ctl.EmulatorStatus);
      booted = Boolean(st && st.booted);
    } catch (e) { booted = false; }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ emulator: SN, grpcPort: cfg['grpc.port'], booted, seq, lastError, up: true }));
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/frame') {
    if (!lastPng) { res.writeHead(503); res.end('no frame yet'); return; }
    res.writeHead(200, { 'content-type': 'image/png' });
    res.end(lastPng);
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/mouse') {
    readBody(req, async (body) => {
      try {
        const b = JSON.parse(body || '{}');
        await mouse(Number(b.x) || 0, Number(b.y) || 0, b.buttons ? 1 : 0);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{"ok":true}');
      } catch (e) { res.writeHead(500); res.end(String(e.message || e)); }
    });
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/action') {
    readBody(req, async (body) => {
      try {
        const b = JSON.parse(body || '{}');
        let out = '';
        if (b.name === 'wake') {
          await call(client.sendMouse, { x: 168, y: 240, buttons: 1, display: 0 });
          await new Promise((r) => setTimeout(r, 120));
          await call(client.sendMouse, { x: 168, y: 240, buttons: 0, display: 0 });
          out = 'wake sent';
        } else if (b.name === 'restart') {
          await adb(['shell', 'am', 'force-stop', PKG]);
          out = (await adb(['shell', 'am', 'start', PKG])).out;
        }
        else if (b.name === 'reload') {
          await adb(['push', RPK, '/data/app/' + PKG + '.rpk']);
          out += (await adb(['shell', 'pm', 'install', '/data/app/' + PKG + '.rpk'])).out;
          await adb(['shell', 'am', 'force-stop', PKG]);
          out += (await adb(['shell', 'am', 'start', PKG])).out;
        } else { res.writeHead(400); res.end('unknown action'); return; }
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, out: out.slice(0, 2000) }));
      } catch (e) { res.writeHead(500); res.end(String(e.message || e)); }
    });
    return;
  }
  res.writeHead(404); res.end('not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('PANEL_READY http://127.0.0.1:' + PORT + '/ (gRPC ' + cfg['grpc.port'] + ', adb ' + SN + ')');
});
