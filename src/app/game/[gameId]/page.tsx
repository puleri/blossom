"use client";

import { use, useEffect, useMemo, useState } from "react";
import { BIOME_SLOT_INDICES } from "@/lib/game/constants";
import { useRouter } from "next/navigation";
import { GameHeader } from "@/components/game/GameHeader";
import { PlayerList } from "@/components/game/PlayerList";
import { GardenTableau } from "@/components/game/GardenTableau";
import { HandPanel } from "@/components/game/HandPanel";
import { GameLog } from "@/components/game/GameLog";
import { leaveGame, startGameFromLobby } from "@/lib/game/gameService";
import {
  activateDesertBiomeTx,
  activatePlainsBiomeTx,
  activateRainforestBiomeTx,
  sowPlantTx,
  submitSetupKeepTx,
} from "@/lib/game/actions";
import { getPlantCardById, getPlantSummaryLabel } from "@/lib/game/cards/details";
import { getPlantPlayableBiomes } from "@/lib/game/cards/engineProfiles";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useGame } from "@/hooks/useGame";
import { useGameLog } from "@/hooks/useGameLog";
import { useMe } from "@/hooks/useMe";
import { usePlayers } from "@/hooks/usePlayers";
import type { BiomeActivationAnnouncement, BiomeName } from "@/lib/game/types";

interface GamePageProps {
  params: Promise<{ gameId: string }>;
}

export default function GamePage({ params }: GamePageProps) {
  const { gameId } = use(params);
  const router = useRouter();
  const { user } = useAuthUser();
  const { data: game, loading: gameLoading, error: gameError } = useGame(gameId);
  const { data: players, loading: playersLoading, error: playersError } = usePlayers(gameId);
  const { data: me, loading: meLoading, error: meError } = useMe(gameId, user?.uid);
  const { data: logEntries, loading: logLoading, error: logError } = useGameLog(gameId);
  const [error, setError] = useState<string | null>(null);
  const [setupKeptPlantIds, setSetupKeptPlantIds] = useState<string[]>([]);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [dismissedAnnouncementId, setDismissedAnnouncementId] = useState<string | null>(null);
  const loading = gameLoading || playersLoading || meLoading;

  const currentPlayer = useMemo(
    () => players.find((player) => player.id === me?.id) ?? null,
    [players, me?.id]
  );
  const currentHandKey = currentPlayer?.hand.join("|") ?? "";

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

  useEffect(() => {
    if (!currentPlayer) {
      setSetupKeptPlantIds([]);
      return;
    }

    setSetupKeptPlantIds(currentPlayer.hand);
  }, [currentHandKey, currentPlayer]);

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
      await startGameFromLobby(gameId, me.id, user.uid);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Could not start game.");
    }
  }

  function toggleSetupPlant(plantId: string) {
    setSetupKeptPlantIds((previous) => {
      if (previous.includes(plantId)) {
        const next = previous.filter((id) => id !== plantId);
        return next;
      }

      const next = [...previous, plantId];
      return next;
    });
  }

  async function runAction(actionName: string, action: () => Promise<void>) {
    setError(null);
    setBusyAction(actionName);

    try {
      await action();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action failed.");
    } finally {
      setBusyAction(null);
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
      await leaveGame(gameId, me.id, user.uid);
      window.localStorage.removeItem(`blossom:${gameId}:playerId`);
      router.push("/");
    } catch (leaveError) {
      setError(leaveError instanceof Error ? leaveError.message : "Could not leave game.");
    }
  }

  const plantableBiomes = useMemo(() => {
    if (!currentPlayer) {
      return [] as BiomeName[];
    }

    return (Object.keys(BIOME_SLOT_INDICES) as BiomeName[]).filter((biome) => {
      const biomeSlots = BIOME_SLOT_INDICES[biome];
      return biomeSlots.some((index) => {
        const slotState = currentPlayer.gardenSlots[index]?.state;
        return slotState === "empty" || slotState === "withered";
      });
    });
  }, [currentPlayer]);

  const availableBiomesByPlantId = useMemo(() => {
    if (!currentPlayer) {
      return {};
    }

    return Object.fromEntries(
      currentPlayer.hand.map((plantId) => {
        const playableBiomes = new Set(getPlantPlayableBiomes(plantId));
        const compatibleBiomes = plantableBiomes.filter((biome) => playableBiomes.has(biome));
        return [plantId, compatibleBiomes];
      })
    );
  }, [currentPlayer, plantableBiomes]);

  if (loading) {
    return <main>Loading game...</main>;
  }

  if (!game) {
    return <main>Game not found.</main>;
  }

  const isMyTurn = Boolean(me?.id && game.activePlayerId === me.id);
  const disableActionControls = loading || (game.phase === "turns" && !isMyTurn);
  const remainingTurnActions = game.phase === "turns" ? Math.max(0, game.remainingActions ?? 0) : 0;
  const actionsExhausted = game.phase === "turns" && isMyTurn && remainingTurnActions <= 0;

  const isHost = Boolean(me?.id && me.id === game.hostPlayerId);

  const biomeActivationAnnouncement = (game.biomeActivationAnnouncement as BiomeActivationAnnouncement | null | undefined) ?? null;
  const showBiomeActivationModal = Boolean(
    biomeActivationAnnouncement && biomeActivationAnnouncement.id !== dismissedAnnouncementId
  );

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
          <p>Waiting in lobby for players to join (or start now for a solo test run).</p>
          <PlayerList players={players} activePlayerId={game.activePlayerId} />
          <section>
            <h3>Player Gardens</h3>
            <div style={{ display: "grid", gap: 16 }}>
              {players.map((player) => (
                <div key={`garden-${player.id}`}>
                  <h4 style={{ marginBottom: 6 }}>{player.displayName}{player.id === currentPlayer?.id ? " (You)" : ""}</h4>
                  <GardenTableau slots={player.gardenSlots} />
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}

      {game.phase === "setup" ? (
        <>
          <p>Setup phase: keep 0-5 plants.</p>
          <PlayerList players={players} activePlayerId={game.activePlayerId} />
          {currentPlayer ? <HandPanel hand={currentPlayer.hand} /> : null}
          <section>
            <h3>Player Gardens</h3>
            <div style={{ display: "grid", gap: 16 }}>
              {players.map((player) => (
                <div key={`garden-${player.id}`}>
                  <h4 style={{ marginBottom: 6 }}>{player.displayName}{player.id === currentPlayer?.id ? " (You)" : ""}</h4>
                  <GardenTableau slots={player.gardenSlots} />
                </div>
              ))}
            </div>
          </section>

          {currentPlayer && !currentPlayer.keptFromMulligan ? (
            <section>
              <h3>Choose plants to keep</h3>
              <ul>
                {currentPlayer.hand.map((cardId) => (
                  <li key={cardId}>
                    <label>
                      <input
                        type="checkbox"
                        checked={setupKeptPlantIds.includes(cardId)}
                        onChange={() => toggleSetupPlant(cardId)}
                        disabled={Boolean(busyAction)}
                      />
                      {getPlantSummaryLabel(cardId)}
                    </label>
                  </li>
                ))}
              </ul>

              <button
                onClick={() =>
                  runAction("setup-submit", async () => {
                    if (!user?.uid) {
                      throw new Error("Missing authenticated user id.");
                    }

                    await submitSetupKeepTx(gameId, user.uid, setupKeptPlantIds);
                  })
                }
                disabled={Boolean(busyAction)}
              >
                {busyAction === "setup-submit" ? "Submitting..." : "Submit setup"}
              </button>
            </section>
          ) : null}

          {currentPlayer?.keptFromMulligan ? <p>Setup submitted. Waiting for other players.</p> : null}
        </>
      ) : null}

      {game.phase === "turns" ? (
        <>
          <p>Turns phase is in progress.</p>
          <PlayerList players={players} activePlayerId={game.activePlayerId} />
          {currentPlayer ? (
            <HandPanel
              hand={currentPlayer.hand}
              canPlant={isMyTurn && !actionsExhausted}
              busyAction={busyAction}
              availableBiomesByPlantId={availableBiomesByPlantId}
              onPlantFromHand={(plantId, biome) =>
                runAction("sow", async () => {
                  if (!user?.uid) throw new Error("Missing authenticated user id.");
                  if (!getPlantCardById(plantId)) throw new Error("Select a plant to plant.");
                  await sowPlantTx(gameId, user.uid, plantId, biome);
                })
              }
            >
              {isMyTurn ? (
                <>
                  <h3>Your turn actions</h3>
                  <p>Actions remaining: {remainingTurnActions}</p>

                  {actionsExhausted ? <p>No actions left. Your turn will advance automatically.</p> : null}
                  {!actionsExhausted ? <p style={{ marginTop: 8 }}>Hover a card in your hand to plant it in an open biome slot. Available actions: Plant, Activate Desert (To the Sun), Activate Meadow (Pollinate), Activate Understory (Root), Well, Draw, Pass.</p> : null}

                  {!actionsExhausted && plantableBiomes.length === 0 ? <p>All biome rows are full. You cannot plant until a slot opens up.</p> : null}

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      onClick={() =>
                        runAction("activate-desert", async () => {
                          if (!user?.uid) throw new Error("Missing authenticated user id.");
                          await activateDesertBiomeTx(gameId, user.uid);
                        })
                      }
                      disabled={Boolean(busyAction) || actionsExhausted}
                    >
                      {busyAction === "activate-desert" ? "Activating..." : "Activate Desert biome"}
                    </button>

                    <button
                      onClick={() =>
                        runAction("activate-plains", async () => {
                          if (!user?.uid) throw new Error("Missing authenticated user id.");
                          await activatePlainsBiomeTx(gameId, user.uid);
                        })
                      }
                      disabled={Boolean(busyAction) || actionsExhausted}
                    >
                      {busyAction === "activate-plains" ? "Activating..." : "Activate Meadow biome"}
                    </button>

                    <button
                      onClick={() =>
                        runAction("activate-rainforest", async () => {
                          if (!user?.uid) throw new Error("Missing authenticated user id.");
                          await activateRainforestBiomeTx(gameId, user.uid);
                        })
                      }
                      disabled={Boolean(busyAction) || actionsExhausted}
                    >
                      {busyAction === "activate-rainforest" ? "Activating..." : "Activate Understory biome"}
                    </button>

                  </div>
                </>
              ) : (
                <p>Waiting for the active player to act.</p>
              )}
            </HandPanel>
          ) : null}
          <section>
            <h3>Player Gardens</h3>
            <div style={{ display: "grid", gap: 16 }}>
              {players.map((player) => (
                <div key={`garden-${player.id}`}>
                  <h4 style={{ marginBottom: 6 }}>{player.displayName}{player.id === currentPlayer?.id ? " (You)" : ""}</h4>
                  <GardenTableau slots={player.gardenSlots} />
                </div>
              ))}
            </div>
          </section>


        </>
      ) : null}

      
      
      {game.phase === "ended" ? (
        <>
          <p>Game ended. Thanks for playing!</p>
          <PlayerList players={players} activePlayerId={game.activePlayerId} />
          <section>
            <h3>Player Gardens</h3>
            <div style={{ display: "grid", gap: 16 }}>
              {players.map((player) => (
                <div key={`garden-${player.id}`}>
                  <h4 style={{ marginBottom: 6 }}>{player.displayName}{player.id === currentPlayer?.id ? " (You)" : ""}</h4>
                  <GardenTableau slots={player.gardenSlots} />
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}


      {showBiomeActivationModal && biomeActivationAnnouncement ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 1000
          }}
        >
          <div style={{ background: "white", padding: 16, borderRadius: 8, maxWidth: 560, width: "100%" }}>
            <h3 style={{ marginTop: 0 }}>Biome activation resolved</h3>
            <p>
              {players.find((player) => player.id === biomeActivationAnnouncement.playerId)?.displayName ?? "A player"} activated
              {` ${biomeActivationAnnouncement.biome}.`}
            </p>
            <ul>
              {biomeActivationAnnouncement.messages.map((message, index) => (
                <li key={`${biomeActivationAnnouncement.id}-${index}`}>{message}</li>
              ))}
            </ul>
            <button onClick={() => setDismissedAnnouncementId(biomeActivationAnnouncement.id)}>Close</button>
          </div>
        </div>
      ) : null}

      {logLoading ? <p>Loading game log...</p> : <GameLog entries={logEntries.map((entry) => entry.message)} />}
    </main>
  );
}
