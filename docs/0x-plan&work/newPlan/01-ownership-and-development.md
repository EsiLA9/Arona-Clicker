# Character / Variant / Development：拥有与培养

> 修订注记（2026-09-11）：好感归属经 [[docs/0x-plan&work/active/adr-0008-character-progression-boundaries]] 裁定为 **Variant 级 + Proto 求和**，本文「关系状态分层」中『Character Affection：好感属于人、跨 Variant 共享』的口径已作废。

## 设计目标

拆开“认识学生”“拥有差分”和“培养差分”三个语义，避免抽到 Variant 就同时承担所有长期状态。

```text
Character：认识/收录了这个学生
    ↓
Variant：获得了这个具体差分
    ↓
Development：这个差分的长期培养状态
```

## 拥有状态

```text
Unknown
  ↓ 首次见到或剧情登场
Discovered
  ↓ 获得角色原型或任一差分
Character Owned
  ↓ 获得具体差分
Variant Owned
  ↓ 重复获取
Fragments / 神名文字
  ↓ 消耗
Star / Unlock / 其他长期培养
```

剧情首次出现的学生只进入图鉴并显示基础资料，不自动成为可配置角色。获得任一差分后，才设置 `CharacterOwned = true`；获得具体差分后，再设置对应的 `VariantOwned`。

## 关系状态分层

- `Character Presence`：拥有任一 Variant 后，学生进入夏莱并可参与角色级内容。
- `Character Affection`：好感属于“人”，跨 Variant 共享。
- `Variant Development`：培养、星级、差分能力属于具体 Variant。
- Variant 可拥有独立外观、生产技能、主题、羁绊剧情和特殊 Affector。

剧情可以组合条件，例如“Character affection >= 20 且拥有泳装 Variant”。

## 示例

- 剧情遇到白子：进入图鉴，但不可配置。
- 获得白子普通版：解锁 Character 与普通 Variant，开启基础聊天和角色级好感。
- 获得泳装白子：新增泳装 Variant、外观、能力与专属剧情；不重置白子关系。
- 重复普通白子：转为该角色的长期培养资产。

