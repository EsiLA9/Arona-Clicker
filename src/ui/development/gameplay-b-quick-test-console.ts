import type { GameInstance } from '../../arona-clicker/runtime-game-instance';
import '../css/gameplay-b-quick-test-console.css';

const SCHALE_OFFICE_INIT_ID = 'base:init:schale_office';
const GET_VALUE_USAGE = '用法：getValue modid:typeid:itemid [valueNum]。首期类别：resource、chara、spot。';

const TEST_CHARACTERS = {
  Hoshino: { aliases: ['hoshino', '星野', '小鸟游星野'], displayName: '小鸟游星野' },
  Serika: { aliases: ['serika', '芹香', '黑见芹香'], displayName: '黑见芹香' },
  Shiroko: { aliases: ['shiroko', '白子', '砂狼白子'], displayName: '砂狼白子' },
} as const;

type TestCharacterId = keyof typeof TEST_CHARACTERS;

export type GameplayBQuickTestCommandResult =
  | { readonly ok: true; readonly variantIds: readonly TestCharacterId[] }
  | { readonly ok: false; readonly message: string };

export type GameplayBQuickTestConsoleCommand =
  | { readonly ok: true; readonly kind: 'grantCharacters'; readonly variantIds: readonly TestCharacterId[] }
  | {
    readonly ok: true;
    readonly kind: 'getValue';
    readonly modId: string;
    readonly typeId: string;
    readonly itemId: string;
    readonly valueNum: number;
    readonly valueNumProvided: boolean;
  }
  | { readonly ok: false; readonly message: string };

type GetValueTarget =
  | { readonly kind: 'resource'; readonly id: string; readonly label: string }
  | { readonly kind: 'spot'; readonly id: string; readonly label: string }
  | { readonly kind: 'chara'; readonly id: string; readonly label: string };

const CHARACTER_BY_ALIAS = new Map<string, TestCharacterId>(
  Object.entries(TEST_CHARACTERS).flatMap(([variantId, entry]) =>
    entry.aliases.map(alias => [alias.toLocaleLowerCase(), variantId as TestCharacterId] as const)),
);

/** Interpret the retained legacy role-grant command; user text is never evaluated as code. */
export function interpretGameplayBQuickTestCommand(input: string): GameplayBQuickTestCommandResult {
  const match = /^(?:获得角色|grant\s+characters?)\s*[:：]?\s*(.*)$/i.exec(input.trim());
  if (!match) return { ok: false, message: '目前支持：获得角色 星野 芹香 白子，或 getValue modid:typeid:itemid [valueNum]' };

  const names = (match[1] ?? '').split(/[\s,，、;；]+/).filter(Boolean);
  if (names.length === 0) return { ok: false, message: '请在命令后填写学生名，例如：获得角色 星野 芹香 白子' };

  const variantIds: TestCharacterId[] = [];
  for (const name of names) {
    const variantId = CHARACTER_BY_ALIAS.get(name.toLocaleLowerCase());
    if (!variantId) return { ok: false, message: `无法识别学生「${name}」；支持星野、芹香、白子及对应英文名。` };
    if (!variantIds.includes(variantId)) variantIds.push(variantId);
  }
  return { ok: true, variantIds };
}

/** Parse only the two explicit console grammars; getValue names are strict three-part IDs. */
export function interpretGameplayBQuickTestConsoleCommand(input: string): GameplayBQuickTestConsoleCommand {
  const trimmed = input.trim();
  if (/^getValue(?:\s|$)/i.test(trimmed)) {
    const match = /^getValue\s+(\S+)(?:\s+(\S+))?$/i.exec(trimmed);
    if (!match) return { ok: false, message: GET_VALUE_USAGE };

    const segments = match[1].split(':');
    if (segments.length !== 3 || segments.some(segment => segment.length === 0)) {
      return { ok: false, message: 'Name 必须是恰好三段且每段非空的 modid:typeid:itemid。' };
    }
    const [modId, typeId, itemId] = segments;
    if (!/^[a-z0-9-]+$/.test(modId)) {
      return { ok: false, message: 'modid 格式无效；必须使用 Datapack 的小写 ID。' };
    }

    let valueNum = 1;
    const valueNumProvided = match[2] !== undefined;
    if (valueNumProvided) {
      if (!/^-?\d+(?:\.\d+)?$/.test(match[2])) {
        return { ok: false, message: 'valueNum 必须是非负整数。' };
      }
      valueNum = Number(match[2]);
      if (!Number.isFinite(valueNum) || !Number.isInteger(valueNum)) {
        return { ok: false, message: 'valueNum 必须是整数。' };
      }
      if (valueNum < 0) return { ok: false, message: 'valueNum 不能小于 0。' };
    }

    return { ok: true, kind: 'getValue', modId, typeId, itemId, valueNum, valueNumProvided };
  }

  const grant = interpretGameplayBQuickTestCommand(trimmed);
  return grant.ok
    ? { ok: true, kind: 'grantCharacters', variantIds: grant.variantIds }
    : grant;
}

function resolveGetValueTarget(
  game: Pick<GameInstance, 'registry'>,
  command: Extract<GameplayBQuickTestConsoleCommand, { kind: 'getValue' }>,
): GetValueTarget | { readonly error: string } {
  if (!game.registry.loadedModNames.has(command.modId)) {
    return { error: `未加载 Datapack「${command.modId}」。` };
  }

  switch (command.typeId) {
    case 'resource': {
      const match = [...game.registry.resourceDisplays.entries()].find(([resourceId]) => {
        const [modId, typeId, itemId, extra] = resourceId.split(':');
        return extra === undefined
          && typeId === 'resource'
          && itemId === command.itemId
          && modId.length > 0
          && game.registry.resourceDisplayOwnerOf(resourceId) === command.modId;
      });
      return match
        ? { kind: 'resource', id: match[0], label: match[1].label }
        : { error: `Datapack「${command.modId}」中找不到资源定义「${command.itemId}」。` };
    }
    case 'chara': {
      const variant = game.registry.characterVariants.get(command.itemId);
      if (!variant || game.registry.characterVariantOwnerOf(command.itemId) !== command.modId) {
        return { error: `Datapack「${command.modId}」中找不到角色定义「${command.itemId}」。` };
      }
      return { kind: 'chara', id: variant.id, label: variant.displayName || variant.name };
    }
    case 'spot': {
      const spot = [...game.registry.spots.entries()].find(([spotId]) => {
        const [modId, typeId, itemId, extra] = spotId.split(':');
        return extra === undefined
          && typeId === 'spot'
          && itemId === command.itemId
          && modId.length > 0
          && game.registry.spotOwnerOf(spotId) === command.modId;
      });
      return spot
        ? { kind: 'spot', id: spot[0], label: spot[1].name }
        : { error: `Datapack「${command.modId}」中找不到 Spot 定义「${command.itemId}」。` };
    }
    case 'area':
      return { error: '本地试玩台当前不支持 Area 投送。' };
    default:
      return { error: `不支持目标类别「${command.typeId}」；首期支持 resource、chara、spot。` };
  }
}

/** Attach a small, opt-in dialog for local browser acceptance; no persistent state is written. */
export function mountGameplayBQuickTestConsole(
  game: Pick<GameInstance, 'state' | 'mutations' | 'registry'>,
  onApplied?: () => void,
): void {
  if (document.querySelector('[data-gameplay-b-test-console]')) return;

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'gameplay-b-test-console-toggle';
  toggle.textContent = '本地试玩台';
  toggle.setAttribute('aria-haspopup', 'dialog');

  const dialog = document.createElement('dialog');
  dialog.className = 'gameplay-b-test-console';
  dialog.dataset.gameplayBTestConsole = 'true';
  dialog.setAttribute('aria-labelledby', 'gameplay-b-test-console-title');
  dialog.innerHTML = `
    <header class="gameplay-b-test-console__head">
      <div>
        <span class="gameplay-b-test-console__eyebrow">DEVELOPMENT · MEMORY ONLY</span>
        <h2 id="gameplay-b-test-console-title">本地试玩控制台</h2>
      </div>
      <button type="button" class="gameplay-b-test-console__close" data-test-console-close aria-label="关闭控制台">×</button>
    </header>
    <p class="gameplay-b-test-console__note">仅当前浏览器内存有效；不会写入存档。先进入夏莱办公室，再录入试玩内容。</p>
    <label class="gameplay-b-test-console__label" for="gameplay-b-test-console-command">输入一条内容命令</label>
    <textarea id="gameplay-b-test-console-command" rows="3" spellcheck="false" placeholder="getValue base:resource:credit 1000"></textarea>
    <div class="gameplay-b-test-console__actions">
      <button type="button" data-test-console-run>解释并应用</button>
    </div>
    <p class="gameplay-b-test-console__result" data-test-console-result role="status" aria-live="polite">支持严格三段 ID：getValue modid:typeid:itemid [valueNum]；另保留角色快捷命令。输入只按白名单解析，不执行代码。</p>`;

  const textarea = dialog.querySelector<HTMLTextAreaElement>('#gameplay-b-test-console-command')!;
  const result = dialog.querySelector<HTMLElement>('[data-test-console-result]')!;
  const close = dialog.querySelector<HTMLButtonElement>('[data-test-console-close]')!;
  const run = dialog.querySelector<HTMLButtonElement>('[data-test-console-run]')!;

  toggle.addEventListener('click', () => {
    if (dialog.open) return;
    dialog.showModal();
    textarea.focus();
  });
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => toggle.focus());
  run.addEventListener('click', () => {
    const command = interpretGameplayBQuickTestConsoleCommand(textarea.value);
    if (!command.ok) {
      result.textContent = command.message;
      return;
    }
    if (game.state.activeInit !== SCHALE_OFFICE_INIT_ID) {
      result.textContent = '请先通过正常流程进入夏莱办公室，再应用试玩内容。';
      return;
    }

    if (command.kind === 'grantCharacters') {
      const acquired: string[] = [];
      const alreadyOwned: string[] = [];
      for (const variantId of command.variantIds) {
        const displayName = TEST_CHARACTERS[variantId].displayName;
        if (game.state.roster?.[variantId]) {
          alreadyOwned.push(displayName);
          continue;
        }
        game.mutations.acquireCharacter(variantId, 'story');
        acquired.push(displayName);
      }
      onApplied?.();

      const details = [
        acquired.length ? `本次获得：${acquired.join('、')}` : '',
        alreadyOwned.length ? `已持有：${alreadyOwned.join('、')}` : '',
      ].filter(Boolean);
      result.textContent = `${details.join('；')}。${onApplied ? '界面已刷新。' : ''}仅当前页面内存有效，刷新即清空。`;
      return;
    }

    const target = resolveGetValueTarget(game, command);
    if ('error' in target) {
      result.textContent = target.error;
      return;
    }
    if (command.valueNum === 0) {
      result.textContent = `数量为 0，本次不做状态变更。`;
      return;
    }
    if (target.kind !== 'resource' && command.valueNumProvided) {
      result.textContent = `${target.kind === 'chara' ? '角色' : 'Spot'} 不支持数量参数；省略 valueNum 时各投送一次。`;
      return;
    }

    if (target.kind === 'resource') {
      game.mutations.changeResource(target.id, command.valueNum);
      onApplied?.();
      result.textContent = `本次投送：${target.label} +${command.valueNum}。${onApplied ? '界面已刷新。' : ''}仅当前页面内存有效，刷新即清空。`;
      return;
    }
    if (target.kind === 'spot') {
      const previous = game.state.spotLevels[target.id] ?? 0;
      const next = game.mutations.addSpotLevel(target.id, 1);
      if (next !== previous + 1) {
        result.textContent = `Spot「${target.label}」不属于当前夏莱办公室可写范围，未应用。`;
        return;
      }
      onApplied?.();
      result.textContent = `本次提升：${target.label} Lv.${previous} → Lv.${next}。${onApplied ? '界面已刷新。' : ''}仅当前页面内存有效，刷新即清空。`;
      return;
    }

    const acquired = game.mutations.acquireCharacter(target.id, 'story');
    onApplied?.();
    result.textContent = acquired.duplicate
      ? `重复获得：${target.label}；碎片 +${acquired.shards}。${onApplied ? '界面已刷新。' : ''}仅当前页面内存有效，刷新即清空。`
      : `本次获得：${target.label}。${onApplied ? '界面已刷新。' : ''}仅当前页面内存有效，刷新即清空。`;
  });

  document.body.append(toggle, dialog);
}
