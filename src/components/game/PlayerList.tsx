import type { PlayerDoc } from "@/lib/game/types";

interface PlayerListProps {
  players: PlayerDoc[];
  activePlayerId: string | null;
}

export function PlayerList({ players, activePlayerId }: PlayerListProps) {
  return (
    <section>
      <h2>Players</h2>
      <ul>
        {players.map((player) => (
          <li key={player.id}>
            {player.displayName}
            {player.isHost ? " (Host)" : ""}
            {player.id === activePlayerId ? " • Active" : ""} — Score: {player.score}, Water: {player.resources.water}, Hand: {player.hand.length} cards
          </li>
        ))}
      </ul>
    </section>
  );
}
