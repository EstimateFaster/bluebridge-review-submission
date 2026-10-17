#!/usr/bin/env node
/* 从正在运行的 Vela 虚拟设备抓取真实截图（gRPC），不依赖 AIoT-IDE。
   用法：node tools/emulator-shot.cjs [输出文件名，默认 emu-01.png]
*/
const path = require('path');
const fs = require('fs');
const os = require('os');
const grpc = require('@grpc/grpc-js');
const pl = require('@grpc/proto-loader');

const ROOT = path.resolve(__dirname, '..');
const EMU = path.join(ROOT, 'node_modules/@aiot-toolkit/emulator');
const arg = process.argv[2] || 'emu-01.png';
const out = path.isAbsolute(arg) ? arg : path.join(ROOT, 'screenshots', arg);

function runningConfig() {
  const dirs = [
    path.join(os.homedir(), '.android/avd/running'),
    path.join('/tmp', 'android-' + (process.env.USER || 'root'), 'avd/running'),
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!/^pid_\d+\.ini$/.test(f)) continue;
      const text = fs.readFileSync(path.join(dir, f), 'utf-8');
      if (text.includes('avd.name=VelaWeather')) {
        const cfg = {};
        text.split('\n').forEach((line) => {
          const i = line.indexOf('=');
          if (i > 0) cfg[line.slice(0, i).trim()] = line.slice(i + 1).trim();
        });
        return cfg;
      }
    }
  }
  return null;
}

(async () => {
  const cfg = runningConfig();
  if (!cfg || !cfg['grpc.port']) throw new Error('未找到运行中的 VelaWeather 模拟器（先运行 tools/emulator-run.cjs）');
  const def = pl.loadSync(path.join(EMU, 'lib/static/proto/emulator_controller.proto'), {
    keepCase: true, longs: String, enums: String, defaults: true, oneofs: true,
  });
  const ctl = grpc.loadPackageDefinition(def).android.emulation.control;
  const client = new ctl.EmulatorController('127.0.0.1:' + cfg['grpc.port'], grpc.credentials.createInsecure());
  const meta = new grpc.Metadata();
  if (cfg['grpc.token']) meta.set('Authorization', 'Bearer ' + cfg['grpc.token']);
  const res = await new Promise((resolve, reject) => {
    client.getScreenshot(ctl.ImageFormat, meta, (err, r) => (err ? reject(err) : resolve(r)));
  });
  const buf = Buffer.from(res.image || []);
  if (buf.slice(0, 4).toString('hex') !== '89504e47') throw new Error('返回内容不是 PNG');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, buf);
  console.log('saved', out, buf.length, 'bytes', buf.readUInt32BE(16) + 'x' + buf.readUInt32BE(20));
  client.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
