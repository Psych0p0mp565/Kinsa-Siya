import { useMemo, type CSSProperties } from "react";

export function ConfettiLayer({ tick }: { tick: number }) {
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pieces = useMemo(
    () =>
      Array.from({ length: reduced ? 0 : 36 }, (_, i) => ({
        key: i,
        left: `${(i * 37) % 100}%`,
        delay: `${(i % 7) * 0.04}s`,
        hue: (i * 41) % 360,
        dur: `${1.8 + (i % 5) * 0.15}s`,
      })),
    [reduced, tick],
  );

  if (tick === 0 || reduced) return null;

  return (
    <div className="confettiLayer" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={`${tick}-${p.key}`}
          className="confettiParticle"
          style={
            {
              left: p.left,
              animationDelay: p.delay,
              animationDuration: p.dur,
              background: `hsl(${p.hue} 85% 60%)`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
