import { useEffect, useState } from "react";

const CONFETTI_COLORS = [
  "var(--primary)",
  "var(--success)",
  "var(--warning)",
  "#f97316",
  "#60a5fa",
  "#a78bfa",
  "#f472b6",
];

function ConfettiPiece({ color, delay, x, rotation, size }: { color: string; delay: number; x: number; rotation: number; size: number }) {
  return (
    <div
      className="confetti-piece"
      style={{
        left: `${x}%`,
        width: size,
        height: size * 0.6,
        backgroundColor: color,
        borderRadius: size > 6 ? 2 : "50%",
        animationDelay: `${delay}s`,
        transform: `rotate(${rotation}deg)`,
      }}
    />
  );
}

function MascotThumbsUp() {
  return (
    <svg viewBox="0 0 200 220" width="160" height="176" className="oc-mascot">
      {/* Body */}
      <rect x="60" y="120" width="80" height="70" rx="20" fill="var(--surface)" stroke="var(--border)" strokeWidth="2.5" />
      {/* Head */}
      <g className="oc-head">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <rect
            key={a}
            x="87.5"
            y="40"
            width="7"
            height="10"
            rx="2"
            fill="var(--primary)"
            transform={`rotate(${a} 100 82)`}
          />
        ))}
        <circle cx="100" cy="82" r="30" fill="var(--primary)" />
        <circle cx="100" cy="82" r="22" fill="var(--surface)" />
        <circle cx="100" cy="82" r="8.5" fill="var(--primary)" />
        <circle cx="100" cy="82" r="4" fill="var(--surface)" />
        {/* Happy face */}
        <circle cx="90" cy="76" r="3" fill="var(--text)" />
        <circle cx="110" cy="76" r="3" fill="var(--text)" />
        <circle cx="91" cy="74.5" r="1.2" fill="var(--bg)" />
        <circle cx="111" cy="74.5" r="1.2" fill="var(--bg)" />
        <path d="M88 90 q12 10 24 0" fill="none" stroke="var(--text)" strokeWidth="2.5" strokeLinecap="round" />
      </g>
      {/* Thumbs-up arm */}
      <g className="oc-thumbs">
        <path d="M140 140 Q160 120 158 96" fill="none" stroke="var(--primary)" strokeWidth="10" strokeLinecap="round" />
        {/* Hand */}
        <circle cx="158" cy="90" r="10" fill="var(--primary)" />
        {/* Thumb */}
        <rect x="154" y="68" width="9" height="22" rx="4.5" fill="var(--primary)" />
        <rect x="154" y="68" width="9" height="10" rx="4.5" fill="var(--surface)" />
      </g>
      {/* Other arm */}
      <path d="M60 140 Q40 155 36 172" fill="none" stroke="var(--primary)" strokeWidth="10" strokeLinecap="round" />
    </svg>
  );
}

export default function OrderCelebrationAnimation({ onDone }: { onDone?: () => void }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, 4200);
    return () => clearTimeout(timer);
  }, [onDone]);

  if (!visible) return null;

  const pieces = Array.from({ length: 40 }, (_, i) => ({
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    delay: (i * 0.07) + Math.random() * 0.3,
    x: Math.random() * 100,
    rotation: Math.random() * 360,
    size: 5 + Math.random() * 6,
  }));

  return (
    <div className="oc-overlay" aria-hidden="true">
      <div className="oc-confetti">
        {pieces.map((p, i) => (
          <ConfettiPiece key={i} {...p} />
        ))}
      </div>
      <div className="oc-center">
        <div className="oc-badge">Order placed!</div>
        <MascotThumbsUp />
      </div>
    </div>
  );
}