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

/* ---------- 手势回放（官方 gRPC sendMouse 的按下/移动/抬起序列） ----------
   Vela 5.0 镜像实测：sendTouch 各编码变体均无响应；sendMouse 会被 Vela 运行时当作
   指针/触摸事件处理（点击、横向拖动滚动均有效）。因此面板把手势录制成路径后在
   服务端按 60Hz 回放，手机端只发一次请求，避免每帧往返造成丢帧/卡顿。 */
const ACTION_LOG = '/tmp/vela-panel-actions.log';
function logAction(kind, detail) {
  try { fs.appendFileSync(ACTION_LOG, new Date().toISOString() + ' ' + kind + ' ' + JSON.stringify(detail) + EOL); } catch (e) {}
}
const clampX = (v) => Math.max(0, Math.min(335, Math.round(Number(v) || 0)));
const clampY = (v) => Math.max(0, Math.min(479, Math.round(Number(v) || 0)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function replayGesture(points) {
  const src = Array.isArray(points) ? points : [];
  const pts = src.map((p) => ({ x: clampX(p && p.x), y: clampY(p && p.y) })).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (!pts.length) throw new Error('empty gesture');
  logAction('gesture', { points: pts.length, start: pts[0], end: pts[pts.length - 1] });
  await mouse(pts[0].x, pts[0].y, 1);
  if (pts.length === 1) {
    await sleep(90);
    await mouse(pts[0].x, pts[0].y, 0);
    return { points: 1, type: 'tap' };
  }
  let prev = pts[0];
  await sleep(14);
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    const dist = Math.hypot(p.x - prev.x, p.y - prev.y);
    const steps = Math.max(1, Math.min(4, Math.round(dist / 6)));
    for (let s = 1; s <= steps; s++) {
      await mouse(prev.x + ((p.x - prev.x) * s) / steps, prev.y + ((p.y - prev.y) * s) / steps, 1);
      await sleep(12);
    }
    prev = p;
  }
  await sleep(14);
  await mouse(pts[pts.length - 1].x, pts[pts.length - 1].y, 0);
  return { points: pts.length, type: 'swipe' };
}

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
const mjpegClients = new Set();
const MJ_BOUNDARY = 'velaframe';
function mjpegWrite(buf) {
  const head = '--' + MJ_BOUNDARY + EOL + 'Content-Type: image/png' + EOL + 'Content-Length: ' + buf.length + EOL + EOL;
  for (const c of mjpegClients) {
    try { c.write(head); c.write(buf); c.write(EOL); } catch (e) { mjpegClients.delete(c); }
  }
}
let lastHash = '';
let seq = 0;
let lastPng = null; // 最近一帧（直播缩放后）
let lastError = '';

/* ---------- 直播帧参数 ----------
   官方 ImageFormat 支持 width/height 缩放：默认 0.5（168×240）传输体积约为原图 1/4，
   手机端解码与网络都更轻；抓图/保存走 /api/frame 的原生 336×480。 */
const LIVE_SCALE = Math.max(0.25, Math.min(1, Number(process.env.PANEL_SCALE) || 0.5));
const DEV_W = Number(cfg['hw.lcd.width'] || 336);
const DEV_H = Number(cfg['hw.lcd.height'] || 480);
const LIVE_W = Math.round(DEV_W * LIVE_SCALE);
const LIVE_H = Math.round(DEV_H * LIVE_SCALE);
const LIVE_FMT = { format: 'PNG', width: LIVE_W, height: LIVE_H, display: 0 };
const NATIVE_FMT = { format: 'PNG', width: 0, height: 0, display: 0 };
const stats = { frames: 0, pushes: 0, rpcMs: 0, bytes: 0, started: Date.now() };

async function grab(fmt) {
  return Buffer.from((await call(client.getScreenshot, fmt)).image || []);
}

/* 自适应节奏：活跃时 ~30fps（33ms 一帧），画面静止 600ms 后降到 ~8fps 省 CPU。 */
async function frameLoop() {
  const t0 = Date.now();
  try {
    const buf = await grab(LIVE_FMT);
    if (buf.length >= 100) {
      const hash = crypto.createHash('md5').update(buf).digest('hex');
      if (hash !== lastHash) {
        lastHash = hash;
        lastPng = buf;
        seq += 1;
        lastActiveAt = t0;
        stats.frames += 1;
        stats.pushes += 1;
        stats.bytes = buf.length;
        const ssePayload = 'data: ' + JSON.stringify({ seq, img: buf.toString('base64'), w: LIVE_W, h: LIVE_H, bytes: buf.length }) + NL2;
        for (const r of sseClients) r.write(ssePayload);
        mjpegWrite(buf);
      }
    }
  } catch (e) {
    lastError = e.message;
  }
  const spent = Date.now() - t0;
  stats.rpcMs = Math.round(stats.rpcMs * 0.8 + spent * 0.2);
  const idle = Date.now() - lastActiveAt > 600;
  const target = idle ? 120 : 33;
  setTimeout(frameLoop, Math.max(4, target - spent));
}
let lastActiveAt = Date.now();
frameLoop();

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
    res.end(JSON.stringify({
      emulator: SN, grpcPort: cfg['grpc.port'], booted, seq, lastError, up: true,
      panelVersion: '1.2.0', injection: 'pointer-gesture-replay', touchSupported: false,
      liveScale: LIVE_SCALE, liveW: LIVE_W, liveH: LIVE_H, rpcMs: stats.rpcMs, frameBytes: stats.bytes,
      active: Date.now() - lastActiveAt < 600,
      actionLog: ACTION_LOG, hint: '拖动 = 录路径 + 服务端回放 sendMouse（Vela 5.0 镜像 sendTouch 无响应）'
    }));
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/mjpeg') {
    res.writeHead(200, {
      'content-type': 'multipart/x-mixed-replace; boundary=' + MJ_BOUNDARY,
      'cache-control': 'no-store',
      connection: 'close',
      'x-live-scale': String(LIVE_SCALE)
    });
    if (lastPng) {
      res.write('--' + MJ_BOUNDARY + EOL + 'Content-Type: image/png' + EOL + 'Content-Length: ' + lastPng.length + EOL + EOL);
      res.write(lastPng);
      res.write(EOL);
    }
    mjpegClients.add(res);
    req.on('close', () => mjpegClients.delete(res));
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/frame') {
    try {
      const buf = await grab(NATIVE_FMT);
      if (buf.length < 100) { res.writeHead(503); res.end('no frame'); return; }
      res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' });
      res.end(buf);
    } catch (e) { res.writeHead(503); res.end(String(e.message || e)); }
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/mouse') {
    readBody(req, async (body) => {
      try {
        const b = JSON.parse(body || '{}');
        logAction('mouse', { x: b.x, y: b.y, buttons: b.buttons ? 1 : 0 });
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
  if (req.method === 'POST' && url.pathname === '/api/gesture') {
    readBody(req, async (body) => {
      try {
        const b = JSON.parse(body || '{}');
        const info = await replayGesture(b.points);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, info }));
      } catch (e) { res.writeHead(500); res.end(String(e.message || e)); }
    });
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/logs') {
    let text = '';
    try { text = fs.readFileSync(ACTION_LOG, 'utf8').split(EOL).filter(Boolean).slice(-80).join(EOL); } catch (e) {}
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(text);
    return;
  }
  res.writeHead(404); res.end('not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('PANEL_READY http://127.0.0.1:' + PORT + '/ (gRPC ' + cfg['grpc.port'] + ', adb ' + SN + ')');
});
