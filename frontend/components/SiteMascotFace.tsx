import GearHeadFace, { type GearHeadExpression } from "@/components/GearHeadFace";
import type { MascotId } from "@/lib/mascots";

type AnimalId = Exclude<MascotId, "gearhead" | "kenya-gearhead" | "uganda-gearhead" | "tanzania-gearhead" | "none">;

const EARTH = "#b8793d";
const INK = "#29231f";
const CREAM = "#f5e6c8";

function AnimalFace({ animal, expression }: { animal: AnimalId; expression: GearHeadExpression }) {
  const cheerful = expression === "hopeful" || expression === "celebrating";
  const worried = expression === "concerned" || expression === "worried";
  const eyes = (
    <g fill={INK}>
      <ellipse className="mascot-eye" cx="-10" cy="-2" rx="3.4" ry="4.6" />
      <ellipse className="mascot-eye" cx="10" cy="-2" rx="3.4" ry="4.6" />
      <circle cx="-9" cy="-3.5" r="1" fill="white" />
      <circle cx="11" cy="-3.5" r="1" fill="white" />
    </g>
  );
  const smile = cheerful ? "M-8 12 Q0 22 8 12" : worried ? "M-7 15 Q0 9 7 15" : "M-7 13 Q0 17 7 13";

  if (animal === "elephant") {
    return (
      <g className="site-mascot-face site-mascot-face--elephant" stroke={INK} strokeLinejoin="round" strokeLinecap="round">
        <ellipse cx="-27" cy="-2" rx="17" ry="23" fill="#91a7a0" strokeWidth="2.5" />
        <ellipse cx="27" cy="-2" rx="17" ry="23" fill="#91a7a0" strokeWidth="2.5" />
        <ellipse cx="0" cy="-1" rx="30" ry="32" fill="#b8c4b6" strokeWidth="2.5" />
        <path d="M-7 12 Q-8 28 0 34 Q8 29 7 12" fill="#91a7a0" strokeWidth="3" />
        <path d="M-18 13 Q-23 23 -15 22 M18 13 Q23 23 15 22" fill="none" stroke={CREAM} strokeWidth="5" />
        {eyes}
        <path d={smile} fill="none" stroke={INK} strokeWidth="2.3" />
      </g>
    );
  }

  if (animal === "buffalo") {
    return (
      <g className="site-mascot-face site-mascot-face--buffalo" stroke={INK} strokeLinejoin="round" strokeLinecap="round">
        <path d="M-22 -25 Q-46 -43 -43 -14 Q-38 -2 -25 1 M22 -25 Q46 -43 43 -14 Q38 -2 25 1" fill="#e9e0cb" strokeWidth="4" />
        <path d="M-26 -18 Q0 -40 26 -18 L29 7 Q27 29 0 34 Q-27 29 -29 7 Z" fill="#604633" strokeWidth="2.5" />
        <ellipse cx="0" cy="16" rx="15" ry="12" fill="#8f6a4f" strokeWidth="2" />
        {eyes}
        <path d={smile} fill="none" strokeWidth="2.3" />
        <ellipse cx="-5" cy="16" rx="1.6" ry="2" fill={INK} stroke="none" />
        <ellipse cx="5" cy="16" rx="1.6" ry="2" fill={INK} stroke="none" />
      </g>
    );
  }

  if (animal === "zebra") {
    return (
      <g className="site-mascot-face site-mascot-face--zebra" stroke={INK} strokeLinejoin="round" strokeLinecap="round">
        <path d="M-21 -24 L-27 -46 L-8 -31 M21 -24 L27 -46 L8 -31" fill="#f6f2e8" strokeWidth="3" />
        <path d="M-24 -20 Q0 -38 24 -20 L29 7 Q27 31 0 34 Q-27 31 -29 7 Z" fill="#f6f2e8" strokeWidth="2.5" />
        <path d="M-20 -20 L-9 -15 -16 -3 -27 1 M-4 -29 L5 -24 -3 -8 4 0 M20 -18 L9 -13 16 0 27 4 M-24 9 L-9 8 -14 20 M24 11 L10 10 15 22" fill="none" strokeWidth="5" />
        <ellipse cx="0" cy="15" rx="14" ry="11" fill="#e5d9c6" strokeWidth="2" />
        {eyes}
        <path d={smile} fill="none" strokeWidth="2.3" />
      </g>
    );
  }

  const ears = animal === "cat"
    ? <path d="M-27 -9 L-31 -36 -8 -25 Q0 -28 8 -25 L31 -36 27 -9" fill="#d7a66e" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
    : <path d="M-25 -12 Q-43 -30 -38 -8 M25 -12 Q43 -30 38 -8" fill="#d89a58" stroke={INK} strokeWidth="2.5" />;
  const mane = animal === "lion" ? <path d="M0 -43 L9 -35 21 -39 25 -28 38 -23 34 -11 42 -1 34 9 38 22 25 27 21 39 9 35 0 44 -9 35 -21 39 -25 27 -38 22 -34 9 -42 -1 -34 -11 -38 -23 -25 -28 -21 -39 -9 -35 Z" fill="#bd793c" stroke={INK} strokeWidth="2.5" /> : null;
  const base = animal === "leopard" ? "#d3a354" : animal === "cat" ? "#d7a66e" : animal === "rhino" ? "#a7a8a1" : "#f2d4a5";
  return (
    <g className={`site-mascot-face site-mascot-face--${animal}`} stroke={INK} strokeLinejoin="round" strokeLinecap="round">
      {mane}
      {ears}
      {animal === "rhino" && <path d="M0 -43 L-9 -22 L9 -22 Z" fill="#e6dfcf" strokeWidth="2" />}
      <path d="M-27 -18 Q0 -39 27 -18 L29 5 Q28 31 0 34 Q-28 31 -29 5 Z" fill={base} strokeWidth="2.5" />
      {animal === "leopard" && <g fill={INK} stroke="none"><circle cx="-19" cy="-13" r="2.4" /><circle cx="18" cy="-12" r="2" /><circle cx="-23" cy="1" r="1.8" /><circle cx="23" cy="3" r="2.4" /><circle cx="-17" cy="20" r="1.7" /><circle cx="18" cy="20" r="1.8" /></g>}
      {animal === "cat" && <g fill="#efc6c0" stroke="none"><path d="M-24 -25 L-29 -32 -15 -26 Z" /><path d="M24 -25 L29 -32 15 -26 Z" /></g>}
      <ellipse cx="0" cy="14" rx="15" ry="12" fill={animal === "cat" ? "#f1dfc5" : "#f4e6d2"} strokeWidth="2" />
      {eyes}
      <path d="M-3 11 Q0 8 3 11 L0 14 Z" fill={INK} stroke="none" />
      <path d={smile} fill="none" strokeWidth="2.3" />
      {animal === "cat" && <g fill="none" strokeWidth="1.5"><path d="M-15 14 L-31 11 M-15 18 L-30 20 M15 14 L31 11 M15 18 L30 20" /></g>}
    </g>
  );
}

export default function SiteMascotFace({ variant, expression }: { variant: MascotId; expression: GearHeadExpression }) {
  if (variant === "none") return null;
  if (variant === "gearhead" || variant.endsWith("-gearhead")) {
    const country = variant === "gearhead" ? null : variant.replace("-gearhead", "");
    return (
      <g className="site-mascot-face site-mascot-face--gearhead">
        <GearHeadFace expression={expression} />
        {country && <CountryBand country={country as "kenya" | "uganda" | "tanzania"} />}
      </g>
    );
  }
  return <AnimalFace animal={variant as AnimalId} expression={expression} />;
}

function CountryBand({ country }: { country: "kenya" | "uganda" | "tanzania" }) {
  const stripes = country === "kenya"
    ? ["#111111", "#ffffff", "#bb1e2d", "#ffffff", "#168a48"]
    : country === "uganda"
      ? ["#111111", "#f5d230", "#c62828", "#111111", "#f5d230", "#c62828"]
      : ["#1b8d50", "#f1cf35", "#202832", "#202832", "#45a4d8"];
  return (
    <g aria-hidden="true">
      {stripes.map((color, index) => <path key={`${country}-${index}`} d={`M-21 ${22 + index * 2.2} Q0 ${28 + index * 2.2} 21 ${22 + index * 2.2}`} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" />)}
    </g>
  );
}
