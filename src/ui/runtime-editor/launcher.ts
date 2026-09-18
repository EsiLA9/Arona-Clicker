import type { UIController } from '../controller';

export type RuntimeEditorLauncherAction = string;

export interface RuntimeEditorLauncherEntry {
  readonly id: string;
  readonly label: string;
  readonly action: RuntimeEditorLauncherAction;
  readonly order: number;
  readonly isAvailable?: (ctrl: UIController) => boolean;
  readonly onSelect?: (ctrl: UIController) => void;
}

/** Runtime Editor 入口注册表：未来入口只需追加描述，不改浮窗布局与事件委托。 */
export const RUNTIME_EDITOR_LAUNCHER_ENTRIES: readonly RuntimeEditorLauncherEntry[] = [
  { id: 'mod-info', label: '编辑中 Mod 信息设置', action: 'mod-info', order: 10 },
  { id: 'create-init', label: '新建 Init', action: 'create-init', order: 20 },
  { id: 'create-area', label: '新建 Area', action: 'create-area', order: 30 },
  { id: 'create-spot', label: '新建 Spot', action: 'create-spot', order: 40 },
];

const registeredEntries = new Map<string, RuntimeEditorLauncherEntry>();

export function registerRuntimeEditorLauncherEntry(entry: RuntimeEditorLauncherEntry): () => void {
  registeredEntries.set(entry.id, entry);
  return () => {
    if (registeredEntries.get(entry.id) === entry) registeredEntries.delete(entry.id);
  };
}

export function runtimeEditorLauncherEntries(
  extras: readonly RuntimeEditorLauncherEntry[] = [],
): RuntimeEditorLauncherEntry[] {
  return [...RUNTIME_EDITOR_LAUNCHER_ENTRIES, ...registeredEntries.values(), ...extras].sort((left, right) => left.order - right.order);
}
