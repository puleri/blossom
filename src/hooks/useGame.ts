"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, type FirestoreError } from "firebase/firestore";
import { firestore } from "@/lib/firestore";
import type { GameDoc } from "@/lib/game/types";

interface HookState<T> {
  data: T;
  loading: boolean;
  error: FirestoreError | null;
}

export function useGame(gameId: string): HookState<GameDoc | null> {
  const [data, setData] = useState<GameDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  useEffect(() => {
    if (!gameId) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const gameRef = doc(firestore, "games", gameId);
    const unsubscribe = onSnapshot(
      gameRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setData(null);
        } else {
          setData({ id: snapshot.id, ...(snapshot.data() as Omit<GameDoc, "id">) });
        }

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
