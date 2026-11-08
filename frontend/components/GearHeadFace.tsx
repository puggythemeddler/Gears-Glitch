import type { ReactNode } from "react";

export type GearHeadExpression = "listening" | "concerned" | "hopeful" | "celebrating" | "curious" | "worried";

const expressionDetails: Record<GearHeadExpression, { brows: ReactNode; mouth: ReactNode; gaze: number }> = {
  listening: {
    brows: <><path d="M-16 -12 Q-11 -16 -6 -12" /><path d="M5 -13 Q10 -16 16 -11" /></>,
    mouth: <path d="M-7 14 Q0 18 7 13" />,
    gaze: 2,
  },
  concerned: {
    brows: <><path d="M-16 -13 Q-11 -9 -6 -12" /><path d="M5 -12 Q10 -9 16 -14" /></>,
    mouth: <path d="M-7 16 Q0 9 7 16" />,
    gaze: 0,
  },
  hopeful: {
    brows: <><path d="M-16 -13 Q-11 -16 -6 -13" /><path d="M5 -13 Q10 -16 16 -13" /></>,
    mouth: <path d="M-8 12 Q0 20 8 12" />,
    gaze: 0,
  },
  celebrating: {
    brows: <><path d="M-16 -14 Q-11 -17 -6 -14" /><path d="M5 -14 Q10 -17 16 -14" /></>,
    mouth: <><path d="M-9 10 Q0 22 9 10 Z" fill="var(--text)" stroke="none" /><path d="M-5 16 Q0 18 5 16" stroke="var(--surface)" /></>,
    gaze: 0,
  },
  curious: {
    brows: <><path d="M-16 -12 Q-11 -14 -6 -12" /><path d="M5 -16 Q11 -19 16 -13" /></>,
    mouth: <ellipse cx="2" cy="14" rx="3.5" ry="4.5" fill="var(--text)" stroke="none" />,
    gaze: 3,
  },
  worried: {
    brows: <><path d="M-16 -15 Q-11 -9 -6 -11" /><path d="M5 -11 Q10 -9 16 -15" /></>,
    mouth: <path d="M-6 16 Q0 12 6 16" />,
    gaze: -1,
  },
};

function createGearPath() {
  const points: string[] = [];
  for (let tooth = 0; tooth < 8; tooth += 1) {
    const center = -90 + tooth * 45;
    const tipRadius = tooth === 0 ? 43 : 40;
    const profile: Array<[number, number]> = [
      [-23, 33], [-15, 33], [-15, tipRadius], [15, tipRadius], [15, 33], [23, 33],
    ];
    for (const [offset, radius] of profile) {
      const angle = ((center + offset) * Math.PI) / 180;
      points.push(`${Math.cos(angle) * radius} ${Math.sin(angle) * radius}`);
    }
  }
  return `M${points.join(" L")} Z`;
}

const gearPath = createGearPath();

/** A shared, crisp vector face: keep the orange gear and vary the expression by context. */
export default function GearHeadFace({ expression }: { expression: GearHeadExpression }) {
  const details = expressionDetails[expression];

  return (
    <g className={`gearhead-face gearhead-face--${expression}`}>
      {/* One longer top tooth and an offset amber service beacon give the silhouette a signature. */}
      <path d="M17 -34 Q20 -42 28 -46" fill="none" stroke="var(--primary)" strokeWidth="5" strokeLinecap="round" />
      <circle cx="30" cy="-47" r="4.5" fill="var(--warning)" />
      <path d={gearPath} fill="var(--primary)" />
      <circle cx="0" cy="0" r="28.5" fill="var(--surface)" stroke="var(--text-tertiary)" strokeOpacity="0.48" strokeWidth="1.4" />
      {/* Offset cheek plate and bolts keep the face from reading as a generic round robot. */}
      <path d="M-27 -8 Q-34 -7 -34 1 Q-34 8 -27 10" fill="none" stroke="var(--warning)" strokeWidth="4" strokeLinecap="round" />
      <circle cx="-22" cy="-20" r="2" fill="var(--on-primary)" />
      <circle cx="22" cy="-20" r="2" fill="var(--on-primary)" />
      {/* Brows and mouth stay expressive while the eye groups share the reduced-motion-safe blink. */}
      <g fill="none" stroke="var(--text)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        {details.brows}
        {details.mouth}
      </g>
      {([-1, 1] as const).map((side) => (
        <g key={side} transform={`translate(${side * 10 + details.gaze} -3)`}>
          <g className="mascot-eye">
            <ellipse cx="0" cy="0" rx="4.2" ry="5.3" fill="var(--text)" />
            <circle cx="1.1" cy="-1.8" r="1.2" fill="var(--surface)" />
          </g>
        </g>
      ))}
      <path d="M-21 16 Q-18 18 -15 16" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
      <path d="M15 16 Q18 18 21 16" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
    </g>
  );
}
