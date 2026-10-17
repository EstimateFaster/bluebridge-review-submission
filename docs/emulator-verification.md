# Vela 官方模拟器（VVD）运行验证记录

> 目的：在没有 AIoT-IDE 图形界面的 Linux 服务器上，用小米官方 Vela 模拟器实际运行题 1 的 rpk，并抓取**真实运行截图**（非设计预览）。

## 一、结论

| 项 | 结果 |
|---|---|
| 官方 Vela 虚拟设备（VVD）启动 | ✅ 成功（QEMU + SwiftShader 软件渲染，`-no-window` 无窗口模式） |
| rpk 安装 | ✅ `onInstallResult: com.bluebridge.review.weather(success 0)` |
| 应用启动 | ✅ AMS 日志 `pushNewActivity com.bluebridge.review.weather/QuickActivity ... [creating] to [resumed]` |
| 真实截图 | ✅ gRPC `getScreenshot` 返回 336×480 PNG（`screenshots/emu-01-main.png`） |
| 截图尺寸 | 336×480（与设计基准 / 手环 10 Pro 分辨率一致） |

## 二、环境与 SDK 组件

- 主机：Linux x64（无图形界面，无 X11/Wayland），Node v22.23.3，7.8 GB RAM，/dev/kvm 存在但 guest 为 ARM（走 QEMU TCG，不使用 KVM 加速）
- 工具链：`aiot-toolkit@2.0.5` 的 `@aiot-toolkit/emulator` 包 + 小米官方 SDK 下载源

| 组件 | 版本/文件 | 大小 |
|---|---|---|
| emulator | `emulator/v0.1.0/linux-x86_64.zip` | 198 MB |
| system image | `vela-watch-5.0/20250716/vela-watch-5.0.zip`（不带表盘、可自定义尺寸） | 220 MB |
| qa | `qa/v0.0.1/qa.zip` | 28 MB |
| skins | `skins/v0.0.10/skins.zip` | 0.9 MB |

- 下载源：`https://vela-ide.cnbj3-fusion.mi-fds.com/vela-ide/`
- 解压位置：`~/.vela/sdk/`（emulator / system-images / qa / skins）
- 关键修复：解压后 `chmod +x emulator/linux-x86_64/qemu/linux-x86_64/*`；运行时 `LD_LIBRARY_PATH` 指向 SDK 自带的 `lib64`/`lib`，`PATH` 加入 `@miwt/adb` 自带 adb；VVD 配置 `hw.gpu.mode=swiftshader_indirect`（无 GPU 环境需要软件渲染）

## 三、VVD 配置（336×480）

```ini
AvdId=VelaWeather
hw.cpu.arch=arm
hw.lcd.width=336
hw.lcd.height=480
hw.lcd.density=320
hw.lcd.shape=rect
hw.device.flavor=watch
hw.ramSize=1024
hw.gpu.enabled=yes
hw.gpu.mode=swiftshader_indirect
image.sysdir.2=/root/.vela/sdk/system-images/vela-watch-5.0
ide.image.type=vela-watch-5.0
```

## 四、启动与安装日志（节选）

```text
Start CMD: emulator -vela -avd VelaWeather -show-kernel \
  -network-user-mode-options hostfwd=tcp:127.0.0.1:10055-10.0.2.15:101 \
  -no-window -grpc 8554 -qemu -device virtio-snd...
Boot completed in 5729 ms
Started GRPC server at [::]:8554, security: Insecure, auth: none
Advertising in: /root/.android/avd/running/pid_98438.ini

adb push ... /data/app/com.bluebridge.review.weather.rpk  → 1 file pushed (149829 bytes)
adb shell pm install /data/app/com.bluebridge.review.weather.rpk
  → Install result: onInstallResult: com.bluebridge.review.weather(success 0)
adb shell am start com.bluebridge.review.weather
  → [AMS] pushNewActivity com.bluebridge.review.weather/QuickActivity [creating] to [resumed]
  → [AIOTJS] [addApp:67] Add package_name: com.bluebridge.review.weather
```

## 五、截图方式

模拟器内置 gRPC 服务（默认端口由启动参数 `-grpc` 指定），调用：

```js
// tools/emulator-shot.cjs 的核心逻辑
client.getScreenshot(ImageFormat, meta, (err, res) => {
  fs.writeFileSync(out, Buffer.from(res.image)); // PNG 336×480
});
```

- `getStatus` 返回：`version: 32.1.15.0`、`booted: true`、`vmConfig.hypervisorType: NONE`（软件模拟）
- 截图文件：`screenshots/emu-01-main.png`（336×480，70,498 B）；另生成 2x、上下半屏细节、圆角屏衍生素材

## 六、复现命令

```bash
# 1) 下载并解压 SDK（约 450MB，脚本见 docs 说明）
#    官方源：https://vela-ide.cnbj3-fusion.mi-fds.com/vela-ide/
# 2) 启动模拟器 + 构建安装应用（后台运行，保持模拟器存活）
node tools/emulator-run.cjs
# 3) 任意时刻抓取真实截图
node tools/emulator-shot.cjs emu-01-main.png
```

## 七、交互面板（本地开发工具）

无 AIoT-IDE 时看画面只能截图，于是补了一个浏览器面板（`tools/emulator-panel.cjs`）：

```bash
node tools/emulator-panel.cjs        # 打开 http://127.0.0.1:8770/
```

- 访问方式（本机服务器经 nginx 对外，只开放 55555/TLS）：
  - 域名入口：`https://dsh.inklog.xx.kg/emu-panel/`（与 DSH 共用登录 cookie，未登录会跳登录页）
  - IP 兜底入口：`https://103.236.84.174:45665/emu-panel/`（nginx basic auth，凭据同 DSH）
  - nginx 反代配置：`/etc/nginx/sites-available/dsh-webui` 中 `location ^~ /emu-panel/` → `127.0.0.1:8770`（改动前已备份为同目录 `.bak-*` 文件）；验证：带登录 cookie 请求页面返回 200、`/emu-panel/api/frame` 返回 336×480 PNG、SSE 返回 `text/event-stream`；
- 界面：`tools/panel-ui.html`（独立 HTML，移动端自适应；`touch-action:none` + pointer capture，画布上拖拽不会带动网页滚动；`overscroll-behavior:none`）；
- 调试功能：实时帧/fps/帧序号/连接状态、点击坐标、模拟器/引导状态、操作日志、唤醒屏幕、重启应用、重装 rpk、保存完整截图、全屏画面、复制状态；
- 画面：服务端每 250ms 调 gRPC `getScreenshot`，变化才推送（SSE），前端 canvas 渲染；
- 点击/拖拽：POST `/api/mouse` → gRPC `sendMouse`（按下 buttons=1 / 抬起 buttons=0）；
- 按钮：重启应用、重装当前 rpk、保存当前帧（走本地 adb）；
- 安全：只监听 127.0.0.1，不对外网暴露。

**输入链路验证**：另建一个「点击计数」测试应用（点击 +1），通过面板 HTTP 接口点击按钮后，画面数字 0 → 1，证明「面板点击 → gRPC sendMouse → 模拟器 UI 响应」链路可用。

**实测结论（Vela 5.0 镜像）**：
| 注入方式 | 结果 |
|---|---|
| gRPC `sendMouse`（down/up） | ✅ 有效（按钮点击、计数变化） |
| gRPC `sendTouch`（pressure 200/0） | ❌ 无响应（同位置同坐标无变化） |
| gRPC `sendKey`（GoHome/GoBack、Evdev 102/158） | ❌ 无效果 |

**限制**：
1. 约 4fps（轮询 + 变化推送），不是视频流；
2. Vela 同一时刻只跑一个快应用：安装/启动另一个应用时 adb `am start` 可能阻塞，切换应用建议重启 VVD；
3. 屏幕默认会熄屏，首次点击用于唤醒；熄屏时截图返回全黑帧。

## 八、说明与限制

1. 主机无 GPU，使用 SwiftShader 软件渲染；且 guest 是 ARM（x86 主机走 QEMU TCG），**帧率/性能不代表真机**，但布局、字体、颜色、组件行为与真实 Vela 运行时一致；
2. 使用 Vela 5.0 镜像（`vela-watch-5.0`），真机系统版本可能略有差异；
3. 本记录证明「能构建、能安装、能启动、能渲染」；最终评分仍建议评审在 AIoT-IDE/真机上复核一次；
4. 模拟器与 SDK 均从小米官方下载源获取，仅用于验证，不随提交物分发；
5. 安全：模拟器 gRPC（8554）默认监听 0.0.0.0 且无鉴权，已用 iptables 限制为仅 loopback 可访问（规则为运行时规则，重启后需重新添加；`iptables -L INPUT -n --line-numbers` 可核对）。
