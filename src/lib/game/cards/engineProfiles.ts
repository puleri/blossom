import { PLANT_CARDS } from "@/lib/game/cards/plants";
import { getPlantSchool } from "@/lib/game/cards/schools";
import type { BiomeName, PlantCard } from "@/lib/game/types";

export interface PlantEngineProfile {
  biome: BiomeName;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  sunCost: number;
  sunCapacity: number;
  engineSummary: string;
}

const PLAINS_ENGINE_LINES = [
  "Draw 1 card.",
  "Draw 1 card and gain 1 sun token.",
  "Draw 1 card and gain 1 water token.",
  "Draw 2 cards, then discard 1 card.",
  "Draw 1 card, then tuck 1 card from your hand."
] as const;

const DESERT_ENGINE_LINES = [
  "Gain 1 sun token.",
  "Gain 2 sun tokens.",
  "Gain 1 sun token and convert 1 water into 1 sun.",
  "Gain 1 sun token per Desert plant (max 3).",
  "Spend 1 sun to gain 2 sun and draw 1 card."
] as const;

const RAINFOREST_ENGINE_LINES = [
  "Gain 1 rain token.",
  "Gain 2 rain tokens.",
  "Gain 1 rain and draw 1 card.",
  "Gain 1 rain token per Rainforest plant (max 3).",
  "Gain 1 rain and 1 sun token."
] as const;

function deriveBiome(cardId: string): BiomeName {
  const school = getPlantSchool(cardId);
  if (school === "arid") {
    return "desert";
  }

  if (school === "carnivorous") {
    return "rainforest";
  }

  return "plains";
}

function getCardPlayableBiomes(card: PlantCard): BiomeName[] {
  if (Array.isArray(card.biome) && card.biome.length > 0) {
    return card.biome;
  }

  if (typeof card.biome === "string") {
    return [card.biome];
  }

  return [deriveBiome(card.id)];
}

function deriveLevel(card: PlantCard): PlantEngineProfile["level"] {
  return Math.min(6, Math.max(1, Math.ceil(card.points / 2))) as PlantEngineProfile["level"];
}

function deriveSunCost(level: PlantEngineProfile["level"]) {
  return level <= 1 ? 0 : level - 1;
}

function deriveSunCapacity(biome: BiomeName, level: PlantEngineProfile["level"]) {
  if (biome === "desert") {
    return Math.min(6, level + 2);
  }

  if (biome === "plains") {
    return Math.min(5, level + 1);
  }

  return Math.min(4, level);
}

function deriveEngineSummary(card: PlantCard, cardIndexWithinBiome: number, biome: BiomeName) {
  const source = biome === "plains" ? PLAINS_ENGINE_LINES : biome === "desert" ? DESERT_ENGINE_LINES : RAINFOREST_ENGINE_LINES;
  const baseLine = source[cardIndexWithinBiome % source.length];
  if (biome !== "desert") {
    return baseLine;
  }

  return `${baseLine} Sun is required to play level 2-6 plants.`;
}

const profilesById = new Map<string, PlantEngineProfile>();
const playableBiomesById = new Map<string, BiomeName[]>();
const biomeCounts: Record<BiomeName, number> = { desert: 0, plains: 0, rainforest: 0 };

PLANT_CARDS.forEach((card) => {
  const playableBiomes = getCardPlayableBiomes(card);
  const biome = playableBiomes[0];
  const level = card.level ?? deriveLevel(card);
  const sunCost = card.sunCost ?? deriveSunCost(level);
  const sunCapacity = card.sunCapacity ?? deriveSunCapacity(biome, level);
  const engineSummary = card.engineSummary ?? deriveEngineSummary(card, biomeCounts[biome], biome);

  playableBiomesById.set(card.id, playableBiomes);

  profilesById.set(card.id, {
    biome,
    level,
    sunCost,
    sunCapacity,
    engineSummary
  });

  biomeCounts[biome] += 1;
});

export function getPlantEngineProfile(plantId: string): PlantEngineProfile | null {
  return profilesById.get(plantId) ?? null;
}

export function getPlantPlayableBiomes(plantId: string): BiomeName[] {
  return playableBiomesById.get(plantId) ?? [];
}

export function getCardsByBiome() {
  const grouped: Record<BiomeName, PlantCard[]> = {
    desert: [],
    plains: [],
    rainforest: []
  };

  PLANT_CARDS.forEach((card) => {
    const profile = getPlantEngineProfile(card.id);
    if (!profile) return;
    grouped[profile.biome].push(card);
  });

  return grouped;
}
