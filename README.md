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
