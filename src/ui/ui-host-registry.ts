import type { PresentationHostState } from '../engine/types/theme';

export type UIHostLevel = 'global' | 'cluster' | 'region' | 'control';
export type UIHostKind = 'background' | 'container' | 'button' | 'tab' | 'card' | 'bubble';

export interface UIHostDefinition {
  readonly id: string;
  readonly label: string;
  readonly level: UIHostLevel;
  readonly kind: UIHostKind;
  readonly parent?: string;
  readonly states?: readonly PresentationHostState[];
  readonly serviceId?: string;
  readonly legacyRegion?: string;
  readonly editable?: boolean;
}

export interface UIHostRegistryIssue {
  readonly hostId?: string;
  readonly code: 'missing-parent' | 'parent-cycle' | 'invalid-level' | 'invalid-service';
  readonly message: string;
}

export interface UIServiceDefinition {
  readonly id: string;
  readonly label: string;
  readonly hosts: readonly UIHostDefinition[];
}

const LEVEL_RANK: Record<UIHostLevel, number> = { global: 0, cluster: 1, region: 2, control: 3 };
const HOST_STATES = new Set<PresentationHostState>(['default', 'active', 'inactive', 'disabled']);

export class UIHostRegistry {
  private readonly hostsById = new Map<string, UIHostDefinition>();
  private readonly servicesById = new Map<string, UIServiceDefinition>();

  constructor(hosts: readonly UIHostDefinition[] = [], services: readonly UIServiceDefinition[] = []) {
    for (const host of hosts) this.registerHost(host);
    for (const service of services) this.registerService(service);
  }

  registerHost(host: UIHostDefinition): void {
    if (this.hostsById.has(host.id)) throw new Error(`UI Host ID 重复：${host.id}`);
    this.hostsById.set(host.id, Object.freeze({ ...host, states: host.states ? [...host.states] : undefined }));
  }

  registerService(service: UIServiceDefinition): void {
    if (this.servicesById.has(service.id)) throw new Error(`UI 服务 ID 重复：${service.id}`);
    this.servicesById.set(service.id, service);
    for (const host of service.hosts) {
      if (host.serviceId && host.serviceId !== service.id) throw new Error(`UI Host ${host.id} 的 serviceId 与服务定义不一致。`);
      this.registerHost({ ...host, serviceId: service.id });
    }
  }

  all(): readonly UIHostDefinition[] { return [...this.hostsById.values()]; }
  get(id: string): UIHostDefinition | undefined { return this.hostsById.get(id); }
  childrenOf(parentId: string): readonly UIHostDefinition[] { return this.all().filter(host => host.parent === parentId); }
  descendantsOf(parentId: string): readonly UIHostDefinition[] {
    const result: UIHostDefinition[] = [];
    const queue = [...this.childrenOf(parentId)];
    while (queue.length) { const host = queue.shift()!; result.push(host); queue.push(...this.childrenOf(host.id)); }
    return result;
  }
  resolveParent(id: string): readonly UIHostDefinition[] {
    const result: UIHostDefinition[] = [];
    const seen = new Set<string>();
    let current = this.get(id)?.parent;
    while (current && !seen.has(current)) { seen.add(current); const parent = this.get(current); if (!parent) break; result.push(parent); current = parent.parent; }
    return result;
  }
  forService(serviceId: string): readonly UIHostDefinition[] { return this.all().filter(host => host.serviceId === serviceId); }

  validate(): readonly UIHostRegistryIssue[] {
    const issues: UIHostRegistryIssue[] = [];
    for (const host of this.all()) {
      if (host.parent && !this.get(host.parent)) issues.push({ hostId: host.id, code: 'missing-parent', message: `UI Host ${host.id} 的父级不存在：${host.parent}` });
      if (this.hasParentCycle(host.id)) issues.push({ hostId: host.id, code: 'parent-cycle', message: `UI Host ${host.id} 存在父级循环。` });
      const parent = host.parent ? this.get(host.parent) : undefined;
      if (parent && LEVEL_RANK[host.level] < LEVEL_RANK[parent.level]) issues.push({ hostId: host.id, code: 'invalid-level', message: `UI Host ${host.id} 的层级不能高于父级。` });
      if (host.states?.some(state => !HOST_STATES.has(state))) issues.push({ hostId: host.id, code: 'invalid-level', message: `UI Host ${host.id} 的状态非法。` });
      if (host.serviceId && !this.servicesById.has(host.serviceId)) issues.push({ hostId: host.id, code: 'invalid-service', message: `UI Host ${host.id} 所属服务不存在：${host.serviceId}` });
    }
    return issues;
  }

  private hasParentCycle(id: string): boolean {
    const seen = new Set<string>();
    let current: string | undefined = id;
    while (current) { if (seen.has(current)) return true; seen.add(current); current = this.get(current)?.parent; }
    return false;
  }
}

const CORE_HOSTS: readonly UIHostDefinition[] = [
  { id: 'global', label: '全局背景', level: 'global', kind: 'background', editable: false },
  { id: 'shell', label: '整体外壳', level: 'cluster', parent: 'global', kind: 'container' },
  { id: 'header', label: '顶部栏', level: 'cluster', parent: 'shell', kind: 'container', legacyRegion: 'header' },
  { id: 'leftPanel', label: '左侧栏', level: 'cluster', parent: 'shell', kind: 'container', legacyRegion: 'leftPanel' },
  { id: 'centerPanel', label: '中部栏', level: 'cluster', parent: 'shell', kind: 'container', legacyRegion: 'centerPanel' },
  { id: 'rightPanel', label: '右侧栏', level: 'cluster', parent: 'shell', kind: 'container', legacyRegion: 'rightPanel' },
  { id: 'footer', label: '底部栏', level: 'cluster', parent: 'shell', kind: 'container', legacyRegion: 'footer' },
  { id: 'story', label: '剧情区', level: 'region', parent: 'shell', kind: 'container', legacyRegion: 'story' },
  { id: 'modal', label: '弹窗', level: 'region', parent: 'shell', kind: 'container', legacyRegion: 'modal' },
  { id: 'leftPanel.area', label: '左侧栏 · 区域', level: 'region', parent: 'leftPanel', kind: 'container' },
  { id: 'leftPanel.contacts', label: '左侧栏 · 通讯录', level: 'region', parent: 'leftPanel', kind: 'container' },
  { id: 'leftPanel.story', label: '左侧栏 · 故事', level: 'region', parent: 'leftPanel', kind: 'container' },
  { id: 'centerPanel.chat', label: '中部栏 · 聊天', level: 'region', parent: 'centerPanel', kind: 'container' },
  { id: 'centerPanel.log', label: '中部栏 · 日志', level: 'region', parent: 'centerPanel', kind: 'container' },
  { id: 'rightPanel.spot', label: '右侧栏 · 设施', level: 'region', parent: 'rightPanel', kind: 'container' },
  { id: 'rightPanel.character', label: '右侧栏 · 学生', level: 'region', parent: 'rightPanel', kind: 'container' },
  { id: 'rightPanel.enh', label: '右侧栏 · 强化', level: 'region', parent: 'rightPanel', kind: 'container' },
  { id: 'rightPanel.other', label: '右侧栏 · 其他', level: 'region', parent: 'rightPanel', kind: 'container' },
  { id: 'header.button', label: '顶部按钮', level: 'control', parent: 'header', kind: 'button' },
  { id: 'leftPanel.tab', label: '左侧 Tab', level: 'control', parent: 'leftPanel', kind: 'tab' },
  { id: 'centerPanel.tab', label: '中部 Tab', level: 'control', parent: 'centerPanel', kind: 'tab' },
  { id: 'rightPanel.tab', label: '右侧 Tab', level: 'control', parent: 'rightPanel', kind: 'tab' },
  { id: 'card', label: '信息卡片', level: 'control', parent: 'shell', kind: 'card' },
  { id: 'card.action', label: '卡片操作按钮', level: 'control', parent: 'card', kind: 'button' },
  { id: 'bubble', label: '聊天气泡', level: 'control', parent: 'centerPanel', kind: 'bubble' },
];

export const UI_HOST_REGISTRY = new UIHostRegistry(CORE_HOSTS);
export function registerUIService(service: UIServiceDefinition): void { UI_HOST_REGISTRY.registerService(service); }
