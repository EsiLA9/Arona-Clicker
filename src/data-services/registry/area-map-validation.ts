import type { AreaMapDef } from '../contracts/area-map';
import type { AreaDef } from '../contracts/world';
import { parseEntityId } from '../../engine/core/entity-id';
import { parsePicId } from '../contracts/pic';

type Fail = (message: string) => never;
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Per-pack shape validation deliberately does not resolve external references. */
export function validateAreaMapShapes(input: unknown, fail: Fail): void {
  if (input === undefined) return;
  if (!Array.isArray(input)) fail('areaMaps 必须是数组');
  const maps = new Set<string>();
  const ref = (value: unknown, type: string, path: string): void => {
    if (typeof value !== 'string' || parseEntityId(value)?.type !== type) fail(`${path} 必须是完整 ${type} ID`);
  };
  const text = (value: unknown, path: string): void => {
    if (value !== undefined && typeof value !== 'string') fail(`${path} 必须是字符串`);
  };
  const reveal = (value: unknown, path: string): void => {
    if (value === undefined) return;
    if (!Array.isArray(value)) fail(`${path} 必须是数组`);
    for (const trigger of value) {
      if (!record(trigger) || !['existence', 'name', 'condition', 'utility', 'unlock'].includes(String(trigger.reveal)) ||
        (trigger.condition !== undefined && !record(trigger.condition))) fail(`${path} 含非法 RevealTrigger`);
    }
  };
  for (const [index, value] of input.entries()) {
    const path = `areaMaps[${index}]`;
    if (!record(value)) fail(`${path} 必须是对象`);
    ref(value.id, 'area-map', `${path}.id`);
    if (maps.has(value.id as string)) fail(`${path}.id 重复`);
    maps.add(value.id as string);
    if (typeof value.name !== 'string' || !value.name.trim()) fail(`${path}.name 不能为空`);
    text(value.description, `${path}.description`);
    reveal(value.revealTriggers, `${path}.revealTriggers`);
    if (!Array.isArray(value.nodes) || !Array.isArray(value.edges)) fail(`${path}.nodes / edges 必须是数组`);
    const nodes = new Set<string>();
    for (const [n, node] of value.nodes.entries()) {
      const at = `${path}.nodes[${n}]`;
      if (!record(node) || typeof node.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(node.id)) fail(`${at}.id 非法`);
      if (nodes.has(node.id)) fail(`${at}.id 重复`);
      nodes.add(node.id);
      if (!record(node.position) || typeof node.position.x !== 'number' || typeof node.position.y !== 'number' ||
        !Number.isFinite(node.position.x) || !Number.isFinite(node.position.y)) fail(`${at}.position 必须是有限坐标`);
      text(node.name, `${at}.name`); text(node.description, `${at}.description`);
      reveal(node.revealTriggers, `${at}.revealTriggers`);
      if (node.appearance !== undefined) {
        if (!record(node.appearance)) fail(`${at}.appearance 非法`);
        if (node.appearance.kind !== undefined && !['point', 'landmark', 'portal'].includes(String(node.appearance.kind))) fail(`${at}.appearance.kind 非法`);
        if (node.appearance.iconPicId !== undefined && (typeof node.appearance.iconPicId !== 'string' || !parsePicId(node.appearance.iconPicId))) fail(`${at}.appearance.iconPicId 必须是完整 Pic ID`);
      }
      if (node.action !== undefined) {
        if (!record(node.action)) fail(`${at}.action 非法`);
        const action = node.action;
        if (action.kind === 'openMap') ref(action.mapId, 'area-map', `${at}.action.mapId`);
        else if (action.kind === 'attemptAreaTravel') ref(action.areaId, 'area', `${at}.action.areaId`);
        else if (action.kind !== 'inspect') fail(`${at}.action.kind 非法`);
        const keys = action.kind === 'openMap' ? ['kind', 'mapId'] : action.kind === 'attemptAreaTravel' ? ['kind', 'areaId'] : ['kind'];
        if (Object.keys(action).some(key => !keys.includes(key))) fail(`${at}.action 含未允许字段`);
      }
    }
    const edges = new Set<string>();
    for (const [e, edge] of value.edges.entries()) {
      const at = `${path}.edges[${e}]`;
      if (!record(edge) || !nodes.has(String(edge.fromNodeId)) || !nodes.has(String(edge.toNodeId))) fail(`${at} 端点必须属于当前图`);
      const key = JSON.stringify([edge.fromNodeId, edge.toNodeId]);
      if (edges.has(key)) fail(`${at} 重复连线`);
      edges.add(key);
    }
  }
}

/** Resolve the final enabled set after overrides; no recursion or hierarchy assumptions. */
export function validateAreaMapReferences(
  maps: ReadonlyMap<string, AreaMapDef>, areas: ReadonlyMap<string, AreaDef>,
  pics: ReadonlyMap<string, unknown>, fail: Fail,
): void {
  for (const area of areas.values()) {
    if (area.navigationMapId !== undefined && !maps.has(area.navigationMapId)) fail(`Area "${area.id}" navigationMapId 引用不存在的区域地图`);
  }
  for (const map of maps.values()) for (const node of map.nodes) {
    const path = `areaMaps[${map.id}].nodes[${node.id}]`;
    const action = node.action;
    if (action?.kind === 'openMap' && !maps.has(action.mapId)) fail(`${path}.action.mapId 引用不存在的区域地图`);
    if (action?.kind === 'attemptAreaTravel' && !areas.has(action.areaId)) fail(`${path}.action.areaId 引用不存在的区域`);
    if (node.appearance?.iconPicId && !pics.has(node.appearance.iconPicId)) fail(`${path}.appearance.iconPicId 引用不存在的图片`);
  }
}
