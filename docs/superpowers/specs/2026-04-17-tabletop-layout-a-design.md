# 2026-04-17 TableTop 布局重构（方案 A：环形座位 + 中央安全区）

## 背景与问题

当前桌面布局使用座位绝对定位（`TableTop.vue` 内 `.seats :deep(.seat)` + 各位置 `top/left/...`），在 6 人桌和部分窗口尺寸下会出现：

- 玩家座位区域互相遮挡（尤其是左右两侧与中间区域冲突）
- `board` / `status` 在窄宽时溢出或被挤压，导致“整体看起来位置错乱”

需求：**彻底不遮挡**（不是“尽量少遮挡”），且保留围桌沉浸感。

## 目标（验收标准）

- **永不遮挡**：任意窗口宽度下，座位(`PlayerSeat`) 与中央区域(`board/status/showdown`) 不发生重叠遮挡。
- **围桌感**：6 人依旧沿桌面边缘环形分布（上/左上/右上/下/左下/右下）。
- **响应式稳定**：
  - 宽屏：中央区域居中，座位间距舒服。
  - 窄屏：座位可进入紧凑模式（减小 padding/字号/牌尺寸或排版更紧凑），但仍不遮挡。
  - 允许中央 `board` 在必要时水平滚动；不允许通过覆盖来“挤进去”。
- **最小边界改动**：只重构 `TableTop.vue` 布局与必要的 `PlayerSeat.vue` 紧凑样式；不动引擎与 store。

## 非目标

- 不调整引擎规则/结算/胜率逻辑。
- 不把 `ActionBar`（右侧栏）合并到中央安全区。
- 不追求像素级复刻某个外部设计稿；以“可玩 + 不遮挡 + 稳定”为第一优先级。

## 总体方案（A）

将桌面区域拆成两个互相独立的“约束层”：

1) **中央安全区 `centerZone`**：承载 `board + status + showdown`，始终位于桌面中心，尺寸通过 `clamp()` 进行硬约束（有最小/最大），且具有 `max-width: 100%`。

2) **座位环 `seatRing`**：6 个座位沿桌面边缘排布，但不再用“固定像素绝对定位”硬塞，而是使用“锚点 + 受限偏移 + 自适应宽度”的方式：

- 座位宽度使用 `clamp(min, vw, max)` 随容器收缩
- 各座位的 `top/bottom/left/right` 偏移也使用 `clamp()`（而不是固定值）
- 关键点：座位的可用宽度与偏移量设计成 **不会侵入 `centerZone`** 的安全半径

> 说明：CSS 无法真正做“碰撞检测”，所以这里的“永不遮挡”通过 **硬几何约束** 达成：中央安全区有明确尺寸上限，座位有明确尺寸上限与边缘锚点，二者之间预留最小间距（gutter）。

## 结构调整（DOM）

`TableTop.vue` 内部结构调整为（示意）：

- `.felt`
  - `.rim` / `.noise`（不变）
  - `.seatRing`（替换/重构 `.seats`）
    - 6 个 `PlayerSeat`
  - `.centerZone`
    - `.board`
    - `.status`
    - `.showdown`（已有）

原则：

- `centerZone` 必须在视觉上居中，但不要用 `place-items:center` 把整个内容“挤压”造成错觉；改为显式区域约束。
- `seatRing` 不应影响 `centerZone` 的排版（两层叠放，但通过几何约束避免重叠）。

## 样式设计（核心约束）

### 1) 中央安全区 `centerZone`

- 宽度：`width: clamp(520px, 56vw, 860px)`（初始建议，可按实际观感微调）
- 最大宽度：`max-width: 100%`
- 纵向：根据桌面高度决定，可用 `min-height` + 内部 `gap`
- `board`：
  - `max-width: 100%`
  - `overflow-x: auto`（已有方向）
  - 保证 5 张牌在最窄情况下也不会撑爆布局
- `status`：
  - `max-width: 100%`
  - 长文案可换行，pill 允许折行

### 2) 座位环 `seatRing`

- `seat` 宽度：`width: clamp(200px, 24vw, 320px)`（6 人默认上限更小）
- 位置偏移建议统一变量（CSS 自定义属性）：
  - `--edge: clamp(12px, 1.6vw, 18px)`
  - `--cornerY: clamp(64px, 9vh, 96px)`（上/下角的纵向偏移）
  - `--sideX: clamp(12px, 1.6vw, 18px)`（左右边距）

位置锚点：

- top：`top: var(--edge); left: 50%; transform: translateX(-50%);`
- bottom：`bottom: var(--edge); left: 50%; transform: translateX(-50%);`
- topLeft/topRight：`top: var(--cornerY); left/right: var(--sideX);`
- bottomLeft/bottomRight：`bottom: var(--cornerY); left/right: var(--sideX);`

并配合 `centerZone` 的宽度与高度，保证中间区域不会被角座位压住。

### 3) 紧凑模式（窄屏）

触发条件（建议用断点）：

- `@media (max-width: 960px)`：整体从两列变一列（项目已有）
- 在桌面区域内部再加一档，例如：
  - `@media (max-width: 720px)`：`PlayerSeat` 进入紧凑模式

紧凑模式对 `PlayerSeat.vue` 的改动范围：

- 减少 `.seat` padding 与圆角
- 减小 `.cards` 间距
- 允许将筹码与状态更紧凑地排在同一行（必要时隐藏非关键装饰）
- 可选：牌尺寸在 `CardView.vue` 里支持一个 `size="sm"`（如果改动太大则改为纯 CSS 缩放/容器约束）

目标：窄屏仍然不遮挡；信息密度上升但不影响可玩性。

## 影响面与文件清单（预期）

- `src/components/TableTop.vue`
  - 重构 `.seats` → `.seatRing` + 新增 `.centerZone`
  - 迁移/调整 `board/status/showdown` 所在层级与样式
- `src/components/PlayerSeat.vue`
  - 增加紧凑样式（通过父级类名或媒体查询触发）
- （可选）`src/components/CardView.vue`
  - 若紧凑模式需要更小牌面，可提供尺寸变体；否则保持不变

## 测试与验证

- **构建验证**：`npm run build`
- **手工验证（最小）**：
  - 6 人桌，在窗口宽度从大到小拖动，确认任何时刻：
    - 6 个座位不互相覆盖
    - 座位不覆盖中央 `board/status`
    - `board` 在窄宽下可滚动但不撑爆
  - 2/3/4/5 人桌确认布局不回归（位置与缩放合理）

## 风险与权衡

- “永不遮挡”在纯 CSS 下需要通过约束实现，可能会带来：
  - 极窄窗口下座位变得更紧凑（已接受）
  - 中央区尺寸需要上限，否则会侵占座位空间

