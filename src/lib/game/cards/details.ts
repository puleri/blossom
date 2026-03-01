import { PLANT_CARDS } from "@/lib/game/cards/plants";

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

  return `${card.name} (Pts ${card.points})`;
}

export function getPlantAbilityDescriptions(_abilityIds: string[]) {
  return [];
}
