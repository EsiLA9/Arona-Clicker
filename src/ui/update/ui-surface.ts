import type { PanelState } from '../components/app-shell';

export interface UISurfaceToken {
  readonly key: string;
  readonly generation: number;
}

export function surfaceKeyOf(state: PanelState): string {
  const service = state.service ?? 'game';
  if (service !== 'game') return `service:${service}`;
  const workspace = state.workspace;
  if (!workspace) return 'game';
  if (workspace.type === 'shop') return `shop:${workspace.spotId}:${workspace.shopId}`;
  return `character:${workspace.variantId}`;
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
