## Texas Hold'em（德州扑克）

一个基于 **Vue 3 + TypeScript + Vite** 的德州扑克项目，使用 **Pinia** 做状态编排；核心规则/结算/胜率等逻辑放在纯 TS 引擎层，方便测试与复用。

## 快速开始

```bash
npm install
npm run dev
```

然后在浏览器打开终端里提示的本地地址。

## 常用命令

```bash
# 本地开发（Vite）
npm run dev

# 单测（Vitest）
npm test

# 类型检查 + 构建
npm run build

# 预览构建产物
npm run preview
```

## 目录结构（关键部分）

- **`src/engine/`**：纯 TypeScript 业务引擎（不依赖 Vue/Pinia/DOM）
  - **`src/engine/game.ts`**：牌局流程/状态机相关核心逻辑
  - **`src/engine/sidePot.ts`**：分池逻辑
  - **`src/engine/handEval.ts`**：牌型评估
  - **`src/engine/equity.ts`**：胜率/权益计算
  - **`src/engine/__tests__/`**：引擎单元测试
- **`src/stores/`**：Pinia 状态编排与副作用（如 AI 回合、胜率重算等）
- **`src/components/`**：纯展示组件与交互触发（不直接改引擎内部状态）

## 代码约定（分层边界）

为了保证可维护性与可测试性：

- **引擎层（`src/engine/**`）**：保持纯函数/纯 TS 逻辑，避免耦合 UI 与状态管理。
- **Store 层（`src/stores/**`）**：负责把 UI 事件映射为引擎调用，并处理异步/副作用。
- **组件层（`src/components/**`）**：只负责展示与用户交互，不直接“伸手”修改引擎内部状态。

## 贡献与验证

涉及 **规则/结算/分池/行动顺序** 等引擎改动时，务必同时：

- **补充/更新 Vitest 测试**（通常在 `src/engine/__tests__/`）
- **运行 `npm test` 与 `npm run build`**，两者通过才算完成

