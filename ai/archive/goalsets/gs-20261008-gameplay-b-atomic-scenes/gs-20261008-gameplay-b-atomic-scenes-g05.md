# G05：内容作者交付

## 对最终目标的贡献

数据包作者能在独立 Datapack Editor 中创建符合已定型 Scene 合同的内容，保存为运行时可导入的数据包，加载后通过通用 Operation 入口点击游玩并获得清晰的引用错误。原子场景从“能运行”进一步成为可持续创作的玩法。

此阶段只消费 G03/G04 已裁定并迁入的 Scene 内容合同，不另造场景模型。通用 Scene 流程不再依赖旋转木马或 Strategy Park 的地点 ID；Strategy Park 专属地图版式仍作为明确的内容表现保留。

## 完成定义

- [x] 独立 Datapack Editor 暴露最终 Scene 内容合同需要的字段，包括参与者、Action 来源、目标、Cost、完成条件和后续 Scene；作者无需修改 TypeScript。
- [x] 作者在编辑器创建两名学生、三个可选 Action 的小场景；结构化编辑、校验、ZIP 出口、PackParser/PackManager 导入、apply/reload 与作者 Event 启动均通过自动化往返；浏览器侧完成同一作者样例的编辑、校验和游玩。
- [x] 作者从常规 Operation 入口启动事件，完成 exact 2-of-3 行动批次并进入后续 Scene，提交复核行动。
- [x] 编辑器与 Registry 的 Operation 引用诊断覆盖缺失字段/ID路径；PackManager 校验失败保持当前 Runtime 不被替换，相关 authoring workflow 回归通过。
- [x] 在迁移与替代证据成立的范围内移除 Carousel Event 标题/说明回退和无用导入；旋转木马内容仍可从通用 Event 入口完整结案。无通用 View/内容替代的静态表现映射明确保留。
- [x] 交叉回归覆盖旋转木马、完整 Strategy Park 虚拟游玩、多 Scene、群体/位置目标、M 选 N、临时购买、控制器流程和 Save/Resume；浏览器实际检查 Carousel 结案、13 地点地图、Strategy Park 线索/凭证/分支路线及一轮战斗。
- [x] 不兼容内容仍由 Event `resumeVersion` 拒绝旧 Run checkpoint；Save/Resume 定向回归通过，无迁移层。

## 实际验收说明

- PB-25：13 个定向测试文件 / 102 项通过；浏览器在 In-app Browser 默认 1280×720 视口完成 Editor 结构化编辑与 Runtime 作者样例游玩。浏览器下载文件不能经当前 CUA 接口落盘回传；同一 Editor 数据与 `createDatapackPackage()` 导出面生成的包经 PackParser/PackManager 导入、apply/reload，自动化 EditorModel→ZIP→Runtime 集成测试补足实际文件往返。
- PB-26：14 个定向测试文件 / 149 项通过；浏览器实际完成 Carousel 成功结案，并在 Strategy Park 地图上走过出发简报、追踪行动、广播/维修凭证、服务亭分支、镜面迷宫与碰碰车战斗一轮。完整路线由固定 seed 虚拟游玩测试覆盖。
- 旧 Carousel 轨道、Fact、Item、Location、演员/行动原因映射没有通用 View/内容替代，按范围保留；Strategy Park 专属地图仍完整可见。
- 编辑器视觉节点画布、阵容选择器、通用 Narrative 与更大编辑器设计不属于本 Goal 完成条件。

## 依赖与边界

- 前置 Goal：G04 真实玩法迁移；前置 Task：PB-19～PB-24（Task 0269～0274）已经把对应内容迁到最终 Scene 合同并可从 Operation 游玩。
- Scene 的源数据形状、状态归属和持久化语义由 G03/G04 的裁定与实现决定；本 Goal 不预设 Scene 必须是独立 Registry 表，也不创建第二份 SceneDef。
- 明确暂缓：可视化场景节点画布、通用 Narrative 系统、单独 SceneManager、重做卡牌或结算 Runtime、历史存档迁移。
- Strategy Park 全地图是内容专属版式；保留其现有地图表现与测试，不把所有 Event/Location 特定表现都当成应删除的通用阶段特判。

## 会改变方案的未知项

- PB-13～PB-24 最终落地的 Scene 字段、引用目标和表宿主必须先冻结；PB-25 按该合同增加独立编辑器字段，不自行重命名或复制 Runtime 合同。
- 当前编辑器导出的单个 JSON 是否通过新增打包出口，或通过已有可识别的 Folder/ZIP 包路径进入 PackManager，须在 PB-25 中以实际可运行的完整往返验收关闭。
- 当前 Operation 入口只列固定示例；PB-25 需要为新作者内容提供通用、数据驱动且使用只读 Runtime 查询的启动入口。阵容选择器不在此阶段范围内。

## 正式文档入口

- Draft：[[draft-0255-gameplay-b-atomic-scenes-phase-v-authoring]]
- Task：[[archive/task-0275-pb-25-scene-authoring-and-validation]]、[[archive/task-0276-pb-26-remove-legacy-special-cases-and-regression]]
