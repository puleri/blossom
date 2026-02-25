import { getPlantCardById } from "@/lib/game/cards/details";
import type { EventCard, GardenSlot, GardenSlotState, PlayerDoc } from "@/lib/game/types";

export interface AbilityTriggerLog {
  abilityId: string;
  message: string;
  plantId: string;
  slotIndex: number;
}

interface ResolvedPlantAbility {
  abilityId: string;
  plantId: string;
  slotIndex: number;
}

interface RoundEndAbilityResolverContext {
  ability: ResolvedPlantAbility;
  player: PlayerDoc;
}

interface EventReactionResolverContext extends RoundEndAbilityResolverContext {
  event: EventCard;
}

interface ActivationResolverContext extends RoundEndAbilityResolverContext {
  round: number;
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

const EMPTY_USAGE: Record<string, number> = {};

function normalizeGardenSlots(player: PlayerDoc): GardenSlot[] {
  return player.gardenSlots.map((slot, index) => {
    if (typeof slot === "string") {
      return { state: slot as GardenSlotState, plantId: player.gardenPlantIds?.[index] ?? null };
    }

    return { state: slot.state, plantId: slot.plantId ?? null };
  });
}

function listResolvedPlantAbilities(player: PlayerDoc): ResolvedPlantAbility[] {
  const slots = normalizeGardenSlots(player);

  return slots
    .map((slot, slotIndex) => {
      if (slot.state !== "grown" || !slot.plantId) {
        return [] as ResolvedPlantAbility[];
      }

      const plant = getPlantCardById(slot.plantId);
      if (!plant) {
        return [] as ResolvedPlantAbility[];
      }

      return plant.abilities.map((abilityId) => ({ abilityId, plantId: plant.id, slotIndex }));
    })
    .flat()
    .sort((left, right) => {
      if (left.slotIndex !== right.slotIndex) {
        return left.slotIndex - right.slotIndex;
      }

      return left.abilityId.localeCompare(right.abilityId);
    });
}

function clampResource(value: number) {
  return Math.max(0, value);
}

function buildUsageKey(round: number, slotIndex: number, abilityId: string) {
  return `${round}:${slotIndex}:${abilityId}`;
}

function getUsageCount(player: PlayerDoc, round: number, slotIndex: number, abilityId: string) {
  const usage = player.abilityUsage ?? EMPTY_USAGE;
  return usage[buildUsageKey(round, slotIndex, abilityId)] ?? 0;
}

function markAbilityUsed(player: PlayerDoc, round: number, slotIndex: number, abilityId: string) {
  const usage = player.abilityUsage ?? EMPTY_USAGE;
  const key = buildUsageKey(round, slotIndex, abilityId);

  return {
    ...player,
    abilityUsage: {
      ...usage,
      [key]: (usage[key] ?? 0) + 1
    }
  };
}

const ROUND_END_RESOLVERS: Record<string, (context: RoundEndAbilityResolverContext) => AbilityResolutionResult> = {
  trellis_chain_round_end: ({ ability, player }) => {
    const slots = normalizeGardenSlots(player);
    const leftSlot = slots[ability.slotIndex - 1];
    const rightSlot = slots[ability.slotIndex + 1];
    const supportCount = [leftSlot, rightSlot].filter((slot) => slot?.state === "grown").length;

    const nextFlowers = player.resources.flowers + supportCount;

    return {
      player: {
        ...player,
        resources: {
          ...player.resources,
          flowers: nextFlowers
        }
      },
      logs: [
        {
          abilityId: ability.abilityId,
          plantId: ability.plantId,
          slotIndex: ability.slotIndex,
          message:
            supportCount > 0
              ? `Triggered ${ability.abilityId}: +${supportCount} flowers from adjacent support.`
              : `Triggered ${ability.abilityId}: no adjacent support, no flowers gained.`
        }
      ]
    };
  },
  spreading_runner_round_end: ({ ability, player }) => {
    const slots = normalizeGardenSlots(player);
    const expansionIndex = slots.findIndex((slot) => slot.state === "empty");

    if (expansionIndex < 0) {
      return {
        player,
        logs: [
          {
            abilityId: ability.abilityId,
            plantId: ability.plantId,
            slotIndex: ability.slotIndex,
            message: `Triggered ${ability.abilityId}: no empty garden slot available for spread.`
          }
        ]
      };
    }

    const nextSlots = [...slots];
    nextSlots[expansionIndex] = { state: "seedling", plantId: ability.plantId };

    return {
      player: {
        ...player,
        gardenSlots: nextSlots
      },
      logs: [
        {
          abilityId: ability.abilityId,
          plantId: ability.plantId,
          slotIndex: ability.slotIndex,
          message: `Triggered ${ability.abilityId}: spread to slot ${expansionIndex + 1} as a seedling.`
        }
      ]
    };
  },
  shared_hunt_round_end: ({ ability, player }) => {
    const capturedPests = Math.min(player.resources.bugs, 2);
    const seedGain = capturedPests > 0 ? 1 : 0;

    return {
      player: {
        ...player,
        resources: {
          ...player.resources,
          bugs: clampResource(player.resources.bugs - capturedPests),
          flowers: player.resources.flowers + capturedPests,
          seeds: player.resources.seeds + seedGain
        }
      },
      logs: [
        {
          abilityId: ability.abilityId,
          plantId: ability.plantId,
          slotIndex: ability.slotIndex,
          message:
            capturedPests > 0
              ? `Triggered ${ability.abilityId}: converted ${capturedPests} bug${capturedPests === 1 ? "" : "s"} into flowers and gained ${seedGain} seed.`
              : `Triggered ${ability.abilityId}: no bugs to convert this round.`
        }
      ]
    };
  }
};

const EVENT_REACTION_RESOLVERS: Record<string, (context: EventReactionResolverContext) => EventReactionResult> = {
  infestation_proof_event: ({ ability, player, event }) => {
    if (!event.tags.includes("pest")) {
      return {
        player,
        eventBlocked: false,
        logs: [
          {
            abilityId: ability.abilityId,
            plantId: ability.plantId,
            slotIndex: ability.slotIndex,
            message: `Triggered ${ability.abilityId}: no effect because event tags are ${event.tags.join(",")}.`
          }
        ]
      };
    }

    return {
      player: {
        ...player,
        resources: {
          ...player.resources,
          seeds: player.resources.seeds + 1
        }
      },
      eventBlocked: true,
      logs: [
        {
          abilityId: ability.abilityId,
          plantId: ability.plantId,
          slotIndex: ability.slotIndex,
          message: `Triggered ${ability.abilityId}: blocked pest-tag event pressure and gained 1 seed.`
        }
      ]
    };
  }
};

const ACTIVATION_RESOLVERS: Record<string, (context: ActivationResolverContext) => ActivationResult> = {
  reservoir_action_once_per_round: ({ ability, player, round }) => {
    const usageCount = getUsageCount(player, round, ability.slotIndex, ability.abilityId);
    if (usageCount > 0) {
      throw new Error("This plant ability was already activated this round.");
    }

    if (player.resources.seeds < 1) {
      throw new Error("Not enough seeds to activate this plant ability.");
    }

    const nextPlayer = markAbilityUsed(
      {
        ...player,
        resources: {
          ...player.resources,
          seeds: clampResource(player.resources.seeds - 1),
          water: player.resources.water + 2
        }
      },
      round,
      ability.slotIndex,
      ability.abilityId
    );

    return {
      player: nextPlayer,
      consumedAbilityId: ability.abilityId,
      logs: [
        {
          abilityId: ability.abilityId,
          plantId: ability.plantId,
          slotIndex: ability.slotIndex,
          message: `Activated ${ability.abilityId}: paid 1 seed, gained 2 water.`
        }
      ]
    };
  }
};

export function resolveRoundEndAbilityWindow(player: PlayerDoc): AbilityResolutionResult {
  const abilities = listResolvedPlantAbilities(player).filter((ability) => ability.abilityId in ROUND_END_RESOLVERS);

  return abilities.reduce<AbilityResolutionResult>(
    (result, ability) => {
      const next = ROUND_END_RESOLVERS[ability.abilityId]({ ability, player: result.player });
      return { player: next.player, logs: [...result.logs, ...next.logs] };
    },
    { player, logs: [] }
  );
}

export function resolveEventReactionWindow(player: PlayerDoc, event: EventCard): EventReactionResult {
  const abilities = listResolvedPlantAbilities(player).filter((ability) => ability.abilityId in EVENT_REACTION_RESOLVERS);

  return abilities.reduce<EventReactionResult>(
    (result, ability) => {
      const next = EVENT_REACTION_RESOLVERS[ability.abilityId]({ ability, event, player: result.player });
      return {
        player: next.player,
        eventBlocked: result.eventBlocked || next.eventBlocked,
        logs: [...result.logs, ...next.logs]
      };
    },
    { player, eventBlocked: false, logs: [] }
  );
}

export function resolveOncePerTurnActivation(player: PlayerDoc, slotIndex: number, round: number): ActivationResult {
  const slots = normalizeGardenSlots(player);
  const slot = slots[slotIndex];

  if (!slot || slot.state !== "grown" || !slot.plantId) {
    throw new Error("Only grown plants can activate abilities.");
  }

  const plant = getPlantCardById(slot.plantId);
  if (!plant) {
    throw new Error("Plant card definition not found.");
  }

  const resolved = plant.abilities
    .map((abilityId) => ({ abilityId, plantId: plant.id, slotIndex }))
    .find((ability) => ability.abilityId in ACTIVATION_RESOLVERS);

  if (!resolved) {
    throw new Error("This plant has no activatable once-per-turn ability.");
  }

  return ACTIVATION_RESOLVERS[resolved.abilityId]({ ability: resolved, player, round });
}
