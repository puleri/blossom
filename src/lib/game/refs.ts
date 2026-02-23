import { collection, doc, type CollectionReference, type DocumentReference } from "firebase/firestore";
import { firestore } from "@/lib/firestore";
import type { GameDoc, GameLogEntryDoc, PlayerDoc } from "@/lib/game/types";

export function gameDocRef(gameId: string): DocumentReference<Omit<GameDoc, "id">> {
  return doc(firestore, "games", gameId) as DocumentReference<Omit<GameDoc, "id">>;
}

export function playersColRef(gameId: string): CollectionReference<Omit<PlayerDoc, "id">> {
  return collection(gameDocRef(gameId), "players") as CollectionReference<Omit<PlayerDoc, "id">>;
}

export function playerDocRef(gameId: string, uid: string): DocumentReference<Omit<PlayerDoc, "id">> {
  return doc(playersColRef(gameId), uid) as DocumentReference<Omit<PlayerDoc, "id">>;
}

export function gameLogColRef(gameId: string): CollectionReference<GameLogEntryDoc> {
  return collection(gameDocRef(gameId), "log") as CollectionReference<GameLogEntryDoc>;
}
