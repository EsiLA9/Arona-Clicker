# 11. CharacterData / CharacterBonusTable / ResourceDisplayDef 简例

> 对应 `src/engine/types.ts` 的 `CharacterData`、`CharacterBonusTable`、`ResourceDisplayDef`。

## CharacterData 字段表

| JSON 键 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | ✅ | 角色短 id，如 `"arona"`（见下方枚举表） |
| `name` | string | ✅ | 角色名 |
| `displayName` | string | ✅ | 显示名 |
| `school` | string | ✅ | 学校（中文枚举，见下） |
| `rarity` | string | ✅ | `"common"` \| `"rare"` \| `"super_rare"` |
| `description` | string | ✅ | 描述 |
| `spotTagBonus` | object | ✅ | 标签产出倍率：`{ "office": 1.5, "system": 1.3 }` |
| `passiveDescription` | string | ✅ | 被动效果描述 |
| `extra` | ExtraValue | — | 附加数据（须为 dict） |

## Character 短 id 枚举

`none` `arona`（夏莱）；`shiroko` `hoshino` `nonomi` `serika` `ayane`（阿比多斯）；`yuuka` `noa` `midori` `momoi` `koyuki`（千禧年）；`hifumi` `nagisa` `mika` `koharu`（崔妮蒂）；`ako` `iori` `mutsuki` `aru`（盖赫纳）；`miyu` `miyako` `saki` `moe`（SRT）。

## CharacterSchool 枚举（中文值）

`夏莱` `阿比多斯` `千禧年` `崔妮蒂` `盖赫纳` `SRT` `阿里乌斯` `百鬼夜行` `山海经` `红冬` `瓦尔基里`

## 最小 JSON 简例

```json
{
  "id": "arona",
  "name": "阿罗娜",
  "displayName": "阿罗娜",
  "school": "夏莱",
  "rarity": "super_rare",
  "description": "什亭之匣的系统管理员AI，有些冒失但很关心老师。",
  "spotTagBonus": { "office": 1.5, "system": 1.3 },
  "passiveDescription": "「办公室」和「系统」类 Spot 产出倍率 +50%/+30%"
}
```

## CharacterBonusTable（角色 × Spot 独立倍率）

| JSON 键 | 类型 | 说明 |
|---|---|---|
| `characterId` | string | 角色短 id |
| `spotId` | string | Spot id |
| `multiplier` | number | 倍率 |

```json
{
  "characterId": "arona",
  "spotId": "base:spot:credit_printer",
  "multiplier": 1.5
}
```

> base 包中 `characterBonuses` 为空数组 `[]`。

## ResourceDisplayDef（资源条显示）

| JSON 键 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `resourceId` | string | ✅ | 资源 id，如 `"base:resource:credit"` |
| `label` | string | ✅ | 显示标签 |
| `detailLabel` | string | — | 详情标签 |
| `showWhen` | string | — | `"hasAmount"`（持有量 > 0 才显示）等 |
| `order` | number | — | 排序，越小越靠前 |

```json
[
  { "resourceId": "base:resource:credit", "label": "信用点", "order": 0 },
  {
    "resourceId": "base:resource:pyroxene",
    "label": "青辉石",
    "detailLabel": "青辉石",
    "showWhen": "hasAmount",
    "order": 10
  }
]
```

## 校验要点

- `spotTagBonus` 的键为标签路径中的单段（如 `"office"`），不是完整路径数组。
- `school` 必须使用中文枚举值；`rarity` 必须使用 `common/rare/super_rare`。
- `characterBonuses[].spotId` 引用的 spot 必须存在（Registry 校验引用完整性）。
