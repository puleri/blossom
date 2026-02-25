import type { PlayerDoc } from "@/lib/game/types";

interface PlayerListProps {
  players: PlayerDoc[];
  activePlayerId: string | null;
}

export function PlayerList({ players, activePlayerId }: PlayerListProps) {
  return (
    <section>
      <h2>Players</h2>
      <p title="Final score = plant points + flowers - bugs (bug penalty capped at 6).">
        Score tooltip: Bugs now reduce score unless cards/events remove or convert them.
      </p>
      <ul>
        {players.map((player) => (
          <li key={player.id}>
            {player.displayName}
            {player.isHost ? " (Host)" : ""}
            {player.id === activePlayerId ? " • Active" : ""} — Score: {player.score}, Water: {player.resources.water}, Seeds: {player.resources.seeds}, Buds: {player.resources.buds}, Flowers: {player.resources.flowers},{" "}
            <span title="Bugs are harmful by default. Counterplay: Ladybugs event, Venus Flytrap reaction, and Pitcher Plant hunt conversion.">
              Bugs (penalty): {player.resources.bugs}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
