import type { PlayerState } from '../../types/state';
import type { MapRun } from '../../contracts/map/map-run';
import type {
  VariantTrainingCheckpoint, VariantTrainingPort, VariantTrainingSource, VariantTrainingView,
} from '../../contracts/character/variant-training';
import type { VariantTranslationPreview, VariantTranslationSnapshot } from '../../contracts/character/variant-translation';
import {
  buildVariantTrainingMap, variantTrainingContent, variantTrainingRequest,
  VARIANT_TRAINING_SOURCES, VARIANT_TRAINING_TEMPLATE_VERSION, VARIANT_TRAINING_VARIANT_ID,
} from '../../content/gameplay-b/variant-training-content';
import { MapRunService } from '../map/map-run-service';
import { VariantTranslationService } from './variant-translation-service';
import { canonical, exact, immutable } from './variant-translation-rules';

interface Dependencies {
  readonly getState: () => PlayerState;
  readonly getVariant: (id: string) => {
    readonly id: string; readonly proto: string; readonly displayName?: string; readonly name?: string;
  } | undefined;
}

/** Dedicated test owner: uses real AG-1, but never replaces the normal MapRun or writes PlayerState. */
export class VariantTrainingService implements VariantTrainingPort {
  private readonly translation: VariantTranslationService;
  private owner: MapRunService | null = null;
  private build: VariantTranslationSnapshot | null = null;
  private run: MapRun | null = null;
  private previousState: PlayerState | undefined;
  private previousInit: string | undefined;

  constructor(private readonly deps: Dependencies) {
    this.translation = new VariantTranslationService({ ...deps, content: variantTrainingContent });
  }

  /** Called for actual runtime lifecycle transitions; not a player mutation. */
  reset(): void {
    this.owner = null;
    this.run = null;
    this.build = null;
    this.translation.invalidatePreviews();
  }

  private syncScope(): void {
    const state = this.deps.getState();
    if (this.previousState !== state || this.previousInit !== state.activeInit) this.reset();
    this.previousState = state;
    this.previousInit = state.activeInit;
  }

  preview(source: VariantTrainingSource): VariantTranslationPreview {
    this.syncScope();
    return this.translation.preview(variantTrainingRequest(source));
  }

  start(token: string): VariantTrainingView {
    this.syncScope();
    const confirmed = this.translation.confirm(token);
    if (confirmed.status !== 'confirmed') throw new Error(confirmed.issues[0]?.message ?? '请重新预览构筑。');
    const candidate = this.createOwner(confirmed.snapshot);
    const started = candidate.start(buildVariantTrainingMap(confirmed.snapshot).id, [{
      characterId: 'hoshino', variantId: VARIANT_TRAINING_VARIANT_ID,
    }]);
    const run = candidate.move(started.runId, 'battle');
    this.owner = candidate;
    this.run = run;
    this.build = confirmed.snapshot;
    this.translation.invalidatePreviews();
    return this.getView();
  }

  private createOwner(snapshot: VariantTranslationSnapshot): MapRunService {
    const definition = buildVariantTrainingMap(snapshot);
    return new MapRunService(
      { resolve: id => id === definition.id ? definition : null },
      id => this.deps.getVariant(id)?.proto,
    );
  }

  commitRound(expectedCommitVersion: number): VariantTrainingView {
    this.syncScope();
    const run = this.run;
    const encounter = run?.activeEncounter;
    if (!this.owner || !run || run.status !== 'inProgress' || !encounter) throw new Error('请先确认进入演练。');
    if (!Number.isSafeInteger(expectedCommitVersion) || expectedCommitVersion !== run.commitVersion) {
      throw new Error('回合已经变化，请刷新演练状态后再提交。');
    }
    this.run = this.owner.commitEncounterRound({
      runId: run.runId, requestId: `${run.runId}:training:${run.commitVersion}`,
      expectedCommitVersion,
      draft: { nodeId: encounter.nodeId, round: encounter.round, draftVersion: encounter.draftVersion },
    });
    if (this.run.status === 'inProgress' && !this.run.activeEncounter) {
      this.run = this.owner.move(this.run.runId, 'exit');
    }
    return this.getView();
  }

  getView(): VariantTrainingView {
    this.syncScope();
    const variant = this.deps.getVariant(VARIANT_TRAINING_VARIANT_ID);
    const run = this.run;
    const receipt = run?.lastEncounterCommit;
    const sequence = receipt?.executionSequence ?? [];
    const startEnemyHp = receipt?.schedulerStartSnapshot?.encounter.enemies[0]?.currentHp;
    const receiptEnemyHp = startEnemyHp === undefined ? null : startEnemyHp + sequence.reduce((sum, entry) => sum
      + entry.hpChanges.filter(change => change.scope === 'enemy').reduce((total, change) => total + change.delta, 0), 0);
    const owned = this.deps.getState().roster?.[VARIANT_TRAINING_VARIANT_ID];
    return immutable({
      phase: !run ? 'preparation' : run.status === 'inProgress' ? 'battle' : 'result',
      variantId: VARIANT_TRAINING_VARIANT_ID,
      displayName: variant?.displayName || variant?.name || VARIANT_TRAINING_VARIANT_ID,
      owned: owned?.variantId === VARIANT_TRAINING_VARIANT_ID,
      sources: VARIANT_TRAINING_SOURCES,
      translation: this.build,
      round: run?.activeEncounter?.round ?? receipt?.round ?? 0,
      commitVersion: run?.commitVersion ?? 0,
      partyHp: run?.partyHp[0]?.currentHp ?? null,
      partyMaxHp: this.build?.members[0]?.build.parameters.maxHp ?? null,
      enemyHp: run?.activeEncounter?.enemies[0]?.currentHp ?? receiptEnemyHp,
      enemyMaxHp: 6,
      outcome: !run || run.status === 'inProgress' ? null : run.status,
      lastRound: receipt ? {
        round: receipt.round,
        order: sequence.filter(entry => entry.owner !== null).map(entry => ({
          side: entry.owner!.kind === 'partyCharacter' ? 'party' as const : 'enemy' as const,
          agility: entry.finalAgility, skipped: entry.skipReason !== null,
        })),
      } : null,
    });
  }

  save(): VariantTrainingCheckpoint {
    this.syncScope();
    const mapRun = this.owner?.createSaveSnapshot();
    if (!this.build || !mapRun || this.run?.currentNodeId !== 'battle') throw new Error('仅可在演练战斗中保存测试点。');
    // MapRun deliberately exposes a non-enumerable compatibility getter. Its save wire format is JSON.
    const wireMapRun = JSON.parse(JSON.stringify(mapRun)) as VariantTrainingCheckpoint['mapRun'];
    const body = { templateVersion: VARIANT_TRAINING_TEMPLATE_VERSION, translation: this.build, mapRun: wireMapRun } as const;
    return immutable({ schemaVersion: 1, ...body, binding: canonical(body) });
  }

  load(value: unknown): VariantTrainingView {
    this.syncScope();
    canonical(value); // Reject accessors/non-JSON input before consuming any externally supplied fields.
    exact(value, ['schemaVersion', 'templateVersion', 'translation', 'mapRun', 'binding']);
    if (value.schemaVersion !== 1 || value.templateVersion !== VARIANT_TRAINING_TEMPLATE_VERSION) {
      throw new Error('测试点模板版本不匹配。');
    }
    const body = { templateVersion: value.templateVersion, translation: value.translation, mapRun: value.mapRun };
    if (typeof value.binding !== 'string' || value.binding !== canonical(body)) throw new Error('测试点的构筑与战斗记录不匹配。');
    const restored = this.translation.restore(value.translation);
    if (restored.status !== 'restored') throw new Error(restored.issues[0]?.message ?? '转译构筑无法恢复。');
    if (restored.snapshot.activeInit !== this.deps.getState().activeInit) throw new Error('请在保存测试点的世界线中恢复。');
    exact(value.mapRun, ['mapId', 'resumeVersion', 'run']);
    const savedRun = value.mapRun.run as Record<string, unknown> | null;
    if (!savedRun || savedRun.currentNodeId !== 'battle' || savedRun.status !== 'inProgress') throw new Error('测试点不在有效战斗中。');
    const expectedParty = [{ characterId: 'hoshino', variantId: VARIANT_TRAINING_VARIANT_ID }];
    if (canonical(savedRun.party) !== canonical(expectedParty)) throw new Error('测试点的出场 Variant 不匹配。');
    const candidate = this.createOwner(restored.snapshot);
    const result = candidate.restoreSaveSnapshot(value.mapRun);
    if (result.status !== 'restored') throw new Error('测试点战斗状态校验失败。');
    const run = candidate.getSnapshot();
    if (!run?.activeEncounter || run.currentNodeId !== 'battle') throw new Error('测试点缺少有效战斗。');
    // All validation precedes the owner swap. A rejected checkpoint leaves the current test untouched.
    this.owner = candidate;
    this.run = run;
    this.build = restored.snapshot;
    this.translation.invalidatePreviews();
    return this.getView();
  }
}
