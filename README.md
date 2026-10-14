# Stickman Combat Arena

Build a complete, polished, playable stickman fighting game named "STICK CLASH: Arena" as a browser game. This must be a functioning game, not just a landing page or mockup.

TECH/IMPLEMENTATION:
- Use React + TypeScript + Tailwind. Implement the actual fighting scene with HTML Canvas (or an equivalent performant 2D rendering approach) and requestAnimationFrame game loop. Keep gameplay state separate from UI state. No backend required.
- Must be runnable in Lovable preview and responsive on desktop and mobile.
- Build everything needed; don't leave TODOs, placeholders, or nonfunctional buttons. Test/fix the main gameplay flow.

GAMEPLAY:
- 1 player vs CPU opponent, best of 3 rounds, round timer, clear win/lose/game-over and restart flows.
- Real-time stickman fighters with articulated limbs and distinct animations: idle breathing/stance, walk/run, jump with arc, crouch, punch, kick, block, hit reaction, knockback, stagger, knockout/fall and get-up/reset between rounds. Smooth interpolation and animation blending; readable silhouettes.
- Functional health/energy bars for both fighters. Attacks consume energy, energy regenerates over time; prevent attacks when insufficient energy. Health changes only when a valid hit connects.
- Collision/hit detection with attack windows, range checks, cooldowns, blocking mitigation, knockback and hit-stun. CPU AI should approach, defend, and attack with varied timing instead of spamming.
- Controls: keyboard A/D or arrows move, W/Up jump, S/Down crouch, J punch, K kick, L block, Space special attack. Show a clear control guide and keyboard focus behavior.
- Add mobile touch controls (left/right, jump, punch, kick, block, special), large enough to use comfortably and avoid page scrolling while playing.
- Round reset, pause/resume, mute toggle, sound effects (Web Audio generated sounds are fine; don't rely on external copyrighted assets), and visual hit feedback.
- Show combo counter, floating damage/hit text, brief impact particles/screen shake, round announcements and winner overlay.
- Balance movement, damage, energy costs and regeneration so the fight feels playable and fair.

VISUAL DESIGN:
- High quality arcade/fighting-game aesthetic: dark arena, dramatic neon accents (electric cyan vs hot orange/red), atmospheric lighting, layered parallax arena background, floor grid, spotlights, subtle particles, crisp typography, polished UI.
- Canvas-drawn stick figures should have expressive poses, weighted movement, articulated joints, glove/boot accents, head/torso, shadow beneath each fighter. Distinct player and CPU colors.
- Make animations clear and satisfying: anticipation before attacks, follow-through, hit-stop, squash/impact response, particle bursts, trails for special attack.
- HUD at top with fighter names, health and energy bars, round score, timer. Avoid tiny labels. Responsive layout.
- Add title/start screen with Play button, difficulty selection if feasible, and controls preview. Play should transition into a real match.
- Add an attractive pause overlay, round result screen, match result screen and rematch action.

QUALITY:
- Ensure all core controls work and game is playable immediately in preview. Handle window resizing and high-DPI canvas scaling. Avoid stale React state in the game loop. Clean up animation frames and event listeners. Keep accessible labels and reduced-motion support where appropriate.
- Prioritize the actual fighting loop and animations over decorative UI. Don't use static images in place of animated fighters.
- After implementing, verify start match, movement, jumping, punch/kick/block/special, energy drain/regeneration, CPU response, health reduction, round end, pause/resume, rematch, and mobile controls. Fix runtime/TypeScript issues.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b960245f-2240-4872-b944-f5fd798bc987).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
