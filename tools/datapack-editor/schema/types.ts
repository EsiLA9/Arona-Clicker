/**
 * datapack-editor 参数设定类型（Schema DSL）
 *
 * 本文件是工具自有的自描述类型系统，与游戏运行时（src/**）完全解耦。
 * 所有表（spots / inits / ...）的编辑界面、校验、导入导出均由该 DSL 驱动。
 *
 * 表定义由 Schema 描述协议拼合而成（见 engine-defs.ts / merge.ts / editor-extras.ts，
 * 源头为 src/engine/types/**，经 scripts/gen-engine-schema.mjs 生成）。
 */

export type TableKey =
  | 'inits'
  | 'areas'
  | 'spots'
  | 'enhancements'
  | 'activeStories'
  | 'passiveStories'
  /** 虚拟合并表：activeStories ∪ passiveStories 的只读引用视图（不落盘） */
  | 'storyEntries'
  | 'stories'
  | 'items'
  | 'dropTables'
  | 'affectorPacks'
  | 'triggerDefs'
  | 'characters'
  | 'characterBonuses'
  | 'resourceDisplays'
  | 'tags'
  | 'pics'
  | 'charaProfiles'
  | 'extras';

export interface TableSchema {
  key: TableKey;
  /** 展示名，如 "世界线" */
  label: string;
  /** 主键字段名（如 "id"）。record 型表省略。 */
  idField?: string;
  /** 数据形态：数组（默认）或 key→value 映射（如 extras）。 */
  shape?: 'array' | 'record';
  /** ID 格式：三段式 pack:kind:name（默认）或自由（如角色名 arona） */
  idFormat?: 'tripartite' | 'free';
  /** shape='record' 时的值类型（如 extra 树）。 */
  recordValue?: FieldType;
  /** 是否按世界线拆分为多个分片文件（如 01-inits.json / 12-inits-millennium.json） */
  worldlineSplit?: boolean;
  /**
   * 虚拟引用表：非真实数据源（不参与数据加载/导出/UI 编辑），
   * 仅用于跨表引用下拉与引用合法性校验（如 storyEntries = active ∪ passive 合并视图）。
   */
  virtual?: boolean;
  fields: FieldDef[];
}

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  /** 必填字段 */
  required?: boolean;
  /** 分组展示（如 "基础" / "数值" / "条件" / "Extra"） */
  group?: string;
  description?: string;
  /**
   * 根对象字段：该字段描述的宿主对象整体（如叶子条件以 tagged 描述 {target,key,comparator,value}）。
   * 渲染/校验/摘要时直接作用于整个对象而非 row[key]，key 通常留空。
   */
  root?: boolean;
}

export interface VariantDef {
  /** 判别值，如 'active' */
  tag: string;
  label: string;
  /** 该变体不把判别字段写入数据（如叶子条件没有 type 字段）：选中时删除判别键、初始化时不写 */
  noTag?: boolean;
  /** 变体字段；递归结构（如条件组）可用函数惰性提供，避免模块加载期无限递归 */
  fields: FieldDef[] | (() => FieldDef[]);
}

export type FieldType =
  | { kind: 'string'; default?: string }
  | { kind: 'int'; default?: number }
  | { kind: 'float'; default?: number }
  | { kind: 'bool'; default?: boolean }
  /** 单选，下拉。options 静态给出；optionsFrom 从指定表字段收集 distinct 值并合并（如 school 实际为中文值） */
  | { kind: 'enum'; options?: string[]; meaning?: Record<string, string>; optionsFrom?: { table: TableKey; field: string }; default?: string }
  /** 多选标签（数组 of string），chip 编辑 */
  | { kind: 'multiEnum'; options: string[]; meaning?: Record<string, string> }
  /** 嵌套对象，弹层子表单 */
  | { kind: 'object'; fields: FieldDef[] }
  /** 数组，元素为 FieldDef 描述的标量/对象 */
  | { kind: 'array'; item: FieldDef; unique?: boolean; collapsible?: boolean }
  /** Record<string, T>，如 spotTagBonus */
  | { kind: 'record'; value: FieldDef }
  /** 判别联合，按 tagField 切换表单 */
  | { kind: 'union'; tagField: string; variants: VariantDef[] }
  /**
   * 判别对象联合（tagged）：对象里第一个字段为枚举（tag），后续字段组合随枚举值切换。
   * 如条件组 { type: 'AND'|'OR', conditions: [...] } —— type 是第一个枚举字段，选 AND/OR 后渲染对应 conditions 组合。
   * 与 union 的区别：union 的判别字段被下拉占用、不单独编辑；tagged 的第一个枚举字段是可见可编辑字段。
   */
  | {
      kind: 'tagged';
      /** 第一个元素：枚举字段（key 即数据中的判别键，应设 required） */
      tagField: FieldDef;
      /** 枚举值 → 后续字段组合 */
      combos: { tag: string; fields: FieldDef[] }[];
      /** 公共尾部字段：所有组合之后渲染（如条件叶子的比较符/值），不随枚举值切换 */
      after?: FieldDef[];
    }
  /** 引用其他表的 id，下拉补全 */
  | { kind: 'ref'; table: TableKey }
  /**
   * 宽松值：int/float/string/bool 由数据自行推断（如 Effect.value）
   */
  | { kind: 'flexible' }
  /**
   * 生成器占位：该字段由 engine 类型推断为"复杂/联合/递归"，
   * 必须由 editor-extras 在 merge 阶段用真实 FieldDef 替换。
   * merge 后若仍残留 hand 字段 = 同步遗漏（engine-schema.sync.test.ts 报错）。
   */
  | { kind: 'hand' }
  /** Extra 自由树（NBT 六变体 {t,v}），开放可变内容 */
  | { kind: 'extra' }
  /** 分隔横条：仅用于 UI 语义分组，不参与 JSON 合并/校验（数据行中不存在该字段） */
  | { kind: 'divider' };

/** 由 schema 描述的可实例化数据对象（不运行时推导，仅作约束） */
export type SchemaData = Record<string, unknown>;
