# Blossom

Blossom is a lightweight multiplayer, turn-based garden card game built with Next.js (App Router), Firebase Anonymous Auth, and Cloud Firestore.

## Project overview

This repository contains an MVP implementation focused on playable end-to-end game flow with client-driven transactions.

### Features

- Anonymous sign-in bootstrapped on client load.
- Create a game lobby and share a game ID for others to join.
- Host-only game start from lobby.
- Setup phase where each player keeps cards and discards matching resources.
- Round loop with event, turns, and upkeep phases.
- Per-game player collection and append-only log collection for table activity.
- Firestore security rules that enforce authenticated membership and host-only critical transitions.

## Firebase setup

1. Create (or open) a Firebase project.
2. Enable **Authentication**:
   - Go to **Authentication → Sign-in method**.
   - Enable **Anonymous** provider.
3. Enable **Cloud Firestore**:
   - Create a Firestore database (Native mode).
4. Apply this repo's rules:
   - In Firebase Console Firestore Rules editor, paste `firestore.rules`, or deploy via Firebase CLI if you have it configured.

## Environment variables

Create `.env.local` (or copy from `.env.example`) and set:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

These values come from **Project Settings → Your apps → Firebase SDK snippet (Web app config)**.

## Local development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Add Firebase environment variables in `.env.local`.

3. Start dev server:

   ```bash
   npm run dev
   ```

4. Open `http://localhost:3000`.

## Game flow (how to play)

1. **Create game**: enter a display name and create a new lobby.
2. **Join by ID**: other players enter the game ID and join from the home page.
3. **Host starts game**: once at least 2 players are present, host clicks Start Game.
4. **Setup keep/discard**: each player keeps desired setup plants and discards one resource per kept plant.
5. **Take turns**: rounds proceed through event resolution, then turn actions in player order. Plants begin with 1 water unless card text says otherwise, and players may add water to their plants at any point during their own turn.
6. **Endgame**: after final upkeep, game status transitions to ended and final scoring is applied.

## MVP simplifications and known edge cases

- **Host-coordinator trigger model**:
  - Host must explicitly resolve round event and upkeep phases.
  - If host disconnects or goes idle, phase progression can stall until host control changes.
- **Simplified event effects**:
  - Event resolution applies shared resource/point deltas from the event card.
  - Advanced card-specific conditional interactions are intentionally simplified for MVP.
- **No Cloud Functions authority layer**:
  - Turn resolution runs from trusted client transactions.
  - There is no server-side arbiter for complete anti-cheat validation in this version.

## Data model summary

Top-level and nested collections:

- `games/{gameId}`
  - Core state: `status`, `phase`, `round`, `roundsTotal`, `hostPlayerId`, `activePlayerId`, `playerOrder`, `turnIndex`, `eventDeck`, `currentEventId`, `lastPhaseResolvedRound`.
- `games/{gameId}/players/{uid}`
  - Player state: `displayName`, `uid`, `isHost`, `resources`, `score`, `hand`, `gardenSlots`, `keptFromMulligan`.
- `games/{gameId}/log/{entryId}`
  - Log entries: `message`, optional `playerId`, `type`, `createdAt`.

## Security rules notes

The included Firestore rules provide MVP-grade safeguards:

- Reads require authenticated game membership.
- Game document updates allow host authority over critical phase/deck/turn fields.
- Non-host updates are constrained by field-level checks and membership checks.
- Player document self-writes are restricted to an allowlisted subset of mutable fields.
- Log entries can be created by any authenticated game member.

Important limitation: rules are not a complete engine-level validator for all game mechanics. Production hardening should move authoritative game mutation and legality checks to backend code (for example, Cloud Functions), but this MVP intentionally does **not** include Cloud Functions.

## Deploying to Vercel

1. Push this repository to GitHub/GitLab/Bitbucket.
2. In Vercel, click **Add New Project** and import the repo.
3. In **Project Settings → Environment Variables**, add all `NEXT_PUBLIC_FIREBASE_*` variables for:
   - Preview
   - Production
   - (Optional) Development
4. Deploy.
5. After deploy, verify:
   - Anonymous auth succeeds in browser.
   - Firestore reads/writes succeed for game creation/join flow.
   - Firestore rules in Firebase match this repo's expected access model.
