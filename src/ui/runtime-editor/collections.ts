// ============================================================
// ui/runtime-editor/collections.ts — 集合渲染 / 回读（原型薄封装）
//
// 具体形态由 collection-prototypes 的原型决定；本文件只保留
// 「按集合 id 取原型 + 调用通用渲染 / 回读」的转发，避免调用方
// 依赖某一种集合的细节。
// ============================================================

import type {
  PaymentOptionDraft,
  SpotFunctionalityDraft,
  SpotLevelUpgradeDraft,
  SpotRevealTriggerDraft,
} from '../../data-services/authoring/content-policy-types';
import type { UIContext } from '../context';
import type { RuntimeEditorProblemInput } from './form';
import {
  FUNCTIONALITY_PROTOTYPE,
  GACHA_POOL_PROTOTYPE,
  LEVEL_UPGRADE_PROTOTYPE,
  PAYMENT_OPTION_PROTOTYPE,
  REVEAL_TRIGGER_PROTOTYPE,
  TAG_PROTOTYPE,
  readCollection,
  renderCollection,
} from './collection-prototypes';

export function renderFunctionalityList(ctx: UIContext, items: readonly SpotFunctionalityDraft[], problems: readonly RuntimeEditorProblemInput[] = []): string {
  return renderCollection(ctx, FUNCTIONALITY_PROTOTYPE, items, problems);
}

export function readFunctionalityRows(scope: ParentNode): SpotFunctionalityDraft[] {
  return readCollection(scope, FUNCTIONALITY_PROTOTYPE);
}

export function renderPaymentOptionList(ctx: UIContext, items: readonly PaymentOptionDraft[], problems: readonly RuntimeEditorProblemInput[] = []): string {
  return renderCollection(ctx, PAYMENT_OPTION_PROTOTYPE, items, problems);
}

export function readPaymentOptionRows(scope: ParentNode): PaymentOptionDraft[] {
  return readCollection(scope, PAYMENT_OPTION_PROTOTYPE);
}

export function renderLevelUpgradeList(ctx: UIContext, items: readonly SpotLevelUpgradeDraft[], problems: readonly RuntimeEditorProblemInput[] = []): string {
  return renderCollection(ctx, LEVEL_UPGRADE_PROTOTYPE, items, problems);
}

export function readLevelUpgradeRows(scope: ParentNode): SpotLevelUpgradeDraft[] {
  return readCollection(scope, LEVEL_UPGRADE_PROTOTYPE);
}

export function renderRevealTriggerList(ctx: UIContext, items: readonly SpotRevealTriggerDraft[], problems: readonly RuntimeEditorProblemInput[] = []): string {
  return renderCollection(ctx, REVEAL_TRIGGER_PROTOTYPE, items, problems);
}

export function readRevealTriggerRows(scope: ParentNode): SpotRevealTriggerDraft[] {
  return readCollection(scope, REVEAL_TRIGGER_PROTOTYPE);
}

export function renderTagList(ctx: UIContext, items: readonly string[], problems: readonly RuntimeEditorProblemInput[] = []): string {
  return renderCollection(ctx, TAG_PROTOTYPE, items, problems);
}

export function readTagRows(scope: ParentNode): string[] {
  return readCollection(scope, TAG_PROTOTYPE).filter(value => value.trim() !== '');
}

export function renderGachaPoolList(ctx: UIContext, items: readonly string[], problems: readonly RuntimeEditorProblemInput[] = []): string {
  return renderCollection(ctx, GACHA_POOL_PROTOTYPE, items, problems);
}

export function readGachaPoolRows(scope: ParentNode): string[] {
  return readCollection(scope, GACHA_POOL_PROTOTYPE).filter(value => value.trim() !== '');
}
