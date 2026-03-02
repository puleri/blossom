export type PlantSchool = "carnivorous" | "bloom" | "arid" | "wild";

const CARNIVOROUS_PLANT_IDS = new Set([
  "venus-flytrap",
  "pitcher-plant",
  "sundew-cluster",
  "cobra-lily",
  "bladderwort",
  "thornmaw-bramble",
  "sporefang-vine",
  "gloomtrap-shrub",
  "mawroot-bulb",
  "carrion-bloom",
  "razorleaf-net",
  "apex-devourer",
  "dustcap-mycelium",
  "gravecap-recycler",
  "veilspore-archivist"
]);

const BLOOM_PLANT_IDS = new Set([
  "mint",
  "sunpetal-daisy",
  "golden-marigold",
  "night-lantern-flower",
  "bloomkeeper-ivy",
  "crowned-peony",
  "petal-archivist",
  "nectar-fountain",
  "sun-choir-shrub",
  "dewglass-orchid",
  "petal-alchemist",
  "sunroot-conductor",
  "verdant-festival-tree"
]);

const ARID_PLANT_IDS = new Set([
  "sandspire-cactus",
  "dustbloom-succulent",
  "thornbark-shrub",
  "parched-root-network",
  "sunscorch-agave",
  "wither-sage",
  "oasis-edge-mat-creeper",
  "scorchvine",
  "mirage-bloom",
  "ironwood-sapling",
  "ashflower-bush",
  "dominion-baobab"
]);

const SCHOOL_BORDER_COLOR: Record<PlantSchool, string> = {
  carnivorous: "#7f1d1d",
  bloom: "#a21caf",
  arid: "#b45309",
  wild: "#9ca3af"
};

export function getPlantSchool(plantId: string): PlantSchool {
  if (CARNIVOROUS_PLANT_IDS.has(plantId)) {
    return "carnivorous";
  }

  if (BLOOM_PLANT_IDS.has(plantId)) {
    return "bloom";
  }

  if (ARID_PLANT_IDS.has(plantId)) {
    return "arid";
  }

  return "wild";
}

export function getPlantSchoolBorderColor(plantId: string) {
  return SCHOOL_BORDER_COLOR[getPlantSchool(plantId)];
}
