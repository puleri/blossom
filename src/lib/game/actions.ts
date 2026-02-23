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
import { drawSetupHands, shuffleFisherYates } from "@/lib/game/decks";
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
  assert(game.phase === "active" || game.phase === "turns", "This action is only available during the active phase.");
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
      eventDeck: shuffleFisherYates(EVENT_CARDS),
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
    const { hands } = drawSetupHands(orderedPlayerIds, shuffledPlantIds, SETUP_HAND_SIZE);

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
      activePlayerId: players[0]?.id ?? null,
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
      transaction.update(gameRef, { phase: "active" });
      appendLog(transaction, gameId, { message: "All players are ready. Active phase begins.", type: "system" });
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

    assert(playerData.hand.includes(plantId), "Plant not found in hand.");

    const plant = getPlantById(plantId);
    assert(plant, "Plant card definition not found.");
    assert(playerData.resources.seeds >= plant.seedCost, "Not enough seeds to sow this plant.");

    const nextSlots = [...playerData.gardenSlots];
    nextSlots[slotIndex] = "seedling";

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

    transaction.update(playerDocRef(gameId, playerSnap.id), {
      gardenSlots: nextSlots,
      resources: {
        ...playerData.resources,
        water: playerData.resources.water - 1
      },
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
      transaction.update(playerDocRef(gameId, snapshot.id), {
        resources: {
          ...snapshot.data().resources,
          water: snapshot.data().resources.water + 1
        }
      });
    });

    const isGameOver = gameData.round >= gameData.roundsTotal;
    const nextRound = gameData.round + 1;

    transaction.update(gameRef, {
      phase: isGameOver ? "ended" : "active",
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
