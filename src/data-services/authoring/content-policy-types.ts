import type { Datapack } from '../contracts/datapack';
import type { ConditionGroup, Effect } from '../../engine/types/expression';
import type { RevealTarget } from '../../engine/contracts/reveal';
import type { Registry } from '../registry/registry';

/** 可授权编辑的内容键：直接取自 Datapack 顶层内容字段，避免第二份清单。 */
export type ContentKey = Exclude<keyof Datapack, 'name' | 'version' | 'modName'>;

/** 可写字段的值语义：同时决定校验规则与写入 Def 时的编码方式。 */
export type WritableFieldKind =
  /** 局部实体名（idName）：[a-z0-9_-]+，写入时拼接为 mod:type:id 的 id。 */
  | 'entityName'
  /** 引用其他内容的完整实体 ID。 */
  | 'ref'
  | 'string'
  | 'nonEmptyString'
  | 'number'
  | 'nonNegativeNumber'
  /** 非负整数（等级、每级产出等计数量）。 */
  | 'int'
  /** 非负数字，写入时编码为引擎常量表达式。 */
  | 'constNumberExpression'
  /** 布尔开关（如 Spot 的 global）：原样写入 Def，缺省表示不写入。 */
  | 'boolean';

export interface WritableFieldDef {
  readonly key: string;
  /** 面向作者的中文标签：表单渲染直接消费，避免 UI 再维护一份字段名表。 */
  readonly label: string;
  readonly kind: WritableFieldKind;
  /** 默认必填；显式 false 表示允许缺省。 */
  readonly required?: boolean;
  /** kind === 'ref'：目标实体在 mod:type:id 中的 type 段。 */
  readonly refType?: string;
  /** 新建内容时的初始值；缺省按 kind 推导（字符串为空、数值为 0、引用取首个候选）。 */
  readonly initialValue?: unknown;
  /** 字段所属编辑页 id（编辑器描述符消费）；缺省归入默认页。 */
  readonly section?: string;
}

/** 编辑器页定义：只描述顺序与标题，内容由字段 / 扩展的 `section` 归属决定。 */
export interface ContentSectionDef {
  readonly id: string;
  readonly label: string;
}

/** Spot 功能行草稿：与 SpotFunctionalityDef 的 kind 一一对应，UI 不暴露引擎 id 前缀。 */
export type SpotFunctionalityKind = 'flow' | 'linearYield' | 'restartInit' | 'hardResetInit' | 'gacha' | 'shop';

export interface SpotFunctionalityDraft {
  /** 编辑器生成的稳定局部键，用户不填写。 */
  readonly id: string;
  readonly kind: SpotFunctionalityKind;
  /** flow / linearYield：产出资源 id。 */
  readonly resource?: string;
  /** flow：固定产出数量。 */
  readonly amount?: number;
  /** linearYield：每级产出数量。 */
  readonly amountPerLevel?: number;
  /** linearYield：起算等级；0 表示从 Lv.1 计入。 */
  readonly startLevel?: number;
  /** shop：商店引用。 */
  readonly shopId?: string;
  readonly condition?: ConditionGroup;
}

/** Runtime Editor 可编辑的支付费用项：金额采用常量，物化时包装为 ValueExpression。 */
export interface PaymentCostDraft {
  readonly type: 'resource' | 'item';
  readonly resourceId?: string;
  readonly itemId?: string;
  readonly amount: number;
}

/** Runtime Editor 可编辑的支付方案；多个方案之间为 OR。 */
export interface PaymentOptionDraft {
  readonly id: string;
  readonly label?: string;
  readonly condition?: ConditionGroup;
  readonly costs: readonly PaymentCostDraft[];
}

/** 等级升级行草稿：paymentOptions 内的费用金额以常量数值编辑，encode 时包装为引擎常量表达式。 */
export interface SpotLevelUpgradeDraft {
  readonly level: number;
  readonly paymentOptions: readonly PaymentOptionDraft[];
  readonly condition?: ConditionGroup;
  readonly effects: Effect[];
}

/** 揭示声明行草稿。 */
export interface SpotRevealTriggerDraft {
  readonly reveal: RevealTarget;
  readonly condition?: ConditionGroup;
}

export type ContentApplyStrategy = 'local-mutation' | 'reload';

/** 字段的运行时消费者：用于登记「谁读这个字段」。 */
export type FieldConsumer =
  | 'registry-record'
  | 'area-index'
  | 'tag-index'
  | 'game-num'
  | 'visibility'
  | 'affector'
  | 'spot-service'
  /** 世界线隔离：进入 / 恢复世界线时按该字段切分 Spot 持有状态。 */
  | 'init-scope'
  /** 每次渲染 / 服务调用直接读 Registry，无缓存。 */
  | 'ui-dynamic';

/** 字段失效方式：none 表示动态读取，无需失效。 */
export type FieldInvalidation = 'none' | 'subtree' | 'index' | 'remount';

/**
 * 字段级失效台账：可写字段的授权依据。
 * `invalidate` 非 none 时必须写出触发方；写不出触发方的字段不得开放编辑。
 */
export interface FieldMaterialization {
  readonly field: string;
  readonly consumers: readonly FieldConsumer[];
  readonly invalidate: FieldInvalidation;
  /** 触发失效的现有路径名称（事件 / 服务方法）。 */
  readonly trigger?: string;
}

export interface AuthoringValidationContext {
  /** 由 Registry 的 resourceDisplays 投影而来，禁止编辑器自由注入未知资源。 */
  readonly resourceIds?: ReadonlySet<string>;
  /** 由 Registry 的 items 投影而来，禁止写入未知物品。 */
  readonly itemIds?: ReadonlySet<string>;
  /** 由 Registry 的 gachaPools 投影而来，禁止写入未知卡池。 */
  readonly gachaPoolIds?: ReadonlySet<string>;
  /** 由 Registry 的 shops 投影而来，禁止写入未知商店。 */
  readonly shopIds?: ReadonlySet<string>;
}

export type ContentStatePolicy = 'retain';

export interface AuthoringMutationRequest {
  readonly table: ContentKey;
  readonly operation: 'create' | 'replace' | 'delete' | 'suspend' | 'resume';
  readonly ownerModName: string;
  /** 已由策略校验并构建完成的实体 ID。 */
  readonly defId: string;
  /** create / replace 时为已构建的 Def；其余操作省略。 */
  readonly def?: unknown;
}

export interface AuthoringMutationReceipt {
  readonly table: ContentKey;
  readonly operation: AuthoringMutationRequest['operation'];
  readonly ownerModName: string;
  readonly defId: string;
  readonly previousDef: unknown | undefined;
  readonly currentDef: unknown | undefined;
  rollback(): void;
}

export interface AuthoringExtension {
  /** 作者输入中的键；不要求与引擎 Def 键相同。 */
  readonly inputKey: string;
  /** 物化到 Def 时使用的键。 */
  readonly definitionKey: string;
  validate(value: unknown, context?: AuthoringValidationContext): AuthoringProblem | undefined;
  encode(value: unknown): unknown;
  /** 新建内容时的初始值；复杂集合由 UI 按此值建立显式声明。 */
  readonly initialValue?: unknown;
  /** 是否要求作者显式提供该扩展。 */
  readonly required?: boolean;
  /** 是否保留显式空数组；用于表达「明确没有可用支付方案」而非回退旧字段。 */
  readonly preserveEmpty?: boolean;
  /** 该扩展所属编辑页 id（编辑器描述符消费）。 */
  readonly section?: string;
  /**
   * 子编辑器 id（编辑器描述符消费）：对象型集合按「摘要行 + 子编辑弹窗」编辑，
   * 标量集合由子编辑器自行在页内行内编辑。缺省表示该扩展不出现在可写 UI。
   */
  readonly editor?: string;
}

/** 单条内容授权：一张表一行，`mutate` 是该表接入受控物化的唯一钩子。 */
export interface ContentAuthoringPolicy {
  readonly key: ContentKey;
  readonly label: string;
  /** 实体 ID 的 type 段（mod:type:id），如 spot。 */
  readonly idType: string;
  /** 诊断路径前缀，如 spot → spot.purchaseOptions。 */
  readonly inputPrefix: string;
  /**
   * 编辑页顺序（编辑器描述符消费）：字段与扩展按 `section` 归页。
   * 缺省时描述符退化为「全部字段一页」，不产生空页。
   */
  readonly sections?: readonly ContentSectionDef[];
  readonly fields: readonly WritableFieldDef[];
  /** 结构化字段扩展：保持普通字段渲染器只处理标量，避免复杂能力泄漏到 UI。 */
  readonly extensions?: readonly AuthoringExtension[];
  /** 不可编辑但必须写入 Def 的字段。 */
  readonly defaults?: Readonly<Record<string, unknown>>;
  readonly apply: ContentApplyStrategy;
  /** 字段级失效台账：每个可写字段必须登记，未登记即未授权热写。 */
  readonly materialization: readonly FieldMaterialization[];
  readonly state: ContentStatePolicy;
  /** 未授权字段的补充说明，用于诊断文案。 */
  readonly unsupportedFieldHint?: string;
  /** 仅具备局部热失效链的内容提供；reload 型内容由 Runtime candidate 物化。 */
  mutate?(registry: Registry, request: AuthoringMutationRequest): AuthoringMutationReceipt;
}

export type AuthoringProblemCode = 'invalid-content-id' | 'invalid-field';

export interface AuthoringProblem {
  readonly code: AuthoringProblemCode;
  readonly path?: string;
  readonly message: string;
}
