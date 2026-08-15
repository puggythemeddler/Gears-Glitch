import React, { useEffect, useState } from "react";

interface Splash {
  id: number;
  title: string;
  text: string;
  bgColor: string;
  textColor: string;
  isMarquee: boolean;
  isActive: boolean;
  startDate: string | null;
  endDate: string | null;
  image_url?: string;
  link_url?: string;
  sort_order?: number;
}

interface KenyanHoliday {
  name: string;
  subtitle: string;
  month: number;
  day: number | null;
  bgGradient: string;
  textColor: string;
  icon: string;
  fixed: boolean;
}

const KENYA_BLACK = "#111827";
const KENYA_RED = "#b91c1c";
const KENYA_GREEN = "#15803d";
const KENYA_WHITE = "#ffffff";
const KENYA_GOLD = "#eab308";

const KENYAN_HOLIDAYS: KenyanHoliday[] = [
  {
    name: "New Year's Day",
    subtitle: "New year, new deals! Fresh savings for a fresh start — welcome to 2026!",
    month: 1, day: 1, fixed: true,
    bgGradient: `linear-gradient(90deg, ${KENYA_GREEN}, ${KENYA_BLACK} 50%, ${KENYA_RED})`,
    textColor: KENYA_WHITE, icon: "🇰🇪",
  },
  {
    name: "Eid el-Fitr",
    subtitle: "Eid Mubarak! Blessed celebrations call for blessed offers — shop with joy!",
    month: 3, day: null, fixed: false,
    bgGradient: `linear-gradient(135deg, ${KENYA_GREEN}, #059669)`,
    textColor: KENYA_WHITE, icon: "🌙",
  },
  {
    name: "Good Friday",
    subtitle: "Good Friday — Holy savings on every item! Prices drop low, spirits rise high!",
    month: 3, day: null, fixed: false,
    bgGradient: `linear-gradient(135deg, ${KENYA_BLACK}, #374151)`,
    textColor: KENYA_GOLD, icon: "✝️",
  },
  {
    name: "Easter Monday",
    subtitle: "Easter Monday — Rise with the deals, celebrate with savings! He is risen, prices have fallen!",
    month: 3, day: null, fixed: false,
    bgGradient: `linear-gradient(135deg, ${KENYA_GREEN}, ${KENYA_RED})`,
    textColor: KENYA_WHITE, icon: "🐣",
  },
  {
    name: "Labour Day",
    subtitle: "Labour Day — Work hard, save harder! Deals made for the Kenyan hustler!",
    month: 5, day: 1, fixed: true,
    bgGradient: `linear-gradient(90deg, ${KENYA_RED}, ${KENYA_BLACK})`,
    textColor: KENYA_GOLD, icon: "🔧",
  },
  {
    name: "Madaraka Day",
    subtitle: "Madaraka Day — Self-rule, self-save! Celebrate freedom with unbeatable offers across the board!",
    month: 6, day: 1, fixed: true,
    bgGradient: `linear-gradient(90deg, ${KENYA_BLACK}, ${KENYA_RED} 33%, ${KENYA_GREEN} 66%, ${KENYA_WHITE})`,
    textColor: KENYA_GOLD, icon: "🇰🇪",
  },
  {
    name: "Eid el-Adha",
    subtitle: "Eid Mubarak! A feast of savings for the whole family — celebrate with the best deals!",
    month: 6, day: null, fixed: false,
    bgGradient: `linear-gradient(135deg, ${KENYA_GREEN}, #047857)`,
    textColor: KENYA_WHITE, icon: "🌙",
  },
  {
    name: "Mazingira Day",
    subtitle: "Mazingira Day — Keep it green, keep it clean! Eco-deals for a better Kenya!",
    month: 10, day: 10, fixed: true,
    bgGradient: `linear-gradient(90deg, ${KENYA_GREEN}, #166534, ${KENYA_GREEN})`,
    textColor: KENYA_WHITE, icon: "🌍",
  },
  {
    name: "Black Friday",
    subtitle: "Black Friday — Prices so low they bow! Don't let this deal go, grab it now!",
    month: 11, day: null, fixed: false,
    bgGradient: `linear-gradient(135deg, ${KENYA_BLACK}, #1f2937)`,
    textColor: KENYA_GOLD, icon: "🖤",
  },
  {
    name: "Jamhuri Day",
    subtitle: "Jamhuri Day — Kenya at 63, savings for the nation! Unity, freedom, and deals for all!",
    month: 12, day: 12, fixed: true,
    bgGradient: `linear-gradient(90deg, ${KENYA_BLACK}, ${KENYA_RED} 33%, ${KENYA_GREEN} 66%, ${KENYA_WHITE})`,
    textColor: KENYA_GOLD, icon: "🇰🇪",
  },
  {
    name: "Christmas Day",
    subtitle: "Merry Christmas! Give the gift of tech — joy, savings, and cheer for everyone!",
    month: 12, day: 25, fixed: true,
    bgGradient: `linear-gradient(135deg, ${KENYA_RED}, #991b1b)`,
    textColor: KENYA_WHITE, icon: "🎄",
  },
  {
    name: "Boxing Day",
    subtitle: "Boxing Day — Smash the prices! Open the box of deals and unwrap the savings!",
    month: 12, day: 26, fixed: true,
    bgGradient: `linear-gradient(135deg, ${KENYA_RED}, ${KENYA_GREEN})`,
    textColor: KENYA_WHITE, icon: "🎁",
  },
];

function getEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function getCurrentHoliday(): KenyanHoliday | null {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const easter = getEaster(year);

  for (const h of KENYAN_HOLIDAYS) {
    if (h.fixed && h.month === month && h.day === day) return h;

    if (h.name === "Ijumaa Njema") {
      const gf = new Date(easter);
      gf.setDate(gf.getDate() - 2);
      if (gf.getMonth() + 1 === month && gf.getDate() === day) return h;
    }
    if (h.name === "Easter Monday") {
      const em = new Date(easter);
      em.setDate(em.getDate() + 1);
      if (em.getMonth() + 1 === month && em.getDate() === day) return h;
    }
    if (h.name === "Eid el-Fitr") {
      const eid = new Date(easter);
      eid.setDate(eid.getDate() - 1);
      if (eid.getMonth() + 1 === month && eid.getDate() === day) return h;
    }
    if (h.name === "Eid el-Adha") {
      const eid = new Date(easter);
      eid.setDate(eid.getDate() + 60);
      if (eid.getMonth() + 1 === month && eid.getDate() === day) return h;
    }
  }

  if (month === 11 && day >= 20 && day <= 30) {
    return KENYAN_HOLIDAYS.find((h) => h.name === "Black Friday")!;
  }

  if (month === 12 && day >= 15 && day < 25) {
    return {
      name: "Christmas Season",
      subtitle: "Christmas is near, deals are here! Grab the joy before it's gone!",
      month: 12, day: null, fixed: false,
      bgGradient: `linear-gradient(90deg, ${KENYA_RED}, ${KENYA_GREEN}, ${KENYA_RED})`,
      textColor: KENYA_WHITE, icon: "🎄",
    };
  }
  if (month === 12 && day >= 26 && day <= 31) {
    return KENYAN_HOLIDAYS.find((h) => h.name === "Boxing Day")!;
  }
  if (month === 1 && day >= 2 && day <= 7) {
    return {
      name: "New Year Sale",
      subtitle: "New year prices just dropped! Start 2026 with unbeatable savings!",
      month: 1, day: null, fixed: false,
      bgGradient: `linear-gradient(90deg, ${KENYA_GREEN}, ${KENYA_BLACK})`,
      textColor: KENYA_GOLD, icon: "🇰🇪",
    };
  }

  return null;
}

function SplashBar({ splash, style }: { splash: Splash; style?: React.CSSProperties }) {
  const content = (
    <div
      style={{
        background: splash.image_url ? "none" : splash.bgColor,
        color: splash.textColor,
        padding: "0.5rem 1rem",
        fontSize: "0.8rem",
        fontWeight: 600,
        textAlign: "center",
        whiteSpace: "nowrap",
        overflow: "hidden",
        letterSpacing: "0.02em",
        backgroundImage: splash.image_url ? `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(${splash.image_url})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.5rem",
        ...style,
      }}
    >
      {splash.isMarquee ? (
        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", animation: "marquee 25s linear infinite" }}>
          <span>{splash.title} &mdash; {splash.text}</span>
          <span style={{ margin: "0 1.5rem", opacity: 0.6 }}>&#9733;</span>
          <span>{splash.title} &mdash; {splash.text}</span>
          <span style={{ margin: "0 1.5rem", opacity: 0.6 }}>&#9733;</span>
          <span>{splash.title} &mdash; {splash.text}</span>
          <span style={{ margin: "0 1.5rem", opacity: 0.6 }}>&#9733;</span>
          <span>{splash.title} &mdash; {splash.text}</span>
        </div>
      ) : (
        <span>{splash.title}: {splash.text}</span>
      )}
    </div>
  );

  if (splash.link_url) {
    return <a href={splash.link_url} style={{ textDecoration: "none", color: "inherit", display: "block" }}>{content}</a>;
  }
  return content;
}

export default function MarqueeBanner() {
  const [splashes, setSplashes] = useState<Splash[]>([]);
  const [holiday, setHoliday] = useState<KenyanHoliday | null>(null);

  useEffect(() => {
    fetch("/api/splashes")
      .then((r) => r.json())
      .then((d) => setSplashes(d.splashes || []))
      .catch(() => {});

    setHoliday(getCurrentHoliday());
  }, []);

  const allBanners: { key: string; splash: Splash }[] = [];

  if (holiday) {
    allBanners.push({
      key: `holiday-${holiday.name}`,
      splash: {
        id: 0,
        title: `${holiday.icon} ${holiday.name}`,
        text: holiday.subtitle,
        bgColor: holiday.bgGradient.includes("gradient") ? holiday.bgGradient : "#111827",
        textColor: holiday.textColor,
        isMarquee: true,
        isActive: true,
        startDate: null,
        endDate: null,
      },
    });
  }

  for (const s of splashes) {
    allBanners.push({ key: `splash-${s.id}`, splash: s });
  }
  allBanners.sort((a, b) => (a.splash.sort_order ?? 0) - (b.splash.sort_order ?? 0));

  if (allBanners.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="marquee"] { animation: none !important; }
        }
      `}</style>
      {allBanners.map(({ key, splash }) => (
        <SplashBar key={key} splash={splash} />
      ))}
    </>
  );
}
