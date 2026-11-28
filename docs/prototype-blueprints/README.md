# AronaClicker 原型蓝图评审入口

当前交付是可供评审的原型规格。说明作者或玩家实际做什么、现有入口如何接、失败保留什么和如何验收。参与者无需读过前期对话。项目正处在设计评审阶段，后续实验和施工依照 [Task 0429](../../ai/plan/task-0429-prototype-architecture-blueprints.md) 独立确认。

## 第一次接手，从哪里读

先读[总体设计](00-system-architecture.md)了解 Init、Area、Spot、地图、Story 与 Entry 的区别。选中自己负责的一页先走正文的完整使用故事，然后查[共同工作规则](08-cross-system-contracts.md)了解文件、草稿、构建与游戏应用。原代码和数据从[现状审计 A01–A17](11-current-implementation-audit.md)定位，涉及源码施工的第一步再读确切路径和直接测试。

| 要做的工作 | 规格 |
| --- | --- |
| 从一条失效引用回到真正字段，并生成可用包 | [P0 内容检查、构建及应用](01-content-pipeline.md) |
| 把大文件拆分、选几份合并、按角色或世界整理 | [P1 多文件项目组织](02-datapack-project.md) |
| 从地图读到设施、共同编辑复杂条件、看谁引用了我 | [P2 作者工作台](03-authoring-workbench.md) |
| 用两个可互换的前端做片段输入、左文右读和隔离试播 | [P3 文本生产工具](04-story-dsl-and-compiler.md)和[已有 Story 能力与试播对照](12-story-semantics-and-preview.md) |
| 让玩家实际找到地点、取得资料、认识人物和获得后续内容 | [P4 现有实体玩法](05-gameplay-prototypes.md) |
| 把原文、资源和用户入口做成可校对的内容 | [P5 内容还原](06-content-restoration.md) |
| 从终端查已有对象、修改一次、自己改错并试播 | [P6 作者与 Agent 工具](07-agent-toolchain.md) |

## 构造设计与施工交接

本轮针对第二轮评审提出的构造缺口。先由 P0–P6 了解作者和玩家怎样操作，再到 R0–R10 看依赖与交付。下列构造页写首个服务怎样构成，实际 Task 在负责人批准后登记。已写的施工草案提供输入、源码入口、调用方、迁出和验收。

| 需要落实的设计 | 直接入口 |
| --- | --- |
| 项目读取、定义身份、来源、诊断、编辑、构建和试播使用哪些共享数据 | [作者服务最小合同](13-authoring-service-contract.md) |
| 结构规则、引用登记、正反向查询、三包依赖/覆盖和构建 | [共同检查与构建](14-datapack-validation-and-build-design.md) |
| 跨文件拆分后按原次序合回，预览单例、未知字段和实际输出 | [分片与顺序](15-datapack-fragment-order-design.md) |
| 首个工作台的会话、文件存储、条件树及有序动作怎样接 | [工作台及复杂字段](16-workbench-session-and-structured-editing.md) |
| 全部 Datapack 表的入口、字段、复杂编辑及领域操作 | [实体编辑能力](17-entity-editing-coverage.md) |
| 语言版本替换、真实解析、三种预览及高级判定 | [文本接入与预览](18-story-text-and-preview-design.md) |
| 现有实体能怎样组合，哪些活动需要补能力 | [实体玩法和活动](19-gameplay-capabilities-and-activities.md) |
| 可交给施工者的三个首批样本 | [R1、R2、R5 待评审施工草案](20-first-implementation-task-drafts.md) |

## 评审和开工

- 先看[R0–R10 交付批次](09-construction-roadmap.md)，每批以用户实际可完成的任务命名。文件组织与共同检查可同时准备；P3 临时前端、P4 既有 JSON 与 P5 合法样本可用各自实物并行。正式语言及原版内容的资料确认各自安排。
- [决定 D01–D12](10-decision-register.md)区分可逆实验与负责人要选的长期方案。[第一轮技术备选](technical-notes-v1.md)保留原类型、版本、锁和事务，按实际需求取用。
- [立项输入](scope-brief.md)说明大方向。[V2.1 上层复核指令原稿](AC-prototype-review-v2.1/09-本地Agent复核及重写指令.md)用于追溯语言和原型方向。当前应用规格以本目录 P0–P6 及用户最新裁定为准。V2.1 是参考稿，和现状审计分别发挥作用。
- [跨会话工作流](../../ai/guide/prototype-blueprint-workflow.md)与[调查／修订提示词](../../ai/guide/prompts/prototype-blueprint-review.md)说明如何将下一步写成新人可执行的文档，并保存核验进度。

正式施工前要分辨真实输入版本。Base 运行 bundle 与分片在 Story/Entry 等字段有实际差异，addition-test 的目录和同版 ZIP 也不同。选定行为对照与正式迁入值分别处理。
