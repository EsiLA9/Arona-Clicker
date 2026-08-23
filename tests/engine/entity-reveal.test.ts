// ============================================================
// engine/entity-reveal.test.ts — 探索机制：Init / Area / Story 揭示
// ============================================================
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { GameInstance } from '../../src/engine/game-instance';
import { baseDatapack } from '../../src/data/index';
import { createUIContext } from '../../src/ui/context';
import { getInitReveal, getAreaReveal, getStoryReveal } from '../../src/ui/components/tooltip';

const CREDIT = 'base:resource:credit';
const OFFICE = 'base:init:schale_office';
const ABYDOS = 'base:init:abydos';
const HANGAR = 'base:area:schale_hangar';
const MAIN = 'base:area:schale_main';
const BRIEFING = 'base:story:schale_briefing';

const ctxOf = (game: GameInstance) => createUIContext(game);

describe('探索机制：Init / Area / Story', () => {
  let game: GameInstance;

  beforeEach(() => {
    game = new GameInstance();
    game.init([baseDatapack]);
    game.startNewGame(OFFICE);
  });

  afterEach(() => {
    game.stop();
  });

  test('Init reveal: name hidden until stat threshold, owned once unlocked', () => {
    // abydos 未解锁且累计产出 < 800 → 完全不可见（existence 未满足）
    expect(getInitReveal(ctxOf(game), game.registry.inits.get(ABYDOS)!).stage).toBe('invisible');

    // 累计产出 ≥ 800 → existence + name 揭示（仍未解锁）
    game.mutations.changeResource(CREDIT, 810);
    expect(getInitReveal(ctxOf(game), game.registry.inits.get(ABYDOS)!).nameKnown).toBe(true);

    // 解锁 → owned
    game.unlockInit(ABYDOS);
    expect(getInitReveal(ctxOf(game), game.registry.inits.get(ABYDOS)!).stage).toBe('owned');
  });

  test('Area reveal: unvisited hidden name; owned once visited', () => {
    // 初始未访问 schale_hangar 且累计产出 < 80 → 名称未知
    expect(getAreaReveal(ctxOf(game), game.registry.areas.get(HANGAR)!).nameKnown).toBe(false);

    // 已访问的主厅 → owned
    expect(getAreaReveal(ctxOf(game), game.registry.areas.get(MAIN)!).stage).toBe('owned');
  });

  test('Story reveal: name hidden until stat threshold; completed is owned', () => {
    expect(getStoryReveal(ctxOf(game), game.registry.storyEntries.get(BRIEFING)!).nameKnown).toBe(false);

    game.mutations.changeResource(CREDIT, 40);
    expect(getStoryReveal(ctxOf(game), game.registry.storyEntries.get(BRIEFING)!).nameKnown).toBe(true);
  });
});
