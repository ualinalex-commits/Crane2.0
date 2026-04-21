import React from 'react';

const SECTION_H = 500;
const DURATION_S = 20; // 500px ÷ 25px/s

interface SectionProps {
  offsetY: number;
}

function MastSection({ offsetY }: SectionProps) {
  const left = 22;
  const right = 58;
  const panelH = 100;
  const numPanels = 5;

  return (
    <g>
      {/* Vertical rails */}
      <line x1={left} y1={offsetY} x2={left} y2={offsetY + SECTION_H} strokeWidth="3" />
      <line x1={right} y1={offsetY} x2={right} y2={offsetY + SECTION_H} strokeWidth="3" />

      {/* Horizontal girts */}
      {Array.from({ length: numPanels + 1 }).map((_, i) => {
        const y = offsetY + i * panelH;
        return <line key={`g${i}`} x1={left} y1={y} x2={right} y2={y} strokeWidth="2" />;
      })}

      {/* X cross-bracing per panel */}
      {Array.from({ length: numPanels }).map((_, i) => {
        const y1 = offsetY + i * panelH;
        const y2 = offsetY + (i + 1) * panelH;
        return (
          <g key={`x${i}`}>
            <line x1={left} y1={y1} x2={right} y2={y2} strokeWidth="1.5" />
            <line x1={right} y1={y1} x2={left} y2={y2} strokeWidth="1.5" />
          </g>
        );
      })}
    </g>
  );
}

export function CraneMastBackground() {
  // 8 sections = 4000px — covers any viewport even at max animation offset
  const numSections = 8;

  return (
    <div
      className="pointer-events-none"
      style={{
        position: 'fixed',
        top: 0,
        right: '8%',
        width: 80,
        height: '100vh',
        overflow: 'hidden',
        zIndex: 0,
      }}
    >
      <div
        style={{
          animation: `craneMastScroll ${DURATION_S}s linear infinite`,
          willChange: 'transform',
        }}
      >
        <svg
          width={80}
          height={numSections * SECTION_H}
          fill="none"
          stroke="#1E3A5F"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ opacity: 0.10 }}
        >
          {Array.from({ length: numSections }).map((_, i) => (
            <MastSection key={i} offsetY={i * SECTION_H} />
          ))}
        </svg>
      </div>
    </div>
  );
}
