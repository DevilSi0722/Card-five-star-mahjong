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
    let frame = 0;
    const timeoutIds: number[] = [];

    const update = () => {
      const viewport = window.visualViewport;
      const width = Math.round(viewport?.width ?? window.innerWidth);
      const height = Math.round(viewport?.height ?? window.innerHeight);
      const isLandscape = width >= height;
      setLayout({
        width,
        height,
        isMobile: width < 900,
        isLandscape,
        isMobileLandscape: isLandscape && width < 950 && height < 540,
      });
    };

    const scheduleUpdate = () => {
      window.cancelAnimationFrame(frame);
      while (timeoutIds.length > 0) {
        const id = timeoutIds.pop();
        if (id !== undefined) window.clearTimeout(id);
      }
      frame = window.requestAnimationFrame(update);
      for (const delay of [80, 180, 360, 700]) {
        timeoutIds.push(window.setTimeout(update, delay));
      }
    };

    update();
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("orientationchange", scheduleUpdate);
    window.visualViewport?.addEventListener("resize", scheduleUpdate);
    window.visualViewport?.addEventListener("scroll", scheduleUpdate);
    window.screen.orientation?.addEventListener?.("change", scheduleUpdate);
    return () => {
      window.cancelAnimationFrame(frame);
      for (const id of timeoutIds) window.clearTimeout(id);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("orientationchange", scheduleUpdate);
      window.visualViewport?.removeEventListener("resize", scheduleUpdate);
      window.visualViewport?.removeEventListener("scroll", scheduleUpdate);
      window.screen.orientation?.removeEventListener?.("change", scheduleUpdate);
    };
  }, []);

  return layout;
}
