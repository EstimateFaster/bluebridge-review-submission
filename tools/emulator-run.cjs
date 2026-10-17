#!/usr/bin/env node
/* 启动小米 Vela 官方虚拟设备（VVD），安装 rpk 并截图。
   用途：在没有 AIoT-IDE 图形界面的 Linux 服务器上验证真机/模拟器运行效果。
   依赖：@aiot-toolkit/emulator（已随 aiot-toolkit 安装）+ 已下载的 ~/.vela/sdk 模拟器 SDK。
*/
const path = require('path');
const os = require('os');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const EMU = path.join(ROOT, 'node_modules/@aiot-toolkit/emulator');
const { VvdManager, VelaImageType, IVvdArchType } = require(EMU);

const sdkHome = path.join(os.homedir(), '.vela/sdk');
const vvdHome = path.join(os.homedir(), '.vela/vvd');
const vvdName = 'VelaWeather';
const imageDir = path.join(sdkHome, 'system-images', 'vela-watch-5.0');
const pkg = 'com.bluebridge.review.weather';
const rpk = path.join(ROOT, 'vela-weather-336x480.debug.rpk');
const outDir = path.join(ROOT, 'screenshots');

const vm = new VvdManager({ sdkHome, vvdHome });

// 模拟器与 adb 的运行环境：qemu 依赖 SDK 自带动态库，adb 使用 @miwt/adb 自带二进制
const adbBin = path.join(ROOT, 'node_modules/@miwt/adb/bin/linux');
const emuLib64 = path.join(sdkHome, 'emulator/linux-x86_64/lib64');
const emuLib = path.join(sdkHome, 'emulator/linux-x86_64/lib');
process.env.PATH = adbBin + ':' + (process.env.PATH || '');
process.env.LD_LIBRARY_PATH = [emuLib64, emuLib, process.env.LD_LIBRARY_PATH || ''].filter(Boolean).join(':');

function ensureVvd() {
  const cfg = path.join(vvdHome, vvdName + '.vvd/config.ini');
  if (fs.existsSync(cfg)) return;
  vm.createVvd({
    name: vvdName,
    width: '336',
    height: '480',
    arch: IVvdArchType.arm,
    imageDir,
    imageType: VelaImageType.VELA_WATCH_5,
    customLcdRadius: '',
    shape: 'rect',
    flavor: 'watch',
    density: '320'
  });
  console.log('VVD created:', vvdName);
}

async function screenshot(grpcConfig, sn, tag) {
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, 'emu-' + tag + '.png');
  try {
    const { createGrpcClient } = require(path.join(EMU, 'lib/vvd/grpc'));
    const client = createGrpcClient(grpcConfig);
    await client.waitForReady();
    const buf = await client.getScreenshot();
    const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
    if (b.length > 100 && b.slice(0, 4).toString('hex') === '89504e47') {
      fs.writeFileSync(out, b);
      console.log('SCREENSHOT_OK', out, b.length);
      client.close();
      return out;
    }
    console.log('gRPC screenshot not PNG, len=', b.length);
    client.close();
  } catch (e) {
    console.log('gRPC screenshot failed:', e.message);
  }
  try {
    const adb = require(path.join(ROOT, 'node_modules/@miwt/adb'));
    const buf = await adb.execAdbCmdAsync('adb -s ' + sn + ' exec-out screencap -p', { encoding: 'buffer' });
    const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
    if (b.length > 100 && b.slice(0, 4).toString('hex') === '89504e47') {
      fs.writeFileSync(out, b);
      console.log('SCREENSHOT_OK_ADB', out, b.length);
      return out;
    }
    console.log('adb screenshot not PNG, len=', b.length);
  } catch (e) {
    console.log('adb screenshot failed:', e.message);
  }
  return null;
}

(async () => {
  ensureVvd();
  console.log('START_EMULATOR', vvdName);
  const res = await vm.startVvd({
    vvdName,
    qtHideWindow: true,
    grpcPort: 8554,
    stdoutCallback: (m) => process.stdout.write('[emu] ' + m + '\n'),
    stderrCallback: (m) => process.stdout.write('[emu!] ' + m + '\n')
  });
  console.log('EMULATOR_BOOTED');
  console.log('GRPC_CONFIG', JSON.stringify(res.grpcConfig || {}));
  const inst = res.emulatorInstance;
  if (!inst) throw new Error('no emulator instance');
  console.log('INSTANCE_SN', inst.sn);
  await inst.isConnected();
  const target = await inst.pushRpk(rpk, pkg);
  console.log('PUSHED', target);
  await inst.install(target, { packageName: pkg });
  console.log('INSTALLED');
  try {
    await inst.startApp(pkg);
    console.log('APP_STARTED');
  } catch (e) {
    // Vela 5.0 镜像的启动日志与 toolkit 期待的 'Start main loop' 不一致，
    // 会误报 timeout；应用实际已启动（见 AMS pushNewActivity 日志），继续截图即可。
    console.log('APP_START_WARN', String(e));
  }
  await new Promise((r) => setTimeout(r, 2500));
  await screenshot(res.grpcConfig || {}, inst.sn, '01');
  console.log('EMULATOR_READY');
  setInterval(() => {}, 1000);
})().catch((e) => {
  console.error('FAIL', e && (e.stack || e));
  process.exit(1);
});
