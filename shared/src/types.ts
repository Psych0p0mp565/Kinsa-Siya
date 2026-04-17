export type ThemeId = "celebrities" | "government" | "cartoons";

export type Difficulty = "standard" | "hard";

export type PlayerSlot = "p1" | "p2";

export type AnswerValue = "yes" | "no" | "not_sure";

export interface Character {
  id: string;
  index: number;
  themeId: ThemeId;
  seed: number;
  displayName: string;
}

export interface QARound {
  asker: PlayerSlot;
  questionText: string;
  answer: AnswerValue;
  at: number;
}

export type GamePhase = "lobby" | "setup" | "playing" | "ended";

export interface PublicRoomState {
  roomCode: string;
  themeId: ThemeId;
  difficulty: Difficulty;
  rosterSeed: string;
  roster: Character[];
  phase: GamePhase;
  /** Who asks next (when playing). */
  turn: PlayerSlot;
  /** Your slot in this room (present when you are seated). */
  yourSlot?: PlayerSlot;
  /** Opponent present in lobby. */
  opponentPresent: boolean;
  /** Both picked secrets (setup complete). */
  secretsReady: { p1: boolean; p2: boolean };
  /** Pending question for answerer (Standard: has text; Hard: may be empty). */
  pendingQuestion?: { asker: PlayerSlot; text: string };
  /** Button labels for Standard-mode answers (semantics stay yes / no / not_sure). */
  answerLabels: Record<AnswerValue, string>;
  qaHistory: QARound[];
  /** Winner when ended. */
  winner?: PlayerSlot;
  /** Revealed secrets after game end. */
  reveal?: { p1SecretId: string; p2SecretId: string };
  /** Last guess attempt (for UI). */
  lastGuess?: { guesser: PlayerSlot; characterId: string; correct: boolean };
  /** When true, this client should initiate WebRTC offer (joiner / p2). */
  webrtcPolite?: boolean;
  /** Same face lineup for everyone hosting with “today’s deck” (UTC date + theme). */
  dailyBoard?: boolean;
}
