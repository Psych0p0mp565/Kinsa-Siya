import http from "node:http";
import express, { type Request, type Response } from "express";
import cors from "cors";
import { Server, type Socket } from "socket.io";
import { SOCKET_EVENTS, type AnswerValue, type Difficulty, type ThemeId } from "@guess-who/shared";
import { Room, RoomStore } from "./roomStore.js";

const THEMES: ThemeId[] = ["celebrities", "government", "cartoons"];

function normalizeThemeId(v: unknown): ThemeId {
  return THEMES.includes(v as ThemeId) ? (v as ThemeId) : "cartoons";
}

const PORT = Number(process.env.PORT ?? 3001);

/** Comma-separated list wins; else single `CLIENT_ORIGIN`; defaults to local Vite. */
function parseCorsOrigins(): string[] {
  const multi = process.env.CLIENT_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean);
  if (multi && multi.length > 0) return multi;
  const single = process.env.CLIENT_ORIGIN?.trim();
  return [single && single.length > 0 ? single : "http://localhost:5173"];
}

const CORS_ORIGINS = parseCorsOrigins();

const app = express();
app.use(cors({ origin: CORS_ORIGINS, credentials: true }));
app.get("/health", (_req: Request, res: Response) => res.json({ ok: true }));

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: CORS_ORIGINS, methods: ["GET", "POST"], credentials: true },
});

const store = new RoomStore();

function broadcastRoom(room: Room) {
  for (const p of room.players) {
    io.to(p.socketId).emit(SOCKET_EVENTS.roomState, room.publicView(p.socketId));
  }
}

function err(socket: Socket, message: string) {
  socket.emit(SOCKET_EVENTS.error, { message });
}

io.on("connection", (socket: Socket) => {
  socket.on(SOCKET_EVENTS.createRoom, (payload: { themeId: ThemeId; difficulty: Difficulty }) => {
    const themeId = normalizeThemeId(payload?.themeId);
    const difficulty: Difficulty = payload?.difficulty === "hard" ? "hard" : "standard";
    const room = store.createRoom(themeId, difficulty, socket.id);
    void socket.join(roomChannel(room.code));
    broadcastRoom(room);
  });

  socket.on(SOCKET_EVENTS.joinRoom, (payload: { code: string }) => {
    const code = String(payload?.code ?? "").toUpperCase();
    const room = store.joinRoom(code, socket.id);
    if (!room) {
      err(socket, "Could not join room (invalid code or full).");
      return;
    }
    void socket.join(roomChannel(room.code));
    broadcastRoom(room);
  });

  socket.on(SOCKET_EVENTS.setSecret, (payload: { characterId: string }) => {
    const room = store.getBySocket(socket.id);
    if (!room) return err(socket, "Not in a room.");
    const slot = room.slotFor(socket.id);
    if (!slot) return err(socket, "No seat.");
    const ok = room.setSecret(slot, String(payload?.characterId ?? ""));
    if (!ok) return err(socket, "Invalid character.");
    broadcastRoom(room);
  });

  socket.on(SOCKET_EVENTS.askQuestion, (payload: { text: string }) => {
    const room = store.getBySocket(socket.id);
    if (!room) return err(socket, "Not in a room.");
    const slot = room.slotFor(socket.id);
    if (!slot) return err(socket, "No seat.");
    const res = room.askQuestion(slot, String(payload?.text ?? ""));
    if (!res.ok) return err(socket, res.reason);
    broadcastRoom(room);
  });

  socket.on(SOCKET_EVENTS.answer, (payload: { value: AnswerValue }) => {
    const room = store.getBySocket(socket.id);
    if (!room) return err(socket, "Not in a room.");
    const slot = room.slotFor(socket.id);
    if (!slot) return err(socket, "No seat.");
    const v = payload?.value;
    if (v !== "yes" && v !== "no" && v !== "not_sure") return err(socket, "bad_answer");
    const res = room.answer(slot, v);
    if (!res.ok) return err(socket, res.reason);
    broadcastRoom(room);
  });

  socket.on(SOCKET_EVENTS.guess, (payload: { characterId: string }) => {
    const room = store.getBySocket(socket.id);
    if (!room) return err(socket, "Not in a room.");
    const slot = room.slotFor(socket.id);
    if (!slot) return err(socket, "No seat.");
    const res = room.guess(slot, String(payload?.characterId ?? ""));
    if (!res.ok) return err(socket, res.reason);
    broadcastRoom(room);
  });

  socket.on(SOCKET_EVENTS.rematch, () => {
    const room = store.getBySocket(socket.id);
    if (!room) return err(socket, "Not in a room.");
    room.rematch();
    broadcastRoom(room);
  });

  socket.on(SOCKET_EVENTS.webrtcOffer, (payload: { sdp: string }) => {
    relayWebRtc(socket, "offer", payload);
  });
  socket.on(SOCKET_EVENTS.webrtcAnswer, (payload: { sdp: string }) => {
    relayWebRtc(socket, "answer", payload);
  });
  socket.on(SOCKET_EVENTS.webrtcIce, (payload: { candidate: unknown }) => {
    relayWebRtc(socket, "ice", payload);
  });

  socket.on(SOCKET_EVENTS.leaveRoom, () => {
    leaveFromSocket(socket);
  });

  socket.on("disconnect", () => {
    leaveFromSocket(socket);
  });
});

function roomChannel(code: string) {
  return `room:${code.toUpperCase()}`;
}

function leaveFromSocket(socket: Socket) {
  const left = store.leave(socket.id);
  if (!left) return;
  const { room, code } = left;
  void socket.leave(roomChannel(code));
  broadcastRoom(room);
}

function relayWebRtc(socket: Socket, kind: "offer" | "answer" | "ice", payload: unknown) {
  const room = store.getBySocket(socket.id);
  if (!room) return err(socket, "Not in a room.");
  const fromSlot = room.slotFor(socket.id);
  if (!fromSlot) return err(socket, "No seat.");
  const other = room.players.find((p) => p.slot !== fromSlot);
  if (!other) return;
  const target = io.sockets.sockets.get(other.socketId);
  if (!target) return;
  if (kind === "offer") target.emit(SOCKET_EVENTS.webrtcOffer, payload);
  if (kind === "answer") target.emit(SOCKET_EVENTS.webrtcAnswer, payload);
  if (kind === "ice") target.emit(SOCKET_EVENTS.webrtcIce, payload);
}

const HOST = process.env.HOST ?? "0.0.0.0";

httpServer.listen(PORT, HOST, () => {
  console.log(`Guess Who server listening on ${HOST}:${PORT} (CORS: ${CORS_ORIGINS.join(", ")})`);
});
