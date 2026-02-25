import { PLANT_CARDS } from "@/lib/game/cards/plants";

const ABILITY_DESCRIPTION_MAP: Record<string, string> = {
  fruit_drop_round_end: "Round end: gain bonus flowers from ripe fruit.",
  ground_cover_passive: "Passive: reduces upkeep pressure while established.",
  water_retention: "Passive: holds water efficiently and resists drying out.",
  reservoir_action_once_per_round: "Action (once per round): store extra water for later use.",
  pollinator_magnet_round_end: "Round end: attracts pollinators and gains flowers.",
  trellis_chain_round_end: "Round end: gains value when supported by nearby growth.",
  companion_planting_passive: "Passive: improves neighboring plants when planted together.",
  bloom_prestige_round_end: "Round end: scores extra prestige from blooms.",
  nectar_economy_round_end: "Round end: converts nectar production into bonus points.",
  infestation_proof_event: "Event reaction: blocks pest events and gains 1 seed.",
  shared_hunt_round_end: "Round end: converts up to 2 bugs into flowers and gains 1 seed.",
  spreading_runner_round_end: "Round end: spreads runners to expand presence.",
  spread_enters_with_zero_water: "Spreads start dry and must be watered to grow.",
  modest_bloom_round_end: "Round end: if full water, gain 1 flower token.",
  fertile_bloom_round_end: "Round end: if this flowers, gain 1 seed.",
  lunar_hydration_round_end: "Round end: if this flowers, gain 1 water.",
  shared_radiance_passive:
    "Passive: adjacent plants need 1 less water to count as full for flowering (minimum 1 water).",
  royal_bloom_round_end: "Round end: if this flowers, gain 2 flower tokens.",
  seed_conversion_round_end: "Round end: may convert 2 flower tokens into 1 seed.",
  pollinator_surge_round_end: "Round end: if two or more plants flower, gain 1 additional flower token.",
  chorus_effect_round_end: "Round end: if at least 3 plants flower, gain 2 seeds.",
  crystal_bloom_round_end: "Round end: if this flowers while full, gain 1 flower token and 1 water.",
  bloom_transmutation_action_once_per_round:
    "Action (once per round): spend 1 flower token to gain 1 water and 1 seed.",
  unified_bloom_round_end: "Round end: if full, adjacent plants gain 1 water before flowering checks.",
  grand_bloom_event_round_end: "Round end: if 4 or more plants flower, gain 3 flower tokens and 2 seeds.",
  minimalist_game_end: "Game end: gain +1 point if this plant never held more than 1 water.",
  scarcity_flower_round_end: "Round end: if this plant has exactly 1 water, gain 1 flower token.",
  dry_resistance_event: "Event reaction: loses 1 less water during Dry Heat events (minimum 0).",
  redistribution_round_end: "Round end: move 1 water from any plant to another plant in your garden.",
  heat_thrives_event: "Event reaction: during Dry Heat, gain +2 seeds.",
  oppressive_shade_round_end: "Round end: if this plant has 0 water and survives, gain 1 seed.",
  low_water_colony_game_end: "Game end: gain +1 point if adjacent to another plant with 1 or less water.",
  evaporation_pressure_round_end:
    "Round end: if this plant has 0 water, each opponent full-water plant loses 1 water.",
  false_spring_game_end: "Game end: gain +2 points if a Rainstorm event occurred this game.",
  deep_roots_passive:
    "Passive: may hold 1 overflow water above capacity; overflow is immune to event-based removal.",
  bloom_through_ash_round_end:
    "Round end: when flowering below half water, gain +2 flower tokens instead of 1.",
  sovereign_of_scarcity_game_end:
    "Game end: gain +1 point per plant at 1 or less water and +2 points per revealed Dry Heat event."
};

const PLANT_CARD_MAP = new Map(PLANT_CARDS.map((card) => [card.id, card]));

export function getPlantCardById(plantId: string) {
  return PLANT_CARD_MAP.get(plantId) ?? null;
}

export function getPlantDisplayName(plantId: string) {
  return getPlantCardById(plantId)?.name ?? plantId;
}

export function getPlantSummaryLabel(plantId: string) {
  const card = getPlantCardById(plantId);
  if (!card) {
    return plantId;
  }

  return `${card.name} (Seed ${card.seedCost}, Pts ${card.points}, Decay ${card.decayPerRound})`;
}

export function getPlantAbilityDescriptions(abilityIds: string[]) {
  return abilityIds.map((abilityId) => ABILITY_DESCRIPTION_MAP[abilityId] ?? abilityId);
}
