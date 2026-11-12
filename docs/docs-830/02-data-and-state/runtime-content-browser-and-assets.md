# docs-830/02-data-and-state/runtime-content-browser-and-assets — 内容浏览与图片资源

本文回答：Runtime 如何只读浏览已装载定义，并把包内图片引用解析成可显示资源。

## RuntimeContentBrowser

`RuntimeContentBrowser` 从当前 Registry 的定义 getter 建立只读快照，列出内容类型、来源包、条目数、名称和描述，并提供定义详情、字段树及引用关系查询。引用诊断覆盖定义间及 Operation 内容引用，可返回 resolved、missing 或 ambiguous 状态；候选引用与明确声明的引用会保留不同来源信息。

```text
Registry getter + 补充的 Affector / Trigger 定义
  → 计算快照指纹 → 构建只读目录与引用索引
  → list / detail / references 查询
```

浏览器不写 Registry 或 PlayerState，也不替代编辑命令。快照在 Registry 内容变化时按指纹重建；若 Affector / Trigger 补充源提供 revision，可用 revision 判断是否需重新读取条目。输出为冻结的查询视图和克隆后的原始详情，供开发工具检索、诊断及查看引用，不作为运行时业务数据的写入口。

## PicService 与 ImageStore

`PicService` 围绕 Registry 中的 `PicDef` 提供 `defOf()`、`list()` 和 `urlOf()`。`urlOf()` 接受 Pic 引用，先按 ID 找到定义，再按 `PicDef.src` 解析：定义中的普通 URL 可直接返回；包内 ZIP 路径则按图片定义所属 mod 查询 `ImageStore`。原始 URL 直接作为 `urlOf()` 的引用输入不会透传。`ImageStore` 以 mod 和包内相对路径登记图片 URL，支持按包清空和批量登记。

包解析器把支持的图像条目转换为 Data URL；Runtime 应用包时清除旧图像并登记目标包图片。PicDef 描述图片语义和来源，ImageStore 提供已加载的二进制资源地址，两者共同完成呈现查询。

### 例子：定义存在但图片不显示

先检查调用方传入的是否为合法 Pic 引用，以及 Registry 的 `PicDef` 是否存在。若定义使用包内 ZIP 路径，还要检查该 mod 和相对路径是否已登记在 ImageStore：只有定义、没有对应图片条目时，解析结果仍是 `undefined`。若定义的 `src` 是普通 URL，则不走 ZIP 图片表。`tests/engine/theme/pics.test.ts` 分别覆盖未声明引用、未登记 ZIP 图片和直连 `src` 的结果。

内容浏览器的引用诊断与图片资源解析也不能混为一谈：前者帮助查看定义之间的关系和缺失引用；后者解决图片定义最终映射到哪个 URL。

源码入口：`src/data-services/registry/runtime-content-browser.ts`、`runtime-content-reference-rules.ts`、`src/data-services/assets/pic-service.ts`、`pic-resolver.ts`、`image-store.ts`、`src/data-services/datapack/pack-parser.ts`。测试见 `tests/data/runtime-content/runtime-content-browser.test.ts`、`tests/engine/runtime-content/runtime-content-browser-rules.test.ts`、`tests/engine/runtime-content/runtime-content-browser-published-content.test.ts`、`tests/engine/theme/pics.test.ts`。

继续阅读：[[datapack-and-registry]]、[[read-model-and-ui]]。
