import { createFileRoute } from "@tanstack/react-router";
import { StickClash } from "@/components/game/StickClash";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "STICK CLASH: Arena — Stickman Fighting Game" },
      { name: "description", content: "Neon arcade stickman fighter. Punch, kick, block and unleash specials against a CPU in best-of-3 rounds." },
      { property: "og:title", content: "STICK CLASH: Arena" },
      { property: "og:description", content: "Neon arcade stickman fighter in your browser — 1P vs CPU, best of 3." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StickClash,
});
