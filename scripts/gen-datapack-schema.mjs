/**
 * gen-datapack-schema.mjs
 *
 * 从 src/engine/types.ts 解析顶层 interface / type alias，生成
 * tools/datapack-editor/schema/datapack.schema.gen.json 初稿。
 *
 * 初稿仅提取字段名 / 必填 / 原始 TS 类型文本（tsType），供人工
 * 在 datapack.schema.ts 中映射为 schema DSL（union/object/ref/extra 等）。
 *
 * 用法：node scripts/gen-datapack-schema.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const TYPES_FILE = resolve(ROOT, 'src/engine/types.ts');
const OUT_FILE = resolve(ROOT, 'tools/datapack-editor/schema/datapack.schema.gen.json');

/**
 * 表 key → 该表条目在 types.ts 中的类型名。
 * 不在此表中的顶层类型也会被索引（供人工查阅），但不进入初稿 tables。
 */
const TABLE_TYPES = {
  inits: 'InitDef',
  areas: 'AreaDef',
  spots: 'SpotDef',
  enhancements: 'EnhancementDef',
  stories: 'StoryDef',
  items: 'ItemDef',
  droptables: 'DropTableDef',
  affectorPacks: 'AffectorPackDef',
  triggers: 'TriggerDef',
  characters: 'CharacterData',
  extras: 'ExtraDef',
};

const source = readFileSync(TYPES_FILE, 'utf8');
const sf = ts.createSourceFile(TYPES_FILE, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

/** name → { fields } */
const interfaces = new Map();
/** name → { typeText }（type alias） */
const aliases = new Map();

function typeTextOf(node) {
  return node.getText(sf);
}

function collectType(node, name) {
  const fields = [];
  for (const member of node.members ?? []) {
    if (member.kind !== ts.SyntaxKind.PropertySignature && member.kind !== ts.SyntaxKind.PropertyDeclaration) {
      continue;
    }
    const key = member.name.getText(sf);
    const required = !member.questionToken;
    const type = member.type ? typeTextOf(member.type) : 'unknown';
    const comment = member.jsDoc?.[0]?.comment
      ? String(member.jsDoc[0].comment).split('\n')[0]
      : undefined;
    fields.push({ key, required, type, comment });
  }
  interfaces.set(name, { name, fields });
}

for (const stmt of sf.statements) {
  const name = stmt.name?.getText(sf);
  if (!name) continue;
  if (ts.isInterfaceDeclaration(stmt)) {
    collectType(stmt, name);
  } else if (ts.isTypeAliasDeclaration(stmt)) {
    const type = typeTextOf(stmt.type);
    aliases.set(name, { name, type });
  } else if (ts.isEnumDeclaration(stmt)) {
    aliases.set(name, {
      name,
      type: 'enum: ' + stmt.members.map((m) => m.name.getText(sf)).join(' | '),
    });
  }
}

const tables = {};
for (const [key, typeName] of Object.entries(TABLE_TYPES)) {
  const iface = interfaces.get(typeName);
  if (!iface) {
    tables[key] = { key, label: key, idField: 'id', fields: [], missingType: typeName };
    continue;
  }
  tables[key] = {
    key,
    label: key,
    idField: 'id',
    fields: iface.fields.map((f) => ({
      key: f.key,
      label: f.key,
      required: f.required,
      tsType: f.type,
      ...(f.comment ? { description: f.comment } : {}),
    })),
  };
}

const out = {
  generatedAt: new Date().toISOString(),
  sourceFile: 'src/engine/types.ts',
  tables,
  /** 全部顶层类型索引（含未映射到表的辅助类型），供人工查阅 */
  indexedTypes: {
    interfaces: [...interfaces.values()].map((i) => ({
      name: i.name,
      fields: i.fields.map((f) => f.key),
    })),
    aliases: [...aliases.entries()].map(([name, a]) => ({ name, type: a.type })),
  },
};

mkdirSync(dirname(OUT_FILE), { recursive: true });
writeFileSync(OUT_FILE, JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log(`[gen-datapack-schema] wrote ${OUT_FILE}`);
console.log(`  tables: ${Object.keys(tables).join(', ')}`);
for (const [key, t] of Object.entries(tables)) {
  console.log(`  - ${key}: ${t.missingType ? `MISSING ${t.missingType}` : `${t.fields.length} fields`}`);
}
