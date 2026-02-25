"use client";

import { useEffect, useMemo, useState } from "react";
import { GameHeader } from "@/components/game/GameHeader";
import { GameLog } from "@/components/game/GameLog";
import { GardenTableau } from "@/components/game/GardenTableau";
import { HandPanel } from "@/components/game/HandPanel";
import { PlayerList } from "@/components/game/PlayerList";
import { EVENT_CARDS } from "@/lib/game/cards/events";
import { PLANT_CARDS } from "@/lib/game/cards/plants";
import { drawFromDeck, revealNextEvent } from "@/lib/game/decks";
import {
  applyAdjacentPairBonuses,
  applyEventToPlayers,
  applyEventToPlayersWithReactions,
  applyPlantDecayAndDeaths,
  collectBudTokens,
  computePlayerScore,
  resolveRoundEndUpkeepStartAbilities
} from "@/lib/game/engine";
import { GAME_TEST_DATA } from "@/lib/testing/gameTestData";

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
  const currentEvent = EVENT_CARDS.find((event) => event.id === game.currentEventId) ?? null;

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

      if (players[meIndex].resources.seeds < plant.seedCost) {
        throw new Error("Not enough seeds to sow this plant.");
      }

      setPlayers((previous) => {
        const next = [...previous];
        const updated = { ...next[meIndex] };
        const nextSlots = [...updated.gardenSlots];
        nextSlots[selectedSlot] = { state: "seedling", plantId: plant.id };
        updated.gardenSlots = nextSlots;
        updated.hand = updated.hand.filter((cardId) => cardId !== selectedPlantId);
        updated.resources = { ...updated.resources, seeds: updated.resources.seeds - plant.seedCost };
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
            gardenSlots: player.gardenSlots.map((slot) => (slot.state === "seedling" ? { ...slot, state: "grown" } : slot)),
            resources: {
              ...player.resources,
              water: player.resources.water + 2
            }
          };
        })
      );

      addLog(`${me.displayName} went to the well, watered all seeds, and gained 2 water.`);
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

      setGame((previous) =>
        wrapped
          ? { ...previous, phase: "upkeep", activePlayerId: null, turnIndex: 0 }
          : { ...previous, activePlayerId: order[nextIndex], turnIndex: nextIndex }
      );

      addLog(wrapped ? `Round ${game.round} turns complete. Entering upkeep.` : `${me.displayName} ended their turn.`);
    });
  }

  function handleResolveUpkeep() {
    runAction(() => {
      requireCurrentPlayer();
      if (game.phase !== "upkeep") {
        throw new Error("Round upkeep can only be resolved during upkeep phase.");
      }

      if (!isHost) {
        throw new Error("Only the host can resolve upkeep.");
      }

      const updatedPlayersAfterUpkeep = players.map((player) => {
        const afterDecay = applyPlantDecayAndDeaths(player);
        const afterAdjacentBonuses = applyAdjacentPairBonuses(afterDecay);
        const afterBudCollection = collectBudTokens(afterAdjacentBonuses);

        return {
          ...afterBudCollection,
          resources: {
            ...afterBudCollection.resources,
            water: afterBudCollection.resources.water + 1
          }
        };
      });

      const nextPlayers = currentEvent ? applyEventToPlayers(updatedPlayersAfterUpkeep, currentEvent) : updatedPlayersAfterUpkeep;
      const nextRound = game.round + 1;
      const isGameOver = nextRound > game.roundsTotal;

      setPlayers(
        nextPlayers.map((player) => ({
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
        addLog(`Round ${game.round} upkeep and event resolved. Game ended.`);
        return;
      }

      const reveal = revealNextEvent(game.eventDeck);
      if (!reveal.event) {
        throw new Error("No events remaining in the event deck.");
      }

      setGame((previous) => ({
        ...previous,
        phase: "turns",
        round: nextRound,
        activePlayerId: previous.playerOrder[0] ?? null,
        turnIndex: 0,
        currentEventId: reveal.event?.id ?? null,
        eventDeck: reveal.remainingDeck,
        lastPhaseResolvedRound: previous.round
      }));

      addLog(`Round ${game.round} upkeep resolved, then event resolved. Round ${nextRound} turns begin.`);
      addLog(`Round ${nextRound} event drawn: ${reveal.event.name}. It resolves at round end.`);
    });
  }


  const pestBalanceSnapshots = useMemo(() => {
    const baseline = {
      ...GAME_TEST_DATA.players[0],
      resources: { ...GAME_TEST_DATA.players[0].resources, flowers: 3, bugs: 2 }
    };

    const flytrapPlayer = {
      ...GAME_TEST_DATA.players[0],
      resources: { ...GAME_TEST_DATA.players[0].resources, seeds: 1, bugs: 1 },
      gardenSlots: [
        { state: "grown", plantId: "venus-flytrap", water: 2 },
        { state: "empty", plantId: null, water: 0 },
        { state: "empty", plantId: null, water: 0 },
        { state: "empty", plantId: null, water: 0 },
        { state: "empty", plantId: null, water: 0 }
      ]
    };

    const pitcherPlayer = {
      ...GAME_TEST_DATA.players[0],
      resources: { ...GAME_TEST_DATA.players[0].resources, seeds: 1, flowers: 0, bugs: 3 },
      gardenSlots: [
        { state: "grown", plantId: "pitcher-plant", water: 2 },
        { state: "empty", plantId: null, water: 0 },
        { state: "empty", plantId: null, water: 0 },
        { state: "empty", plantId: null, water: 0 },
        { state: "empty", plantId: null, water: 0 }
      ]
    };

    const infestation = EVENT_CARDS.find((event) => event.id === "infestation");
    if (!infestation) return [];

    const baselineAfterEvent = applyEventToPlayers([baseline], infestation)[0];
    const flytrapAfterReaction = applyEventToPlayersWithReactions([flytrapPlayer], infestation).players[0];
    const pitcherAfterHunt = resolveRoundEndUpkeepStartAbilities([pitcherPlayer])[0].player;

    return [
      {
        label: "No pest counterplay",
        before: baseline.resources,
        after: baselineAfterEvent.resources,
        scorePreview: computePlayerScore(baselineAfterEvent)
      },
      {
        label: "Venus Flytrap reaction vs infestation",
        before: flytrapPlayer.resources,
        after: flytrapAfterReaction.resources,
        scorePreview: computePlayerScore(flytrapAfterReaction)
      },
      {
        label: "Pitcher Plant converts pests at round end",
        before: pitcherPlayer.resources,
        after: pitcherAfterHunt.resources,
        scorePreview: computePlayerScore(pitcherAfterHunt)
      }
    ];
  }, []);

  return (
    <main>
      <h1>Interactive Testing Page</h1>
      <p>Local-only simulation for turn flow and action pacing without backend setup.</p>

      <GameHeader game={game} playerCount={players.length} />
      <PlayerList players={players} activePlayerId={game.activePlayerId} />

      {currentEvent ? (
        <p>
          Round event in play: <strong>{currentEvent.name}</strong> — {currentEvent.description}
        </p>
      ) : null}

      <section>
        <h2>Pest balance snapshots</h2>
        <p>Representative board states for validating that bugs are a penalty unless countered by pest-synergy plants.</p>
        <ul>
          {pestBalanceSnapshots.map((snapshot) => (
            <li key={snapshot.label}>
              <strong>{snapshot.label}</strong>: before (Seeds {snapshot.before.seeds}, Flowers {snapshot.before.flowers}, Bugs {snapshot.before.bugs}) → after (Seeds {snapshot.after.seeds}, Flowers {snapshot.after.flowers}, Bugs {snapshot.after.bugs}), score preview {snapshot.scorePreview}.
            </li>
          ))}
        </ul>
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
                  !selectedPlantId || !currentPlant || currentPlayer.resources.seeds < currentPlant.seedCost
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

      {game.phase === "upkeep" ? (
        <section>
          <h3>Upkeep phase</h3>
          {isHost ? <button onClick={handleResolveUpkeep}>Resolve Upkeep</button> : <p>Waiting for host resolution.</p>}
        </section>
      ) : null}

      {game.phase === "ended" ? <p>Game ended. Final scores locked.</p> : null}

      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
      <GameLog entries={logEntries} />
    </main>
  );
}
