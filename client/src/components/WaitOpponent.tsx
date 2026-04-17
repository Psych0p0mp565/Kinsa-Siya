/** Animated “waiting for the other player” block. */
export function WaitOpponent({
  title,
  hint,
  compact = false,
}: {
  title: string;
  hint?: string;
  compact?: boolean;
}) {
  return (
    <div className={`waitOpponent${compact ? " waitOpponent--compact" : ""}`} role="status" aria-live="polite">
      <div className="waitOpponent__visual" aria-hidden="true">
        <span className="waitOpponent__ring" />
        {!compact ? (
          <div className="waitOpponent__dots">
            <span />
            <span />
            <span />
          </div>
        ) : null}
      </div>
      <div className="waitOpponent__copy">
        <strong className="waitOpponent__title">{title}</strong>
        {hint ? <span className="waitOpponent__hint muted">{hint}</span> : null}
      </div>
    </div>
  );
}
