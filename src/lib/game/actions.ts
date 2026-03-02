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
  activatePlantAbilityForTurn,
  applyAdjacentPairBonuses,
  applyPlantDecayAndDeaths,
  applyResourcePressureCaps,
  computePlayerScore,
  resolveRoundEndUpkeepStartAbilities
} from "@/lib/game/engine";
import { gameDocRef, gameLogColRef, playerDocRef, playersColRef } from "@/lib/game/refs";
import { resolveOnPlayWindow } from "@/lib/game/abilityResolver";
import type {
  BiomeActivationAnnouncement,
  BiomeName,
  GameDoc,
  GameLogEntryDoc,
  GardenSlot,
  GardenSlotState,
  PlayerDoc
} from "@/lib/game/types";

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
      return { state: slot as GardenSlotState, plantId: player.gardenPlantIds?.[index] ?? null, water: 0 };
    }

    return { state: slot.state, plantId: slot.plantId ?? null, water: Math.max(0, slot.water ?? 0) };
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


function getRemainingActions(game: Omit<GameDoc, "id">) {
  return game.remainingActions ?? ACTIONS_PER_TURN;
}

function requireActionsRemaining(game: Omit<GameDoc, "id">) {
  assert(getRemainingActions(game) > 0, "No actions remaining. End your turn.");
}

function consumeTurnAction(
  transaction: Transaction,
  gameId: string,
  game: Omit<GameDoc, "id">,
  players: QueryDocumentSnapshot<Omit<PlayerDoc, "id">>[],
  playerId: string,
  displayName: string
) {
  const remainingActions = getRemainingActions(game) - 1;
  if (remainingActions <= 0) {
    const nextTurn = resolveNextTurnState(game, players, playerId);
    transaction.update(gameDocRef(gameId), nextTurn.nextState);
    appendLog(transaction, gameId, {
      message: nextTurn.wrapped
        ? `Round ${game.round} turns complete. Entering upkeep.`
        : `${displayName} exhausted their actions. Turn auto-ended.`,
      playerId,
      type: "action"
    });
    return;
  }

  transaction.update(gameDocRef(gameId), { remainingActions });
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
      ? { phase: "upkeep" as const, activePlayerId: null, turnIndex: 0, remainingActions: ACTIONS_PER_TURN, upkeepEventResponses: {} }
      : { activePlayerId: order[nextIndex], turnIndex: nextIndex, remainingActions: ACTIONS_PER_TURN }
  };
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
      gardenSlots: Array.from({ length: GARDEN_SLOT_DEFAULT }, () => ({ state: "empty", plantId: null, water: 0 })),
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
      gardenSlots: Array.from({ length: GARDEN_SLOT_DEFAULT }, () => ({ state: "empty", plantId: null, water: 0 })),
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
        eventDeck: [],
        currentEventId: null,
        nextEventForecast: null,
        upkeepEventResponses: {}
      });
    }
  });
}

export async function sowPlantTx(gameId: string, uid: string, plantId: string, biome: BiomeName) {
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
    const gardenSlots = normalizeGardenSlots(playerData);
    const biomeSlots = getBiomeSlots(biome);
    const slotIndex = biomeSlots.find((index) => gardenSlots[index]?.state === "empty");
    assert(slotIndex !== undefined, `${BIOME_LABELS[biome]} has no empty planting slots.`);

    assert(playerData.hand.includes(plantId), "Plant not found in hand.");

    const plant = getPlantCardById(plantId);
    assert(plant, "Plant card definition not found.");
    const nextSlots = normalizeGardenSlots(playerData);
    nextSlots[slotIndex] = { state: "grown", plantId: plant.id, water: 0 };

    const onPlayResolved = resolveOnPlayWindow(
      {
        id: playerSnap.id,
        ...playerData,
        hand: playerData.hand.filter((cardId) => cardId !== plantId),
        gardenSlots: nextSlots
      },
      slotIndex
    );

    transaction.update(playerDocRef(gameId, playerSnap.id), {
      hand: onPlayResolved.player.hand,
      resources: onPlayResolved.player.resources,
      score: onPlayResolved.player.score,
      gardenSlots: normalizeGardenSlots(onPlayResolved.player)
    });

    consumeTurnAction(transaction, gameId, gameData, players, playerSnap.id, playerData.displayName);

    appendLog(transaction, gameId, {
      message: `${playerData.displayName} planted ${plant.name} in ${BIOME_LABELS[biome]} (leftmost open slot).`,
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

      const resolved = activatePlantAbilityForTurn(resolvedPlayer, slotIndex, gameData.round);
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

export async function activateDesertBiomeTx(gameId: string, uid: string) {
  return activateBiomeTx(gameId, uid, "desert");
}

export async function activatePlainsBiomeTx(gameId: string, uid: string) {
  return activateBiomeTx(gameId, uid, "plains");
}

export async function activateRainforestBiomeTx(gameId: string, uid: string) {
  return activateBiomeTx(gameId, uid, "rainforest");
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
      const currentWater = slot.water ?? 0;
      if (currentWater >= capacity) {
        continue;
      }

      nextSlots[slotIndex] = { ...slot, water: Math.min(capacity, currentWater + 1) };
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

    nextSlots[slotIndex] = { ...slot, water: (slot.water ?? 0) + 3 };

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

    const remainingActions = getRemainingActions(gameData) - 1;
    if (remainingActions <= 0) {
      const nextTurn = resolveNextTurnState(gameData, players, playerSnap.id);
      transaction.update(gameRef, { ...nextTurn.nextState, plantDeck: draw.remainingDeck });
      appendLog(transaction, gameId, {
        message: nextTurn.wrapped
          ? `Round ${gameData.round} turns complete. Entering upkeep.`
          : `${playerData.displayName} exhausted their actions. Turn auto-ended.`,
        playerId: playerSnap.id,
        type: "action"
      });
    } else {
      transaction.update(gameRef, {
        plantDeck: draw.remainingDeck,
        remainingActions
      });
    }

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

    const resolved = activatePlantAbilityForTurn({ id: playerSnap.id, ...playerData }, slotIndex, gameData.round);

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

    transaction.update(gameRef, nextTurn.nextState);

    appendLog(transaction, gameId, {
      message: nextTurn.wrapped
        ? `Round ${gameData.round} turns complete. Entering upkeep.`
        : `${currentPlayerSnap.data().displayName} ended their turn.`,
      playerId: currentPlayerSnap.id,
      type: "action"
    });
  });
}

export async function resolveRoundUpkeepTx(gameId: string, uid: string) {
  const players = await getOrderedPlayers(gameId);

  return runTransaction(firestore, async (transaction) => {
    const gameRef = gameDocRef(gameId);
    const gameSnap = await transaction.get(gameRef);
    assert(gameSnap.exists(), "Game not found.");

    const gameData = gameSnap.data();
    assert(gameData.phase === "upkeep", "Round upkeep can only be resolved during upkeep phase.");
    assert(gameData.lastPhaseResolvedRound !== gameData.round, "Upkeep already resolved for this round.");
    assert(players.length > 0, "No players found.");

    const hostSnap = players.find((snapshot) => snapshot.id === gameData.hostPlayerId);
    assert(hostSnap, "Host player not found.");
    assert(hostSnap.data().uid === uid, "Only the host can resolve upkeep.");

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
      transaction.update(playerDocRef(gameId, player.id), {
        gardenSlots: player.gardenSlots,
        resources: player.resources,
        score: isGameOver ? computePlayerScore(player) : player.score,
        abilityUsage: player.abilityUsage ?? {}
      });
    });

    transaction.update(gameRef, {
      phase: isGameOver ? "ended" : "turns",
      status: isGameOver ? "ended" : gameData.status,
      activePlayerId: isGameOver ? null : gameData.playerOrder[0] ?? players[0]?.id ?? null,
      turnIndex: 0,
      remainingActions: ACTIONS_PER_TURN,
      round: isGameOver ? gameData.round : nextRound,
      upkeepEventResponses: {},
      lastPhaseResolvedRound: gameData.round
    });

    appendLog(transaction, gameId, {
      message: isGameOver
        ? `Round ${gameData.round} upkeep resolved. Game ended.`
        : `Round ${gameData.round} upkeep resolved. Round ${nextRound} turns begin.`,
      type: "system"
    });
  });
}
