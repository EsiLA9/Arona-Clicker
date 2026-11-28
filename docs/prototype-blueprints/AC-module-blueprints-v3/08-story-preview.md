# M08 Story 作者阅读、玩家试播与高级判定服务

## 1. 现况和建设原因

`GameInstance.previewStoryWithContent` 与 `createStoryAuthoringPreview` 已有隔离候选播放，现有 `StoryAuthoringPreview` 可读取 view/story/projection/sendState/decisions，执行 decide/advance/close；`StoryPreviewConditions` 支持 entry/choice/transfer 等判断和人工选择。当前工具偏向实际走一条剧情路线，不能据此得出所有分支的作者阅读结果；隔离初态、通用轨迹和与源位置的关联尚需扩展。审计 A08/A09、原第三轮 12/18 给出真实样例和入口。

目标不是重写 Story 播放器，而是建设三种输出，分别负责静态阅读、真实临时执行、静态声明和实际执行之间的对照。它们消费同一标准 Story/Entry，不读取 DSL AST。提供 M05/M07/M14/M13 可共同使用的服务。

## 2. 现有运行合同必须完整保留

Story 正文是有序节点，StoryEntry 是玩家资格/投放/奖励，运行会话是本次游标、局部标记及实际状态。六个当前顶层节点为 talklet、click、operation、transfer、moveToArea、moveToCharaspace；准确 discriminator 以源合同为准。完整能力与现有测试路径见 [证据页](evidence/story-semantics.md)。重要语义包括：Choice 的 showWhen 持久条件与 requiresFlag 存在检查（false/0/null 也存在）、marks 组互斥；Operation 实际参数和作用域；goto/insert 与返回；Entry fallback/random/affection、完成奖励、目录、followUp；entryCard.continuation 的实际父子 Entry、Area 赴约与允许回传的 Flag。旧 stages 不得当作现行等待语义；旧 kizunaCard 作为兼容回归。读档、重读与作者试播分开。

## 3. 目标数据结构和服务接口

```ts
interface StoryLocation {
  storyId:string; nodeId?:string; optionId?:string; actionPath?:string;
  source?:SourcePoint;
}
interface AuthorReadNode {
  location:StoryLocation; kind:string; presentation:unknown;
  declarations:{kind:'condition'|'flag'|'effect'|'transfer'|'entry'|'movement';value:unknown}[];
  children:AuthorReadNode[]; link?:StoryLocation;
}
interface PreviewInput {
  inputRevision:string; artifactDigest?:string;
  entryOrStory:{kind:'entry'|'story';id:string}; initId:string;
  initialStateRef:string; seed?:number; mode:'player'|'author-debug';
}
interface PreviewTraceStep {
  sessionId:string; sequence:number; entryId?:string; location?:StoryLocation;
  kind:'enter'|'choice'|'condition'|'operation'|'transfer'|'travel'|'return'|'end'|'error';
  declared?:unknown; actual?:unknown; adopted?:unknown;
  result:'passed'|'failed'|'executed'|'rejected'|'unknown';
  manual?:boolean; reason?:string;
}
interface PreviewResult {
  status:'ready'|'rejected'|'ended'|'cancelled'; input:PreviewInput;
  sessionId?:string; diagnostics:Diagnostic[]; trace:PreviewTraceStep[];
}
```

`initialStateRef` 由预览宿主解析为新档、明确测试状态或只读正式存档副本，初态必须符合 Runtime 合同；不支持的注入直接拒绝，禁止偷偷补资源或资格。seed 仅在实际可控制随机源时支持并记录，否则报告不可重复的来源。sequence 用于同节点多次执行与父子续接，不能以节点 ID 覆盖历史；source 从对应构建/草稿版本的来源映射取得。

### 3.1 静态作者阅读

`readStory(inputRevision,story/entry,options)` 生成 AuthorReadNode 树/链接。按正文顺序呈现所有节点及全部选择，条件、Flag、Effect、跨 Story 跳转都作为声明展示。可展开目标正文，循环/重复引用用链接与有限深度，不能无限递归；保留原始程序顺序，不声称每个分支均可达到。Choice 选项与后续受 Flag 控制节点的关系只能从实际条件/标记分析得出，不可仅凭相邻正文分组。未知动态分支显示不确定。部分合法文本可显示带诊断的结构，未识别内容保留源范围。

### 3.2 玩家试播

`startPreview(input)` 从 M03 已检查候选或产物装配隔离 GameInstance，使用真实 Entry 和初态测试实际资格、等待与执行；直接 Story 试播若需要临时 Entry 或改变 replayable 明确记录。提供 advance/choose/decide/getView/getTrace/close，调用原服务，不重新实现 ConditionSystem 或 StoryNodePlayer。真实玩家模式不自动放行失败条件。作者调试模式允许现有受控人工判定，记录 actual 和 adopted，不把人工结果算实际通过。取消/错误/退出释放隔离实例；源更新只标旧版本，显式重新启动才读新候选。真实存档、包选择、全局 UI 状态不写入。

### 3.3 高级判定

静态目录与运行 trace 按 Story ID、nodeId、optionId/动作路径、session/sequence 关联。未执行的分支仍可阅读，但标“未执行”；无法求值的标“未知”；当前测试状态求值只能显示对应检查点。已执行动作从真实宿主回执/事件取得，不能把声明意图画成已发生。将持久 Flag、局部 Flag、权限、状态变化和视觉演出分别列出。若现有宿主未提供某动作结果，给它补真实可观察回执，不能在 UI 或 CLI 中复算另一套状态。结果可导出同版本的文本/JSON 报告，供 M13 审阅。

## 4. 具体 UI 和迁移对象

M05/M07 右栏提供作者阅读、玩家试播、高级判定三个视图；共用可点击源位置、Story 表现组件和定义读取。作者阅读有全部正文、分支树/链接和折叠；试播保留现有播放界面、等待按钮和临时栏生命周期；高级判定显示实际状态/路径、每项条件及采用值、声明/动作结果。切换阅读/高级判定不改变正在运行的会话，显式重开才重新测试。已有 `preview-view.ts`、`previewStoryWithContent`、`StoryPreviewConditions` 迁为公共预览端口的实际消费者，不再为 CLI、导入工具做三个独立沙盒。

## 5. 建设阶段与验收

- M08-A：静态作者阅读基于真实 Story JSON，覆盖全部节点、Entry、Flag、引用、跳源；可在 DSL 实现前开发。白子父/子、天台两个分支和循环/坏引用为样例。
- M08-B：现有临时试播适配，明确固定候选、初态和真实 Entry。白子 `base:story:shiroko_rooftop_invite` → `base:activestory:shiroko_rooftop`，到实际天台、两个分支分别执行、允许列表回传、父继续，保存恢复和取消。用实际 bundle 固定样本，不混用有差异的 Base 分片。
- M08-C：高级判定作为独立交付，做六类选项：无条件、hasEnh 成立/不成立、空 OR、局部 Flag 存在/缺失、Operation+insert。用不同初态、真实输入和人工放行分别取得可追踪结果；未走分支仍可读。测试缺目标、非法游标、重复通知与状态隔离。
- M08-D：接双栏和 M14，返回可复查 trace；所有旧预览入口消费同一适配，实际行为不减少。复杂场景按 [语义证据](evidence/story-semantics.md) 扩展，不以少数对白通过代替完整预览。

回归入口 `tests/engine/story/{story-continuation,story-node-playback.integration,story-node-save.integration,story-reward-receipts,story-replay}.test.ts` 和 `tests/ui/story/story-editor-authoring.test.ts`。正式游戏和存档在所有试验前后保持不变，作者源可独立保存。高级渲染不是单纯“加更多日志”，必须可实际浏览与定位。
