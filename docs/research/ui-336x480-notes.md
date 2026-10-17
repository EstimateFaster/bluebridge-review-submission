# 336×480 小米 Vela 手表 UI 设计调研（可直接落地版）

> 结论先行：designWidth 设 336 时 **1px = 1 物理像素**，UI 就按 336×480 画、按 336×480 写；资产只出 png/jpg、不需要 @2x；官方只有「多屏 / 安全区」规范，字号、配色、图标要自己定（本文给出取值）。

## 1. 硬件事实与坐标映射

| 项 | 数值 | 来源 |
|---|---|---|
| 屏幕 | 1.74" AMOLED，**480×336 px**，336 PPI，16.8M 色，60Hz | 小米官网规格页（港/台版） |
| 亮度 | 峰值 2000 nit / 全局 HBM 1500 nit | 同上 |
| 机身 | 2.5D 曲面玻璃，9.7mm，42.83×32.16mm，5ATM | 同上 |
| 常亮 | 支持 AOD（AOD 场景续航 8 天） | 同页电池段 |
| 触控 | 全触屏，无旋转表冠；交互 = 点按 + 上下/左右滑 | 产品页 |
| 圆角 | 同尺寸 9 Pro 社区实测画布圆角 **48px**（胶囊屏手环 9/10 为 999px） | 社区实践 |
| DPR / dp | **2.1** → 160dp × 228.6dp | 官方「多屏设计」「媒体查询」页 |

- 官方多屏表把 **手环 8 Pro / 9 Pro 标为 336×480、PPI 336、DPR 2.1**；10 Pro 沿用同一块屏（官方规格页明写 480×336）。10 Pro 未进官方多屏表，按 9 Pro 同参处理。
- 几何校验：√(480²+336²)=585.9，585.9/1.74=**336.7 PPI** → 1px≈0.0756mm，屏宽 25.3mm、高 36.2mm。
- **designWidth 语义**（官方 style 页原文：所有尺寸按基准宽度缩放，实际px = 设计px × 设备宽度 / designWidth）：
  - designWidth=**336** → 系数 1.0，`font-size:32px` 就是 32 个物理像素（≈7pt 观感，与 Apple Watch 正文同级）。
  - designWidth=480（框架默认）→ 系数 0.7，30px 字只剩 21 物理像素，**偏小、发虚**，不要用默认值。
  - 社区还见 `"designWidth": "device-width"`（HyperBilibili），非官方文档写法，不建议依赖。
- 媒体查询单位是 **dp 且不带单位**：`@media (max-width: 160) {...}`；形状用 `@media (shape: rect)`，可选 circle / rect / pill-shaped。

## 2. 小屏 UI 硬规则（336×480 直接取值）

**字号阶梯**（1px=1 物理像素；字重只有 normal / bold）
| 用途 | 字号 | 字重 |
|---|---|---|
| 主温度 / 大数字 | **96–120**（推荐 108） | bold |
| 温度单位 ° | 40–48 | normal |
| 页面标题 / 城市名 | **40** | bold |
| 正文、列表主行 | **32** | normal |
| 次要信息（体感、风向、日期） | **26–28** | normal |
| 极小标签（刻度、单位） | **24（下限，不要低于 24）** | normal |
| 按钮文字 | 32–36 | bold |

- 依据：成熟社区应用（HyperBilibili 系列）在 192/336 宽屏上统一用 标题 40 / 正文 30 / 提示 24–25，与上述阶梯吻合。
- 对比度：主文字 #FFFFFF 配 #000000（21:1）；次要文字 `rgba(255,255,255,0.7)`（≈13:1）；禁用/占位 0.4（仍 >4.5:1）。正文不要低于 0.6。
- 深色为默认：页面背景与 manifest 的 `display.backgroundColor` 都设 #000000，避免切换闪白；卡片 #14161A，分隔线 `rgba(255,255,255,0.10)`。
- 触控热区：**≥88×88px**（≈42dp，对齐 Apple Watch 44pt 与 Material 48dp 的手表实践）；列表整行可点，行高 **≥96px**；图标本身 40–48px，用透明 padding 撑满 88。
- 间距节奏：4 的倍数，常用 **8 / 12 / 16 / 24 / 32**；页面左右安全边距 **24px**（大数字页可 32）；区块间距 24–32。
- 图标尺寸：列表行内 40px；区块标题前 32px；主天气图标 **96–112px**；小时预报每列图标 32–36px。
- 安全区：官方只对**圆屏 / 胶囊屏**要求主体内容落在安全区；336×480 矩形屏按 48px 圆角设计，四角内容内缩 ≥48px。系统不给独立状态栏占位，但顶部留 24px、底部留 24–32px 更稳（真机验证一次）。
- 一屏一个主任务：可读区约 336×430，正文控制在 6–7 行；超出用 `scroll` 或 `list`（官方建议每页 ≤20 item）。

## 3. 官方设计资源实况（比预期少）

- 「设计指南」下**只有一页**《多屏设计》：设备参数表、三形态三套设计稿建议、圆/胶囊屏安全区。**没有**字号表、色彩规范、图标库、动效规范。
- 字体：`text` 仅支持 font-size / font-weight（normal | bold，数值 <550 取 normal）/ font-style / text-align / line-height / text-decoration；**通用样式表里没有 font-family，也没有 @font-face** → 自定义字体不可用，层级只能靠 字号 + 字重 + 透明度。
- 官方示例（samples）：日历、图表、计算器 UI、任务清单、播放器、设置 UI、输入法，均已适配圆屏/方屏/跑道屏，是最接近官方的 UI 参考实现（AIoT-IDE 模板可取源码）。
- 验收硬指标：首页 FMP **≤2000ms**；另有专门的三方应用内存清单（static 节点、不把页面对象挂全局、及时清 timer）。

## 4. 开源资源与许可

| 资源 | 说明 | 许可 |
|---|---|---|
| github.com/Searchstars/HyperBilibili（★72） | 完整 Vela 三方应用，组件拆分清晰，DefaultButton/TitleBar 可复用 | GPL-3.0（只参考写法，勿抄进闭源） |
| github.com/OnDriveLine/HyperBilibili_Band | 手环版（designWidth 192），组件目录结构最佳范例 | GPL-3.0 |
| github.com/leset0ng/B2048（★19） | 小游戏，最简工程结构 | MIT |
| github.com/ReidPu/Xiaomi-Watch-Pomodoro | 单页工具类模板 | MIT |
| github.com/oryonatan/xiaomi-band-development | 侧载/调试 CLI + songbird 示例 | MIT |
| github.com/chiyuki0325/miband9-countdown | 倒数日应用，列表与排版范例 | 无 LICENSE（默认保留版权） |
| github.com/OrPudding/VelaOS_BandTwine、Gsjsjzhznsz/BandQQ | 复杂应用 / 通信桥 | AGPL-3.0 |
| lucide.dev（lucide-icons/lucide） | 线性图标，最贴小屏 | **ISC**（可商用） |
| Google Material Symbols | 量大，有 filled/rounded 变体 | **Apache-2.0** |
| github.com/basmilius/weather-icons（Meteocons） | 静态+动画天气图标，风格现代 | **MIT** |
| github.com/erikflowers/weather-icons | 经典天气图标，朴素 | SIL OFL 1.1（字体）/ MIT（代码），需保留声明 |
| tabler-icons / feather | 备选线性图标 | MIT |
| simple-icons | 品牌 logo | CC0 |

> 注意：这些库发的是 **SVG**，而 Vela `image` 只吃 png/jpg（见第 5 节）。必须用 rsvg-convert / sharp / Figma 导出成目标像素的透明 png（40 / 48 / 96 / 112 各一套），不要尝试内联 SVG。

## 5. 资产策略（Vela 快应用）

- **格式**：`image` 的 src 官方只写"支持 png、jpg"，**没有 svg、没有 webp**；`background-image: url()` 同样只走位图。图标/插画一律 png（带 alpha），照片用 jpg。
- **路径**：`src/` 下资源分区为「应用资源（只读）」。绝对路径 `/common/icons/sun.png`，图片引用一般用相对 `./sun.png`；**被 import 到其他目录的 css/ux 里的资源必须写绝对路径**，否则编译复制后失效。
- **多倍图**：不需要。坐标空间=物理像素，336 宽下画 40px 图标就导出 40×40 png。想更锐利最多按 2× 出 80px 再用 width 缩，但包体变大、收益极小。
- **体积**：官方无公开 rpk 硬上限；社区经验整包 <2MB、单图 <100KB。40px 单色图标 png-8 后约 1–3KB。官方优化项明确要求控制本地文件数量。
- **base64**：文档未声明 src 支持 data URI，别赌；官方「跨设备图片传输」示例的路径是 base64 分片 → 写 `internal://` 文件 → 用文件渲染，反证 src 不宜直接塞 base64。
- **性能写法**：静态图标加 `static` 属性（减少动态节点、降内存）；src 不要字符串拼接（用变量）；远程小图加 `alt="blank"` 防首帧闪烁；`object-fit` 默认 cover，图标要 contain。
- 启动优化：logo 页不发 http，首页先读缓存再异步刷新。

## 6. 天气页排版参考

**案例**
1. **Apple Watch 天气**（Apple Watch 使用手册 / support.apple.com）：首屏 = 大号当前温度 + 现象文字 → 横向 12 小时预报 → 10 天预报列表 → 明细网格（风、UV、AQI、日出日落）；严重天气告警置顶。层级 = 现在 > 未来 12h > 未来 10 天 > 指标。
2. **小米手环 9/10 官方天气页**（mi.com/hk/support/faq/details/KA-232520）：一屏讲完"温度 + 现象图标 + 最高最低"，下拉才给逐时与多日；AQI/UV 用彩色小徽章而非文字。
3. **社区 Vela 天气应用「简明天气」**（bandbbs.cn/threads/21287）：单屏极简——大温度、现象图标、城市、最高最低，其余靠下滑。说明 336 宽下"一屏只放 4 个元素"是可行审美。

**336×480 落地版式（px 坐标，可直接写样式）**
| 区块 | y 范围 | 内容与尺寸 |
|---|---|---|
| 顶部行 | 24–68 | 城市 26px（白 0.7）+ 定位图标 24px；右侧「空气 良」徽章 高 40 |
| 主区 | 76–200 | 温度 **108px bold** + `°` 44px（与数字顶部对齐）；右侧天气主图标 **96×96** |
| 现象行 | 204–248 | 「多云转晴」32px + 「24° / 17°」28px（低值 0.6 透明度） |
| 小时预报 | 264–356 | 6 列 × 48px 宽（间距 8，横向 scroll）：时间 22 → 图标 32 → 温度 26 |
| 关键指标 | 372–452 | 2×2 网格，卡片 136×76、圆角 24、间距 16：体感 / AQI / UV / 风（值 36 bold，标签 22 白 0.6） |
| 7 天预报 | 第二页（list） | 行高 96：星期 28 + 图标 40 + 高低温 28，右侧温度区间条 高 6 |
| 底部 | 456–480 | 页码点 8px 或「未来 7 天 ›」入口（整条 88 高可点） |

**配色**：底色 #000000；主色随天气状态（晴 #FFB300 / 云 #9AA5B1 / 雨 #4C9AFF / 雪 #BFE3FF / 雷 #8E7CFF）；AQI 用国标六色（#00E400 #FFFF00 #FF7E00 #FF0000 #8F3F97 #7E0023），但**深色底上饱和降 10–15%、亮度提 5%** 才不刺眼。

## 7. 关键 URL

- 官方多屏 / 安全区：https://iot.mi.com/vela/quickapp/zh/guide/design/multi-screens.html
- 官方样式（designWidth 缩放语义）：https://iot.mi.com/vela/quickapp/zh/guide/framework/style/
- 官方媒体查询（dp / DPR / 设备表）：https://iot.mi.com/vela/quickapp/zh/guide/framework/style/media-query.html
- 官方 image 组件（png/jpg）：https://iot.mi.com/vela/quickapp/zh/components/basic/image.html
- 官方通用样式（无 font-family）：https://iot.mi.com/vela/quickapp/zh/components/general/style.html
- 官方 text 组件（字重阈值 550）：https://iot.mi.com/vela/quickapp/zh/components/basic/text.html
- 官方项目结构 / URI 规则：https://iot.mi.com/vela/quickapp/zh/guide/framework/project-structure.html
- 官方 manifest：https://iot.mi.com/vela/quickapp/zh/guide/framework/manifest.html
- 官方内存优化（static）：https://iot.mi.com/vela/quickapp/zh/guide/best-practice/memory.html
- 官方验收 FMP≤2000ms：https://iot.mi.com/vela/quickapp/zh/guide/publish/acceptance-criteria.html
- 官方示例（日历/计算器/设置/播放器/输入法）：https://iot.mi.com/vela/quickapp/zh/samples/
- 手环 10 Pro 规格（480×336 / 2000nit / 60Hz）：https://www.mi.com/hk/product/xiaomi-smart-band-10-pro/specs
- 社区完整教程（含圆角 48px、画布=物理分辨率）：https://www.luming.cool/posts/2025/08/build-a-quick-app-for-vela-devices
