import { getPlantCardById } from "@/lib/game/cards/details";
import type { EventCard, PlayerDoc } from "@/lib/game/types";

function clampResource(value: number) {
  return Math.max(0, value);
}

function getGardenPlantIds(player: PlayerDoc) {
  return player.gardenPlantIds ?? player.gardenSlots.map(() => null);
}

function computeTableauPlantPoints(player: PlayerDoc) {
  const plantIds = getGardenPlantIds(player);

  return player.gardenSlots.reduce((total, slot, index) => {
    const plantId = plantIds[index];
    const card = plantId ? getPlantCardById(plantId) : null;

    if (slot === "grown") {
      return total + (card?.points ?? 2);
    }

    if (slot === "seedling") {
      const basePoints = card?.points ?? 2;
      return total + Math.max(1, Math.floor(basePoints / 2));
    }

    return total;
  }, 0);
}

export function applyEventToPlayers(players: PlayerDoc[], event: EventCard): PlayerDoc[] {
  return players.map((player) => {
    if (event.effectType === "points") {
      return { ...player, score: clampResource(player.score + event.value) };
    }

    const nextResources = {
      ...player.resources,
      [event.effectType]: clampResource(player.resources[event.effectType] + event.value)
    };

    return { ...player, resources: nextResources };
  });
}

export function applyPlantDecayAndDeaths(player: PlayerDoc): PlayerDoc {
  const currentPlantIds = getGardenPlantIds(player);
  const nextPlantIds = [...currentPlantIds];

  const nextSlots = player.gardenSlots.map((slot, index) => {
    const plantId = currentPlantIds[index];
    const card = plantId ? getPlantCardById(plantId) : null;

    if (slot === "empty" || slot === "withered") {
      nextPlantIds[index] = null;
      return slot;
    }

    if (!card || !card.requiresUpkeep || card.decayPerRound <= 0) {
      return slot;
    }

    if (slot === "grown") {
      if (card.decayPerRound >= 2) {
        nextPlantIds[index] = null;
        return "withered";
      }

      return "seedling";
    }

    if (slot === "seedling" && card.decayPerRound >= 2) {
      nextPlantIds[index] = null;
      return "withered";
    }

    return slot;
  });

  return { ...player, gardenSlots: nextSlots, gardenPlantIds: nextPlantIds };
}

export function applyAdjacentPairBonuses(player: PlayerDoc): PlayerDoc {
  let adjacentGrownPairs = 0;

  for (let i = 0; i < player.gardenSlots.length - 1; i += 1) {
    if (player.gardenSlots[i] === "grown" && player.gardenSlots[i + 1] === "grown") {
      adjacentGrownPairs += 1;
    }
  }

  return {
    ...player,
    resources: {
      ...player.resources,
      flowers: player.resources.flowers + adjacentGrownPairs
    }
  };
}

export function collectFlowerTokens(player: PlayerDoc): PlayerDoc {
  const grownCount = player.gardenSlots.filter((slot) => slot === "grown").length;

  return {
    ...player,
    resources: {
      ...player.resources,
      flowers: player.resources.flowers + grownCount
    }
  };
}

export function computePlayerScore(player: PlayerDoc): number {
  const tableauPlantPoints = computeTableauPlantPoints(player);
  return tableauPlantPoints + player.resources.flowers + player.resources.bugs;
}
