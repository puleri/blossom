import type { GameDoc } from "@/lib/game/types";

interface GameHeaderProps {
  game: GameDoc;
  playerCount: number;
}

export function GameHeader({ game, playerCount }: GameHeaderProps) {
  return (
    <header>
      <h1>Blossom Game #{game.id}</h1>
      <p>
        Phase: <strong>{game.phase}</strong> | Round: <strong>{game.round}</strong> / {game.roundsTotal} |
        Players: <strong>{playerCount}</strong>
      </p>
    </header>
  );
}
