"use client";

import { useEffect, useMemo, useState } from "react";
import { GameHeader } from "@/components/game/GameHeader";
import { GameLog } from "@/components/game/GameLog";
import { GardenTableau } from "@/components/game/GardenTableau";
import { HandPanel } from "@/components/game/HandPanel";
import { PlayerList } from "@/components/game/PlayerList";
import { PLANT_CARDS } from "@/lib/game/cards/plants";
import { getCardsByBiome, getPlantEngineProfile } from "@/lib/game/cards/engineProfiles";
import { getPlantFlavorText } from "@/lib/game/cards/details";
import { drawFromDeck } from "@/lib/game/decks";
import {
  applyAdjacentPairBonuses,
  applyPlantDecayAndDeaths,
  computePlayerScore,
  resolveRoundEndUpkeepStartAbilities
} from "@/lib/game/engine";
import { GAME_TEST_DATA } from "@/lib/testing/gameTestData";
import type { PlayerDoc } from "@/lib/game/types";

export default function TestingPage() {
  const [game, setGame] = useState(() => ({ ...GAME_TEST_DATA.game }));
  const [players, setPlayers] = useState(() => GAME_TEST_DATA.players.map((player) => ({ ...player })));
  const [logEntries, setLogEntries] = useState(() => [...GAME_TEST_DATA.logEntries]);
  const [selectedPlantId, setSelectedPlantId] = useState("");
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const currentPlayer = useMemo(
    () => players.find((player) => player.id === GAME_TEST_DATA.mePlayerId) ?? null,
    [players]
  );
  const isMyTurn = Boolean(currentPlayer && game.phase === "turns" && game.activePlayerId === currentPlayer.id);
  const isHost = Boolean(currentPlayer && currentPlayer.id === game.hostPlayerId);
  const currentPlant = PLANT_CARDS.find((plant) => plant.id === selectedPlantId) ?? null;

  const cardsByBiome = useMemo(() => getCardsByBiome(), []);

  useEffect(() => {
    if (!currentPlayer) {
      setSelectedPlantId("");
      return;
    }

    setSelectedPlantId((previous) => {
      if (previous && currentPlayer.hand.includes(previous)) {
        return previous;
      }

      return currentPlayer.hand[0] ?? "";
    });
  }, [currentPlayer]);

  function addLog(message: string) {
    setLogEntries((previous) => [...previous, message]);
  }

  function runAction(action: () => void) {
    setError(null);

    try {
      action();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action failed.");
    }
  }

  function requireCurrentPlayer() {
    if (!currentPlayer) {
      throw new Error("No local player configured for testing.");
    }

    return currentPlayer;
  }

  function requireTurnsPhase() {
    if (game.phase !== "turns") {
      throw new Error("This action is only available during turns phase.");
    }

    const me = requireCurrentPlayer();
    if (game.activePlayerId !== me.id) {
      throw new Error("Only the active player can perform turn actions.");
    }

    return me;
  }

  function handleSow() {
    runAction(() => {
      const me = requireTurnsPhase();
      if (!selectedPlantId) {
        throw new Error("Select a plant to sow.");
      }

      const meIndex = players.findIndex((player) => player.id === me.id);
      if (meIndex < 0) {
        throw new Error("Current player not found.");
      }

      const plant = PLANT_CARDS.find((card) => card.id === selectedPlantId);
      if (!plant) {
        throw new Error("Plant card definition not found.");
      }

      if (!players[meIndex].hand.includes(selectedPlantId)) {
        throw new Error("Plant is not in hand.");
      }

      if (selectedSlot < 0 || selectedSlot >= players[meIndex].gardenSlots.length) {
        throw new Error("Invalid garden slot.");
      }

      if (players[meIndex].gardenSlots[selectedSlot].state !== "empty") {
        throw new Error("Selected garden slot is not empty.");
      }


      setPlayers((previous) => {
        const next = [...previous];
        const updated = { ...next[meIndex] };
        const nextSlots = [...updated.gardenSlots];
        nextSlots[selectedSlot] = {
          ...nextSlots[selectedSlot],
          state: "grown",
          plantId: plant.id
        };
        updated.gardenSlots = nextSlots;
        updated.hand = updated.hand.filter((cardId) => cardId !== selectedPlantId);
        next[meIndex] = updated;
        return next;
      });

      addLog(`${me.displayName} sowed ${plant.name} in slot ${selectedSlot + 1}.`);
    });
  }

  function handleWell() {
    runAction(() => {
      const me = requireTurnsPhase();
      setPlayers((previous) =>
        previous.map((player) => {
          if (player.id !== me.id) return player;

          return {
            ...player,
            gardenSlots: player.gardenSlots,
            resources: {
              ...player.resources,
              water: player.resources.water + 2
            }
          };
        })
      );

      addLog(`${me.displayName} went to the well and gained 2 water.`);
    });
  }

  function handleDrawPlant() {
    runAction(() => {
      const me = requireTurnsPhase();
      const draw = drawFromDeck(game.plantDeck, 1);
      if (draw.drawn.length !== 1) {
        throw new Error("Plant deck is empty.");
      }

      const drawnCardId = draw.drawn[0];
      setPlayers((previous) =>
        previous.map((player) =>
          player.id === me.id
            ? {
                ...player,
                hand: [...player.hand, drawnCardId]
              }
            : player
        )
      );
      setGame((previous) => ({ ...previous, plantDeck: draw.remainingDeck }));
      addLog(`${me.displayName} drew a plant card (${drawnCardId}).`);
    });
  }

  function handlePassTurn() {
    runAction(() => {
      const me = requireTurnsPhase();
      const order = game.playerOrder;
      if (!order.length) {
        throw new Error("Turn order is empty.");
      }

      if (order[game.turnIndex] !== me.id) {
        throw new Error("Turn order is out of sync.");
      }

      const nextIndex = game.turnIndex + 1;
      const wrapped = nextIndex >= order.length;

      if (!wrapped) {
        setGame((previous) => ({ ...previous, activePlayerId: order[nextIndex], turnIndex: nextIndex }));
        addLog(`${me.displayName} ended their turn.`);
        return;
      }

      const updatedPlayersAfterRound = players.map((player) => {
        const afterDecay = applyPlantDecayAndDeaths(player);
        const afterAdjacentBonuses = applyAdjacentPairBonuses(afterDecay);

        return {
          ...afterAdjacentBonuses,
          resources: {
            ...afterAdjacentBonuses.resources,
            water: afterAdjacentBonuses.resources.water + 1
          }
        };
      });

      const nextRound = game.round + 1;
      const isGameOver = nextRound > game.roundsTotal;

      setPlayers(
        updatedPlayersAfterRound.map((player) => ({
          ...player,
          score: isGameOver ? computePlayerScore(player) : player.score
        }))
      );

      if (isGameOver) {
        setGame((previous) => ({
          ...previous,
          phase: "ended",
          status: "ended",
          activePlayerId: null,
          turnIndex: 0,
          lastPhaseResolvedRound: previous.round
        }));
        addLog(`Round ${game.round} resolved. Game ended.`);
        return;
      }

      setGame((previous) => ({
        ...previous,
        activePlayerId: order[0],
        turnIndex: 0,
        round: nextRound,
        lastPhaseResolvedRound: previous.round
      }));
      addLog(`Round ${game.round} resolved. Round ${nextRound} turns begin.`);
    });
  }

  return (
    <main>
      <h1>Interactive Testing Page</h1>
      <p>Local-only simulation for turn flow and action pacing without backend setup.</p>

      <GameHeader game={game} playerCount={players.length} />
      <PlayerList players={players} activePlayerId={game.activePlayerId} />

      <section>
        <h2>Plant card library (Wingspan-style lanes)</h2>
        <p>Desert is the growth axis (To the Sun), Meadow is the draw axis (Pollinate), and Understory is the resource axis (Root).</p>
        <div style={{ display: "grid", gap: 12 }}>
          {(["desert", "plains", "rainforest"] as const).map((biome) => (
            <article key={biome === "plains" ? "meadow" : biome === "rainforest" ? "understory" : biome} style={{ border: "1px solid #d1d5db", borderRadius: 10, padding: 12, background: "#ffffff" }}>
              <h3 style={{ margin: 0, color: "#111827", textTransform: "capitalize" }}>{biome === "plains" ? "meadow" : biome === "rainforest" ? "understory" : biome}</h3>
              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                {cardsByBiome[biome].map((card) => {
                  const profile = getPlantEngineProfile(card.id);
                  if (!profile) return null;

                  return (
                    <div key={card.id} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 8, color: "#1f2937" }}>
                      <strong>{card.name}</strong> · Level {profile.level} · Sun cost {profile.sunCost}
                      <p style={{ margin: "4px 0 0", fontSize: 13 }}>{profile.engineSummary}</p>
                      <p style={{ margin: "4px 0 0", fontSize: 12, fontStyle: "italic", color: "#4b5563" }}>“{getPlantFlavorText(card.id)}”</p>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      </section>

      {currentPlayer ? <HandPanel hand={currentPlayer.hand} /> : null}
      {currentPlayer ? <GardenTableau slots={currentPlayer.gardenSlots} /> : null}

      {game.phase === "turns" && currentPlayer ? (
        isMyTurn ? (
          <section>
            <h3>Your turn actions</h3>
            <label>
              Plant from hand
              <select value={selectedPlantId} onChange={(event) => setSelectedPlantId(event.target.value)}>
                {currentPlayer.hand.map((plantId) => (
                  <option key={plantId} value={plantId}>
                    {plantId}
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

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={handleSow}
                disabled={
                  !selectedPlantId || !currentPlant
                }
              >
                Sow
              </button>

              <button onClick={handleWell}>Go to the well (water all seeds + gain 2 water)</button>

              <button onClick={handleDrawPlant}>Draw a plant card</button>

              <button onClick={handlePassTurn}>Pass turn</button>
            </div>
          </section>
        ) : (
          <p>Waiting for the active player to act.</p>
        )
      ) : null}

      {game.phase === "ended" ? <p>Game ended. Final scores locked.</p> : null}

      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
      <GameLog entries={logEntries} />
    </main>
  );
}
