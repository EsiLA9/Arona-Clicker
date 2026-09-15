import type { Datapack } from '../contracts/datapack';
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
  | 'constNumberExpression';

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
}

/** Spot Runtime Editor 当前暴露的资源 Affector 行；实现细节留在 authoring 层。 */
export type SpotAffectorMode = 'fixed' | 'per-level';

export interface SpotResourceAffectorDraft {
  readonly id: string;
  readonly type: 'resource-flow';
  readonly mode: SpotAffectorMode;
  readonly resource: string;
  readonly amount: number;
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
}

/** 单条内容授权：一张表一行，`mutate` 是该表接入受控物化的唯一钩子。 */
export interface ContentAuthoringPolicy {
  readonly key: ContentKey;
  readonly label: string;
  /** 实体 ID 的 type 段（mod:type:id），如 spot。 */
  readonly idType: string;
  /** 诊断路径前缀，如 spot → spot.baseCost。 */
  readonly inputPrefix: string;
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
  mutate(registry: Registry, request: AuthoringMutationRequest): AuthoringMutationReceipt;
}

export type AuthoringProblemCode = 'invalid-content-id' | 'invalid-field';

export interface AuthoringProblem {
  readonly code: AuthoringProblemCode;
  readonly path?: string;
  readonly message: string;
}
