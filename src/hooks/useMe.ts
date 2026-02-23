"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, type FirestoreError } from "firebase/firestore";
import { firestore } from "@/lib/firestore";
import type { PlayerDoc } from "@/lib/game/types";

interface HookState<T> {
  data: T;
  loading: boolean;
  error: FirestoreError | null;
}

export function useMe(gameId: string, uid: string | null | undefined): HookState<PlayerDoc | null> {
  const [data, setData] = useState<PlayerDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  useEffect(() => {
    if (!gameId || !uid) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const meRef = doc(firestore, "games", gameId, "players", uid);
    const unsubscribe = onSnapshot(
      meRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setData(null);
        } else {
          setData({ id: snapshot.id, ...(snapshot.data() as Omit<PlayerDoc, "id">) });
        }

        setLoading(false);
      },
      (snapshotError) => {
        setError(snapshotError);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [gameId, uid]);

  return { data, loading, error };
}
