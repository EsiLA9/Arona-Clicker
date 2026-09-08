# 05-conventions/refactoring — 重构规范：拆分纪律

> 本文定义本项目的代码拆分规范：何时拆、如何拆、验证流程。

## 何时拆

- 文件 > 400 行：考虑职责拆分为多个文件；
- 职责混合（如曾把构建 + 求值 + tag 维护塞进单文件）：按职责切分；
- 测试文件 > 500 行：按被测试模块同步拆分；
- 引擎或关键数据结构的本体与关键循环、集成完毕的服务可留在单文件，较大的底层服务与枚举功能各自拆出到对应文件夹内。

## 如何拆

### 1. 拆前分析

- 用 LSP/引用分析确认每个移动符号的完整调用点；
- 标记「可移动符号」与「跨文件依赖」的边界。

### 2. 拆时原则

- **纯移动代码不改行为**：改可见性不改变功能逻辑；
- 拆出的模块为同包私有实现，对外保持原导入路径不变（re-export 兼容层）；
- 模块函数签名：需要访问宿主私有字段时，将字段可见性改为 `public`（标注 `@internal` 或 `/** 内部实现，供拆分模块访问 */`）；
- 跨文件引用用 `import type` 避免运行时循环依赖。

### 3. 拆后验证

- `npx tsc --noEmit` 零错误；
- `npm test` 全部通过（行为零变化）；
- 若动了 `src/engine/types/`：`npm run gen:schema` 同步协议（见 [[docs/docs-828/05-conventions/schema-sync]]）。

## 常见模式

### 瘦身门面（controller.ts / game-num.ts 等）

```typescript
// 宿主类保留方法签名，一行委托到模块函数
export class FooSystem {
  /** @internal 供 foo-bar 模块读写。 */
  items = new Map<string, Item>();

  doSomething(): void {
    doSomethingImpl(this);
  }
}
```

```typescript
// foo-bar.ts — 拆出模块
import type { FooSystem } from './foo';

export function doSomethingImpl(system: FooSystem): void {
  // 实现逻辑，通过 system.items 访问
}
```

### re-export 兼容层（如 `types/entities.ts`）

```typescript
export * from './world';
export * from './content';
export * from './trigger';
```

## 不做的

- 不做存档迁移（架构纪律 8，见 [[docs/docs-828/05-conventions/architecture-discipline]]）；
- 不改公共 API 签名（构造参数、公开方法名、事件类型）；
- 不改 tick 热路径（求值/事件派发）的调用序列；
- 不引入新依赖或重构框架。

## 目标结构

拆型后单文件 < 400 行，职责单一，测试文件按模块镜像（`tests/engine/` 与 `src/engine/` 对应）。

## 相关文档

[[docs/docs-828/05-conventions/testing]] · [[docs/docs-828/05-conventions/doc-maintenance]]
