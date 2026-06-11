"use client";

import { useEffect, useState } from "react";

export function useResponsiveGameLayout() {
  const [layout, setLayout] = useState({ isMobile: false, isLandscape: true });

  useEffect(() => {
    const update = () => {
      setLayout({
        isMobile: window.innerWidth < 768,
        isLandscape: window.innerWidth >= window.innerHeight,
      });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return layout;
}
