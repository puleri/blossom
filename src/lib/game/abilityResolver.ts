import type { EventCard, PlayerDoc } from "@/lib/game/types";

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

export function resolveRoundEndAbilityWindow(player: PlayerDoc): AbilityResolutionResult {
  return { player, logs: [] };
}

export function resolveEventReactionWindow(player: PlayerDoc, _event: EventCard): EventReactionResult {
  return { player, eventBlocked: false, logs: [] };
}

export function resolveOncePerTurnActivation(_player: PlayerDoc, _slotIndex: number, _round: number): ActivationResult {
  throw new Error("Plant abilities have been removed.");
}
