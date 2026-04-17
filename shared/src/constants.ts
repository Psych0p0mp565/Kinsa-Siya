import type { ThemeId } from "./types.js";

export const BOARD_SIZE = 24;

export const SOCKET_EVENTS = {
  createRoom: "createRoom",
  joinRoom: "joinRoom",
  leaveRoom: "leaveRoom",
  roomState: "roomState",
  error: "error",
  setSecret: "setSecret",
  askQuestion: "askQuestion",
  answer: "answer",
  guess: "guess",
  rematch: "rematch",
  webrtcOffer: "webrtc:offer",
  webrtcAnswer: "webrtc:answer",
  webrtcIce: "webrtc:ice",
} as const;

export const THEME_LABELS: Record<ThemeId, string> = {
  celebrities: "Celebrities",
  government: "Government officials",
  cartoons: "Cartoon characters",
};
