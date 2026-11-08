import SiteMascotFace from "@/components/SiteMascotFace";
import { useLayout } from "@/layouts";

function SantaGearHead({ mascot }: { mascot: import("@/lib/mascots").MascotId }) {
  if (mascot === "none") return null;
  return (
    <g className="ec-santa-head">
      <g transform="translate(150 125) scale(.8)">
        <SiteMascotFace variant={mascot} expression="worried" />
      </g>
      {/* Santa hat */}
      <path d="M120 96 Q122 58 150 58 Q178 58 180 96 Z" fill="var(--danger)" />
      <path d="M176 64 C206 66 206 86 212 100 C214 108 220 108 222 100" fill="none" stroke="var(--danger)" strokeWidth="13" strokeLinecap="round" />
      <circle cx="222" cy="100" r="7" fill="var(--text)" />
      <rect x="118" y="94" width="64" height="9" rx="4.5" fill="var(--text)" />
    </g>
  );
}

export default function SantaGearAnimation() {
  const { mascot } = useLayout();
  if (mascot === "none") return null;
  return (
    <div className="ec-santa-scene" aria-hidden="true">
      <svg viewBox="0 0 320 280" width="320" height="280" role="img">
        {/* Empty sack, held open and drooping at the character's side */}
        <g className="ec-santa-sack">
          <path
            d="M198 206 C192 236 200 254 222 258 C244 262 258 250 256 226 C254 208 246 200 232 198 C214 196 202 200 198 206 Z"
            fill="var(--surface)"
            stroke="var(--border)"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <ellipse cx="226" cy="200" rx="20" ry="7" fill="var(--bg)" stroke="var(--border)" strokeWidth="1.5" />
          <path d="M206 198 Q220 190 246 202" fill="none" stroke="var(--border)" strokeWidth="2" strokeLinecap="round" />
        </g>
        <text className="ec-santa-q" x="254" y="150" fontSize="22" fontWeight="800" fill="var(--warning)">?</text>

        {/* Dust balls tumbling out of the empty sack */}
        <g transform="translate(186, 260)">
          <g className="ec-dust d1" fill="#cdbd9f">
            <circle cx="0" cy="0" r="4.5" />
            <circle cx="5" cy="-3" r="3.4" />
            <circle cx="-5" cy="-2" r="3" />
          </g>
        </g>
        <g transform="translate(234, 262)">
          <g className="ec-dust d2" fill="#cdbd9f">
            <circle cx="0" cy="0" r="4" />
            <circle cx="4" cy="-2.5" r="3" />
            <circle cx="-4" cy="-2" r="2.8" />
          </g>
        </g>

        {/* Gearhead Santa */}
        <g className="ec-santa">
          <rect x="118" y="158" width="64" height="62" rx="14" fill="var(--danger)" />
          <rect x="118" y="196" width="64" height="8" fill="var(--text)" />
          <rect x="147" y="194" width="6" height="12" rx="1" fill="var(--warning)" />
          <rect x="118" y="212" width="64" height="8" fill="var(--text)" />
          <rect x="120" y="224" width="22" height="12" rx="4" fill="var(--bg)" />
          <rect x="158" y="224" width="22" height="12" rx="4" fill="var(--bg)" />
          {/* Left arm dangling */}
          <path d="M118 176 L110 198" fill="none" stroke="var(--danger)" strokeWidth="9" strokeLinecap="round" />
          <circle cx="110" cy="199" r="5" fill="var(--text)" />
          {/* Right arm holding the empty sack */}
          <path d="M182 176 Q198 190 214 192" fill="none" stroke="var(--danger)" strokeWidth="9" strokeLinecap="round" />
          <circle cx="214" cy="192" r="5" fill="var(--text)" />
          <SantaGearHead mascot={mascot} />
        </g>

        {/* Sweat drop */}
        <ellipse className="ec-santa-sweat" cx="187" cy="104" rx="3" ry="5" fill="#60a5fa" />
      </svg>
    </div>
  );
}
