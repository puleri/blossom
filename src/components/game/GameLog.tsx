interface GameLogProps {
  entries: string[];
}

export function GameLog({ entries }: GameLogProps) {
  return (
    <section>
      <h2>Game Log</h2>
      <ol>
        {entries.map((entry, index) => (
          <li key={`${entry}-${index}`}>{entry}</li>
        ))}
      </ol>
    </section>
  );
}
