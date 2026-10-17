# 调研记录与设计决策（题 1 · 一屏天气）

> 目的：把「官方文档 / 工具链 / 336×480 UI 规范 / 资产与开源资源」整理成可落地结论，并记录本项目采纳或放弃了什么、为什么。标注约定：**[官]** 官方文档明确；**[推]** 由官方信息推断；**[社]** 社区经验。

## 1. 官方文档与版本

- 文档入口：[Vela 快速应用文档](https://iot.mi.com/vela/quickapp/zh/guide/)
- 关键页：项目结构 / manifest / UX 文件 / 生命周期 / 页面切换 / 页面样式与布局 / 媒体查询 / 通用样式 / 文本组件 / 多屏设计 / 性能与验收
- API Level：L2 增加媒体查询 shape、scroll 等；L3 增加 box-shadow、dp 单位、screenDensity；L4 增加 `@system.event`。本工程 `minAPILevel: 2`，因此**不使用 box-shadow / dp**。

## 2. 工程与构建（已采纳）

- `src/` 固定目录；`manifest.json` 负责包名、版本、路由、features、`config.designWidth`；
- 页面 `.ux` = `<template>` + `<style>` + `<script>` 三段，**template 只能有一个根节点**；
- 构建：`aiot-toolkit@2.0.5`（纯 Node，无需 Java），`npm run build` → `dist/*.debug.rpk`；
- `.npmrc` 固定 `registry.npmmirror.com`（本机直连 npm 官方源慢）；
- 未使用 AIoT-IDE（本机无图形环境），但工程结构与 AIoT-IDE 新建模板兼容，可直接用 IDE 打开。

## 3. 样式与布局约束（直接影响实现）

| 结论 | 来源 | 本项目做法 |
|---|---|---|
| 长度单位 px / %（L3+ dp），无 rpx；1 设计 px = 设备宽 / designWidth | [官] | designWidth=336，手环 10 Pro 屏宽 336 → 1px = 1 物理像素 |
| Flex 布局，**默认 flex-direction: row** | [官] | 竖排容器全部显式 `flex-direction: column` |
| 盒模型固定 border-box；无 overflow 属性；长内容要 `scroll`/`list` | [官] | 单页不滚动，全部内容塞进 480 高 |
| `position` 仅 relative/absolute，left/top 不支持百分比 | [官] | 背景图绝对定位铺满 336×480 |
| `border-radius` 不裁剪子元素（无 overflow:hidden） | [官] | 不依赖圆角裁剪，卡片/图标自身带圆角 |
| 颜色支持 #rrggbb / rgba() | [官] | 面板用 rgba 半透明 |
| 文字字重仅 normal / bold；无自定义字体 / @font-face | [官] | 只用 normal/bold，靠字号 + 颜色分层 |
| `<text>` 内只允许 `<span>`；`lines`+`text-overflow` 才能出省略号 | [官] | 数值单位改为独立 `text` + flex 行，避免依赖 span 样式 |
| 图片只支持 png/jpg，路径用绝对 `/common/xxx.png`；2.0 起不能动态拼接路径 | [官] | 图标全部 PNG，`src="{{$item.icon}}"` 变量绑定（不拼接字符串） |
| `for="{{list}}"` + `$item`/`$idx`，可加 `tid` 提升列表复用 | [官] | 5 小时 / 7 天列表用 for 渲染 |
| `box-shadow` 需 APILevel 3+ | [官] | 不用阴影，用半透明面板分层 |
| 手环**不支持** `system.fetch`/`system.network` | [官-设备表] | 数据全部本地常量，零网络请求 |
| 手环支持 `system.vibrator`、`system.storage` 等 | [官-设备表] | 本题静态展示，未使用 |

## 4. 手环 10 Pro 与 336×480

- 屏幕 **480×336（设计基准 336 宽）、336 PPI、DPR 2.1、1.74" AMOLED**（小米官网规格页 + 官方多屏表 9 Pro 同参）[官/社-规格]；
- 官方多屏表未单独列 10 Pro，按 9 Pro 同屏处理；矩形屏（shape: rect），四角圆角约 48px（社区实测，真机需复核）[社]；
- 设计安全边距：左右 16px、上下 16/12px，避开圆角裁切；
- 官方设计指南只有「多屏/安全区」一页，**没有**官方字号表 / 色板 / 图标库 → 字号与配色需自定义。

## 5. UI 取值决策

| 项 | 调研建议 | 本项目取值 | 理由 |
|---|---|---|---|
| 主温度 | 96–120 | 80 | 9 项信息一屏的硬约束下取 80，仍占屏宽 24%，是绝对主角 |
| 城市/标题 | 40 | 22 | 一屏信息多，城市降为辅助信息；40 会挤掉预报 |
| 正文 | 32 | 22–23（5 小时温度）/ 17（7 天高温） | 密度与可读性折中 |
| 辅助/标签 | 24–28 下限 | 12–16 | 纯标签（湿度/空气/日出等），与数值拉开层级 |
| 主天气图标 | 96–112 | 80 | 与温度同高，视觉平衡 |
| 列表图标 | 32–40 | 20–26 | 336 宽横排 5/7 列的必然取舍 |
| 页面边距 | 24 | 16 | 左右各 16 给足内容宽度，同时避开 48px 圆角 |
| 深色底 | #000000 | #0a1424 渐变 | OLED 深色底 + 自绘夜空提升视觉完成度 |

> 结论：官方/社区给出的「舒适字号」是按「一屏 4–6 个元素」的极简页面设计的；题面要求 **9 项 + 5 小时 + 7 天全部一屏可见**，必须走「主信息大、辅助信息小、横向等分列」的密集排版路线，这是本题的核心设计取舍。

## 6. 资产与开源资源

- Vela `image` 只吃 png/jpg（无 svg/webp），不需要 @2x 多套图（坐标即物理像素）；
- 候选开源资源与许可：Lucide（ISC）、Material Symbols（Apache-2.0）、Meteocons（MIT）、weather-icons（OFL/MIT）等；
- **本项目全部资产自绘**（Pillow 脚本生成），不引入第三方素材 → 无版权/署名负担，也符合题面「不要引入体积过大的无关资产」；
- 包体控制：rpk 149,829 字节，其中 21 个本地资产约 100KB（PNG 已压缩）。

## 7. 关键参考链接

- 官方文档：[概述](https://iot.mi.com/vela/quickapp/zh/guide/)｜[manifest](https://iot.mi.com/vela/quickapp/zh/guide/framework/manifest.html)｜[UX 文件](https://iot.mi.com/vela/quickapp/zh/guide/framework/ux.html)｜[页面样式与布局](https://iot.mi.com/vela/quickapp/zh/guide/framework/style/page-style-and-layout.html)｜[通用样式](https://iot.mi.com/vela/quickapp/zh/components/general/style.html)｜[text](https://iot.mi.com/vela/quickapp/zh/components/basic/text.html)｜[image](https://iot.mi.com/vela/quickapp/zh/components/basic/image.html)｜[多屏设计](https://iot.mi.com/vela/quickapp/zh/guide/design/multi-screens.html)｜[媒体查询](https://iot.mi.com/vela/quickapp/zh/guide/framework/style/media-query.html)｜[AIoT-IDE](https://iot.mi.com/vela/quickapp/zh/guide/start/use-ide.html)｜[aiot-toolkit](https://iot.mi.com/vela/quickapp/zh/tools/toolkit/start.html)
- 手环 10 Pro 规格：https://www.mi.com/hk/product/xiaomi-smart-band-10-pro/specs
- 社区避坑与工程参考：BandQQ、HyperBilibili、B2048、Xiaomi-Watch-Pomodoro（结构与写法参考，未拷贝代码）

## 8. 调研结论如何落地（对照表）

1. `designWidth=336` → 所有尺寸按 336 宽物理像素设计；
2. 手环无网络 → 天气数据写死在 `data`；
3. 无 overflow → 单页布局必须一次算准 480 高度（本 README 有预算表）；
4. 无自定义字体 → 用字号/字重/颜色做层级；
5. text 只嵌 span → 数值 + 单位拆成 flex 行的两个 text；
6. 只支持 png/jpg → 自绘 PNG 资产；
7. `box-shadow` 需 L3 → 用半透明背景面板替代；
8. API Level 2 下无 dp / 无媒体查询形状 → 主目标 336×480，多屏适配写进现场改动预案。
