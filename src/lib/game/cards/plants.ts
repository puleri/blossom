import type { PlantCard } from "@/lib/game/types";

export const PLANT_CARDS: PlantCard[] = [
  { id: "sunblossom", name: "Sunblossom", seedCost: 1, points: 2, waterCapacity: 3, decayPerRound: 1, requiresUpkeep: false, abilities: ["gain_flower_on_grow"] },
  { id: "dewfern", name: "Dewfern", seedCost: 1, points: 1, waterCapacity: 4, decayPerRound: 1, requiresUpkeep: false, abilities: ["store_extra_water"] },
  { id: "thornvine", name: "Thornvine", seedCost: 2, points: 3, waterCapacity: 2, decayPerRound: 1, requiresUpkeep: true, abilities: ["repel_infestation"] },
  { id: "mosscap", name: "Mosscap", seedCost: 1, points: 2, waterCapacity: 5, decayPerRound: 1, requiresUpkeep: false, abilities: ["ignore_first_decay"] },
  { id: "amberroot", name: "Amberroot", seedCost: 2, points: 4, waterCapacity: 3, decayPerRound: 1, requiresUpkeep: true, abilities: ["convert_seed_to_point"] },
  { id: "bluebell", name: "Bluebell", seedCost: 1, points: 2, waterCapacity: 2, decayPerRound: 1, requiresUpkeep: false, abilities: ["draw_on_water"] },
  { id: "cinderbloom", name: "Cinderbloom", seedCost: 2, points: 3, waterCapacity: 2, decayPerRound: 2, requiresUpkeep: false, abilities: ["score_if_dry_heat"] },
  { id: "ivyspire", name: "Ivyspire", seedCost: 3, points: 5, waterCapacity: 4, decayPerRound: 1, requiresUpkeep: true, abilities: ["water_neighbors"] },
  { id: "petalrush", name: "Petalrush", seedCost: 1, points: 1, waterCapacity: 1, decayPerRound: 1, requiresUpkeep: false, abilities: ["quick_bloom"] },
  { id: "moonorchid", name: "Moonorchid", seedCost: 2, points: 4, waterCapacity: 3, decayPerRound: 1, requiresUpkeep: true, abilities: ["score_on_event_reveal"] },
  { id: "reedglow", name: "Reedglow", seedCost: 2, points: 2, waterCapacity: 6, decayPerRound: 1, requiresUpkeep: false, abilities: ["share_water"] },
  { id: "wildclover", name: "Wildclover", seedCost: 1, points: 2, waterCapacity: 3, decayPerRound: 1, requiresUpkeep: false, abilities: ["gain_seed_on_harvest"] }
];

export const PLANT_CARD_IDS = PLANT_CARDS.map((card) => card.id);
