import { createHash } from "node:crypto";
import {
  type AnswerLabels,
  type AnswerValue,
  buildRoster,
  type Character,
  type Difficulty,
  type GamePhase,
  type PlayerSlot,
  type QARound,
  type ThemeId,
} from "@guess-who/shared";

function randomRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)]!;
  return s;
}

function randomSeed(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Deterministic roster seed: same calendar day + theme ⇒ same faces worldwide. */
function dailySeed(themeId: ThemeId): string {
  const day = new Date().toISOString().slice(0, 10);
  return createHash("sha256").update(`${day}|${themeId}`).digest("hex").slice(0, 40);
}

interface Player {
  socketId: string;
  slot: PlayerSlot;
}

export type RoomCreateOptions = {
  answerLabels: AnswerLabels;
  dailyBoard?: boolean;
};

export class Room {
  readonly code: string;
  themeId: ThemeId;
  difficulty: Difficulty;
  answerLabels: AnswerLabels;
  readonly dailyBoard: boolean;
  rosterSeed: string;
  roster: Character[];
  players: Player[] = [];
  secrets: Partial<Record<PlayerSlot, string>> = {};
  phase: GamePhase = "lobby";
  turn: PlayerSlot = "p1";
  pendingQuestion?: { asker: PlayerSlot; text: string };
  qaHistory: QARound[] = [];
  winner?: PlayerSlot;
  reveal?: { p1SecretId: string; p2SecretId: string };
  lastGuess?: { guesser: PlayerSlot; characterId: string; correct: boolean };

  constructor(themeId: ThemeId, difficulty: Difficulty, opts: RoomCreateOptions) {
    this.code = randomRoomCode();
    this.themeId = themeId;
    this.difficulty = difficulty;
    this.answerLabels = opts.answerLabels;
    this.dailyBoard = Boolean(opts.dailyBoard);
    this.rosterSeed = this.dailyBoard ? dailySeed(themeId) : randomSeed();
    this.roster = buildRoster(this.rosterSeed, this.themeId);
  }

  addPlayer(socketId: string): PlayerSlot | null {
    if (this.players.length >= 2) return null;
    const slot: PlayerSlot = this.players.length === 0 ? "p1" : "p2";
    this.players.push({ socketId, slot });
    if (this.players.length === 2) this.phase = "setup";
    return slot;
  }

  removePlayer(socketId: string): void {
    this.players = this.players.filter((p) => p.socketId !== socketId);
    if (this.players.length < 2) {
      this.phase = "lobby";
      this.secrets = {};
      this.pendingQuestion = undefined;
      this.qaHistory = [];
      this.winner = undefined;
      this.reveal = undefined;
      this.lastGuess = undefined;
    }
  }

  slotFor(socketId: string): PlayerSlot | undefined {
    return this.players.find((p) => p.socketId === socketId)?.slot;
  }

  opponentSlot(slot: PlayerSlot): PlayerSlot {
    return slot === "p1" ? "p2" : "p1";
  }

  setSecret(slot: PlayerSlot, characterId: string): boolean {
    if (!this.roster.some((c) => c.id === characterId)) return false;
    this.secrets[slot] = characterId;
    if (this.secrets.p1 && this.secrets.p2) {
      this.phase = "playing";
      this.turn = "p1";
      this.pendingQuestion = undefined;
    }
    return true;
  }

  askQuestion(slot: PlayerSlot, text: string): { ok: true } | { ok: false; reason: string } {
    if (this.phase !== "playing") return { ok: false, reason: "not_playing" };
    if (this.winner) return { ok: false, reason: "ended" };
    if (this.turn !== slot) return { ok: false, reason: "not_your_turn" };
    if (this.pendingQuestion) return { ok: false, reason: "question_pending" };
    const trimmed = text.trim();
    if (this.difficulty === "standard" && trimmed.length === 0) {
      return { ok: false, reason: "empty_question" };
    }
    this.pendingQuestion = { asker: slot, text: trimmed };
    return { ok: true };
  }

  answer(slot: PlayerSlot, value: AnswerValue): { ok: true } | { ok: false; reason: string } {
    if (this.phase !== "playing") return { ok: false, reason: "not_playing" };
    if (!this.pendingQuestion) return { ok: false, reason: "no_question" };
    const asker = this.pendingQuestion.asker;
    const answerer = this.opponentSlot(asker);
    if (slot !== answerer) return { ok: false, reason: "not_answerer" };
    if (this.difficulty === "standard") {
      this.qaHistory.push({
        asker,
        questionText: this.pendingQuestion.text,
        answer: value,
        at: Date.now(),
      });
    }
    this.pendingQuestion = undefined;
    this.turn = answerer;
    return { ok: true };
  }

  guess(slot: PlayerSlot, characterId: string): { ok: true; outcome: "win" | "lose" } | { ok: false; reason: string } {
    if (this.phase !== "playing") return { ok: false, reason: "not_playing" };
    if (!this.roster.some((c) => c.id === characterId)) return { ok: false, reason: "bad_character" };
    const opp = this.opponentSlot(slot);
    const target = this.secrets[opp];
    if (!target) return { ok: false, reason: "no_secret" };
    const correct = characterId === target;
    this.lastGuess = { guesser: slot, characterId, correct };
    if (correct) {
      this.winner = slot;
      this.phase = "ended";
      this.reveal = { p1SecretId: this.secrets.p1!, p2SecretId: this.secrets.p2! };
      return { ok: true, outcome: "win" };
    }
    this.winner = opp;
    this.phase = "ended";
    this.reveal = { p1SecretId: this.secrets.p1!, p2SecretId: this.secrets.p2! };
    return { ok: true, outcome: "lose" };
  }

  rematch(): void {
    this.rosterSeed = this.dailyBoard ? dailySeed(this.themeId) : randomSeed();
    this.roster = buildRoster(this.rosterSeed, this.themeId);
    this.secrets = {};
    this.phase = this.players.length === 2 ? "setup" : "lobby";
    this.turn = "p1";
    this.pendingQuestion = undefined;
    this.qaHistory = [];
    this.winner = undefined;
    this.reveal = undefined;
    this.lastGuess = undefined;
  }

  publicView(socketId: string) {
    const yourSlot = this.slotFor(socketId);
    return {
      roomCode: this.code,
      themeId: this.themeId,
      difficulty: this.difficulty,
      rosterSeed: this.rosterSeed,
      roster: this.roster,
      phase: this.phase,
      turn: this.turn,
      yourSlot,
      opponentPresent: this.players.length === 2,
      secretsReady: {
        p1: Boolean(this.secrets.p1),
        p2: Boolean(this.secrets.p2),
      },
      pendingQuestion: this.pendingQuestion,
      answerLabels: this.answerLabels,
      qaHistory: this.difficulty === "standard" ? this.qaHistory : [],
      winner: this.winner,
      reveal: this.reveal,
      lastGuess: this.lastGuess,
      /** p2 is polite peer (sends WebRTC offer first) per plan sketch */
      webrtcPolite: yourSlot === "p2",
      dailyBoard: this.dailyBoard,
    };
  }
}

export class RoomStore {
  private rooms = new Map<string, Room>();
  private socketRoom = new Map<string, string>();

  createRoom(themeId: ThemeId, difficulty: Difficulty, hostSocketId: string, answerLabels: AnswerLabels, useDailyBoard?: boolean): Room {
    const room = new Room(themeId, difficulty, { answerLabels, dailyBoard: useDailyBoard });
    room.addPlayer(hostSocketId);
    this.rooms.set(room.code, room);
    this.socketRoom.set(hostSocketId, room.code);
    return room;
  }

  joinRoom(code: string, socketId: string): Room | null {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return null;
    if (room.players.length >= 2) return null;
    room.addPlayer(socketId);
    this.socketRoom.set(socketId, room.code);
    return room;
  }

  leave(socketId: string): { room: Room; code: string } | null {
    const code = this.socketRoom.get(socketId);
    if (!code) return null;
    const room = this.rooms.get(code);
    if (!room) return null;
    room.removePlayer(socketId);
    this.socketRoom.delete(socketId);
    if (room.players.length === 0) this.rooms.delete(code);
    return { room, code };
  }

  getBySocket(socketId: string): Room | null {
    const code = this.socketRoom.get(socketId);
    if (!code) return null;
    return this.rooms.get(code) ?? null;
  }
}
