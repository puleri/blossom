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
    id: "sundew-cluster",
    name: "Sundew Cluster",
    seedCost: 1,
    points: 3,
    waterCapacity: 2,
    decayPerRound: 1,
    requiresUpkeep: true,
    abilities: ["sticky_trap_action_once_per_round"]
  },
  {
    id: "cobra-lily",
    name: "Cobra Lily",
    seedCost: 3,
    points: 8,
    waterCapacity: 3,
    decayPerRound: 1,
    requiresUpkeep: true,
    abilities: ["venomous_bloom_round_end"]
  },
  {
    id: "bladderwort",
    name: "Bladderwort",
    seedCost: 2,
    points: 5,
    waterCapacity: 3,
    decayPerRound: 1,
    requiresUpkeep: true,
    abilities: ["water_feast_round_end"]
  },
  {
    id: "thornmaw-bramble",
    name: "Thornmaw Bramble",
    seedCost: 2,
    points: 6,
    waterCapacity: 3,
    decayPerRound: 1,
    requiresUpkeep: true,
    abilities: ["predatory_pressure_round_end"]
  },
  {
    id: "sporefang-vine",
    name: "Sporefang Vine",
    seedCost: 2,
    points: 6,
    waterCapacity: 3,
    decayPerRound: 1,
    requiresUpkeep: true,
    abilities: ["infestation_catalyst_event"]
  },
  {
    id: "gloomtrap-shrub",
    name: "Gloomtrap Shrub",
    seedCost: 3,
    points: 9,
    waterCapacity: 4,
    decayPerRound: 1,
    requiresUpkeep: true,
    abilities: ["dark_canopy_round_end"]
  },
  {
    id: "mawroot-bulb",
    name: "Mawroot Bulb",
    seedCost: 2,
    points: 5,
    waterCapacity: 2,
    decayPerRound: 1,
    requiresUpkeep: true,
    abilities: ["digest_action"]
  },
  {
    id: "carrion-bloom",
    name: "Carrion Bloom",
    seedCost: 3,
    points: 8,
    waterCapacity: 3,
    decayPerRound: 1,
    requiresUpkeep: true,
    abilities: ["feeding_frenzy_round_end"]
  },
  {
    id: "razorleaf-net",
    name: "Razorleaf Net",
    seedCost: 2,
    points: 6,
    waterCapacity: 3,
    decayPerRound: 1,
    requiresUpkeep: true,
    abilities: ["web_of_fangs_round_end"]
  },
  {
    id: "apex-devourer",
    name: "Apex Devourer",
    seedCost: 4,
    points: 12,
    waterCapacity: 4,
    decayPerRound: 1,
    requiresUpkeep: true,
    abilities: ["sovereign_predator_game_end"]
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
  },
  {
    id: "sunpetal-daisy",
    name: "Sunpetal Daisy",
    seedCost: 1,
    points: 3,
    waterCapacity: 2,
    decayPerRound: 1,
    requiresUpkeep: true,
    abilities: ["modest_bloom_round_end"]
  },
  {
    id: "golden-marigold",
    name: "Golden Marigold",
    seedCost: 2,
    points: 6,
    waterCapacity: 3,
    decayPerRound: 1,
    requiresUpkeep: true,
    abilities: ["fertile_bloom_round_end"]
  },
  {
    id: "night-lantern-flower",
    name: "Night Lantern Flower",
    seedCost: 2,
    points: 5,
    waterCapacity: 3,
    decayPerRound: 1,
    requiresUpkeep: true,
    abilities: ["lunar_hydration_round_end"]
  },
  {
    id: "bloomkeeper-ivy",
    name: "Bloomkeeper Ivy",
    seedCost: 2,
    points: 4,
    waterCapacity: 2,
    decayPerRound: 1,
    requiresUpkeep: true,
    abilities: ["shared_radiance_passive"]
  },
  {
    id: "crowned-peony",
    name: "Crowned Peony",
    seedCost: 3,
    points: 9,
    waterCapacity: 4,
    decayPerRound: 1,
    requiresUpkeep: true,
    abilities: ["royal_bloom_round_end"]
  },
  {
    id: "petal-archivist",
    name: "Petal Archivist",
    seedCost: 2,
    points: 3,
    waterCapacity: 2,
    decayPerRound: 1,
    requiresUpkeep: true,
    abilities: ["seed_conversion_round_end"]
  },
  {
    id: "nectar-fountain",
    name: "Nectar Fountain",
    seedCost: 3,
    points: 7,
    waterCapacity: 4,
    decayPerRound: 1,
    requiresUpkeep: true,
    abilities: ["pollinator_surge_round_end"]
  },
  {
    id: "sun-choir-shrub",
    name: "Sun Choir Shrub",
    seedCost: 2,
    points: 6,
    waterCapacity: 3,
    decayPerRound: 1,
    requiresUpkeep: true,
    abilities: ["chorus_effect_round_end"]
  },
  {
    id: "dewglass-orchid",
    name: "Dewglass Orchid",
    seedCost: 3,
    points: 10,
    waterCapacity: 3,
    decayPerRound: 2,
    requiresUpkeep: true,
    abilities: ["crystal_bloom_round_end"]
  },
  {
    id: "petal-alchemist",
    name: "Petal Alchemist",
    seedCost: 2,
    points: 4,
    waterCapacity: 2,
    decayPerRound: 1,
    requiresUpkeep: true,
    abilities: ["bloom_transmutation_action_once_per_round"]
  },
  {
    id: "sunroot-conductor",
    name: "Sunroot Conductor",
    seedCost: 3,
    points: 8,
    waterCapacity: 4,
    decayPerRound: 1,
    requiresUpkeep: true,
    abilities: ["unified_bloom_round_end"]
  },
  {
    id: "verdant-festival-tree",
    name: "Verdant Festival Tree",
    seedCost: 4,
    points: 12,
    waterCapacity: 5,
    decayPerRound: 1,
    requiresUpkeep: true,
    abilities: ["grand_bloom_event_round_end"]
  },
  {
    id: "sandspire-cactus",
    name: "Sandspire Cactus",
    seedCost: 1,
    points: 4,
    waterCapacity: 2,
    decayPerRound: 0,
    requiresUpkeep: false,
    abilities: ["minimalist_game_end"]
  },
  {
    id: "dustbloom-succulent",
    name: "Dustbloom Succulent",
    seedCost: 2,
    points: 6,
    waterCapacity: 3,
    decayPerRound: 0,
    requiresUpkeep: false,
    abilities: ["scarcity_flower_round_end"]
  },
  {
    id: "thornbark-shrub",
    name: "Thornbark Shrub",
    seedCost: 2,
    points: 5,
    waterCapacity: 3,
    decayPerRound: 1,
    requiresUpkeep: false,
    abilities: ["dry_resistance_event"]
  },
  {
    id: "parched-root-network",
    name: "Parched Root Network",
    seedCost: 3,
    points: 7,
    waterCapacity: 4,
    decayPerRound: 1,
    requiresUpkeep: false,
    abilities: ["redistribution_round_end"]
  },
  {
    id: "sunscorch-agave",
    name: "Sunscorch Agave",
    seedCost: 3,
    points: 8,
    waterCapacity: 3,
    decayPerRound: 0,
    requiresUpkeep: false,
    abilities: ["heat_thrives_event"]
  },
  {
    id: "wither-sage",
    name: "Wither Sage",
    seedCost: 2,
    points: 4,
    waterCapacity: 2,
    decayPerRound: 1,
    requiresUpkeep: false,
    abilities: ["oppressive_shade_round_end"]
  },
  {
    id: "desert-mat-creeper",
    name: "Desert Mat Creeper",
    seedCost: 1,
    points: 2,
    waterCapacity: 1,
    decayPerRound: 0,
    requiresUpkeep: false,
    abilities: ["low_water_colony_game_end"]
  },
  {
    id: "scorchvine",
    name: "Scorchvine",
    seedCost: 2,
    points: 6,
    waterCapacity: 3,
    decayPerRound: 1,
    requiresUpkeep: false,
    abilities: ["evaporation_pressure_round_end"]
  },
  {
    id: "mirage-bloom",
    name: "Mirage Bloom",
    seedCost: 2,
    points: 5,
    waterCapacity: 2,
    decayPerRound: 1,
    requiresUpkeep: false,
    abilities: ["false_spring_game_end"]
  },
  {
    id: "ironwood-sapling",
    name: "Ironwood Sapling",
    seedCost: 3,
    points: 9,
    waterCapacity: 5,
    decayPerRound: 1,
    requiresUpkeep: false,
    abilities: ["deep_roots_passive"]
  },
  {
    id: "ashflower-bush",
    name: "Ashflower Bush",
    seedCost: 2,
    points: 6,
    waterCapacity: 2,
    decayPerRound: 1,
    requiresUpkeep: false,
    abilities: ["bloom_through_ash_round_end"]
  },
  {
    id: "dominion-baobab",
    name: "Dominion Baobab",
    seedCost: 4,
    points: 12,
    waterCapacity: 5,
    decayPerRound: 1,
    requiresUpkeep: false,
    abilities: ["sovereign_of_scarcity_game_end"]
  }
];

export const PLANT_CARD_IDS = PLANT_CARDS.map((card) => card.id);
