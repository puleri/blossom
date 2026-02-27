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
import { ACTIONS_PER_TURN, GARDEN_SLOT_DEFAULT, ROUNDS_TOTAL, SETUP_HAND_SIZE, SETUP_STARTING_RESOURCES } from "@/lib/game/constants";
import { getPlantCardById, getPlantDisplayName } from "@/lib/game/cards/details";
import { EVENT_CARDS } from "@/lib/game/cards/events";
import { PLANT_CARD_IDS } from "@/lib/game/cards/plants";
import { drawFromDeck, drawSetupHands, revealNextEvent, shuffleFisherYates } from "@/lib/game/decks";
import {
  activatePlantAbilityForTurn,
  applyAdjacentPairBonuses,
  applyEventToPlayersWithReactions,
  applyPlantDecayAndDeaths,
  applyResourcePressureCaps,
  collectBudTokens,
  computePlayerScore,
  forceBloom,
  harvestBudsForPoints,
  resolveRoundEndUpkeepStartAbilities
} from "@/lib/game/engine";
import { gameDocRef, gameLogColRef, playerDocRef, playersColRef } from "@/lib/game/refs";
import type { EventCard, EventForecast, GameDoc, GameLogEntryDoc, GardenSlot, GardenSlotState, PlayerDoc, UpkeepEventResponse } from "@/lib/game/types";

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

function getCurrentEvent(game: Omit<GameDoc, "id">) {
  return EVENT_CARDS.find((event) => event.id === game.currentEventId) ?? null;
}

function buildForecast(event: EventCard | null): EventForecast | null {
  if (!event) {
    return null;
  }

  return {
    eventId: event.id,
    effectType: event.effectType,
    tags: event.tags,
    polarity: event.value >= 0 ? "positive" : "negative"
  };
}

function applyEventValueModifier(baseValue: number, response: UpkeepEventResponse | undefined) {
  if (!response || response.choice === "none" || baseValue === 0) {
    return baseValue;
  }

  const direction = baseValue > 0 ? 1 : -1;
  const magnitude = Math.abs(baseValue);

  if (response.choice === "amplify") {
    return baseValue + direction;
  }

  return direction * Math.max(0, magnitude - 1);
}

function applyEventToSinglePlayer(player: PlayerDoc, event: EventCard, value: number): PlayerDoc {
  if (event.effectType === "points") {
    return { ...player, score: Math.max(0, player.score + value) };
  }

  return {
    ...player,
    resources: {
      ...player.resources,
      [event.effectType]: Math.max(0, player.resources[event.effectType] + value)
    }
  };
}

function applyBloomWitherCheck(gardenSlots: GardenSlot[]): { gardenSlots: GardenSlot[]; withered: boolean } {
  const grownIndices = gardenSlots
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot }) => slot.state === "grown")
    .map(({ index }) => index);

  if (grownIndices.length === 0 || Math.random() >= 0.5) {
    return { gardenSlots, withered: false };
  }

  const randomIndex = grownIndices[Math.floor(Math.random() * grownIndices.length)];
  const nextSlots = [...gardenSlots];
  nextSlots[randomIndex] = { state: "withered", plantId: null, water: 0 };

  return { gardenSlots: nextSlots, withered: true };
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
      eventDeck: shuffleFisherYates(EVENT_CARDS),
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
    assert(players.length >= 2, "Need at least 2 players to start.");

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
      const { event, remainingDeck } = revealNextEvent(gameSnap.data().eventDeck);
      assert(event, "No events remaining in the event deck.");
      const activePlayerId = gameSnap.data().playerOrder[0] ?? players[0]?.id ?? null;

      transaction.update(gameRef, {
        phase: "turns",
        activePlayerId,
        turnIndex: 0,
        remainingActions: ACTIONS_PER_TURN,
        eventDeck: remainingDeck,
        currentEventId: event.id,
        nextEventForecast: buildForecast(remainingDeck[0] ?? null),
        upkeepEventResponses: {}
      });
      appendLog(transaction, gameId, { message: `Round 1 event drawn: ${event.name}. It resolves at round end.`, type: "system" });
      appendLog(
        transaction,
        gameId,
        {
          message: `Forecast for round 2: ${(remainingDeck[0]?.tags ?? []).join(", ")} ${remainingDeck[0]?.effectType ?? "unknown"} trend (${(remainingDeck[0]?.value ?? 0) >= 0 ? "positive" : "negative"}), exact strength unknown.`,
          type: "system"
        }
      );
    }
  });
}

export async function sowPlantTx(gameId: string, uid: string, plantId: string, slotIndex: number) {
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
    const gardenSlots = normalizeGardenSlots(playerData);
    assert(gardenSlots[slotIndex].state === "empty", "Selected garden slot is not empty.");

    assert(playerData.hand.includes(plantId), "Plant not found in hand.");

    const plant = getPlantCardById(plantId);
    assert(plant, "Plant card definition not found.");
    const nextSlots = normalizeGardenSlots(playerData);
    nextSlots[slotIndex] = { state: "seedling", plantId: plant.id, water: 0 };

    transaction.update(playerDocRef(gameId, playerSnap.id), {
      hand: playerData.hand.filter((cardId) => cardId !== plantId),
      gardenSlots: nextSlots
    });

    const remainingActions = getRemainingActions(gameData) - 1;
    if (remainingActions <= 0) {
      const nextTurn = resolveNextTurnState(gameData, players, playerSnap.id);
      transaction.update(gameDocRef(gameId), nextTurn.nextState);
      appendLog(transaction, gameId, {
        message: nextTurn.wrapped
          ? `Round ${gameData.round} turns complete. Entering upkeep.`
          : `${playerData.displayName} exhausted their actions. Turn auto-ended.`,
        playerId: playerSnap.id,
        type: "action"
      });
    } else {
      transaction.update(gameDocRef(gameId), { remainingActions });
    }

    appendLog(transaction, gameId, {
      message: `${playerData.displayName} planted ${plant.name} in slot ${slotIndex + 1}.`,
      playerId: playerSnap.id,
      type: "action"
    });
  });
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
      const capacity = card?.waterCapacity ?? 0;
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

    const currentEvent = getCurrentEvent(gameData);
    const eventModifier = currentEvent?.id === "rain" || currentEvent?.id === "seedBurst" || currentEvent?.id === "sprinkle"
      ? 1
      : currentEvent?.id === "drought" || currentEvent?.id === "dryHeat"
        ? -1
        : 0;
    const seedsGained = Math.max(1, Math.min(2, 1 + eventModifier));

    transaction.update(playerDocRef(gameId, playerSnap.id), {
      resources: {
        ...playerData.resources,
        water: playerData.resources.water - waterCost,
        seeds: playerData.resources.seeds + seedsGained
      }
    });

    consumeTurnAction(transaction, gameId, gameData, players, playerSnap.id, playerData.displayName);

    appendLog(transaction, gameId, {
      message: `${playerData.displayName} risked ${waterCost} water for seed stock and got ${seedsGained} seed${seedsGained === 1 ? "" : "s"}${
        currentEvent ? ` under ${currentEvent.name}` : ""
      }.`,
      playerId: playerSnap.id,
      type: "action"
    });
  });
}

export async function compostWitheredTx(gameId: string, uid: string, slotIndex: number) {
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
    const nextSlots = normalizeGardenSlots(playerData);
    assert(nextSlots[slotIndex].state === "withered", "Select a withered slot to compost.");

    const currentEvent = getCurrentEvent(gameData);
    const bugPenalty = Math.random() < 0.35 ? 1 : 0;
    const seedBonus = currentEvent?.id === "seedBurst" ? 1 : 0;
    const flowerBonus = currentEvent?.id === "pollination" ? 1 : 0;
    const seedsGained = 1 + seedBonus;
    const flowersGained = 1 + flowerBonus;

    nextSlots[slotIndex] = { state: "empty", plantId: null, water: 0 };

    transaction.update(playerDocRef(gameId, playerSnap.id), {
      gardenSlots: nextSlots,
      resources: {
        ...playerData.resources,
        seeds: playerData.resources.seeds + seedsGained,
        flowers: playerData.resources.flowers + flowersGained,
        bugs: playerData.resources.bugs + bugPenalty
      }
    });

    consumeTurnAction(transaction, gameId, gameData, players, playerSnap.id, playerData.displayName);

    appendLog(transaction, gameId, {
      message: `${playerData.displayName} composted withered slot ${slotIndex + 1} (stake: permanently clear the slot) and gained +${seedsGained} seed${
        seedsGained === 1 ? "" : "s"
      }/+${flowersGained} flower${flowersGained === 1 ? "" : "s"}${bugPenalty ? ", but attracted +1 bug" : " with no bug penalty"}.`,
      playerId: playerSnap.id,
      type: "action"
    });
  });
}

export async function gambleBloomTx(gameId: string, uid: string) {
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
    assert(playerData.resources.water >= waterCost, "Not enough water to gamble.");

    const currentEvent = getCurrentEvent(gameData);
    const roll = Math.floor(Math.random() * 5);
    const eventFlowerBonus = currentEvent?.id === "pollination" ? 1 : 0;
    const flowersGained = roll + eventFlowerBonus;
    const bugPenalty = roll <= 1 ? 1 + (currentEvent?.id === "infestation" ? 1 : 0) : 0;

    transaction.update(playerDocRef(gameId, playerSnap.id), {
      resources: {
        ...playerData.resources,
        water: playerData.resources.water - waterCost,
        flowers: playerData.resources.flowers + flowersGained,
        bugs: playerData.resources.bugs + bugPenalty
      }
    });

    consumeTurnAction(transaction, gameId, gameData, players, playerSnap.id, playerData.displayName);

    appendLog(transaction, gameId, {
      message: `${playerData.displayName} gambled ${waterCost} water for a bloom roll (rolled ${roll}) and gained ${flowersGained} flower${
        flowersGained === 1 ? "" : "s"
      }${bugPenalty ? `, but paid ${bugPenalty} bug penalty` : ", with no bug penalty"}.`,
      playerId: playerSnap.id,
      type: "action"
    });
  });
}

export async function harvestNowTx(gameId: string, uid: string) {
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
    assert(playerData.resources.buds > 0, "No buds available to harvest.");

    const harvested = harvestBudsForPoints({ id: playerSnap.id, ...playerData });

    transaction.update(playerDocRef(gameId, playerSnap.id), {
      resources: harvested.resources,
      score: harvested.score
    });

    consumeTurnAction(transaction, gameId, gameData, players, playerSnap.id, playerData.displayName);

    appendLog(transaction, gameId, {
      message: `${playerData.displayName} harvested ${playerData.resources.buds} bud${playerData.resources.buds === 1 ? "" : "s"} immediately for ${harvested.score - playerData.score} point${harvested.score - playerData.score === 1 ? "" : "s"}.`,
      playerId: playerSnap.id,
      type: "action"
    });
  });
}

export async function forceBloomTx(gameId: string, uid: string) {
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
    assert(playerData.resources.buds > 0, "No buds available to bloom.");

    const bloomed = forceBloom({ id: playerSnap.id, ...playerData });
    const riskRoll = Math.floor(Math.random() * 3);
    const nextResources = { ...bloomed.resources };
    let nextSlots = normalizeGardenSlots(playerData);
    let riskMessage = "with no side effects";

    if (riskRoll === 0) {
      nextResources.water = Math.max(0, nextResources.water - 1);
      riskMessage = "but lost 1 water";
    } else if (riskRoll === 1) {
      nextResources.bugs += 1;
      riskMessage = "but attracted +1 bug";
    } else {
      const witherResult = applyBloomWitherCheck(nextSlots);
      nextSlots = witherResult.gardenSlots;
      riskMessage = witherResult.withered ? "and a grown plant withered" : "and passed the wither check";
    }

    transaction.update(playerDocRef(gameId, playerSnap.id), {
      gardenSlots: nextSlots,
      resources: nextResources
    });

    consumeTurnAction(transaction, gameId, gameData, players, playerSnap.id, playerData.displayName);

    appendLog(transaction, gameId, {
      message: `${playerData.displayName} forced ${playerData.resources.buds} bud${playerData.resources.buds === 1 ? "" : "s"} to bloom into flowers ${riskMessage}.`,
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

export async function submitUpkeepEventResponseTx(
  gameId: string,
  uid: string,
  choice: "mitigate" | "amplify" | "none",
  spentResource: "water" = "water"
) {
  const players = await getOrderedPlayers(gameId);

  return runTransaction(firestore, async (transaction) => {
    const gameRef = gameDocRef(gameId);
    const gameSnap = await transaction.get(gameRef);
    assert(gameSnap.exists(), "Game not found.");

    const gameData = gameSnap.data();
    assert(gameData.phase === "upkeep", "Event responses can only be submitted during upkeep.");

    const playerSnap = getPlayerByUid(players, uid);
    const playerData = playerSnap.data();

    const existingResponses = gameData.upkeepEventResponses ?? {};
    assert(!existingResponses[playerSnap.id], "You already submitted an upkeep response.");

    if (choice !== "none") {
      assert(playerData.resources[spentResource] >= 1, `Not enough ${spentResource} to submit this response.`);
      transaction.update(playerDocRef(gameId, playerSnap.id), {
        resources: {
          ...playerData.resources,
          [spentResource]: playerData.resources[spentResource] - 1
        }
      });
    }

    const response: UpkeepEventResponse = {
      choice,
      spentResource: choice === "none" ? null : spentResource
    };

    transaction.update(gameRef, {
      upkeepEventResponses: {
        ...existingResponses,
        [playerSnap.id]: response
      }
    });

    appendLog(transaction, gameId, {
      message:
        choice === "none"
          ? `${playerData.displayName} chose not to respond before upkeep event resolution.`
          : `${playerData.displayName} chose to ${choice} the event by spending 1 ${spentResource}.`,
      playerId: playerSnap.id,
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

    const updatedPlayersAfterUpkeep = roundEndResults.map((result) => {
      const afterDecay = applyPlantDecayAndDeaths(result.player);
      const afterAdjacentBonuses = applyAdjacentPairBonuses(afterDecay);
      const afterBudCollection = collectBudTokens(afterAdjacentBonuses);
      const afterResourcePressure = applyResourcePressureCaps(afterBudCollection);

      return {
        ...afterResourcePressure,
        resources: {
          ...afterResourcePressure.resources,
          water: afterResourcePressure.resources.water + 1
        }
      };
    });

    const currentEvent = EVENT_CARDS.find((event) => event.id === gameData.currentEventId) ?? null;
    const eventResponses = gameData.upkeepEventResponses ?? {};

    const eventResolution = currentEvent
      ? applyEventToPlayersWithReactions(updatedPlayersAfterUpkeep, currentEvent)
      : { players: updatedPlayersAfterUpkeep, logs: [] };

    eventResolution.logs.forEach(({ playerId, trigger }) => {
      appendLog(transaction, gameId, {
        message: `${getPlantDisplayName(trigger.plantId)} (slot ${trigger.slotIndex + 1}) ${trigger.message}`,
        playerId,
        type: "system"
      });
    });

    const updatedPlayers = currentEvent
      ? eventResolution.players.map((player) => {
          const response = eventResponses[player.id];
          const adjustedValue = applyEventValueModifier(currentEvent.value, response);

          return applyEventToSinglePlayer(player, currentEvent, adjustedValue);
        })
      : eventResolution.players;

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

    if (!isGameOver) {
      const { event, remainingDeck } = revealNextEvent(gameData.eventDeck);
      assert(event, "No events remaining in the event deck.");
      transaction.update(gameRef, {
        eventDeck: remainingDeck,
        currentEventId: event.id,
        nextEventForecast: buildForecast(remainingDeck[0] ?? null)
      });
      appendLog(transaction, gameId, { message: `Round ${nextRound} event drawn: ${event.name}. It resolves at round end.`, type: "system" });
      const nextForecast = buildForecast(remainingDeck[0] ?? null);
      if (nextForecast) {
        appendLog(
          transaction,
          gameId,
          {
            message: `Forecast for round ${nextRound + 1}: tags ${nextForecast.tags.join(", ")}, ${nextForecast.effectType} trend (${nextForecast.polarity}), exact strength unknown.`,
            type: "system"
          }
        );
      }
    }

    appendLog(transaction, gameId, {
      message: isGameOver
        ? `Round ${gameData.round} upkeep and event resolved. Game ended.`
        : `Round ${gameData.round} upkeep resolved (buds generated), then event resolved. Round ${nextRound} turns begin.`,
      type: "system"
    });
  });
}
