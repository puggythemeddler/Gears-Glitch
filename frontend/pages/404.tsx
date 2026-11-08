import Link from "next/link";
import GearHeadTorso from "@/components/GearHeadTorso";
import SiteMascotFace from "@/components/SiteMascotFace";
import { useLayout } from "@/layouts";

function NotFoundMascot() {
  const { mascot } = useLayout();
  if (mascot === "none") return null;
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
        <GearHeadTorso x={80} y={120} width={64} height={56} />
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
          <g transform="translate(112 80) scale(.7)">
            <SiteMascotFace variant={mascot} expression="curious" />
          </g>
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
