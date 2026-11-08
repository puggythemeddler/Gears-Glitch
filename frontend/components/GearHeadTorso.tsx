type GearHeadTorsoProps = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Shared workshop jacket keeps the mascot's silhouette consistent between poses. */
export default function GearHeadTorso({ x, y, width, height }: GearHeadTorsoProps) {
  const center = x + width / 2;
  const top = y + 2;
  const shoulder = y + height * 0.28;
  const hem = y + height - 3;

  return (
    <g className="gearhead-torso">
      <path
        d={`M${x + width * 0.22} ${top} Q${center} ${y - 2} ${x + width * 0.78} ${top} L${x + width - 2} ${shoulder} Q${x + width - 1} ${y + height * 0.4} ${x + width * 0.85} ${y + height * 0.44} L${x + width * 0.8} ${hem} Q${center} ${y + height + 2} ${x + width * 0.2} ${hem} L${x + width * 0.15} ${y + height * 0.44} Q${x + 1} ${y + height * 0.4} ${x + 2} ${shoulder} Z`}
        fill="var(--surface)"
        stroke="var(--border)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Raised collar and single diagonal seam suggest a small mechanic's jacket. */}
      <path
        d={`M${x + width * 0.34} ${top + 1} L${center} ${y + height * 0.2} L${x + width * 0.66} ${top + 1}`}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={`M${center} ${y + height * 0.2} L${center - 1} ${hem - 3}`}
        fill="none"
        stroke="var(--border)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* The service pocket is the same small orange cue as the gear head. */}
      <path
        d={`M${x + width * 0.58} ${y + height * 0.34} H${x + width * 0.8} V${y + height * 0.61} Q${x + width * 0.69} ${y + height * 0.67} ${x + width * 0.58} ${y + height * 0.61} Z`}
        fill="var(--primary)"
        fillOpacity="0.14"
        stroke="var(--primary)"
        strokeOpacity="0.72"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx={x + width * 0.69} cy={y + height * 0.42} r="1.6" fill="var(--warning)" />
    </g>
  );
}
