# 06-wiki/20-data-services/datapack-flow — 包内容流

本文回答声明内容从内置对象或导入文件到完整运行时定义集合的协作路径，并区分各阶段校验范围。

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

失败时，解析或目标校验会阻止应用；Apply 阶段由目标提供的 capture/restore 决定能否回滚已开始的 Runtime 写入。应用细节见 [[docs/docs-829/04-mechanisms/data-services/pack-loading]]。表和来源规则见 [[docs/docs-829/06-wiki/20-data-services/registry]]。
