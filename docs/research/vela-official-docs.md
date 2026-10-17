# Vela 快应用 · 专业开发文档索引（2026-10-17 调研）

> 目标：给“手环 / 手表 Vela JS 快应用”开发提供权威入口 + 已核实要点，避免到处翻二手教程。
> 本文件由全网检索 + 官方离线文档副本交叉核对整理；官方原文为准。

## 一、权威入口（按可信度排序）

| 来源 | 链接 | 说明 |
|---|---|---|
| **官方在线文档（主）** | <https://iot.mi.com/vela/quickapp/zh/> | 小米 Vela JS 应用官方文档：指南 / 组件 / JS 接口 / 工具 |
| 官方英文版 | <https://iot.mi.com/vela/quickapp/en/guide> | 同上英文 |
| 官方 AIoT-IDE 指南 | <https://iot.mi.com/vela/quickapp/zh/guide/start/use-ide.html> | 创建工程、模拟器/真机调试、打包 |
| 官方“AI 自动化生成”教程 | <https://iot.mi.com/vela/quickapp/zh/tools/dev/official-site-tutorial.html> | 官方对 AI 生成快应用的说明 |
| 小米澎湃 OS 开发者平台 · 快应用 | <https://dev.mi.com/xiaomihyperos/quickapp-develop> | 上架/发布相关入口 |
| 官方文档**完整离线副本**（社区整理，245 篇） | <https://github.com/hefeishui0829/xiaomi-vela-docs> | 官方 JS 148 篇 + Lua 71 + Shell 9 + 社区 17 篇，原样未改；无网/检索用 |
| 米坛社区 · Vela 快应用开发技能 | <https://www.bandbbs.cn/resources/6173> | 社区整理的开发技能/避坑，适合补充官方未覆盖的手环实践 |
| 手环快应用实战笔记 | <https://www.luming.cool/posts/2025/08/build-a-quick-app-for-vela-devices> | 从零到真机的完整流程记录 |

> 官方文档根路径规律（可自行拼）：`/vela/quickapp/zh/guide/...`、`/vela/quickapp/zh/components/...`、`/vela/quickapp/zh/features/...`、`/vela/quickapp/zh/tools/...`。

## 二、已核实的关键规范（来自官方 manifest / scroll / style / app 文档）

| 项 | 官方要求 / 事实 | 对我们的影响 |
|---|---|---|
| `manifest.package` | 必填，推荐 `com.company.module`，需与原生应用包名不同 | 我们用 `com.bluebridge.review.weather` |
| `manifest.name` | 必填，**6 个汉字以内** | “天气一屏”合规 |
| `manifest.icon` | 必填，**提供 192×192 即可** | 我们给 256×256 RGBA 也能用；提交前可出 192 版 |
| `versionCode` | 必填，每次重新上传 +1 | 1.0.0 / code 1 |
| `minAPILevel` | 兼容性检查；不填按内测处理 | 我们填 2，避免高版本 API |
| `features` | **绝大部分系统接口必须在此声明**，否则调用失败 | `@system.app/router/device/prompt/vibrator` 均已声明 |
| `deviceTypeList` | 目前只支持 `watch` | watch |
| `config.designWidth` | 设计基准宽度；手环 336 屏 → 1 设计 px = 1 物理 px | 336×480 按物理像素排版 |
| `scroll` 组件 | **竖向滚动必须定高，水平滚动必须定宽**；`scroll-x`/`scroll-y` 显式写；子项需 `flex-shrink:0` | 指标行 / 5 小时行均按此实现 |
| 样式 | 通用样式基本同 CSS；动画能力受镜像限制（见下） | 不用 `transition`/`overflow` |
| 系统接口导入 | `import app from '@system.app'` 或 `require('@system.app')` | 两种都可用 |

## 三、官方文档推荐阅读顺序（手环新手）

1. `guide/start/`：环境搭建 → 工程结构 → 第一个页面 → 加交互 → 取数据；
2. `guide/framework/manifest.md` + `guide/framework/style/page-style-and-layout.md`：包配置与布局模型；
3. `components/`：`div / text / span / image / scroll / progress / swiper` 等；
4. `features/`：`@system.app / router / device / prompt / vibrator / storage / fetch` 等；
5. `guide/best-practice/`：性能、内存、业务实践；
6. `guide/design/`：多屏设计（含 336×480 手环）。

## 四、官方文档没讲清、我们实践补上的部分

见本仓库 `docs/emulator-verification.md`：官方 Vela 模拟器（VVD）无 AIoT-IDE 时的启动/安装/截图流程、gRPC 触屏注入结论（`sendTouch` 对 vela-watch-5.0 无响应，`sendMouse` 等价可用）、打包与安装的坑（`pm install` 不能带 `-r`、`am start` 建议 reboot 后执行）等。
