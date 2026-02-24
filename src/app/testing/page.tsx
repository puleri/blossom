import { GameHeader } from "@/components/game/GameHeader";
import { GameLog } from "@/components/game/GameLog";
import { GardenTableau } from "@/components/game/GardenTableau";
import { HandPanel } from "@/components/game/HandPanel";
import { PlayerList } from "@/components/game/PlayerList";
import { GAME_TEST_DATA } from "@/lib/testing/gameTestData";

export default function TestingPage() {
  const currentPlayer = GAME_TEST_DATA.players.find(
    (player) => player.id === GAME_TEST_DATA.mePlayerId
  );

  return (
    <main>
      <h1>Static Testing Page</h1>
      <p>This page renders game UI using local static test data.</p>

      <GameHeader game={GAME_TEST_DATA.game} playerCount={GAME_TEST_DATA.players.length} />
      <PlayerList
        players={GAME_TEST_DATA.players}
        activePlayerId={GAME_TEST_DATA.game.activePlayerId}
      />
      {currentPlayer ? <HandPanel hand={currentPlayer.hand} /> : null}
      {currentPlayer ? <GardenTableau slots={currentPlayer.gardenSlots} /> : null}
      <GameLog entries={GAME_TEST_DATA.logEntries} />
    </main>
  );
}
