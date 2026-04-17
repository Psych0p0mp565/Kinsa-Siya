import { dismissOnboarding } from "../lib/onboarding.js";

export function OnboardingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true" aria-labelledby="onb-title">
      <div className="modalCard card stack">
        <h2 id="onb-title" className="panelTitle">
          Welcome to Kinsa Siya?
        </h2>
        <p className="muted">
          One of you starts a room and sends the <strong>6-character code</strong> to a friend. You each pick a secret face, then take turns asking yes/no questions and flipping tiles until
          someone dares to guess.
        </p>
        <ul className="onboardingList">
          <li>
            <strong>Classic</strong> — typed questions, big answer buttons, full replay.
          </li>
          <li>
            <strong>Chaos voice</strong> — live call; use headphones and mute between turns if you hear echo.
          </li>
          <li>
            <strong>Today’s deck</strong> (optional) — same cartoon lineup for everyone, resets at midnight UTC.
          </li>
        </ul>
        <p className="muted" style={{ fontSize: "0.9rem" }}>
          <strong>Cartoon crew</strong> uses goofy generated mugshots. <strong>Historic icons</strong> (PD portraits) and <strong>Government officials</strong> load curated
          Wikimedia Commons files (not paparazzi or random web scraping). Nothing you type is stored on our servers after the match.
        </p>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button
            type="button"
            className="primary"
            onClick={() => {
              dismissOnboarding();
              onClose();
            }}
          >
            Let’s play
          </button>
        </div>
      </div>
    </div>
  );
}
