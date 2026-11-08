import GearHeadFace from "@/components/GearHeadFace";
import GearHeadTorso from "@/components/GearHeadTorso";

export default function EmptyWishlistAnimation() {
  return (
    <div className="ew-scene" aria-hidden="true">
      <svg viewBox="0 0 300 200" width="260" height="174">
        {/* Deflated heart */}
        <g className="ew-heart">
          <path
            d="M150 170 C150 170 90 130 90 100 C90 78 110 72 128 80 C138 85 146 94 150 104 C154 94 162 85 172 80 C190 72 210 78 210 100 C210 130 150 170 150 170 Z"
            fill="none"
            stroke="var(--danger)"
            strokeWidth="3"
            strokeLinejoin="round"
            opacity="0.4"
          />
          <path
            d="M150 160 C150 160 100 128 100 102 C100 84 115 80 128 86 C136 89 144 96 150 104 C156 96 164 89 172 86 C185 80 200 84 200 102 C200 128 150 160 150 160 Z"
            fill="var(--danger)"
            opacity="0.18"
          />
          {/* Small crack / wilt line */}
          <path d="M140 118 l8 -10 l6 12 l8 -14" fill="none" stroke="var(--danger)" strokeWidth="1.8" strokeLinecap="round" opacity="0.5" />
        </g>

        {/* Gear-head mascot — shrugging */}
        <g className="ew-mascot">
          {/* torso */}
          <GearHeadTorso x={44} y={106} width={54} height={52} />
          {/* feet */}
          <rect x="50" y="154" width="18" height="12" rx="6" fill="var(--surface)" stroke="var(--border)" strokeWidth="2" />
          <rect x="76" y="154" width="18" height="12" rx="6" fill="var(--surface)" stroke="var(--border)" strokeWidth="2" />
          {/* shrugging arms */}
          <path d="M44 118 Q24 110 20 96" fill="none" stroke="var(--primary)" strokeWidth="9" strokeLinecap="round" />
          <path d="M98 118 Q118 110 122 96" fill="none" stroke="var(--primary)" strokeWidth="9" strokeLinecap="round" />
          {/* hands (palms up) */}
          <circle cx="20" cy="94" r="6" fill="var(--primary)" />
          <circle cx="122" cy="94" r="6" fill="var(--primary)" />
          {/* head */}
          <g className="ew-head">
            <g transform="translate(71 78) scale(.6)">
              <GearHeadFace expression="hopeful" />
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
