import { useEffect, useMemo, useState } from "react";
import { SOCKET_EVENTS, THEME_LABELS, type Difficulty, type PublicRoomState, type ThemeId, parseAnswerFromSpeech } from "@guess-who/shared";
import { createSocket } from "./socket.js";
import { AvatarTile } from "./components/AvatarTile.js";
import { VoiceCall } from "./components/VoiceCall.js";
import { getSpeechRecognition, listenOnce } from "./speech.js";

function useRoomState(socket: import("socket.io-client").Socket) {
  const [view, setView] = useState<PublicRoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [_connTick, setConnTick] = useState(0);

  useEffect(() => {
    const bump = () => setConnTick((x) => x + 1);
    const onState = (v: PublicRoomState) => {
      setError(null);
      setView(v);
    };
    const onErr = (p: { message?: string }) => setError(p?.message ?? "Error");
    socket.on("connect", bump);
    socket.on("disconnect", bump);
    socket.on(SOCKET_EVENTS.roomState, onState);
    socket.on(SOCKET_EVENTS.error, onErr);
    return () => {
      socket.off("connect", bump);
      socket.off("disconnect", bump);
      socket.off(SOCKET_EVENTS.roomState, onState);
      socket.off(SOCKET_EVENTS.error, onErr);
    };
  }, [socket]);

  return {
    view,
    error,
    resetRoom: () => {
      setView(null);
      setError(null);
    },
  };
}

export function App() {
  const [socket] = useState(() => createSocket());
  const { view, error, resetRoom } = useRoomState(socket);

  /** One-shot landing intro; skipped when user prefers reduced motion. */
  const [bootIntro, setBootIntro] = useState(
    () => typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    if (!bootIntro) return;
    const id = window.setTimeout(() => setBootIntro(false), 1500);
    return () => window.clearTimeout(id);
  }, [bootIntro]);

  const [themeId, setThemeId] = useState<ThemeId>("cartoons");
  const [difficulty, setDifficulty] = useState<Difficulty>("standard");
  const [joinCode, setJoinCode] = useState("");

  const [localDown, setLocalDown] = useState<Record<string, boolean>>({});
  const [setupPick, setSetupPick] = useState<string | null>(null);
  const [mySecretId, setMySecretId] = useState<string | null>(null);
  const [guessPick, setGuessPick] = useState<string | null>(null);
  const [guessMode, setGuessMode] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [speechBusy, setSpeechBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const c = params.get("code");
    if (c) setJoinCode(c.toUpperCase());
  }, []);

  useEffect(() => {
    if (!view?.rosterSeed) return;
    setLocalDown({});
    setSetupPick(null);
    setMySecretId(null);
    setGuessPick(null);
    setGuessMode(false);
    setQuestionText("");
  }, [view?.rosterSeed]);

  const joinLink = useMemo(() => {
    if (!view?.roomCode) return "";
    const u = new URL(window.location.href);
    u.searchParams.set("code", view.roomCode);
    return u.toString();
  }, [view?.roomCode]);

  const isAnswerer =
    Boolean(view?.phase === "playing" && view.pendingQuestion && view.yourSlot && view.pendingQuestion.asker !== view.yourSlot);

  const isAsker = Boolean(view?.phase === "playing" && view.yourSlot && view.turn === view.yourSlot && !view.pendingQuestion);

  async function onSpeechQuestion() {
    setSpeechBusy(true);
    try {
      const t = await listenOnce("en-PH");
      setQuestionText((prev) => (prev ? `${prev} ${t}`.trim() : t));
    } catch {
      /* ignore */
    }
    setSpeechBusy(false);
  }

  async function onSpeechAnswerHard() {
    setSpeechBusy(true);
    try {
      let last = "";
      for (let i = 0; i < 3; i++) {
        last = (await listenOnce("en-PH")).trim();
        const parsed = parseAnswerFromSpeech(last);
        if (parsed) {
          socket.emit(SOCKET_EVENTS.answer, { value: parsed });
          setSpeechBusy(false);
          return;
        }
      }
      window.alert(`Could not map answer from: "${last}". Try: yes / no / not sure (or Oo / Hindi / Hindi ko alam).`);
    } catch {
      /* ignore */
    }
    setSpeechBusy(false);
  }

  function toggleDown(id: string) {
    setLocalDown((m) => ({ ...m, [id]: !m[id] }));
  }

  function leave() {
    socket.emit(SOCKET_EVENTS.leaveRoom);
    resetRoom();
    setLocalDown({});
    setSetupPick(null);
    setMySecretId(null);
    setGuessPick(null);
    setGuessMode(false);
  }

  function onTileClick(characterId: string) {
    if (!view) return;
    if (view.phase !== "playing" && view.phase !== "ended") return;
    if (guessMode) {
      setGuessPick(characterId);
      return;
    }
    toggleDown(characterId);
  }

  const connected = socket.connected;

  return (
    <div className={`appShell${bootIntro ? " appShell--boot" : ""}`}>
      <div className="appShell__decor" aria-hidden="true">
        <span className="appShell__blob appShell__blob--a" />
        <span className="appShell__blob appShell__blob--b" />
        <span className="appShell__blob appShell__blob--c" />
      </div>

      <header className="card card--hero brandHero">
        <p className="brandHero__eyebrow">Online · 2 players</p>
        <h1 className="brandHero__title">Sino Ito?</h1>
        <p className="brandHero__tagline">Filipino-flavored Guess Who — procedural art, room codes, optional voice in Hard mode.</p>
      </header>

      {error ? (
        <div className="card card--alert stack" style={{ marginBottom: 12 }}>
          <strong>Oops!</strong> {error}
        </div>
      ) : null}

      {!connected ? (
        <div className="card card--connecting">
          <span className="connecting__dot" aria-hidden />
          Connecting to server…
        </div>
      ) : null}

      {connected && view?.yourSlot ? (
        <div className="card stack" style={{ marginBottom: 12 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <span className="badge">Room {view.roomCode}</span>{" "}
              <span className="badge">{THEME_LABELS[view.themeId]}</span>{" "}
              <span className="badge">{view.difficulty === "hard" ? "Hard (live call)" : "Standard"}</span>
            </div>
            <button type="button" className="danger" onClick={leave}>
              Leave room
            </button>
          </div>

          {view.phase === "lobby" && !view.opponentPresent ? (
            <div className="stack lobbyShare">
              <p className="muted lobbyShare__hint">Tell your friend to open this same game, then enter this room code:</p>
              <div className="roomCodeDisplay" aria-label="Room code">
                <span className="roomCodeDisplay__chars">{view.roomCode}</span>
              </div>
              <div className="row lobbyShare__actions">
                <button
                  type="button"
                  className="primary"
                  onClick={async () => {
                    await navigator.clipboard.writeText(view.roomCode);
                  }}
                >
                  Copy code
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={async () => {
                    await navigator.clipboard.writeText(joinLink);
                  }}
                >
                  Copy invite link
                </button>
              </div>
              <p className="muted lobbyShare__fineprint">
                Invite link opens the site with the code filled in — optional if you only share the six characters.
              </p>
              <div className="muted lobbyShare__wait">Waiting for opponent to join…</div>
            </div>
          ) : null}

          {view.phase === "setup" ? (
            <div className="stack">
              <h2>Pick your mystery character</h2>
              <div className="muted">Tap one face, then confirm. This is who your opponent must guess.</div>
              <div className="grid24">
                {view.roster.map((c) => (
                  <AvatarTile key={c.id} character={c} down={false} isSelf={setupPick === c.id} onClick={() => setSetupPick(c.id)} />
                ))}
              </div>
              <div className="row">
                <button
                  type="button"
                  className="primary"
                  disabled={!setupPick}
                  onClick={() => {
                    if (!setupPick) return;
                    socket.emit(SOCKET_EVENTS.setSecret, { characterId: setupPick });
                    setMySecretId(setupPick);
                  }}
                >
                  Confirm character
                </button>
                {!view.secretsReady[view.yourSlot] ? <span className="muted">Confirm your pick…</span> : null}
                {!view.secretsReady[view.yourSlot === "p1" ? "p2" : "p1"] ? <span className="muted">Waiting for opponent…</span> : null}
              </div>
            </div>
          ) : null}

          {view.phase === "playing" || view.phase === "ended" ? (
            <div className="stack">
              {view.difficulty === "hard" && view.phase === "playing" ? (
                <VoiceCall socket={socket} enabled={true} polite={Boolean(view.webrtcPolite)} />
              ) : null}

              {view.phase === "playing" && view.difficulty === "standard" ? (
                <div className="card stack" style={{ padding: 12 }}>
                  <h2>Ask a question</h2>
                  {isAsker ? (
                    <div className="stack">
                      <textarea rows={3} value={questionText} onChange={(e) => setQuestionText(e.target.value)} placeholder="Type your yes/no question…" />
                      <div className="row">
                        <button type="button" className="primary" disabled={!questionText.trim()} onClick={() => socket.emit(SOCKET_EVENTS.askQuestion, { text: questionText })}>
                          Send question
                        </button>
                        <button type="button" disabled={speechBusy || !getSpeechRecognition()} onClick={onSpeechQuestion}>
                          {speechBusy ? "Listening…" : "Voice fill"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="muted">{isAnswerer ? "Your turn to answer." : "Waiting for opponent’s question…"}</div>
                  )}

                  {isAnswerer ? (
                    <div className="row">
                      <button type="button" className="primary" onClick={() => socket.emit(SOCKET_EVENTS.answer, { value: "yes" })}>
                        Yes
                      </button>
                      <button type="button" className="primary" onClick={() => socket.emit(SOCKET_EVENTS.answer, { value: "no" })}>
                        No
                      </button>
                      <button type="button" className="primary" onClick={() => socket.emit(SOCKET_EVENTS.answer, { value: "not_sure" })}>
                        Not sure
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {view.phase === "playing" && view.difficulty === "hard" ? (
                <div className="card stack" style={{ padding: 12 }}>
                  <h2>Voice match (Hard)</h2>
                  <div className="muted">Talk on the live call. Use controls below to advance turns (no saved transcript).</div>
                  {isAsker ? (
                    <div className="row">
                      <button type="button" className="primary" onClick={() => socket.emit(SOCKET_EVENTS.askQuestion, { text: "" })}>
                        Done asking (open answer window)
                      </button>
                      <button
                        type="button"
                        disabled={speechBusy || !getSpeechRecognition()}
                        onClick={async () => {
                          setSpeechBusy(true);
                          try {
                            const t = (await listenOnce("en-PH")).trim();
                            socket.emit(SOCKET_EVENTS.askQuestion, { text: t });
                          } catch {
                            /* ignore */
                          }
                          setSpeechBusy(false);
                        }}
                      >
                        {speechBusy ? "Listening…" : "Optional: record question (not saved)"}
                      </button>
                    </div>
                  ) : (
                    <div className="muted">{isAnswerer ? "Answer on the call, then lock in:" : "Waiting…"}</div>
                  )}
                  {isAnswerer ? (
                    <button type="button" className="primary" disabled={speechBusy || !getSpeechRecognition()} onClick={onSpeechAnswerHard}>
                      {speechBusy ? "Speak your answer…" : "Speak answer (Oo / Hindi / Hindi ko alam)"}
                    </button>
                  ) : null}
                </div>
              ) : null}

              {view.phase === "playing" && view.pendingQuestion && view.difficulty === "standard" ? (
                <div className="muted">
                  <strong>Pending question:</strong> {view.pendingQuestion.text}
                </div>
              ) : null}

              {view.difficulty === "standard" && view.phase === "playing" ? (
                <div className="card stack" style={{ padding: 12 }}>
                  <h2>Question history</h2>
                  <div className="history">
                    {view.qaHistory.length === 0 ? <div className="muted" style={{ padding: 8 }}>No rounds yet.</div> : null}
                    {view.qaHistory.map((h, idx) => (
                      <div key={idx} className="historyItem">
                        <div>
                          <span className="muted">{h.asker === view.yourSlot ? "You asked" : "Opponent asked"}:</span> {h.questionText}
                        </div>
                        <div>
                          <span className="muted">Answer:</span> {h.answer}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <h2>Your board</h2>
              <div className="row" style={{ marginBottom: 8 }}>
                <label className="row" style={{ gap: 8 }}>
                  <input type="checkbox" checked={guessMode} onChange={(e) => setGuessMode(e.target.checked)} />
                  <span className="muted">Guess select mode (tap a tile to choose who you are guessing)</span>
                </label>
              </div>
              <div className="muted">Normally: tap tiles to flip down or back up.</div>
              <div className="grid24">
                {view.roster.map((c) => (
                  <AvatarTile key={c.id} character={c} down={Boolean(localDown[c.id])} isSelf={mySecretId === c.id} onClick={() => onTileClick(c.id)} />
                ))}
              </div>

              {view.phase === "playing" ? (
                <div className="card stack" style={{ padding: 12 }}>
                  <h2>Guess</h2>
                  <div className="muted">Turn on guess select mode, tap a character, then confirm. Wrong guess loses the match.</div>
                  <div className="row">
                    <button
                      type="button"
                      className="primary"
                      disabled={!guessPick}
                      onClick={() => {
                        if (!guessPick) return;
                        socket.emit(SOCKET_EVENTS.guess, { characterId: guessPick });
                        setGuessPick(null);
                        setGuessMode(false);
                      }}
                    >
                      Guess selected character
                    </button>
                    {guessPick ? <span className="muted">Selected: {guessPick}</span> : null}
                  </div>
                </div>
              ) : null}

              {view.phase === "ended" ? (
                <div className="card stack" style={{ padding: 12 }}>
                  <h2>Match over</h2>
                  <div>
                    Winner: <strong>{view.winner}</strong> {view.winner === view.yourSlot ? "(you!)" : "(opponent)"}
                  </div>
                  {view.reveal ? (
                    <div className="muted">
                      Secrets — p1: {view.reveal.p1SecretId}, p2: {view.reveal.p2SecretId}
                    </div>
                  ) : null}
                  {view.lastGuess ? (
                    <div className="muted">
                      Last guess by {view.lastGuess.guesser}: {view.lastGuess.characterId} ({view.lastGuess.correct ? "correct" : "wrong"})
                    </div>
                  ) : null}
                  <button type="button" className="primary" onClick={() => socket.emit(SOCKET_EVENTS.rematch)}>
                    Rematch (new board)
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {connected && !view?.yourSlot ? (
        <div className="card card--play stack playPanel">
          <h2 className="playPanel__title">Play</h2>
          <div className="row">
            <label className="muted">Theme</label>
            <select value={themeId} onChange={(e) => setThemeId(e.target.value as ThemeId)}>
              <option value="celebrities">{THEME_LABELS.celebrities}</option>
              <option value="government">{THEME_LABELS.government}</option>
              <option value="cartoons">{THEME_LABELS.cartoons}</option>
            </select>
          </div>
          <div className="row">
            <label className="muted">Difficulty</label>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
              <option value="standard">Standard (text/voice + buttons + history)</option>
              <option value="hard">Hard (WebRTC live call, no history, no Yes/No buttons)</option>
            </select>
          </div>
          <div className="row">
            <button type="button" className="primary" onClick={() => socket.emit(SOCKET_EVENTS.createRoom, { themeId, difficulty })}>
              Create room
            </button>
          </div>
          <div className="row">
            <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="ROOM CODE" />
            <button type="button" className="primary" disabled={joinCode.length < 4} onClick={() => socket.emit(SOCKET_EVENTS.joinRoom, { code: joinCode })}>
              Join room
            </button>
          </div>
          <div className="muted">Tip: Hard mode works best in Chrome/Edge on HTTPS (or localhost) for WebRTC + speech.</div>
        </div>
      ) : null}
    </div>
  );
}
