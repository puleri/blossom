"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, type FirestoreError } from "firebase/firestore";
import { firestore } from "@/lib/firestore";
import type { PlayerDoc } from "@/lib/game/types";

interface HookState<T> {
  data: T;
  loading: boolean;
  error: FirestoreError | null;
}

export function usePlayers(gameId: string): HookState<PlayerDoc[]> {
  const [data, setData] = useState<PlayerDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  useEffect(() => {
    if (!gameId) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const playersRef = collection(firestore, "games", gameId, "players");
    const playersQuery = query(playersRef, orderBy("joinedAt", "asc"));

    const unsubscribe = onSnapshot(
      playersQuery,
      (snapshot) => {
        setData(
          snapshot.docs.map((player) => ({
            id: player.id,
            ...(player.data() as Omit<PlayerDoc, "id">)
          }))
        );

        setLoading(false);
      },
      (snapshotError) => {
        setError(snapshotError);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [gameId]);

  return { data, loading, error };
}
