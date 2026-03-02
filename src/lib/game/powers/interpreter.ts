import type {
  Condition,
  ExecutePowerContext,
  ExecutePowerResult,
  PowerDsl,
  RuntimeGameState,
  RuntimePlant,
  RuntimePlayer,
  Step,
  TriggerKind
} from "./types";

function compare(left: number, cmp: ">=" | ">" | "==" | "<=" | "<", right: number) {
  switch (cmp) {
    case ">=":
      return left >= right;
    case ">":
      return left > right;
    case "==":
      return left === right;
    case "<=":
      return left <= right;
    case "<":
      return left < right;
  }
}

function evalCondition(cond: Condition, player: RuntimePlayer, selfPlant: RuntimePlant, gameState: RuntimeGameState): boolean {
  if (cond.op === "hasSunlight") {
    return selfPlant.sunlight >= cond.atLeast;
  }

  let plants: RuntimePlant[] = [];
  if (cond.scope === "playerTableau") {
    plants = [selfPlant];
  } else if (cond.scope === "allPlayers") {
    plants = gameState.players.flatMap(() => [selfPlant]);
  } else {
    plants = [selfPlant];
  }

  const count = plants.filter((plant) => {
    if (cond.predicate.biome && plant.biome !== cond.predicate.biome) {
      return false;
    }
    if (typeof cond.predicate.mature === "boolean" && Boolean(plant.mature) !== cond.predicate.mature) {
      return false;
    }
    return true;
  }).length;

  return compare(count, cond.cmp, cond.value);
}

function drawOne(source: "deck" | "tray", gameState: RuntimeGameState): string | null {
  if (source === "deck") {
    return gameState.deck.shift() ?? null;
  }

  return gameState.tray.shift() ?? null;
}

function executeSteps(steps: Step[], ctx: ExecutePowerContext, executed: string[]) {
  for (const step of steps) {
    switch (step.op) {
      case "if": {
        const branch = evalCondition(step.cond, ctx.player, ctx.selfPlant, ctx.gameState) ? step.then : (step.else ?? []);
        executeSteps(branch, ctx, executed);
        break;
      }
      case "choice": {
        const labels = step.options.map((o) => o.label);
        const chosenIndex = ctx.chooseOption ? ctx.chooseOption(labels) : 0;
        const choice = step.options[Math.max(0, Math.min(chosenIndex, step.options.length - 1))];
        executeSteps(choice.steps, ctx, executed);
        break;
      }
      case "gainResource": {
        ctx.player.resources[step.resource] = (ctx.player.resources[step.resource] ?? 0) + step.amount;
        executed.push(`gainResource:${step.resource}:${step.amount}`);
        break;
      }
      case "spendResource": {
        const current = ctx.player.resources[step.resource] ?? 0;
        if (current < step.amount) {
          throw new Error(`Cannot spend ${step.amount} ${step.resource}; only ${current} available.`);
        }
        ctx.player.resources[step.resource] = current - step.amount;
        executed.push(`spendResource:${step.resource}:${step.amount}`);
        break;
      }
      case "gainSunlight": {
        const next = ctx.selfPlant.sunlight + step.amount;
        ctx.selfPlant.sunlight = step.clampToCapacity === false ? next : Math.min(next, ctx.selfPlant.sunlightCapacity);
        const matured = !ctx.selfPlant.mature && ctx.selfPlant.sunlight >= ctx.selfPlant.sunlightCapacity;
        if (matured) {
          ctx.selfPlant.mature = true;
          executeTriggerForPlant("onMature", ctx.selfPlant.id, ctx);
        }
        executed.push(`gainSunlight:${step.amount}`);
        break;
      }
      case "drawCards": {
        for (let i = 0; i < step.amount; i += 1) {
          const source = step.source === "deckOrTrayChoice"
            ? (ctx.chooseOption?.(["deck", "tray"]) === 1 ? "tray" : "deck")
            : step.source;
          const cardId = drawOne(source, ctx.gameState);
          if (!cardId) {
            continue;
          }
          ctx.player.hand.push(cardId);
        }
        executed.push(`drawCards:${step.amount}`);
        break;
      }
      case "tuckCard": {
        for (let i = 0; i < step.amount; i += 1) {
          if (step.from === "hand") {
            if (ctx.player.hand.length === 0) {
              throw new Error("Cannot tuck from hand; hand is empty.");
            }
            const index = ctx.chooseCardFromHand ? ctx.chooseCardFromHand(ctx.player.hand) : 0;
            const [cardId] = ctx.player.hand.splice(Math.max(0, Math.min(index, ctx.player.hand.length - 1)), 1);
            if (cardId) {
              ctx.selfPlant.tucked.push(cardId);
            }
          } else {
            if (ctx.gameState.tray.length === 0) {
              throw new Error("Cannot tuck from tray; tray is empty.");
            }
            const index = ctx.chooseCardFromTray ? ctx.chooseCardFromTray(ctx.gameState.tray) : 0;
            const [cardId] = ctx.gameState.tray.splice(Math.max(0, Math.min(index, ctx.gameState.tray.length - 1)), 1);
            if (cardId) {
              ctx.selfPlant.tucked.push(cardId);
            }
          }
        }
        executed.push(`tuckCard:${step.from}:${step.amount}`);
        break;
      }
      case "scorePoints": {
        ctx.player.score += step.amount;
        executed.push(`scorePoints:${step.amount}`);
        break;
      }
    }
  }
}

export function executePower(power: PowerDsl, context: ExecutePowerContext): ExecutePowerResult {
  const ctx: ExecutePowerContext = {
    ...context,
    player: {
      ...context.player,
      resources: { ...context.player.resources },
      hand: [...context.player.hand]
    },
    selfPlant: {
      ...context.selfPlant,
      tucked: [...context.selfPlant.tucked]
    },
    gameState: {
      ...context.gameState,
      deck: [...context.gameState.deck],
      tray: [...context.gameState.tray],
      players: context.gameState.players.map((player) => ({ ...player, resources: { ...player.resources }, hand: [...player.hand] }))
    }
  };

  const executed: string[] = [];
  executeSteps(power.steps, ctx, executed);

  return {
    player: ctx.player,
    selfPlant: ctx.selfPlant,
    gameState: ctx.gameState,
    executed
  };
}

export function executeTriggerForPlant(kind: TriggerKind, plantId: string, context: ExecutePowerContext, row?: "root" | "pollinate" | "toTheSun") {
  const powers = context.powersByPlantId?.[plantId] ?? [];
  let nextContext = { ...context };

  for (const power of powers) {
    if (power.trigger.kind !== kind) {
      continue;
    }
    if (kind === "onActivate" && power.trigger.row !== row) {
      continue;
    }

    const executed = executePower(power, nextContext);
    nextContext = {
      ...nextContext,
      player: executed.player,
      selfPlant: executed.selfPlant,
      gameState: executed.gameState
    };
  }

  return nextContext;
}
