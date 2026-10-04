// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { createAppRuntime } from '../../src/app/runtime-bootstrap';
import { CAROUSEL_SAFETY_IDS } from '../../src/arona-clicker/content/operation-samples/carousel-safety-ids';
import { carouselSafetySliceContent, carouselSafetySliceResolver } from '../../src/arona-clicker/content/operation-samples/carousel-safety-slice';
import type { OperationContentResolver } from '../../src/arona-clicker/contracts/operation-content-resolver';
import { Character } from '../../src/arona-clicker/types/ids';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import type { PanelState } from '../../src/ui/components/app-shell';
import { createUIContext } from '../../src/ui/context';
import { renderWorkspace } from '../../src/ui/workspace/workspace-renderer';
import { createWorkspaceNavigation } from '../../src/ui/workspace/workspace-router';
import { baseDatapack } from '../../src/data/test-datapack';

const STUDENTS = ['Hoshino', 'Serika', 'Shiroko'] as const;

describe('Gameplay B Operation workspace view', () => {
  const games: GameInstance[] = [];

  function createGame(withSample = true): GameInstance {
    const game = withSample ? createAppRuntime() : new GameInstance();
    game.init([baseDatapack], { enterDefaultInit: withSample });
    games.push(game);
    return game;
  }

  function startOperation(game: GameInstance): string {
    for (const student of STUDENTS) game.mutations.acquireCharacter(student, 'story');
    return game.operationEntry.start(CAROUSEL_SAFETY_IDS.event, [Character.Hoshino, Character.Serika, Character.Shiroko]).runId;
  }

  function render(game: GameInstance, runId: string): string {
    const state = {
      service: 'game',
      workspaceNavigation: createWorkspaceNavigation({ kind: 'operation', runId }),
      workspace: {
        type: 'operation',
        runId,
        returnContext: {
          route: { kind: 'game' },
          leftTab: 'area',
          centerTab: 'chat',
          rightTab: 'spot',
          selectedVariantId: null,
          conversationVariantId: null,
        },
      },
    } as PanelState;
    return renderWorkspace(createUIContext(game), { kind: 'operation', runId }, state);
  }

  afterEach(() => {
    for (const game of games.splice(0)) if (game.running) game.stop();
  });

  it('把 Action log 放在中心聊天列，展示学生行动、Intent、风险与干预 Cost', () => {
    const game = createGame();
    const runId = startOperation(game);
    const html = render(game, runId);
    const host = document.createElement('div');
    host.innerHTML = html;
    const text = host.textContent ?? '';

    expect(html).toContain('data-workspace-frame="operation"');
    expect(html).toContain('data-composition="center-right"');
    expect(html).toContain('data-operation-log');
    expect(html).toContain('data-operation-commit-dock');
    expect(html).toContain('data-operation-action');
    expect(text).toContain('旋转木马平台');
    expect(text).toContain('设施危险度');
    expect(text).toContain('星野');
    expect(text).toContain('芹香');
    expect(text).toContain('白子');
    expect(text).toContain('对手意图');
    expect(text).toContain('设施动向');
    expect(text).toContain('体力 1');
    expect(text).toContain('协调 1');
    expect(text).toContain('第 1 / 2 回合');
    expect(text).toContain('本回合干预 0 / 1');
    expect(text).toContain('第一回合尚未结算');
  });

  it('缺少有效 admission/run 时说明真实拥有条件，不伪造普通事件面板', () => {
    const game = createGame(false);
    const html = render(game, 'stale-operation-run');
    const host = document.createElement('div');
    host.innerHTML = html;

    expect(host.querySelector('[data-operation-unavailable]')).not.toBeNull();
    expect(host.textContent).toContain('持有且解锁星野、芹香与白子');
    expect(host.textContent).not.toContain('stale-operation-run');
    expect(host.querySelector('[data-operation-commit]')).toBeNull();
  });

  it('清楚标出自动计划与修订行动，并说明因能力缺失而不能选择的原因', () => {
    const game = createGame();
    const runId = startOperation(game);
    const snapshot = game.operationEntry.getSnapshot()!;
    game.operationEntry.reviseIntervention({
      runId,
      planVersion: snapshot.planVersion,
      draft: { actorId: CAROUSEL_SAFETY_IDS.actors.hoshino, actionId: CAROUSEL_SAFETY_IDS.actions.emergencyStop },
    });
    const revised = render(game, runId);
    const revisedHost = document.createElement('div');
    revisedHost.innerHTML = revised;
    const planText = revisedHost.querySelector('[data-operation-plan]')?.textContent ?? '';
    expect(planText).toContain('自动计划');
    expect(planText).toContain('本回合修订');
    expect(planText).toContain('紧急停机');

    const withoutProtection: OperationContentResolver = {
      resolve(eventId) {
        if (eventId !== CAROUSEL_SAFETY_IDS.event) return carouselSafetySliceResolver.resolve(eventId);
        return {
          ...carouselSafetySliceContent,
          studentProfiles: carouselSafetySliceContent.studentProfiles.map(profile => profile.characterId === Character.Hoshino
            ? { ...profile, capabilityIds: [] }
            : profile),
        };
      },
    };
    const restrictedGame = createAppRuntime({ operationContentResolver: withoutProtection });
    restrictedGame.init([baseDatapack], { enterDefaultInit: true });
    games.push(restrictedGame);
    const restrictedRunId = startOperation(restrictedGame);
    const restricted = render(restrictedGame, restrictedRunId);
    const restrictedHost = document.createElement('div');
    restrictedHost.innerHTML = restricted;
    const emergencyStop = restrictedHost.querySelector<HTMLButtonElement>(`[data-operation-action][data-action-id="${CAROUSEL_SAFETY_IDS.actions.emergencyStop}"]`);
    expect(emergencyStop?.disabled).toBe(true);
    expect(restrictedHost.textContent).toContain('星野的防护能力解锁');
    expect(restrictedHost.textContent).not.toContain('demo:operation-capability');
  });

  it('提交后将安全结算写入中心对话记录，并隐藏内部规则与随机数据', () => {
    const game = createGame();
    const runId = startOperation(game);
    const snapshot = game.operationEntry.getSnapshot()!;
    game.operationEntry.commitBeat({ runId, planVersion: snapshot.planVersion });
    const html = render(game, runId);
    const host = document.createElement('div');
    host.innerHTML = html;
    const text = host.textContent ?? '';

    expect(host.querySelectorAll('[data-operation-resolution]')).toHaveLength(1);
    expect(text).toContain('第 1 回合');
    expect(text).toContain('设施危险度 3 → 4');
    expect(text).not.toContain('demo:operation-action');
    expect(text).not.toContain('chanceBps');
    expect(text).not.toContain('randomCursor');
    expect(text).not.toContain('demo:operation-skill');
  });
});
