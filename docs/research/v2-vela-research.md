# 小米 Vela 手表天气 v2 技术调研（落地版）
> 标记：[官]=官方文档、[例]=官方示例、[社]=社区/厂商 FAQ、[验]=本机实测；基线 designWidth=336、minAPILevel=2、Vela 5.0。

## 0 结论速览
1. 横滑只能用 `<scroll scroll-x="true">`（2+，官方明确支持嵌套 scroll）；`list` 只收 list-item，不能横滑。
2. Vela 公开文档没有手势 API：能力只有 根节点 `@swipe`（不冒泡）+ `touchstart/move/end`（冒泡）+ `onBackPress` + `app.terminate()`；router **没有**转场动画参数。
3. 「单页 .ux」下，下滑二级页 = 页内 absolute 抽屉（class + @keyframes），不要 router.push。
4. 动效只能动 transform/opacity/background-color/background-position/width/height；`transition` **不支持** transform/top/left/margin/border-radius；动态背景用**两层 `<image>` 交叉淡入**，不要 `url({{x}})` 拼接。

## A 横向滚动
- [官] `scroll`（API2+）：`scroll-x`/`scroll-y` **默认都是 false**，必须显式写；「竖向滚动需要设置定高，水平滚动需要设置定宽」；子组件支持，且**「也支持嵌套子 scroll」**；`bounces` 默认 false（横滑保持 false）。
- [官] `list` 无 scroll-x 属性、必须定高、只允许 list-item → 横滑别用 list；`scroll-snap-type/align/stop` 是 **API3+**，minAPILevel=2 用不了（要用就把 manifest 抬到 3）。
- 推荐结构（首屏完整露出必含 5 小时，后面再接 7 小时做拖动余量）：
```html
<scroll class="hours" scroll-x="true" scroll-y="false" bounces="false">
  <div class="hours-row"><div class="hour" for="{{hours}}">…</div></div></scroll>
```
```css
.hours{width:336px;height:104px} .hours-row{flex-direction:row}
.hour{width:64px;height:96px;flex-shrink:0;flex-direction:column;align-items:center}
```
- 三个必踩坑：子项定宽 + `flex-shrink:0`（默认 1 会被压扁）；内容包一层 row；scroll 自身宽高缺一不可。程序化定位用 `scrollTo({left:64,behavior:'smooth'})`，内容宽度用 `getScrollRect()`（异步回调）。
- 顶部指标横滑：优先 `<swiper>`（`indicator`/`loop=false`/`previousmargin` 露下一张），整页翻页比 scroll 稳；要「3 指标同屏」就做 2 页——第 1 页放全部必含指标，第 2 页放体感/气压等加分项。
- [社] 真实工程：HyperBilibili_Band `videodetail.ux` 第 34 行即为「纵 scroll 内嵌横 scroll」，`.vidtoolbar{flex-direction:row;width:185px}`。

## B 手势与页面切换
| 能力 | 用法 | 关键限制 |
|---|---|---|
| swipe | `@swipe="f"`，`e.direction`=left/right/up/down | [官] **冒泡不支持**；**「滑动方向有滚动条时不触发该事件」** |
| touch* | `e.touches[0].clientX/clientY` | [官] 支持冒泡，可自己做下拉阈值 |
| onBackPress | return true 拦截 | [官] 「用户右滑返回或点击返回实体按键时触发」 |
| 退出 | `app.terminate()` | @system.app，无需 feature |
- [官] 官方教程《添加交互》就是「根节点 @swipe → 上滑 router.push / 右滑 router.back」，可直接照抄该模式。
- 单页推荐实现：抽屉（终态写在类里，动画只负责过程）：
```html
<div class="page" @swipe="onSwipe"> … <div class="drawer {{drawerCls}}">…</div></div>
```
```js
onSwipe(e){ if(e.direction==='down' && !this.drawerCls) this.drawerCls='open' }
onBackPress(){ if(this.drawerCls==='open'){ this.drawerCls='closing'; setTimeout(()=>this.drawerCls='',200); return true } }
```
```css
.drawer{position:absolute;left:0;top:0;width:336px;height:480px;transform:translateY(100%);visibility:hidden}
.drawer.open{transform:translateY(0);visibility:visible;animation:up 240ms ease-out}
.drawer.closing{transform:translateY(0);visibility:visible;animation:down 200ms ease-in}
@keyframes up{0%{transform:translateY(100%)}100%{transform:translateY(0)}}  @keyframes down{0%{transform:translateY(0)}100%{transform:translateY(100%)}}
```
- [官] animation 无 fill-mode/direction → 动画结束回基类，**基类必须写终态**（上面 .open 同时写 transform）。
- 冲突根因：整页套纵 scroll 时下滑被 scroll 吃掉 → 根节点 swipe(down) 不触发。v2 建议页面固定 480 不整体滚动，只让小时/指标行横滑；必须纵滚时，把下滑热区放在不滚动的顶栏/底部把手，或 touch 事件在 scrollTop=0 判 dy>60。
- 系统返回：官方只写「右滑返回」不写热区；[社-小米 FAQ] Watch S1 Pro「需从屏幕左侧边缘向右滑，中部无效」→ 横滑容器**别贴左边缘**，左侧留 20–24px 死区。

## C 动效
- [官] transform 仅 translate/translateX/Y、scale/scaleX/Y、rotate（含 %、deg）；transition-property 白名单：width/height/opacity/visibility/border-width/border-color/background-color/background-position（**transform/top/margin/padding/border-radius 都不支持**）。
- [官] @keyframes 仅 background-color、background-position、opacity、width/height（**不支持 %**）、transform；**0% 与 100% 必须显式写**；animation 只有 name/delay/duration/iteration-count/timing-function，**往返循环要自己写 0%→50%→100%**。
- 可做的天气动效：云飘 600×160 PNG，translateX −30→30→−30，24s infinite，1–2 层；雨 336×480 雨丝 PNG + `background-position:0 0→0 480px` 700ms linear（background-image 支持表见 D）；闪电整屏白遮罩 opacity 0→.35→0→.2→0，6s；卡片入场 opacity 0→1 + translateY 8→0，200ms，`animation-delay:40ms×i` 错峰。
- 温度变化**不能做数字滚轮**：没有 overflow:hidden，滚轮条无法裁剪 → 旧值/新值两层 text 交叉淡出 + 整体 translateY 4px。性能：并发无尽动画 ≤3 个；onHide 摘掉动画类；图片尺寸=组件尺寸、优先 PNG8、少用 border-radius（[官] 帧率建议）。

## D 动态背景
- [官-2.0 迁移] 动态 url 只认完整绝对路径且用对象写法：`this.bgStyle={ backgroundImage:"/common/weather/bg-rain.jpg" }`；**不能** `src="/common/{{type}}.png"` 或 `url({{x}})` 拼接。
- [官] 但 `background-image` 有设备支持表：手环 8 Pro/9/9 Pro/S3/Redmi Watch 4 **不支持**，手环 10、Watch S4/S5、REDMI Watch 5/6 支持 → 更稳的是 `<image>` 图层（png/jpg 全设备支持）。
- 两层交叉淡入（background-image 不可过渡，必须两层）：
```html
<image class="bg {{bgACls}}" src="{{bgA}}"/><image class="bg {{bgBCls}}" src="{{bgB}}"/>
```
```js
switchBg(next){ this.bgB=next; this.bgBCls='show'; setTimeout(()=>{ this.bgA=next; this.bgACls='show'; this.bgBCls='' },600) }
```
```css
.bg{position:absolute;left:0;top:0;width:336px;height:480px;object-fit:cover;opacity:0;transition:opacity 600ms}
.bg.show{opacity:1}
```
- 取舍：5–6 张 336×480 JPG（q80 约 35–50KB/张，合计 ~250KB）比代码画便宜可控；Vela 静态 CSS 无 linear-gradient，渐变只能 JSON.stringify 对象，整屏不值得；省体积可「1 张共用天空底 + 每种天气一张叠加层」，切换只换叠加层；onInit 预热隐藏 image 防首次切换黑屏。

## E 图标
- 没有可直接用的 Vela 图标组件库/字体图标（无 @font-face，image 只吃 png/jpg）；社区只有零散组件（HyperBilibili `TitleBar.ux` 的 40px 返回箭头可参考，GPL-3.0 只借鉴写法）。
- Lucide（ISC，可商用）→ PNG，[验] 命令：
```bash
npm i sharp --registry=https://registry.npmmirror.com
curl -sL https://gh-proxy.com/https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/cloud-sun.svg -o c.svg
sed 's/currentColor/#FFFFFF/' c.svg > w.svg   # 不改就是黑色
node -e "const s=require('sharp');for(const n of [40,48,96])s('w.svg',{density:384}).resize(n,n).png().toFile('c-'+n+'.png')"
```
- 尺寸（实测 40/48/96px 白图标 758B/836B/1.6KB，density:384 再缩、边缘干净）：列表/指标 40、主天气图标 96–112、顶栏 40；**按显示尺寸 1:1 导出**（designWidth=336 时 1px=1 物理像素），不要 @2x；统一 stroke-width（≤48px 用 2，96px 用 1.5）、统一白色；主天气图标想要体积感可用 Meteocons（MIT），UI 继续 Lucide；LICENSE 复制进 `src/common/icons/` 并在 README 注明。

## F 开发者信息页
```js
import app from '@system.app'; import device from '@system.device'
export default { data:{appInfo:{},devInfo:{}}, onInit(){ this.appInfo=app.getInfo()  // 同步：name/versionName/versionCode/logLevel
  device.getInfo({success:(r)=>{ this.devInfo=r }}) } }
```
- 展示（行高 40，label 22px 白 0.6 / value 24px 白）：应用名+versionName(versionCode)｜包名｜APILevel｜platformVersionName/Code｜model｜osVersionName｜336×480/DPR/shape｜deviceType。
- [官] `device.getInfo` 需 `features:[{"name":"system.device"}]`（现有 manifest 已声明）；getDeviceId/getSerial 还要 `hapjs.permission.DEVICE_INFO`，信息页不必用。入口：右上角「…」→ 同页浮层（单页约束），onBackPress 先关它。

## G 半圆弧（日出→日落）
- 不用 canvas（组件清单无 canvas）。用 `progress type="arc"`：
```html
<progress class="arc" type="arc" percent="{{dayPercent}}" start-angle="270deg" total-angle="180deg"/>
```
```css
.arc{width:300px;height:180px;stroke-width:10px;color:#FFB300;layer-color:rgba(255,255,255,.12);center-x:150px;center-y:150px;radius:130px}
```
- [官] 角度以 12 点为基线顺时针，必须带 deg：`start-angle:270deg` 从 9 点起、`total-angle:180deg` 扫到 3 点，正好是过 12 点的上半弧；percent 沿弧从日出走向日落（50% 在正上方）。
- 太阳点：θ=270+180p，`x=150+130·sinθ`、`y=150−130·cosθ`，16px 太阳 png 绝对定位绑 left/top，每分钟更新。
- [官] type 不支持动态修改（不需要）；percent 可动态更新。不推荐「PNG 弧 + 遮罩」（无 overflow:hidden 裁不出进度）；纯 CSS 半圆（`border-radius:150px 150px 0 0`+单边 border）只能当底轨。维护：抽 `components/sun-arc/sun-arc.ux`，props=percent/sunrise/sunset/themeColor；onHide 清 setInterval。

## H 合规：与题 1 的冲突
- 硬冲突：题 1 要求「**单页 .ux** + 9 项信息一屏可见」，而 v2 需求 3 把日出日落移出主屏、需求 1 的横滑可能把必含项滑出视口。
- 策略 A｜合规优先（题 1 交付）：单文件单页、无 router；日出日落仍以 20px 细行留在主屏（或并入顶栏），9/9 一屏可见；下滑抽屉只做「加分详情」；横滑只把**额外**小时（6–12h）放到首屏之外，必含 5 小时首屏完整可见。
- 策略 B｜体验优先：`router.push('/sun')` 真二级页，主屏彻底删日出日落，右滑返回天然可用；但违反「单页 .ux」硬性要求，且首页右滑=退出应用的行为消失。
- 策略 C｜一份代码两模式（建议）：`const COMPLIANCE=true`，合规模式=A，体验模式=B；v1 的 rpk 继续作为题 1 证据，v2 另出构建；评审看合规版，产品看体验版。
- 单页时系统右滑返回会直接退出应用（[社] 同类单页应用均如此）→ 左上角箭头用 `app.terminate()` 与系统行为一致。

## 验证清单（真机/模拟器）
1. 横滑行拖到边缘不触发退出；再从最左 10px 内右滑，对比是否被系统吃掉；纵 scroll 内嵌横 scroll 时竖滑不抢手势。
2. 页面内有 scroll 时根节点 @swipe 是否仍收得到 down（官方未写优先级）。
3. 抽屉开合 + onBackPress 拦截；息屏亮屏后动画是否重启（onHide 应停）；6 张背景切换的掉帧/内存（模拟器软渲染仅看趋势）。

## URL
官方：scroll https://iot.mi.com/vela/quickapp/zh/components/container/scroll.html ｜ 事件 https://iot.mi.com/vela/quickapp/zh/components/general/events.html ｜ 动画 https://iot.mi.com/vela/quickapp/zh/components/general/animation-style.html ｜ progress https://iot.mi.com/vela/quickapp/zh/components/basic/progress.html ｜ 生命周期/onBackPress https://iot.mi.com/vela/quickapp/zh/guide/framework/script/lifecycle.html ｜ 滑动切页教程 https://iot.mi.com/vela/quickapp/zh/guide/start/add-interactivity.html ｜ 2.0 动态样式 https://iot.mi.com/vela/quickapp/zh/tools/toolkit/update.html ｜ app.getInfo https://iot.mi.com/vela/quickapp/zh/features/basic/app.html ｜ device.getInfo https://iot.mi.com/vela/quickapp/zh/features/basic/device.html ｜ 背景图支持表 https://iot.mi.com/vela/quickapp/zh/components/general/background-img-styles.html
社区/示例：官方 weather 示例 https://github.com/open-vela/packages_fe_examples/blob/dev/weather/src/pages/detail/detail.ux ｜ 嵌套横滑 https://github.com/OnDriveLine/HyperBilibili_Band/blob/band9/src/pages/videodetail/videodetail.ux ｜ Lucide https://github.com/lucide-icons/lucide （github 直连不通时前缀 https://gh-proxy.com/）
