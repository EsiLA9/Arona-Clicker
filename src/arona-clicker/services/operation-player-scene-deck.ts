import type {
  OperationCardZones,
  OperationEventDef,
  OperationPlayerSceneCardDef,
  OperationPlayerSceneCardInstanceDef,
} from '../contracts/operation';

function deckWord(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function createCardInstanceId(seed: number, card: OperationPlayerSceneCardDef, ordinal: number): string {
  return 'operation-card:v1:' + seed + ':' + encodeURIComponent(card.id) + ':' + ordinal;
}

/** Expands the fixed content definitions into stable physical card instances. */
export function createOperationPlayerSceneCardInstances(event: OperationEventDef): readonly OperationPlayerSceneCardInstanceDef[] {
  const seed = event.randomSeed ?? 0;
  const cards = event.playerSceneDeck?.cards ?? [];
  return cards.flatMap(card => Array.from({ length: card.copies }, (_unused, ordinal) => ({
    cardInstanceId: createCardInstanceId(seed, card, ordinal),
    cardDefId: card.id,
    actionId: card.actionId,
    playerCost: card.playerCost,
    timing: card.timing,
    ...(card.selectionPolicy ? { selectionPolicy: card.selectionPolicy } : {}),
    ...(card.performerPolicy ? { performerPolicy: card.performerPolicy } : {}),
    ...(card.title ? { title: card.title } : {}),
    ...(card.description ? { description: card.description } : {}),
  })));
}

/** A dedicated shuffle stream: its derivation never reads or advances tactical Run RNG. */
export function shuffleOperationPlayerSceneDeck(event: OperationEventDef): string[] {
  const cards = [...createOperationPlayerSceneCardInstances(event)];
  let state = deckWord('operation-scene-deck:v1:' + (event.randomSeed ?? 0));
  const nextWord = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return (value ^ (value >>> 14)) >>> 0;
  };
  for (let index = cards.length - 1; index > 0; index -= 1) {
    const selected = nextWord() % (index + 1);
    [cards[index], cards[selected]] = [cards[selected], cards[index]];
  }
  return cards.map(card => card.cardInstanceId);
}

/** Draws from the front of the persisted order and leaves overflow in drawPile. */
export function drawOperationPlayerSceneCards(
  zones: OperationCardZones,
  requestedCount: number,
  maxHandSize: number,
): OperationCardZones {
  const next = {
    drawPile: [...zones.drawPile],
    hand: [...zones.hand],
    discard: [...zones.discard],
  };
  const drawCount = Math.max(0, Math.min(requestedCount, maxHandSize - next.hand.length, next.drawPile.length));
  next.hand.push(...next.drawPile.splice(0, drawCount));
  return next;
}

/** Moves a validated, distinct set of hand instances directly into the no-reshuffle discard pile. */
export function discardOperationPlayerSceneCards(
  zones: OperationCardZones,
  cardInstanceIds: readonly string[],
): OperationCardZones {
  const selected = new Set(cardInstanceIds);
  return {
    drawPile: [...zones.drawPile],
    hand: zones.hand.filter(cardId => !selected.has(cardId)),
    discard: [...zones.discard, ...zones.hand.filter(cardId => selected.has(cardId))],
  };
}
