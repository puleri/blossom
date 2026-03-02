import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  type QueryDocumentSnapshot,
  type Transaction
} from "firebase/firestore";
import { firestore } from "@/lib/firestore";
import { ACTIONS_PER_TURN, BIOME_LABELS, BIOME_SLOT_INDICES, GARDEN_SLOT_DEFAULT, ROUNDS_TOTAL, SETUP_HAND_SIZE, SETUP_STARTING_RESOURCES } from "@/lib/game/constants";
import { getPlantCardById, getPlantDisplayName } from "@/lib/game/cards/details";
import { PLANT_CARD_IDS } from "@/lib/game/cards/plants";
import { drawFromDeck, drawSetupHands, shuffleFisherYates } from "@/lib/game/decks";
import {
  applyAdjacentPairBonuses,
  applyPlantDecayAndDeaths,
  applyResourcePressureCaps,
  computePlayerScoreBreakdown,
  resolveRoundEndUpkeepStartAbilities
} from "@/lib/game/engine";
import { CARD_POWERS } from "@/lib/game/powers/cardPowers";
import { executePower } from "@/lib/game/powers/interpreter";
import type { ActivateRow } from "@/lib/game/powers/types";
import { gameDocRef, gameLogColRef, playerDocRef, playersColRef } from "@/lib/game/refs";
import { abilityUsageKey, resolveOnPlayWindow } from "@/lib/game/abilityResolver";
import type {
  BiomeActivationAnnouncement,
  BiomeName,
  GameDoc,
  GameLogEntryDoc,
  GardenSlot,
  GardenSlotState,
  PlayerDoc,
  TurnActionChoice
} from "@/lib/game/types";

const TURN_ACTION_CHOICES: TurnActionChoice[] = ["grow", "root", "toTheSun", "pollinate"];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function appendLog(transaction: Transaction, gameId: string, entry: Omit<GameLogEntryDoc, "createdAt">) {
  const logRef = doc(gameLogColRef(gameId));
  transaction.set(logRef, { ...entry, createdAt: serverTimestamp() });
}

function requireTurnPhase(game: Omit<GameDoc, "id">) {
  assert(game.phase === "turns", "This action is only available during turns phase.");
}

function getPlayerByUid(snapshots: QueryDocumentSnapshot<Omit<PlayerDoc, "id">>[], uid: string) {
  const player = snapshots.find((snapshot) => snapshot.data().uid === uid);
  assert(player, "Authenticated player is not part of this game.");
  return player;
}

async function getOrderedPlayers(gameId: string) {
  const snap = await getDocs(query(playersColRef(gameId), orderBy("joinedAt", "asc")));
  return snap.docs;
}

function normalizeGardenSlots(player: Omit<PlayerDoc, "id">): GardenSlot[] {
  return player.gardenSlots.map((slot, index) => {
    if (typeof slot === "string") {
      return { state: slot as GardenSlotState, plantId: player.gardenPlantIds?.[index] ?? null, sunlight: 0, sunlightCapacity: 0 };
    }

    return { state: slot.state, plantId: slot.plantId ?? null, sunlight: Math.max(0, slot.sunlight ?? 0), sunlightCapacity: Math.max(0, slot.sunlightCapacity ?? 0) };
  });
}

function getBiomeSlots(biome: BiomeName) {
  return BIOME_SLOT_INDICES[biome];
}

function getBiomeLevel(gardenSlots: GardenSlot[], biome: BiomeName) {
  return getBiomeSlots(biome).filter((index) => {
    const slot = gardenSlots[index];
    return slot && slot.state !== "empty" && slot.state !== "withered" && Boolean(slot.plantId);
  }).length;
}

function isPlantableSlotState(state: GardenSlotState) {
  return state === "empty" || state === "withered";
}

function rowKeyForSlot(slotIndex: number): ActivateRow {
  if (BIOME_SLOT_INDICES.oasisEdge.includes(slotIndex)) {
    return "toTheSun";
  }
  if (BIOME_SLOT_INDICES.meadow.includes(slotIndex)) {
    return "pollinate";
  }
  return "root";
}

function activatePlantForRow(player: PlayerDoc, slotIndex: number, round: number) {
  const slots = normalizeGardenSlots(player);
  const slot = slots[slotIndex];
  if (!slot?.plantId || slot.state !== "grown") {
    return { player, logs: [] as Array<{ slotIndex: number; message: string }> };
  }

  const row = rowKeyForSlot(slotIndex);
  const matchingPowers = (CARD_POWERS[slot.plantId] ?? []).filter(
    (power) => power.trigger.kind === "onActivate" && power.trigger.row === row
  );

  if (matchingPowers.length === 0) {
    return { player, logs: [] as Array<{ slotIndex: number; message: string }> };
  }

  const abilityUsage = { ...(player.abilityUsage ?? {}) };
  const activatablePowers = matchingPowers.filter((power) => {
    if (power.oncePer !== "turn") {
      return true;
    }

    return !abilityUsage[abilityUsageKey(round, power.id)];
  });

  if (activatablePowers.length === 0) {
    return { player, logs: [] as Array<{ slotIndex: number; message: string }> };
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
      sunlight: slot.sunlight ?? 0,
      sunlightCapacity: 99,
      tucked: [],
      mature: false
    },
    gameState: { deck: [], tray: [], players: [] }
  };

  activatablePowers.forEach((power) => {
    executed = executePower(power, executed as never) as unknown as typeof executed;
    if (power.oncePer === "turn") {
      const key = abilityUsageKey(round, power.id);
      abilityUsage[key] = (abilityUsage[key] ?? 0) + 1;
    }
  });

  const nextSlots = [...slots];
  nextSlots[slotIndex] = { ...slot, sunlight: executed.selfPlant.sunlight };

  return {
    player: {
      ...player,
      resources: { ...player.resources, ...(executed.player.resources as unknown as PlayerDoc["resources"]) },
      score: executed.player.score,
      hand: executed.player.hand,
      gardenSlots: nextSlots,
      abilityUsage
    },
    logs: activatablePowers.map((power) => ({ slotIndex, message: `triggered ${power.id}` }))
  };
}


function requireActionChoice(game: Omit<GameDoc, "id">, action: TurnActionChoice) {
  const availableActions = game.availableActions ?? TURN_ACTION_CHOICES;
  assert(availableActions.includes(action), `${action} is not currently available.`);
}


function requireActionsRemaining(_game: Omit<GameDoc, "id">) {
  return;
}

function consumeTurnAction(
  transaction: Transaction,
  gameId: string,
  game: Omit<GameDoc, "id">,
  players: QueryDocumentSnapshot<Omit<PlayerDoc, "id">>[],
  playerId: string,
  displayName: string
) {
  const nextTurn = resolveNextTurnState(game, players, playerId);

  if (nextTurn.wrapped) {
    resolveRoundAndStartNextTurn(transaction, gameId, game, players);
    return;
  }

  transaction.update(gameDocRef(gameId), nextTurn.nextState);
  appendLog(transaction, gameId, {
    message: `${displayName} completed an action. Turn advanced.`,
    playerId,
    type: "action"
  });
}

function resolveNextTurnState(game: Omit<GameDoc, "id">, players: QueryDocumentSnapshot<Omit<PlayerDoc, "id">>[], currentPlayerId: string) {
  const order = game.playerOrder.length ? game.playerOrder : players.map((snapshot) => snapshot.id);
  const currentIndex = game.turnIndex;
  assert(order[currentIndex] === currentPlayerId, "Turn order is out of sync.");

  const nextIndex = currentIndex + 1;
  const wrapped = nextIndex >= order.length;

  return {
    wrapped,
    nextState: wrapped
      ? { activePlayerId: order[0] ?? players[0]?.id ?? null, turnIndex: 0, remainingActions: ACTIONS_PER_TURN, availableActions: TURN_ACTION_CHOICES }
      : { activePlayerId: order[nextIndex], turnIndex: nextIndex, remainingActions: ACTIONS_PER_TURN, availableActions: TURN_ACTION_CHOICES }
  };
}

function resolveRoundAndStartNextTurn(transaction: Transaction, gameId: string, gameData: Omit<GameDoc, "id">, players: QueryDocumentSnapshot<Omit<PlayerDoc, "id">>[]) {
  assert(players.length > 0, "No players found.");

  const orderedPlayers = players.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }));
  const roundEndResults = resolveRoundEndUpkeepStartAbilities(orderedPlayers);

  roundEndResults.forEach((result) => {
    result.logs.forEach((trigger) => {
      appendLog(transaction, gameId, {
        message: `${getPlantDisplayName(trigger.plantId)} (slot ${trigger.slotIndex + 1}) ${trigger.message}`,
        playerId: result.player.id,
        type: "system"
      });
    });
  });

  const updatedPlayers = roundEndResults.map((result) => {
    const afterDecay = applyPlantDecayAndDeaths(result.player);
    const afterAdjacentBonuses = applyAdjacentPairBonuses(afterDecay);
    const afterResourcePressure = applyResourcePressureCaps(afterAdjacentBonuses);

    return {
      ...afterResourcePressure,
      resources: {
        ...afterResourcePressure.resources,
        water: afterResourcePressure.resources.water + 1
      }
    };
  });

  const nextRound = gameData.round + 1;
  const isGameOver = nextRound > gameData.roundsTotal;

  updatedPlayers.forEach((player) => {
    const scoreBreakdown = isGameOver ? computePlayerScoreBreakdown(player) : player.scoreBreakdown ?? null;

    transaction.update(playerDocRef(gameId, player.id), {
      gardenSlots: player.gardenSlots,
      resources: player.resources,
      score: isGameOver ? (scoreBreakdown?.total ?? player.score) : player.score,
      scoreBreakdown,
      abilityUsage: player.abilityUsage ?? {}
    });
  });

  transaction.update(gameDocRef(gameId), {
    phase: isGameOver ? "ended" : "turns",
    status: isGameOver ? "ended" : gameData.status,
    activePlayerId: isGameOver ? null : gameData.playerOrder[0] ?? players[0]?.id ?? null,
    turnIndex: 0,
    remainingActions: ACTIONS_PER_TURN,
    availableActions: TURN_ACTION_CHOICES,
    round: isGameOver ? gameData.round : nextRound,
    upkeepEventResponses: {},
    lastPhaseResolvedRound: gameData.round
  });

  appendLog(transaction, gameId, {
    message: isGameOver
      ? `Round ${gameData.round} resolved. Game ended.`
      : `Round ${gameData.round} resolved. Round ${nextRound} turns begin.`,
    type: "system"
  });
}

function getSlotsForAction(action: TurnActionChoice) {
  if (action === "grow") {
    return [3, 2, 1, 0];
  }
  if (action === "root") {
    return [...getBiomeSlots("understory")].sort((a, b) => b - a);
  }
  if (action === "toTheSun") {
    return [...getBiomeSlots("oasisEdge")].sort((a, b) => b - a);
  }
  return [...getBiomeSlots("meadow")].sort((a, b) => b - a);
}

function getActionLevel(gardenSlots: GardenSlot[], action: TurnActionChoice) {
  if (action === "grow") {
    return gardenSlots.filter((slot) => slot.state !== "empty" && slot.state !== "withered" && Boolean(slot.plantId)).length;
  }

  if (action === "root") {
    return getBiomeLevel(gardenSlots, "understory");
  }

  if (action === "toTheSun") {
    return getBiomeLevel(gardenSlots, "oasisEdge");
  }

  return getBiomeLevel(gardenSlots, "meadow");
}

function applyBaseRowReward(resources: PlayerDoc["resources"], action: TurnActionChoice, level: number) {
  if (action === "grow") return { ...resources, seeds: resources.seeds + level };
  if (action === "root") return { ...resources, water: resources.water + level };
  if (action === "toTheSun") return { ...resources, buds: resources.buds + level };
  return { ...resources, flowers: resources.flowers + level };
}

async function takeRowActionTx(gameId: string, uid: string, action: TurnActionChoice) {
  const players = await getOrderedPlayers(gameId);

  return runTransaction(firestore, async (transaction) => {
    const gameSnap = await transaction.get(gameDocRef(gameId));
    assert(gameSnap.exists(), "Game not found.");
    const gameData = gameSnap.data();
    requireTurnPhase(gameData);

    const playerSnap = getPlayerByUid(players, uid);
    assert(gameData.activePlayerId === playerSnap.id, "Only the active player can perform turn actions.");
    requireActionChoice(gameData, action);

    const playerData = playerSnap.data();
    let resolvedPlayer: PlayerDoc = { id: playerSnap.id, ...playerData };
    const initialSlots = normalizeGardenSlots(playerData);
    const level = getActionLevel(initialSlots, action);
    assert(level > 0, `No plants are available to resolve ${action}.`);

    resolvedPlayer.resources = applyBaseRowReward(resolvedPlayer.resources, action, level);
    const activationLogs: string[] = [];
    for (const slotIndex of getSlotsForAction(action)) {
      const slot = normalizeGardenSlots(resolvedPlayer)[slotIndex];
      if (!slot || slot.state === "empty" || slot.state === "withered" || !slot.plantId) continue;
      const resolved = activatePlantForRow(resolvedPlayer, slotIndex, gameData.round);
      resolvedPlayer = resolved.player;
      if (resolved.logs.length === 0) {
        activationLogs.push(`slot ${slotIndex + 1}: no activatable ability.`);
      } else {
        resolved.logs.forEach((entry) => activationLogs.push(`slot ${entry.slotIndex + 1}: ${entry.message}`));
      }
    }

    transaction.update(playerDocRef(gameId, playerSnap.id), {
      resources: resolvedPlayer.resources,
      abilityUsage: resolvedPlayer.abilityUsage ?? {},
      gardenSlots: normalizeGardenSlots(resolvedPlayer)
    });

    const nextTurn = resolveNextTurnState(gameData, players, playerSnap.id);

    appendLog(transaction, gameId, {
      message: `${playerData.displayName} took ${action} at level ${level} and ended their turn.`,
      playerId: playerSnap.id,
      type: "action"
    });
    activationLogs.forEach((message) => {
      appendLog(transaction, gameId, {
        message: `${playerData.displayName} ${action} ${message}`,
        playerId: playerSnap.id,
        type: "action"
      });
    });

    if (nextTurn.wrapped) {
      resolveRoundAndStartNextTurn(transaction, gameId, gameData, players);
      return;
    }

    transaction.update(gameDocRef(gameId), nextTurn.nextState);

    appendLog(transaction, gameId, {
      message: `${playerData.displayName} completed ${action}. Turn advanced.`,
      playerId: playerSnap.id,
      type: "action"
    });
  });
}

export async function takeGrowActionTx(gameId: string, uid: string) {
  return takeRowActionTx(gameId, uid, "grow");
}

export async function takeRootActionTx(gameId: string, uid: string) {
  return takeRowActionTx(gameId, uid, "root");
}

export async function takeToTheSunActionTx(gameId: string, uid: string) {
  return takeRowActionTx(gameId, uid, "toTheSun");
}

export async function takePollinateActionTx(gameId: string, uid: string) {
  return takeRowActionTx(gameId, uid, "pollinate");
}

export async function createGameTx(hostDisplayName: string, uid: string) {
  assert(uid, "Missing authenticated user (uid). Please refresh and try again.");
  const gameRef = doc(collection(firestore, "games"));
  const hostRef = playerDocRef(gameRef.id, uid);

  return runTransaction(firestore, async (transaction) => {
    transaction.set(gameRef, {
      createdAt: serverTimestamp(),
      createdBy: hostRef.id,
      status: "lobby",
      phase: "lobby",
      round: 0,
      roundsTotal: ROUNDS_TOTAL,
      hostPlayerId: hostRef.id,
      activePlayerId: null,
      playerOrder: [],
      turnIndex: 0,
      remainingActions: ACTIONS_PER_TURN,
      availableActions: TURN_ACTION_CHOICES,
      eventDeck: [],
      plantDeck: [],
      currentEventId: null,
      nextEventForecast: null,
      upkeepEventResponses: {},
      lastPhaseResolvedRound: null
    });

    transaction.set(hostRef, {
      displayName: hostDisplayName,
      uid,
      isHost: true,
      joinedAt: serverTimestamp(),
      resources: { ...SETUP_STARTING_RESOURCES },
      score: 0,
      hand: [],
      gardenSlots: Array.from({ length: GARDEN_SLOT_DEFAULT }, () => ({ state: "empty", plantId: null, sunlight: 0, sunlightCapacity: 0 })),
      keptFromMulligan: false,
      abilityUsage: {}
    });

    appendLog(transaction, gameRef.id, { message: `${hostDisplayName} created the game.`, playerId: hostRef.id, type: "system" });
    return { gameId: gameRef.id, playerId: hostRef.id };
  });
}

export async function joinGameTx(gameId: string, displayName: string, uid: string) {
  assert(uid, "Missing authenticated user (uid). Please refresh and try again.");
  const playerRef = playerDocRef(gameId, uid);

  return runTransaction(firestore, async (transaction) => {
    const gameSnap = await transaction.get(gameDocRef(gameId));
    assert(gameSnap.exists(), "Game not found.");
    assert(gameSnap.data().phase === "lobby", "Game already started.");

    const existing = await transaction.get(playerRef);
    assert(!existing.exists(), "Player already joined this game.");

    transaction.set(playerRef, {
      displayName,
      uid,
      isHost: false,
      joinedAt: serverTimestamp(),
      resources: { ...SETUP_STARTING_RESOURCES },
      score: 0,
      hand: [],
      gardenSlots: Array.from({ length: GARDEN_SLOT_DEFAULT }, () => ({ state: "empty", plantId: null, sunlight: 0, sunlightCapacity: 0 })),
      keptFromMulligan: false,
      abilityUsage: {}
    });

    appendLog(transaction, gameId, { message: `${displayName} joined the game.`, playerId: playerRef.id, type: "system" });
    return { gameId, playerId: playerRef.id };
  });
}

export async function startGameSetupTx(gameId: string, uid: string) {
  const players = await getOrderedPlayers(gameId);

  return runTransaction(firestore, async (transaction) => {
    const gameRef = gameDocRef(gameId);
    const gameSnap = await transaction.get(gameRef);
    assert(gameSnap.exists(), "Game not found.");
    const gameData = gameSnap.data();

    assert(gameData.phase === "lobby", "Game has already started.");
    assert(players.length >= 1, "Need at least 1 player to start.");

    const hostSnap = players.find((snapshot) => snapshot.id === gameData.hostPlayerId);
    assert(hostSnap, "Host player not found.");
    assert(hostSnap.data().uid === uid, "Only the host can start the game.");

    const orderedPlayerIds = players.map((player) => player.id);
    const shuffledPlantIds = shuffleFisherYates(PLANT_CARD_IDS);
    const { hands, remainingDeck } = drawSetupHands(orderedPlayerIds, shuffledPlantIds, SETUP_HAND_SIZE);

    players.forEach((player) => {
      transaction.update(playerDocRef(gameId, player.id), {
        hand: hands[player.id] ?? [],
        resources: { ...SETUP_STARTING_RESOURCES },
        keptFromMulligan: false,
        abilityUsage: {}
      });
    });

    transaction.update(gameRef, {
      status: "in_progress",
      phase: "setup",
      round: 1,
      activePlayerId: null,
      playerOrder: orderedPlayerIds,
      turnIndex: 0,
      remainingActions: ACTIONS_PER_TURN,
      availableActions: TURN_ACTION_CHOICES,
      plantDeck: remainingDeck,
      currentEventId: null,
      nextEventForecast: null,
      upkeepEventResponses: {},
      lastPhaseResolvedRound: null
    });

    appendLog(transaction, gameId, { message: "Game started. Setup phase begins.", playerId: hostSnap.id, type: "system" });
  });
}

export async function submitSetupKeepTx(
  gameId: string,
  uid: string,
  keptPlantIds: string[]
) {
  const players = await getOrderedPlayers(gameId);

  return runTransaction(firestore, async (transaction) => {
    const gameRef = gameDocRef(gameId);
    const gameSnap = await transaction.get(gameRef);
    assert(gameSnap.exists(), "Game not found.");
    assert(gameSnap.data().phase === "setup", "Setup keep can only be submitted during setup phase.");

    const playerSnap = getPlayerByUid(players, uid);
    const playerData = playerSnap.data();

    assert(playerData.keptFromMulligan !== true, "Setup choice already submitted.");
    assert(keptPlantIds.length >= 0 && keptPlantIds.length <= SETUP_HAND_SIZE, "Invalid kept plant count.");

    const handSet = new Set(playerData.hand);
    keptPlantIds.forEach((plantId) => {
      assert(handSet.has(plantId), "Kept plants must come from the setup hand.");
    });

    const uniqueKeptIds = [...new Set(keptPlantIds)];
    assert(uniqueKeptIds.length === keptPlantIds.length, "Kept plants must be unique.");

    transaction.update(playerDocRef(gameId, playerSnap.id), {
      hand: uniqueKeptIds,
      keptFromMulligan: true
    });

    appendLog(transaction, gameId, { message: `${playerData.displayName} finalized setup.`, playerId: playerSnap.id, type: "action" });

    const allReady = players.every((snapshot) => {
      if (snapshot.id === playerSnap.id) {
        return true;
      }

      return snapshot.data().keptFromMulligan === true;
    });

    if (allReady) {
      const activePlayerId = gameSnap.data().playerOrder[0] ?? players[0]?.id ?? null;

      transaction.update(gameRef, {
        phase: "turns",
        activePlayerId,
        turnIndex: 0,
        remainingActions: ACTIONS_PER_TURN,
        availableActions: TURN_ACTION_CHOICES,
        eventDeck: [],
        currentEventId: null,
        nextEventForecast: null,
        upkeepEventResponses: {}
      });
    }
  });
}

export async function sowPlantTx(gameId: string, uid: string, plantId: string, biome: BiomeName) {
  console.log("[plant-flow] sowPlantTx start", { gameId, uid, plantId, biome });
  const players = await getOrderedPlayers(gameId);

  return runTransaction(firestore, async (transaction) => {
    const gameSnap = await transaction.get(gameDocRef(gameId));
    assert(gameSnap.exists(), "Game not found.");
    const gameData = gameSnap.data();
    requireTurnPhase(gameData);

    const playerSnap = getPlayerByUid(players, uid);
    assert(gameData.activePlayerId === playerSnap.id, "Only the active player can perform turn actions.");
    requireActionsRemaining(gameData);

    const playerData = playerSnap.data();
    console.log("[plant-flow] sowPlantTx player validated", {
      gameId,
      uid,
      playerId: playerSnap.id,
      activePlayerId: gameData.activePlayerId,
      remainingActions: gameData.remainingActions ?? null,
      handSize: playerData.hand.length
    });
    const gardenSlots = normalizeGardenSlots(playerData);
    const biomeSlots = getBiomeSlots(biome);
    const slotIndex = biomeSlots.find((index) => {
      const slot = gardenSlots[index];
      return slot ? isPlantableSlotState(slot.state) : false;
    });
    console.log("[plant-flow] sowPlantTx slot lookup", {
      gameId,
      playerId: playerSnap.id,
      biome,
      biomeSlots,
      chosenSlotIndex: slotIndex,
      biomeSlotStates: biomeSlots.map((index) => ({ index, state: gardenSlots[index]?.state ?? null, plantId: gardenSlots[index]?.plantId ?? null }))
    });
    assert(slotIndex !== undefined, `${BIOME_LABELS[biome]} has no empty planting slots.`);

    const hasPlantInHand = playerData.hand.includes(plantId);
    console.log("[plant-flow] sowPlantTx hand check", {
      gameId,
      playerId: playerSnap.id,
      plantId,
      hasPlantInHand,
      hand: playerData.hand
    });
    assert(hasPlantInHand, "Plant not found in hand.");

    const plant = getPlantCardById(plantId);
    assert(plant, "Plant card definition not found.");
    const playableBiomes = Array.isArray(plant.biome) ? plant.biome : plant.biome ? [plant.biome] : [];
    if (playableBiomes.length > 0) {
      assert(playableBiomes.includes(biome), `${plant.name} cannot be planted in ${BIOME_LABELS[biome]} Canopy.`);
    }
    const nextSlots = normalizeGardenSlots(playerData);
    nextSlots[slotIndex] = { state: "grown", plantId: plant.id, sunlight: 0, sunlightCapacity: 0 };

    const onPlayResolved = resolveOnPlayWindow(
      {
        id: playerSnap.id,
        ...playerData,
        hand: playerData.hand.filter((cardId) => cardId !== plantId),
        gardenSlots: nextSlots
      },
      slotIndex
    );
    console.log("[plant-flow] sowPlantTx onPlay resolved", {
      gameId,
      playerId: playerSnap.id,
      plantedPlantId: plant.id,
      slotIndex,
      handAfterPlay: onPlayResolved.player.hand,
      resourcesAfterPlay: onPlayResolved.player.resources,
      scoreAfterPlay: onPlayResolved.player.score,
      onPlayLogs: onPlayResolved.logs
    });

    transaction.update(playerDocRef(gameId, playerSnap.id), {
      hand: onPlayResolved.player.hand,
      resources: onPlayResolved.player.resources,
      score: onPlayResolved.player.score,
      gardenSlots: normalizeGardenSlots(onPlayResolved.player)
    });

    consumeTurnAction(transaction, gameId, gameData, players, playerSnap.id, playerData.displayName);

    appendLog(transaction, gameId, {
      message: `${playerData.displayName} planted ${plant.name} in ${BIOME_LABELS[biome]} Canopy (leftmost open slot).`,
      playerId: playerSnap.id,
      type: "action"
    });

    onPlayResolved.logs.forEach((entry) => {
      appendLog(transaction, gameId, {
        message: `${playerData.displayName} ${entry.message}`,
        playerId: playerSnap.id,
        type: "action"
      });
    });

    console.log("[plant-flow] sowPlantTx transaction updates queued", {
      gameId,
      playerId: playerSnap.id,
      plantId: plant.id,
      biome,
      slotIndex
    });
  });
}

export async function activateBiomeTx(gameId: string, uid: string, biome: BiomeName) {
  const players = await getOrderedPlayers(gameId);

  return runTransaction(firestore, async (transaction) => {
    const gameSnap = await transaction.get(gameDocRef(gameId));
    assert(gameSnap.exists(), "Game not found.");
    const gameData = gameSnap.data();
    requireTurnPhase(gameData);

    const playerSnap = getPlayerByUid(players, uid);
    assert(gameData.activePlayerId === playerSnap.id, "Only the active player can perform turn actions.");
    requireActionsRemaining(gameData);

    const playerData = playerSnap.data();
    let resolvedPlayer: PlayerDoc = { id: playerSnap.id, ...playerData };
    const initialLevel = getBiomeLevel(normalizeGardenSlots(resolvedPlayer), biome);
    assert(initialLevel > 0, `${BIOME_LABELS[biome]} has no planted cards to activate.`);

    const biomeSlots = [...getBiomeSlots(biome)].sort((a, b) => b - a);
    const activationLogs: string[] = [];

    for (const slotIndex of biomeSlots) {
      const slot = normalizeGardenSlots(resolvedPlayer)[slotIndex];
      if (!slot || slot.state === "empty" || slot.state === "withered" || !slot.plantId) {
        continue;
      }

      const resolved = activatePlantForRow(resolvedPlayer, slotIndex, gameData.round);
      resolvedPlayer = resolved.player;
      if (resolved.logs.length === 0) {
        activationLogs.push(`slot ${slotIndex + 1}: no activatable ability.`);
      } else {
        resolved.logs.forEach((entry) => activationLogs.push(`slot ${entry.slotIndex + 1}: ${entry.message}`));
      }
    }

    const announcement: BiomeActivationAnnouncement = {
      id: doc(collection(firestore, "games")).id,
      playerId: playerSnap.id,
      biome,
      messages: activationLogs.length > 0 ? activationLogs : ["No activatable abilities were found in this biome."]
    };

    transaction.update(playerDocRef(gameId, playerSnap.id), {
      resources: resolvedPlayer.resources,
      abilityUsage: resolvedPlayer.abilityUsage ?? {},
      gardenSlots: normalizeGardenSlots(resolvedPlayer)
    });

    transaction.update(gameDocRef(gameId), {
      biomeActivationAnnouncement: announcement
    });

    consumeTurnAction(transaction, gameId, gameData, players, playerSnap.id, playerData.displayName);

    appendLog(transaction, gameId, {
      message: `${playerData.displayName} activated ${BIOME_LABELS[biome]} (level ${initialLevel}) from right to left.`,
      playerId: playerSnap.id,
      type: "action"
    });

    activationLogs.forEach((message) => {
      appendLog(transaction, gameId, {
        message: `${playerData.displayName} ${BIOME_LABELS[biome]} ${message}`,
        playerId: playerSnap.id,
        type: "action"
      });
    });
  });
}

export async function activateOasisEdgeBiomeTx(gameId: string, uid: string) {
  return activateBiomeTx(gameId, uid, "oasisEdge");
}

export async function activateMeadowBiomeTx(gameId: string, uid: string) {
  return activateBiomeTx(gameId, uid, "meadow");
}

export async function activateUnderstoryBiomeTx(gameId: string, uid: string) {
  return activateBiomeTx(gameId, uid, "understory");
}

export async function goToWellTx(gameId: string, uid: string, slotIndices: number[] = []) {
  const players = await getOrderedPlayers(gameId);

  return runTransaction(firestore, async (transaction) => {
    const gameSnap = await transaction.get(gameDocRef(gameId));
    assert(gameSnap.exists(), "Game not found.");
    const gameData = gameSnap.data();
    requireTurnPhase(gameData);

    const playerSnap = getPlayerByUid(players, uid);
    assert(gameData.activePlayerId === playerSnap.id, "Only the active player can perform turn actions.");
    requireActionsRemaining(gameData);

    const playerData = playerSnap.data();
    const nextSlots = normalizeGardenSlots(playerData);
    const waterBudget = 3;

    const occupiedSlots = nextSlots
      .map((slot, index) => ({ slot, index }))
      .filter(({ slot }) => slot.state !== "empty" && slot.state !== "withered" && !!slot.plantId);

    assert(occupiedSlots.length > 0, "No living plants available to water.");

    const candidateIndices = (slotIndices.length > 0 ? slotIndices : occupiedSlots.map(({ index }) => index)).filter(
      (index, pos, all) => all.indexOf(index) === pos
    );

    candidateIndices.forEach((index) => {
      assert(index >= 0 && index < nextSlots.length, "Invalid garden slot selection for well action.");
      assert(nextSlots[index].state !== "empty" && nextSlots[index].state !== "withered", "Can only water living plants.");
      assert(Boolean(nextSlots[index].plantId), "Selected slot has no plant.");
    });

    let distributed = 0;
    for (let i = 0; i < candidateIndices.length && distributed < waterBudget; i += 1) {
      const slotIndex = candidateIndices[i];
      const slot = nextSlots[slotIndex];
      const card = slot.plantId ? getPlantCardById(slot.plantId) : null;
      const capacity = card ? 3 : 0;
      const currentWater = slot.sunlight ?? 0;
      if (currentWater >= capacity) {
        continue;
      }

      nextSlots[slotIndex] = { ...slot, sunlight: Math.min(capacity, currentWater + 1), sunlightCapacity: Math.max(slot.sunlightCapacity ?? 0, capacity) };
      distributed += 1;
    }

    transaction.update(playerDocRef(gameId, playerSnap.id), {
      gardenSlots: nextSlots,
      resources: {
        ...playerData.resources,
        water: playerData.resources.water + 1
      }
    });

    consumeTurnAction(transaction, gameId, gameData, players, playerSnap.id, playerData.displayName);

    appendLog(transaction, gameId, {
      message: `${playerData.displayName} drew from the well and distributed ${distributed}/${waterBudget} water to chosen plants (capacity-limited), then banked +1 water.`,
      playerId: playerSnap.id,
      type: "action"
    });
  });
}

export async function riskyOverwaterTx(gameId: string, uid: string, slotIndex: number) {
  const players = await getOrderedPlayers(gameId);

  return runTransaction(firestore, async (transaction) => {
    const gameSnap = await transaction.get(gameDocRef(gameId));
    assert(gameSnap.exists(), "Game not found.");
    const gameData = gameSnap.data();
    requireTurnPhase(gameData);

    const playerSnap = getPlayerByUid(players, uid);
    assert(gameData.activePlayerId === playerSnap.id, "Only the active player can perform turn actions.");
    requireActionsRemaining(gameData);

    const playerData = playerSnap.data();
    const nextSlots = normalizeGardenSlots(playerData);
    assert(slotIndex >= 0 && slotIndex < nextSlots.length, "Invalid garden slot.");

    const slot = nextSlots[slotIndex];
    assert(slot.state !== "empty" && slot.state !== "withered", "Can only overwater living plants.");
    assert(Boolean(slot.plantId), "Selected slot has no plant.");

    nextSlots[slotIndex] = { ...slot, sunlight: (slot.sunlight ?? 0) + 3 };

    transaction.update(playerDocRef(gameId, playerSnap.id), {
      gardenSlots: nextSlots,
      resources: {
        ...playerData.resources,
        flowers: playerData.resources.flowers + 2
      }
    });

    consumeTurnAction(transaction, gameId, gameData, players, playerSnap.id, playerData.displayName);

    appendLog(transaction, gameId, {
      message: `${playerData.displayName} overwatered slot ${slotIndex + 1} for an immediate +2 flowers. Excess hydration may cause root rot during upkeep.`,
      playerId: playerSnap.id,
      type: "action"
    });
  });
}

export async function drawPlantCardTx(gameId: string, uid: string) {
  const players = await getOrderedPlayers(gameId);

  return runTransaction(firestore, async (transaction) => {
    const gameRef = gameDocRef(gameId);
    const gameSnap = await transaction.get(gameRef);
    assert(gameSnap.exists(), "Game not found.");
    const gameData = gameSnap.data();
    requireTurnPhase(gameData);

    const playerSnap = getPlayerByUid(players, uid);
    assert(gameData.activePlayerId === playerSnap.id, "Only the active player can perform turn actions.");
    requireActionsRemaining(gameData);

    const draw = drawFromDeck(gameData.plantDeck ?? [], 1);
    assert(draw.drawn.length === 1, "Plant deck is empty.");

    const playerData = playerSnap.data();
    const drawnCardId = draw.drawn[0];

    transaction.update(playerDocRef(gameId, playerSnap.id), {
      hand: [...playerData.hand, drawnCardId]
    });

    transaction.update(gameRef, { plantDeck: draw.remainingDeck });
    consumeTurnAction(transaction, gameId, gameData, players, playerSnap.id, playerData.displayName);

    appendLog(transaction, gameId, {
      message: `${playerData.displayName} drew a plant card (${getPlantDisplayName(drawnCardId)}).`,
      playerId: playerSnap.id,
      type: "action"
    });
  });
}

export async function tradeWaterForSeedsTx(gameId: string, uid: string) {
  const players = await getOrderedPlayers(gameId);

  return runTransaction(firestore, async (transaction) => {
    const gameSnap = await transaction.get(gameDocRef(gameId));
    assert(gameSnap.exists(), "Game not found.");
    const gameData = gameSnap.data();
    requireTurnPhase(gameData);

    const playerSnap = getPlayerByUid(players, uid);
    assert(gameData.activePlayerId === playerSnap.id, "Only the active player can perform turn actions.");
    requireActionsRemaining(gameData);

    const playerData = playerSnap.data();
    const waterCost = 2;
    assert(playerData.resources.water >= waterCost, "Not enough water to trade.");

    const seedsGained = 1;

    transaction.update(playerDocRef(gameId, playerSnap.id), {
      resources: {
        ...playerData.resources,
        water: playerData.resources.water - waterCost,
        seeds: playerData.resources.seeds + seedsGained
      }
    });

    consumeTurnAction(transaction, gameId, gameData, players, playerSnap.id, playerData.displayName);

    appendLog(transaction, gameId, {
      message: `${playerData.displayName} risked ${waterCost} water for seed stock and got ${seedsGained} seed${seedsGained === 1 ? "" : "s"}.`,
      playerId: playerSnap.id,
      type: "action"
    });
  });
}

export async function passTurnTx(gameId: string, uid: string) {
  return advanceTurnOrRoundTx(gameId, uid);
}

export async function activatePlantAbilityTx(gameId: string, uid: string, slotIndex: number) {
  const players = await getOrderedPlayers(gameId);

  return runTransaction(firestore, async (transaction) => {
    const gameSnap = await transaction.get(gameDocRef(gameId));
    assert(gameSnap.exists(), "Game not found.");
    const gameData = gameSnap.data();
    requireTurnPhase(gameData);

    const playerSnap = getPlayerByUid(players, uid);
    assert(gameData.activePlayerId === playerSnap.id, "Only the active player can perform turn actions.");
    requireActionsRemaining(gameData);

    const playerData = playerSnap.data();
    assert(slotIndex >= 0 && slotIndex < playerData.gardenSlots.length, "Invalid garden slot.");

    const resolved = activatePlantForRow({ id: playerSnap.id, ...playerData }, slotIndex, gameData.round);

    transaction.update(playerDocRef(gameId, playerSnap.id), {
      resources: resolved.player.resources,
      abilityUsage: resolved.player.abilityUsage ?? {},
      gardenSlots: resolved.player.gardenSlots
    });

    consumeTurnAction(transaction, gameId, gameData, players, playerSnap.id, playerData.displayName);

    resolved.logs.forEach((triggerLog) => {
      appendLog(transaction, gameId, {
        message: `${playerData.displayName} slot ${triggerLog.slotIndex + 1}: ${triggerLog.message}`,
        playerId: playerSnap.id,
        type: "action"
      });
    });
  });
}

export async function advanceTurnOrRoundTx(gameId: string, uid: string) {
  const players = await getOrderedPlayers(gameId);

  return runTransaction(firestore, async (transaction) => {
    const gameRef = gameDocRef(gameId);
    const gameSnap = await transaction.get(gameRef);
    assert(gameSnap.exists(), "Game not found.");
    const gameData = gameSnap.data();
    requireTurnPhase(gameData);

    const currentPlayerSnap = getPlayerByUid(players, uid);
    assert(gameData.activePlayerId === currentPlayerSnap.id, "Only the active player can end their turn.");

    const nextTurn = resolveNextTurnState(gameData, players, currentPlayerSnap.id);

    if (nextTurn.wrapped) {
      resolveRoundAndStartNextTurn(transaction, gameId, gameData, players);
      return;
    }

    transaction.update(gameRef, nextTurn.nextState);

    appendLog(transaction, gameId, {
      message: `${currentPlayerSnap.data().displayName} ended their turn.`,
      playerId: currentPlayerSnap.id,
      type: "action"
    });
  });
}
