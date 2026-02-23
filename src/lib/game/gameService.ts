import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { firestore } from "@/lib/firestore";
import {
  GARDEN_SLOT_DEFAULT,
  ROUNDS_TOTAL,
  SETUP_HAND_SIZE,
  SETUP_STARTING_RESOURCES
} from "@/lib/game/constants";
import type { GameDoc, PlayerDoc } from "@/lib/game/types";

function requireUid(uid?: string | null) {
  if (!uid) {
    throw new Error("Missing authenticated user (uid). Please refresh and try again.");
  }

  return uid;
}

function createEmptyGameLog(hostName: string) {
  return [`${hostName} created the game.`];
}

function createStartingHand() {
  return Array.from({ length: SETUP_HAND_SIZE }, (_, index) => ({
    id: `starter-${index + 1}`,
    name: `Starter Seed ${index + 1}`,
    growthCost: 1,
    scoreValue: 1,
    growthTurns: 1
  }));
}

export async function createGame(hostDisplayName: string, uid?: string | null) {
  const requiredUid = requireUid(uid);

  const gameRef = doc(collection(firestore, "games"));
  const playerRef = doc(collection(gameRef, "players"));

  const gameDoc: Omit<GameDoc, "id"> = {
    createdAt: serverTimestamp(),
    createdBy: playerRef.id,
    status: "lobby",
    phase: "lobby",
    round: 0,
    roundsTotal: ROUNDS_TOTAL,
    hostPlayerId: playerRef.id,
    activePlayerId: null,
    eventDeck: [],
    lastPhaseResolvedRound: null,
    log: createEmptyGameLog(hostDisplayName)
  };

  const hostDoc: Omit<PlayerDoc, "id"> = {
    displayName: hostDisplayName,
    uid: requiredUid,
    isHost: true,
    joinedAt: serverTimestamp(),
    resources: SETUP_STARTING_RESOURCES,
    score: 0,
    hand: createStartingHand(),
    gardenSlots: Array.from({ length: GARDEN_SLOT_DEFAULT }, () => "empty")
  };

  await setDoc(gameRef, gameDoc);
  await setDoc(playerRef, hostDoc);

  return { gameId: gameRef.id, playerId: playerRef.id };
}

export async function joinGame(gameId: string, displayName: string, uid?: string | null) {
  const requiredUid = requireUid(uid);

  const gameRef = doc(firestore, "games", gameId);
  const gameSnapshot = await getDoc(gameRef);

  if (!gameSnapshot.exists()) {
    throw new Error("Game not found.");
  }

  const gameData = gameSnapshot.data() as GameDoc;
  if (gameData.phase !== "lobby") {
    throw new Error("Game already started.");
  }

  const playerRef = doc(collection(gameRef, "players"));
  const playerDoc: Omit<PlayerDoc, "id"> = {
    displayName,
    uid: requiredUid,
    isHost: false,
    joinedAt: serverTimestamp(),
    resources: SETUP_STARTING_RESOURCES,
    score: 0,
    hand: createStartingHand(),
    gardenSlots: Array.from({ length: GARDEN_SLOT_DEFAULT }, () => "empty")
  };

  await setDoc(playerRef, playerDoc);
  await updateDoc(gameRef, {
    log: [...(gameData.log ?? []), `${displayName} joined the game.`]
  });

  return { gameId, playerId: playerRef.id };
}

export async function leaveGame(gameId: string, playerId: string, uid?: string | null) {
  const requiredUid = requireUid(uid);

  const gameRef = doc(firestore, "games", gameId);
  const playerRef = doc(gameRef, "players", playerId);

  const [gameSnap, playerSnap] = await Promise.all([getDoc(gameRef), getDoc(playerRef)]);
  if (!gameSnap.exists()) {
    return;
  }

  if (playerSnap.exists()) {
    const playerData = playerSnap.data() as PlayerDoc;
    if (playerData.uid !== requiredUid) {
      throw new Error("You can only leave as the authenticated player.");
    }
  }

  const gameData = gameSnap.data() as GameDoc;
  const playerName = playerSnap.exists() ? (playerSnap.data() as PlayerDoc).displayName : "A player";

  await deleteDoc(playerRef);

  const remainingPlayersSnap = await getDocs(collection(gameRef, "players"));
  const remainingPlayerIds = remainingPlayersSnap.docs.map((snapshot) => snapshot.id);

  const isHostLeaving = gameData.hostPlayerId === playerId;
  const nextHostPlayerId = isHostLeaving ? remainingPlayerIds[0] ?? null : gameData.hostPlayerId;

  if (!nextHostPlayerId) {
    await updateDoc(gameRef, {
      status: "ended",
      phase: "ended",
      activePlayerId: null,
      log: [...(gameData.log ?? []), `${playerName} left. Game ended.`]
    });
    return;
  }

  await updateDoc(gameRef, {
    hostPlayerId: nextHostPlayerId,
    activePlayerId: gameData.activePlayerId === playerId ? null : gameData.activePlayerId,
    log: [...(gameData.log ?? []), `${playerName} left the game.`]
  });
}

export async function startGameFromLobby(gameId: string, playerId: string, uid?: string | null) {
  const requiredUid = requireUid(uid);

  const gameRef = doc(firestore, "games", gameId);
  const gameSnap = await getDoc(gameRef);

  if (!gameSnap.exists()) {
    throw new Error("Game not found.");
  }

  const playerSnap = await getDoc(doc(gameRef, "players", playerId));
  if (!playerSnap.exists()) {
    throw new Error("Player not found.");
  }

  const playerData = playerSnap.data() as PlayerDoc;
  if (playerData.uid !== requiredUid) {
    throw new Error("Authenticated user does not match this player.");
  }

  const gameData = gameSnap.data() as GameDoc;

  if (gameData.hostPlayerId !== playerId) {
    throw new Error("Only the host can start the game.");
  }

  if (gameData.phase !== "lobby") {
    throw new Error("Game has already started.");
  }

  const playersSnap = await getDocs(collection(gameRef, "players"));
  if (playersSnap.size < 2) {
    throw new Error("Need at least 2 players to start.");
  }

  const firstPlayerId = playersSnap.docs[0]?.id ?? null;

  await updateDoc(gameRef, {
    status: "in_progress",
    phase: "setup",
    round: 1,
    activePlayerId: firstPlayerId,
    lastPhaseResolvedRound: null,
    log: [...(gameData.log ?? []), "Game started. Setup phase begins."]
  });
}
