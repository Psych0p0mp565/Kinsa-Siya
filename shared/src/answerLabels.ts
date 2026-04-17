import type { AnswerValue } from "./types.js";

export type AnswerLabels = Record<AnswerValue, string>;

export const DEFAULT_ANSWER_LABELS: AnswerLabels = {
  yes: "Yes",
  no: "No",
  not_sure: "Not sure",
};

/** Sanitize labels from create-room payload (max length, fallbacks). */
export function normalizeAnswerLabels(raw: unknown): AnswerLabels {
  const def = DEFAULT_ANSWER_LABELS;
  if (!raw || typeof raw !== "object") return { ...def };
  const o = raw as Record<string, unknown>;
  const one = (key: AnswerValue): string => {
    const t = String(o[key] ?? "").trim();
    if (!t) return def[key];
    return t.slice(0, 28);
  };
  return { yes: one("yes"), no: one("no"), not_sure: one("not_sure") };
}
