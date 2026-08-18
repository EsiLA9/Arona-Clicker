import { UIContext } from '../context';
import { renderHeader } from './header';
import { renderLeftPanel } from './rail';
import { renderCenterPanel } from './center-panel';
import { renderRightPanel } from './right-panels';
import { ChatEntry } from './story';

export interface PanelState {
  leftTab: string;
  centerTab: string;
  rightTab: string;
  chatEntries: ChatEntry[];
}

export function renderAppShell(ctx: UIContext, state: PanelState): string {
  return `
    <main class="console-shell">
      ${renderHeader(ctx)}
      <section class="workspace">
        ${renderLeftPanel(ctx, state.leftTab)}
        ${renderCenterPanel(ctx, state.centerTab, state.chatEntries, ctx.game.getSendState())}
        ${renderRightPanel(ctx, state.rightTab)}
      </section>
      <footer><span>ARONA CLICKER / LOCAL PROTOTYPE</span><span>TS-HTML ENGINE · NO NETWORK</span></footer>
    </main>`;
}
