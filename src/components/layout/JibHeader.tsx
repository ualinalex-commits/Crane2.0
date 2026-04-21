import React from 'react';

/**
 * JibHeader — horizontal tower-crane jib that sits above the desktop
 * app header. Thin line-art schematic with an orange trolley that loops
 * left → right linearly and a hook that sways as a pendulum with an
 * offset cadence for weight.
 *
 * Usage (inside AppLayout):
 *   <JibHeader />           // full-width, 56px tall
 *   <JibHeader height={48}/>
 *
 * The component is fully self-contained — animations live in index.css
 * (.animate-jib-trolley / .animate-jib-hook, @keyframes jibTrolley /
 * jibHookSway). If you drop JibHeader into a different project, copy
 * those keyframes too.
 */

interface JibHeaderProps {
  /** Height of the strip in px. Default 56. */
  height?: number;
  /** Travel distance of the trolley, as a px number or any CSS length.
   *  Default '72%' — works on any container width. */
  travel?: string | number;
  /** Omit the warning-stripe underline (use when header has its own border). */
  hideUnderline?: boolean;
  /** Extra class names for the outer container. */
  className?: string;
}

export function JibHeader({
  height = 56,
  travel = '72%',
  hideUnderline = false,
  className = '',
}: JibHeaderProps) {
  const travelVar = typeof travel === 'number' ? `${travel}px` : travel;

  return (
    <div
      className={`relative overflow-hidden bg-background border-b border-border ${className}`}
      style={{ height }}
      aria-hidden="true"
    >
      {/* Warning-stripe baseline — subtle nod to site hazard tape */}
      {!hideUnderline && (
        <div
          className="absolute bottom-0 left-0 right-0 h-[3px] opacity-50"
          style={{
            background:
              'repeating-linear-gradient(-45deg, oklch(0.87 0.07 50) 0 6px, oklch(0.981 0.006 70) 6px 12px)',
          }}
        />
      )}

      {/* Static jib schematic — fills container, preserves aspect */}
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 800 ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 block text-foreground"
      >
        {/* ── Mast stub descending from left ───────────────────────── */}
        <line x1="60" y1="0" x2="60" y2={height - 4} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="50" y1="0" x2="50" y2={height - 4} stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.55" />
        <line x1="70" y1="0" x2="70" y2={height - 4} stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.55" />
        {/* Cross bracing on mast */}
        {[[10, 22], [22, 10], [34, 46], [46, 34]].map(([a, b], i) => (
          <line key={i} x1="50" y1={a} x2="70" y2={b} stroke="currentColor" strokeWidth="0.9" opacity="0.5" />
        ))}

        {/* ── Counter-jib stub + ballast ───────────────────────────── */}
        <line x1="20" y1="18" x2="60" y2="18" stroke="currentColor" strokeWidth="1.6" />
        <line x1="20" y1="28" x2="60" y2="28" stroke="currentColor" strokeWidth="1.6" />
        <line x1="20" y1="18" x2="20" y2="28" stroke="currentColor" strokeWidth="1.6" />
        <line x1="30" y1="18" x2="30" y2="28" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
        <line x1="45" y1="18" x2="45" y2="28" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
        <rect x="18" y="28" width="14" height="10" fill="currentColor" />

        {/* ── Main jib truss — top + bottom chord, tip cap ─────────── */}
        <line x1="60" y1="18" x2="770" y2="18" stroke="currentColor" strokeWidth="1.8" />
        <line x1="60" y1="28" x2="770" y2="28" stroke="currentColor" strokeWidth="1.8" />
        <line x1="770" y1="18" x2="770" y2="28" stroke="currentColor" strokeWidth="1.8" />

        {/* Diagonal bracing — /\/\/\ */}
        {Array.from({ length: 28 }).map((_, i) => {
          const x1 = 60 + i * 25;
          const x2 = x1 + 25;
          if (x2 > 770) return null;
          return (
            <g key={i} opacity="0.5">
              <line x1={x1} y1="28" x2={x1 + 12.5} y2="18" stroke="currentColor" strokeWidth="0.9" />
              <line x1={x1 + 12.5} y1="18" x2={x2} y2="28" stroke="currentColor" strokeWidth="0.9" />
            </g>
          );
        })}

        {/* Tie-bar pendants — mast top to jib */}
        <line x1="60" y1="2" x2="280" y2="18" stroke="currentColor" strokeWidth="0.9" opacity="0.5" />
        <line x1="60" y1="2" x2="500" y2="18" stroke="currentColor" strokeWidth="0.9" opacity="0.5" />
        <line x1="60" y1="2" x2="720" y2="18" stroke="currentColor" strokeWidth="0.9" opacity="0.5" />

        {/* Jib tip pulley */}
        <circle cx="766" cy="23" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.2" />
      </svg>

      {/* ── Trolley + hook — animated, left-anchored ────────────────── */}
      <div
        className="absolute top-0 animate-jib-trolley"
        style={{
          left: '11%',        // clears the mast
          height: '100%',
          width: 0,
          // @ts-ignore — CSS var passthrough
          '--jib-travel': travelVar,
        } as React.CSSProperties}
      >
        {/* Trolley body */}
        <svg
          width="36"
          height={height}
          viewBox={`0 0 36 ${height}`}
          className="absolute top-0 overflow-visible"
          style={{ left: -18 }}
        >
          <circle cx="10" cy="18" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-foreground" />
          <circle cx="26" cy="18" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-foreground" />
          {/* Trolley chassis — primary orange */}
          <rect x="6" y="20" width="24" height="10" className="fill-primary stroke-foreground" strokeWidth="0.8" />
          <circle cx="18" cy="30" r="1.6" className="fill-foreground" />
        </svg>

        {/* Hook rope + block — swings as pendulum */}
        <div
          className="absolute animate-jib-hook"
          style={{ left: 0, top: 30 }}
        >
          <div className="mx-auto bg-foreground" style={{ width: 1.2, height: height - 36 }} />
          <svg width="14" height="12" viewBox="0 0 14 12" className="block mx-auto -mt-px">
            <rect x="3" y="0" width="8" height="5" className="fill-foreground" opacity="0.85" />
            <path d="M7 5 v3 a3 3 0 1 0 3 0" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" className="text-foreground" />
          </svg>
        </div>
      </div>
    </div>
  );
}

export default JibHeader;
