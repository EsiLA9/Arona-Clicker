// ============================================================
// engine/anonymous-id.ts — 匿名结构确定性身份派生
//
// 为匿名（缺省 id）的 Affector / Trigger 派生稳定、可复现的运行时身份：
//   deriveAnonymousId(prefix, struct) = `${prefix}:<fnv1a(stableJson) hex>`
//
// 确定性要求：同一结构无论何时/何处序列化结果一致，保证
//  - once 完成记录（state.triggersCompleted）跨存档读写对得上；
//  - TagEffectRecord.source / activeEntryIds 在重放后保持稳定；
//  - 「以新加载 Datapack 为准」：后加载包若改了结构 → hash 变 → 新 id，
//    旧 once 记录自然失效（符合 AGENTS.md 不做迁移、清档重来纪律）。
// ============================================================

/** FNV-1a 32-bit 哈希 → 8 位 hex（确定性、非密码学用途）。 */
export function hashString(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** 对 JSON 可序列化值做 key 定序的稳定序列化：plain object 键排序，数组保序。 */
export function stableSerialize(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `[${value.map(v => stableSerialize(v)).join(',')}]`;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map(k => `${JSON.stringify(k)}:${stableSerialize(record[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * 为匿名结构派生确定性身份。结构内容不变 → id 不变。
 * 显式 id 与派生 id 不会碰撞：派生 id 一律带 `anon:` 前缀（三段式实体 id 约定不含该前缀）。
 */
export function deriveAnonymousId(prefix: string, value: unknown): string {
  return `${prefix}:${hashString(stableSerialize(value))}`;
}
