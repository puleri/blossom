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
import { gameDocRef, gameLogColRef, playerDocRef, playersColRef } from "@/lib/game/refs";
import type { GameDoc, GameLogEntryDoc, PlantCard, PlayerDoc } from "@/lib/game/types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function createStartingHand(): PlantCard[] {
  return Array.from({ length: SETUP_HAND_SIZE }, (_, index) => ({
    id: `starter-${index + 1}`,
    name: `Starter Seed ${index + 1}`,
    growthCost: 1,
    scoreValue: 1,
    growthTurns: 1
  }));
}

function appendLog(transaction: Transaction, gameId: string, entry: Omit<GameLogEntryDoc, "createdAt">) {
  const logRef = doc(gameLogColRef(gameId));
  transaction.set(logRef, { ...entry, createdAt: serverTimestamp() });
}

function requireTurnPhase(game: Omit<GameDoc, "id">) {
  assert(game.phase === "turns", "This action is only available during turn phase.");
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
      eventDeck: [],
      lastPhaseResolvedRound: null
    });

    transaction.set(hostRef, {
      displayName: hostDisplayName,
      uid,
      isHost: true,
      joinedAt: serverTimestamp(),
      resources: SETUP_STARTING_RESOURCES,
      score: 0,
      hand: createStartingHand(),
      gardenSlots: Array.from({ length: GARDEN_SLOT_DEFAULT }, () => "empty"),
      setupKept: false
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
      resources: SETUP_STARTING_RESOURCES,
      score: 0,
      hand: createStartingHand(),
      gardenSlots: Array.from({ length: GARDEN_SLOT_DEFAULT }, () => "empty"),
      setupKept: false
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

    transaction.update(gameRef, {
      status: "in_progress",
      phase: "setup",
      round: 1,
      activePlayerId: players[0]?.id ?? null,
      lastPhaseResolvedRound: null
    });

    appendLog(transaction, gameId, { message: "Game started. Setup phase begins.", playerId: hostSnap.id, type: "system" });
  });
}

export async function submitSetupKeepTx(gameId: string, uid: string) {
  const players = await getOrderedPlayers(gameId);

  return runTransaction(firestore, async (transaction) => {
    const gameRef = gameDocRef(gameId);
    const gameSnap = await transaction.get(gameRef);
    assert(gameSnap.exists(), "Game not found.");
    assert(gameSnap.data().phase === "setup", "Setup keep can only be submitted during setup phase.");

    const playerSnap = getPlayerByUid(players, uid);
    transaction.update(playerDocRef(gameId, playerSnap.id), { setupKept: true });
    appendLog(transaction, gameId, { message: `${playerSnap.data().displayName} is ready.`, playerId: playerSnap.id, type: "action" });

    const allReady = players.every((snapshot) => snapshot.id === playerSnap.id || snapshot.data().setupKept === true);
    if (allReady) {
      transaction.update(gameRef, { phase: "turns" });
      appendLog(transaction, gameId, { message: "All players are ready. Turn phase begins.", type: "system" });
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

    const playerData = playerSnap.data();
    assert(slotIndex >= 0 && slotIndex < playerData.gardenSlots.length, "Invalid garden slot.");
    assert(playerData.gardenSlots[slotIndex] === "empty", "Selected garden slot is not empty.");

    const plant = playerData.hand.find((card) => card.id === plantId);
    assert(plant, "Plant not found in hand.");
    assert(playerData.resources >= plant.growthCost, "Not enough resources to sow this plant.");

    const nextSlots = [...playerData.gardenSlots];
    nextSlots[slotIndex] = "seedling";

    transaction.update(playerDocRef(gameId, playerSnap.id), {
      hand: playerData.hand.filter((card) => card.id !== plantId),
      gardenSlots: nextSlots,
      resources: playerData.resources - plant.growthCost
    });

    appendLog(transaction, gameId, {
      message: `${playerData.displayName} sowed ${plant.name} in slot ${slotIndex + 1}.`,
      playerId: playerSnap.id,
      type: "action"
    });
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
    assert(playerData.resources >= 1, "Not enough resources to water a plant.");

    const nextSlots = [...playerData.gardenSlots];
    nextSlots[slotIndex] = "grown";

    transaction.update(playerDocRef(gameId, playerSnap.id), {
      gardenSlots: nextSlots,
      resources: playerData.resources - 1,
      score: playerData.score + 1
    });

    appendLog(transaction, gameId, { message: `${playerData.displayName} watered slot ${slotIndex + 1}.`, playerId: playerSnap.id, type: "action" });
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
    assert(playerData.resources >= 1, "Not enough resources to activate ability.");

    transaction.update(playerDocRef(gameId, playerSnap.id), { resources: playerData.resources + 1 });
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

    const orderedIds = players.map((snapshot) => snapshot.id);
    const currentIndex = orderedIds.indexOf(currentPlayerSnap.id);
    assert(currentIndex >= 0, "Active player order is invalid.");

    const nextPlayerId = orderedIds[currentIndex + 1] ?? null;
    transaction.update(gameRef, nextPlayerId ? { activePlayerId: nextPlayerId } : { phase: "upkeep", activePlayerId: null });

    appendLog(transaction, gameId, {
      message: nextPlayerId
        ? `${currentPlayerSnap.data().displayName} ended their turn.`
        : `Round ${gameData.round} turns complete. Entering upkeep.`,
      playerId: currentPlayerSnap.id,
      type: "action"
    });
  });
}

export async function resolveRoundUpkeepTx(gameId: string) {
  const players = await getOrderedPlayers(gameId);

  return runTransaction(firestore, async (transaction) => {
    const gameRef = gameDocRef(gameId);
    const gameSnap = await transaction.get(gameRef);
    assert(gameSnap.exists(), "Game not found.");

    const gameData = gameSnap.data();
    assert(gameData.phase === "upkeep", "Round upkeep can only be resolved during upkeep phase.");
    assert(gameData.lastPhaseResolvedRound !== gameData.round, "Upkeep already resolved for this round.");
    assert(players.length > 0, "No players found.");

    players.forEach((snapshot) => {
      transaction.update(playerDocRef(gameId, snapshot.id), { resources: snapshot.data().resources + 1 });
    });

    const isGameOver = gameData.round >= gameData.roundsTotal;
    const nextRound = gameData.round + 1;

    transaction.update(gameRef, {
      phase: isGameOver ? "ended" : "turns",
      status: isGameOver ? "ended" : gameData.status,
      activePlayerId: isGameOver ? null : players[0]?.id ?? null,
      round: isGameOver ? gameData.round : nextRound,
      lastPhaseResolvedRound: gameData.round
    });

    appendLog(transaction, gameId, {
      message: isGameOver
        ? `Round ${gameData.round} upkeep resolved. Game ended.`
        : `Round ${gameData.round} upkeep resolved. Round ${nextRound} begins.`,
      type: "system"
    });
  });
}
