import type { EventCard, PlayerDoc } from "@/lib/game/types";

function clampResource(value: number) {
  return Math.max(0, value);
}

function computeTableauPlantPoints(gardenSlots: PlayerDoc["gardenSlots"]) {
  return gardenSlots.reduce((total, slot) => {
    if (slot === "grown") return total + 2;
    if (slot === "seedling") return total + 1;
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
  const nextSlots = player.gardenSlots.map((slot) => {
    if (slot === "grown") return "seedling";
    return slot;
  });

  return { ...player, gardenSlots: nextSlots };
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
  const tableauPlantPoints = computeTableauPlantPoints(player.gardenSlots);
  return tableauPlantPoints + player.resources.flowers + player.resources.bugs;
}
