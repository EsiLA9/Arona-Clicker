import { registerUIService, type UIServiceDefinition } from './ui-host-registry';

function workspaceHosts(serviceId: string, label: string): UIServiceDefinition['hosts'] {
  return [
    { id: `leftPanel.service.${serviceId}.navigation`, label: `${label}导航`, level: 'region', parent: 'leftPanel', kind: 'container', serviceId, workspaceOwner: serviceId },
    { id: `centerPanel.service.${serviceId}.main`, label: `${label}主工作区`, level: 'region', parent: 'centerPanel', kind: 'container', serviceId, workspaceOwner: serviceId },
    { id: `rightPanel.service.${serviceId}.inspector`, label: `${label}检查区`, level: 'region', parent: 'rightPanel', kind: 'container', serviceId, workspaceOwner: serviceId },
  ];
}

export const UI_SERVICE_DEFINITIONS: readonly UIServiceDefinition[] = [
  {
    id: 'settings',
    label: '设置服务',
    hosts: workspaceHosts('settings', '设置服务'),
  },
  {
    id: 'inventory',
    label: '背包服务',
    hosts: workspaceHosts('inventory', '背包服务'),
  },
  {
    id: 'datapack',
    label: '数据包服务',
    hosts: [
      { id: 'centerPanel.datapack', label: '数据包服务主面板', level: 'region', parent: 'centerPanel', kind: 'container', serviceId: 'datapack' },
      { id: 'centerPanel.datapack.navigation', label: '数据包服务导航', level: 'control', parent: 'centerPanel.datapack', kind: 'container', serviceId: 'datapack' },
      { id: 'centerPanel.datapack.main', label: '数据包服务主工作区', level: 'control', parent: 'centerPanel.datapack', kind: 'container', serviceId: 'datapack' },
      { id: 'centerPanel.datapack.inspector', label: '数据包服务检查区', level: 'control', parent: 'centerPanel.datapack', kind: 'container', serviceId: 'datapack' },
      ...workspaceHosts('datapack', '数据包服务'),
    ],
  },
  {
    id: 'saves',
    label: '存档服务',
    hosts: [
      { id: 'centerPanel.saves', label: '存档服务主面板', level: 'region', parent: 'centerPanel', kind: 'container', serviceId: 'saves' },
      { id: 'centerPanel.saves.list', label: '存档列表', level: 'control', parent: 'centerPanel.saves', kind: 'container', serviceId: 'saves' },
      { id: 'centerPanel.saves.navigation', label: '存档服务导航', level: 'control', parent: 'centerPanel.saves', kind: 'container', serviceId: 'saves' },
      { id: 'centerPanel.saves.main', label: '存档服务主工作区', level: 'control', parent: 'centerPanel.saves', kind: 'container', serviceId: 'saves' },
      { id: 'centerPanel.saves.inspector', label: '存档服务检查区', level: 'control', parent: 'centerPanel.saves', kind: 'container', serviceId: 'saves' },
      ...workspaceHosts('saves', '存档服务'),
    ],
  },
  {
    id: 'contacts',
    label: '通讯录服务',
    hosts: [
      { id: 'centerPanel.contacts', label: '通讯录服务主面板', level: 'region', parent: 'centerPanel', kind: 'container', serviceId: 'contacts' },
      { id: 'centerPanel.contacts.navigation', label: '通讯录导航', level: 'control', parent: 'centerPanel.contacts', kind: 'container', serviceId: 'contacts' },
      { id: 'centerPanel.contacts.main', label: '通讯录主工作区', level: 'control', parent: 'centerPanel.contacts', kind: 'container', serviceId: 'contacts' },
      { id: 'centerPanel.contacts.inspector', label: '通讯录检查区', level: 'control', parent: 'centerPanel.contacts', kind: 'container', serviceId: 'contacts' },
      ...workspaceHosts('contacts', '通讯录'),
    ],
  },
  {
    id: 'story',
    label: '故事服务',
    hosts: workspaceHosts('story', '故事'),
  },
  {
    id: 'archive',
    label: '档案服务',
    hosts: [
      { id: 'centerPanel.archive', label: '档案服务主面板', level: 'region', parent: 'centerPanel', kind: 'container', serviceId: 'archive' },
      { id: 'centerPanel.archive.navigation', label: '档案导航', level: 'control', parent: 'centerPanel.archive', kind: 'container', serviceId: 'archive' },
      { id: 'centerPanel.archive.main', label: '档案主工作区', level: 'control', parent: 'centerPanel.archive', kind: 'container', serviceId: 'archive' },
      { id: 'centerPanel.archive.inspector', label: '档案检查区', level: 'control', parent: 'centerPanel.archive', kind: 'container', serviceId: 'archive' },
      ...workspaceHosts('archive', '档案'),
    ],
  },
  {
    id: 'records',
    label: '记录服务',
    hosts: [
      { id: 'centerPanel.records', label: '记录服务主面板', level: 'region', parent: 'centerPanel', kind: 'container', serviceId: 'records' },
      { id: 'centerPanel.records.navigation', label: '记录服务导航', level: 'control', parent: 'centerPanel.records', kind: 'container', serviceId: 'records' },
      { id: 'centerPanel.records.main', label: '记录服务主工作区', level: 'control', parent: 'centerPanel.records', kind: 'container', serviceId: 'records' },
      { id: 'centerPanel.records.inspector', label: '记录服务检查区', level: 'control', parent: 'centerPanel.records', kind: 'container', serviceId: 'records' },
      ...workspaceHosts('records', '记录服务'),
    ],
  },
  {
    id: 'shop',
    label: 'Spot 商店',
    hosts: [
      { id: 'leftPanel.shop.feed', label: '商店店内消息', level: 'region', parent: 'leftPanel', kind: 'container', serviceId: 'shop' },
      { id: 'centerPanel.shop.catalog', label: '商店商品目录', level: 'region', parent: 'centerPanel', kind: 'container', serviceId: 'shop' },
      { id: 'rightPanel.shop.settlement', label: '商店持有与结算', level: 'region', parent: 'rightPanel', kind: 'container', serviceId: 'shop' },
    ],
  },
  {
    id: 'character',
    label: '角色服务',
    hosts: [
      { id: 'leftPanel.character.contacts', label: '角色通讯录', level: 'region', parent: 'leftPanel', kind: 'container', serviceId: 'character' },
      { id: 'centerPanel.character.story', label: '角色学生故事', level: 'region', parent: 'centerPanel', kind: 'container', serviceId: 'character' },
      { id: 'rightPanel.character.progression', label: '角色成长', level: 'region', parent: 'rightPanel', kind: 'container', serviceId: 'character' },
    ],
  },
];

for (const service of UI_SERVICE_DEFINITIONS) registerUIService(service);
