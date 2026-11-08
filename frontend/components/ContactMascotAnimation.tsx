import GearHeadTorso from "@/components/GearHeadTorso";
import SiteMascotFace from "@/components/SiteMascotFace";
import { useLayout } from "@/layouts";

export default function ContactMascotAnimation() {
  const { mascot } = useLayout();
  if (mascot === "none") return null;
  return (
    <div className="ct-scene" aria-hidden="true">
      <svg viewBox="120 65 195 135" width="300" height="184">
        {/* Desk */}
        <line x1="40" y1="190" x2="320" y2="190" stroke="var(--border)" strokeWidth="2" strokeLinecap="round" />

        {/* Phone base unit — prop, with an incoming-call ring pulse */}
        <g className="ct-ringwrap" transform="translate(280,180)">
          <ellipse className="ct-ring" cx="0" cy="-10" rx="22" ry="7" fill="none" stroke="var(--primary)" strokeWidth="2" />
          <ellipse className="ct-ring r2" cx="0" cy="-10" rx="22" ry="7" fill="none" stroke="var(--primary)" strokeWidth="2" />
        </g>
        <g transform="translate(256,166)">
          <rect x="0" y="0" width="48" height="24" rx="8" fill="var(--surface)" stroke="var(--border)" strokeWidth="2.5" />
          <path d="M8 6 h20 M8 12 h20 M8 18 h12" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
        </g>

        {/* Gear-head mascot — watching, holding a handset */}
        <g className="ct-mascot">
          {/* torso */}
          <GearHeadTorso x={136} y={134} width={50} height={56} />
          {/* head */}
          <g className="ct-head">
            <g transform="translate(161 116) scale(.7)">
              <SiteMascotFace variant={mascot} expression="listening" />
            </g>
          </g>
        </g>

        {/* Arm + handset — picks the phone up to the ear, then lowers it back down */}
        <g className="ct-armhand" transform="translate(196,128)">
          {/* arm from shoulder to the handset */}
          <path d="M-8 -16 Q14 -12 20 -2 L18 4" fill="none" stroke="var(--primary)" strokeWidth="9" strokeLinecap="round" />
          {/* handset (drawn around its own center) */}
          <g transform="translate(22,2)">
            <rect x="-12" y="-27" width="24" height="54" rx="10" fill="var(--surface)" stroke="var(--border)" strokeWidth="2.5" />
            <rect x="-12" y="-27" width="24" height="10" rx="5" fill="var(--primary)" opacity="0.9" />
            <rect x="-5" y="-6" width="10" height="12" rx="3" fill="var(--bg)" stroke="var(--border)" strokeWidth="1" />
            <rect x="6" y="-14" width="6" height="4" rx="2" fill="var(--border)" />
            <rect x="6" y="-6" width="6" height="4" rx="2" fill="var(--border)" />
            <rect x="6" y="2" width="6" height="4" rx="2" fill="var(--border)" />
          </g>
        </g>
      </svg>
    </div>
  );
}
