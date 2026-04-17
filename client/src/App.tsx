import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_ANSWER_LABELS,
  SOCKET_EVENTS,
  THEME_LABELS,
  normalizeAnswerLabels,
  parseAnswerFromSpeech,
  type Difficulty,
  type PublicRoomState,
  type ThemeId,
} from "@guess-who/shared";
import { createSocket } from "./socket.js";
import { AvatarTile } from "./components/AvatarTile.js";
import { VoiceCall } from "./components/VoiceCall.js";
import { WaitOpponent } from "./components/WaitOpponent.js";
import { ConfettiLayer } from "./components/ConfettiLayer.js";
import { OnboardingModal } from "./components/OnboardingModal.js";
import { hasDismissedOnboarding } from "./lib/onboarding.js";
import {
  loadSoundEnabled,
  playAnswerChime,
  playWinChime,
  resumeAudioIfNeeded,
  saveSoundEnabled,
} from "./lib/sounds.js";
import { loadStats, recordMatchEnd } from "./lib/stats.js";
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
  /** Standard mode only — labels for the three reply buttons (semantics unchanged). */
  const [replyYes, setReplyYes] = useState("");
  const [replyNo, setReplyNo] = useState("");
  const [replyUnsure, setReplyUnsure] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [useDailyBoard, setUseDailyBoard] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => !hasDismissedOnboarding());
  const [confettiTick, setConfettiTick] = useState(0);
  const [stats, setStats] = useState(() => loadStats());
  const [soundOn, setSoundOn] = useState(() => loadSoundEnabled());
  const [rematchCount, setRematchCount] = useState<number | null>(null);
  /** Snapshots before each tile flip (for undo). */
  const [flipUndo, setFlipUndo] = useState<Record<string, boolean>[]>([]);

  const [localDown, setLocalDown] = useState<Record<string, boolean>>({});
  const [setupPick, setSetupPick] = useState<string | null>(null);
  const [mySecretId, setMySecretId] = useState<string | null>(null);
  const [guessPick, setGuessPick] = useState<string | null>(null);
  const [guessMode, setGuessMode] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [speechBusy, setSpeechBusy] = useState(false);

  const prevQaLen = useRef(0);
  const lastRecordedEnd = useRef<string | null>(null);
  const rematchEmitGuard = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const c = params.get("code");
    if (c) setJoinCode(c.toUpperCase());
  }, []);

  useEffect(() => {
    if (!view?.rosterSeed) return;
    setLocalDown({});
    setFlipUndo([]);
    setSetupPick(null);
    setMySecretId(null);
    setGuessPick(null);
    setGuessMode(false);
    setQuestionText("");
    setRematchCount(null);
    lastRecordedEnd.current = null;
    prevQaLen.current = 0;
  }, [view?.rosterSeed]);

  useEffect(() => {
    if (!view || view.phase !== "playing") {
      prevQaLen.current = view?.qaHistory.length ?? 0;
      return;
    }
    const n = view.qaHistory.length;
    if (n > prevQaLen.current) {
      void resumeAudioIfNeeded();
      playAnswerChime();
    }
    prevQaLen.current = n;
  }, [view, view?.phase, view?.qaHistory.length]);

  useEffect(() => {
    if (!view || view.phase !== "ended" || !view.yourSlot || !view.winner) return;
    const key = `${view.roomCode}|${view.rosterSeed}|ended`;
    if (lastRecordedEnd.current === key) return;
    lastRecordedEnd.current = key;
    const won = view.winner === view.yourSlot;
    setStats(recordMatchEnd(won));
    void resumeAudioIfNeeded();
    if (won) {
      playWinChime();
      setConfettiTick((t) => t + 1);
    }
  }, [view, view?.phase, view?.winner, view?.yourSlot, view?.roomCode, view?.rosterSeed]);

  useEffect(() => {
    if (rematchCount === null) {
      rematchEmitGuard.current = false;
      return;
    }
    if (rematchCount <= 0) {
      if (!rematchEmitGuard.current) {
        rematchEmitGuard.current = true;
        socket.emit(SOCKET_EVENTS.rematch);
      }
      setRematchCount(null);
      return;
    }
    const id = window.setTimeout(() => setRematchCount((c) => (c === null ? null : c - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [rematchCount, socket]);

  const joinLink = useMemo(() => {
    if (!view?.roomCode) return "";
    const u = new URL(window.location.href);
    u.searchParams.set("code", view.roomCode);
    return u.toString();
  }, [view?.roomCode]);

  const isAnswerer =
    Boolean(view?.phase === "playing" && view.pendingQuestion && view.yourSlot && view.pendingQuestion.asker !== view.yourSlot);

  /** Turn to type/send a new question (no question waiting for an answer). */
  const isAsker = Boolean(view?.phase === "playing" && view.yourSlot && view.turn === view.yourSlot && !view.pendingQuestion);

  /** You sent the current question and we are waiting for Yes / No / Not sure. */
  const isPendingAsker = Boolean(
    view?.phase === "playing" && view.yourSlot && view.pendingQuestion && view.pendingQuestion.asker === view.yourSlot,
  );

  const turnStrip = useMemo(() => {
    if (!view || view.phase !== "playing" || !view.yourSlot) return "";
    if (view.pendingQuestion) {
      if (isAnswerer) return "You’re up — tap an answer";
      if (isPendingAsker) return "They’re answering your question";
      return "Question on the table";
    }
    if (view.turn === view.yourSlot) return "Your turn to ask";
    return "Their turn to ask";
  }, [view, isAnswerer, isPendingAsker]);

  async function copyDebugInfo() {
    const payload = {
      origin: window.location.origin,
      href: window.location.href,
      socketConnected: socket.connected,
      viteServerUrl: import.meta.env.VITE_SERVER_URL ?? "(default / proxy)",
      roomCode: view?.roomCode ?? null,
      phase: view?.phase ?? null,
      yourSlot: view?.yourSlot ?? null,
      themeId: view?.themeId ?? null,
      difficulty: view?.difficulty ?? null,
      dailyBoard: view?.dailyBoard ?? null,
    };
    const text = JSON.stringify(payload, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      window.alert("Copied debug bundle — paste it in a bug report.");
    } catch {
      window.prompt("Copy this debug text:", text);
    }
  }

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
      window.alert(`We didn’t catch that (“${last}”). Try a clear Oo, Hindi, or Hindi ko alam.`);
    } catch {
      /* ignore */
    }
    setSpeechBusy(false);
  }

  function toggleDown(id: string) {
    setLocalDown((m) => {
      const snap = { ...m };
      queueMicrotask(() => setFlipUndo((u) => [...u.slice(-39), snap]));
      return { ...m, [id]: !m[id] };
    });
  }

  function undoLastFlip() {
    setFlipUndo((u) => {
      if (u.length === 0) return u;
      const snap = u[u.length - 1];
      setLocalDown(snap);
      return u.slice(0, -1);
    });
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
      <OnboardingModal open={showOnboarding} onClose={() => setShowOnboarding(false)} />
      <ConfettiLayer tick={confettiTick} />
      <div className="appShell__decor" aria-hidden="true">
        <span className="appShell__blob appShell__blob--a" />
        <span className="appShell__blob appShell__blob--b" />
        <span className="appShell__blob appShell__blob--c" />
      </div>

      <header className="card card--hero brandHero">
        <p className="brandHero__eyebrow">Play with a friend · online</p>
        <h1 className="brandHero__title">Kinsa Siya?</h1>
        <p className="brandHero__tagline">Silly faces, secret picks, big brain questions — one of you walks away bragging.</p>
      </header>

      {error ? (
        <div className="card card--alert stack" style={{ marginBottom: 12 }}>
          <strong>Oops!</strong> {error}
        </div>
      ) : null}

      {!connected ? (
        <div className="card card--connecting">
          <WaitOpponent title="Almost there…" hint="Getting your table ready." compact />
        </div>
      ) : null}

      {connected && view?.yourSlot ? (
        <div className="card card--room stack">
          <div className="roomBar row">
            <div className="roomBar__badges row">
              <span className="badge badge--glow">Room {view.roomCode}</span>{" "}
              <span className="badge">{THEME_LABELS[view.themeId]}</span>{" "}
              <span className="badge">{view.difficulty === "hard" ? "Voice duel" : "Classic"}</span>
              {view.dailyBoard ? <span className="badge badge--daily">Today’s deck</span> : null}
            </div>
            <div className="roomBar__right row">
              <span className="muted statsPill" title="Stored only on this device">
                {stats.games} games · {stats.wins} wins · streak {stats.streak}
              </span>
              <button type="button" className="danger" onClick={leave}>
                Exit
              </button>
            </div>
          </div>

          {view.phase === "playing" && turnStrip ? (
            <div className="turnStrip" role="status">
              <span className="turnStrip__dot" aria-hidden="true" />
              {turnStrip}
            </div>
          ) : null}

          {view.phase === "lobby" && !view.opponentPresent ? (
            <div className="stack lobbyShare">
              <p className="muted lobbyShare__hint">Text your buddy this code — same game, they paste it in:</p>
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
                  Copy magic link
                </button>
              </div>
              <p className="muted lobbyShare__fineprint">
                Magic link opens the game with the code already inside — or just send the letters, your call.
              </p>
              <WaitOpponent title="Waiting for your partner…" hint="They’re typing the code and hopping in." />
            </div>
          ) : null}

          {view.phase === "setup" ? (
            <div className="stack">
              <h2 className="panelTitle">Pick your secret face</h2>
              <div className="muted">Choose the one you’ll defend — they’ll try to guess who you picked.</div>
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
                  Lock it in!
                </button>
                {!view.secretsReady[view.yourSlot] ? <span className="muted">Tap yours first…</span> : null}
              </div>
              {!view.secretsReady[view.yourSlot === "p1" ? "p2" : "p1"] ? (
                <WaitOpponent compact title="They’re picking…" hint="Give them a sec — choosing a secret face is serious business." />
              ) : null}
            </div>
          ) : null}

          {view.phase === "playing" || view.phase === "ended" ? (
            <div className="stack">
              {view.difficulty === "hard" && view.phase === "playing" ? (
                <VoiceCall socket={socket} enabled={true} polite={Boolean(view.webrtcPolite)} />
              ) : null}

              {view.phase === "playing" && view.difficulty === "standard" && view.pendingQuestion ? (
                <div className="card card--pendingQuestion stack" role="status">
                  <div className="pendingQuestion__label">
                    {isAnswerer ? "Incoming question!" : isPendingAsker ? "You fired this one" : "On the table"}
                  </div>
                  <div className="pendingQuestion__body">
                    <p className="pendingQuestion__text">{view.pendingQuestion.text}</p>
                  </div>
                  {isAnswerer ? (
                    <p className="pendingQuestion__hint">Smash one of the three big buttons — make ’em sweat.</p>
                  ) : isPendingAsker ? (
                    <WaitOpponent compact title="They’re thinking…" hint="They’re picking how to roast your question." />
                  ) : (
                    <p className="pendingQuestion__hint">Hang tight — someone’s about to answer.</p>
                  )}
                </div>
              ) : null}

              {view.phase === "playing" && view.difficulty === "standard" ? (
                <div className="card card--panel stack">
                  <h2 className="panelTitle">Your turn to ask</h2>
                  {isPendingAsker ? (
                    <div className="muted">Nice — after they answer, the mic’s theirs for the next round.</div>
                  ) : isAsker ? (
                    <div className="stack">
                      <textarea rows={3} value={questionText} onChange={(e) => setQuestionText(e.target.value)} placeholder="Ask something they can answer with a yes or no…" />
                      <div className="row">
                        <button
                          type="button"
                          className="primary"
                          disabled={!questionText.trim()}
                          onClick={() => {
                            const t = questionText.trim();
                            if (!t) return;
                            socket.emit(SOCKET_EVENTS.askQuestion, { text: t });
                            setQuestionText("");
                          }}
                        >
                          Send it!
                        </button>
                        <button type="button" disabled={speechBusy || !getSpeechRecognition()} onClick={onSpeechQuestion}>
                          {speechBusy ? "Listening…" : "Say it out loud"}
                        </button>
                      </div>
                    </div>
                  ) : isAnswerer ? (
                    <div className="muted">Your spotlight — tap an answer and keep the drama going.</div>
                  ) : (
                    <WaitOpponent compact title="Their turn to ask" hint="They’re cooking up something sneaky." />
                  )}

                  {isAnswerer ? (
                    <div className="row answerRow">
                      <button type="button" className="primary answerBtn" onClick={() => socket.emit(SOCKET_EVENTS.answer, { value: "yes" })}>
                        {view.answerLabels.yes}
                      </button>
                      <button type="button" className="primary answerBtn" onClick={() => socket.emit(SOCKET_EVENTS.answer, { value: "no" })}>
                        {view.answerLabels.no}
                      </button>
                      <button type="button" className="primary answerBtn" onClick={() => socket.emit(SOCKET_EVENTS.answer, { value: "not_sure" })}>
                        {view.answerLabels.not_sure}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {view.phase === "playing" && view.difficulty === "hard" ? (
                <div className="card card--panel stack">
                  <h2 className="panelTitle">Voice duel</h2>
                  <div className="muted">Yap on the call, read the room, then nudge the round forward with the buttons.</div>
                  {isAsker ? (
                    <div className="row">
                      <button type="button" className="primary" onClick={() => socket.emit(SOCKET_EVENTS.askQuestion, { text: "" })}>
                        I’m done asking
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
                        {speechBusy ? "Listening…" : "Toss in a voice note (optional)"}
                      </button>
                    </div>
                  ) : isAnswerer ? (
                    <div className="muted">Chat it out, then seal it with the big button:</div>
                  ) : (
                    <WaitOpponent compact title="Hold tight" hint="They’re warming up the voice chaos." />
                  )}
                  {isAnswerer ? (
                    <button type="button" className="primary" disabled={speechBusy || !getSpeechRecognition()} onClick={onSpeechAnswerHard}>
                      {speechBusy ? "Listening…" : "Shout your answer (Oo / Hindi / Hindi ko alam)"}
                    </button>
                  ) : null}
                </div>
              ) : null}

              {view.difficulty === "standard" && view.phase === "playing" ? (
                <div className="card card--panel stack">
                  <h2 className="panelTitle">The replay</h2>
                  <div className="history">
                    {view.qaHistory.length === 0 ? (
                      <div className="historyEmpty muted">Nothing here yet — start roasting each other with questions and it fills up fast.</div>
                    ) : null}
                    {view.qaHistory.map((h, idx) => (
                      <div key={idx} className="historyItem">
                        <div>
                          <span className="muted">{h.asker === view.yourSlot ? "You went" : "They went"}:</span> {h.questionText}
                        </div>
                        <div>
                          <span className="muted">{h.asker === view.yourSlot ? "They said" : "You said"}:</span>{" "}
                          {view.answerLabels[h.answer]}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <h2 className="panelTitle">Your wall of faces</h2>
              <div className="row" style={{ marginBottom: 8 }}>
                <label className="row" style={{ gap: 8 }}>
                  <input type="checkbox" checked={guessMode} onChange={(e) => setGuessMode(e.target.checked)} />
                  <span className="muted">Guess mode — flip this on, tap a face, go for glory.</span>
                </label>
                {view.phase === "playing" && !guessMode ? (
                  <button type="button" className="btn-ghost" disabled={flipUndo.length === 0} onClick={undoLastFlip}>
                    Undo last flip
                  </button>
                ) : null}
              </div>
              <div className="muted">Off guess mode? Tap tiles to flip faces you’ve ruled out.</div>
              <div className="grid24">
                {view.roster.map((c) => (
                  <AvatarTile key={c.id} character={c} down={Boolean(localDown[c.id])} isSelf={mySecretId === c.id} onClick={() => onTileClick(c.id)} />
                ))}
              </div>

              {view.phase === "playing" ? (
                <div className="card card--panel stack">
                  <h2 className="panelTitle">Call the shot</h2>
                  <div className="muted">Flip on guess mode, pick the face you dare call — wrong call and you’re toast.</div>
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
                      That’s my final answer!
                    </button>
                    {guessPick ? <span className="muted">Locked on that one 👀</span> : null}
                  </div>
                </div>
              ) : null}

              {view.phase === "ended" ? (
                <div className="card card--matchEnd stack">
                  <h2 className="panelTitle panelTitle--end">Round’s over!</h2>
                  <div>
                    Bragging rights: <strong>{view.winner === view.yourSlot ? "You!" : "Them!"}</strong>
                  </div>
                  {view.reveal ? (
                    <div className="muted">
                      Both secret faces are spilled — scroll your boards if you want the receipts.
                      <div style={{ fontSize: "0.85rem", marginTop: 6, opacity: 0.85 }}>
                        {view.reveal.p1SecretId} · {view.reveal.p2SecretId}
                      </div>
                    </div>
                  ) : null}
                  {view.lastGuess ? (
                    <div className="muted">
                      Final swing was {view.lastGuess.correct ? "spot on" : "a miss"}.
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className="primary"
                    disabled={rematchCount !== null}
                    onClick={() => setRematchCount(3)}
                  >
                    {rematchCount !== null ? `Get ready… ${rematchCount}` : "Run it back!"}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {connected && !view?.yourSlot ? (
        <div className="card card--play stack playPanel">
          <h2 className="panelTitle playPanel__title">Jump in</h2>
          <div className="row">
            <label className="muted">Vibe pack</label>
            <select value={themeId} onChange={(e) => setThemeId(e.target.value as ThemeId)}>
              <option value="celebrities">{THEME_LABELS.celebrities}</option>
              <option value="government">{THEME_LABELS.government}</option>
              <option value="cartoons">{THEME_LABELS.cartoons}</option>
            </select>
          </div>
          <div className="row">
            <label className="muted">Energy level</label>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
              <option value="standard">Classic — type, talk, big buttons, full replay</option>
              <option value="hard">Chaos voice — live call, no paper trail</option>
            </select>
          </div>
          <label className="row muted" style={{ alignItems: "center", gap: 10 }}>
            <input type="checkbox" checked={useDailyBoard} onChange={(e) => setUseDailyBoard(e.target.checked)} />
            Today’s deck (same faces for everyone until UTC midnight — great for comparing with friends online)
          </label>
          <label className="row muted" style={{ alignItems: "center", gap: 10 }}>
            <input
              type="checkbox"
              checked={soundOn}
              onChange={(e) => {
                const on = e.target.checked;
                setSoundOn(on);
                saveSoundEnabled(on);
                if (on) void resumeAudioIfNeeded();
              }}
            />
            Tiny sound effects (respects reduced motion for confetti; chimes stay off if you disable this)
          </label>
          <button type="button" className="btn-ghost" onClick={() => setShowOnboarding(true)}>
            Show how to play again
          </button>
          {difficulty === "standard" ? (
            <details className="customReplies">
              <summary>Fancy answer buttons (totally optional)</summary>
              <p className="muted customReplies__help">
                Rename the three taps (yep / nope / shrug vibes). Still the same game — voice cheats still work with Oo, Hindi, Hindi ko alam.
              </p>
              <div className="stack customReplies__fields">
                <label className="row customReplies__row">
                  <span className="muted customReplies__fieldLabel">Happy tap</span>
                  <input
                    value={replyYes}
                    onChange={(e) => setReplyYes(e.target.value)}
                    placeholder={DEFAULT_ANSWER_LABELS.yes}
                    maxLength={28}
                    aria-label="Label for yes-type answer"
                  />
                </label>
                <label className="row customReplies__row">
                  <span className="muted customReplies__fieldLabel">Nope tap</span>
                  <input
                    value={replyNo}
                    onChange={(e) => setReplyNo(e.target.value)}
                    placeholder={DEFAULT_ANSWER_LABELS.no}
                    maxLength={28}
                    aria-label="Label for no-type answer"
                  />
                </label>
                <label className="row customReplies__row">
                  <span className="muted customReplies__fieldLabel">Shrug tap</span>
                  <input
                    value={replyUnsure}
                    onChange={(e) => setReplyUnsure(e.target.value)}
                    placeholder={DEFAULT_ANSWER_LABELS.not_sure}
                    maxLength={28}
                    aria-label="Label for unsure-type answer"
                  />
                </label>
              </div>
            </details>
          ) : null}
          <div className="row">
            <button
              type="button"
              className="primary"
              onClick={() =>
                socket.emit(SOCKET_EVENTS.createRoom, {
                  themeId,
                  difficulty,
                  useDailyBoard,
                  answerLabels: normalizeAnswerLabels(
                    difficulty === "standard" ? { yes: replyYes, no: replyNo, not_sure: replyUnsure } : undefined,
                  ),
                })
              }
            >
              Start a room
            </button>
          </div>
          <div className="row">
            <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="TYPE THE CODE" />
            <button type="button" className="primary" disabled={joinCode.length < 4} onClick={() => socket.emit(SOCKET_EVENTS.joinRoom, { code: joinCode })}>
              Drop in
            </button>
          </div>
          <div className="muted">Voice mode loves headphones — grab a pair if you can.</div>
          <p className="muted privacyBlurb">
            <strong>Cartoon crew</strong> is procedural art. <strong>Celebrities</strong> / <strong>Government officials</strong> use Wikimedia Commons portrait links (public-domain or federal work where noted on each file page)—not scraped social photos. Match chatter isn’t kept as a transcript; we only sync the game state for your room.
          </p>
          <button type="button" className="btn-ghost" onClick={() => void copyDebugInfo()}>
            Copy debug info for bug reports
          </button>
        </div>
      ) : null}
    </div>
  );
}
