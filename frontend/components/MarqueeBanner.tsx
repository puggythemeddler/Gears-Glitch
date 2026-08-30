import React from "react";
import { useEffect, useState } from "react";

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

function TagIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.83z"/><line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
  );
}

function SplashBar({ splash, style }: { splash: Splash; style?: React.CSSProperties }) {
  const content = (
    <div
      className="splash-bar"
      style={{
        backgroundColor: splash.image_url ? "transparent" : splash.bgColor,
        color: splash.textColor,
        backgroundImage: splash.image_url
          ? `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url(${splash.image_url})`
          : undefined,
        ...style,
      }}
    >
      <div className="splash-bar-inner">
        <span className="splash-bar-icon">
          <TagIcon />
        </span>
        {splash.isMarquee ? (
          <div className="splash-bar-marquee">
            <span className="splash-bar-marquee-item">
              <span>{splash.title} &mdash; {splash.text}</span>
              <span className="splash-bar-sep" aria-hidden="true">&bull;</span>
              <span>{splash.title} &mdash; {splash.text}</span>
              <span className="splash-bar-sep" aria-hidden="true">&bull;</span>
              <span>{splash.title} &mdash; {splash.text}</span>
              <span className="splash-bar-sep" aria-hidden="true">&bull;</span>
              <span>{splash.title} &mdash; {splash.text}</span>
            </span>
            <span className="splash-bar-marquee-item">
              <span>{splash.title} &mdash; {splash.text}</span>
              <span className="splash-bar-sep" aria-hidden="true">&bull;</span>
              <span>{splash.title} &mdash; {splash.text}</span>
              <span className="splash-bar-sep" aria-hidden="true">&bull;</span>
              <span>{splash.title} &mdash; {splash.text}</span>
              <span className="splash-bar-sep" aria-hidden="true">&bull;</span>
              <span>{splash.title} &mdash; {splash.text}</span>
            </span>
          </div>
        ) : (
          <span>{splash.title}: {splash.text}</span>
        )}
      </div>
    </div>
  );

  if (splash.link_url) {
    return <a href={splash.link_url} style={{ textDecoration: "none", color: "inherit", display: "block" }}>{content}</a>;
  }
  return content;
}

export default function MarqueeBanner() {
  const [splashes, setSplashes] = useState<Splash[]>([]);

  useEffect(() => {
    fetch("/api/splashes")
      .then((r) => r.json())
      .then((d) => setSplashes(d.splashes || []))
      .catch(() => {});
  }, []);

  const allBanners: { key: string; splash: Splash }[] = [];
  for (const s of splashes) {
    allBanners.push({ key: `splash-${s.id}`, splash: s });
  }
  allBanners.sort((a, b) => (a.splash.sort_order ?? 0) - (b.splash.sort_order ?? 0));

  if (allBanners.length === 0) return null;

  return (
    <>
      {allBanners.map(({ key, splash }) => (
        <SplashBar key={key} splash={splash} />
      ))}
    </>
  );
}