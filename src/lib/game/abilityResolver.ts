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


function getGrownPlantCard(slots: GardenSlot[], slotIndex: number) {
  const slot = slots[slotIndex];
  if (!slot || slot.state !== "grown" || !slot.plantId) {
    return null;
  }

  return getPlantCardById(slot.plantId);
}

function hasBloomkeeperAdjacency(slots: GardenSlot[], slotIndex: number) {
  return [slotIndex - 1, slotIndex + 1].some((adjacentIndex) => {
    const adjacentCard = getGrownPlantCard(slots, adjacentIndex);
    return adjacentCard?.abilities.includes("shared_radiance_passive") ?? false;
  });
}

function getFloweringThreshold(slots: GardenSlot[], slotIndex: number) {
  const card = getGrownPlantCard(slots, slotIndex);
  if (!card) {
    return Number.POSITIVE_INFINITY;
  }

  const thresholdReduction = hasBloomkeeperAdjacency(slots, slotIndex) ? 1 : 0;
  return Math.max(1, card.waterCapacity - thresholdReduction);
}

function isPlantFlowering(slots: GardenSlot[], slotIndex: number) {
  const slot = slots[slotIndex];
  if (!slot || slot.state !== "grown") {
    return false;
  }

  return (slot.water ?? 0) >= getFloweringThreshold(slots, slotIndex);
}

function countFloweringPlants(slots: GardenSlot[]) {
  return slots.reduce((count, _, slotIndex) => count + (isPlantFlowering(slots, slotIndex) ? 1 : 0), 0);
}


const CARNIVOROUS_PLANT_IDS = new Set([
  "venus-flytrap",
  "pitcher-plant",
  "sundew-cluster",
  "cobra-lily",
  "bladderwort",
  "thornmaw-bramble",
  "sporefang-vine",
  "gloomtrap-shrub",
  "mawroot-bulb",
  "carrion-bloom",
  "razorleaf-net",
  "apex-devourer"
]);

function isCarnivorousPlant(slots: GardenSlot[], slotIndex: number) {
  const card = getGrownPlantCard(slots, slotIndex);
  return card ? CARNIVOROUS_PLANT_IDS.has(card.id) : false;
}

function countAdjacentCarnivorousPlants(slots: GardenSlot[], slotIndex: number) {
  return [slotIndex - 1, slotIndex + 1].reduce(
    (count, adjacentIndex) => count + (isCarnivorousPlant(slots, adjacentIndex) ? 1 : 0),
    0
  );
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
    const slots = normalizeGardenSlots(player);
    const adjacentCarnivores = countAdjacentCarnivorousPlants(slots, ability.slotIndex);

    return {
      player: {
        ...player,
        resources: {
          ...player.resources,
          bugs: player.resources.bugs + adjacentCarnivores
        }
      },
      logs: [
        {
          abilityId: ability.abilityId,
          plantId: ability.plantId,
          slotIndex: ability.slotIndex,
          message:
            adjacentCarnivores > 0
              ? `Triggered ${ability.abilityId}: ${adjacentCarnivores} adjacent Carnivorous plant${adjacentCarnivores === 1 ? "" : "s"} hunted and generated ${adjacentCarnivores} bug token${adjacentCarnivores === 1 ? "" : "s"}.`
              : `Triggered ${ability.abilityId}: no adjacent Carnivorous plants, no bug tokens generated.`
        }
      ]
    };
  },
  venomous_bloom_round_end: ({ ability, player }) => {
    const slots = normalizeGardenSlots(player);
    const flowered = isPlantFlowering(slots, ability.slotIndex);

    return {
      player: {
        ...player,
        resources: {
          ...player.resources,
          bugs: player.resources.bugs + (flowered ? 2 : 0)
        }
      },
      logs: [
        {
          abilityId: ability.abilityId,
          plantId: ability.plantId,
          slotIndex: ability.slotIndex,
          message: flowered
            ? `Triggered ${ability.abilityId}: flowered and gained 2 bug tokens.`
            : `Triggered ${ability.abilityId}: did not flower, no bug tokens gained.`
        }
      ]
    };
  },
  water_feast_round_end: ({ ability, player }) => {
    const waterGain = player.resources.bugs >= 1 ? 1 : 0;

    return {
      player: {
        ...player,
        resources: {
          ...player.resources,
          water: player.resources.water + waterGain
        }
      },
      logs: [
        {
          abilityId: ability.abilityId,
          plantId: ability.plantId,
          slotIndex: ability.slotIndex,
          message:
            waterGain > 0
              ? `Triggered ${ability.abilityId}: consumed ambient pests and gained 1 water.`
              : `Triggered ${ability.abilityId}: no bug tokens available, no water gained.`
        }
      ]
    };
  },
  predatory_pressure_round_end: ({ ability, player }) => {
    const activePressure = player.resources.bugs >= 2;

    return {
      player: {
        ...player,
        resources: {
          ...player.resources,
          seeds: player.resources.seeds + (activePressure ? 1 : 0)
        }
      },
      logs: [
        {
          abilityId: ability.abilityId,
          plantId: ability.plantId,
          slotIndex: ability.slotIndex,
          message: activePressure
            ? `Triggered ${ability.abilityId}: predatory pressure online, gained 1 seed.`
            : `Triggered ${ability.abilityId}: fewer than 2 bug tokens, no pressure effect.`
        }
      ]
    };
  },
  dark_canopy_round_end: ({ ability, player }) => {
    const slots = normalizeGardenSlots(player);
    const adjacentCarnivores = countAdjacentCarnivorousPlants(slots, ability.slotIndex);
    const bugsGained = adjacentCarnivores >= 2 ? 2 : 0;

    return {
      player: {
        ...player,
        resources: {
          ...player.resources,
          bugs: player.resources.bugs + bugsGained
        }
      },
      logs: [
        {
          abilityId: ability.abilityId,
          plantId: ability.plantId,
          slotIndex: ability.slotIndex,
          message:
            bugsGained > 0
              ? `Triggered ${ability.abilityId}: surrounded by Carnivorous plants, gained 2 bug tokens.`
              : `Triggered ${ability.abilityId}: not enough Carnivorous adjacency, no bug tokens gained.`
        }
      ]
    };
  },
  feeding_frenzy_round_end: ({ ability, player }) => {
    const frenzyOnline = player.resources.bugs >= 3;

    return {
      player: {
        ...player,
        resources: {
          ...player.resources,
          bugs: player.resources.bugs + (frenzyOnline ? 2 : 0)
        }
      },
      logs: [
        {
          abilityId: ability.abilityId,
          plantId: ability.plantId,
          slotIndex: ability.slotIndex,
          message: frenzyOnline
            ? `Triggered ${ability.abilityId}: feeding frenzy triggered, gained 2 bug tokens.`
            : `Triggered ${ability.abilityId}: no plant deaths tracked, frenzy fallback not met.`
        }
      ]
    };
  },
  web_of_fangs_round_end: ({ ability, player }) => {
    const slots = normalizeGardenSlots(player);
    const adjacentFloweringCarnivores = [ability.slotIndex - 1, ability.slotIndex + 1].reduce((count, adjacentIndex) => {
      if (!isCarnivorousPlant(slots, adjacentIndex)) {
        return count;
      }

      return count + (isPlantFlowering(slots, adjacentIndex) ? 1 : 0);
    }, 0);

    return {
      player: {
        ...player,
        resources: {
          ...player.resources,
          bugs: player.resources.bugs + adjacentFloweringCarnivores
        }
      },
      logs: [
        {
          abilityId: ability.abilityId,
          plantId: ability.plantId,
          slotIndex: ability.slotIndex,
          message:
            adjacentFloweringCarnivores > 0
              ? `Triggered ${ability.abilityId}: ${adjacentFloweringCarnivores} adjacent Carnivorous bloom${adjacentFloweringCarnivores === 1 ? "" : "s"} fed the web, gained ${adjacentFloweringCarnivores} bug token${adjacentFloweringCarnivores === 1 ? "" : "s"}.`
              : `Triggered ${ability.abilityId}: no adjacent flowering Carnivorous plants.`
        }
      ]
    };
  },
  modest_bloom_round_end: ({ ability, player }) => {
    const slots = normalizeGardenSlots(player);
    const flowered = isPlantFlowering(slots, ability.slotIndex);

    return {
      player: {
        ...player,
        resources: {
          ...player.resources,
          flowers: player.resources.flowers + (flowered ? 1 : 0)
        }
      },
      logs: [
        {
          abilityId: ability.abilityId,
          plantId: ability.plantId,
          slotIndex: ability.slotIndex,
          message: flowered
            ? `Triggered ${ability.abilityId}: bloomed at full hydration and gained 1 flower.`
            : `Triggered ${ability.abilityId}: not fully hydrated, no flower gained.`
        }
      ]
    };
  },
  fertile_bloom_round_end: ({ ability, player }) => {
    const slots = normalizeGardenSlots(player);
    const flowered = isPlantFlowering(slots, ability.slotIndex);

    return {
      player: {
        ...player,
        resources: {
          ...player.resources,
          seeds: player.resources.seeds + (flowered ? 1 : 0)
        }
      },
      logs: [
        {
          abilityId: ability.abilityId,
          plantId: ability.plantId,
          slotIndex: ability.slotIndex,
          message: flowered
            ? `Triggered ${ability.abilityId}: flowered and produced 1 seed.`
            : `Triggered ${ability.abilityId}: no flowering, no seed produced.`
        }
      ]
    };
  },
  lunar_hydration_round_end: ({ ability, player }) => {
    const slots = normalizeGardenSlots(player);
    const flowered = isPlantFlowering(slots, ability.slotIndex);

    return {
      player: {
        ...player,
        resources: {
          ...player.resources,
          water: player.resources.water + (flowered ? 1 : 0)
        }
      },
      logs: [
        {
          abilityId: ability.abilityId,
          plantId: ability.plantId,
          slotIndex: ability.slotIndex,
          message: flowered
            ? `Triggered ${ability.abilityId}: flowered and generated 1 water.`
            : `Triggered ${ability.abilityId}: no flowering, no water generated.`
        }
      ]
    };
  },
  royal_bloom_round_end: ({ ability, player }) => {
    const slots = normalizeGardenSlots(player);
    const flowered = isPlantFlowering(slots, ability.slotIndex);

    return {
      player: {
        ...player,
        resources: {
          ...player.resources,
          flowers: player.resources.flowers + (flowered ? 2 : 0)
        }
      },
      logs: [
        {
          abilityId: ability.abilityId,
          plantId: ability.plantId,
          slotIndex: ability.slotIndex,
          message: flowered
            ? `Triggered ${ability.abilityId}: royal bloom gained 2 flowers.`
            : `Triggered ${ability.abilityId}: not flowered, no bonus flowers.`
        }
      ]
    };
  },
  seed_conversion_round_end: ({ ability, player }) => {
    const canConvert = player.resources.flowers >= 2;

    return {
      player: {
        ...player,
        resources: {
          ...player.resources,
          flowers: clampResource(player.resources.flowers - (canConvert ? 2 : 0)),
          seeds: player.resources.seeds + (canConvert ? 1 : 0)
        }
      },
      logs: [
        {
          abilityId: ability.abilityId,
          plantId: ability.plantId,
          slotIndex: ability.slotIndex,
          message: canConvert
            ? `Triggered ${ability.abilityId}: converted 2 flowers into 1 seed.`
            : `Triggered ${ability.abilityId}: not enough flowers to convert.`
        }
      ]
    };
  },
  pollinator_surge_round_end: ({ ability, player }) => {
    const slots = normalizeGardenSlots(player);
    const floweringCount = countFloweringPlants(slots);
    const bonusFlowers = floweringCount >= 2 ? 1 : 0;

    return {
      player: {
        ...player,
        resources: {
          ...player.resources,
          flowers: player.resources.flowers + bonusFlowers
        }
      },
      logs: [
        {
          abilityId: ability.abilityId,
          plantId: ability.plantId,
          slotIndex: ability.slotIndex,
          message:
            bonusFlowers > 0
              ? `Triggered ${ability.abilityId}: ${floweringCount} plants flowered, gained 1 bonus flower.`
              : `Triggered ${ability.abilityId}: fewer than 2 plants flowered, no bonus flower.`
        }
      ]
    };
  },
  chorus_effect_round_end: ({ ability, player }) => {
    const slots = normalizeGardenSlots(player);
    const floweringCount = countFloweringPlants(slots);
    const bonusSeeds = floweringCount >= 3 ? 2 : 0;

    return {
      player: {
        ...player,
        resources: {
          ...player.resources,
          seeds: player.resources.seeds + bonusSeeds
        }
      },
      logs: [
        {
          abilityId: ability.abilityId,
          plantId: ability.plantId,
          slotIndex: ability.slotIndex,
          message:
            bonusSeeds > 0
              ? `Triggered ${ability.abilityId}: ${floweringCount} plants flowered, gained 2 seeds.`
              : `Triggered ${ability.abilityId}: fewer than 3 plants flowered, no seeds gained.`
        }
      ]
    };
  },
  crystal_bloom_round_end: ({ ability, player }) => {
    const slots = normalizeGardenSlots(player);
    const flowered = isPlantFlowering(slots, ability.slotIndex);

    return {
      player: {
        ...player,
        resources: {
          ...player.resources,
          flowers: player.resources.flowers + (flowered ? 1 : 0),
          water: player.resources.water + (flowered ? 1 : 0)
        }
      },
      logs: [
        {
          abilityId: ability.abilityId,
          plantId: ability.plantId,
          slotIndex: ability.slotIndex,
          message: flowered
            ? `Triggered ${ability.abilityId}: crystal bloom gained 1 flower and 1 water.`
            : `Triggered ${ability.abilityId}: did not flower, no resources gained.`
        }
      ]
    };
  },
  unified_bloom_round_end: ({ ability, player }) => {
    const slots = normalizeGardenSlots(player);
    const isFull = isPlantFlowering(slots, ability.slotIndex);
    if (!isFull) {
      return {
        player,
        logs: [
          {
            abilityId: ability.abilityId,
            plantId: ability.plantId,
            slotIndex: ability.slotIndex,
            message: `Triggered ${ability.abilityId}: conductor not full, adjacent plants received no water.`
          }
        ]
      };
    }

    const nextSlots = [...slots];
    const affectedSlots: number[] = [];
    [ability.slotIndex - 1, ability.slotIndex + 1].forEach((adjacentIndex) => {
      const adjacent = nextSlots[adjacentIndex];
      if (!adjacent || adjacent.state !== "grown") {
        return;
      }

      affectedSlots.push(adjacentIndex + 1);
      nextSlots[adjacentIndex] = {
        ...adjacent,
        water: (adjacent.water ?? 0) + 1
      };
    });

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
          message:
            affectedSlots.length > 0
              ? `Triggered ${ability.abilityId}: granted +1 water to adjacent slot${affectedSlots.length > 1 ? "s" : ""} ${affectedSlots.join(", ")}.`
              : `Triggered ${ability.abilityId}: no adjacent grown plants to receive water.`
        }
      ]
    };
  },
  grand_bloom_event_round_end: ({ ability, player }) => {
    const slots = normalizeGardenSlots(player);
    const floweringCount = countFloweringPlants(slots);
    const qualifies = floweringCount >= 4;

    return {
      player: {
        ...player,
        resources: {
          ...player.resources,
          flowers: player.resources.flowers + (qualifies ? 3 : 0),
          seeds: player.resources.seeds + (qualifies ? 2 : 0)
        }
      },
      logs: [
        {
          abilityId: ability.abilityId,
          plantId: ability.plantId,
          slotIndex: ability.slotIndex,
          message: qualifies
            ? `Triggered ${ability.abilityId}: ${floweringCount} plants flowered, gained 3 flowers and 2 seeds.`
            : `Triggered ${ability.abilityId}: fewer than 4 plants flowered, no festival rewards.`
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
          bugs: player.resources.bugs + 1
        }
      },
      eventBlocked: false,
      logs: [
        {
          abilityId: ability.abilityId,
          plantId: ability.plantId,
          slotIndex: ability.slotIndex,
          message: `Triggered ${ability.abilityId}: adapted to infestation and gained +1 bug token.`
        }
      ]
    };
  },
  infestation_catalyst_event: ({ ability, player, event }) => {
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
          bugs: player.resources.bugs + 1
        }
      },
      eventBlocked: false,
      logs: [
        {
          abilityId: ability.abilityId,
          plantId: ability.plantId,
          slotIndex: ability.slotIndex,
          message: `Triggered ${ability.abilityId}: amplified infestation and gained +1 additional bug token.`
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
  },
  bloom_transmutation_action_once_per_round: ({ ability, player, round }) => {
    const usageCount = getUsageCount(player, round, ability.slotIndex, ability.abilityId);
    if (usageCount > 0) {
      throw new Error("This plant ability was already activated this round.");
    }

    if (player.resources.flowers < 1) {
      throw new Error("Not enough flowers to activate this plant ability.");
    }

    const nextPlayer = markAbilityUsed(
      {
        ...player,
        resources: {
          ...player.resources,
          flowers: clampResource(player.resources.flowers - 1),
          water: player.resources.water + 1,
          seeds: player.resources.seeds + 1
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
          message: `Activated ${ability.abilityId}: spent 1 flower to gain 1 water and 1 seed.`
        }
      ]
    };
  },
  sticky_trap_action_once_per_round: ({ ability, player, round }) => {
    const usageCount = getUsageCount(player, round, ability.slotIndex, ability.abilityId);
    if (usageCount > 0) {
      throw new Error("This plant ability was already activated this round.");
    }

    if (player.resources.bugs < 1) {
      throw new Error("Not enough bugs to activate this plant ability.");
    }

    const nextPlayer = markAbilityUsed(
      {
        ...player,
        resources: {
          ...player.resources,
          bugs: clampResource(player.resources.bugs - 1),
          seeds: player.resources.seeds + 1
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
          message: `Activated ${ability.abilityId}: spent 1 bug to gain 1 seed.`
        }
      ]
    };
  },
  digest_action: ({ ability, player, round }) => {
    const usageCount = getUsageCount(player, round, ability.slotIndex, ability.abilityId);
    if (usageCount > 0) {
      throw new Error("This plant ability was already activated this round.");
    }

    if (player.resources.bugs < 2) {
      throw new Error("Not enough bugs to activate this plant ability.");
    }

    const nextPlayer = markAbilityUsed(
      {
        ...player,
        resources: {
          ...player.resources,
          bugs: clampResource(player.resources.bugs - 2),
          flowers: player.resources.flowers + 1
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
          message: `Activated ${ability.abilityId}: digested 2 bugs into 1 flower.`
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
