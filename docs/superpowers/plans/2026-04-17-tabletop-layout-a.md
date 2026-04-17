# TableTop Layout A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将桌面布局重构为“环形座位 + 中央安全区”，在任何窗口宽度下座位/公共牌/状态区不遮挡。

**Architecture:** `TableTop.vue` 内引入 `centerZone`（只放 `board/status/showdown`）与 `seatRing` 两层；座位通过锚点与 `clamp()` 约束尺寸/偏移，保证不会侵入 `centerZone`。

**Tech Stack:** Vue 3 + SFC scoped CSS（`:deep`）、Vite、TypeScript

---

### File Structure (touch list)

**Modify**
- `src/components/TableTop.vue`（模板结构 + 样式重构）
- `src/components/PlayerSeat.vue`（新增紧凑模式样式）

**Optional modify**
- `src/components/CardView.vue`（仅当需要“更小牌面”变体；优先不改）

---

### Task 1: 在 `TableTop.vue` 引入中央安全区容器

**Files:**
- Modify: `src/components/TableTop.vue`

- [ ] **Step 1: 调整模板结构（添加 `centerZone` 包裹）**

将现有：

```vue
<section class="center">
  <div class="board">...</div>
  <div class="status">...</div>
  <section class="showdown" v-if="game.lastShowdown">...</section>
</section>
```

替换为：

```vue
<section class="centerZone">
  <div class="board">
    <CardView
      v-for="i in 5"
      :key="i"
      :card="game.state.communityCards[i - 1]"
      :dim="!game.state.communityCards[i - 1]"
    />
  </div>

  <div class="status">
    <!-- 原 status 内容不变 -->
  </div>

  <section class="showdown" v-if="game.lastShowdown">
    <!-- 原 showdown 内容不变 -->
  </section>
</section>
```

- [ ] **Step 2: 将 `.center` 样式替换为 `.centerZone`（避免 `place-items` 挤压错觉）**

在 `<style scoped>` 中将 `.center { ... }` 改为：

```css
.centerZone {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: clamp(520px, 56vw, 860px);
  max-width: calc(100% - 28px);
  display: grid;
  justify-items: center;
  gap: 14px;
  pointer-events: none; /* 避免挡住 seat 点击 */
}

.centerZone > * {
  pointer-events: auto;
}
```

- [ ] **Step 3: 校准 `board/status/showdown` 的宽度约束**

确保以下约束存在（若已存在则保留并合并）：

```css
.board {
  max-width: 100%;
  overflow-x: auto;
  overscroll-behavior-x: contain;
}

.status {
  max-width: 100%;
}

.showdown {
  width: 100%;
}
```

- [ ] **Step 4: 运行构建验证**

Run: `npm run build`  
Expected: Exit code 0

- [ ] **Step 5: 提交**

```bash
git add src/components/TableTop.vue
git commit -m "refactor(ui): add centerZone safe area"
```

---

### Task 2: 重构座位层为 `seatRing` 并用变量约束偏移/尺寸

**Files:**
- Modify: `src/components/TableTop.vue`

- [ ] **Step 1: 将 `.seats` 更名为 `.seatRing`（模板 + 样式）**

模板：

```vue
<div class="seatRing" :class="`n${game.state.players.length}`">
  <PlayerSeat ... />
</div>
```

样式：把所有 `.seats ...` 选择器替换为 `.seatRing ...`。

- [ ] **Step 2: 引入统一的 CSS 变量（edge/cornerY/sideX）**

在 `.felt` 或 `.seatRing` 上设置：

```css
.seatRing {
  position: absolute;
  inset: 0;
  padding: 18px;
  pointer-events: none;

  --edge: clamp(12px, 1.6vw, 18px);
  --sideX: clamp(12px, 1.6vw, 18px);
  --cornerY: clamp(64px, 9vh, 96px);
}
```

- [ ] **Step 3: 座位通用尺寸约束（取消固定像素/过大 vw）**

```css
.seatRing :deep(.seat) {
  pointer-events: auto;
  position: absolute;
  width: clamp(200px, 24vw, 320px);
}
```

并保留/补充“6 人桌更紧凑”的上限（若需要）：

```css
.seatRing.n6 :deep(.seat) {
  width: clamp(190px, 22vw, 300px);
}
```

- [ ] **Step 4: 用变量表达锚点位置（替换散落的 magic number）**

```css
.seatRing :deep(.seat.top) {
  top: var(--edge);
  left: 50%;
  transform: translateX(-50%);
}

.seatRing :deep(.seat.bottom) {
  bottom: var(--edge);
  left: 50%;
  transform: translateX(-50%);
}

.seatRing :deep(.seat.topLeft) {
  top: var(--cornerY);
  left: var(--sideX);
}

.seatRing :deep(.seat.topRight) {
  top: var(--cornerY);
  right: var(--sideX);
}

.seatRing :deep(.seat.bottomLeft) {
  bottom: var(--cornerY);
  left: var(--sideX);
}

.seatRing :deep(.seat.bottomRight) {
  bottom: var(--cornerY);
  right: var(--sideX);
}
```

- [ ] **Step 5: 给中央安全区预留“不可侵入”的视觉空间（gutter）**

通过控制 `centerZone` 的 `max-width` 与 `seat` 的 `max-width`，再增加一档窄屏时收缩中央区：

```css
@media (max-width: 1100px) {
  .centerZone {
    width: clamp(420px, 60vw, 720px);
  }
}
```

- [ ] **Step 6: 手工验证（6 人桌）**

Run dev: `npm run dev`  
操作：将窗口从大到小拖动，检查：
- 任意宽度下座位不互相覆盖
- 座位不覆盖 `board/status`
- `board` 可横向滚动而不撑爆

- [ ] **Step 7: 提交**

```bash
git add src/components/TableTop.vue
git commit -m "refactor(ui): constrain seatRing with CSS vars"
```

---

### Task 3: 为 `PlayerSeat` 添加窄屏紧凑模式（不遮挡兜底）

**Files:**
- Modify: `src/components/PlayerSeat.vue`
- Modify: `src/components/TableTop.vue`（仅添加触发类或媒体查询位置）

- [ ] **Step 1: 在 `TableTop.vue` 给 `.felt` 或 `.seatRing` 添加触发类（可选）**

如果希望显式控制（比纯媒体查询更清晰），在 `.felt` 上加：

```vue
<div class="felt" :class="{ compact: game.state.players.length === 6 }">
```

（若不想依赖人数，可跳过这步，仅使用媒体查询。）

- [ ] **Step 2: 在 `PlayerSeat.vue` 增加紧凑样式断点**

在 `<style scoped>` 末尾增加：

```css
@media (max-width: 720px) {
  .seat {
    padding: 10px 12px;
    border-radius: 14px;
  }

  .meta {
    gap: 8px;
  }

  .name {
    gap: 8px;
  }

  .who {
    font-size: 13px;
  }

  .badge {
    font-size: 11px;
    padding: 3px 7px;
  }

  .cards {
    margin-top: 10px;
    gap: 8px;
  }
}
```

（如果仍然拥挤，再加一档更窄的断点，把 `.cards` 改为 `justify-content: flex-start` 或把牌容器加 `scale`，但优先保持可读性。）

- [ ] **Step 3: 手工验证（窄屏 + 6 人桌）**

拖动窗口到 720px 附近与以下，确认仍不遮挡且信息可读。

- [ ] **Step 4: 运行自动化验证**

Run: `npm test`  
Expected: PASS

Run: `npm run build`  
Expected: Exit code 0

- [ ] **Step 5: 提交**

```bash
git add src/components/PlayerSeat.vue src/components/TableTop.vue
git commit -m "feat(ui): compact PlayerSeat for small screens"
```

---

### Task 4: 清理与收尾验证

**Files:**
- Modify: `src/components/TableTop.vue`（必要时微调 clamp 值）

- [ ] **Step 1: 复查 `2/3/4/5/6` 人桌**

手工切换人数（如果 UI 支持），或用现有入口多次开局，观察位置映射是否仍合理。

- [ ] **Step 2: 记录最小手工验证步骤到 PR/提交说明**

写清楚“6 人桌拖动窗口不遮挡”的验证方法，避免回归。

