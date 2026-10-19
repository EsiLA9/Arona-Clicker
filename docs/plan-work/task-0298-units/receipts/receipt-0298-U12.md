# Receipt 0298-U12

- 状态：作者合同与静态校验完成，尚未完成 Owner 运行支持，不宣称新效果已可用。
- 定义：Action target 增加 card 与来源相对 side，cardEffects 声明正安全整数 scostDiscount；没有左右规则或几何出入点。现有 HP / target-resource effect 不会误用卡牌目标。
- 校验：正常定义通过；错误 side（含数组伪装字符串）、空效果、无效减免量、任意资源 / PlayerCost 减免字段、HP 混用等拒绝。新测试先暴露旧枚举错误文本断言，已按新合同更新其预期，未移除校验。
- 实际验证：Registry 120 项与 Schema 同步 10 项，共 130 项通过；`npm run gen:schema` 正常生成协议（未手改），`npx tsc --noEmit` 通过；`npm run check:docs` 910 篇、0 errors，差异检查通过。
- GALHCG：六个直接路径只读核对，Registry 与 Runtime contract 2 / 2 owner；生成协议分页 7 / 7 owner；其余无直接 Evidence / maps_to。不写图 / freshness。
- 余项：行动 resolver 尚未启用 card target，未向正式样例加入该行为；后续接入具体卡牌目标、scost 减免、保存和真实 Commit 后才计入 P0b 验收。
