/**
 * gen-engine-schema.mjs —— 从 src/engine/types/** 生成 Schema 描述协议
 *
 * 协议 = defMap（派生自 Datapack 接口）+ defs（各实体字段定义，含简单含义与 hand 占位）。
 * editor 侧 merge.ts 将其与 editor-extras 拼合成最终 TableSchema。
 *
 * 用法：
 *   node scripts/gen-engine-schema.mjs --write   # 写 tools/datapack-editor/schema/engine-defs.gen.json
 *   node scripts/gen-engine-schema.mjs           # 仅打印摘要
 *
 * 同时导出 parseEngineSchema() 供 vitest（engine-schema.sync.test.ts）复用。
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const TYPES_DIR = resolve(ROOT, 'src/engine/types');
const OUT_FILE = resolve(ROOT, 'tools/datapack-editor/schema/engine-defs.gen.json');

/** 推断为 ref 的类型别名基名 → 表 key（editor TableKey 命名对齐）。 */
const ID_REF_TABLE = {
  Init: 'inits',
  Area: 'areas',
  Spot: 'spots',
  Enhancement: 'enhancements',
  Story: 'stories',
  Item: 'items',
  Funclet: 'funcletDefs',
  // Character 重构表（docs-818/12-character-rework.md §2）
  Variant: 'characterVariants',
  Color: 'colors',
  GachaPool: 'gachaPools',
  ChatMessage: 'chatMessages',
  CultivateCurve: 'cultivateCurves',
};

/** 无法自动推导、必须由 editor-extras 运行时构建的复杂类型（手写清单）。 */
const HAND_TYPES = new Set([
  'Effect', 'Condition', 'ConditionGroup', 'Value', 'ValueExpression', 'FuncletDef', 'FuncletCall',
  'RevealTrigger', 'EntryEffectDef', 'TriggerDef', 'TriggerEventDef', 'SpotFunctionalityDef',
  'LevelUpgradeDef', 'EnhancementAttachment', 'AffectorEffect', 'AffectorPackDef',
  'StoryDef', 'StoryEntryDef', 'ActiveStoryEntry', 'PassiveStoryEntry', 'Talklet', 'StoryChoice',
  'DropTableEntry', 'StoryView', 'SendState', 'SendResult',
  'StoryStartResult', 'StoryAdvanceResult', 'UseItemResult', 'TravelResult',
  'EnhancementPurchaseResult', 'SpotUnlockResult', 'SpotUpgradeResult', 'InitPurchaseResult',
]);

/** Extra 树类型 → extra kind。 */
const EXTRA_TYPES = new Set(['ExtraCompound', 'ExtraValue']);

/** @enum a=b 等 TSDoc 标签提取：name → string[]；同时返回字段描述首行 */
function collectTags(node) {
  const tags = new Map();
  let comment;
  const docs = node.jsDoc ?? [];
  for (const doc of docs) {
    if (!comment && typeof doc.comment === 'string') {
      comment = doc.comment.split('\n')[0].trim() || undefined;
    }
    for (const tag of doc.tags ?? []) {
      const name = tag.tagName.text;
      const text = tag.comment ?? '';
      if (!tags.has(name)) tags.set(name, []);
      tags.get(name).push(String(text).trim());
    }
  }
  return { comment, tags };
}

function firstOf(tags, name) {
  const v = tags.get(name);
  return v && v.length ? v[0] : undefined;
}

const text = (n) => n.getText();

/**
 * 把一条属性的类型节点归类为协议 field（不含 key）。
 * decl: name → { kind, node }
 */
function describeType(typeNode, decl, depth, ctx) {
  const tsType = text(typeNode);
  if (depth > 4) return { kind: 'hand', tsType };
  if (!typeNode) return { kind: 'hand', tsType };

  if (typeNode.kind === ts.SyntaxKind.StringKeyword) return { kind: 'string', tsType };
  if (typeNode.kind === ts.SyntaxKind.BooleanKeyword) return { kind: 'bool', tsType };
  if (typeNode.kind === ts.SyntaxKind.NumberKeyword) return { kind: 'float', tsType };
  // X[]
  if (ts.isArrayTypeNode(typeNode)) {
    const item = describeType(typeNode.elementType, decl, depth + 1, ctx);
    return { kind: 'array', item, tsType };
  }
  // Record<string, X>
  if (ts.isTypeReferenceNode(typeNode) && typeNode.typeName.getText() === 'Record') {
    const args = typeNode.typeArguments ?? [];
    if (args.length === 2) {
      const value = describeType(args[1], decl, depth + 1, ctx);
      return { kind: 'record', value, tsType };
    }
    return { kind: 'hand', tsType };
  }
  // 字符串字面量联合 → enum
  if (ts.isUnionTypeNode(typeNode)) {
    const literals = typeNode.types.filter((t) => ts.isLiteralTypeNode(t) && typeof t.literal.kind === 'number' && (t.literal.kind === ts.SyntaxKind.StringLiteral));
    if (literals.length === typeNode.types.length && literals.length > 0) {
      const options = literals.map((t) => t.literal.text);
      return { kind: 'enum', options, tsType };
    }
    return { kind: 'hand', tsType };
  }
  // 命名引用
  if (ts.isTypeReferenceNode(typeNode)) {
    const name = typeNode.typeName.getText();
    const t = decl.get(name);
    if (EXTRA_TYPES.has(name)) return { kind: 'extra', tsType };
    if (HAND_TYPES.has(name)) return { kind: 'hand', tsType };
    const refTable = ID_REF_TABLE[name.replace(/Id$/, '')];
    if (t?.kind === 'typeAlias' && t.node.type.kind === ts.SyntaxKind.StringKeyword && refTable) {
      return { kind: 'ref', table: refTable, tsType };
    }
    if (t?.kind === 'typeAlias') {
      const inner = describeType(t.node.type, decl, depth + 1, ctx);
      if (inner.kind !== 'hand') return { ...inner, tsType };
      return { kind: 'hand', tsType };
    }
    if (t?.kind === 'enum') {
      const options = t.node.members.map((m) => m.name.getText());
      return { kind: 'enum', options, tsType };
    }
    if (t?.kind === 'interface' && !EXTRA_TYPES.has(name) && !HAND_TYPES.has(name)) {
      const fields = describeInterface(t.node, decl, depth + 1, ctx);
      return { kind: 'object', fields, tsType };
    }
    return { kind: 'hand', tsType };
  }
  return { kind: 'hand', tsType };
}

function describeInterface(node, decl, depth, ctx) {
  const fields = [];
  for (const member of node.members ?? []) {
    if (!ts.isPropertySignature(member)) continue;
    const key = member.name.getText();
    const required = !member.questionToken;
    const { comment, tags } = collectTags(member);
    const label = firstOf(tags, 'label');
    const group = firstOf(tags, 'group');
    const intTag = tags.has('int');
    const floatTag = tags.has('float');
    const flexibleTag = tags.has('flexible');
    const extraTag = tags.has('extra');
    const refTag = firstOf(tags, 'ref');
    const refListTag = firstOf(tags, 'refList');
    const collapsibleTag = tags.has('collapsible');
    const optionsFromTag = firstOf(tags, 'optionsFrom');
    const enumPairs = (tags.get('enum') ?? []).map((s) => {
      const idx = s.indexOf('=');
      return idx >= 0 ? [s.slice(0, idx).trim(), s.slice(idx + 1).trim()] : [s.trim(), s.trim()];
    });

    let desc = describeType(member.type, decl, depth, ctx);
    if (intTag) desc = { kind: 'int', ...(desc.item ? { item: desc.item } : {}), ...(desc.fields ? { fields: desc.fields } : {}), ...(desc.value ? { value: desc.value } : {}), tsType: desc.tsType };
    else if (floatTag) desc = { kind: 'float', tsType: desc.tsType };
    else if (flexibleTag) desc = { kind: 'flexible', tsType: desc.tsType };
    else if (extraTag) desc = { kind: 'extra', tsType: desc.tsType };
    if (refTag) desc = { kind: 'ref', table: refTag, tsType: desc.tsType };
    else if (refListTag) desc = { kind: 'array', item: { key: '$', kind: 'ref', table: refListTag }, tsType: desc.tsType };
    if (optionsFromTag) desc = { kind: 'enum', optionsFrom: optionsFromTag, tsType: desc.tsType };

    if (desc.kind === 'enum' && enumPairs.length > 0) {
      const meaning = {};
      for (const [v, m] of enumPairs) meaning[v] = m;
      desc = { ...desc, meaning };
    }

    const f = {
      key,
      required,
      kind: desc.kind,
      tsType: desc.tsType ?? '',
      ...(label ? { label } : {}),
      ...(group ? { group } : {}),
      ...(comment ? { description: comment } : {}),
    };
    if (desc.kind === 'enum') {
      if (desc.options) f.options = desc.options;
      if (desc.meaning) f.meaning = desc.meaning;
      if (desc.optionsFrom) f.optionsFrom = desc.optionsFrom;
    }
    if (desc.kind === 'ref') f.table = desc.table;
    if (desc.kind === 'array') {
      f.item = { key: '$', ...desc.item, ...(collapsibleTag ? { collapsible: true } : {}) };
    }
    if (desc.kind === 'object') f.fields = desc.fields;
    if (desc.kind === 'record') f.value = { key: '$', ...desc.value };
    fields.push(f);
  }
  return fields;
}

/**
 * 解析 src/engine/types/** → { defMap, defs, indexedTypes }。
 * defMap 派生自 Datapack 接口的数组/record 字段。
 */
export function parseEngineSchema({ dir = TYPES_DIR } = {}) {
  const files = readdirSync(dir).filter((f) => f.endsWith('.ts') && f !== 'index.ts');
  const sourceFiles = files.map((f) => {
    const path = join(dir, f);
    return ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  });

  const decl = new Map();
  for (const sf of sourceFiles) {
    for (const stmt of sf.statements) {
      const name = stmt.name?.getText();
      if (!name) continue;
      if (ts.isInterfaceDeclaration(stmt)) decl.set(name, { kind: 'interface', node: stmt });
      else if (ts.isTypeAliasDeclaration(stmt)) decl.set(name, { kind: 'typeAlias', node: stmt });
      else if (ts.isEnumDeclaration(stmt)) decl.set(name, { kind: 'enum', node: stmt });
    }
  }

  // defMap：Datapack 接口的数组 / record 字段
  const datapack = decl.get('Datapack');
  const defMap = {};
  if (datapack?.kind === 'interface') {
    for (const member of datapack.node.members) {
      if (!ts.isPropertySignature(member)) continue;
      const key = member.name.getText();
      const t = member.type;
      if (ts.isArrayTypeNode(t)) {
        const el = t.elementType;
        const elName = ts.isTypeReferenceNode(el) ? el.typeName.getText() : text(el);
        defMap[key] = { type: elName, shape: 'array' };
      } else if (ts.isTypeReferenceNode(t) && t.typeName.getText() === 'Record') {
        const arg = t.typeArguments?.[1];
        const elName = arg && ts.isTypeReferenceNode(arg) ? arg.typeName.getText() : 'ExtraValue';
        defMap[key] = { type: elName, shape: 'record' };
      }
    }
  }

  // defs：defMap 中每个实体的字段定义（+ 关键子结构一并产出供参考/覆盖）
  const defs = {};
  const needed = new Set(Object.values(defMap).map((v) => v.type));
  for (const name of needed) {
    const d = decl.get(name);
    if (d?.kind === 'interface') {
      defs[name] = { fields: describeInterface(d.node, decl, 0, {}) };
    } else if (d?.kind === 'enum') {
      defs[name] = { enum: d.node.members.map((m) => m.name.getText()) };
    } else {
      defs[name] = { hand: true, tsType: d?.kind ? text(d.node) : 'unknown' };
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    sourceDir: 'src/engine/types',
    defMap,
    defs,
    indexedTypes: [...decl.keys()].sort(),
  };
}

function main() {
  const schema = parseEngineSchema();
  if (process.argv.includes('--write')) {
    mkdirSync(dirname(OUT_FILE), { recursive: true });
    writeFileSync(OUT_FILE, JSON.stringify(schema, null, 2) + '\n', 'utf8');
    console.log(`[gen-engine-schema] wrote ${OUT_FILE}`);
  }
  console.log(`  defMap tables: ${Object.keys(schema.defMap).join(', ')}`);
  for (const [k, v] of Object.entries(schema.defMap)) {
    console.log(`  - ${k}: ${v.shape} of ${v.type}${schema.defs[v.type]?.hand ? ' (HAND)' : ''}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
