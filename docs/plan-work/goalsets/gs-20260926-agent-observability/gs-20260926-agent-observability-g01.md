# G01：操作后状态结果切片

## 对最终目标的贡献

让 Agent 在受支持操作完成后，以统一方式取得操作结果、状态前后差异和现存运行日志，得到小而可信的调试上下文，减少临时调试脚本与整状态倾倒。首期不依赖 DOM 或浏览器自动化。

## 完成定义

- [ ] 可发现当前支持的操作、目标、输入范围与证据类型；不支持的操作返回明确原因。
- [ ] 至少一个受支持操作能提供操作前状态、操作结果、操作后状态及有界差异，并支持指定目标/字段的细节展开。
- [ ] 可附带该操作窗口内现存 DevLog；缺少可靠 operation/capture ID 时明确标记 unlinked，不按时间接近推断因果。
- [ ] 每份结果包含 capture/operation 身份（缺失则 unknown）、代码/内容身份或明确 unknown、frame、目标、来源、完整性和一致性声明；本阶段不要求 UI surface generation 或 DOM。
- [ ] 默认输出有界摘要，支持指定字段、实体、帧窗和深度；详细内容分页读取，明确 omitted/truncated/dropped，不将遗漏当作不存在。
- [ ] DTO 与内部可变对象隔离，正确表示 Map/Set、特殊数值及不可序列化值；不执行 getter、不嵌入图片字节、不暴露运行时对象句柄。
- [ ] 至少一个代表性操作能由一次摘要查询与一次展开定位到状态变化和源码/定义路径；读取结果不重放操作、不触发业务 mutation、事件、UI render 或随机消费。
- [ ] 明确报告各来源采集的时间/帧与一致性级别；DevLog 容量或日志截断不作为完整历史。UI refresh ring 属于后续浏览器/UI阶段，不作为 G01 准入条件。

## 依赖与边界

- 前置 Goal：无。
- 首期只复用现有安全读取和可取得的操作前后状态，保留 DevLog 来源标签；缺少因果 ID 或逐项贡献时直说未采集。
- `GameView` 多数容器会复制，但 `currentStory` 内 `page.kizuna` 与 active Affector `activeEntryIdSet` 仍有嵌套引用；不要将原对象直接序列化或交给 Agent。
- 当前 GameNum `evaluateWithBreakdown` 会先走会更新缓存的正常求值，然后再次展开节点；不能直接满足严格只读承诺。先展示已记录结果或隔离副本求值，具体方法由 Draft 核对裁定。
- 建议摘要预算为 8 KiB、单页详情 64 KiB，作为待校准的工程目标；UTF-8 字节数由机器计数，token 估算须单列。预算超出显式截断并给续读入口。
- 首期不要求 Workspace/Host、DOM、theme/CSS、截图、浏览器连接或 UI refresh ring；这些转入 G02，待浏览器连接稳定后施工和验收。
- 本阶段暂缓：新增通用事件追踪、统一场景回放、大型诊断 UI、MCP 服务和所有领域适配。

## 会改变方案的未知项

- 产品/架构待裁定：查询入口的组合层位置、开发构建开启方式、身份和错误码契约。
- 本地源码待核对：受支持操作前后状态的可靠采集点；哪些查询会更新缓存或惰性构建；Runtime 与内容 revision 的一致性边界；无需触发 render 的采集时机；Set/Map/undefined/循环值的规范化和序列化规则。
- 连续运行时跨层读取如果不在同一稳定边界，应报告各层采集时刻和 mixed 状态；不得无证据称为原子快照。

## 正式文档入口

- Draft：[[draft-0159-agent-observability-query-contract]]。
- Task：[[task-0160-agent-operation-result-slice]]。
