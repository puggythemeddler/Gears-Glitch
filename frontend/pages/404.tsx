import Link from "next/link";

function NotFoundMascot() {
  return (
    <svg viewBox="0 0 240 220" width="200" height="184" className="nf-mascot">
      {/* Question marks floating around */}
      <g className="nf-q q1" fontSize="24" fontWeight="800" fill="var(--warning)">
        <text x="30" y="50">?</text>
      </g>
      <g className="nf-q q2" fontSize="18" fontWeight="800" fill="var(--primary)">
        <text x="190" y="40">?</text>
      </g>
      <g className="nf-q q3" fontSize="14" fontWeight="800" fill="var(--warning)">
        <text x="160" y="80">?</text>
      </g>

      {/* Gear-head mascot — confused, looking around */}
      <g className="nf-char">
        {/* torso */}
        <rect x="80" y="120" width="64" height="56" rx="18" fill="var(--surface)" stroke="var(--border)" strokeWidth="2.5" />
        {/* feet */}
        <rect x="86" y="172" width="20" height="14" rx="7" fill="var(--surface)" stroke="var(--border)" strokeWidth="2" />
        <rect x="118" y="172" width="20" height="14" rx="7" fill="var(--surface)" stroke="var(--border)" strokeWidth="2" />
        {/* arms — one hand on hip, other scratching head */}
        <path d="M80 136 Q60 144 58 160" fill="none" stroke="var(--primary)" strokeWidth="9" strokeLinecap="round" />
        <g className="nf-scratch">
          <path d="M144 136 Q164 124 168 106" fill="none" stroke="var(--primary)" strokeWidth="9" strokeLinecap="round" />
          <circle cx="168" cy="102" r="6" fill="var(--primary)" />
        </g>
        {/* head */}
        <g className="nf-head">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <rect key={a} x="96.5" y="46" width="7" height="10" rx="2" fill="var(--primary)" transform={`rotate(${a} 112 80)`} />
          ))}
          <circle cx="112" cy="80" r="28" fill="var(--primary)" />
          <circle cx="112" cy="80" r="20" fill="var(--surface)" />
          <circle cx="112" cy="80" r="7.5" fill="var(--primary)" />
          <circle cx="112" cy="80" r="3.5" fill="var(--surface)" />
          {/* confused face — one eyebrow up, one down, squiggly mouth */}
          <path d="M100 72 l4 -4" stroke="var(--text)" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M120 72 l4 3" stroke="var(--text)" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="103" cy="77" r="2.6" fill="var(--text)" />
          <circle cx="121" cy="77" r="2.6" fill="var(--text)" />
          <path d="M104 90 q4 3 8 0 q4 -3 8 0" fill="none" stroke="var(--text)" strokeWidth="2" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  );
}

export default function Custom404() {
  return (
    <div style={{ textAlign: "center", padding: "4rem 1rem" }}>
      <NotFoundMascot />
      <h1 style={{ fontSize: "3rem", fontWeight: 800, margin: "1rem 0 0.5rem" }}>404</h1>
      <p style={{ fontSize: "1.1rem", color: "var(--text-secondary)", margin: "0 0 1.5rem" }}>
        This page doesn&apos;t exist — or it&apos;s been moved.
      </p>
      <Link href="/" className="btn btn-primary">Back to shop</Link>
    </div>
  );
}