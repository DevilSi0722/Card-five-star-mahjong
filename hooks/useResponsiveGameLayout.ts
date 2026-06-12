"use client";

import { useEffect, useState } from "react";

export function useResponsiveGameLayout() {
  const [layout, setLayout] = useState({
    width: 0,
    height: 0,
    isMobile: false,
    isLandscape: true,
    isMobileLandscape: false,
  });

  useEffect(() => {
    const update = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isLandscape = width >= height;
      setLayout({
        width,
        height,
        isMobile: width < 900,
        isLandscape,
        isMobileLandscape: isLandscape && width < 950 && height < 540,
      });
    };
    update();
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.screen.orientation?.addEventListener?.("change", update);
    return () => {
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.screen.orientation?.removeEventListener?.("change", update);
    };
  }, []);

  return layout;
}
