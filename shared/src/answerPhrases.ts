import type { AnswerValue } from "./types.js";

const MAP: { value: AnswerValue; phrases: string[] }[] = [
  {
    value: "yes",
    phrases: [
      "yes",
      "yeah",
      "yep",
      "yup",
      "oo",
      "opo",
      "tama",
      "correct",
      "uh huh",
      "affirmative",
    ],
  },
  {
    value: "no",
    phrases: [
      "no",
      "nope",
      "nah",
      "hindi",
      "hinde",
      "wrong",
      "negative",
    ],
  },
  {
    value: "not_sure",
    phrases: [
      "not sure",
      "notsure",
      "maybe",
      "idk",
      "i don't know",
      "dont know",
      "hindi ko alam",
      "ewan",
      "unsure",
    ],
  },
];

export function parseAnswerFromSpeech(text: string): AnswerValue | null {
  const t = text.trim().toLowerCase().replace(/\s+/g, " ");
  if (!t) return null;
  for (const { value, phrases } of MAP) {
    for (const p of phrases) {
      if (t === p || t.includes(p)) return value;
    }
  }
  return null;
}
