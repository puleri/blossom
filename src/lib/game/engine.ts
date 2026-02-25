import { getPlantCardById } from "@/lib/game/cards/details";
import {
  resolveEventReactionWindow,
  resolveOncePerTurnActivation,
  resolveRoundEndAbilityWindow,
  type AbilityTriggerLog
} from "@/lib/game/abilityResolver";
import type { EventCard, GardenSlot, GardenSlotState, PlayerDoc } from "@/lib/game/types";

function clampResource(value: number) {
  return Math.max(0, value);
}

function normalizeGardenSlots(player: PlayerDoc): GardenSlot[] {
  return player.gardenSlots.map((slot, index) => {
    if (typeof slot === "string") {
      return { state: slot as GardenSlotState, plantId: player.gardenPlantIds?.[index] ?? null };
    }

    return { state: slot.state, plantId: slot.plantId ?? null };
  });
}

function computeTableauPlantPoints(player: PlayerDoc) {
  const slots = normalizeGardenSlots(player);

  return slots.reduce((total, slot) => {
    if (slot.state !== "grown") {
      return total;
    }

    const card = slot.plantId ? getPlantCardById(slot.plantId) : null;
    return total + (card?.points ?? 0);
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

export function resolveRoundEndUpkeepStartAbilities(players: PlayerDoc[]) {
  return players.map((player) => {
    const resolved = resolveRoundEndAbilityWindow(player);
    return {
      player: resolved.player,
      logs: resolved.logs
    };
  });
}

export function applyEventToPlayersWithReactions(players: PlayerDoc[], event: EventCard) {
  const logs: Array<{ playerId: string; trigger: AbilityTriggerLog }> = [];

  const updatedPlayers = players.map((player) => {
    const reaction = resolveEventReactionWindow(player, event);
    reaction.logs.forEach((trigger) => {
      logs.push({ playerId: player.id, trigger });
    });

    if (reaction.eventBlocked && event.id === "infestation") {
      return reaction.player;
    }

    return applyEventToPlayers([reaction.player], event)[0];
  });

  return { players: updatedPlayers, logs };
}

export function activatePlantAbilityForTurn(player: PlayerDoc, slotIndex: number, round: number) {
  return resolveOncePerTurnActivation(player, slotIndex, round);
}

export function applyPlantDecayAndDeaths(player: PlayerDoc): PlayerDoc {
  const nextSlots = normalizeGardenSlots(player).map((slot) => {
    if (slot.state === "empty" || slot.state === "withered") {
      return { state: slot.state, plantId: null };
    }

    const card = slot.plantId ? getPlantCardById(slot.plantId) : null;
    if (!card || !card.requiresUpkeep || card.decayPerRound <= 0) {
      return slot;
    }

    if (slot.state === "grown") {
      if (card.decayPerRound >= 2) {
        return { state: "withered", plantId: null };
      }

      return { ...slot, state: "seedling" };
    }

    if (slot.state === "seedling" && card.decayPerRound >= 2) {
      return { state: "withered", plantId: null };
    }

    return slot;
  });

  return { ...player, gardenSlots: nextSlots };
}

export function applyAdjacentPairBonuses(player: PlayerDoc): PlayerDoc {
  const slots = normalizeGardenSlots(player);
  let adjacentGrownPairs = 0;

  for (let i = 0; i < slots.length - 1; i += 1) {
    if (slots[i].state === "grown" && slots[i + 1].state === "grown") {
      adjacentGrownPairs += 1;
    }
  }

  return {
    ...player,
    resources: {
      ...player.resources,
      buds: player.resources.buds + adjacentGrownPairs
    }
  };
}

export function collectBudTokens(player: PlayerDoc): PlayerDoc {
  const grownCount = normalizeGardenSlots(player).filter((slot) => slot.state === "grown").length;

  return {
    ...player,
    resources: {
      ...player.resources,
      buds: player.resources.buds + grownCount
    }
  };
}

export function applyResourcePressureCaps(player: PlayerDoc): PlayerDoc {
  const waterSoftCap = 6;
  const waterDecay = player.resources.water > waterSoftCap ? 1 : 0;

  return {
    ...player,
    resources: {
      ...player.resources,
      water: clampResource(player.resources.water - waterDecay)
    }
  };
}


export function harvestBudsForPoints(player: PlayerDoc): PlayerDoc {
  const pointsGained = Math.floor(player.resources.buds / 2);

  return {
    ...player,
    score: player.score + pointsGained,
    resources: {
      ...player.resources,
      buds: 0
    }
  };
}

export function forceBloom(player: PlayerDoc): PlayerDoc {
  return {
    ...player,
    resources: {
      ...player.resources,
      flowers: player.resources.flowers + player.resources.buds,
      buds: 0
    }
  };
}

export function computePlayerScore(player: PlayerDoc): number {
  const tableauPlantPoints = computeTableauPlantPoints(player);
  return tableauPlantPoints + player.resources.flowers + player.resources.bugs;
}
