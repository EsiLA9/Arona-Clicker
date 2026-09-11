import type { UIContext } from '../context';
import type { PanelState } from './app-shell';
import { renderWorkspaceFrame } from './workspace-frame';

type SettingsServiceId = 'saves' | 'datapack' | 'records';

interface SettingsServiceEntry {
  id: SettingsServiceId;
  icon: string;
  title: string;
  description: string;
}

const SERVICE_ENTRIES: readonly SettingsServiceEntry[] = [
  { id: 'saves', icon: '↓', title: '存档管理', description: '保存、读取与当前进度状态' },
  { id: 'datapack', icon: '▦', title: '数据包管理', description: '包库、启用集与校验草案' },
  { id: 'records', icon: '✦', title: '记录与图鉴', description: '已发现内容、来源与统计' },
];

function renderServiceEntry(ctx: UIContext, entry: SettingsServiceEntry): string {
  return `
    <button type="button" class="service-card settings-service-entry" data-service="${entry.id}">
      <span class="settings-service-entry__icon" aria-hidden="true">${entry.icon}</span>
      <span class="settings-service-entry__copy"><strong>${ctx.escapeHtml(entry.title)}</strong><small>${ctx.escapeHtml(entry.description)}</small></span>
      <span class="settings-service-entry__arrow" aria-hidden="true">→</span>
    </button>`;
}

function renderSettingsNavigation(): string {
  return `
    <div class="service-column-title"><strong>设置</strong><span class="eyebrow">服务入口</span></div>
    <section class="service-card settings-navigation-card">
      <strong>管理工作区</strong>
      <p>从这里进入存档、数据包和记录服务。</p>
    </section>`;
}

function renderSettingsMain(ctx: UIContext): string {
  return `
    <div class="service-heading"><div><span class="eyebrow">SETTINGS WORKSPACE</span><h2>设置</h2><p>选择一个服务工作区继续管理本地游戏内容。</p></div></div>
    <div class="settings-service-list">${SERVICE_ENTRIES.map(entry => renderServiceEntry(ctx, entry)).join('')}</div>`;
}

function renderSettingsInspector(ctx: UIContext, state: PanelState): string {
  const activeInit = ctx.view.activeInit ? ctx.nameOf('init', ctx.view.activeInit) : '尚未进入世界线';
  const saveStatus = ctx.saveExists ? `本地存档可用 · ${activeInit}` : '尚无本地存档';
  const datapackStatus = state.datapackWorkspace
    ? state.datapackWorkspace.validation?.ok === false ? '数据包草案存在待处理问题' : '数据包草案已保留，可继续编辑'
    : '当前 Registry 已加载';

  return `
    <div class="service-column-title"><span class="eyebrow">INSPECTOR</span><strong>设置说明</strong></div>
    <section class="service-card"><h3>当前存档状态</h3><p>${ctx.escapeHtml(saveStatus)}</p></section>
    <section class="service-card"><h3>当前数据包状态</h3><p>${ctx.escapeHtml(datapackStatus)}</p></section>
    <section class="service-card settings-help-card"><h3>关于 / 帮助</h3><p>查看游戏说明、操作方式与当前界面的使用提示。</p><button type="button" id="help-modal" class="toolbar-button">打开帮助</button></section>`;
}

export function renderSettingsWorkspace(ctx: UIContext, state: PanelState): string {
  return renderWorkspaceFrame(ctx, {
    id: 'settings',
    left: {
      slot: 'left',
      role: 'navigation',
      hostId: 'leftPanel.service.settings.navigation',
      themeScope: 'left.settings.navigation',
      className: 'service-column service-navigation settings-navigation',
      content: renderSettingsNavigation(),
      scroll: 'auto',
    },
    center: {
      slot: 'center',
      role: 'primary',
      hostId: 'centerPanel.service.settings.main',
      themeScope: 'center.settings.main',
      className: 'service-column service-main settings-main',
      content: renderSettingsMain(ctx),
      scroll: 'content',
    },
    right: {
      slot: 'right',
      role: 'inspector',
      hostId: 'rightPanel.service.settings.inspector',
      themeScope: 'right.settings.inspector',
      className: 'service-column service-inspector settings-inspector',
      content: renderSettingsInspector(ctx, state),
      scroll: 'auto',
    },
  });
}
