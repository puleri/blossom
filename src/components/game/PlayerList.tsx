import type { PlayerDoc } from "@/lib/game/types";

interface PlayerListProps {
  players: PlayerDoc[];
  activePlayerId: string | null;
}

function formatScoreBreakdown(player: PlayerDoc) {
  const breakdown = player.scoreBreakdown;
  if (!breakdown) return `Score: ${player.score}`;

  return `Score: ${breakdown.total} (Plants ${breakdown.plantPoints}, Tucked ${breakdown.tuckedPoints}, Sunlight ${breakdown.sunlightPoints}, Bonus ${breakdown.bonusPoints})`;
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
            {player.id === activePlayerId ? " • Active" : ""} — {formatScoreBreakdown(player)}, Water: {player.resources.water}, Hand: {player.hand.length} cards
          </li>
        ))}
      </ul>
    </section>
  );
}
