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
      return {
        state: slot as GardenSlotState,
        plantId: player.gardenPlantIds?.[index] ?? null,
        sunlight: 0,
        sunlightCapacity: 0
      };
    }

    return {
      state: slot.state,
      plantId: slot.plantId ?? null,
      sunlight: slot.sunlight ?? 0,
      sunlightCapacity: slot.sunlightCapacity ?? 0
    };
  });
}

function computeTableauPlantPoints(player: PlayerDoc) {
  const slots = normalizeGardenSlots(player);

  return slots.reduce((total, slot) => {
    if (slot.state !== "grown") return total;
    const card = slot.plantId ? getPlantCardById(slot.plantId) : null;
    return total + (card?.points ?? 0);
  }, 0);
}

export function applyEventToPlayers(players: PlayerDoc[], event: EventCard): PlayerDoc[] {
  return players.map((player) => {
    if (event.effectType === "points") {
      return { ...player, score: clampResource(player.score + event.value) };
    }

    // Root resources are player-level. Sunlight is per-plant and ignored at this layer.
    if (event.effectType === "sunlight") {
      return player;
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
    return { player: resolved.player, logs: resolved.logs };
  });
}

export function applyEventToPlayersWithReactions(players: PlayerDoc[], event: EventCard) {
  const logs: Array<{ playerId: string; trigger: AbilityTriggerLog }> = [];

  const updatedPlayers = players.map((player) => {
    const reaction = resolveEventReactionWindow(player, event);
    reaction.logs.forEach((trigger) => logs.push({ playerId: player.id, trigger }));

    if (reaction.eventBlocked && event.tags.includes("pest")) return reaction.player;

    return applyEventToPlayers([reaction.player], event)[0];
  });

  return { players: updatedPlayers, logs };
}

export function activatePlantAbilityForTurn(player: PlayerDoc, slotIndex: number, round: number) {
  return resolveOncePerTurnActivation(player, slotIndex, round);
}

export function applyPlantDecayAndDeaths(player: PlayerDoc): PlayerDoc {
  const nextSlots = normalizeGardenSlots(player).map<GardenSlot>((slot) => {
    if (slot.state === "empty" || slot.state === "withered") {
      return { state: slot.state, plantId: null, sunlight: 0, sunlightCapacity: 0 };
    }

    const card = slot.plantId ? getPlantCardById(slot.plantId) : null;
    if (!card) {
      return { state: "withered", plantId: null, sunlight: 0, sunlightCapacity: 0 };
    }

    return { ...slot, sunlight: 0 };
  });

  return { ...player, gardenSlots: nextSlots };
}

// Legacy upkeep hook retained for call sites; no longer grants bud/flower/bug-related bonuses.
export function applyAdjacentPairBonuses(player: PlayerDoc): PlayerDoc {
  return player;
}

// Legacy upkeep hook retained for call sites; pressure caps are not part of the current plan.
export function applyResourcePressureCaps(player: PlayerDoc): PlayerDoc {
  return player;
}

// Scoring is now strictly tableau-based (plus tracked score adjustments from events/actions).
export function computePlayerScore(player: PlayerDoc): number {
  return player.score + computeTableauPlantPoints(player);
}
