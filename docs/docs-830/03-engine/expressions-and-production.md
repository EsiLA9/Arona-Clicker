# docs-830/03-engine/expressions-and-production — Value、Extra 与 GameNum

本文回答：定义中的数值表达式如何读取状态，生产系统又如何组合并缓存产出。

## Value 与 Extra

`ValueSystem` 求值声明式表达式树：常量、算术、取整、夹取，以及读取资源、Spot、区域、管理角色、Extra 或 Funclet 的 Value。除零结果为 0；缺失定义或未知 source 回落到 0。Funclet 从 Registry 注入，仍由同一 Value 求值器解释。

Extra 是带类型标签的树形数据（标量、列表和字典），通过路径读取。合并时字典递归合并，标量与列表整体由新值替换；路径读取可将缺失值返回为类型缺省。Value、Condition、Datapack 常量与 Runtime 状态通过共享 Extra 类型和读取函数协作。

### 从值到表达式

一个资源 Value 从当前状态读取指定资源数值；表达式可以在它外面组合加减、乘除、取整或上下界。ValueSystem 是只读求值：求出数字不意味着资源已经到账。除数为 0 返回 0，缺失的资源或 Funclet 也可能得到 0；排查结果为 0 时应同时核对数据源和表达式，而不是只看算术运算。

Extra 的 `int`、`float`、`str`、`bool`、`list` 和 `dict` 都是带类型的节点。例如测试中 `extra.int(3)` 产生 `{ t: 'int', v: 3 }`；路径 `inv/0/name` 可用于访问嵌套列表中的字段。合并时字典递归而列表整体替换，不会逐项拼接。例子和路径约束见 `tests/engine/core/extra.test.ts`。

## GameNum 生产计算

`GameNumSystem.buildAll()` 依据 Registry 定义、当前状态与 Affector 贡献，为资源构造分层表达式树：Init、Area、Spot 的基础产出、固定增量、乘区及 flows 在对应层级组合。TickSystem 读取资源树求值产出，再经状态写入服务增加资源。

生产树带有父子索引和资源依赖。资源变化只让读取该资源的 gain、zone 或 flow 子树失效；Spot 等级、标签、管理角色、Extra、Enhancement 和 Affector 激活集变化则更新相应区表或缓存。Registry 整体重载会重建生产树；单 Spot 内容热改可定向替换该 Spot 子树。普通 Tick 不必重新解析所有定义。

GameNum 负责计算结果，不直接提交 PlayerState。`ValueSystem` 为表达式提供通用求值；GameNum 再补充按世界层级组织的产出规则和增量失效。

## 例子：一台据点的产出

`tests/engine/core/game-num.test.ts` 的 `primitiveGain is lazily evaluated per tick for a resource` 将测试状态设置为只拥有一个 `credit_printer`：在该测试数据和条件下，基础 5 加功能 2，`evaluateResourceGain()` 得到 7；随后 `game.tick()` 将 7 加入 credit。这个数字依赖测试包和测试状态，不是所有同类据点的固定值。

从调用方看，求值与结算是两步：

```text
定义 + 当前状态 + Affector 贡献
  → GameNumSystem 求 credit 的 primitiveGain（例：7）
  → TickSystem 将正产出交给状态写入服务（例：余额增加 7）
```

生产树可跨帧缓存：资源或功能变化通过事件使相关部分失效，再在后续查询时求值。手动直接改写状态会绕开正常事件路径；如需检验实时刷新，应使用状态写入服务并参照 `tests/engine/core/game-num-invalidation.test.ts`。

## 排查数值差异

先确认目标资源是否注册，以及相关 Spot 是否已拥有；再分别核对 Value 输入、Active Affector 的 flow / 乘区、管理角色或标签等条件。若写入后页面或计算值未更新，检查变更是否走了事件和定向失效路径。产出计算与具体更新规则还受到 [[affectors-and-contributions]]、[[session-and-tick]] 的影响。

源码：`src/engine/expression/value-system.ts`、`game-num.ts`、`game-num-build.ts`、`game-num-eval.ts`、`src/engine/extra/`、`src/arona-clicker/runtime/runtime-wiring.ts`。测试：`tests/engine/core/value-system.test.ts`、`tests/engine/core/game-num.test.ts`、`tests/engine/core/game-num-invalidation.test.ts`、`tests/engine/core/extra.test.ts`。

Tick 产出调用链见 [[session-and-tick]]；条件表达式见 [[conditions-and-visibility]]。
