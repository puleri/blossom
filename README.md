# blossom

Next.js App Router starter wired for Firebase + Firestore basics.

## Getting started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create your environment file:
   ```bash
   cp .env.example .env.local
   ```
3. Start the dev server:
   ```bash
   npm run dev
   ```

## Firestore health check

The homepage loads a `health/status` document and prints the `state` field. Update that document in your Firestore project to verify connectivity.

## Gameplay MVP notes

- **Dry Heat simplification:** for this MVP, resolving the `dryHeat` event only applies the shared event resource delta (`water -1`, minimum 0) to each player. It does not trigger any extra plant-specific bonuses or penalties.
