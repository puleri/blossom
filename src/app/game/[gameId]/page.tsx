"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GameHeader } from "@/components/game/GameHeader";
import { PlayerList } from "@/components/game/PlayerList";
import { GardenTableau } from "@/components/game/GardenTableau";
import { HandPanel } from "@/components/game/HandPanel";
import { GameLog } from "@/components/game/GameLog";
import { leaveGame, startGameFromLobby } from "@/lib/game/gameService";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useGame } from "@/hooks/useGame";
import { useGameLog } from "@/hooks/useGameLog";
import { useMe } from "@/hooks/useMe";
import { usePlayers } from "@/hooks/usePlayers";

interface GamePageProps {
  params: { gameId: string };
}

export default function GamePage({ params }: GamePageProps) {
  const router = useRouter();
  const { user } = useAuthUser();
  const { data: game, loading: gameLoading, error: gameError } = useGame(params.gameId);
  const { data: players, loading: playersLoading, error: playersError } = usePlayers(params.gameId);
  const { data: me, loading: meLoading, error: meError } = useMe(params.gameId, user?.uid);
  const { data: logEntries, loading: logLoading, error: logError } = useGameLog(params.gameId);
  const [error, setError] = useState<string | null>(null);
  const loading = gameLoading || playersLoading || meLoading;

  const currentPlayer = useMemo(
    () => players.find((player) => player.id === me?.id) ?? null,
    [players, me?.id]
  );

  useEffect(() => {
    if (gameError) {
      setError(gameError.message);
      return;
    }

    if (playersError) {
      setError(playersError.message);
      return;
    }

    if (meError) {
      setError(meError.message);
      return;
    }

    if (logError) {
      setError(logError.message);
    }
  }, [gameError, playersError, meError, logError]);

  if (loading) {
    return <main>Loading game...</main>;
  }

  if (!game) {
    return <main>Game not found.</main>;
  }

  async function handleStartGame() {
    if (!user?.uid) {
      setError("Cannot start game without an authenticated user id (uid).");
      return;
    }

    if (!me?.id) {
      setError("Missing local player ID. Rejoin from home.");
      return;
    }

    try {
      await startGameFromLobby(params.gameId, me.id, user.uid);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Could not start game.");
    }
  }

  async function handleLeaveGame() {
    if (!user?.uid) {
      setError("Cannot leave game without an authenticated user id (uid).");
      return;
    }

    if (!me?.id) {
      router.push("/");
      return;
    }

    try {
      await leaveGame(params.gameId, me.id, user.uid);
      window.localStorage.removeItem(`blossom:${params.gameId}:playerId`);
      router.push("/");
    } catch (leaveError) {
      setError(leaveError instanceof Error ? leaveError.message : "Could not leave game.");
    }
  }

  const isMyTurn = Boolean(me?.id && game.activePlayerId === me.id);
  const disableActionControls = loading || (game.phase === "active" && !isMyTurn);

  return (
    <main>
      <GameHeader game={game} playerCount={players.length} />

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={handleLeaveGame} disabled={loading}>
          Leave Game
        </button>
        {game.phase === "lobby" && me?.id === game.hostPlayerId ? (
          <button onClick={handleStartGame} disabled={disableActionControls}>
            Start Game
          </button>
        ) : null}
      </div>

      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}

      {game.phase === "lobby" ? (
        <>
          <p>Waiting in lobby for players to join.</p>
          <PlayerList players={players} activePlayerId={game.activePlayerId} />
        </>
      ) : null}

      {game.phase === "setup" ? (
        <>
          <p>Setup phase: review your hand and prepare your garden.</p>
          <PlayerList players={players} activePlayerId={game.activePlayerId} />
          {currentPlayer ? <HandPanel hand={currentPlayer.hand} /> : null}
          {currentPlayer ? <GardenTableau slots={currentPlayer.gardenSlots} /> : null}
        </>
      ) : null}

      {game.phase === "active" ? (
        <>
          <p>Active gameplay is in progress.</p>
          <PlayerList players={players} activePlayerId={game.activePlayerId} />
          {currentPlayer ? <HandPanel hand={currentPlayer.hand} /> : null}
          {currentPlayer ? <GardenTableau slots={currentPlayer.gardenSlots} /> : null}
        </>
      ) : null}

      {game.phase === "ended" ? (
        <>
          <p>Game ended. Thanks for playing!</p>
          <PlayerList players={players} activePlayerId={game.activePlayerId} />
        </>
      ) : null}

      {logLoading ? <p>Loading game log...</p> : <GameLog entries={logEntries.map((entry) => entry.message)} />}
    </main>
  );
}
