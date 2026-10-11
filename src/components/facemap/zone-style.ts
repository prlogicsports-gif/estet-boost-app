import type { CSSProperties } from "react";

import type { MarkState } from "@/lib/face-map-store";

/** Aparência de uma região (rosto ou corpo): normal, passando o mouse, salva ou selecionada. */
export function zoneStyle(selected: boolean, hovered: boolean, saved?: MarkState): CSSProperties {
  let fill = "rgba(195,148,142,.06)";
  let stroke = "rgba(195,148,142,.55)";
  let width = 0.9;
  if (selected) {
    fill = "rgba(79,175,173,.42)";
    stroke = "var(--eb-teal-500)";
    width = 1.7;
  } else if (saved) {
    fill = saved === "sensitive" ? "rgba(201,109,109,.28)" : "rgba(79,175,173,.2)";
    stroke = saved === "sensitive" ? "var(--eb-coral-500)" : "var(--eb-teal-a40)";
  } else if (hovered) {
    fill = "rgba(195,148,142,.16)";
    stroke = "rgba(220,200,186,.85)";
  }
  return {
    fill,
    stroke,
    strokeWidth: width,
    strokeLinejoin: "round",
    vectorEffect: "non-scaling-stroke",
    pointerEvents: "none",
    transition: "fill 200ms cubic-bezier(.32,.72,0,1), stroke 200ms cubic-bezier(.32,.72,0,1)",
  };
}
