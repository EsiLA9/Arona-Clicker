export type PresentationTargetLevel = 'global' | 'cluster' | 'region' | 'control';

export interface PresentationTargetDef {
  id: string;
  label: string;
  level: PresentationTargetLevel;
  parent?: string;
  kind: 'background' | 'container' | 'button' | 'tab' | 'card' | 'bubble';
  legacyRegion?: string;
}

export const PRESENTATION_TARGETS: readonly PresentationTargetDef[] = [
  { id: 'global', label: '全局背景', level: 'global', kind: 'background' },
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
  { id: 'bubble', label: '聊天气泡', level: 'control', parent: 'centerPanel', kind: 'bubble' },
];

export function presentationTargetForLegacyRegion(region: string): PresentationTargetDef | undefined {
  return PRESENTATION_TARGETS.find(target => target.legacyRegion === region);
}
