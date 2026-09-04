export default function RepairsSceneAnimation() {
  return (
    <div className="rp-scene" aria-hidden="true">
      <svg viewBox="0 0 360 150" width="340" height="142">
        {/* Monitor — hovering at the top */}
        <g className="rp-monitor">
          <rect x="122" y="12" width="116" height="64" rx="8" fill="var(--surface)" stroke="var(--border)" strokeWidth="2.5" />
          <rect x="131" y="21" width="98" height="42" rx="4" fill="var(--bg)" stroke="var(--border)" strokeWidth="1.5" />
          <rect x="139" y="29" width="30" height="6" rx="3" fill="var(--primary)" opacity="0.55" />
          <rect x="139" y="41" width="50" height="6" rx="3" fill="var(--text-tertiary)" opacity="0.35" />
          <rect x="139" y="51" width="40" height="6" rx="3" fill="var(--text-tertiary)" opacity="0.25" />
          <rect x="172" y="76" width="16" height="10" rx="2" fill="var(--surface)" stroke="var(--border)" strokeWidth="2" />
          <rect x="165" y="86" width="30" height="5" rx="2.5" fill="var(--border)" />
        </g>

        {/* Screwdriver — floating bottom-left, slanted */}
        <g className="rp-screwdriver">
          <g transform="rotate(-18 115 50)">
            <rect x="42" y="42" width="54" height="16" rx="8" fill="var(--primary)" />
            <rect x="48" y="46" width="4" height="8" rx="2" fill="var(--surface)" opacity="0.5" />
            <rect x="56" y="46" width="4" height="8" rx="2" fill="var(--surface)" opacity="0.5" />
            <rect x="64" y="46" width="4" height="8" rx="2" fill="var(--surface)" opacity="0.5" />
            <rect x="96" y="45" width="62" height="10" rx="4" fill="var(--text-tertiary)" opacity="0.6" />
            <rect x="158" y="44" width="22" height="12" rx="2" fill="var(--border)" />
            <path d="M196 50 v0" stroke="var(--primary)" strokeWidth="3" />
            <polygon points="196,42 208,50 196,58" fill="var(--border)" />
          </g>
        </g>

        {/* Screws — floating bottom-right, slowly turning */}
        <g className="rp-screw s1">
          <g transform="translate(286,116)">
            <circle cx="0" cy="0" r="11" fill="var(--surface)" stroke="var(--border)" strokeWidth="2.5" />
            <circle cx="0" cy="0" r="7" fill="var(--bg)" stroke="var(--border)" strokeWidth="1.5" />
            <path d="M0 -5 v10 M-5 0 h10" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" />
          </g>
        </g>
        <g className="rp-screw s2">
          <g transform="translate(318,132)">
            <circle cx="0" cy="0" r="7.5" fill="var(--surface)" stroke="var(--border)" strokeWidth="2" />
            <circle cx="0" cy="0" r="4.6" fill="var(--bg)" stroke="var(--border)" strokeWidth="1.4" />
            <path d="M0 -3.4 v6.8 M-3.4 0 h6.8" stroke="var(--text-tertiary)" strokeWidth="1.8" strokeLinecap="round" />
          </g>
        </g>
      </svg>
    </div>
  );
}