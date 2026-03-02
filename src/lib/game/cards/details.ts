import { PLANT_CARDS } from "@/lib/game/cards/plants";
import { getPlantSchool } from "@/lib/game/cards/schools";
import { powerRegistry } from "@/lib/game/powers/cardPowers";
import { formatPowerDslSummary } from "@/lib/game/powers/formatPowerText";

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

export function getPlantFlavorText(plantId: string) {
  const card = getPlantCardById(plantId);
  if (!card) {
    return "";
  }

  if (card.flavorText) {
    return card.flavorText;
  }

  const school = getPlantSchool(plantId);
  if (school === "arid") {
    return "It stores tomorrow's sun one drop at a time.";
  }

  if (school === "carnivorous") {
    return "Quiet roots trade in hunger, memory, and shadow.";
  }

  if (school === "bloom") {
    return "Its blossoms drift where tomorrow's pollinators wait.";
  }

  return "Wild growth finds a way between every careful plan.";
}

export function getPlantAbilityDescriptions(powerIdsOrPlantId: string[] | string) {
  const powerIds = Array.isArray(powerIdsOrPlantId)
    ? powerIdsOrPlantId
    : getPlantCardById(powerIdsOrPlantId)?.powerIds ?? [];

  return powerIds
    .map((powerId) => {
      const power = powerRegistry[powerId];

      if (!power) {
        return null;
      }

      return formatPowerDslSummary(power);
    })
    .filter((summary): summary is string => Boolean(summary));
}
