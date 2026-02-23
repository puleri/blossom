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
import { GARDEN_SLOT_DEFAULT, ROUNDS_TOTAL, SETUP_HAND_SIZE, SETUP_STARTING_RESOURCES } from "@/lib/game/constants";
import { EVENT_CARDS } from "@/lib/game/cards/events";
import { PLANT_CARDS, PLANT_CARD_IDS } from "@/lib/game/cards/plants";
import { drawFromDeck, drawSetupHands, revealNextEvent, shuffleFisherYates } from "@/lib/game/decks";
import {
  applyAdjacentPairBonuses,
  applyEventToPlayers,
  applyPlantDecayAndDeaths,
  collectFlowerTokens,
  computePlayerScore
} from "@/lib/game/engine";
import { gameDocRef, gameLogColRef, playerDocRef, playersColRef } from "@/lib/game/refs";
import type { GameDoc, GameLogEntryDoc, PlayerDoc, ResourceKey } from "@/lib/game/types";

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

function getPlantById(plantId: string) {
  return PLANT_CARDS.find((card) => card.id === plantId);
}

function getNextTurnState(order: string[], currentIndex: number) {
  const nextIndex = currentIndex + 1;
  const wrapped = nextIndex >= order.length;

  return wrapped
    ? { phase: "upkeep" as const, activePlayerId: null, turnIndex: 0 }
    : { phase: "turns" as const, activePlayerId: order[nextIndex], turnIndex: nextIndex };
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
      eventDeck: shuffleFisherYates(EVENT_CARDS),
      plantDeck: [],
      currentEventId: null,
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
      gardenSlots: Array.from({ length: GARDEN_SLOT_DEFAULT }, () => "empty"),
      keptFromMulligan: false
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
      gardenSlots: Array.from({ length: GARDEN_SLOT_DEFAULT }, () => "empty"),
      keptFromMulligan: false
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
        keptFromMulligan: false
      });
    });

    transaction.update(gameRef, {
      status: "in_progress",
      phase: "setup",
      round: 1,
      activePlayerId: null,
      playerOrder: orderedPlayerIds,
      turnIndex: 0,
      plantDeck: remainingDeck,
      currentEventId: null,
      lastPhaseResolvedRound: null
    });

    appendLog(transaction, gameId, { message: "Game started. Setup phase begins.", playerId: hostSnap.id, type: "system" });
  });
}

export async function submitSetupKeepTx(
  gameId: string,
  uid: string,
  keptPlantIds: string[],
  discardedResources: ResourceKey[]
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

    assert(discardedResources.length === keptPlantIds.length, "Discard exactly one resource per kept plant.");

    const nextResources = { ...playerData.resources };
    discardedResources.forEach((resourceKey) => {
      assert(nextResources[resourceKey] > 0, `Not enough ${resourceKey} to discard.`);
      nextResources[resourceKey] -= 1;
    });

    transaction.update(playerDocRef(gameId, playerSnap.id), {
      hand: uniqueKeptIds,
      resources: nextResources,
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
        eventDeck: remainingDeck,
        currentEventId: event.id
      });
      appendLog(transaction, gameId, { message: `Round 1 event drawn: ${event.name}. It resolves at round end.`, type: "system" });
    }
  });
}

export async function resolveRoundEventTx(gameId: string, uid: string) {
  const players = await getOrderedPlayers(gameId);

  return runTransaction(firestore, async (transaction) => {
    const gameRef = gameDocRef(gameId);
    const gameSnap = await transaction.get(gameRef);
    assert(gameSnap.exists(), "Game not found.");

    const gameData = gameSnap.data();
    assert(gameData.phase === "event", "Round event can only be resolved during event phase.");
    assert(players.length > 0, "No players found.");

    const hostSnap = players.find((snapshot) => snapshot.id === gameData.hostPlayerId);
    assert(hostSnap, "Host player not found.");
    assert(hostSnap.data().uid === uid, "Only the host can resolve the round event.");

    const { event, remainingDeck } = revealNextEvent(gameData.eventDeck);
    assert(event, "No events remaining in the event deck.");

    const nextPlayers = applyEventToPlayers(
      players.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() })),
      event
    );

    nextPlayers.forEach((player) => {
      transaction.update(playerDocRef(gameId, player.id), { resources: player.resources, score: player.score });
    });

    const activePlayerId = gameData.playerOrder[0] ?? players[0]?.id ?? null;

    transaction.update(gameRef, {
      phase: "turns",
      activePlayerId,
      turnIndex: 0,
      eventDeck: remainingDeck,
      currentEventId: event.id
    });

    appendLog(transaction, gameId, { message: `Round ${gameData.round} event: ${event.name}.`, type: "system" });
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

    const playerData = playerSnap.data();
    assert(slotIndex >= 0 && slotIndex < playerData.gardenSlots.length, "Invalid garden slot.");
    assert(playerData.gardenSlots[slotIndex] === "empty", "Selected garden slot is not empty.");

    assert(playerData.hand.includes(plantId), "Plant not found in hand.");

    const plant = getPlantById(plantId);
    assert(plant, "Plant card definition not found.");
    assert(playerData.resources.seeds >= plant.seedCost, "Not enough seeds to sow this plant.");

    const nextSlots = [...playerData.gardenSlots];
    nextSlots[slotIndex] = "seedling";

    const order = gameData.playerOrder.length ? gameData.playerOrder : players.map((snapshot) => snapshot.id);
    const currentIndex = gameData.turnIndex;
    assert(order[currentIndex] === playerSnap.id, "Turn order is out of sync.");

    transaction.update(playerDocRef(gameId, playerSnap.id), {
      hand: playerData.hand.filter((cardId) => cardId !== plantId),
      gardenSlots: nextSlots,
      resources: {
        ...playerData.resources,
        seeds: playerData.resources.seeds - plant.seedCost
      }
    });

    appendLog(transaction, gameId, {
      message: `${playerData.displayName} sowed ${plant.name} in slot ${slotIndex + 1}.`,
      playerId: playerSnap.id,
      type: "action"
    });

    transaction.update(gameDocRef(gameId), getNextTurnState(order, currentIndex));
  });
}

export async function waterPlantTx(gameId: string, uid: string, slotIndex: number) {
  const players = await getOrderedPlayers(gameId);

  return runTransaction(firestore, async (transaction) => {
    const gameSnap = await transaction.get(gameDocRef(gameId));
    assert(gameSnap.exists(), "Game not found.");
    const gameData = gameSnap.data();
    requireTurnPhase(gameData);

    const playerSnap = getPlayerByUid(players, uid);
    assert(gameData.activePlayerId === playerSnap.id, "Only the active player can perform turn actions.");

    const playerData = playerSnap.data();
    assert(slotIndex >= 0 && slotIndex < playerData.gardenSlots.length, "Invalid garden slot.");
    assert(playerData.gardenSlots[slotIndex] === "seedling", "Only seedlings can be watered.");
    assert(playerData.resources.water >= 1, "Not enough water to water a plant.");

    const nextSlots = [...playerData.gardenSlots];
    nextSlots[slotIndex] = "grown";

    const order = gameData.playerOrder.length ? gameData.playerOrder : players.map((snapshot) => snapshot.id);
    const currentIndex = gameData.turnIndex;
    assert(order[currentIndex] === playerSnap.id, "Turn order is out of sync.");

    transaction.update(playerDocRef(gameId, playerSnap.id), {
      gardenSlots: nextSlots,
      resources: {
        ...playerData.resources,
        water: playerData.resources.water - 1
      },
      score: playerData.score + 1
    });

    appendLog(transaction, gameId, { message: `${playerData.displayName} visited the well and watered slot ${slotIndex + 1}.`, playerId: playerSnap.id, type: "action" });

    transaction.update(gameDocRef(gameId), getNextTurnState(order, currentIndex));
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

    const order = gameData.playerOrder.length ? gameData.playerOrder : players.map((snapshot) => snapshot.id);
    const currentIndex = gameData.turnIndex;
    assert(order[currentIndex] === playerSnap.id, "Turn order is out of sync.");

    const draw = drawFromDeck(gameData.plantDeck ?? [], 1);
    assert(draw.drawn.length === 1, "Plant deck is empty.");

    const playerData = playerSnap.data();
    const drawnCardId = draw.drawn[0];

    transaction.update(playerDocRef(gameId, playerSnap.id), {
      hand: [...playerData.hand, drawnCardId]
    });

    transaction.update(gameRef, {
      plantDeck: draw.remainingDeck,
      ...getNextTurnState(order, currentIndex)
    });

    appendLog(transaction, gameId, {
      message: `${playerData.displayName} drew a plant card (${drawnCardId}).`,
      playerId: playerSnap.id,
      type: "action"
    });
  });
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

    const playerData = playerSnap.data();
    assert(slotIndex >= 0 && slotIndex < playerData.gardenSlots.length, "Invalid garden slot.");
    assert(playerData.gardenSlots[slotIndex] === "grown", "Only grown plants can activate abilities.");
    assert(playerData.resources.water >= 1, "Not enough water to activate ability.");

    transaction.update(playerDocRef(gameId, playerSnap.id), {
      resources: {
        ...playerData.resources,
        water: playerData.resources.water - 1,
        flowers: playerData.resources.flowers + 1
      }
    });

    appendLog(transaction, gameId, {
      message: `${playerData.displayName} activated a plant ability at slot ${slotIndex + 1}.`,
      playerId: playerSnap.id,
      type: "action"
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

    const order = gameData.playerOrder.length ? gameData.playerOrder : players.map((snapshot) => snapshot.id);
    const currentIndex = gameData.turnIndex;
    assert(order[currentIndex] === currentPlayerSnap.id, "Turn order is out of sync.");

    const nextIndex = currentIndex + 1;
    const wrapped = nextIndex >= order.length;

    transaction.update(
      gameRef,
      wrapped
        ? { phase: "upkeep", activePlayerId: null, turnIndex: 0 }
        : { activePlayerId: order[nextIndex], turnIndex: nextIndex }
    );

    appendLog(transaction, gameId, {
      message: wrapped
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

    const updatedPlayersAfterUpkeep = players.map((snapshot) => {
      const basePlayer = { id: snapshot.id, ...snapshot.data() };
      const afterDecay = applyPlantDecayAndDeaths(basePlayer);
      const afterAdjacentBonuses = applyAdjacentPairBonuses(afterDecay);
      const afterFlowerCollection = collectFlowerTokens(afterAdjacentBonuses);

      return {
        ...afterFlowerCollection,
        resources: {
          ...afterFlowerCollection.resources,
          water: afterFlowerCollection.resources.water + 1
        }
      };
    });

    const currentEvent = EVENT_CARDS.find((event) => event.id === gameData.currentEventId) ?? null;
    const updatedPlayers = currentEvent ? applyEventToPlayers(updatedPlayersAfterUpkeep, currentEvent) : updatedPlayersAfterUpkeep;

    const nextRound = gameData.round + 1;
    const isGameOver = nextRound > gameData.roundsTotal;

    updatedPlayers.forEach((player) => {
      transaction.update(playerDocRef(gameId, player.id), {
        gardenSlots: player.gardenSlots,
        resources: player.resources,
        score: isGameOver ? computePlayerScore(player) : player.score
      });
    });

    transaction.update(gameRef, {
      phase: isGameOver ? "ended" : "turns",
      status: isGameOver ? "ended" : gameData.status,
      activePlayerId: isGameOver ? null : gameData.playerOrder[0] ?? players[0]?.id ?? null,
      turnIndex: 0,
      round: isGameOver ? gameData.round : nextRound,
      lastPhaseResolvedRound: gameData.round
    });

    if (!isGameOver) {
      const { event, remainingDeck } = revealNextEvent(gameData.eventDeck);
      assert(event, "No events remaining in the event deck.");
      transaction.update(gameRef, {
        eventDeck: remainingDeck,
        currentEventId: event.id
      });
      appendLog(transaction, gameId, { message: `Round ${nextRound} event drawn: ${event.name}. It resolves at round end.`, type: "system" });
    }

    appendLog(transaction, gameId, {
      message: isGameOver
        ? `Round ${gameData.round} upkeep and event resolved. Game ended.`
        : `Round ${gameData.round} upkeep resolved, then event resolved. Round ${nextRound} turns begin.`,
      type: "system"
    });
  });
}
