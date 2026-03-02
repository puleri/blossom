export const ROUNDS_TOTAL = 25;

export const GARDEN_SLOT_MIN = 15;
export const GARDEN_SLOT_MAX = 15;
export const GARDEN_SLOT_DEFAULT = 15;

export const SETUP_HAND_SIZE = 5;

export const ACTIONS_PER_TURN = 2;

export const BIOME_ORDER = ["oasisEdge", "meadow", "understory"] as const;

export const BIOME_SLOT_INDICES: Record<"oasisEdge" | "meadow" | "understory", readonly number[]> = {
  oasisEdge: [0, 1, 2, 3, 4],
  meadow: [5, 6, 7, 8, 9],
  understory: [10, 11, 12, 13, 14]
} as const;

export const BIOME_LABELS = {
  oasisEdge: "Oasis Edge",
  meadow: "Meadow",
  understory: "Understory"
} as const;

export const SETUP_STARTING_RESOURCES = {
  water: 3,
  seeds: 2,
  buds: 0,
  flowers: 0,
  bugs: 0
} as const;
