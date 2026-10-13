import { useCallback, useEffect, useRef, useState } from "react";
import { Engine, W, H, ATK, type Difficulty, type HudSnapshot, type HeldKey, type PressKey } from "@/game/engine";

const KEY_HELD: Record<string, HeldKey> = {
  KeyA: "left", ArrowLeft: "left", KeyD: "right", ArrowRight: "right",
  KeyS: "down", ArrowDown: "down", KeyL: "block",
};
const KEY_PRESS: Record<string, PressKey> = {
  KeyW: "jump", ArrowUp: "jump", KeyJ: "punch", KeyK: "kick", Space: "special",
};

const CONTROLS: [string, string][] = [
  ["A / D  ·  ← →", "Move"],
  ["W  ·  ↑", "Jump"],
  ["S  ·  ↓", "Crouch (dodges punches)"],
  ["J", `Punch · ${ATK.punch.cost} energy`],
  ["K", `Kick · ${ATK.kick.cost} energy`],
  ["L (hold)", "Block"],
  ["Space", `Special · ${ATK.special.cost} energy`],
  ["P / Esc  ·  M", "Pause  ·  Mute"],
];

export function StickClash() {
  const [screen, setScreen] = useState<"title" | "game">("title");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [muted, setMuted] = useState(false);

  return screen === "title" ? (
    <TitleScreen
      difficulty={difficulty}
      setDifficulty={setDifficulty}
      onPlay={() => setScreen("game")}
    />
  ) : (
    <GameScreen difficulty={difficulty} muted={muted} setMuted={setMuted} onExit={() => setScreen("title")} />
  );
}

function TitleScreen({ difficulty, setDifficulty, onPlay }: { difficulty: Difficulty; setDifficulty: (d: Difficulty) => void; onPlay: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.code === "Enter") onPlay(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onPlay]);
  return (
    <main className="arena-bg relative min-h-dvh overflow-hidden px-4 py-10">
      <div className="arena-grid pointer-events-none absolute inset-x-0 bottom-0 h-1/2" aria-hidden />
      <div className="relative mx-auto flex max-w-4xl flex-col items-center text-center">
        <p className="font-body text-sm font-semibold uppercase tracking-[0.5em] text-muted-foreground">1P vs CPU · Best of 3</p>
        <h1 className="font-display mt-4 text-6xl leading-[0.9] sm:text-8xl">
          <span className="text-glow-player text-player">STICK</span>{" "}
          <span className="text-glow-cpu text-cpu">CLASH</span>
        </h1>
        <p className="font-display mt-2 text-2xl tracking-[0.4em] text-foreground/80 sm:text-3xl">ARENA</p>

        <div className="mt-10 w-full max-w-md">
          <p className="mb-3 font-body text-sm font-bold uppercase tracking-widest text-muted-foreground" id="diff-label">Difficulty</p>
          <div role="radiogroup" aria-labelledby="diff-label" className="grid grid-cols-3 gap-2">
            {(["easy", "normal", "hard"] as Difficulty[]).map((d) => (
              <button
                key={d}
                role="radio"
                aria-checked={difficulty === d}
                onClick={() => setDifficulty(d)}
                className="diff-btn font-display rounded-md px-3 py-3 text-base uppercase"
                data-active={difficulty === d}
              >
                {d}
              </button>
            ))}
          </div>
          <button onClick={onPlay} className="btn-play font-display mt-6 w-full rounded-md py-4 text-3xl" autoFocus>
            PLAY
          </button>
          <p className="mt-2 font-body text-xs text-muted-foreground">Press Enter to start</p>
        </div>

        <section aria-label="Controls" className="panel mt-10 w-full max-w-2xl rounded-lg p-5 text-left">
          <h2 className="font-display mb-3 text-lg text-foreground">Controls</h2>
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {CONTROLS.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3 border-b border-border/60 pb-2">
                <dt><kbd className="kbd">{k}</kbd></dt>
                <dd className="font-body text-sm text-muted-foreground">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 font-body text-sm text-muted-foreground">
            Attacks use energy, which refills over time. Blocking cuts damage but drains energy — run dry and your guard breaks. On phones, on-screen buttons appear below the arena.
          </p>
        </section>
      </div>
    </main>
  );
}

function GameScreen({ difficulty, muted, setMuted, onExit }: { difficulty: Difficulty; muted: boolean; setMuted: (m: boolean) => void; onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [touch, setTouch] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new Engine(difficulty);
    engine.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    engine.onHud = setHud;
    engine.setMuted(mutedRef.current);
    engineRef.current = engine;
    engine.start(canvas);
    engine.restartMatch();
    return () => { engine.stop(); engineRef.current = null; };
  }, [difficulty]);

  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const upd = () => setTouch(mq.matches || window.innerWidth < 768);
    upd();
    mq.addEventListener("change", upd);
    window.addEventListener("resize", upd);
    return () => { mq.removeEventListener("change", upd); window.removeEventListener("resize", upd); };
  }, []);

  // fit canvas to available area (16:9) + high-DPI
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const fit = () => {
      const r = el.getBoundingClientRect();
      const w = Math.floor(Math.min(r.width, (r.height * W) / H));
      const h = Math.floor((w * H) / W);
      setBox({ w, h });
      engineRef.current?.resize(w, h, Math.min(window.devicePixelRatio || 1, 2.5));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [touch]);

  const togglePause = useCallback(() => {
    const e = engineRef.current;
    if (e) e.setPaused(!e.paused);
  }, []);
  const toggleMute = useCallback(() => {
    const m = !mutedRef.current;
    setMuted(m);
    engineRef.current?.setMuted(m);
  }, [setMuted]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const eng = engineRef.current;
      if (!eng) return;
      if (e.code === "KeyP" || e.code === "Escape") { e.preventDefault(); togglePause(); return; }
      if (e.code === "KeyM") { toggleMute(); return; }
      const h = KEY_HELD[e.code], p = KEY_PRESS[e.code];
      if (h || p) e.preventDefault();
      if (eng.paused) return;
      if (h) eng.setHeld(h, true);
      if (p && !e.repeat) eng.press(p);
    };
    const up = (e: KeyboardEvent) => {
      const h = KEY_HELD[e.code];
      if (h) engineRef.current?.setHeld(h, false);
    };
    const blur = () => engineRef.current?.clearInput();
    const vis = () => { if (document.hidden) { const e = engineRef.current; if (e && !e.paused) e.setPaused(true); } };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", vis);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [togglePause, toggleMute]);

  const rematch = () => engineRef.current?.restartMatch();

  return (
    <main className="arena-bg fixed inset-0 flex touch-none select-none flex-col overflow-hidden overscroll-none" aria-label="Stick Clash arena">
      <div ref={areaRef} className="relative flex min-h-0 flex-1 items-center justify-center p-1 sm:p-3">
        <div className="relative overflow-hidden rounded-lg arena-frame" style={{ width: box.w, height: box.h }}>
          <canvas ref={canvasRef} className="block h-full w-full" role="img" aria-label="Fighting arena: your cyan fighter versus the orange CPU fighter" />
          {hud && <Hud hud={hud} onPause={togglePause} onMute={toggleMute} muted={muted} />}
          {hud?.announce && !hud.paused && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center" aria-live="assertive">
              <p key={hud.announce} className={`announce font-display ${hud.announce.startsWith("CPU") || hud.announce === "K.O.!" ? "text-glow-cpu text-cpu" : "text-glow-player text-player"}`}>
                {hud.announce}
              </p>
              {hud.announceSub && <p className="announce-sub font-display mt-1 text-foreground">{hud.announceSub}</p>}
            </div>
          )}
          {hud?.paused && (
            <Overlay title="PAUSED">
              <OverlayButton primary onClick={togglePause}>Resume</OverlayButton>
              <OverlayButton onClick={() => { rematch(); }}>Restart match</OverlayButton>
              <OverlayButton onClick={toggleMute}>{muted ? "Unmute sound" : "Mute sound"}</OverlayButton>
              <OverlayButton onClick={onExit}>Main menu</OverlayButton>
              <p className="mt-2 hidden font-body text-sm text-muted-foreground sm:block">J punch · K kick · L block · Space special</p>
            </Overlay>
          )}
          {hud?.showResult && (
            <Overlay title={hud.matchWinner === "player" ? "VICTORY" : "DEFEAT"} tone={hud.matchWinner === "player" ? "player" : "cpu"}>
              <p className="font-display text-2xl text-foreground">{hud.p.wins} — {hud.c.wins}</p>
              <p className="font-body text-muted-foreground">{hud.matchWinner === "player" ? `You beat the ${difficulty} CPU.` : "The CPU takes the match."}</p>
              <OverlayButton primary onClick={rematch}>Rematch</OverlayButton>
              <OverlayButton onClick={onExit}>Main menu</OverlayButton>
            </Overlay>
          )}
        </div>
      </div>
      {touch && engineRef && <TouchControls engineRef={engineRef} />}
    </main>
  );
}

function Hud({ hud, onPause, onMute, muted }: { hud: HudSnapshot; onPause: () => void; onMute: () => void; muted: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start gap-2 p-2 sm:gap-4 sm:p-4">
      <FighterBars f={hud.p} side="player" />
      <div className="flex flex-col items-center">
        <div className={`timer font-display ${hud.timer <= 10 && hud.phase === "fight" ? "text-cpu" : "text-foreground"}`} aria-label={`Time ${hud.timer}`}>{hud.timer}</div>
        <p className="font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground sm:text-xs">Round {hud.round}</p>
        <div className="pointer-events-auto mt-1 flex gap-1">
          <button onClick={onPause} className="hud-btn" aria-label={hud.paused ? "Resume" : "Pause"}>{hud.paused ? "▶" : "❚❚"}</button>
          <button onClick={onMute} className="hud-btn" aria-label={muted ? "Unmute" : "Mute"} aria-pressed={muted}>{muted ? "🔇" : "🔊"}</button>
        </div>
      </div>
      <FighterBars f={hud.c} side="cpu" />
    </div>
  );
}

function FighterBars({ f, side }: { f: HudSnapshot["p"]; side: "player" | "cpu" }) {
  const right = side === "cpu";
  return (
    <div className={`flex min-w-0 flex-1 flex-col gap-1 ${right ? "items-end" : "items-start"}`}>
      <div className={`flex w-full items-center gap-2 ${right ? "flex-row-reverse" : ""}`}>
        <span className={`font-display text-sm sm:text-xl ${side === "player" ? "text-player" : "text-cpu"}`}>{f.name}</span>
        <div className="flex gap-1" aria-label={`${f.name} rounds won: ${f.wins}`}>
          {[0, 1].map((i) => <span key={i} className="win-pip" data-on={i < f.wins} data-side={side} />)}
        </div>
      </div>
      <div className="bar-track h-3 w-full sm:h-5" role="meter" aria-label={`${f.name} health`} aria-valuenow={Math.round(f.hp)} aria-valuemin={0} aria-valuemax={100}>
        <div className="bar-ghost" style={{ width: `${f.hp}%`, [right ? "marginLeft" : "marginRight"]: "auto" }} />
        <div className={`bar-fill ${side === "player" ? "bar-hp-player" : "bar-hp-cpu"}`} style={{ width: `${f.hp}%`, [right ? "right" : "left"]: 0 }} />
      </div>
      <div className={`bar-track h-1.5 w-3/4 sm:h-2.5 ${f.low ? "bar-deny" : ""}`} role="meter" aria-label={`${f.name} energy`} aria-valuenow={Math.round(f.energy)} aria-valuemin={0} aria-valuemax={100}>
        <div className="bar-fill bar-energy" style={{ width: `${f.energy}%`, [right ? "right" : "left"]: 0 }} />
      </div>
      {f.combo >= 2 && <p key={f.combo} className={`combo font-display ${side === "player" ? "text-player" : "text-cpu"}`}>{f.combo} HITS</p>}
    </div>
  );
}

function Overlay({ title, tone = "player", children }: { title: string; tone?: "player" | "cpu"; children: React.ReactNode }) {
  return (
    <div className="overlay absolute inset-0 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="panel flex w-full max-w-xs flex-col items-center gap-2 rounded-lg p-5 text-center sm:max-w-sm sm:gap-3 sm:p-7">
        <h2 className={`font-display text-4xl sm:text-5xl ${tone === "player" ? "text-glow-player text-player" : "text-glow-cpu text-cpu"}`}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

function OverlayButton({ primary, onClick, children }: { primary?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`${primary ? "btn-play text-xl" : "btn-ghost text-base"} font-display w-full rounded-md py-2.5`} autoFocus={primary}>
      {children}
    </button>
  );
}

function TouchControls({ engineRef }: { engineRef: React.RefObject<Engine | null> }) {
  const held = (k: HeldKey) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); engineRef.current?.setHeld(k, true); },
    onPointerUp: () => engineRef.current?.setHeld(k, false),
    onPointerCancel: () => engineRef.current?.setHeld(k, false),
    onLostPointerCapture: () => engineRef.current?.setHeld(k, false),
  });
  const press = (k: PressKey) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); engineRef.current?.press(k); },
  });
  return (
    <div className="touch-pad flex shrink-0 items-end justify-between gap-3 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2" onContextMenu={(e) => e.preventDefault()}>
      <div className="grid grid-cols-3 grid-rows-2 gap-2">
        <span />
        <button className="tbtn" aria-label="Jump" {...press("jump")}>▲</button>
        <span />
        <button className="tbtn" aria-label="Move left" {...held("left")}>◀</button>
        <button className="tbtn" aria-label="Crouch" {...held("down")}>▼</button>
        <button className="tbtn" aria-label="Move right" {...held("right")}>▶</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button className="tbtn tbtn-atk font-display" aria-label="Punch" {...press("punch")}>PUNCH</button>
        <button className="tbtn tbtn-atk font-display" aria-label="Kick" {...press("kick")}>KICK</button>
        <button className="tbtn tbtn-block font-display" aria-label="Block (hold)" {...held("block")}>BLOCK</button>
        <button className="tbtn tbtn-special font-display" aria-label="Special attack" {...press("special")}>SPECIAL</button>
      </div>
    </div>
  );
}
