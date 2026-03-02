# Plant Biomes Engine Game --- Development Work Plan

This document describes the work required to implement a complete,
playable digital version of the plant-biome engine-building card game
(inspired structurally by Wingspan) with a data-driven Power DSL.

------------------------------------------------------------------------

## 1. Product Definition

### 1.1 Game Summary

-   Players build a tableau of Plant cards across biomes.
-   On a turn, a player chooses one action:
    -   Grow: play a plant by paying Root resources and placing it into
        a biome.
    -   Root: gain Root resources by level, then activate plants in Root
        biome right-to-left.
    -   To the Sun: gain sunlight tokens by level, place onto plants
        (respecting capacity), then activate plants right-to-left;
        handle maturity.
    -   Pollinate: draw cards by level (deck/tray), then activate plants
        right-to-left.

### 1.2 Core Resources

-   Root resources: water, nutrients, seeds, compost
-   Sunlight tokens represent plant growth.
-   Each plant has sunlightCapacity.
-   When sunlight_tokens == sunlightCapacity, the plant becomes mature
    and may trigger onMature powers.

### 1.3 Biomes and Activations

-   Understory → Root activation row
-   Oasis Edge → To the Sun activation row
-   Meadow → Pollinate activation row
-   Canopy → Placement biome

------------------------------------------------------------------------

## 2. Deliverables

### MVP Requirements

-   Full match loop: Setup → Turns → Endgame → Scoring
-   Deck, hand, tableau, resources, sunlight tracking
-   Power DSL validation and interpreter
-   Right-to-left activation order
-   Endgame scoring breakdown

------------------------------------------------------------------------

## 3. Power DSL System

### Requirements

-   JSON Schema stored in docs/power-dsl.schema.json
-   Runtime validator
-   Interpreter supporting:
    -   if
    -   choice
    -   gainResource
    -   spendResource
    -   gainSunlight
    -   drawCards
    -   tuckCard
    -   scorePoints

### Triggers

-   onActivate (root \| pollinate \| toTheSun)
-   onPlay
-   onMature

------------------------------------------------------------------------

## 4. Core Rules Implementation

### Grow

-   Validate cost and placement
-   Deduct resources
-   Place plant
-   Fire onPlay powers

### Root

-   Grant resources by row level
-   Activate plants right-to-left

### To the Sun

-   Grant sunlight by row level
-   Place sunlight tokens
-   Handle maturity triggers
-   Activate plants right-to-left

### Pollinate

-   Draw cards by row level
-   Activate plants right-to-left

------------------------------------------------------------------------

## 5. Scoring

-   Base plant points
-   Tucked card scoring
-   Sunlight scoring rules
-   End-of-game winner determination

------------------------------------------------------------------------

## 6. Testing

-   Unit tests for DSL validation
-   Interpreter tests
-   Action tests
-   Activation order tests
-   Full match integration test

------------------------------------------------------------------------

## Definition of Done

The game is complete when: - A full match plays from start to finish
without errors. - All card powers execute via DSL interpreter. -
Activation order is correct. - Maturity triggers fire exactly once. -
Scoring breakdown is accurate. - Test suite passes.
