# P1：把数据包拆开、合起来、按工作习惯整理

[分片与顺序构造](15-datapack-fragment-order-design.md)定义源行、回读次序、清单、单例与未知字段以及实际输出协议。

## 作者需要的是三项看得见的操作

假设作者收到一份只有 content.json 的旧包，要把世界、剧情、文本资料交给不同人编辑。他先导入副本，预览拆分或分组后将得到什么，选择输出到新目录。之后，从实体目录打开 scanner，作者只改它的一项资料并保存回原文件。几天后，他可以选几份文件合到一处，或构建一个可给别人使用的 ZIP。这个过程中在磁盘做的分组，不能改变玩家从哪看这个 Story、在哪个世界线可用，或 Map 节点指向哪个 Area。

首次接手时分清四种组织依据：

| 整理对象 | 服务什么 | 具体例子 |
| --- | --- | --- |
| 文件与文件夹 | 作者分工、审阅与保存 | 把白子 Story 放进 characters/shiroko 文件夹 |
| 编辑器实体分类 | 找对象和选择正确的编辑方法 | 同时从 Story 表、受引用列表或文件浏览打开一个正文 |
| 游戏内阅读目录 | 玩家查找和回顾 | Entry 的目录放置、系列或篇章，与源文件夹不同 |
| 游戏运行归属 | 选择入口、发生位置和资格 | Entry availableInits、Story startContext、Area initId、条件与投放 |

### 全拆，把一份文件拆成能编辑的文件组

1. 在工作台文件视图或 CLI 选一份完整 JSON、已有目录或已可读取的 ZIP。单 JSON 若没有发行 manifest，界面要求作者选已有项目或录入所需身份，不能从文件名造一个可发布包。
2. 选择按已有表拆，或按实体拆。按表时 areas、stories 等各自作为顶层 JSON 字段；按实体时每个文件仍有包解析器可识别的外层表字段。节点和选项仍跟着其整个 Story。AreaMap 的节点和边随地图，不产生独立可加载节点表。已知单例每种只保留一份，extras 保持表键。没有实体 ID 的记录按领域身份或与其表一起移动。
3. 预览包含根 manifest、name/version 来源、每份文件、分组规则、未处理对象、共享资产及文件名冲突。首轮目标为新目录。如已经存在同名输出，停止对它写入，能改目标再继续；任何路径不应越出目标。路径大小写兼容 Windows，同文件名或规范化后冲突同时显示两个对象。
4. 写入前再确认输入与预览一致。写完后用现有 `parsePack` 或对应 JSON/文本读取入口重新读出结果。比较所有有影响的字段和有序列表。资源看实际字节与可解析路径，不能只比较实体数。保持原输入可重做。

### 合一，分别说清 JSON 与 ZIP

**合结构定义。** 选几个 JSON 分片或整个项目，先看要合的文件、单例和元数据，以及哪些内容继续留在原处。输出仍是一个标准 Datapack JSON 对象，原有数组中的顺序根据明确规则保持。发生同一表同 ID 重复、单例重复或 extras 键冲突，列两处来源让作者决定；旧包导入时的优先行为要在转换报告里标出。选中范围之外的引用保留为引用，项目检查仍负责验证依赖，合一预览不能改未选择文件。

**生成发行 ZIP。** ZIP 根须含实际 manifest，可含多个 JSON 和资源。图片、音频和其他文件以独立条目保留或明确报告运行支持边界；不把资源塞成一个 JSON 大字符串。当前 `parsePack` 识别图片扩展名，不能据此认为所有音频都可在 Runtime 加载。P3 文本已有合格前端时，发行包使用其编译后的标准数据。试验或作者备份可另外保留文本源，明确它是源副本，避免构建器把 JSON 产物再次当成第二份定义。

**转换并保留源。** 如果选中 DSL 与 JSON 合一，作者选择“输出编译 JSON”。扫描到未完成文本、语言版本不可读或有不能表达的结构时报告原因，可保留文件独立。产物不回写原语言。如果作者想改成只维护新 JSON，另外走明确的所有权交换，比较并确认哪份旧源退出。

### 快速层级化，把定义按需要重新摆放

先选择按数据种类、Init/世界归属、受作者指定的角色或 Story 系列。每项写明使用什么信息得出路径。例如 Area 有明确 initId；一条 Entry 可在多个 Init，某 Story 也可能被多个 Entry 使用。多重归属进入待分组/共享区或由作者指定一处，界面列出理由，不取第一个匹配。角色分类优先作者显式映射，不能依据正文出现过的名字就移动。项目可以对个别实体改目标，所有引用路径变化在真正移动前显示。

预览采用“原文件 → 新文件”的清单和目录树。顺序应先写不冲突的目标目录、副本核对，再按需求处理原地整理；首轮全部使用新目录。移一张资产时先确定是否由包根相对路径、定义引用还是外部公开 URL 寻址。仅在可确定的包内引用中更新路径；跨未授权依赖显示阻断。完成后验证打开的是同一个 Entity ID，Directory 放置、世界归属、Entry 和实际播放仍可对照。

## 第一次做全拆，按这个例子核对

以下为对真实 Base 名称的建议输出布局，文件名是试验用。运行旧包装读取时需要根 datapack.json，以及分片中的 name/version；Base 的脚本现在把后者放 metadata.json。不同样本从各自的物理输入读取。

~~~text
base-test-copy/
  datapack.json
  content.json
  images/Hoshino.png

按表拆:
  datapack.json
  content/metadata.json
  content/areas.json
  content/areaMaps.json
  content/spots.json
  content/stories.json
  content/activeStories.json
  content/passiveStories.json
  images/Hoshino.png

按实体拆的示例:
  content/world/areas/schale_main.json    [外层字段 areas]
  content/world/areas/schale_rooftop.json [外层字段 areas]
  content/world/spots/credit_printer.json [外层字段 spots]
  content/story/shiroko_rooftop_invite.json [外层字段 stories]

按角色分组的示例:
  authors/characters/shiroko/stories.json
  authors/characters/shiroko/entries.json
  authors/world/schale.json
  shared/...
~~~

最后一种布局可以让多个定义同处一份 JSON，具体是否采用 authors 目录由作者选择。文件仍有正确外层字段。归类有额外作者配置时保留来源信息，并保证旧包导出中没有会被通读成 Datapack 分片的配置文件。不能为了改善目录，把现有 Story 的 initId、startContext 或 availableInits 顺便“修正”。[审计 A05](11-current-implementation-audit.md) 已列出同版本现实差异；R1 首先验证同一个输入经过转换保持自己的行为，再比较不同输入。

## 原地保存，怎么找到原文件

扫描每个定义时记录：所属项目或依赖、表或实体类型、按现有合同识别的身份、在文件中的对象位置、读到的原内容版本。P0 提供可解析结果和引用，P2 保存前向 P1 问归属。编辑测试 scanner 的真实字段可以先改 name 或 maxLevel，然后检查是否只修改 `datapack-dev/addition_test/00-world.json` 副本对应对象。不能任意把同版本 ZIP 的 baseCapacity 写入目录样本。存在外部修改时，先重读文件显示差异；原草稿保留。对不相交修改可给合并建议，用户确认后重新保存。

首轮普通编辑在用户授权的目录进行，一次替换一份文件，保存前校验基础字节，暂存结果并保留出错可读的副本。纯文本原样保存；结构化写回不得丢弃未编辑字段。多文件改 ID 比单文件保存复杂：输出具体修改路径、是否遇只读依赖、可能遗漏的动态引用，再显式执行；处理中断时保留修改清单、备份和当前结果。必要时先限定在可丢弃的副本，用真实中断演练后决定是否需要锁、持久恢复日志和文件身份。外部直接用编辑器改文件时不存在跨工具的天然隔离。

## 建设从真实入口开始

- `src/data-services/datapack/source.ts:FolderPackSource/ZipPackSource` 接读来源，`pack-parser.ts:parsePack` 验收一次旧包读取。继续支持旧包扫描规则，作者目录中另记录支持格式和文件，请勿要求旧入口把任意 JSON 当作者配置。
- `fragment-parser.ts:DATAPACK_LIST_FIELDS/DATAPACK_SINGLETON_FIELDS` 给首批分类基础。 `mergeFragments` 对列表拼接、单例和 extras 覆盖。按这个旧行为做只读对照，明确新转换在哪些冲突要求人确认。 `scripts/base-datapack-export.mjs:exportBaseDatapackFolder` 是按表分片真实样本；先复用分片书写和资源复制证据，再提取共同输出。
- `tools/datapack-editor/ui/io.ts:fileInputImport/createDatapackPackage` 是第一条可见消费者。界面和 CLI 对同一输入都调用相同预览和转换。出发时两者可以分别使用浏览器文件选择和本地路径，但输出结果应等价。R3 之后共同构建接现有 Runtime。
- `tests/data/datapack/{pack-parser,fragment-parser,base-datapack-folder-export,addition-test-pack}.test.ts` 用来确认现状。新增验收依次做：两种全拆 → JSON 全合和选择式合一 → 三种层级组织 → 再合一对照 → 真实保存。每步拍可读清单并重新解析。另测试根/分片 name/version 不一致、大小写输出名冲突、多归属、未知字段、坏文本、资产路径、外部写入、误写只读依赖。
- 首轮以表/现有 ID 加来源通常足够。是否需要单独作者 manifest、永久文件身份、同实体多文件协作和依赖锁，由[决定 D03、D04](10-decision-register.md) 的实物试验确认。相关交付顺序见 [R1/R3](09-construction-roadmap.md)。三项可见操作通过后，才扩大到多个作者之间的自动改名与合并。
