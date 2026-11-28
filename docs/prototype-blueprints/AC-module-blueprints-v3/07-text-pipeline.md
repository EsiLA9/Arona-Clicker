# M07 DSL 文本接入、转换与编辑工具服务

## 1. 现有能力与设计目标

Story 已有 `StoryDef/StoryNodeDocument`、StoryEntry、`projectStoryDefinition` 和 `StoryAuthoringPatch`，执行由 StoryNodePlayer/StoryService 等真实服务完成。`stat-dsl.ts` 是统计表达式解析，`content-policy-dsl.ts` 是结构化条件/Effect 的验证与转换，`dsl-editors.ts` 是 UI 控件，并非正文语言。`node-clipboard.ts:copyStoryNode/pasteStoryNode` 已有结构化节点复制、插入与身份处理。当前缺少可替换的正文语言前端、源位置映射、文本文件读写和共同调用入口（A08、A09）。

**本模块建设的是语言生产管线和工具，不是正式 DSL 语法。** 后续一定会详细调整语法，可能改变标记、关键字、自然书写方式、文件扩展名、稳定节点表达。此次的明确目标是让新语言接入后自动获得全文与片段处理、校验、构建、渲染、保存、CLI 服务。保留 JSON 与 DSL 并行作为作者格式，同一实体有一个可写源；正文与 Entry 可以分别使用不同格式。未来其它领域也可以登记自己的文本前端，但不在本轮提前发明通用语言。

## 2. 结构改造与目标数据合同

所有格式前端都输出 M01 的定义记录和字段来源，JSON 解析也走共同格式接口。语言专属 AST/token/comment 由语言实现拥有，公共服务不读取具体语法树。Runtime 只读标准定义，不添加 DSL 分支。源映射从标准实体字段到实际字符范围，不能以行号替代 Story 节点 ID。

```ts
interface LanguageRef {id:string;version:string}
interface TextOrigin {packageRef?:string;path?:string;buffer?:string;textDigest:string}
type TextTarget =
  | {mode:'document'; expectedTables:string[]; defaults?:Record<string,unknown>}
  | {mode:'fragment'; owner:Owner; field:string; draftRevision:number;
     beforeLocalId?:string; allowedKinds?:string[]};
interface TextWork {language:LanguageRef; text:string; origin:TextOrigin;
  requestRevision:string; target:TextTarget}
interface FragmentCandidate {values:unknown[]; fields:Record<string,SourcePoint>}
interface TextOutput {
  requestRevision:string; status:'parsed'|'partial'|'failed'|'unsupported';
  content?: {kind:'definitions';rows:DefinitionRecord[]}
    | {kind:'fragment';candidate:FragmentCandidate};
  diagnostics:Diagnostic[];
}
interface TextEdit {range:TextRange; replacement:string}
interface LanguageFrontend {
  language:LanguageRef;
  capabilities: {document:boolean;fragment:boolean;format:boolean;generate:boolean;
    rewrite:boolean;completion:boolean;help:boolean};
  detect?(origin:TextOrigin,text:string):{confidence:number;reason:string}[];
  parse(work:TextWork):TextOutput;
  format?(work:TextWork):{edits:TextEdit[];diagnostics:Diagnostic[]};
  generate?(value:unknown,target:TextTarget):{text?:string;unsupportedPaths:string[]};
  rewrite?(work:TextWork,changes:DraftEdit[]):{edits:TextEdit[];diagnostics:Diagnostic[]};
  complete?(work:TextWork,offset:number):{range:TextRange;items:unknown[]};
  help?():unknown;
}
```

接口为原型推荐，能力与实际函数一致才可宣称支持。parse 的全文输出行使用每条独立 occurrenceId、真实 Owner、ordinal 和字段定位；片段相对输入框定位，提交后重新计算实际源位置。检测只提出候选，不自动宣称输入是某语言。项目显式格式/版本或用户选择优先；多个匹配让作者选择；不识别保留原文。构建只使用确定版本。默认生成的字段来源标记在实际默认配置，禁止伪造字符位置。

## 3. 公共文本处理服务

注册表按 id/version 管可用实现，`detect`、`parseDocument`、`parseFragment`、`format`、`generate`、`rewrite`、`complete`、`help` 由统一调度层提供。调用时检查能力与目的；不支持返回明确原因，不默认用另一语言。读取时输入固定字节和 source 配置，返回标准定义与语法诊断；共同 M02/M03 负责引用与结构/领域检查。前端可以知道需要何种目标，但不自己扫描全部项目并决定有效依赖。补全语言语法和公共字段候选分别产生，公共服务按位置合并。

结果以语言版本、原文摘要、请求版本、草稿版本及目标区分。旧异步结果不得覆盖已切换实例、改文、移动插入点后的状态。初版不需要 worker 或增量 Parser，实际性能达到瓶颈再做；输入法 composition 未结束不提交新结构或重建 textarea。作者保存保留原文，允许错误；格式化或生成提供差异和可表达范围，自动回写需再解析并比较标准语义和未支持字段。无法无损回写时结构视图只读、跳源或显式转换为 JSON，不建立相互覆盖的双向底稿。源格式切换必须将旧声明退出，避免编译产物被扫描成第二份源。

## 4. 三个实际工具入口

### 4.1 数据包扫描与构建

M01 对项目声明为 DSL 的文件调用 parseDocument；获得一个或多个标准定义，分开 Story 与 Entry。文件语法坏保留可读片段供作者浏览但阻断发行；其它文件继续检查。M03 不关心原文语法，使用同一目录、领域验证和旧包输出。JSON/DSL 转换可输出到新文件，明确丢失/未支持字段，不覆盖源。

### 4.2 现有编辑器片段输入

在明确允许结构化片段的 Story 输入区（如正文节点列表、新建/粘贴面板）提供自动识别提示及显式解析命令；普通对白输入不因冒号等字符自动被转换。接入现有剪贴板与 `pasteStoryNode` 的身份/插入能力：原始文本保留，检测语言 → 预览候选节点、诊断与目标 → 用户确认 → 重查目标及草稿版本 → 分配无冲突的实际节点 ID 并同步局部引用 → M04 一次批量插入/撤销。坏语法或局部结构不成立不提交；缺项目引用可以作为未完成草稿明确保留；拒绝时原始输入仍可编辑。普通结构化剪贴板继续支持。

### 4.3 沉浸式双栏编辑

复用 M05 实例与草稿服务，左侧正文编辑、右侧 M08 阅读/玩家试播/高级判定。左右栏独立滚动，选中节点与文本范围双向定位（源映射存在时）；实时解析在当前版本完成后只刷新必要区域。错误时保留原文和可读部分，若显示上次成功预览明确标旧版本，禁止假装当前可构建。右侧静态阅读不因文字变化重启运行中的试播，试播只有明确重开才使用新候选。支持保存、检查、格式化、转换、构建、试播命令，未支持的语言能力显示原因。CLI M14 调用同一解析器、转换、位置和诊断，不另写脚本语法。

## 5. 原型验证与正式语言设计边界

两种极小临时前端分别真正读取单行发言人/正文和分行发言人/正文。测试用输入如 `白子：你好。` 和 `[白子]` 加下一行正文，仅为试验格式。试验上下文明确提供合法 Story ID、节点 ID、起始 Area、发言人映射，正文必须来自实际输入。A/B 分别支持全文及片段；其它能力可明确未支持。改变为从未出现过的句子应得到不同标准节点并由 Runtime 显示；缺分隔/括号、空正文等非法输入产生真实字符位置；起始 Area 缺失为公共领域诊断而不是语法错误。CRLF、汉字、非 BMP 字符保持准确定位。关掉 A、只注册 B 时，编辑器、扫描、CLI 和构建不改公共业务逻辑。不得用两个固定 fixture 返回值冒充解析器替换实验。

复杂白子赴约、Flag/Transfer/Operation 等用真实 JSON 及标准模型验证 M08，临时前端不需要表达全部语义。正式语言未来以 [Story 语义证据](evidence/story-semantics.md) 为能力清单设计；现有不支持的音频、摄像机、任意等待等先确认真正执行合同，不用表面语法假装引擎已支持。

## 6. 建设阶段

M07-A：共同格式接口、真实 JSON 接入、两种最小文本前端与位置测试。M07-B：接 M01 扫描和 M03 构建，M14 只读 parse/check/to-json；以真正加载的单对白证明结果。M07-C：接 Story 剪贴板与 M04 插入动作、显式识别/确认、撤销和错误恢复。M07-D：实现双栏正文和 M08 阅读联动、格式化/转换能力入口；完整运行预览由 M08 独立交付。M07-E：提供语言接入文档、测试样本、可选能力和版本管理规则，未来语言设计只改前端与相关帮助/测试。

退出对象：各 UI/CLI 私有 DSL 解析、重复身份插入、直接读取具体 AST 的渲染代码（若施工中出现应消除）。现有 `stat-dsl`、StoryNodeDocument、Story 播放器和标准验证保留。正式语法、扩展名、版本迁移策略与自然书写方式不在本轮冻结。
