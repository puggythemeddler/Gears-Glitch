function SighPuff() {
  return (
    <g className="ec-sigh" fill="var(--text-tertiary)">
      <ellipse cx="128" cy="108" rx="4" ry="3" opacity="0.75" />
      <ellipse cx="117" cy="103" rx="3" ry="2.4" opacity="0.6" />
      <ellipse cx="137" cy="103" rx="3" ry="2.4" opacity="0.6" />
    </g>
  );
}

function DustBall({ n }: { n: number }) {
  return (
    <g className={`ec-dust d${n}`} fill="#cdbd9f">
      <circle cx="0" cy="0" r="6" />
      <circle cx="6" cy="-3" r="4.4" />
      <circle cx="-6" cy="-2" r="3.9" />
      <circle cx="2" cy="4" r="5" />
      <circle cx="9" cy="2" r="3.2" />
    </g>
  );
}

export default function EmptyCartAnimation() {
  return (
    <div className="ec-scene" aria-hidden="true">
      <svg viewBox="0 0 360 250" width="340" height="236">
        {/* Floor */}
        <line x1="24" y1="208" x2="336" y2="208" stroke="var(--border)" strokeWidth="2" strokeLinecap="round" />

        {/* Land dust puff — bursts when the cart tips over on mount */}
        <g className="ec-landpuff" fill="#cdbd9f">
          <circle cx="236" cy="200" r="7" />
          <circle cx="246" cy="195" r="5" />
          <circle cx="225" cy="196" r="4.4" />
          <circle cx="239" cy="188" r="4" />
        </g>

        {/* Cart — tips over onto its side and stays tipped */}
        <g className="ec-cart">
          <path d="M220 112 h108 l-13 80 h-82 z" fill="var(--surface)" stroke="var(--border)" strokeWidth="2" strokeLinejoin="round" />
          <path d="M235 132 h80 M243 152 h70 M250 172 h58" stroke="var(--border)" strokeWidth="1.5" />
          <path d="M268 120 v68 M293 120 v68" stroke="var(--border)" strokeWidth="1.5" />
          <path d="M220 112 L208 90" stroke="var(--border)" strokeWidth="3" strokeLinecap="round" />
          <path d="M214 92 h18 v10 h-18 z" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.5" />
          <circle cx="235" cy="198" r="14" fill="var(--bg)" stroke="var(--border)" strokeWidth="2.5" />
          <circle cx="308" cy="198" r="14" fill="var(--bg)" stroke="var(--border)" strokeWidth="2.5" />
          <circle cx="235" cy="198" r="3.5" fill="var(--border)" />
          <circle cx="308" cy="198" r="3.5" fill="var(--border)" />
          <path d="M233 186 v24 M233 186 a7 7 0 0 0 4 -2 M308 186 v24" stroke="var(--border)" strokeWidth="1.5" strokeLinecap="round" />
        </g>

        {/* Dust balls tumbling out of the tipped cart and rolling left */}
        <DustBall n={1} />
        <DustBall n={2} />
        <DustBall n={3} />

        {/* Floating dust motes */}
        <g className="ec-mote" fill="var(--text-tertiary)"><circle cx="0" cy="0" r="2" /></g>
        <g className="ec-mote m2" fill="var(--text-tertiary)"><circle cx="0" cy="0" r="1.6" /></g>
        <g className="ec-mote m3" fill="var(--text-tertiary)"><circle cx="0" cy="0" r="1.8" /></g>

        {/* Gear-head character watching, facepalm + head-shake */}
        <g className="ec-char">
          {/* Feet */}
          <rect x="96" y="196" width="20" height="13" rx="6" fill="var(--surface)" stroke="var(--border)" strokeWidth="2" />
          <rect x="130" y="196" width="20" height="13" rx="6" fill="var(--surface)" stroke="var(--border)" strokeWidth="2" />
          {/* Torso */}
          <rect x="88" y="150" width="70" height="50" rx="16" fill="var(--surface)" stroke="var(--border)" strokeWidth="2" />
          {/* Hanging arm */}
          <path d="M94 162 q-10 12 -6 24" fill="none" stroke="var(--primary)" strokeWidth="8" strokeLinecap="round" />
          {/* Facepalm arm — hand pressed to the side of the head */}
          <g className="ec-palm">
            <path d="M152 166 q20 4 12 -42" fill="none" stroke="var(--primary)" strokeWidth="8" strokeLinecap="round" />
            <circle cx="158" cy="112" r="7" fill="var(--primary)" />
          </g>
          {/* Head — gear, face looking right toward the tipped cart */}
          <g className="ec-head">
            {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
              <rect
                key={a}
                x="118.5"
                y="96"
                width="7"
                height="10"
                rx="2"
                fill="var(--primary)"
                transform={`rotate(${a} 122 126)`}
              />
            ))}
            <circle cx="122" cy="126" r="25" fill="var(--primary)" />
            <circle cx="122" cy="126" r="18" fill="var(--surface)" />
            <circle cx="122" cy="126" r="7" fill="var(--primary)" />
            <circle cx="122" cy="126" r="3.5" fill="var(--surface)" />
            {/* Face — looking right, worried */}
            <circle cx="132" cy="121" r="2.6" fill="var(--text)" />
            <circle cx="140" cy="126" r="2.6" fill="var(--text)" />
            <path d="M130 133 q4 4 8 0 M138 133 q4 4 8 0" fill="none" stroke="var(--text)" strokeWidth="1.8" strokeLinecap="round" />
          </g>
          <SighPuff />
        </g>
      </svg>
    </div>
  );
}
