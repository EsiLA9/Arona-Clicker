# 06-wiki/20-data-services/datapack-flow — 包内容流

本文回答声明内容从内置对象或导入文件到完整运行时定义集合的协作路径，并区分各阶段校验范围。

先区分两种来源：正式内置 Datapack 可以由程序直接提供；外部 Datapack 则先从文件夹或 ZIP 解析成 Datapack 对象与图片资源。两种来源会在包管理/Runtime 装载阶段汇合。这里的“启用集”是本次要交给 Runtime 的包列表，“顺序”会影响同 ID 定义由谁覆盖。

```text
文件夹 / ZIP → PackSource → manifest + JSON fragments + images
                            → ParsedPack
内置 Datapack ─────────────────┐
ParsedPack → PackManager 记录 / 选择 → 完整候选启用集
                                      → validate(datapacks)
                                      → Runtime reload → Registry + 图片登记
```

解析器处理容器格式和分片，把文件侧内容变为 `Datapack` 与图片资源；内置内容可直接以 Datapack 进入管理器/Runtime 路径。`PackManager` 处理包身份、版本记录、顺序、依赖、启用集与 Runtime Apply。Runtime target 负责实际重载内容并管理图片登记。

校验分层：解析器检查 manifest、JSON 和分片；Registry 检查重复 ID、ID 形态及引用。Init/Area/Spot 等部分关系可依据已加载 Registry 和当前包内容解析，因而完整启用集顺序加载可支持这些关系。另有字段明确只检本包，例如 `Area.defaultSpots`。包配置还独立校验 manifest 依赖、唯一 modName 和内置包约束。通过单包校验不能推导完整启用集均有效，完整集也不扩宽字段自身规定的引用范围。

失败时，解析或目标校验会阻止应用；Apply 阶段由目标提供的 capture/restore 决定能否回滚已开始的 Runtime 写入。应用细节见 [[pack-loading]]。表和来源规则见 [[docs/docs-829/06-wiki/20-data-services/registry]]。

## 从哪里核对

- `src/data-services/datapack/pack-manager.ts` 的 `applyRuntimePlan()` 将有序启用包交给目标校验；`applyDatapacks()` 执行 `reload()`、清理旧图片和登记图片。仅当目标提供 `capture()` 与 `restore()` 时才尝试恢复 Runtime 检查点。
- `src/data-services/registry/registry.ts` 的 `Registry.load()` 检查当前包和已登记定义后再合并；`Area.defaultSpots` 的同包限制属于字段自己的规则。
- `tests/data/pack-manager.test.ts` 的“按启用集顺序应用到 Runtime，并按 manifest modName 登记图片”“预校验失败时不 reload、不触碰图片资源”“草案应用 reload 失败时保留旧正式启用集”验证阶段先后和拒绝/回滚边界。
- `tests/engine/registry.test.ts` 的“should reject broken references”验证 Registry 的缺失引用拒绝；`tests/data/runtime-content-browser.test.ts` 的“详情返回安全克隆，不暴露 Registry 原对象或写入口”验证内容浏览查询不会交出写引用。
