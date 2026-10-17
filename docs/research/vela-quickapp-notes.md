# 小米 Vela JS 应用（手表/手环端）开发要点

> 标注约定：**[官]** = 官方文档明确；**[例]** = 官方示例/示例代码中出现但正文未强调；**[推]** = 依据硬件规格或跨页推断，非文档明写；**[社]** = 社区经验。

## 1. 文档入口与版本对应
- 总入口（VuePress，`iot.mi.com` 直连可访问）：[概述](https://iot.mi.com/vela/quickapp/zh/guide/)
- [框架简介](https://iot.mi.com/vela/quickapp/zh/guide/framework/)｜[项目结构](https://iot.mi.com/vela/quickapp/zh/guide/framework/project-structure.html)｜[项目配置 manifest](https://iot.mi.com/vela/quickapp/zh/guide/framework/manifest.html)｜[UX 文件](https://iot.mi.com/vela/quickapp/zh/guide/framework/ux.html)
- [生命周期](https://iot.mi.com/vela/quickapp/zh/guide/framework/script/lifecycle.html)｜[页面切换](https://iot.mi.com/vela/quickapp/zh/guide/framework/page-switch.html)｜[页面样式与布局](https://iot.mi.com/vela/quickapp/zh/guide/framework/style/page-style-and-layout.html)｜[媒体查询](https://iot.mi.com/vela/quickapp/zh/guide/framework/style/media-query.html)
- [通用样式](https://iot.mi.com/vela/quickapp/zh/components/general/style.html)｜[动画样式](https://iot.mi.com/vela/quickapp/zh/components/general/animation-style.html)｜[颜色](https://iot.mi.com/vela/quickapp/zh/components/general/color.html)｜[通用属性](https://iot.mi.com/vela/quickapp/zh/components/general/properties.html)｜[通用事件](https://iot.mi.com/vela/quickapp/zh/components/general/events.html)
- 设备规格表（多屏设计，**最重要的适配依据**）：[多屏设计](https://iot.mi.com/vela/quickapp/zh/guide/design/multi-screens.html)｜[适配规范](https://iot.mi.com/vela/quickapp/zh/guide/multi-screens/specs.html)｜[适配代码示例](https://iot.mi.com/vela/quickapp/zh/guide/multi-screens/samples.html)
- 工具链：[AIoT-IDE 使用](https://iot.mi.com/vela/quickapp/zh/guide/start/use-ide.html)｜[项目概览](https://iot.mi.com/vela/quickapp/zh/guide/start/project-overview.html)｜[AIoT-toolkit](https://iot.mi.com/vela/quickapp/zh/tools/toolkit/start.html)｜[1.0→2.0 迁移](https://iot.mi.com/vela/quickapp/zh/tools/toolkit/update.html)｜[发布](https://iot.mi.com/vela/quickapp/zh/tools/release/release.html)｜[真机调试](https://iot.mi.com/vela/quickapp/zh/tools/devicedebug/start.html)
- 排错：[常见问题 FAQ](https://iot.mi.com/vela/quickapp/zh/guide/other/faq.html)｜[注意事项](https://iot.mi.com/vela/quickapp/zh/guide/other/tips.html)
- 版本差异（API Level 变更日志）：[APILevel2](https://iot.mi.com/vela/quickapp/zh/guide/version/APILevel2.html)｜[APILevel3](https://iot.mi.com/vela/quickapp/zh/guide/version/APILevel3.html)｜[APILevel4](https://iot.mi.com/vela/quickapp/zh/guide/version/APILevel4.html)

**API Level 对应关系** [官]：L1 = 基线；L2 新增媒体查询(shape)、barcode/qrcode/image-animator/scroll 组件、device.getInfo 增加 deviceType/APILevel；L3 新增 box-shadow、`$canIUse`、scroll 边缘吸附、uploadtask、screenDensity 与 pill-shaped 屏、**dp 单位**、媒体查询逻辑运算；L4 新增 `@system.event`。运行时查询：`device.getInfo().APILevel` / `this.$canIUse(...)`。

## 2. 工程结构
```
src/            # 固定名，不可改
├── manifest.json   # 应用描述 + features 声明 + 路由
├── app.ux          # 应用入口（生命周期/全局数据/全局方法）
├── pages/<page>/<page>.ux
├── common/         # 组件、图片、脚本
└── i18n/
build/            # 编译中间产物（js）
dist/             # 最终产物 *.debug.rpk / *.release.rpk
sign/             # private.pem + certificate.pem
package.json      # scripts: build/release/start
```
[官] `src/` 为固定目录名；`build/`、`dist/` 由工具生成，勿手改。

### 2.1 manifest.json 实用字段（全部来自官方字段表）
| 字段 | 必填 | 说明 |
|---|---|---|
| `package` | 是 | 包名，`com.company.module` 格式，**不得与原生应用包名相同** |
| `name` | 是 | 应用名，**6 个汉字以内**，桌面/弹窗展示 |
| `icon` | 是 | 图标，**192x192** 即可 |
| `versionName` | 否 | 如 "1.0" |
| `versionCode` | 是 | 整数，从 1 自增，每次上传 +1 |
| `minAPILevel` | 否 | 最小 API 标准版本，**默认 1**；用了新版本特性必须抬到对应值，否则会跑在低版本平台上报错 |
| `minPlatformVersion` | — | **[例]** 官方示例代码里仍出现（如 1000），但字段表已不列，属旧字段，新项目可不写 |
| `deviceTypeList` | 否 | 可选 watch/tv/car/phone，**现在只支持 watch**，默认 watch |
| `features` | 否 | 接口声明数组，`[{"name":"system.storage"}]`；**绝大多数接口不声明就调不通** |
| `permissions` | 否 | 如 `[{"name":"hapjs.permission.DEVICE_INFO"}]` |
| `config` | **是** | `{ logLevel, designWidth, background }`；`designWidth` = 设计基准宽度，**不填默认 480**；logLevel: off/error/warn/info/log/debug |
| `router` | **是** | `{ entry, pages }`；无路由配置的页面打包时被跳过 |
| `display` | 否 | `{ backgroundColor }`，默认 `#ffffff`，作用于全部页面 |

- `router.entry`：首页页面名（分包时建议放基础包）。
- `router.pages.<Name>`：`component`（与 ux 文件名一致，必填）、`path`（默认 `/<Name>`，**必须唯一**）、`launchMode`（`standard` 默认 / `singleTask`；singleTask 重开会回调 `onRefresh` 并清掉其上页面）。
- 最小可用骨架 [官]：
```json
{ "package": "com.demo.app", "name": "示例", "icon": "/common/icon.png", "versionCode": 1,
  "minAPILevel": 3, "deviceTypeList": ["watch"],
  "features": [{ "name": "system.storage" }, { "name": "system.vibrator" }],
  "config": { "designWidth": 336 },
  "router": { "entry": "Index", "pages": { "Index": { "component": "index", "path": "/" } } } }
```

### 2.2 app.ux 与页面 .ux
- `app.ux`：应用级生命周期 `onCreate/onShow/onHide/onDestroy/onError`，`export default` 里的方法与数据通过 `this.$app.$def.xxx` / `this.$app.$data.xxx` 给所有页面用 [官]。
- **`app.ux` 编译后会内联 manifest，`/**manifest**/` 注释块绝对不能删** [官]；`app.ux` 中代码必须写在 `<script>` 内，否则不执行 [官-tips]。
- 页面 `.ux` = `<template>` + `<style>` + `<script>` 三段 [官]；**template 只能有一个根节点**；拆成 `detail.ux + detail.css + detail.js` 时，ux 里就不能再有 `<template>` 标签。
- script 的 ViewModel 数据分区：`private`（**不可被传参覆盖**）、`protected`（可被应用内路由参数覆盖）、`public`（可被应用外拉起参数覆盖）、`data`（响应式，等价 public 语义常见写法）。实测模板最常用 `data`/`private`。

## 3. 生命周期与路由
**页面** [官]：`onInit`（数据就绪，最早）→ `onReady`（模板编译完成，可 `this.$element(id)` 取节点）→ `onShow` / `onHide`（切页、息屏亮屏）→ `onDestroy`；另有 `onBackPress`（返回 true 表示自己接管返回）、`onRefresh(query)`（singleTask 重开）、`onConfigurationChanged(e)`（`e.type === "locale"`）。销毁后异步回调不再执行，`this.$valid` 可判存活。

**APP**：`onCreate` / `onShow` / `onHide` / `onDestroy` / `onError(e)` [官]。

**router（`import router from "@system.router"`，无需声明 feature）** [官]：
- `router.push({ uri, params })`：uri 支持 `/about`（path）、`About`（页面名）、`"/"`（path 为 / 的页，否则首页）；`params` 里加 `___PARAM_LAUNCH_FLAG___: "clearTask"` 可清空下方页面栈。
- `router.replace({ uri, params })`：替换当前页并销毁它。
- `router.back({ path })`：不传参回上一页；传 `/about` 回该页（未打开则回上一页）。
- `router.clear()`、`router.getLength()`、`router.getState()`（`{index,name,path}`）、`router.getPages()`。
- **参数是「字段级」注入而非整包对象**：目标页必须在 `protected`（应用内）或 `public`（应用外）中声明同名属性才能拿到；**所有 params 值会被统一转成 String**——布尔/数字要自己转回。

## 4. 样式体系
- **盒模型固定 border-box**，不支持 content-box，`box-sizing` 不可设 [官]。
- **长度单位：px / % / dp(3+)**，**没有 rpx** [官]。px 是「相对 designWidth 的逻辑像素」，公式：设计稿1px / 设计稿基准宽度 = 框架1px / designWidth。例：designWidth=336、设备实际宽 336 → `width:168px` 显示 168 物理像素；设备宽 192 时同一份代码显示 96 物理像素（自动等比）。换算有 **±1px 四舍五入误差**，等分一行时按 1/3 计算容易错行 [官-samples]。
- `dp` = 物理分辨率 / DPR，用于做「跨设备物理尺寸一致」的布局；DPR 可用 `device.getInfo().screenDensity` 取。
- **Flex 布局，默认 `flex-direction: row`（横向！）**，所以竖排页面必须显式 `flex-direction: column` [官]。默认 `align-items: flex-start`、`justify-content: flex-start`、`display: flex` (或 none)、`flex-shrink: 1`、`flex-grow: 0`。flex 系列仅在父容器是 `div`/`list-item` 时生效。
- `position` 只支持 `relative`（默认）/`absolute`；**父容器为 `list`/`swiper` 时 position 不生效**；`left/top/right/bottom` **不支持百分比** [官]。
- **没有 `overflow`**：官方通用样式表不含 overflow/scroll 属性，长内容必须用 `<scroll>`（2+）或 `<list>`，且竖向滚动要设**定高**、横向滚要设**定宽** [官]（「overflow 不存在」为按官方样式表推断 [推]，但官网 FAQ 与 scroll 文档一致要求用滚动容器）。
- `border-radius`：**幅度不会超过矩形短边的一半**；官方提示「设置时需同时设置 border-width、border-color」；无 `overflow: hidden`，所以**子元素不会被圆角裁剪**，图片圆角要靠 `image` 自身圆角或 `object-fit` + 圆角容器 [官+推]。
- `box-shadow` 仅 **APILevel3+**：`x y [blur] [spread] color`（2/3/4 长度 + 颜色）[官]。
- **动画**：`transform` 支持 `translate/translateX/translateY/scale/scaleX/scaleY/rotate`（含 %、deg）；`transform-origin` 必须先有 transform 才生效；`animation-*` + `@keyframes`（keyframes 里只支持 background-color / background-position / opacity / width / height（**不支持百分比**）/ transform；**0% 与 100% 必须显式写出**）；`transition` 的 `transition-property` **只支持 width/height/opacity/visibility/border-width/border-color/background-color/background-position**——**`transform`、`border-radius`、`margin/padding`、`left/top` 都不支持 transition**，位移动画请用 `animation` 或改 class 触发布局 [官]。
- 选择器：内联、tag、`.class`、`#id`、并列选择器；**不支持后代选择器**（2.0 起不支持的选择器会直接报错）[官]。
- 颜色：`#rgb/#rrggbb/#rgba/#rrggbbaa`、`rgb()/rgba()`、`transparent`、CSS 颜色名 [官]。
- 字号：`text` 默认 `font-size: 30px`、默认色 `rgba(0,0,0,0.54)`；`font-weight` **只支持 normal/bold**（数字 <550 → normal）；`lines` 默认 -1，省略号必须 `lines: n` + `text-overflow: ellipsis` [官]。
- **不支持自定义字体**：官方 text 样式表无 `font-family`，全站无 `@font-face` 说明 [推，高置信]。
- 预编译：`<style lang="less">`（`npm i less less-loader`）、`lang="scss"`（`node-sass sass-loader`）、postcss+precss [官]。

## 5. 内置组件清单（官方 components 目录全覆盖）
- 容器：`div`（唯一能放任意子节点的根容器）、`list`（**仅 list-item 子节点，必须定高**）、`list-item`、`scroll`(2+)、`stack`、`swiper`（index/autoplay/interval/indicator/loop/vertical/previousmargin/nextmargin/enableswipe）
- 基础：`text`（仅支持 `span` 子节点）、`span`、`a`、`image`（`src` 支持本地+网络，`object-fit` 默认 cover，事件 complete/error）、`image-animator`(2+)、`progress`（`type: horizontal|arc`，arc 有 start-angle/total-angle/center-x/center-y/radius，**圆屏仪表盘首选**）、`marquee`、`chart`、`qrcode`(2+)、`barcode`(2+)
- 表单：`input`、`picker`、`switch`、`slider`
- **没有 `canvas`**：`/components/basic/canvas.html` 会回落到概述页（站点无此文档），官方组件目录也无 canvas 条目 [官-站点行为]。手环端不要指望 canvas 绘图，改用 div/进度条/图表组件。
- 手表端可用性：官方组件页**不按机型标注支持表**（只有 features 接口页有），可判定为「框架内组件全设备可用」；真正受限的是 features 接口 [推+官]。

## 6. features 与 API（含官方设备支持表）
声明格式：`"features": [{ "name": "system.vibrator" }]`；router / configuration / app 无需声明 [官]。
**官方明确标注设备支持的接口（小米手环 10 列）：**

| 接口 | 小米手环 10 | 备注 |
|---|---|---|
| `system.vibrator`.vibrate | ✅ 支持 | 但 `start/stop/getSystemDefaultMode` **仅 Xiaomi Watch S5** |
| `system.fetch` / `system.network` | ❌ **不支持** | 手环 8 Pro / 9 / 9 Pro / Redmi Watch 4 同样不支持；手表 S3/S4/S5、REDMI Watch 5/6 支持 |
| `system.event`(4+) | ✅ 支持 | 手环 8 Pro/9/9 Pro/S3 不支持 |
| `system.battery` | ✅ 支持 | 手环 8 Pro/9/9 Pro 不支持 |
| `system.sensor` | 部分：`subscribePressure` ✅、`subscribeAccelerometer` ✅ | `subscribeHeartRate` 等见原页 |
**无支持表 = 默认全设备可用** [推]：`system.storage`（get/set/delete/clear，value 为空串即删除）、`system.prompt`（showToast，默认 1500ms）、`system.device`（getInfo/getDeviceId/getSerial/getTotalStorage/getAvailableStorage）、`system.router`、`system.configuration`、`system.file`、`system.brightness`、`system.audio`、`system.crypto`、`system.zip`、`system.geolocation`。

- `device.getInfo()` 返回：brand/manufacturer/model/product/osType/osVersionName/osVersionCode/platformVersionName/platformVersionCode/language/region/**APILevel**(2+)、screenWidth/screenHeight/**screenDensity**(3+)、**screenShape**（`rect` / `circle` / `pill-shaped`(3+)）、**deviceType**(2+：watch/band/smartspeaker)。→ 做多屏适配就靠 `screenShape + screenWidth/Height + APILevel`。
- `device.getDeviceId/getSerial` 需 `permissions: [{"name":"hapjs.permission.DEVICE_INFO"}]`；`geolocation` 需 `hapjs.permission.LOCATION`。拒绝 400 / 未声明 402。
- 震动典型用法：`vibrator.vibrate({ mode: "short" })`（长/短两档，手环够用）。

## 7. 工具链
- **AIoT-IDE**：VS Code 二次开发，支持 macOS **14+** / Windows **10+** / Ubuntu **20.04+**；新建项目 → 选 watch 模板 → 右侧开发向导装依赖 → 选模拟器点「调试」→ 点「打包」/「发布」。加密钥需本机装 **openssl**（Windows 常见缺失）。npm 装依赖失败时在项目根建 `.npmrc` 写 `registry="https://registry.npmmirror.com/"` [官]。
- **CLI（aiot-toolkit 2.0）**：`npm create aiot` 建项目；`aiot start`（首次会引导建模拟器）、`aiot build`、`aiot release`、`aiot getConnectedDevices`、`aiot getPlatforms`、`aiot crateVelaAvd`、`aiot deleteVelafangAvd`（官方原文拼写如此）。npm 上最新 `aiot-toolkit@2.0.5`，bin 名 `aiot`，**无 engines 限制**；AIoT-IDE 1.6.0 推荐 2.0（1.0 最低 1.0.18）[官+npmmirror]。
- 真实项目 `package.json` 形态 [社区-实仓库]：`{"scripts":{"build":"aiot build","release":"aiot release"},"devDependencies":{"aiot-toolkit":"^2.0.5"}}`——即 `npm run build` == `aiot build`。
- **产物**：开发包 `dist/<package>.debug.rpk`（另生成 `build/` 内 js）；发布包 `dist/*.release.rpk`，release 会删调试信息/注释/死代码。
- **签名**：`sign/private.pem` + `sign/certificate.pem`；手写命令 `openssl req -newkey rsa:2048 -nodes -keyout private.pem -x509 -days 3650 -out certificate.pem`；**证书必须每次一致，否则可能无法上架**；若与手机 App 走 interconnect，**rpk 证书必须与手机 App 证书一致**，否则通信被拒 [官]。
- **真机安装（无 IDE 时）**：小米运动健康 App → 我的 → 关于 → **Debug** → 第三方应用 → Install third app → 选 rpk（需商务/白名单开通）；日志靠 Debug → **拉取固件日志**，落盘 `/sdcard/Android/data/com.mi.health/files/log` [官-FAQ]。
- **真机调试**：官方目前仅开放 Xiaomi Watch S4（需 OTA 到指定版本 + 测试版小米运动健康 + 同一局域网），手环不在支持列表 [官]。

## 8. 高频坑（含官方明文）
1. **图片路径**：资源型引用用相对路径 `./abc.png`；CSS 里 `background-image: url(/Common/abc.png)`；**代码文件跨目录被 import 时，被导入文件内的资源必须写绝对路径 `/Common/...`**（编译时会复制到导入方目录，相对路径失效）[官]。2.0 起**动态拼接路径不合法**，必须写完整绝对路径 `/common/xxx.png` [官-迁移]。
2. **`<image src>` 不要用字符串拼接**（`src="/common/{{type}}"`）：会触发编译告警，用 `src="{{imgPath}}"` [官-tips]。
3. **flex 默认横向**：不写 `flex-direction: column` 页面会横排、挤压变形，这是最高频踩坑点 [官]。
4. **圆角不裁剪**：无 `overflow:hidden`，圆角容器里的图片/背景会溢出直角边界；给图片自身加 `border-radius` 或换成圆角 `image` [推，依据官方样式表无 overflow]。
5. **动画性能**：`transition` 不支持 transform，硬做位移会跳变；`@keyframes` 里 width/height **不支持百分比**，且 0%/100% 必须写全；大量动画叠加易掉帧，官方称可达 60fps 但建议只动 transform/opacity [官+推]。
6. **`<text>` 换行**：写在标签内容里即按容器宽度自动换行；`lines` 限制行数后配合 `text-overflow: ellipsis` 出省略号；`
` 需按转义字符处理（官方说明支持转义字符）；text 里**只能嵌套 `span`**，塞 div 无效 [官]。
7. **设备限制**：手环**没有网络**（fetch/network 官方明确不支持手环 10/9/9 Pro/8 Pro），需要数据只能预置 + `storage`，或走蓝牙/手机侧桥接（[社] 常见做法：手机 App+蓝牙同步，如 BandQQ 项目）；`vibrator.start` 只在 S5 有。
8. **构建失败常见原因**：`@system.xxx` 未在 `features` 声明；用了不支持的选择器（后代/伪类，2.0 直接报错）；`minAPILevel` 低于所用特性版本；`designWidth` 与实际设计稿不一致导致布局整体偏移；`app.ux` 的 `/**manifest**/` 注释被删；未装 openssl 导致 release 签名失败；npm 源不通导致 `npm i` 卡住（换 npmmirror）[官+社]。
9. **1.0 → 2.0 迁移**（老项目照抄必炸）：`{{}}` 内不再嵌套 `{{}}`（`onclick="fun(x, y)"`）；动态 `transform`/`filter`/`background`（渐变）必须 `JSON.stringify({...})`；动态 URL 改 `backgroundImage: "/common/logo.png"`；样式顺序随意化但非法值会报错 [官-迁移]。
10. **`onShow` 里发请求要小心**：**息屏后亮屏会重新触发 `onShow`**，若其中 fetch 会重复请求 [官-tips]。
11. **`list-item` 内慎用 `if`/`show`**：官方要求所有 list-item 结构保持一致，否则复用错乱；for 循环加 `tid`（唯一不重复字段，不支持表达式）可显著减少闪烁 [官]。
12. **角度值必须带单位**：`total-angle: 360deg`，写 `360` 无效 [官-tips]。

## 9. 小米手环 10 Pro 具体落点
- 官方设备规格表当前只到 **小米手环 10：胶囊形 1.725" 212x520 PPI326 DPR2.0**，**未列 10 Pro** [官-表]。
- 手环 10 Pro 硬件为 **1.74" AMOLED、480x336（即 336x480）、矩形四等边**，与手环 9 Pro 同规格面板 [社/媒体，小米官网参数] → **开发按 `designWidth: 336`、矩形屏（`shape: rect`）适配** [推，高置信]；与 9 Pro 共用一套 UI 即可，胶囊屏方案（designWidth 192/212）不要复用。
- 适配策略：`designWidth` 取主目标机型（10 Pro → 336），再用 `@media screen and (shape: circle|pill-shaped|rect)` 覆写边距/字号；圆屏与胶囊屏必须留安全区（官方明确弧形边缘会裁切内容，灰色安全区图见多屏设计页）。

## 10. 官方示例索引
- [samples](https://iot.mi.com/vela/quickapp/zh/samples/)｜[页面 UI](https://iot.mi.com/vela/quickapp/zh/guide/start/user-interface.html)｜[交互](https://iot.mi.com/vela/quickapp/zh/guide/start/add-interactivity.html)｜[数据请求](https://iot.mi.com/vela/quickapp/zh/guide/start/data-fetch.html)
- 离线全文镜像（148 篇 JS + 71 篇 Lua，含社区避坑手册）：[xiaomi-vela-docs](https://github.com/hefeishui0829/xiaomi-vela-docs)（**[社]**，非官方，抓取时间见其 SOURCES.md）
- 真实可跑开源工程参考（结构/脚本/签名组织方式）：[BandQQ（手环 Vela 快应用 + 安卓同步器）](https://github.com/Gsjsjzhznsz/BandQQ)｜[QRWallet](https://github.com/mastermaiolo/QRWallet)（**[社]**）