import { registerUIService, type UIServiceDefinition } from './ui-host-registry';

export const UI_SERVICE_DEFINITIONS: readonly UIServiceDefinition[] = [
  {
    id: 'datapack',
    label: '数据包服务',
    hosts: [
      { id: 'centerPanel.datapack', label: '数据包服务主面板', level: 'region', parent: 'centerPanel', kind: 'container', serviceId: 'datapack' },
      { id: 'centerPanel.datapack.navigation', label: '数据包服务导航', level: 'control', parent: 'centerPanel.datapack', kind: 'container', serviceId: 'datapack' },
      { id: 'centerPanel.datapack.main', label: '数据包服务主工作区', level: 'control', parent: 'centerPanel.datapack', kind: 'container', serviceId: 'datapack' },
      { id: 'centerPanel.datapack.inspector', label: '数据包服务检查区', level: 'control', parent: 'centerPanel.datapack', kind: 'container', serviceId: 'datapack' },
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
    ],
  },
  {
    id: 'archive',
    label: '档案服务',
    hosts: [
      { id: 'centerPanel.archive', label: '档案服务主面板', level: 'region', parent: 'centerPanel', kind: 'container', serviceId: 'archive' },
      { id: 'centerPanel.archive.navigation', label: '档案导航', level: 'control', parent: 'centerPanel.archive', kind: 'container', serviceId: 'archive' },
      { id: 'centerPanel.archive.main', label: '档案主工作区', level: 'control', parent: 'centerPanel.archive', kind: 'container', serviceId: 'archive' },
      { id: 'centerPanel.archive.inspector', label: '档案检查区', level: 'control', parent: 'centerPanel.archive', kind: 'container', serviceId: 'archive' },
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
    ],
  },
];

for (const service of UI_SERVICE_DEFINITIONS) registerUIService(service);
