function GearHead() {
  return (
    <g className="ec-head">
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <rect
          key={a}
          x="123.5"
          y="82"
          width="7"
          height="10"
          rx="2"
          fill="var(--primary)"
          transform={`rotate(${a} 127 118)`}
        />
      ))}
      <circle cx="127" cy="118" r="30" fill="var(--primary)" />
      <circle cx="127" cy="118" r="22" fill="var(--surface)" />
      <circle cx="127" cy="118" r="8" fill="var(--primary)" />
      <circle cx="127" cy="118" r="4" fill="var(--surface)" />
      {/* Face — looking down-right into the cart */}
      <circle cx="133" cy="110" r="2.6" fill="var(--text)" />
      <circle cx="142" cy="117" r="2.6" fill="var(--text)" />
      <path d="M128 102 q4 4 9 2" fill="none" stroke="var(--text)" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M130 127 q7 5 14 0" fill="none" stroke="var(--text)" strokeWidth="2" strokeLinecap="round" />
    </g>
  );
}

export default function EmptyCartAnimation() {
  return (
    <div className="ec-scene" aria-hidden="true">
      <svg viewBox="0 0 360 250" width="340" height="236" role="img">
        {/* Cart */}
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

        {/* Question marks rising out of the empty cart */}
        <g className="ec-qmark ec-qmark-1" fontSize="22" fontWeight="800" fill="var(--warning)">
          <text x="252" y="176">?</text>
        </g>
        <g className="ec-qmark ec-qmark-2" fontSize="26" fontWeight="800" fill="var(--warning)">
          <text x="272" y="168">?</text>
        </g>
        <g className="ec-qmark ec-qmark-3" fontSize="18" fontWeight="800" fill="var(--primary)">
          <text x="292" y="178">?</text>
        </g>
        <g className="ec-qmark ec-qmark-4" fontSize="15" fontWeight="800" fill="var(--primary)">
          <text x="261" y="148">?</text>
        </g>

        {/* Gear-head character, leaning in and pointing at the cart */}
        <g className="ec-char">
          <rect x="100" y="172" width="56" height="40" rx="12" fill="var(--surface)" stroke="var(--border)" strokeWidth="2" />
          <path d="M120 208 q8 10 16 0 M150 208 q8 10 16 0" stroke="var(--border)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          {/* Folded arm */}
          <path d="M112 184 q22 16 44 4" fill="none" stroke="var(--primary)" strokeWidth="8" strokeLinecap="round" />
          {/* Pointing arm — index finger aimed into the cart */}
          <g className="ec-arm">
            <path d="M154 184 L184 172 L212 148 L224 158" fill="none" stroke="var(--primary)" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
          </g>
          <GearHead />
        </g>
      </svg>
    </div>
  );
}
