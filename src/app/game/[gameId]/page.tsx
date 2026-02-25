"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GameHeader } from "@/components/game/GameHeader";
import { PlayerList } from "@/components/game/PlayerList";
import { GardenTableau } from "@/components/game/GardenTableau";
import { HandPanel } from "@/components/game/HandPanel";
import { GameLog } from "@/components/game/GameLog";
import { leaveGame, startGameFromLobby } from "@/lib/game/gameService";
import {
  compostWitheredTx,
  drawPlantCardTx,
  forceBloomTx,
  gambleBloomTx,
  goToWellTx,
  harvestNowTx,
  passTurnTx,
  resolveRoundUpkeepTx,
  sowPlantTx,
  submitSetupKeepTx,
  tradeWaterForSeedsTx
} from "@/lib/game/actions";
import { EVENT_CARDS } from "@/lib/game/cards/events";
import { getPlantCardById, getPlantSummaryLabel } from "@/lib/game/cards/details";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useGame } from "@/hooks/useGame";
import { useGameLog } from "@/hooks/useGameLog";
import { useMe } from "@/hooks/useMe";
import { usePlayers } from "@/hooks/usePlayers";
import type { ResourceKey } from "@/lib/game/types";

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
  const [setupDiscardedResources, setSetupDiscardedResources] = useState<ResourceKey[]>([]);
  const [selectedPlantId, setSelectedPlantId] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<number>(0);
  const [selectedWitheredSlot, setSelectedWitheredSlot] = useState<number>(0);
  const [busyAction, setBusyAction] = useState<string | null>(null);
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
      setSetupDiscardedResources([]);
      setSelectedPlantId("");
      setSelectedWitheredSlot(0);
      return;
    }

    setSetupKeptPlantIds(currentPlayer.hand);
    setSelectedPlantId((previous) => {
      if (previous && currentPlayer.hand.includes(previous)) {
        return previous;
      }

      return currentPlayer.hand[0] ?? "";
    });
  }, [currentHandKey, currentPlayer]);

  useEffect(() => {
    setSetupDiscardedResources((previous) => {
      if (previous.length === setupKeptPlantIds.length) {
        return previous;
      }

      return setupKeptPlantIds.map((_, index) => previous[index] ?? (index < 3 ? "water" : "seeds"));
    });
  }, [setupKeptPlantIds]);


  useEffect(() => {
    if (!currentPlayer) {
      return;
    }

    const firstWitheredIndex = currentPlayer.gardenSlots.findIndex((slot) => slot.state === "withered");
    setSelectedWitheredSlot(firstWitheredIndex >= 0 ? firstWitheredIndex : 0);
  }, [currentPlayer]);
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
      await startGameFromLobby(gameId, me.id, user.uid);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Could not start game.");
    }
  }

  function toggleSetupPlant(plantId: string) {
    setSetupKeptPlantIds((previous) => {
      if (previous.includes(plantId)) {
        const next = previous.filter((id) => id !== plantId);
        setSetupDiscardedResources((resources) => resources.slice(0, next.length));
        return next;
      }

      const next = [...previous, plantId];
      setSetupDiscardedResources((resources) => [...resources, "water" as ResourceKey].slice(0, next.length));
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

  const isMyTurn = Boolean(me?.id && game.activePlayerId === me.id);
  const disableActionControls = loading || (game.phase === "turns" && !isMyTurn);
  const remainingTurnActions = game.phase === "turns" ? Math.max(0, game.remainingActions ?? 0) : 0;
  const actionsExhausted = game.phase === "turns" && isMyTurn && remainingTurnActions <= 0;

  const currentPlant = getPlantCardById(selectedPlantId);
  const currentEvent = EVENT_CARDS.find((event) => event.id === game.currentEventId) ?? null;
  const isHost = Boolean(me?.id && me.id === game.hostPlayerId);

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
          <p>Setup phase: keep 0-5 plants. Discard one resource per kept plant.</p>
          <PlayerList players={players} activePlayerId={game.activePlayerId} />
          {currentPlayer ? <HandPanel hand={currentPlayer.hand} /> : null}
          {currentPlayer ? <GardenTableau slots={currentPlayer.gardenSlots} /> : null}

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

              <h3>Discard resources ({setupKeptPlantIds.length} required)</h3>
              {setupDiscardedResources.map((resource, index) => (
                <label key={`discard-${index}`} style={{ display: "block" }}>
                  Discard #{index + 1}
                  <select
                    value={resource}
                    onChange={(event) => {
                      const value = event.target.value as ResourceKey;
                      setSetupDiscardedResources((previous) =>
                        previous.map((existing, resourceIndex) => (resourceIndex === index ? value : existing))
                      );
                    }}
                    disabled={Boolean(busyAction)}
                  >
                    <option value="water">Water</option>
                    <option value="seeds">Seed</option>
                  </select>
                </label>
              ))}

              <button
                onClick={() =>
                  runAction("setup-submit", async () => {
                    if (!user?.uid) {
                      throw new Error("Missing authenticated user id.");
                    }

                    await submitSetupKeepTx(gameId, user.uid, setupKeptPlantIds, setupDiscardedResources);
                  })
                }
                disabled={Boolean(busyAction) || setupDiscardedResources.length !== setupKeptPlantIds.length}
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
          <p>Turns phase is in progress. Upkeep now generates buds first; buds can be harvested now (safe, lower yield) or held to force bloom into flowers later (higher upside, but exposed to risks/events).</p>
          {currentEvent ? (
            <p>
              Round event in play: <strong>{currentEvent.name}</strong> — {currentEvent.description} (resolves at round end)
            </p>
          ) : null}
          <PlayerList players={players} activePlayerId={game.activePlayerId} />
          {currentPlayer ? <HandPanel hand={currentPlayer.hand} /> : null}
          {currentPlayer ? <GardenTableau slots={currentPlayer.gardenSlots} /> : null}

          {isMyTurn && currentPlayer ? (
            <section>
              <h3>Your turn actions</h3>
              <p>Actions remaining: {remainingTurnActions}</p>
              <label>
                Plant from hand
                <select value={selectedPlantId} onChange={(event) => setSelectedPlantId(event.target.value)}>
                  {currentPlayer.hand.map((plantId) => (
                    <option key={plantId} value={plantId}>
                      {getPlantSummaryLabel(plantId)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Slot
                <select value={selectedSlot} onChange={(event) => setSelectedSlot(Number(event.target.value))}>
                  {currentPlayer.gardenSlots.map((_, index) => (
                    <option key={`slot-${index}`} value={index}>
                      Slot {index + 1}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Withered slot for compost (risky)
                <select value={selectedWitheredSlot} onChange={(event) => setSelectedWitheredSlot(Number(event.target.value))}>
                  {currentPlayer.gardenSlots.map((slot, index) => (
                    <option key={`withered-slot-${index}`} value={index} disabled={slot.state !== "withered"}>
                      Slot {index + 1} {slot.state === "withered" ? "(withered)" : ""}
                    </option>
                  ))}
                </select>
              </label>

              {actionsExhausted ? <p>No actions left. Your turn will advance automatically.</p> : null}
              {!actionsExhausted ? <p style={{ marginTop: 8 }}>Safe actions: Well, Draw, Harvest Now, Pass. Risky actions: Trade Water for Seeds, Compost Withered, Gamble Bloom, Force Bloom.</p> : null}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={() =>
                    runAction("sow", async () => {
                      if (!user?.uid) throw new Error("Missing authenticated user id.");
                      if (!selectedPlantId) throw new Error("Select a plant to sow.");
                      await sowPlantTx(gameId, user.uid, selectedPlantId, selectedSlot);
                    })
                  }
                  disabled={
                    Boolean(busyAction) ||
                    actionsExhausted ||
                    !selectedPlantId ||
                    !currentPlant ||
                    currentPlayer.resources.seeds < currentPlant.seedCost
                  }
                >
                  {busyAction === "sow" ? "Sowing..." : "Sow"}
                </button>

                <button
                  onClick={() =>
                    runAction("well", async () => {
                      if (!user?.uid) throw new Error("Missing authenticated user id.");
                      await goToWellTx(gameId, user.uid);
                    })
                  }
                  disabled={Boolean(busyAction) || actionsExhausted}
                >
                  {busyAction === "well" ? "Visiting well..." : "Go to the well (water all seeds + gain 2 water)"}
                </button>

                <button
                  onClick={() =>
                    runAction("draw-plant", async () => {
                      if (!user?.uid) throw new Error("Missing authenticated user id.");
                      await drawPlantCardTx(gameId, user.uid);
                    })
                  }
                  disabled={Boolean(busyAction) || actionsExhausted}
                >
                  {busyAction === "draw-plant" ? "Drawing..." : "Draw a plant card"}
                </button>

                <button
                  onClick={() =>
                    runAction("trade-water-seeds", async () => {
                      if (!user?.uid) throw new Error("Missing authenticated user id.");
                      await tradeWaterForSeedsTx(gameId, user.uid);
                    })
                  }
                  disabled={Boolean(busyAction) || actionsExhausted || currentPlayer.resources.water < 2}
                  title="Risky: spend 2 water to gain 1-2 seeds depending on event pressure."
                >
                  {busyAction === "trade-water-seeds" ? "Trading..." : "Trade 2 water for seeds (risky)"}
                </button>

                <button
                  onClick={() =>
                    runAction("compost", async () => {
                      if (!user?.uid) throw new Error("Missing authenticated user id.");
                      await compostWitheredTx(gameId, user.uid, selectedWitheredSlot);
                    })
                  }
                  disabled={
                    Boolean(busyAction) ||
                    actionsExhausted ||
                    !currentPlayer.gardenSlots.some((slot) => slot.state === "withered")
                  }
                  title="Risky: consume a withered slot for growth resources, but compost can attract bugs."
                >
                  {busyAction === "compost" ? "Composting..." : "Compost withered slot (risky)"}
                </button>

                <button
                  onClick={() =>
                    runAction("gamble-bloom", async () => {
                      if (!user?.uid) throw new Error("Missing authenticated user id.");
                      await gambleBloomTx(gameId, user.uid);
                    })
                  }
                  disabled={Boolean(busyAction) || actionsExhausted || currentPlayer.resources.water < 2}
                  title="Risky: spend 2 water and roll for flowers; low rolls add bugs."
                >
                  {busyAction === "gamble-bloom" ? "Gambling..." : "Gamble bloom (risky)"}
                </button>

                <button
                  onClick={() =>
                    runAction("harvest-now", async () => {
                      if (!user?.uid) throw new Error("Missing authenticated user id.");
                      await harvestNowTx(gameId, user.uid);
                    })
                  }
                  disabled={Boolean(busyAction) || actionsExhausted || currentPlayer.resources.buds < 1}
                  title="Safe: convert buds directly into points now at lower efficiency."
                >
                  {busyAction === "harvest-now" ? "Harvesting..." : "Harvest buds now (safe)"}
                </button>

                <button
                  onClick={() =>
                    runAction("force-bloom", async () => {
                      if (!user?.uid) throw new Error("Missing authenticated user id.");
                      await forceBloomTx(gameId, user.uid);
                    })
                  }
                  disabled={Boolean(busyAction) || actionsExhausted || currentPlayer.resources.buds < 1}
                  title="Risky: convert buds into flowers, but may lose water, gain bugs, or fail a wither check."
                >
                  {busyAction === "force-bloom" ? "Forcing bloom..." : "Force bloom (risky hold payoff)"}
                </button>

                <button
                  onClick={() =>
                    runAction("pass", async () => {
                      if (!user?.uid) throw new Error("Missing authenticated user id.");
                      await passTurnTx(gameId, user.uid);
                    })
                  }
                  disabled={Boolean(busyAction) || actionsExhausted}
                >
                  {busyAction === "pass" ? "Passing..." : "Pass turn / hold buds"}
                </button>
              </div>
            </section>
          ) : (
            <p>Waiting for the active player to act.</p>
          )}
        </>
      ) : null}

      
      {game.phase === "upkeep" ? (
        <>
          <p>Upkeep phase: waiting for host resolution.</p>
          {currentEvent ? (
            <p>
              Event waiting to resolve: <strong>{currentEvent.name}</strong> — {currentEvent.description}
            </p>
          ) : null}
          <PlayerList players={players} activePlayerId={game.activePlayerId} />
          {isHost ? (
            <button
              onClick={() =>
                runAction("resolve-upkeep", async () => {
                  if (!user?.uid) {
                    throw new Error("Missing authenticated user id.");
                  }

                  await resolveRoundUpkeepTx(gameId, user.uid);
                })
              }
              disabled={Boolean(busyAction)}
            >
              {busyAction === "resolve-upkeep" ? "Resolving..." : "Resolve Upkeep"}
            </button>
          ) : null}
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
