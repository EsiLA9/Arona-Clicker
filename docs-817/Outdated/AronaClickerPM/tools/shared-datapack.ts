import type { RawDatapack } from "../src/03-registry/types"

export const R = "arona/resource"
export const A = "arona/area"
export const S = "arona/spot"
export const I = "arona/init"
export const E = "arona/enhancement"
export const Eff = "arona/effect"
export const St = "arona/story"
export const ASE = "arona/activeStoryEntry"
export const PSE = "arona/passiveStoryEntry"

export const demoPack: RawDatapack = {
  id: "arona",
  name: "Arona World",
  version: "2.1",
  description: "Travel-enhanced demo datapack",
  priority: 0,
  contents: {
    resources: [
      { idName: "gold",          name: "Gold",          icon: "🪙", description: "Currency",          baseValue: 1, persistent: true, maxValue: 5000 },
      { idName: "crystal",       name: "Crystal",       icon: "💎", description: "Common crystal ore" },
      { idName: "mithril",       name: "Mithril",       icon: "🔮", description: "Rare mithril ore" },
      { idName: "dark_essence",  name: "Dark Essence",  icon: "🖤", description: "Found in the abyss" },
      { idName: "food",          name: "Food",          icon: "🍞", description: "Sustenance" },
    ],

    effects: [
      {
        idName: "crystal_x2",
        type: "spot_production_multiply",
        target: { scope: "spot", id: "crystal_pick" },
        operation: "multiply", value: 2,
      },
      {
        idName: "mine_efficiency",
        type: "spot_interval_reduce",
        target: { scope: "spot", id: "gold_mine" },
        operation: "add", value: 2,
      },
      {
        idName: "deep_crystal",
        type: "spot_production_add",
        target: { scope: "spot", id: "deep_crystal_drill" },
        operation: "add", value: 10,
      },
      {
        idName: "mithril_boost",
        type: "spot_production_multiply",
        target: { scope: "spot", id: "mithril_drill" },
        operation: "multiply", value: 3,
      },
      {
        idName: "essence_boost",
        type: "spot_production_multiply",
        target: { scope: "spot", id: "essence_extractor" },
        operation: "multiply", value: 2,
      },
    ],

    // ──────────────────────────────────────────
    // Spots — each area has its own economy
    // ──────────────────────────────────────────

    spots: [
      // ── Central (starting area) ──
      {
        idName: "gold_mine",
        name: "Gold Mine", icon: "⛏️", description: "Produces gold automatically",
        parentArea: "central",
        productions: [{ resource: "gold", baseAmount: 5, intervalTicks: 3 }],
        cost: { resource: `${R}/gold`, amount: 50 },
        costScaling: { base: 1.3, exponent: 1 },
        maxLevel: 20, effects: [],
      },
      {
        idName: "crystal_pick",
        name: "Crystal Pick", icon: "🔶", description: "Mines crystal ore",
        parentArea: "central",
        productions: [{ resource: "crystal", baseAmount: 5, intervalTicks: 5 }],
        cost: { resource: `${R}/gold`, amount: 80 },
        costScaling: { base: 1.5, exponent: 1 },
        maxLevel: 10, effects: [],
      },
      {
        idName: "mithril_drill",
        name: "Mithril Drill", icon: "🔧", description: "Drills rare mithril",
        parentArea: "central",
        productions: [{ resource: "mithril", baseAmount: 1, intervalTicks: 15 }],
        cost: { resource: `${R}/crystal`, amount: 100 },
        effects: [],
        visibility: {
          3: { type: "cmp", op: "gte",
               left: { type: "resource", target: `${R}/gold` },
               right: { type: "const", value: 300 } },
        },
      },

      // ── Hinterlands (cheap entry) ──
      {
        idName: "farm",
        name: "Farm", icon: "🌾", description: "Grows food",
        parentArea: "hinterlands",
        productions: [{ resource: "food", baseAmount: 15, intervalTicks: 2 }],
        cost: { resource: `${R}/gold`, amount: 40 },
        costScaling: { base: 1.2, exponent: 1 },
        maxLevel: 15, effects: [],
      },

      // ── Central — Gem Forge (auto-discovers at 500 crystal) ──
      {
        idName: "gem_forge",
        name: "Gem Forge", icon: "💠", description: "Refines crystals into mithril",
        parentArea: "central",
        productions: [{ resource: "mithril", baseAmount: 2, intervalTicks: 10 }],
        cost: { resource: `${R}/crystal`, amount: 200 },
        effects: [],
        visibility: {
          3: { type: "cmp", op: "gte",
               left: { type: "resource", target: `${R}/crystal` },
               right: { type: "const", value: 500 } },
        },
      },

      // ── Deep Mine (mid-tier, needs gold) ──
      {
        idName: "deep_crystal_drill",
        name: "Deep Crystal Drill", icon: "🪨", description: "Rich crystal vein",
        parentArea: "deep_mine",
        productions: [{ resource: "crystal", baseAmount: 15, intervalTicks: 6 }],
        cost: { resource: `${R}/gold`, amount: 200 },
        effects: [`${Eff}/deep_crystal`],
      },

      // ── Abyss (end-game, needs mithril) ──
      {
        idName: "essence_extractor",
        name: "Essence Extractor", icon: "🌀", description: "Extracts dark essence",
        parentArea: "abyss",
        productions: [{ resource: "dark_essence", baseAmount: 5, intervalTicks: 6 }],
        cost: { resource: `${R}/mithril`, amount: 5 },
        effects: [],
      },
    ],

    // ──────────────────────────────────────────
    // Areas — directed travel network
    // ──────────────────────────────────────────
    //
    //  Adjacency is directed: each area lists only its OUTGOING edges.
    //  Not all paths are reversible — this is intentional.
    //
    //        central ──────→ hinterlands  (one-way: central→hinterlands)
    //          ↕                            (hinterlands cannot return to central directly)
    //       deep_mine ←───────────────────┘ 
    //          ↕                      ↑
    //          ↓                      │
    //        abyss ──→ hinterlands  (one-way shortcut: abyss→hinterlands)
    //
    //  Two possible loops:
    //    A) central → deep_mine → abyss → hinterlands → deep_mine → central
    //    B) central → hinterlands → deep_mine → central

    areas: [
      {
        idName: "central",
        name: "Central Square", description: "Starting hub",
        parentInit: "overworld",
        spots: ["gold_mine", "crystal_pick", "mithril_drill", "gem_forge"],
        passiveStoryEntries: [`${PSE}/miner_gossip`],
        activeStoryEntries: [`${ASE}/welcome_quest`],
        explorationMax: 100,
        // can reach hinterlands (one-way) and deep_mine (two-way)
        adjacentAreas: ["hinterlands", "deep_mine"],
      },
      {
        idName: "hinterlands",
        name: "Hinterlands", description: "Peaceful farmland",
        parentInit: "overworld",
        spots: ["farm"],
        passiveStoryEntries: [],
        activeStoryEntries: [],
        explorationMax: 100,
        // one-way in: from central. one-way out: to deep_mine.
        // no return path to central — must go deep_mine then back
        adjacentAreas: ["deep_mine"],
        discoveryCost: { resource: `${R}/gold`, amount: 50 },
        purchaseCost:  { resource: `${R}/gold`, amount: 150 },
      },
      {
        idName: "deep_mine",
        name: "Deep Mine", description: "Rich mineral deposits — hub of lower areas",
        parentInit: "overworld",
        spots: ["deep_crystal_drill"],
        passiveStoryEntries: [],
        activeStoryEntries: [],
        explorationMax: 100,
        // two-way with central, one-way down to abyss
        adjacentAreas: ["central", "abyss"],
        purchaseCost: { resource: `${R}/gold`, amount: 500 },
      },
      {
        idName: "abyss",
        name: "The Abyss", description: "Darkness below — shortcut back to hinterlands",
        parentInit: "overworld",
        spots: ["essence_extractor"],
        passiveStoryEntries: [],
        activeStoryEntries: [],
        explorationMax: 200,
        // one-way shortcut: abyss → hinterlands (skips deep_mine → central)
        adjacentAreas: ["hinterlands"],
        purchaseCost: { resource: `${R}/mithril`, amount: 5 },
      },
    ],

    // ──────────────────────────────────────────
    // Inits — two starting points
    // ──────────────────────────────────────────

    inits: [
      {
        idName: "overworld",
        name: "Overworld", description: "The surface world", icon: "🌍",
        startingArea: "central", defaultArea: "central", defaultAreaCooldown: 100,
        areas: ["central", "hinterlands", "deep_mine", "abyss"],
        inheritEnhancements: true,
        startingActions: [
          { type: "add_resource", target: `${R}/gold`,    value: { type: "const", value: 800 } },
          { type: "give_spot",    target: `${S}/gold_mine`, level: { type: "const", value: 1 } },
        ],
      },
      {
        idName: "ng_plus",
        name: "New Game+", description: "Start anew with legacy power", icon: "⭐",
        startingArea: "central", defaultArea: "central", defaultAreaCooldown: 50,
        areas: ["central", "hinterlands"],
        inheritResources: true,
        inheritSpots: true,
        inheritEnhancements: true,
        entryRequirements: { type: "never" },
        startingActions: [
          { type: "add_resource", target: `${R}/gold`,    value: { type: "const", value: 1000 } },
          { type: "add_resource", target: `${R}/crystal`, value: { type: "const", value: 100 } },
          { type: "give_enhancement", target: `${E}/efficiency_boost` },
        ],
      },
    ],

    // ──────────────────────────────────────────
    // Enhancements
    // ──────────────────────────────────────────

    enhancements: [
      {
        idName: "double_crystal",
        name: "Double Crystal", description: "2× crystal output from Crystal Pick",
        icon: "✨", category: "spot_boost", scope: "init",
        parentArea: "central",
        cost: { resource: `${R}/gold`, amount: 300 },
        effects: [`${Eff}/crystal_x2`],
        togglable: true,
      },
      {
        idName: "efficiency_boost",
        name: "Efficiency Boost", description: "Gold Mine produces faster (-2 interval)",
        icon: "⚡", category: "spot_boost", scope: "init",
        parentArea: "central",
        cost: { resource: `${R}/gold`, amount: 500 },
        effects: [`${Eff}/mine_efficiency`],
      },
      {
        idName: "deep_extraction",
        name: "Deep Extraction", description: "2× essence output in the Abyss",
        icon: "🌀", category: "spot_boost", scope: "init",
        parentArea: "abyss",
        cost: { resource: `${R}/dark_essence`, amount: 10 },
        effects: [`${Eff}/essence_boost`],
      },
      {
        idName: "mithril_mastery",
        name: "Mithril Mastery", description: "3× mithril output from Mithril Drill",
        icon: "🏆", category: "spot_boost", scope: "global",
        cost: { resource: `${R}/mithril`, amount: 20 },
        effects: [`${Eff}/mithril_boost`],
        prerequisites: [
          { type: "cmp", op: "gte",
            left: { type: "resource", target: `${R}/mithril` },
            right: { type: "const", value: 50 } },
        ],
      },
    ],

    // ──────────────────────────────────────────
    // Stories
    // ──────────────────────────────────────────

    stories: [
      {
        idName: "welcome_talk",
        talklets: [
          { speaker: "System", text: "Welcome to Arona World!", label: 0 },
          { speaker: "System", text: "Start by gathering resources.", label: 1 },
        ],
      },
      {
        idName: "miner_chat",
        talklets: [
          { speaker: "Miner", text: "Heard there's mithril deep below...", label: 0 },
          { speaker: "Miner", text: "Need a strong drill to reach it.", label: 1 },
        ],
      },
    ],

    activeStoryEntries: [{
      idName: "welcome_quest",
      type: "active",
      story: "welcome_talk",
      parentArea: "central",
      weight: 10, cooldownTicks: 0,
      prerequisites: {
        type: "cmp", op: "gte",
        left: { type: "resource", target: `${R}/gold` },
        right: { type: "const", value: 50 },
      },
    }],

    passiveStoryEntries: [{
      idName: "miner_gossip",
      type: "passive",
      story: "miner_chat",
      parentArea: "central",
      weight: 5, cooldownTicks: 30,
    }],

    chat: {
      baseReward: 1,
      baseIntervalTicks: 3,
      passiveStoryEntrySlots: 1,
    },
  },
}
