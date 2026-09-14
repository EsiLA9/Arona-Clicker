import type { PanelState } from '../components/app-shell';
import { resolveCurrentWorkspaceRoute } from '../workspace/workspace-router';

export interface UISurfaceToken {
  readonly key: string;
  readonly generation: number;
}

export function surfaceKeyOf(state: PanelState): string {
  const workspace = state.workspace;
  const legacyWorkspace = workspace
    ? workspace.type === 'shop'
      ? { type: 'shop' as const, sessionId: `${workspace.spotId}:${workspace.shopId}` }
      : workspace.type === 'character'
        ? { type: 'character' as const, variantId: workspace.variantId }
        : workspace.type === 'contacts'
          ? { type: 'contacts' as const }
          : { type: 'story' as const, sessionId: workspace.conversationOwner ?? undefined }
    : null;
  const route = resolveCurrentWorkspaceRoute(state.workspaceNavigation, { service: state.service, workspace: legacyWorkspace });
  if (route.kind === 'service') return `service:${route.page}`;
  if (route.kind === 'game') return 'game';
  if (route.kind === 'shop') return ['shop', route.sessionId].join(':');
  if (route.kind === 'character') return ['character', route.variantId].join(':');
  if (route.kind === 'contacts' && workspace?.type === 'contacts') {
    return ['contacts', workspace.selectedVariantId ?? '', workspace.conversationVariantId ?? ''].join(':');
  }
  if (route.kind !== 'story' || workspace?.type !== 'story') return route.kind;
  return [
    'story',
    workspace.selectedEntryId ?? '',
    workspace?.conversationOwner ?? '',
    workspace?.mode ?? 'overview',
    workspace?.navPath.join('/') ?? '',
  ].join(':');
}

export function sameSurfaceToken(left: UISurfaceToken, right: UISurfaceToken): boolean {
  return left.key === right.key && left.generation === right.generation;
}

export class UISurfaceRuntime {
  private key: string;
  private generation = 0;
  private mounted: UISurfaceToken | null = null;

  constructor(initialState: PanelState) {
    this.key = surfaceKeyOf(initialState);
  }

  sync(state: PanelState): UISurfaceToken {
    const nextKey = surfaceKeyOf(state);
    if (nextKey !== this.key) {
      this.key = nextKey;
      this.generation += 1;
      this.mounted = null;
    }
    return this.current();
  }

  current(): UISurfaceToken {
    return { key: this.key, generation: this.generation };
  }

  markMounted(): UISurfaceToken {
    this.mounted = this.current();
    return this.current();
  }

  isCurrent(token: UISurfaceToken): boolean {
    return sameSurfaceToken(token, this.current())
      && this.mounted !== null
      && sameSurfaceToken(token, this.mounted);
  }
}
