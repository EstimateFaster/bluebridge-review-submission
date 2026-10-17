# 题 1 题面符合性核对（逐条）

> 依据：`tracks/vela/task-1-weather/README.md`（题面）与根仓库 `tracks/README.md`（通用规则）。
> 结论：**硬性要求 5/5 满足，9 项信息 9/9 可见，交付物 4/4 完成**；官方 Vela 模拟器（VVD）已实测通过：构建 → 安装 → 启动 → 真实截图，证据见 `docs/emulator-verification.md`。

## 一、硬性要求

| # | 题面要求 | 状态 | 证据 |
|---|---|---|---|
| 1 | 必须是 Vela 快应用（rpk），能构建、能运行 | ✅ | `npm run build` 通过（aiot-toolkit 2.0.5 / Node 22.23.3），产物 `vela-weather-336x480.debug.rpk`（149,829 B）；官方 Vela 模拟器实测：`Boot completed in 5729 ms`、`pm install → (success 0)`、`am start → pushNewActivity [resumed]`，真实截图 336×480 |
| 2 | **必须单页 `.ux` 文件**，不做多页路由跳转 | ✅ | `src/pages/` 下只有 `index/index.ux`；`manifest.json` 的 `router.pages` 仅注册 `pages/index`；源码中无 `router.push/replace/back`、无 `navigate` |
| 3 | 适配 336×480（`designWidth: 336`）竖屏 | ✅ | `config.designWidth = 336`；`.page { width:336px; height:480px }`；内容实测底边 ≈471 ≤ 480，无溢出、无垂直滚动（指标/小时为横向 `scroll-x`） |
| 4 | 数据全部本地模拟，不发起网络请求 | ✅ | `features` 未声明 `system.fetch` / `system.network`；`src/` 中无 `fetch`、无 http(s) 地址、无 `@system` 网络调用；天气数据全部写在 `script.data` 常量 |
| 5 | 建议引入资产提升视觉质量 | ✅ | 21 个自绘 PNG：336×480 夜空背景、5 种天气图标（128/48 两档）、7 个指标/太阳图标、192×192 应用图标；资产由 `assets/gen_assets.py` 生成，无第三方素材 |

## 二、9 项必含信息

| 要求 | 实现位置 | 模拟值 | 可见性 |
|---|---|---|---|
| 地区 | 顶栏左侧 + 定位图标 | 北京 · 朝阳 | ✅ |
| 温度 | 主视觉 | 23°（体感 22°） | ✅ |
| 湿度 | 指标卡 1 | 62% | ✅ |
| 未来 5 小时预报 | 中段面板，5 列 | 现在 23° / 15时 22° / 16时 21° / 17时 20° / 18时 19°，含图标 | ✅ |
| 未来 7 天预报 | 下段面板，7 列 | 今天 26/17 · 周五 25/16 · 周六 24/15 · 周日 26/17 · 周一 27/18 · 周二 25/16 · 周三 24/15 | ✅ |
| 空气状况 | 指标卡 2 | 42 良（绿色） | ✅ |
| 紫外线 | 指标卡 3 | 3 中等（黄色） | ✅ |
| 风向 | 顶栏右侧 | 东南风 2 级 | ✅ |
| 日出日落 | 底部行 | 日出 06:28 / 日落 17:26 | ✅ |

数据自洽性：当前 23° 介于今日高低温 26°/17° 之间；未来 5 小时随傍晚降温（23→19）且转小雨，与 7 天中「周六有雨」和面板提示一致。

## 三、交付物

| # | 要求 | 状态 | 路径 |
|---|---|---|---|
| 1 | 源码目录（含 `manifest.json`、页面、资产） | ✅ | `src/` |
| 2 | 构建出的 `.rpk` | ✅ | `vela-weather-336x480.debug.rpk`（包名 `com.bluebridge.review.weather`，v1.0.0） |
| 3 | 3–5 张运行截图（模拟器或真机） | ✅ | `screenshots/emu-01-main.png`（模拟器原始帧 336×480）+ 2x / 上半屏 / 下半屏 / 圆角屏 共 5 张，均由官方 Vela 模拟器 gRPC 抓帧 |
| 4 | README：构建/运行方法、设计说明、AI 使用说明、≥3 条迭代日志 | ✅ | `README.md`（迭代日志 5 条，v0–v4） |
| 5 | 可选：30 秒演示视频 | — | 未做（可选项） |

## 四、评分维度自评（按题面权重）

| 维度 | 权重 | 自评 | 依据 |
|---|---|---|---|
| 信息完整性 | 10% | 强 | 9 项齐全且数据自洽；另含体感、天气趋势、带伞提示 |
| 视觉设计 | 25% | 中上 | 夜空渐变背景 + 暖色强调 + 自绘天气图标；面板层级清晰，但资产为程序化自绘、非手绘插画 |
| 信息层级 | 25% | 强 | 温度 80px 绝对主视觉 → 状态/指标 → 5 小时 → 7 天 → 日出日落；7 天横排列是密度关键取舍 |
| 小屏适配 | 20% | 强 | 336×480 预算表逐项排满（≈471/480），显式 line-height，无垂直溢出；16px 安全边距避开圆角；横滑组件不改变一屏信息完整性 |
| 细节与资产 | 10% | 中上 | 单位着色、面板分组、图标风格统一；无动效（单页静态展示，题面未强制） |
| 说明与答辩 | 10% | 强 | README 含设计取舍、现场改动预案、AI 使用与踩坑记录、调研来源 |

## 五、模拟器验证记录

| 项 | 结果 |
|---|---|
| 模拟器 | 官方 Vela VVD（emulator 32.1.15.0，`vela-watch-5.0` 镜像，QEMU + SwiftShader，`-no-window`） |
| 设备参数 | 336×480 / density 320 / shape=rect / flavor=watch |
| 启动 | `Boot completed in 5729 ms`；gRPC 8554；adb `emulator-5554 device` |
| 安装 | `onInstallResult: com.bluebridge.review.weather(success 0)` |
| 启动应用 | `[AMS] pushNewActivity com.bluebridge.review.weather/QuickActivity [creating] to [resumed]` |
| 截图 | gRPC `getScreenshot` → `screenshots/emu-01-main.png`（336×480，70,498 B） |

详细日志、VVD 配置、复现命令见 `docs/emulator-verification.md`。

## 六、已知差异/风险

1. 设计预览 ≠ Vela 运行时渲染：真实截图已核对，整体一致，个别文字基线/图标缩放有 1–2px 差异；
2. 圆角安全区按社区实测 48px 处理，若真机圆角更大需复核顶栏左侧内容；
3. `minAPILevel: 2` 下不使用 `box-shadow`/`dp`，若评审环境 API Level 更高也不受影响（向下兼容）。

## 七、顶栏交互（‹ 退出 / ⋯ 开发者信息）复验

| 操作 | 坐标（336×480） | 结果 |
|---|---|---|
| 点左上角 `‹` | (22, 29) | 快应用退出，屏幕回到桌面/灭屏（截图 1,650 B 的近黑帧），退出链路生效 |
| 点右上角 `⋯` | (313, 29) | 页内「开发者信息」覆盖层打开：包名 / 版本 1.0.0 (1) / 设备 Emulator-Vela / 系统版本 1.2.0 / 屏幕 336×480 / 框架 Vela 快应用 |
| 点覆盖层 `×` | (290, 155) | 覆盖层关闭，主屏完全还原（截图与关闭前逐字节一致） |

实现方式：`@system.app` + `@system.device`，均为 Vela 官方系统接口；无网络、无第三方依赖；`app.terminate()` 失败时回退 `router.back()` + toast。截图：`screenshots/emu-task1-main.png`、`emu-task1-dev.png`、`emu-task1-exit.png`。

## 八、终版横滑 / 右滑 / 顶栏复验（2026-10-17 11:48）

rpk：`vela-weather-336x480.debug.rpk`，152,782 B，md5 `f3069a6a057ff8003de4e5e5e6b4de11`。

| 操作 | 注入方式 | 结果 |
|---|---|---|
| 指标行左滑 | 鼠标按下→分步移动→抬起 (250,196)→(70,196) | 第 4 张「风向 东南 2级」滑出并完整显示 |
| 5 小时行左滑 | 同法 (250,290)→(70,290) | 显示 17–21 时（共 8 项） |
| 右滑（左→右拖） | (60,300)→(320,300) | 应用保持在前台，**不退出**（横滑容器消费手势 + `onBackPress` 返回 true） |
| 左上 `‹` | 点击 (32,24) | 退出快应用（帧 1,650 B 近黑） |
| 右上 `⋯` | 点击 (304,24) | 开发者信息覆盖层（包名/版本/设备 Emulator-Vela/系统版本 1.2.0/336×480），点遮罩关闭 |

截图：`screenshots/emu-task1-hours-scroll.png`、`emu-task1-metrics-scroll.png`、`emu-task1-rightswipe.png`、`emu-task1-dev.png`、`emu-task1-exit.png`。
