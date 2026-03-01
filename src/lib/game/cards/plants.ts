import type { PlantCard } from "@/lib/game/types";

export const PLANT_CARDS: PlantCard[] = [
  {
    id: "strawberry-bush",
    name: "Strawberry Bush",
    points: 3,
  },
  {
    id: "clover-patch",
    name: "Clover Patch",
    points: 1,
  },
  {
    id: "aloe-vera",
    name: "Aloe Vera",
    points: 4,
  },
  {
    id: "barrel-cactus",
    name: "Barrel Cactus",
    points: 7,
  },
  {
    id: "lavender",
    name: "Lavender",
    points: 4,
  },
  {
    id: "tomato-vine",
    name: "Tomato Vine",
    points: 5,
  },
  {
    id: "basil",
    name: "Basil",
    points: 3,
  },
  {
    id: "orchid",
    name: "Orchid",
    points: 10,
  },
  {
    id: "bird-of-paradise",
    name: "Bird-of-Paradise",
    points: 9,
  },
  {
    id: "venus-flytrap",
    name: "Venus Flytrap",
    points: 6,
  },
  {
    id: "pitcher-plant",
    name: "Pitcher Plant",
    points: 4,
  },
  {
    id: "sundew-cluster",
    name: "Sundew Cluster",
    points: 3,
  },
  {
    id: "cobra-lily",
    name: "Cobra Lily",
    points: 8,
  },
  {
    id: "bladderwort",
    name: "Bladderwort",
    points: 5,
  },
  {
    id: "thornmaw-bramble",
    name: "Thornmaw Bramble",
    points: 6,
  },
  {
    id: "sporefang-vine",
    name: "Sporefang Vine",
    points: 6,
  },
  {
    id: "gloomtrap-shrub",
    name: "Gloomtrap Shrub",
    points: 9,
  },
  {
    id: "mawroot-bulb",
    name: "Mawroot Bulb",
    points: 5,
  },
  {
    id: "carrion-bloom",
    name: "Carrion Bloom",
    points: 8,
  },
  {
    id: "razorleaf-net",
    name: "Razorleaf Net",
    points: 6,
  },
  {
    id: "apex-devourer",
    name: "Apex Devourer",
    points: 12,
  },
  {
    id: "mint",
    name: "Mint",
    points: 2,
  },
  {
    id: "sunpetal-daisy",
    name: "Sunpetal Daisy",
    points: 3,
  },
  {
    id: "golden-marigold",
    name: "Golden Marigold",
    points: 6,
  },
  {
    id: "night-lantern-flower",
    name: "Night Lantern Flower",
    points: 5,
  },
  {
    id: "bloomkeeper-ivy",
    name: "Bloomkeeper Ivy",
    points: 4,
  },
  {
    id: "crowned-peony",
    name: "Crowned Peony",
    points: 9,
  },
  {
    id: "petal-archivist",
    name: "Petal Archivist",
    points: 3,
  },
  {
    id: "nectar-fountain",
    name: "Nectar Fountain",
    points: 7,
  },
  {
    id: "sun-choir-shrub",
    name: "Sun Choir Shrub",
    points: 6,
  },
  {
    id: "dewglass-orchid",
    name: "Dewglass Orchid",
    points: 10,
  },
  {
    id: "petal-alchemist",
    name: "Petal Alchemist",
    points: 4,
  },
  {
    id: "sunroot-conductor",
    name: "Sunroot Conductor",
    points: 8,
  },
  {
    id: "verdant-festival-tree",
    name: "Verdant Festival Tree",
    points: 12,
  },
  {
    id: "sandspire-cactus",
    name: "Sandspire Cactus",
    points: 4,
  },
  {
    id: "dustbloom-succulent",
    name: "Dustbloom Succulent",
    points: 6,
  },
  {
    id: "thornbark-shrub",
    name: "Thornbark Shrub",
    points: 5,
  },
  {
    id: "parched-root-network",
    name: "Parched Root Network",
    points: 7,
  },
  {
    id: "sunscorch-agave",
    name: "Sunscorch Agave",
    points: 8,
  },
  {
    id: "wither-sage",
    name: "Wither Sage",
    points: 4,
  },
  {
    id: "desert-mat-creeper",
    name: "Desert Mat Creeper",
    points: 2,
  },
  {
    id: "scorchvine",
    name: "Scorchvine",
    points: 6,
  },
  {
    id: "mirage-bloom",
    name: "Mirage Bloom",
    points: 5,
  },
  {
    id: "ironwood-sapling",
    name: "Ironwood Sapling",
    points: 9,
  },
  {
    id: "ashflower-bush",
    name: "Ashflower Bush",
    points: 6,
  },
  {
    id: "dominion-baobab",
    name: "Dominion Baobab",
    points: 12,
  },
  {
    id: "dustcap-mycelium",
    name: "Dustcap Mycelium",
    points: 4,
    biome: "rainforest",
    level: 2,
    sunCapacity: 2,
    engineSummary: "Root — You may spend 1 compost to draw 2 plant cards.",
    flavorText: "What dies above feeds what spreads below."
  },
  {
    id: "gravecap-recycler",
    name: "Gravecap Recycler",
    points: 4,
    biome: "rainforest",
    level: 2,
    sunCapacity: 3,
    engineSummary: "Root — You may tuck 1 card from your hand beneath this plant to gain 1 compost.",
    flavorText: "Nothing is wasted beneath the soil."
  },
  {
    id: "veilspore-archivist",
    name: "Veilspore Archivist",
    points: 5,
    biome: "plains",
    level: 3,
    sunCapacity: 4,
    engineSummary: "Pollinate — Draw 2 cards, then tuck 1 card from your hand beneath this plant.",
    flavorText: "It remembers what the forest forgets."
  }
];

export const PLANT_CARD_IDS = PLANT_CARDS.map((card) => card.id);
