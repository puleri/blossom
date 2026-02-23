import type { PlantCard } from "@/lib/game/types";

export const PLANT_CARDS: PlantCard[] = [
  {
    id: "strawberry-bush",
    name: "Strawberry Bush",
    seedCost: 1,
    points: 3,
    waterCapacity: 2,
    decayPerRound: 1,
    requiresUpkeep: true,
    abilities: ["fruit_drop_round_end"]
  },
  {
    id: "clover-patch",
    name: "Clover Patch",
    seedCost: 0,
    points: 1,
    waterCapacity: 1,
    decayPerRound: 1,
    requiresUpkeep: false,
    abilities: ["ground_cover_passive"]
  },
  {
    id: "aloe-vera",
    name: "Aloe Vera",
    seedCost: 1,
    points: 4,
    waterCapacity: 3,
    decayPerRound: 0,
    requiresUpkeep: false,
    abilities: ["water_retention"]
  },
  {
    id: "barrel-cactus",
    name: "Barrel Cactus",
    seedCost: 2,
    points: 7,
    waterCapacity: 4,
    decayPerRound: 1,
    requiresUpkeep: false,
    abilities: ["reservoir_action_once_per_round"]
  },
  {
    id: "lavender",
    name: "Lavender",
    seedCost: 1,
    points: 4,
    waterCapacity: 2,
    decayPerRound: 1,
    requiresUpkeep: true,
    abilities: ["pollinator_magnet_round_end"]
  },
  {
    id: "tomato-vine",
    name: "Tomato Vine",
    seedCost: 2,
    points: 5,
    waterCapacity: 3,
    decayPerRound: 1,
    requiresUpkeep: true,
    abilities: ["trellis_chain_round_end"]
  },
  {
    id: "basil",
    name: "Basil",
    seedCost: 1,
    points: 3,
    waterCapacity: 2,
    decayPerRound: 1,
    requiresUpkeep: false,
    abilities: ["companion_planting_passive"]
  },
  {
    id: "orchid",
    name: "Orchid",
    seedCost: 3,
    points: 10,
    waterCapacity: 3,
    decayPerRound: 2,
    requiresUpkeep: true,
    abilities: ["bloom_prestige_round_end"]
  },
  {
    id: "bird-of-paradise",
    name: "Bird-of-Paradise",
    seedCost: 2,
    points: 9,
    waterCapacity: 4,
    decayPerRound: 2,
    requiresUpkeep: true,
    abilities: ["nectar_economy_round_end"]
  },
  {
    id: "venus-flytrap",
    name: "Venus Flytrap",
    seedCost: 2,
    points: 6,
    waterCapacity: 2,
    decayPerRound: 1,
    requiresUpkeep: false,
    abilities: ["infestation_proof_event"]
  },
  {
    id: "pitcher-plant",
    name: "Pitcher Plant",
    seedCost: 1,
    points: 4,
    waterCapacity: 2,
    decayPerRound: 1,
    requiresUpkeep: true,
    abilities: ["shared_hunt_round_end"]
  },
  {
    id: "mint",
    name: "Mint",
    seedCost: 1,
    points: 2,
    waterCapacity: 2,
    decayPerRound: 1,
    requiresUpkeep: true,
    abilities: ["spreading_runner_round_end", "spread_enters_with_zero_water"]
  }
];

export const PLANT_CARD_IDS = PLANT_CARDS.map((card) => card.id);
