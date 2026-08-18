// ============================================================
// engine/extra.ts — Extra 额外数据体系：格式构造、路径、合并、校验
// 设计文档: docs/13-extra-data-system.md（M1 格式底座）
// ============================================================

import { ExtraCompound, ExtraPath, ExtraValue } from './types';

/** 嵌套深度上限，防畸形数据打爆调用栈（设计文档 §3.3）。 */
export const EXTRA_MAX_DEPTH = 32;

export class ExtraError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExtraError';
  }
}

// --- 变体守卫（类型谓词）---

export function isInt(v: ExtraValue): v is { t: 'int'; v: number } { return v.t === 'int'; }
export function isFloat(v: ExtraValue): v is { t: 'float'; v: number } { return v.t === 'float'; }
export function isStr(v: ExtraValue): v is { t: 'str'; v: string } { return v.t === 'str'; }
export function isBool(v: ExtraValue): v is { t: 'bool'; v: boolean } { return v.t === 'bool'; }
export function isList(v: ExtraValue): v is { t: 'list'; v: ExtraValue[] } { return v.t === 'list'; }
export function isDict(v: ExtraValue): v is { t: 'dict'; v: Record<string, ExtraValue> } { return v.t === 'dict'; }

// --- 便捷构造器（数据包 TS 书写零负担）---

export const extra = {
  int: (v: number): ExtraValue => ({ t: 'int', v: Math.trunc(v) }),
  float: (v: number): ExtraValue => ({ t: 'float', v }),
  str: (v: string): ExtraValue => ({ t: 'str', v }),
  bool: (v: boolean): ExtraValue => ({ t: 'bool', v }),
  list: (...items: ExtraValue[]): ExtraValue => ({ t: 'list', v: items }),
  dict: (v: Record<string, ExtraValue>): ExtraCompound => ({ t: 'dict', v }),
};

/**
 * 从纯 TS 字面量（string/number/boolean/数组/纯对象）宽松转换。
 * 整数 number → int；带小数 → float；null/undefined 拒绝。
 * 转换递归时校验深度与 dict key 合法性。
 */
export function extraFromJson(raw: unknown, depth = 0): ExtraValue {
  if (depth > EXTRA_MAX_DEPTH) {
    throw new ExtraError(`Extra nesting exceeds max depth ${EXTRA_MAX_DEPTH}`);
  }
  if (raw === null || raw === undefined) {
    throw new ExtraError('Extra fromJson: null/undefined is not a valid node');
  }
  if (typeof raw === 'number') {
    return Number.isInteger(raw) ? extra.int(raw) : extra.float(raw);
  }
  if (typeof raw === 'string') return extra.str(raw);
  if (typeof raw === 'boolean') return extra.bool(raw);
  if (Array.isArray(raw)) {
    return extra.list(...raw.map(item => extraFromJson(item, depth + 1)));
  }
  if (typeof raw === 'object') {
    const record: Record<string, ExtraValue> = {};
    for (const [key, value] of Object.entries(raw)) {
      validateDictKey(key);
      record[key] = extraFromJson(value, depth + 1);
    }
    return extra.dict(record);
  }
  throw new ExtraError(`Extra fromJson: unsupported value type "${typeof raw}"`);
}

// --- 深度克隆（纯 JSON 结构，递归实现）---

export function cloneExtra(v: ExtraValue): ExtraValue {
  switch (v.t) {
    case 'int':
    case 'float':
    case 'str':
    case 'bool':
      return { t: v.t, v: v.v } as ExtraValue;
    case 'list':
      return { t: 'list', v: v.v.map(cloneExtra) };
    case 'dict': {
      const out: Record<string, ExtraValue> = {};
      for (const [key, child] of Object.entries(v.v)) out[key] = cloneExtra(child);
      return { t: 'dict', v: out };
    }
  }
}

// --- 路径解析与寻址 ---

const LIST_INDEX_RE = /^\d+$/;

function validateDictKey(key: string): void {
  if (key === '') {
    throw new ExtraError('Extra dict key must not be empty');
  }
  if (key.includes('/')) {
    throw new ExtraError(`Extra dict key must not contain '/': "${key}"`);
  }
}

/** 解析路径为段数组；空段 / 首尾 '/' / '//' 均非法，抛 ExtraError。 */
export function parseExtraPath(path: ExtraPath): string[] {
  if (path === '') throw new ExtraError('Extra path must not be empty');
  if (path.startsWith('/') || path.endsWith('/')) {
    throw new ExtraError(`Extra path must not start/end with '/': "${path}"`);
  }
  const segments = path.split('/');
  for (const seg of segments) {
    if (seg === '') throw new ExtraError(`Extra path contains empty segment: "${path}"`);
  }
  return segments;
}

/** 取路径下的节点；缺失返回 undefined（不抛错，宽松读取）。 */
export function getAtPath(root: ExtraValue | undefined, path: ExtraPath): ExtraValue | undefined {
  if (root === undefined) return undefined;
  const segments = parseExtraPath(path);
  let node: ExtraValue | undefined = root;
  for (let i = 0; i < segments.length && node !== undefined; i++) {
    const seg = segments[i];
    if (isDict(node)) {
      node = node.v[seg];
    } else if (isList(node) && LIST_INDEX_RE.test(seg)) {
      node = node.v[Number(seg)];
    } else {
      return undefined;
    }
  }
  return node;
}

/**
 * 沿路径写入节点（原地修改，返回树根）。
 * - 中间节点缺失时自动创建 dict；list 索引段仅允许落在 list 节点上；
 * - list 末段索引 === 当前长度时 push，超长抛错；
 * - 中间节点类型不匹配（无法下钻）抛错，保证不静默丢数据。
 */
export function setAtPath(root: ExtraValue | undefined, path: ExtraPath, value: ExtraValue): ExtraValue {
  const segments = parseExtraPath(path);
  let node: ExtraValue = root ?? extra.dict({});
  const tree = node;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const isLast = i === segments.length - 1;
    if (isDict(node)) {
      if (isLast) {
        node.v[seg] = value;
        return tree;
      }
      const child = node.v[seg];
      if (child === undefined) {
        node.v[seg] = extra.dict({});
      } else if (!isDict(child) && !(isList(child) && LIST_INDEX_RE.test(segments[i + 1]))) {
        throw new ExtraError(`Extra setAtPath: cannot drill into non-container "${seg}"`);
      }
      node = node.v[seg];
    } else if (isList(node) && LIST_INDEX_RE.test(seg)) {
      const idx = Number(seg);
      if (isLast) {
        if (idx === node.v.length) node.v.push(value);
        else if (idx < node.v.length) node.v[idx] = value;
        else throw new ExtraError(`Extra setAtPath: list index ${idx} out of bounds`);
        return tree;
      }
      let child = node.v[idx];
      if (child === undefined) {
        child = extra.dict({});
        node.v[idx] = child;
      } else if (!isDict(child)) {
        throw new ExtraError(`Extra setAtPath: cannot drill into list item ${idx}`);
      }
      node = child;
    } else {
      throw new ExtraError(`Extra setAtPath: "${seg}" is not reachable`);
    }
  }
  return tree;
}

/** 沿路径删除节点；返回被删除的节点，不存在返回 undefined。 */
export function deleteAtPath(root: ExtraValue | undefined, path: ExtraPath): ExtraValue | undefined {
  if (root === undefined) return undefined;
  const segments = parseExtraPath(path);
  if (segments.length === 0) return undefined;
  const lastSeg = segments[segments.length - 1];
  // 顶层（单段路径）：直接在 root 上删除
  if (segments.length === 1) {
    if (isDict(root)) {
      if (!(lastSeg in root.v)) return undefined;
      const removed = root.v[lastSeg];
      delete root.v[lastSeg];
      return removed;
    }
    if (isList(root) && LIST_INDEX_RE.test(lastSeg)) {
      const idx = Number(lastSeg);
      if (idx >= root.v.length) return undefined;
      return root.v.splice(idx, 1)[0];
    }
    return undefined;
  }
  const parentSegs = segments.slice(0, -1);
  const parent = getAtPath(root, parentSegs.join('/'));
  if (parent === undefined) return undefined;
  if (isDict(parent)) {
    if (!(lastSeg in parent.v)) return undefined;
    const removed = parent.v[lastSeg];
    delete parent.v[lastSeg];
    return removed;
  }
  if (isList(parent) && LIST_INDEX_RE.test(lastSeg)) {
    const idx = Number(lastSeg);
    if (idx >= parent.v.length) return undefined;
    return parent.v.splice(idx, 1)[0];
  }
  return undefined;
}

// --- 合并与展开 ---

/**
 * 深合并：source 覆盖 target 同名 key；dict 递归合并，list/标量整体替换。
 * 返回 target（原地修改）。source 的 key 合法性由 validateDictKey 保证。
 */
export function mergeExtra(target: ExtraCompound, source: ExtraValue, depth = 0): ExtraCompound {
  if (depth > EXTRA_MAX_DEPTH) {
    throw new ExtraError(`Extra nesting exceeds max depth ${EXTRA_MAX_DEPTH}`);
  }
  if (!isDict(source)) {
    throw new ExtraError('Extra mergeExtra: source must be a dict');
  }
  for (const [key, value] of Object.entries(source.v)) {
    const existing = target.v[key];
    if (existing !== undefined && isDict(existing) && isDict(value)) {
      mergeExtra(existing, value, depth + 1);
    } else {
      target.v[key] = cloneExtra(value);
    }
  }
  return target;
}

/**
 * 展开扁平键（'a/b' → 树）为 dict。用于数据包 extras 常量表加载（M2）。
 * 扁平键与既有树冲突（'a/b' 与 'a' 并存）时抛错。
 */
export function expandFlatKeys(extras: Record<string, ExtraValue>): ExtraCompound {
  const root = extra.dict({});
  for (const [key, value] of Object.entries(extras)) {
    const segments = parseExtraPath(key);
    const target = extra.dict({});
    if (segments.length === 1) {
      const seg = segments[0];
      if (root.v[seg] !== undefined) {
        throw new ExtraError(`Extra expandFlatKeys: conflicting key "${key}"`);
      }
      root.v[seg] = cloneExtra(value);
    } else {
      const last = segments[segments.length - 1];
      const parentSegs = segments.slice(0, -1);
      const existing = getAtPath(root, parentSegs.join('/'));
      if (existing !== undefined && !isDict(existing)) {
        throw new ExtraError(`Extra expandFlatKeys: conflict at "${key}" (non-dict node)`);
      }
      const parent = (existing as ExtraCompound | undefined) ?? extra.dict({});
      if (parent.v[last] !== undefined) {
        throw new ExtraError(`Extra expandFlatKeys: conflicting key "${key}"`);
      }
      parent.v[last] = cloneExtra(value);
      setAtPath(root, parentSegs.join('/'), parent);
    }
  }
  return root;
}

// --- 宽松读取（缺失即默认，不抛错）---

/** int/float → 数值；bool → 1/0；str/list/dict/缺失 → 0。 */
export function toNumber(v: ExtraValue | undefined): number {
  if (v === undefined) return 0;
  switch (v.t) {
    case 'int':
    case 'float':
      return v.v;
    case 'bool':
      return v.v ? 1 : 0;
    default:
      return 0;
  }
}

/** 仅 str 返回其值；其余（含缺失）→ ''。 */
export function toString(v: ExtraValue | undefined): string {
  return v !== undefined && isStr(v) ? v.v : '';
}

/** 仅 bool 返回其值；其余（含缺失）→ false。 */
export function toBool(v: ExtraValue | undefined): boolean {
  return v !== undefined && isBool(v) ? v.v : false;
}

export function readNumber(root: ExtraValue | undefined, path: ExtraPath): number {
  return toNumber(getAtPath(root, path));
}

export function readString(root: ExtraValue | undefined, path: ExtraPath): string {
  return toString(getAtPath(root, path));
}

export function readBool(root: ExtraValue | undefined, path: ExtraPath): boolean {
  return toBool(getAtPath(root, path));
}

// --- 校验（收集错误，不抛错）---

/**
 * 递归校验树形结构，返回错误信息数组（空数组 = 合法）。
 * 校验项：深度 ≤ EXTRA_MAX_DEPTH、dict key 非空且不含 '/',
 * int 值必须为整数、list/dict 值类型正确。
 */
export function validateExtraValue(v: ExtraValue, depth = 0): string[] {
  const errors: string[] = [];
  if (depth > EXTRA_MAX_DEPTH) {
    errors.push(`nesting exceeds max depth ${EXTRA_MAX_DEPTH}`);
    return errors;
  }
  switch (v.t) {
    case 'int':
      if (!Number.isInteger(v.v)) errors.push(`int value ${v.v} is not an integer`);
      break;
    case 'float':
      break;
    case 'str':
      break;
    case 'bool':
      break;
    case 'list':
      if (!Array.isArray(v.v)) errors.push('list value is not an array');
      else v.v.forEach((item, i) => {
        for (const e of validateExtraValue(item, depth + 1)) errors.push(`list[${i}]: ${e}`);
      });
      break;
    case 'dict':
      for (const [key, child] of Object.entries(v.v)) {
        try {
          validateDictKey(key);
        } catch (err) {
          errors.push(`key "${key}": ${(err as Error).message}`);
          continue;
        }
        for (const e of validateExtraValue(child, depth + 1)) errors.push(`"${key}": ${e}`);
      }
      break;
    default: {
      // 穷举校验：未知变体
      const t = (v as { t?: string }).t;
      errors.push(`unknown variant "${String(t)}"`);
    }
  }
  return errors;
}

/** 校验并抛错（首个错误即抛），供 Def / 数据包静态校验调用。 */
export function assertValidExtra(v: ExtraValue): void {
  const errors = validateExtraValue(v);
  if (errors.length > 0) {
    throw new ExtraError(`Invalid extra data: ${errors.join('; ')}`);
  }
}
