import type { ActivateRow, PowerDsl, Step, TriggerKind } from "./types";

const TRIGGER_LABELS: Record<TriggerKind, string> = {
  onActivate: "Activate",
  onPlay: "Play",
  onMature: "Mature"
};

const ACTIVATE_ROW_LABELS: Record<ActivateRow, string> = {
  root: "Root",
  pollinate: "Pollinate",
  toTheSun: "To the Sun"
};

function formatStep(step: Step): string | null {
  switch (step.op) {
    case "spendResource":
      return `Spend ${step.amount} ${step.resource}`;
    case "drawCards":
      return `Draw ${step.amount} card${step.amount === 1 ? "" : "s"}`;
    case "tuckCard":
      return `Tuck ${step.amount} card${step.amount === 1 ? "" : "s"} from ${step.from}`;
    case "gainResource":
      return `Gain ${step.amount} ${step.resource}`;
    case "if": {
      const formattedNestedSteps = step.then.map((nestedStep) => formatStep(nestedStep)).filter((nestedStep): nestedStep is string => Boolean(nestedStep));
      return formattedNestedSteps.length > 0 ? formattedNestedSteps.join(", then ") : null;
    }
    default:
      return null;
  }
}

export function formatPowerTrigger(trigger: PowerDsl["trigger"]): string {
  if (trigger.kind === "onActivate") {
    return trigger.row ? ACTIVATE_ROW_LABELS[trigger.row] : TRIGGER_LABELS.onActivate;
  }

  return TRIGGER_LABELS[trigger.kind];
}

export function formatPowerDslSummary(power: PowerDsl): string | null {
  const effectSummary = power.steps
    .map((step) => formatStep(step))
    .filter((step): step is string => Boolean(step))
    .join("; ");

  if (!effectSummary) {
    return null;
  }

  return `${formatPowerTrigger(power.trigger)} — ${effectSummary}.`;
}
