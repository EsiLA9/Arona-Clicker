import type { BattleSide } from "../model.js";

export type RecipeActionPosition = "left" | "right";
export type RecipeOutputDefinition =
  | { readonly kind: "remove-round-shield"; readonly target: "matched-target"; readonly amount: number }
  | { readonly kind: "attack"; readonly actor: RecipeActionPosition; readonly targets: RecipeActionPosition; readonly damageAdjustment: number }
  | { readonly kind: "gain-round-shield"; readonly target: "matched-target" | "left-actor"; readonly amount: number };

export interface CardTagRecipeDefinition {
  readonly id: string;
  readonly priority: number;
  readonly left: { readonly side: BattleSide; readonly tag: string };
  readonly right: { readonly side: BattleSide; readonly tag: string };
  readonly targetRelation: "same-single-target" | "none";
  readonly distinctActors: boolean;
  readonly output: readonly RecipeOutputDefinition[];
}

// Priority and action-column order are provisional prototype matching defaults, not user rulings.
export const cardTagRecipes: readonly CardTagRecipeDefinition[] = [
  {
    id: "enemy-cover-ally-sniper",
    priority: 1,
    left: { side: "enemy", tag: "cover" },
    right: { side: "ally", tag: "sniper" },
    targetRelation: "same-single-target",
    distinctActors: false,
    output: [
      { kind: "remove-round-shield", target: "matched-target", amount: 2 },
      { kind: "attack", actor: "right", targets: "right", damageAdjustment: 0 },
    ],
  },
  {
    id: "enemy-charge-ally-cover",
    priority: 2,
    left: { side: "enemy", tag: "charge" },
    right: { side: "ally", tag: "cover" },
    targetRelation: "same-single-target",
    distinctActors: false,
    output: [
      { kind: "gain-round-shield", target: "matched-target", amount: 2 },
      { kind: "attack", actor: "left", targets: "left", damageAdjustment: -1 },
    ],
  },
  {
    id: "ally-charge-ally-cover",
    priority: 3,
    left: { side: "ally", tag: "charge" },
    right: { side: "ally", tag: "cover" },
    targetRelation: "none",
    distinctActors: true,
    output: [
      { kind: "gain-round-shield", target: "left-actor", amount: 1 },
      { kind: "attack", actor: "left", targets: "left", damageAdjustment: 1 },
    ],
  },
];
