import type { GameInstance } from '../../arona-clicker/runtime-game-instance';
import '../css/gameplay-b-quick-test-console.css';

const SCHALE_OFFICE_INIT_ID = 'base:init:schale_office';

const TEST_CHARACTERS = {
  Hoshino: { aliases: ['hoshino', '星野', '小鸟游星野'], displayName: '小鸟游星野' },
  Serika: { aliases: ['serika', '芹香', '黑见芹香'], displayName: '黑见芹香' },
  Shiroko: { aliases: ['shiroko', '白子', '砂狼白子'], displayName: '砂狼白子' },
} as const;

type TestCharacterId = keyof typeof TEST_CHARACTERS;

export type GameplayBQuickTestCommandResult =
  | { readonly ok: true; readonly variantIds: readonly TestCharacterId[] }
  | { readonly ok: false; readonly message: string };

const CHARACTER_BY_ALIAS = new Map<string, TestCharacterId>(
  Object.entries(TEST_CHARACTERS).flatMap(([variantId, entry]) =>
    entry.aliases.map(alias => [alias.toLocaleLowerCase(), variantId as TestCharacterId] as const)),
);

/** Interpret a deliberately small command grammar; this never evaluates user text as code. */
export function interpretGameplayBQuickTestCommand(input: string): GameplayBQuickTestCommandResult {
  const match = /^(?:获得角色|grant\s+characters?)\s*[:：]?\s*(.*)$/i.exec(input.trim());
  if (!match) return { ok: false, message: '目前支持：获得角色 星野 芹香 白子' };

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

/** Attach a small, opt-in dialog for local browser acceptance; no persistent state is written. */
export function mountGameplayBQuickTestConsole(game: Pick<GameInstance, 'state' | 'mutations'>, onApplied?: () => void): void {
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
    <p class="gameplay-b-test-console__note">仅当前浏览器内存有效；不会写入存档。先进入夏莱办公室，再录入试玩角色。</p>
    <label class="gameplay-b-test-console__label" for="gameplay-b-test-console-command">输入一条内容命令</label>
    <textarea id="gameplay-b-test-console-command" rows="3" spellcheck="false" placeholder="获得角色 星野 芹香 白子"></textarea>
    <div class="gameplay-b-test-console__actions">
      <button type="button" data-test-console-run>解释并应用</button>
    </div>
    <p class="gameplay-b-test-console__result" data-test-console-result role="status" aria-live="polite">支持角色获得命令；输入只按白名单解析，不执行代码。</p>`;

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
    const command = interpretGameplayBQuickTestCommand(textarea.value);
    if (!command.ok) {
      result.textContent = command.message;
      return;
    }
    if (game.state.activeInit !== SCHALE_OFFICE_INIT_ID) {
      result.textContent = '请先通过正常流程进入夏莱办公室，再应用试玩角色。';
      return;
    }

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
  });

  document.body.append(toggle, dialog);
}
