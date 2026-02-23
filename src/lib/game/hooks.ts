"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import { firestore } from "@/lib/firestore";
import type { GameDoc, PlayerDoc } from "@/lib/game/types";

export function useGame(gameId: string) {
  const [game, setGame] = useState<GameDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const gameRef = doc(firestore, "games", gameId);
    const unsubscribe = onSnapshot(gameRef, (snapshot) => {
      if (!snapshot.exists()) {
        setGame(null);
      } else {
        setGame({ id: snapshot.id, ...(snapshot.data() as Omit<GameDoc, "id">) });
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [gameId]);

  return { game, loading };
}

export function usePlayers(gameId: string) {
  const [players, setPlayers] = useState<PlayerDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const playersRef = collection(firestore, "games", gameId, "players");
    const playersQuery = query(playersRef, orderBy("joinedAt", "asc"));

    const unsubscribe = onSnapshot(playersQuery, (snapshot) => {
      setPlayers(
        snapshot.docs.map((player) => ({
          id: player.id,
          ...(player.data() as Omit<PlayerDoc, "id">)
        }))
      );
      setLoading(false);
    });

    return unsubscribe;
  }, [gameId]);

  return { players, loading };
}

export function useCurrentPlayer(gameId: string) {
  const { players } = usePlayers(gameId);

  return useMemo(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const playerId = window.localStorage.getItem(`blossom:${gameId}:playerId`);
    return players.find((player) => player.id === playerId) ?? null;
  }, [gameId, players]);
}
