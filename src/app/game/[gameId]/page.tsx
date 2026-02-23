"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GameHeader } from "@/components/game/GameHeader";
import { PlayerList } from "@/components/game/PlayerList";
import { GardenTableau } from "@/components/game/GardenTableau";
import { HandPanel } from "@/components/game/HandPanel";
import { GameLog } from "@/components/game/GameLog";
import { leaveGame, startGameFromLobby } from "@/lib/game/gameService";
import { useGame, usePlayers } from "@/lib/game/hooks";

interface GamePageProps {
  params: { gameId: string };
}

export default function GamePage({ params }: GamePageProps) {
  const router = useRouter();
  const { game, loading: gameLoading } = useGame(params.gameId);
  const { players, loading: playersLoading } = usePlayers(params.gameId);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCurrentPlayerId(window.localStorage.getItem(`blossom:${params.gameId}:playerId`));
  }, [params.gameId]);

  const currentPlayer = useMemo(
    () => players.find((player) => player.id === currentPlayerId) ?? null,
    [players, currentPlayerId]
  );

  if (gameLoading || playersLoading) {
    return <main>Loading game...</main>;
  }

  if (!game) {
    return <main>Game not found.</main>;
  }

  async function handleStartGame() {
    if (!currentPlayerId) {
      setError("Missing local player ID. Rejoin from home.");
      return;
    }

    try {
      await startGameFromLobby(params.gameId, currentPlayerId);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Could not start game.");
    }
  }

  async function handleLeaveGame() {
    if (!currentPlayerId) {
      router.push("/");
      return;
    }

    await leaveGame(params.gameId, currentPlayerId);
    window.localStorage.removeItem(`blossom:${params.gameId}:playerId`);
    router.push("/");
  }

  return (
    <main>
      <GameHeader game={game} playerCount={players.length} />

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={handleLeaveGame}>Leave Game</button>
        {game.phase === "lobby" && currentPlayerId === game.hostPlayerId ? (
          <button onClick={handleStartGame}>Start Game</button>
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

      <GameLog entries={game.log ?? []} />
    </main>
  );
}
