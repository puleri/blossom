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

## Firestore security trust model (MVP)

The Firestore rules in `firestore.rules` are designed for practical MVP protection rather than full anti-cheat guarantees.

- Access to `/games/{gameId}` and child collections requires authentication plus active membership in `/games/{gameId}/players/{uid}`.
- Host-only controls are enforced for critical game state transitions (`status`, `phase`, turn/event deck flow fields).
- Non-host players can write only their own player document and only through an allowlisted set of mutable fields.
- Fine-grained turn legality (active player checks, card legality, exact score/resource deltas, round sequencing) is validated in client transaction logic.

### Known MVP limitations

- Security rules intentionally do **not** fully encode all game mechanics.
- A malicious authenticated player may still attempt allowed-shape writes that are semantically invalid for game rules.
- Production hardening should move authoritative turn resolution to trusted backend code (e.g., Cloud Functions) and reduce direct client write capabilities.
