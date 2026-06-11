"use client";

import { useHumanAlert, type HumanAlert } from "@/hooks/useHumanAlert";

const ALERT_CONFIG: Record<
  Exclude<HumanAlert, null>,
  { color: string; glow: string; intense?: boolean }
> = {
  // 轮到出牌：绿色
  turn: { color: "rgba(52, 211, 153, 0.95)", glow: "rgba(16, 185, 129, 0.55)" },
  // 可碰/杠：紫色
  meld: { color: "rgba(192, 132, 252, 0.95)", glow: "rgba(168, 85, 247, 0.55)" },
  // 可亮倒：蓝色
  liangdao: { color: "rgba(96, 165, 250, 0.95)", glow: "rgba(59, 130, 246, 0.55)" },
  // 可胡：黄色，加强特效
  hu: { color: "rgba(253, 224, 71, 1)", glow: "rgba(250, 204, 21, 0.7)", intense: true },
};

export function AmbientLights() {
  const alert = useHumanAlert();
  if (!alert) return null;

  const { color, glow, intense } = ALERT_CONFIG[alert];

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-30"
      style={
        {
          "--ambient-color": color,
          "--ambient-glow": glow,
        } as React.CSSProperties
      }
    >
      {/* 主氛围灯：四周内发光边框，呼吸闪烁 */}
      <div className={`ambient-frame ${intense ? "ambient-frame--intense" : ""}`} />
      {/* 胡牌加强特效：额外叠加一层更亮、更快的脉冲光晕 */}
      {intense ? <div className="ambient-frame ambient-frame--pulse" /> : null}
    </div>
  );
}
