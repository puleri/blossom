import type { GameDoc, PlayerDoc } from "@/lib/game/types";

interface GameTestData {
  game: GameDoc;
  players: PlayerDoc[];
  mePlayerId: string;
  logEntries: string[];
}

export const GAME_TEST_DATA: GameTestData = {
  game: {
    id: "TEST-STATIC-001",
    createdBy: "uid-host",
    status: "in_progress",
    phase: "turns",
    round: 2,
    roundsTotal: 6,
    hostPlayerId: "player-host",
    activePlayerId: "player-host",
    playerOrder: ["player-host", "player-guest"],
    turnIndex: 0,
    eventDeck: [],
    plantDeck: ["sunbloom", "rainfern", "thornivy", "petalburst"],
    lastPhaseResolvedRound: 1,
    currentEventId: "morning-dew",
    log: [
      "Game started from lobby.",
      "Round 2 event revealed: Morning Dew.",
      "Avery drew one card."
    ]
  },
  players: [
    {
      id: "player-host",
      displayName: "Avery",
      uid: "uid-host",
      isHost: true,
      resources: {
        water: 4,
        seeds: 3,
        flowers: 1,
        bugs: 0
      },
      score: 5,
      hand: ["sunbloom", "rainfern", "petalburst"],
      gardenSlots: [
        { state: "grown", plantId: "sunbloom" },
        { state: "seedling", plantId: "rainfern" },
        { state: "empty", plantId: null },
        { state: "empty", plantId: null }
      ],
      keptFromMulligan: true
    },
    {
      id: "player-guest",
      displayName: "Riley",
      uid: "uid-guest",
      isHost: false,
      resources: {
        water: 2,
        seeds: 4,
        flowers: 0,
        bugs: 1
      },
      score: 3,
      hand: ["thornivy", "moonpetal"],
      gardenSlots: [
        { state: "grown", plantId: "thornivy" },
        { state: "withered", plantId: null },
        { state: "empty", plantId: null },
        { state: "seedling", plantId: "moonpetal" }
      ],
      keptFromMulligan: true
    }
  ],
  mePlayerId: "player-host",
  logEntries: [
    "Game started from lobby.",
    "Round 2 event revealed: Morning Dew.",
    "Avery drew one card.",
    "Riley visited the well and gained +2 water."
  ]
};
