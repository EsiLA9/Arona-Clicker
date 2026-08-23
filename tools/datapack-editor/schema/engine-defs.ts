/**
 * engine-defs.ts —— Schema 描述协议（engine → editor 的序列化形状）
 *
 * 由 scripts/gen-engine-schema.mjs 从 src/engine/types/** 生成
 * engine-defs.gen.json，此处定义其 TS 形状并加载。
 * editor 不直接 import src/**，仅消费该生成协议（解耦纪律）。
 */
import engineDefs from './engine-defs.gen.json';

export type GenKind =
  | 'string'
  | 'int'
  | 'float'
  | 'bool'
  | 'enum'
  | 'array'
  | 'object'
  | 'record'
  | 'ref'
  | 'extra'
  | 'flexible'
  | 'hand';

/** 生成协议中的单字段（无 key，或 array/record 元素 key='$'）。 */
export interface GenField {
  key: string;
  required: boolean;
  kind: GenKind;
  /** 原始 TS 类型文本 */
  tsType?: string;
  /** TSDoc @label（简单含义，游戏侧） */
  label?: string;
  /** TSDoc @group */
  group?: string;
  description?: string;
  // enum
  options?: string[];
  meaning?: Record<string, string>;
  optionsFrom?: string;
  // ref
  table?: string;
  // array / object / record 子结构
  item?: GenField;
  fields?: GenField[];
  value?: GenField;
  collapsible?: boolean;
}

export interface GenEntity {
  /** array 实体：字段列表 */
  fields?: GenField[];
  /** enum 实体：成员名列表 */
  enum?: string[];
  /** 无法生成（联合/递归等），editor 运行时兜底 */
  hand?: boolean;
  tsType?: string;
}

export interface EngineSchema {
  generatedAt: string;
  sourceDir: string;
  defMap: Record<string, { type: string; shape: 'array' | 'record' }>;
  defs: Record<string, GenEntity>;
  indexedTypes: string[];
}

export function loadEngineDefs(): EngineSchema {
  return engineDefs as unknown as EngineSchema;
}
