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
  spread_enters_with_zero_water: "Spreads start dry and must be watered to grow."
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
