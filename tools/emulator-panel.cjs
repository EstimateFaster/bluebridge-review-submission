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

const PAGE = '<!DOCTYPE html>' + EOL
+ '<html lang="zh-CN"><head><meta charset="utf-8"><title>Vela 模拟器面板</title>' + EOL
+ '<style>' + EOL
+ ':root{color-scheme:dark}' + EOL
+ 'body{margin:0;background:#0b1220;color:#dbe6f5;font-family:system-ui,"Noto Sans CJK SC",sans-serif;display:flex;flex-direction:column;min-height:100vh}' + EOL
+ 'header{padding:12px 18px;display:flex;align-items:center;gap:12px;border-bottom:1px solid #1e293b;background:#0f172a}' + EOL
+ 'h1{font-size:15px;margin:0;font-weight:600}' + EOL
+ '.dot{width:8px;height:8px;border-radius:50%;background:#64748b}' + EOL
+ '.dot.on{background:#22c55e;box-shadow:0 0 8px #22c55e}' + EOL
+ '.status{font-size:12px;color:#94a3b8;margin-left:auto}' + EOL
+ 'main{padding:16px;display:flex;gap:18px;align-items:flex-start;justify-content:center;flex-wrap:wrap}' + EOL
+ '.stage{border:1px solid #1e293b;border-radius:22px;padding:10px;background:#0a1424;box-shadow:0 20px 60px rgba(0,0,0,.5)}' + EOL
+ 'canvas{display:block;width:336px;height:480px;border-radius:14px;background:#000;cursor:crosshair}' + EOL
+ '.hint{font-size:12px;color:#64748b;max-width:360px;line-height:1.7;margin:10px 0 0;text-align:center}' + EOL
+ '.side{display:flex;flex-direction:column;gap:8px;min-width:170px}' + EOL
+ 'button{background:#1e293b;color:#dbe6f5;border:1px solid #334155;border-radius:9px;padding:9px 12px;font-size:13px;cursor:pointer}' + EOL
+ 'button:hover{background:#273449;border-color:#475569}' + EOL
+ 'button:active{transform:translateY(1px)}' + EOL
+ '.k{font-size:11px;color:#64748b;line-height:1.6;margin-top:4px}' + EOL
+ '.err{color:#f87171;font-size:12px;max-width:340px}' + EOL
+ '</style></head>' + EOL
+ '<body>' + EOL
+ '<header><span class="dot" id="dot"></span><h1>Vela 模拟器面板 · 336×480</h1><span class="status" id="status">连接中…</span></header>' + EOL
+ '<main><div><div class="stage"><canvas id="cv" width="336" height="480"></canvas></div>' + EOL
+ '<p class="hint">点击 / 拖拽画布 = 真实鼠标事件注入（Vela 镜像下 sendTouch 无效，sendMouse 有效，已用点击计数应用验证）。</p></div>' + EOL
+ '<div class="side">' + EOL
+ '<button id="btn-restart">重启应用</button>' + EOL
+ '<button id="btn-reload">重装当前 rpk</button>' + EOL
+ '<button id="btn-snap">保存当前帧</button>' + EOL
+ '<div class="k">面板通过官方 Vela 模拟器 gRPC 实时取帧（约 4 fps）；重启/重装走本地 adb。</div>' + EOL
+ '<div class="err" id="err"></div></div></main>' + EOL
+ '<script>' + EOL
+ 'var cv=document.getElementById("cv"),ctx=cv.getContext("2d"),dot=document.getElementById("dot"),st=document.getElementById("status"),err=document.getElementById("err");' + EOL
+ 'var img=new Image();img.onload=function(){cv.width=img.width;cv.height=img.height;ctx.drawImage(img,0,0);};' + EOL
+ 'var last=0;var es=new EventSource("/api/stream");' + EOL
+ 'es.onmessage=function(e){try{var d=JSON.parse(e.data);img.src="data:image/png;base64,"+d.img;dot.classList.add("on");var t=performance.now();var fps=(last&&t>last)?" · "+(1000/(t-last)).toFixed(1)+" fps":"";st.textContent="已连接"+fps+" · 帧 #"+d.seq;last=t;}catch(x){}};' + EOL
+ 'es.onerror=function(){dot.classList.remove("on");st.textContent="连接中断，重试中…";};' + EOL
+ 'function post(u,b){return fetch(u,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(b)}).then(function(r){if(!r.ok)return r.text().then(function(t){err.textContent="失败: "+t;});err.textContent="";return null;});}' + EOL
+ 'function pt(ev){var r=cv.getBoundingClientRect();return {x:(ev.clientX-r.left)*(cv.width/r.width),y:(ev.clientY-r.top)*(cv.height/r.height)};}' + EOL
+ 'cv.addEventListener("pointerdown",function(ev){var p=pt(ev);cv.setPointerCapture(ev.pointerId);post("/api/mouse",{x:p.x,y:p.y,buttons:1});});' + EOL
+ 'cv.addEventListener("pointermove",function(ev){if(ev.buttons){var p=pt(ev);post("/api/mouse",{x:p.x,y:p.y,buttons:1});}});' + EOL
+ 'cv.addEventListener("pointerup",function(ev){var p=pt(ev);post("/api/mouse",{x:p.x,y:p.y,buttons:0});});' + EOL
+ 'cv.addEventListener("pointercancel",function(ev){var p=pt(ev);post("/api/mouse",{x:p.x,y:p.y,buttons:0});});' + EOL
+ 'document.getElementById("btn-restart").onclick=function(){post("/api/action",{name:"restart"});};' + EOL
+ 'document.getElementById("btn-reload").onclick=function(){post("/api/action",{name:"reload"});};' + EOL
+ 'document.getElementById("btn-snap").onclick=function(){var a=document.createElement("a");a.href=cv.toDataURL("image/png");a.download="vela-frame.png";a.click();};' + EOL
+ '</script></body></html>';

function readBody(req, cb) {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => cb(body));
}

const server = http.createServer((req, res) => {
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
        if (b.name === 'restart') {
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
