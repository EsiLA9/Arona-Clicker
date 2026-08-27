// ============================================================
// engine/extra-path.ts — Extra 路径解析与寻址（parse/get/set/delete）
// ============================================================

import { ExtraPath, ExtraValue } from '../types';
import { ExtraError, isDict, isList } from './extra-core';
import { extra } from '../def-factory/extra';

const LIST_INDEX_RE = /^\d+$/;

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