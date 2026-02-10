import React, { useEffect, useState, useRef } from "react";

const LOADING_MESSAGES = [
  "Warming up the engines...",
  "Syncing inventory data...",
  "Loading dashboard...",
  "Connecting to database...",
  "Almost ready...",
  "Preparing your workspace...",
];

const GEAR_TEETH = 8;

function GearPath({ numTeeth }: { numTeeth: number }) {
  const R = 34;
  const r = 24;
  const toothH = 4;
  const pts: string[] = [];
  const steps = numTeeth * 2;
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2 - Math.PI / 2;
    const isTooth = i % 2 === 0;
    const rad = isTooth ? R + toothH : r;
    const x = 40 + Math.cos(angle) * rad;
    const y = 40 + Math.sin(angle) * rad;
    pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  pts.push("Z");
  return <path d={pts.join(" ")} fill="none" stroke="currentColor" strokeWidth="2.5" />;
}

export default function LoadingScreen({ minDisplay = 1800 }: { minDisplay?: number }) {
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);
  const [msgIdx, setMsgIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const msgInterval = setInterval(() => {
      setMsgIdx((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 500);

    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const pct = Math.min((elapsed / minDisplay) * 100, 100);
      setProgress(pct);
    }, 50);

    const timer = setTimeout(() => {
      clearInterval(msgInterval);
      clearInterval(progressInterval);
      setExiting(true);
      setTimeout(() => setVisible(false), 500);
    }, minDisplay);

    return () => {
      clearTimeout(timer);
      clearInterval(msgInterval);
      clearInterval(progressInterval);
    };
  }, [minDisplay]);

  if (!visible) return null;

  return (
    <div className={`loading-screen${exiting ? " exiting" : ""}`} role="status" aria-label="Loading">
      <div className="loading-gears">
        <div className="loading-gear-glow" />
        <div className="loading-gear loading-gear-1">
          <GearPath numTeeth={GEAR_TEETH} />
        </div>
        <div className="loading-gear loading-gear-2">
          <GearPath numTeeth={6} />
        </div>
        <div className="loading-gear loading-gear-3" />
      </div>
      <div className="loading-progress-track">
        <div className="loading-progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="loading-percent" style={{ opacity: Math.min(progress / 30 + 0.3, 1) }}>
        {Math.round(progress)}%
      </div>
      <div className="loading-message" key={msgIdx} style={{ animation: "fadeInUp 0.35s ease both" }}>
        {LOADING_MESSAGES[msgIdx]}
      </div>
    </div>
  );
}
