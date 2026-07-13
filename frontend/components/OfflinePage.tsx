import { useState, useEffect } from "react";

function Gear({ className, phase }: { className: string; phase: "checking" | "offline" }) {
  const sad = phase === "offline";
  return (
    <div className={`gear ${className} ${phase}`}>
      <svg viewBox="-50 -50 100 100" width="140" height="140" className="gear-svg">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <rect
            key={a}
            x="-7"
            y="-52"
            width="14"
            height="14"
            rx="2"
            fill="currentColor"
            transform={`rotate(${a})`}
          />
        ))}
        <circle r="38" fill="currentColor" />
        <circle r="30" fill="var(--bg)" />
        <circle r="9" fill="currentColor" />
        <circle r="5" fill="var(--bg)" />

        {sad && (
          <>
            <circle cx="-14" cy="-10" r="3.5" fill="var(--text)" />
            <circle cx="14" cy="-10" r="3.5" fill="var(--text)" />
            <path d="M-12 10 Q0 22 12 10" fill="none" stroke="var(--text)" strokeWidth="2.5" strokeLinecap="round" />
            <g className="tear-group">
              <ellipse cx="-18" cy="-2" rx="2.5" ry="5" fill="#60a5fa" className="tear" />
              <ellipse cx="18" cy="-2" rx="2.5" ry="5" fill="#60a5fa" className="tear" />
            </g>
          </>
        )}
      </svg>
    </div>
  );
}

export default function OfflinePage({ dismissing }: { dismissing?: boolean }) {
  const [phase, setPhase] = useState<"checking" | "offline">("checking");

  useEffect(() => {
    if (dismissing) return;
    const t = setTimeout(() => setPhase("offline"), 2200);
    return () => clearTimeout(t);
  }, [dismissing]);

  return (
    <div className={`offline-overlay ${dismissing ? "dismissing" : ""}`}>
      <div className={`offline-container ${dismissing ? "dismissing" : ""}`}>
        <div className="gears-wrapper">
          <Gear className="gear-left" phase={dismissing ? "checking" : phase} />
          <Gear className="gear-right" phase={dismissing ? "checking" : phase} />
        </div>
        {!dismissing && (
          <>
            <p className="offline-msg">seems we&apos;ve lost connection</p>
            <p className="offline-sub">Check your connection and try again</p>
          </>
        )}
      </div>
    </div>
  );
}
