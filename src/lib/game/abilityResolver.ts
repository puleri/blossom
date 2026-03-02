// @ts-nocheck
import { BIOME_SLOT_INDICES } from "./constants";
import { CARD_POWERS } from "./powers/cardPowers";
import { executePower } from "./powers/interpreter";
import type { ActivateRow, TriggerKind } from "./powers/types";
import type { EventCard, GardenSlot, PlayerDoc } from "./types";

export interface AbilityTriggerLog {
  abilityId: string;
  message: string;
  plantId: string;
  slotIndex: number;
}

interface AbilityResolutionResult {
  logs: AbilityTriggerLog[];
  player: PlayerDoc;
}

interface EventReactionResult extends AbilityResolutionResult {
  eventBlocked: boolean;
}

interface ActivationResult extends AbilityResolutionResult {
  consumedAbilityId: string;
}

function normalizeGardenSlots(player: PlayerDoc): GardenSlot[] {
  return player.gardenSlots.map((slot, index) => {
    if (typeof slot === "string") {
      return { state: slot, plantId: player.gardenPlantIds?.[index] ?? null, water: 0 };
    }

    return { ...slot, plantId: slot.plantId ?? null, water: slot.water ?? 0 };
  });
}

function rowForSlot(slotIndex: number): ActivateRow {
  if (BIOME_SLOT_INDICES.desert.includes(slotIndex)) {
    return "root";
  }
  if (BIOME_SLOT_INDICES.plains.includes(slotIndex)) {
    return "pollinate";
  }
  return "toTheSun";
}

export function abilityUsageKey(round: number, abilityId: string) {
  return `${round}:${abilityId}`;
}

function runDslTrigger(player: PlayerDoc, slotIndex: number, kind: TriggerKind, row?: ActivateRow, round = 0): AbilityResolutionResult {
  const slots = normalizeGardenSlots(player);
  const slot = slots[slotIndex];
  if (!slot?.plantId || slot.state !== "grown") {
    return { player, logs: [] };
  }

  const powers = (CARD_POWERS[slot.plantId] ?? []).filter(
    (power) => power.trigger.kind === kind && (kind !== "onActivate" || power.trigger.row === row)
  );
  if (powers.length === 0) {
    return { player, logs: [] };
  }

  const abilityUsage = { ...(player.abilityUsage ?? {}) };
  const activatablePowers = powers.filter((power) => {
    if (power.oncePer !== "turn") {
      return true;
    }

    return !abilityUsage[abilityUsageKey(round, power.id)];
  });

  if (activatablePowers.length === 0) {
    return { player, logs: [] };
  }

  let executed = {
    player: {
      id: player.id,
      resources: { ...(player.resources as unknown as Record<string, number>) },
      score: player.score,
      hand: [...player.hand]
    },
    selfPlant: {
      id: slot.plantId,
      biome: row,
      sunlight: slot.water ?? 0,
      sunlightCapacity: 99,
      tucked: [],
      mature: false
    },
    gameState: { deck: [], tray: [], players: [] }
  };

  activatablePowers.forEach((power) => {
    executed = executePower(power, executed);
  });

  activatablePowers.forEach((power) => {
    if (power.oncePer === "turn") {
      const key = abilityUsageKey(round, power.id);
      abilityUsage[key] = (abilityUsage[key] ?? 0) + 1;
    }
  });

  const updatedSlots = [...slots];
  updatedSlots[slotIndex] = { ...slot, water: executed.selfPlant.sunlight };

  return {
    player: {
      ...player,
      resources: { ...player.resources, ...(executed.player.resources as unknown as PlayerDoc["resources"]) },
      score: executed.player.score,
      hand: executed.player.hand,
      gardenSlots: updatedSlots,
      abilityUsage
    },
    logs: activatablePowers.map((power) => ({ abilityId: power.id, message: `triggered ${power.id}`, plantId: slot.plantId as string, slotIndex }))
  };
}

export function resolveRoundEndAbilityWindow(player: PlayerDoc): AbilityResolutionResult {
  return { player, logs: [] };
}

export function resolveEventReactionWindow(player: PlayerDoc, _event: EventCard): EventReactionResult {
  return { player, eventBlocked: false, logs: [] };
}

export function resolveOnPlayWindow(player: PlayerDoc, slotIndex: number): AbilityResolutionResult {
  return runDslTrigger(player, slotIndex, "onPlay");
}

export function resolveOnMatureWindow(player: PlayerDoc, slotIndex: number): AbilityResolutionResult {
  return runDslTrigger(player, slotIndex, "onMature");
}

// Row activations now execute directly from action resolution through executeTriggerForPlant.
export function resolveOncePerTurnActivation(player: PlayerDoc, slotIndex: number, _round: number): ActivationResult {
  const row = rowForSlot(slotIndex);
  const resolved = runDslTrigger(player, slotIndex, "onActivate", row, _round);

  return {
    ...resolved,
    consumedAbilityId: resolved.logs[0]?.abilityId ?? "none"
  };
}
