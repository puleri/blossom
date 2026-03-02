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
  "Pollinate — Draw 1 plant card.",
  "Pollinate — Draw 2 plant cards, then discard 1 card.",
  "Pollinate — Draw 1 plant card and gain 1 seed.",
  "Pollinate — Draw 2 plant cards.",
  "Pollinate — Draw 2 plant cards, then tuck 1 card from your hand."
] as const;

const DESERT_ENGINE_LINES = [
  "To the Sun — Gain 1 sunlight token and place it on an Oasis Edge plant.",
  "To the Sun — Gain 2 sunlight tokens and distribute them across Oasis Edge plants.",
  "To the Sun — Gain 1 sunlight token per planted Oasis Edge card (max 3).",
  "To the Sun — Move 1 sunlight from one Oasis Edge plant to another, then gain 1 sunlight.",
  "To the Sun — Gain 3 sunlight tokens; fully grown plants may trigger mature effects."
] as const;

const RAINFOREST_ENGINE_LINES = [
  "Root — Gain 1 resource of your choice (water, nutrients, seeds, or compost).",
  "Root — Gain 2 mixed root resources.",
  "Root — Gain 1 compost and 1 water.",
  "Root — Gain 1 resource per Understory plant (max 3).",
  "Root — Gain 2 resources, then you may tuck 1 card from your hand."
] as const;

function deriveBiome(cardId: string): BiomeName {
  const school = getPlantSchool(cardId);
  if (school === "arid") {
    return "oasisEdge";
  }

  if (school === "carnivorous") {
    return "understory";
  }

  return "meadow";
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
  if (biome === "oasisEdge") {
    return Math.min(6, level + 2);
  }

  if (biome === "meadow") {
    return Math.min(5, level + 1);
  }

  return Math.min(4, level);
}

function deriveEngineSummary(card: PlantCard, cardIndexWithinBiome: number, biome: BiomeName) {
  const source = biome === "meadow" ? PLAINS_ENGINE_LINES : biome === "oasisEdge" ? DESERT_ENGINE_LINES : RAINFOREST_ENGINE_LINES;
  return source[cardIndexWithinBiome % source.length];
}

const profilesById = new Map<string, PlantEngineProfile>();
const playableBiomesById = new Map<string, BiomeName[]>();
const biomeCounts: Record<BiomeName, number> = { oasisEdge: 0, meadow: 0, understory: 0 };

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
    oasisEdge: [],
    meadow: [],
    understory: []
  };

  PLANT_CARDS.forEach((card) => {
    const profile = getPlantEngineProfile(card.id);
    if (!profile) return;
    grouped[profile.biome].push(card);
  });

  return grouped;
}
