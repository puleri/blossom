"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createGame, joinGame } from "@/lib/game/gameService";
import { getLocalDisplayName, setLocalDisplayName } from "@/lib/auth";
import { useAuthUser } from "@/hooks/useAuthUser";

export default function Home() {
  const router = useRouter();
  const { user } = useAuthUser();
  const [displayName, setDisplayName] = useState("");
  const [joinId, setJoinId] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(getLocalDisplayName());
  }, []);

  async function onCreateGame(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!user?.uid) {
      setError("Authentication is still loading. Please wait a moment and try again.");
      return;
    }

    try {
      const safeDisplayName = displayName || "Host";
      const { gameId, playerId } = await createGame(safeDisplayName, user.uid);
      setLocalDisplayName(safeDisplayName);
      window.localStorage.setItem(`blossom:${gameId}:playerId`, playerId);
      router.push(`/game/${gameId}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create game.");
    }
  }

  async function onJoinGame(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!user?.uid) {
      setError("Authentication is still loading. Please wait a moment and try again.");
      return;
    }

    try {
      const safeDisplayName = displayName || "Guest";
      const { gameId, playerId } = await joinGame(joinId.trim(), safeDisplayName, user.uid);
      setLocalDisplayName(safeDisplayName);
      window.localStorage.setItem(`blossom:${gameId}:playerId`, playerId);
      router.push(`/game/${gameId}`);
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "Unable to join game.");
    }
  }

  return (
    <main>
      <h1>Blossom</h1>
      <p>Create a game lobby or join an existing one.</p>

      <label htmlFor="displayName">Display name</label>
      <input
        id="displayName"
        value={displayName}
        onChange={(event) => setDisplayName(event.target.value)}
        placeholder="Your name"
      />

      <section>
        <h2>Create Game</h2>
        <form onSubmit={onCreateGame}>
          <button type="submit">Create Lobby</button>
        </form>
      </section>

      <section>
        <h2>Join Game</h2>
        <form onSubmit={onJoinGame}>
          <label htmlFor="joinId">Game ID</label>
          <input
            id="joinId"
            value={joinId}
            onChange={(event) => setJoinId(event.target.value)}
            placeholder="Paste game ID"
          />
          <button type="submit" disabled={!joinId.trim()}>
            Join Lobby
          </button>
        </form>
      </section>

      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
    </main>
  );
}
