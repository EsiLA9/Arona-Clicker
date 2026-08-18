# 03. SpotDef 简例（设施）

> 对应 `src/engine/types.ts` 的 `SpotDef`、`LevelUpgradeDef`、`SpotFunctionalityDef`。

## 字段表（SpotDef）

| JSON 键 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | ✅ | 全局唯一，如 `"base:spot:credit_printer"` |
| `areaId` | string（AreaId） | ✅ | 所属区域；必须存在于 `areas` |
| `name` | string | ✅ | 设施名称 |
| `description` | string | ✅ | 描述 |
| `baseCost` | ValueExpression | ✅ | 初始购买价格 |
| `baseCostResource` | string | ✅ | 购买货币，如 `"base:resource:credit"` |
| `baseYield` | ValueExpression | ✅ | 每 Tick 基础产出 |
| `baseYieldResource` | string | ✅ | 产出资源 id |
| `baseCapacity` | number | ✅ | 容量上限（累加余额上限） |
| `managerBonusYield` | ValueExpression | ✅ | 委派经理后的额外产出 |
| `conditionText` | string | — | 解锁条件展示文案 |
| `levelUpgrades` | LevelUpgradeDef[] | — | 特殊等级效果 |
| `yieldPerLevel` | number | — | 每级额外产出（线性） |
| `upgradeCostBase` | number | — | 升级花费基准 |
| `upgradeCostGrowth` | number | — | 升级花费指数增长系数 |
| `maxLevel` | number | — | 等级上限 |
| `tags` | string[][]（TagPath[]） | ✅ | 标签路径数组，如 `[["credit"],["office"]]` |
| `revealTriggers` | RevealTrigger[] | — | 揭示 Trigger 列表（见 [[01-init#RevealTrigger（揭示 Trigger 列表）]]）；`existence` 目标即"可见条件"，`unlock` 目标即"自动解锁条件" |
| `functionalities` | SpotFunctionalityDef[] | — | 特殊功能 |
| `extra` | ExtraValue | — | 任意附加数据 |

## SpotFunctionalityDef（特殊功能）

| JSON 键 | 类型 | 说明 |
|---|---|---|
| `id` | string | 功能 id |
| `kind` | string | `"linearYield"`（每级线性产出）\| `"restartInit"`（软重启）\| `"hardResetInit"`（硬重置） |
| `condition` | ConditionGroup | 可选条件 |
| `resource` | string | `kind=linearYield` 时的产出资源 |
| `amountPerLevel` | number | `kind=linearYield` 时每级产出量 |

## LevelUpgradeDef（特殊等级效果）

| JSON 键 | 类型 | 说明 |
|---|---|---|
| `level` | number | 触发等级 |
| `cost` | ValueExpression | 可选花费 |
| `condition` | ConditionGroup | 可选条件 |
| `effects` | Effect[] | 达到该等级时执行的效果 |

## 最小 JSON 简例

```json
{
  "id": "base:spot:credit_printer",
  "areaId": "base:area:schale_main",
  "name": "信用点制造机",
  "description": "一台老旧但可靠的信用点制造设备，每个 Tick 都会产出信用点。",
  "baseCost": { "type": "const", "value": 0 },
  "baseCostResource": "base:resource:credit",
  "baseYield": { "type": "const", "value": 5 },
  "baseYieldResource": "base:resource:credit",
  "baseCapacity": 500,
  "managerBonusYield": { "type": "const", "value": 3 },
  "tags": [["credit"], ["office"]],
  "functionalities": [
    {
      "id": "base:func:credit_printer_linear",
      "kind": "linearYield",
      "resource": "base:resource:credit",
      "amountPerLevel": 2
    }
  ],
  "yieldPerLevel": 2,
  "upgradeCostBase": 50,
  "upgradeCostGrowth": 2
}
```

## 含 revealTriggers / levelUpgrades / 带条件功能 的简例

```json
{
  "id": "base:spot:field_work",
  "areaId": "base:area:schale_main",
  "name": "野外调查站",
  "description": "阿比多斯风格的小型户外作业点，适合野外探索型学生。",
  "baseCost": { "type": "const", "value": 20 },
  "baseCostResource": "base:resource:credit",
  "baseYield": { "type": "const", "value": 8 },
  "baseYieldResource": "base:resource:credit",
  "baseCapacity": 300,
  "managerBonusYield": { "type": "const", "value": 4 },
  "tags": [["field"], ["combat"]],
  "revealTriggers": [
    {
      "reveal": "name",
      "condition": {
        "type": "AND",
        "conditions": [
          { "target": "resource", "key": "base:resource:credit", "comparator": ">=", "value": 10 }
        ]
      }
    },
    {
      "reveal": "utility",
      "condition": {
        "type": "AND",
        "conditions": [
          { "target": "resource", "key": "base:resource:credit", "comparator": ">=", "value": 40 }
        ]
      }
    }
  ],
  "functionalities": [
    {
      "id": "base:func:field_work_conditioned",
      "kind": "linearYield",
      "resource": "base:resource:credit",
      "amountPerLevel": 1,
      "condition": {
        "type": "AND",
        "conditions": [
          { "target": "stat", "key": "$GlobalProducedAmount base:resource:credit", "comparator": ">", "value": 100 }
        ]
      }
    }
  ],
  "levelUpgrades": [
    {
      "level": 2,
      "effects": [{ "op": "setSpotLevel", "target": "base:spot:field_work", "value": "2" }]
    },
    {
      "level": 3,
      "effects": [{ "op": "setSpotLevel", "target": "base:spot:field_work", "value": "3" }]
    }
  ],
  "upgradeCostBase": 80,
  "upgradeCostGrowth": 1.8,
  "yieldPerLevel": 1
}
```

## 校验要点

- `areaId` 引用的 area 必须存在。
- `baseCost` / `baseYield` / `managerBonusYield` 均为 ValueExpression（见 README §5.1）。
- `tags` 是二维字符串数组：每个元素是一个 TagPath（字符串数组）。
- `levelUpgrades[].effects[].target` 引用自身 spot id 时不会触发循环校验（Registry 仅校验 area/init/spot 层级引用）。
