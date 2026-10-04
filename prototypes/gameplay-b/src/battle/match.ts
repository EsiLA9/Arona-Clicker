import type {
  BattleRecipeAction, BattleRecipeEffect, BattleRecipeMatch, BattleRecipePlan, PreparedBattleRound,
  SupplementalFreeBattleAction,
} from "../model.js";
import { cardTagRecipes, type CardTagRecipeDefinition, type RecipeActionPosition } from "../content/recipes.js";

function normalizeActions(
  prepared: PreparedBattleRound,
  supplemental: readonly SupplementalFreeBattleAction[],
): BattleRecipeAction[] {
  return [
    ...prepared.playerActions.map((action, order): BattleRecipeAction => ({
      id: `player-action:${order}:${action.actorId}`,
      actorId: action.actorId,
      side: "ally",
      source: "player-card",
      order,
      tags: action.tags,
      targetIds: action.targetIds,
      effect: action.effect,
    })),
    ...prepared.enemyIntents.map((intent, order): BattleRecipeAction => ({
      id: `enemy-intent:${order}:${intent.actorId}`,
      actorId: intent.actorId,
      side: "enemy",
      source: "enemy-intent",
      order,
      tags: intent.tags,
      targetIds: intent.targetIds,
      effect: intent.effect,
    })),
    ...supplemental.map((action, index): BattleRecipeAction => ({
      id: `free-skill:${index}:${action.actorId}:${action.id}`,
      actorId: action.actorId,
      side: "ally",
      source: "free-skill",
      order: prepared.playerActions.length + index,
      tags: action.tags,
      targetIds: action.targetIds,
      effect: action.effect,
    })),
  ];
}

function matchingTargetIds(left: BattleRecipeAction, right: BattleRecipeAction, recipe: CardTagRecipeDefinition): readonly string[] {
  if (recipe.targetRelation === "none") return [];
  if (left.targetIds.length !== 1 || right.targetIds.length !== 1 || left.targetIds[0] !== right.targetIds[0]) return [];
  return [left.targetIds[0]!];
}

function findPair(
  recipe: CardTagRecipeDefinition,
  actions: readonly BattleRecipeAction[],
  consumed: ReadonlySet<string>,
): { left: BattleRecipeAction; right: BattleRecipeAction; targetIds: readonly string[] } | null {
  const leftActions = actions.filter((action) => action.side === recipe.left.side && action.tags.includes(recipe.left.tag));
  const rightActions = actions.filter((action) => action.side === recipe.right.side && action.tags.includes(recipe.right.tag));
  for (const left of leftActions) {
    if (consumed.has(left.id)) continue;
    for (const right of rightActions) {
      if (consumed.has(right.id) || left.id === right.id) continue;
      if (recipe.distinctActors && left.actorId === right.actorId) continue;
      const targetIds = matchingTargetIds(left, right, recipe);
      if (recipe.targetRelation !== "none" && targetIds.length === 0) continue;
      return { left, right, targetIds };
    }
  }
  return null;
}

function actionAt(actions: { left: BattleRecipeAction; right: BattleRecipeAction }, position: RecipeActionPosition): BattleRecipeAction {
  return position === "left" ? actions.left : actions.right;
}

function expandOutput(
  recipe: CardTagRecipeDefinition,
  pair: { left: BattleRecipeAction; right: BattleRecipeAction; targetIds: readonly string[] },
): BattleRecipeEffect[] {
  return recipe.output.map((output): BattleRecipeEffect => {
    switch (output.kind) {
      case "remove-round-shield":
        return { kind: "remove-round-shield", targetIds: pair.targetIds, amount: output.amount };
      case "attack":
        return {
          kind: "attack",
          actorId: actionAt(pair, output.actor).actorId,
          targetIds: actionAt(pair, output.targets).targetIds,
          damageAdjustment: output.damageAdjustment,
        };
      case "gain-round-shield":
        return {
          kind: "gain-round-shield",
          targetIds: output.target === "matched-target" ? pair.targetIds : [pair.left.actorId],
          amount: output.amount,
        };
    }
  });
}

export function matchPreparedBattleRound(
  prepared: PreparedBattleRound,
  supplementalFreeActions: readonly SupplementalFreeBattleAction[] = [],
): BattleRecipePlan {
  const actions = normalizeActions(prepared, supplementalFreeActions);
  const consumed = new Set<string>();
  const matches: BattleRecipeMatch[] = [];
  const recipes = cardTagRecipes.map((recipe, index) => ({ recipe, index }))
    .sort((a, b) => a.recipe.priority - b.recipe.priority || a.index - b.index)
    .map(({ recipe }) => recipe);

  for (const recipe of recipes) {
    let pair = findPair(recipe, actions, consumed);
    while (pair) {
      consumed.add(pair.left.id);
      consumed.add(pair.right.id);
      matches.push({
        recipeId: recipe.id,
        priority: recipe.priority,
        leftActionId: pair.left.id,
        leftActorId: pair.left.actorId,
        rightActionId: pair.right.id,
        rightActorId: pair.right.actorId,
        replacementEffects: expandOutput(recipe, pair),
      });
      pair = findPair(recipe, actions, consumed);
    }
  }

  return {
    unmatchedActions: actions.filter((action) => !consumed.has(action.id)),
    matches,
    consumedActionIds: matches.flatMap((match) => [match.leftActionId, match.rightActionId]),
  };
}
