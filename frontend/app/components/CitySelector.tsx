"use client";

import React, { useState, useEffect } from "react";

export const CITIES = [
  {
    id: "lucknow",
    name: "Lucknow",
    nameLocal: "لکھنؤ",
    tagline: "City of Nawabs & Tehzeeb",
    phrase: "آداب عرض ہے",
    sub: "Rumi Darwaza · Tundey Kabab · Hazratganj",
    color: "#C8782E",
    colorLight: "#E09A50",
    glow: "rgba(200,120,46,0.42)",
    cardBg: "linear-gradient(145deg, #1C1000 0%, #100800 60%, #080400 100%)",
    accentBg: "linear-gradient(135deg, #C8782E 0%, #E09A50 100%)",
    symbol: "✦",
    pattern: "mughal",
  },
  {
    id: "varanasi",
    name: "Varanasi",
    nameLocal: "वाराणसी",
    tagline: "Eternal City of Light & Moksha",
    phrase: "हर हर महादेव",
    sub: "Dashashwamedh Ghat · Kashi Vishwanath · Banarasi Paan",
    color: "#D96020",
    colorLight: "#F08040",
    glow: "rgba(217,96,32,0.42)",
    cardBg: "linear-gradient(145deg, #1E0A00 0%, #120500 60%, #080200 100%)",
    accentBg: "linear-gradient(135deg, #D96020 0%, #F08040 100%)",
    symbol: "ॐ",
    pattern: "flame",
  },
  {
    id: "kanpur",
    name: "Kanpur",
    nameLocal: "कानपुर",
    tagline: "Ganga Kinara · Industry & Pride",
    phrase: "गंगा किनारे बसी नगरी",
    sub: "Bithoor Ghat · IIT Kanpur · Thaggu ke Laddu",
    color: "#1A80C0",
    colorLight: "#3EA0E0",
    glow: "rgba(26,128,192,0.42)",
    cardBg: "linear-gradient(145deg, #001220 0%, #000C18 60%, #00070E 100%)",
    accentBg: "linear-gradient(135deg, #1A80C0 0%, #3EA0E0 100%)",
    symbol: "◈",
    pattern: "waves",
  },
  {
    id: "noida",
    name: "Noida",
    nameLocal: "नोएडा",
    tagline: "NCR's Digital Heartland",
    phrase: "नई दिल्ली की नई शान",
    sub: "Sector 18 · Film City · Tech Corridors",
    color: "#8840CC",
    colorLight: "#AA62EE",
    glow: "rgba(136,64,204,0.42)",
    cardBg: "linear-gradient(145deg, #100520 0%, #080318 60%, #040210 100%)",
    accentBg: "linear-gradient(135deg, #8840CC 0%, #AA62EE 100%)",
    symbol: "⬡",
    pattern: "grid",
  },
] as const satisfies readonly {
  id: string;
  name: string;
  nameLocal: string;
  tagline: string;
  phrase: string;
  sub: string;
  color: string;
  colorLight: string;
  glow: string;
  cardBg: string;
  accentBg: string;
  symbol: string;
  pattern: string;
}[];

export type CityId = (typeof CITIES)[number]["id"];

interface Props {
  onSelect: (cityId: CityId) => void;
}

export default function CitySelector({ onSelect }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  function handleSelect(cityId: string) {
    setSelecting(cityId);
    setTimeout(() => onSelect(cityId as CityId), 420);
  }

  return (
    <div className="city-selector-root">
      {/* Animated geometric background */}
      <div className="city-selector-bg" aria-hidden="true">
        <div className="city-bg-pattern" />
        <div className="city-bg-vignette" />
      </div>

      {/* Content */}
      <div
        className="city-selector-content"
        style={{ opacity: mounted ? 1 : 0, transform: mounted ? "none" : "translateY(20px)" }}
      >
        {/* Logo + heading */}
        <div className="city-selector-header">
          <div className="city-selector-ornament">
            <span className="ornament-line" />
            <span className="ornament-star">✦</span>
            <span className="ornament-line" />
          </div>
          <h1 className="city-selector-title">
            Nawab <em>AI</em>
          </h1>
          <p className="city-selector-tagline">
            آداب &nbsp;·&nbsp; Aadab &nbsp;·&nbsp; Choose your city to begin
          </p>
        </div>

        {/* City cards */}
        <div className="city-cards-grid">
          {CITIES.map((city, i) => {
            const isHov = hovered === city.id;
            const isSel = selecting === city.id;
            return (
              <button
                key={city.id}
                className={`city-card${isHov ? " city-card--hovered" : ""}${isSel ? " city-card--selecting" : ""}`}
                style={
                  {
                    "--card-color": city.color,
                    "--card-color-light": city.colorLight,
                    "--card-glow": city.glow,
                    "--card-bg": city.cardBg,
                    "--card-accent-bg": city.accentBg,
                    animationDelay: `${i * 0.1}s`,
                  } as React.CSSProperties
                }
                onMouseEnter={() => setHovered(city.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => handleSelect(city.id)}
                aria-label={`Explore ${city.name}`}
              >
                {/* Card glow layer */}
                <div className="city-card-glow" />

                {/* Top accent bar */}
                <div className="city-card-bar" />

                {/* Symbol */}
                <div className="city-card-symbol">{city.symbol}</div>

                {/* City name block */}
                <div className="city-card-names">
                  <span className="city-card-local">{city.nameLocal}</span>
                  <span className="city-card-name">{city.name}</span>
                </div>

                {/* Tagline */}
                <p className="city-card-tagline">{city.tagline}</p>

                {/* Hindi phrase */}
                <p className="city-card-phrase">{city.phrase}</p>

                {/* Sub landmarks */}
                <p className="city-card-sub">{city.sub}</p>

                {/* CTA */}
                <div className="city-card-cta">
                  <span>Enter</span>
                  <span className="city-card-cta-arrow">→</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="city-selector-footer">
          <span className="ornament-line-sm" />
          <span className="footer-text">Powered by Pydantic AI &amp; AG-UI Protocol</span>
          <span className="ornament-line-sm" />
        </div>
      </div>
    </div>
  );
}
