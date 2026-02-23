"use client";

import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query, type FirestoreError } from "firebase/firestore";
import { firestore } from "@/lib/firestore";
import type { GameLogEntryDoc } from "@/lib/game/types";

interface HookState<T> {
  data: T;
  loading: boolean;
  error: FirestoreError | null;
}

export function useGameLog(gameId: string, itemLimit = 50): HookState<GameLogEntryDoc[]> {
  const [data, setData] = useState<GameLogEntryDoc[]>([]);
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

    const logRef = collection(firestore, "games", gameId, "log");
    const logQuery = query(logRef, orderBy("createdAt", "desc"), limit(itemLimit));

    const unsubscribe = onSnapshot(
      logQuery,
      (snapshot) => {
        const entries = snapshot.docs
          .map((log) => log.data() as GameLogEntryDoc)
          .reverse();

        setData(entries);
        setLoading(false);
      },
      (snapshotError) => {
        setError(snapshotError);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [gameId, itemLimit]);

  return { data, loading, error };
}
