/** Round-local domain identity, shared by every visual representation of a card. */
export interface MapRunCardRef {
  readonly kind: 'card';
  readonly scope: {
    readonly runId: string;
    readonly mapId: string;
    readonly nodeId: string;
    readonly activityId: string | null;
    readonly round: number;
  };
  /** Opaque Owner-assigned identity. Never a DOM ID or an action definition ID alone. */
  readonly id: string;
}

/** Detached live card. Candidate presentation alone does not create this object. */
export interface MapRunCardInstance {
  readonly ref: MapRunCardRef;
  readonly owner: { readonly kind: 'partyCharacter' | 'enemy'; readonly id: string };
  readonly zone: 'hand' | 'playerCommand' | 'enemyIntent';
  readonly actionId: string | null;
  /** Domain ordering for display; transforms and stacking never change it. */
  readonly logicalIndex: number;
  /** Hand cards remain the same objects when a different Hand card is prepared. */
  readonly prepared: boolean;
  /** Enemy cards remain read-only even when rendered by a shared card component. */
  readonly controllable: boolean;
}
