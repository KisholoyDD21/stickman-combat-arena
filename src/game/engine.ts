import { GameAudio } from "./audio";

export const W = 1200;
export const H = 675;
export const GROUND = 585;
const GRAVITY = 2300;
const SPEED = 330;
const JUMP_V = 860;
const ROUND_TIME = 60;
const WINS_NEEDED = 2;

export type Difficulty = "easy" | "normal" | "hard";
export type AttackKind = "punch" | "kick" | "special";
type FState = "idle" | "walk" | "jump" | "crouch" | "block" | "attack" | "hit" | "ko";
export type HeldKey = "left" | "right" | "down" | "block";
export type PressKey = "jump" | "punch" | "kick" | "special";

interface AttackDef {
  cost: number; startup: number; active: number; recovery: number;
  dmg: number; range: number; knock: number; stun: number; hitstop: number; high: boolean;
}

export const ATK: Record<AttackKind, AttackDef> = {
  punch: { cost: 10, startup: 0.09, active: 0.09, recovery: 0.17, dmg: 7, range: 82, knock: 230, stun: 0.3, hitstop: 0.06, high: true },
  kick: { cost: 18, startup: 0.16, active: 0.1, recovery: 0.26, dmg: 11, range: 104, knock: 330, stun: 0.38, hitstop: 0.085, high: false },
  special: { cost: 45, startup: 0.3, active: 0.2, recovery: 0.38, dmg: 20, range: 120, knock: 640, stun: 0.7, hitstop: 0.14, high: false },
};

interface Pose {
  torso: number; head: number; uaF: number; faF: number; uaB: number; faB: number;
  thF: number; shF: number; thB: number; shB: number;
}
const POSE_KEYS: (keyof Pose)[] = ["torso", "head", "uaF", "faF", "uaB", "faB", "thF", "shF", "thB", "shB"];

const TH = 34, SH = 34, TO = 52, UA = 27, FA = 27, HR = 14, NECK = 6;

interface Intent { move: number; jump: boolean; crouch: boolean; block: boolean; attack: AttackKind | null }
const NO_INTENT: Intent = { move: 0, jump: false, crouch: false, block: false, attack: null };

class Fighter {
  x: number; y = GROUND; vx = 0; vy = 0; facing: 1 | -1;
  hp = 100; energy = 100; state: FState = "idle"; grounded = true;
  atk: AttackKind | null = null; atkT = 0; atkHit = false;
  hitstun = 0; cooldown = 0; combo = 0; comboTimer = 0;
  flash = 0; squash = 0; walkPh = 0; lowEnergy = 0; wins = 0; victory = false;
  pose: Pose; trail: { x: number; y: number; life: number }[] = [];
  hand = { x: 0, y: 0 }; foot = { x: 0, y: 0 };
  constructor(public name: string, public color: string, public dark: string, x: number, facing: 1 | -1) {
    this.x = x;
    this.facing = facing;
    this.pose = idlePose(0);
  }
  reset(x: number, facing: 1 | -1) {
    Object.assign(this, {
      x, y: GROUND, vx: 0, vy: 0, facing, hp: 100, energy: 100, state: "idle", grounded: true,
      atk: null, atkT: 0, atkHit: false, hitstun: 0, cooldown: 0, combo: 0, comboTimer: 0,
      flash: 0, squash: 0, lowEnergy: 0, victory: false,
    });
    this.trail = [];
  }
  get attackPhase(): "startup" | "active" | "recovery" | null {
    if (this.state !== "attack" || !this.atk) return null;
    const a = ATK[this.atk];
    if (this.atkT < a.startup) return "startup";
    if (this.atkT < a.startup + a.active) return "active";
    return "recovery";
  }
}

function idlePose(t: number): Pose {
  const b = Math.sin(t * 3);
  return { torso: 0.12 + b * 0.025, head: -0.08, uaF: 0.55 + b * 0.05, faF: 2.5, uaB: 0.25 + b * 0.05, faB: 2.3, thF: 0.38, shF: 0.05, thB: -0.38, shB: -0.25 };
}

function targetPose(f: Fighter, t: number): Pose {
  const base = idlePose(t);
  if (f.victory) {
    const b = Math.sin(t * 8) * 0.1;
    return { ...base, torso: -0.05, head: -0.2, uaF: 2.9 + b, faF: 3.1 + b, uaB: 0.4, faB: 2.4 };
  }
  switch (f.state) {
    case "ko":
      return { torso: -1.45, head: -0.25, uaF: -1.7, faF: -1.9, uaB: -1.2, faB: -1.5, thF: 1.5, shF: 1.55, thB: 1.35, shB: 1.6 };
    case "hit":
      return { ...base, torso: -0.45, head: -0.35, uaF: -0.4, faF: 0.5, uaB: -0.7, faB: -0.2, thF: 0.5, shF: 0.1, thB: -0.25, shB: -0.4 };
    case "block":
      return { ...base, torso: -0.05, head: 0.1, uaF: 0.35, faF: 2.95, uaB: 0.75, faB: 2.8, thF: 0.48, shF: -0.05, thB: -0.48, shB: -0.38 };
    case "crouch":
      return { ...base, torso: 0.45, head: 0.1, uaF: 0.9, faF: 2.4, uaB: 0.6, faB: 2.2, thF: 1.25, shF: -0.2, thB: 0.7, shB: -0.9 };
    case "jump":
      return f.vy < 0
        ? { ...base, torso: 0.15, uaF: 0.9, faF: 2.3, uaB: -0.4, faB: 1.0, thF: 1.1, shF: -0.3, thB: 0.3, shB: -0.9 }
        : { ...base, torso: 0.1, uaF: 0.8, faF: 2.2, uaB: -0.2, faB: 1.2, thF: 0.55, shF: 0.0, thB: -0.2, shB: -0.35 };
    case "walk": {
      const s = Math.sin(f.walkPh);
      const lift = (p: number) => 0.25 + 0.45 * Math.max(0, Math.sin(p));
      return {
        ...base, torso: 0.18,
        thF: 0.1 + 0.55 * s, shF: 0.1 + 0.55 * s - lift(f.walkPh + 1.6),
        thB: 0.1 - 0.55 * s, shB: 0.1 - 0.55 * s - lift(f.walkPh + 1.6 + Math.PI),
      };
    }
    case "attack": {
      const ph = f.attackPhase;
      const a = ATK[f.atk!];
      const recLate = ph === "recovery" && f.atkT > a.startup + a.active + a.recovery * 0.45;
      if (recLate) return base;
      if (f.atk === "punch") {
        return ph === "startup"
          ? { ...base, torso: 0.0, uaF: -0.25, faF: 2.0, uaB: 0.6, faB: 2.6 }
          : { ...base, torso: 0.32, head: 0, uaF: 1.6, faF: 1.6, uaB: 0.3, faB: 2.3, thF: 0.65, shF: 0.1, thB: -0.6, shB: -0.3 };
      }
      if (f.atk === "kick") {
        return ph === "startup"
          ? { ...base, torso: -0.05, uaF: 0.7, faF: 2.4, thF: 1.35, shF: -0.25, thB: -0.15, shB: -0.15 }
          : { ...base, torso: -0.38, head: 0.15, uaF: 0.3, faF: 1.2, uaB: -0.7, faB: 0.4, thF: 1.68, shF: 1.66, thB: -0.12, shB: -0.12 };
      }
      return ph === "startup"
        ? { ...base, torso: 0.55, head: 0.2, uaF: -0.7, faF: 0.3, uaB: -0.9, faB: 0.2, thF: 1.2, shF: -0.2, thB: 0.6, shB: -0.9 }
        : { ...base, torso: 0.45, head: -0.1, uaF: 1.57, faF: 1.57, uaB: 1.4, faB: 1.5, thF: 0.95, shF: 0.2, thB: -0.85, shB: -0.5 };
    }
    default:
      return base;
  }
}

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number }
interface FloatText { x: number; y: number; vy: number; life: number; text: string; color: string; size: number }

export type Phase = "intro" | "fight" | "roundEnd" | "matchEnd";
export interface FighterHud { name: string; hp: number; energy: number; wins: number; combo: number; low: boolean }
export interface HudSnapshot {
  phase: Phase; round: number; timer: number; paused: boolean;
  announce: string | null; announceSub: string | null;
  p: FighterHud; c: FighterHud; matchWinner: "player" | "cpu" | null; showResult: boolean;
}

const DIFF = {
  easy: { react: 0.5, aggr: 0.35, block: 0.22, special: 0.12 },
  normal: { react: 0.3, aggr: 0.55, block: 0.5, special: 0.3 },
  hard: { react: 0.17, aggr: 0.72, block: 0.75, special: 0.45 },
};

export class Engine {
  player: Fighter; cpu: Fighter;
  audio = new GameAudio();
  particles: Particle[] = []; texts: FloatText[] = [];
  phase: Phase = "intro"; phaseT = 0; round = 1; timer = ROUND_TIME;
  paused = false; time = 0; hitstop = 0; slowmo = 0; shake = 0;
  roundResult: { reason: "KO" | "TIME" | "DRAW"; winner: Fighter | null } | null = null;
  held: Record<HeldKey, boolean> = { left: false, right: false, down: false, block: false };
  buf: Record<PressKey, number> = { jump: 0, punch: 0, kick: 0, special: 0 };
  ai = { t: 0, move: 0, crouch: false, attack: null as AttackKind | null, jump: false, blockUntil: 0, blockDecided: false };
  reducedMotion = false;
  onHud: ((s: HudSnapshot) => void) | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private raf = 0; private last = 0; private hudT = 0; private lastHudKey = "";
  private scale = 1; private dpr = 1;
  private towers: { x: number; w: number; h: number; lit: number[] }[] = [];
  private crowd: { x: number; h: number; ph: number }[] = [];
  private motes: { x: number; y: number; s: number; v: number }[] = [];

  constructor(public difficulty: Difficulty) {
    this.player = new Fighter("YOU", "#22e5ff", "#0a6f85", 380, 1);
    this.cpu = new Fighter("CPU", "#ff5a1f", "#8a2a0b", 820, -1);
    let x = -100;
    while (x < W + 200) {
      const w = 40 + Math.random() * 70;
      this.towers.push({ x, w, h: 120 + Math.random() * 230, lit: Array.from({ length: 12 }, () => Math.random()) });
      x += w + 8;
    }
    for (let i = 0; i < 70; i++) this.crowd.push({ x: -60 + i * 20 + Math.random() * 8, h: 30 + Math.random() * 18, ph: Math.random() * 6 });
    for (let i = 0; i < 40; i++) this.motes.push({ x: Math.random() * W, y: Math.random() * GROUND, s: 0.5 + Math.random() * 2, v: 5 + Math.random() * 15 });
  }

  start(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.audio.init();
    this.last = performance.now();
    const frame = (t: number) => {
      const dt = Math.min(0.033, (t - this.last) / 1000);
      this.last = t;
      if (!this.paused) this.step(dt);
      this.render();
      this.emitHud(dt);
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.audio.dispose();
  }

  resize(cssW: number, cssH: number, dpr: number) {
    if (!this.canvas) return;
    this.dpr = dpr;
    this.scale = cssW / W;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
  }

  setHeld(k: HeldKey, v: boolean) { this.held[k] = v; }
  press(k: PressKey) { this.buf[k] = 0.18; }
  clearInput() { (Object.keys(this.held) as HeldKey[]).forEach((k) => (this.held[k] = false)); }
  setPaused(p: boolean) {
    if (this.phase === "matchEnd") return;
    this.paused = p;
    this.clearInput();
    this.emitHud(0, true);
  }
  setMuted(m: boolean) { this.audio.setMuted(m); }

  restartMatch() {
    this.player.wins = 0; this.cpu.wins = 0; this.round = 1;
    this.paused = false;
    this.beginRound();
  }

  private beginRound() {
    this.player.reset(380, 1);
    this.cpu.reset(820, -1);
    this.phase = "intro"; this.phaseT = 0; this.timer = ROUND_TIME;
    this.roundResult = null; this.particles = []; this.texts = [];
    this.ai.blockUntil = 0;
    this.audio.beep(false);
  }

  // ---------------- simulation ----------------
  private step(dt: number) {
    this.time += dt;
    for (const k of Object.keys(this.buf) as PressKey[]) this.buf[k] = Math.max(0, this.buf[k] - dt);
    this.shake = Math.max(0, this.shake - dt * 40);
    this.updateFx(dt);
    if (this.hitstop > 0) { this.hitstop -= dt; return; }
    const sdt = this.slowmo > 0 ? dt * 0.35 : dt;
    this.slowmo -= dt;
    this.phaseT += dt;

    let pi = NO_INTENT, ci = NO_INTENT;
    if (this.phase === "intro") {
      if (this.phaseT > 1.3 && this.phaseT - dt <= 1.3) this.audio.beep(true);
      if (this.phaseT > 2.1) { this.phase = "fight"; this.phaseT = 0; }
    } else if (this.phase === "fight") {
      pi = this.playerIntent();
      ci = this.cpuIntent(sdt);
      this.timer = Math.max(0, this.timer - sdt);
      if (this.timer <= 0) this.endRound("TIME");
    } else if (this.phase === "roundEnd") {
      if (this.phaseT > 3.4) {
        if (this.player.wins >= WINS_NEEDED || this.cpu.wins >= WINS_NEEDED) {
          this.phase = "matchEnd"; this.phaseT = 0;
          if (this.player.wins > this.cpu.wins) this.audio.fanfare(); else this.audio.lose();
        } else {
          if (this.roundResult?.reason !== "DRAW") this.round++;
          this.beginRound();
        }
      }
    }

    const pr = this.updateFighter(this.player, pi, sdt);
    if (pr.jumped) this.buf.jump = 0;
    if (pr.attacked) this.buf[pr.attacked] = 0;
    this.updateFighter(this.cpu, ci, sdt);
    this.resolveHit(this.player, this.cpu);
    this.resolveHit(this.cpu, this.player);

    // separation & bounds
    const p = this.player, c = this.cpu;
    const dx = c.x - p.x;
    if (Math.abs(dx) < 44 && Math.abs(p.y - c.y) < 80 && p.state !== "ko" && c.state !== "ko") {
      const push = (44 - Math.abs(dx)) / 2 * (dx >= 0 ? 1 : -1);
      p.x -= push; c.x += push;
    }
    for (const f of [p, c]) f.x = Math.max(50, Math.min(W - 50, f.x));
    for (const [f, o] of [[p, c], [c, p]] as const) {
      if (f.state !== "attack" && f.state !== "ko" && f.state !== "hit") f.facing = o.x >= f.x ? 1 : -1;
      if (f.comboTimer > 0) f.comboTimer -= sdt;
      if (o.state !== "hit" && f.comboTimer <= 0) f.combo = 0;
    }
  }

  private playerIntent(): Intent {
    const h = this.held;
    let attack: AttackKind | null = null;
    if (this.buf.special > 0) attack = "special";
    else if (this.buf.kick > 0) attack = "kick";
    else if (this.buf.punch > 0) attack = "punch";
    return { move: (h.right ? 1 : 0) - (h.left ? 1 : 0), jump: this.buf.jump > 0, crouch: h.down, block: h.block, attack };
  }

  private cpuIntent(dt: number): Intent {
    const f = this.cpu, o = this.player, ai = this.ai, D = DIFF[this.difficulty];
    const d = o.x - f.x, dist = Math.abs(d), dir = Math.sign(d) || 1;
    // reactive defense
    if (o.attackPhase === "startup" && o.atk && dist < ATK[o.atk].range + 40) {
      if (!ai.blockDecided) {
        ai.blockDecided = true;
        if (Math.random() < D.block && f.energy > 8) ai.blockUntil = this.time + 0.35 + Math.random() * 0.25;
      }
    } else if (o.state !== "attack") ai.blockDecided = false;
    if (this.time < ai.blockUntil) return { ...NO_INTENT, block: true };

    ai.t -= dt;
    let attack: AttackKind | null = null, jump = false;
    if (ai.t <= 0) {
      ai.t = D.react * (0.6 + Math.random() * 0.9);
      ai.crouch = false;
      const r = Math.random();
      if (f.energy < 22 && r < 0.55) ai.move = -dir;
      else if (dist > 150) { ai.move = dir; jump = Math.random() < 0.08; }
      else if (dist > 100) {
        if (r < D.aggr * 0.6 && f.energy >= ATK.kick.cost) { attack = "kick"; ai.move = 0; }
        else if (r < 0.75) ai.move = dir;
        else ai.move = Math.random() < 0.5 ? -dir : 0;
      } else {
        if (r < D.aggr) {
          ai.move = 0;
          if (f.energy >= ATK.special.cost && Math.random() < D.special) attack = "special";
          else attack = Math.random() < 0.55 ? "punch" : "kick";
        } else if (r < D.aggr + 0.12) { ai.crouch = true; ai.move = 0; }
        else ai.move = -dir;
      }
    }
    return { move: ai.move, jump, crouch: ai.crouch, block: false, attack };
  }

  private updateFighter(f: Fighter, it: Intent, dt: number): { jumped: boolean; attacked: AttackKind | null } {
    let jumped = false, attacked: AttackKind | null = null;
    f.flash = Math.max(0, f.flash - dt * 6);
    f.squash = Math.max(0, f.squash - dt * 5);
    f.lowEnergy = Math.max(0, f.lowEnergy - dt);
    f.cooldown = Math.max(0, f.cooldown - dt);
    const regen = f.state === "block" ? 6 : f.state === "attack" ? 4 : 15;
    if (f.state !== "ko") f.energy = Math.min(100, f.energy + regen * dt);

    if (f.state === "ko") {
      f.vx *= f.grounded ? Math.pow(0.02, dt) : 1;
    } else if (f.state === "hit") {
      f.hitstun -= dt;
      if (f.grounded) f.vx *= Math.pow(0.004, dt);
      if (f.hitstun <= 0 && f.grounded) f.state = "idle";
    } else if (f.state === "attack" && f.atk) {
      const a = ATK[f.atk];
      const prev = f.atkT;
      f.atkT += dt;
      if (f.atk === "special" && f.atkT >= a.startup * 0.7 && f.atkT < a.startup + a.active) f.vx = f.facing * 560;
      else if (f.grounded) f.vx *= Math.pow(0.001, dt);
      if (prev < a.startup && f.atkT >= a.startup) f.atk === "special" ? this.audio.special() : this.audio.whoosh();
      if (f.atkT >= a.startup + a.active + a.recovery) {
        f.state = f.grounded ? "idle" : "jump";
        f.atk = null;
        f.cooldown = 0.06;
      }
    } else {
      // free state
      if (it.attack) {
        const a = ATK[it.attack];
        if (f.cooldown > 0) { /* buffered until cooldown ends */ }
        else if (f.energy >= a.cost && (f.grounded || it.attack !== "special")) {
          f.energy -= a.cost;
          f.state = "attack"; f.atk = it.attack; f.atkT = 0; f.atkHit = false;
          attacked = it.attack;
        } else {
          attacked = it.attack;
          if (f.energy < a.cost && f.lowEnergy <= 0) {
            f.lowEnergy = 0.6;
            if (f === this.player) { this.audio.deny(); this.addText(f.x, f.y - 170, "LOW ENERGY", "#ffd34d", 22); }
          }
        }
      }
      if (f.state !== "attack") {
        if (f.grounded) {
          if (it.jump) {
            f.vy = -JUMP_V; f.grounded = false; f.state = "jump"; jumped = true;
            f.vx = it.move * SPEED * 0.9;
            this.audio.jump();
          } else if (it.block) { f.state = "block"; f.vx = 0; }
          else if (it.crouch) { f.state = "crouch"; f.vx = 0; }
          else {
            f.vx = it.move * SPEED * (it.move === f.facing ? 1 : 0.78);
            f.state = it.move !== 0 ? "walk" : "idle";
          }
        } else {
          f.vx += it.move * SPEED * 3 * dt;
          f.vx = Math.max(-SPEED, Math.min(SPEED, f.vx));
          f.state = "jump";
        }
      }
    }

    // physics
    if (!f.grounded) f.vy += GRAVITY * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    if (f.y >= GROUND) {
      if (!f.grounded) {
        f.squash = Math.min(1, Math.abs(f.vy) / 900);
        if (Math.abs(f.vy) > 300) this.dust(f.x, f.state === "ko" ? 14 : 6);
        if (f.state === "jump") f.state = "idle";
      }
      f.y = GROUND; f.vy = 0; f.grounded = true;
    }
    if (f.state === "walk") f.walkPh += dt * Math.abs(f.vx) / 26 * (Math.sign(f.vx) === f.facing ? 1 : -1);

    // pose blending
    const tp = targetPose(f, this.time);
    const rate = f.attackPhase === "active" ? 40 : f.state === "hit" ? 30 : f.state === "ko" ? 9 : 15;
    const k = 1 - Math.exp(-rate * dt);
    for (const key of POSE_KEYS) f.pose[key] += (tp[key] - f.pose[key]) * k;

    // trail for special
    const sk = this.skeleton(f);
    f.hand = sk.handF; f.foot = sk.footF;
    if (f.atk === "special" && f.state === "attack") f.trail.push({ x: sk.handF.x, y: sk.handF.y, life: 1 });
    for (const t of f.trail) t.life -= dt * 4;
    f.trail = f.trail.filter((t) => t.life > 0);
    return { jumped, attacked };
  }

  private resolveHit(f: Fighter, o: Fighter) {
    if (f.attackPhase !== "active" || f.atkHit || !f.atk || o.state === "ko") return;
    const a = ATK[f.atk];
    const dx = (o.x - f.x) * f.facing;
    const vertOk = Math.abs(f.y - o.y) < 95;
    const highMiss = a.high && o.state === "crouch";
    if (!(dx > -12 && dx < a.range && vertOk && !highMiss)) return;
    f.atkHit = true;
    const hx = f.x + f.facing * Math.min(dx, a.range) * 0.8;
    const hy = f.atk === "punch" ? o.y - 110 : f.atk === "kick" ? o.y - 80 : o.y - 95;
    const blocked = o.state === "block" && o.facing === -f.facing;
    if (blocked) {
      o.hp = Math.max(1, o.hp - a.dmg * 0.15);
      o.energy -= a.dmg * 0.9;
      o.vx = f.facing * a.knock * 0.55;
      o.squash = 0.5;
      this.burst(hx, hy, 10, "#e8f6ff", 260);
      this.addText(hx, hy - 30, "BLOCK", "#bfe9ff", 22);
      this.audio.block();
      this.hitstop = 0.04; this.shake = Math.max(this.shake, 3);
      if (o.energy <= 0) {
        o.energy = 0; o.state = "hit"; o.hitstun = 0.7; o.flash = 1;
        this.addText(o.x, o.y - 190, "GUARD BREAK!", "#ffd34d", 30);
        this.audio.kick();
      }
      return;
    }
    const comboing = o.state === "hit";
    f.combo = comboing ? f.combo + 1 : 1;
    f.comboTimer = 1.1;
    const scale = f.combo >= 3 ? Math.max(0.5, Math.pow(0.85, f.combo - 2)) : 1;
    const dmg = Math.round(a.dmg * scale * (o.state === "crouch" && f.atk === "kick" ? 0.85 : 1));
    o.hp = Math.max(0, o.hp - dmg);
    o.state = "hit"; o.atk = null; o.hitstun = a.stun; o.flash = 1; o.squash = 1;
    o.vx = f.facing * a.knock;
    if (f.atk === "special") { o.vy = -380; o.grounded = false; }
    f.energy = Math.min(100, f.energy + 3);
    const col = f.atk === "special" ? "#ffd34d" : f.color;
    this.burst(hx, hy, f.atk === "special" ? 34 : 16, col, f.atk === "special" ? 520 : 340);
    this.burst(hx, hy, 6, "#ffffff", 200);
    this.addText(hx, hy - 30, `-${dmg}`, col, f.atk === "special" ? 40 : 30);
    if (f.combo >= 2) this.addText(f.x, f.y - 200, `${f.combo} HIT COMBO`, "#ffffff", 24);
    this.hitstop = a.hitstop;
    this.shake = Math.max(this.shake, f.atk === "special" ? 16 : f.atk === "kick" ? 8 : 5);
    if (f.atk === "special") this.audio.specialHit(); else if (f.atk === "kick") this.audio.kick(); else this.audio.punch();
    if (o.hp <= 0 && this.phase === "fight") {
      o.state = "ko"; o.vy = -560; o.vx = f.facing * 460; o.grounded = false;
      this.hitstop = 0.28; this.slowmo = 1.1; this.shake = 20;
      this.audio.ko();
      this.endRound("KO");
    }
  }

  private endRound(reason: "KO" | "TIME") {
    const p = this.player, c = this.cpu;
    let winner: Fighter | null = null;
    if (reason === "KO") winner = p.hp > 0 ? p : c;
    else if (Math.round(p.hp) !== Math.round(c.hp)) winner = p.hp > c.hp ? p : c;
    if (winner) {
      winner.wins++;
      winner.victory = true;
      if (winner.state !== "attack") winner.state = "idle";
    }
    for (const f of [p, c]) if (f.state === "block" || f.state === "crouch" || f.state === "walk") f.state = "idle";
    this.roundResult = { reason: winner ? reason : "DRAW", winner };
    this.phase = "roundEnd"; this.phaseT = 0;
    if (reason === "TIME") this.audio.beep(true);
  }

  // ---------------- effects ----------------
  private burst(x: number, y: number, n: number, color: string, speed: number) {
    const m = this.reducedMotion ? Math.ceil(n / 3) : n;
    for (let i = 0; i < m; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, life: 0.5, max: 0.5, color, size: 2 + Math.random() * 3 });
    }
  }
  private dust(x: number, n: number) {
    for (let i = 0; i < n; i++) {
      const s = (Math.random() - 0.5) * 300;
      this.particles.push({ x: x + s * 0.05, y: GROUND - 2, vx: s, vy: -40 - Math.random() * 80, life: 0.6, max: 0.6, color: "#8a90b0", size: 3 + Math.random() * 3 });
    }
  }
  private addText(x: number, y: number, text: string, color: string, size: number) {
    this.texts.push({ x, y, vy: -90, life: 0.9, text, color, size });
  }
  private updateFx(dt: number) {
    for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 900 * dt; p.vx *= 0.96; p.life -= dt; }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const t of this.texts) { t.y += t.vy * dt; t.vy *= 0.94; t.life -= dt; }
    this.texts = this.texts.filter((t) => t.life > 0);
    for (const m of this.motes) { m.y -= m.v * dt; m.x += Math.sin(this.time + m.s) * 5 * dt; if (m.y < 0) m.y = GROUND; }
  }

  // ---------------- HUD ----------------
  private announce(): [string | null, string | null] {
    if (this.phase === "intro") {
      if (this.phaseT < 1.3) return [`ROUND ${this.round}`, this.round === 3 ? "FINAL ROUND" : null];
      return ["FIGHT!", null];
    }
    if (this.phase === "roundEnd" && this.roundResult) {
      const r = this.roundResult;
      if (this.phaseT < 1.6) return [r.reason === "KO" ? "K.O.!" : r.reason === "TIME" ? "TIME!" : "DRAW", null];
      if (r.reason === "DRAW") return ["DRAW", "Round replays"];
      return [r.winner === this.player ? "YOU WIN" : "CPU WINS", `Round ${this.round}`];
    }
    return [null, null];
  }

  private emitHud(dt: number, force = false) {
    if (!this.onHud) return;
    this.hudT += dt;
    const [announce, announceSub] = this.announce();
    const showResult = this.phase === "matchEnd" && this.phaseT > 0.6;
    const key = `${this.phase}|${announce}|${this.paused}|${showResult}`;
    if (!force && this.hudT < 0.05 && key === this.lastHudKey) return;
    this.hudT = 0; this.lastHudKey = key;
    const fh = (f: Fighter): FighterHud => ({ name: f.name, hp: f.hp, energy: f.energy, wins: f.wins, combo: f.combo, low: f.lowEnergy > 0 });
    this.onHud({
      phase: this.phase, round: this.round, timer: Math.ceil(this.timer), paused: this.paused,
      announce, announceSub, p: fh(this.player), c: fh(this.cpu),
      matchWinner: this.phase === "matchEnd" ? (this.player.wins > this.cpu.wins ? "player" : "cpu") : null,
      showResult,
    });
  }

  // ---------------- rendering ----------------
  private skeleton(f: Fighter) {
    const p = f.pose, s = f.facing;
    const legV = (a: number, b: number) => Math.cos(a) * TH + Math.cos(b) * SH;
    const hipY = f.y - Math.max(10, legV(p.thF, p.shF), legV(p.thB, p.shB));
    const hip = { x: f.x, y: hipY };
    const seg = (o: { x: number; y: number }, a: number, len: number) => ({ x: o.x + Math.sin(a) * len * s, y: o.y + Math.cos(a) * len });
    const kneeF = seg(hip, p.thF, TH), footF = seg(kneeF, p.shF, SH);
    const kneeB = seg(hip, p.thB, TH), footB = seg(kneeB, p.shB, SH);
    const sh = { x: hip.x + Math.sin(p.torso) * TO * s, y: hip.y - Math.cos(p.torso) * TO };
    const ha = p.torso + p.head;
    const head = { x: sh.x + Math.sin(ha) * (NECK + HR) * s, y: sh.y - Math.cos(ha) * (NECK + HR) };
    const elbowF = seg(sh, p.uaF, UA), handF = seg(elbowF, p.faF, FA);
    const elbowB = seg(sh, p.uaB, UA), handB = seg(elbowB, p.faB, FA);
    return { hip, kneeF, footF, kneeB, footB, sh, head, elbowF, handF, elbowB, handB };
  }

  private render() {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.setTransform(this.dpr * this.scale, 0, 0, this.dpr * this.scale, 0, 0);
    let sx = 0, sy = 0;
    if (this.shake > 0 && !this.reducedMotion) { sx = (Math.random() - 0.5) * this.shake; sy = (Math.random() - 0.5) * this.shake; }
    ctx.save();
    ctx.translate(sx, sy);
    const mid = (this.player.x + this.cpu.x) / 2;
    const cam = mid - W / 2;
    this.drawBackground(ctx, cam);
    for (const f of [this.player, this.cpu]) this.drawShadow(ctx, f);
    // draw attacker in front
    const order = this.cpu.state === "attack" ? [this.player, this.cpu] : [this.cpu, this.player];
    for (const f of order) this.drawFighter(ctx, f);
    this.drawFx(ctx);
    ctx.restore();
    // vignette
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,0.65)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
    if (this.slowmo > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.max(0, this.slowmo - 0.85) * 1.2})`; ctx.fillRect(0, 0, W, H); }
  }

  private drawBackground(ctx: CanvasRenderingContext2D, cam: number) {
    const t = this.time;
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
    sky.addColorStop(0, "#04050c"); sky.addColorStop(0.55, "#0b0e22"); sky.addColorStop(1, "#1c0e1f");
    ctx.fillStyle = sky;
    ctx.fillRect(-40, -40, W + 80, GROUND + 40);
    // far city
    ctx.save();
    ctx.translate(-cam * 0.12, 0);
    for (const tw of this.towers) {
      const top = GROUND - 150 - tw.h;
      ctx.fillStyle = "#0a0c1c";
      ctx.fillRect(tw.x, top, tw.w, tw.h + 150);
      for (let i = 0; i < tw.lit.length; i++) {
        if (tw.lit[i]! < 0.6) continue;
        const wx = tw.x + 6 + (i % 3) * (tw.w / 3.2), wy = top + 14 + Math.floor(i / 3) * 22;
        ctx.fillStyle = tw.lit[i]! > 0.85 ? "rgba(255,120,60,0.55)" : "rgba(60,220,255,0.35)";
        ctx.fillRect(wx, wy, 5, 8);
      }
    }
    ctx.restore();
    // back wall banner
    ctx.save();
    ctx.translate(-cam * 0.3, 0);
    const wallY = GROUND - 210;
    const wg = ctx.createLinearGradient(0, wallY, 0, GROUND);
    wg.addColorStop(0, "#0d0f22"); wg.addColorStop(1, "#160b1a");
    ctx.fillStyle = wg;
    ctx.fillRect(-100, wallY, W + 200, 210);
    ctx.strokeStyle = "rgba(34,229,255,0.6)"; ctx.lineWidth = 2;
    ctx.shadowColor = "#22e5ff"; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.moveTo(-100, wallY); ctx.lineTo(W + 200, wallY); ctx.stroke();
    ctx.font = "64px Bungee, Impact, sans-serif";
    ctx.textAlign = "center";
    const flick = 0.75 + 0.25 * Math.sin(t * 17) * (Math.sin(t * 0.7) > 0.9 ? 1 : 0);
    ctx.fillStyle = `rgba(255,90,31,${0.5 * flick})`; ctx.shadowColor = "#ff5a1f"; ctx.shadowBlur = 28;
    ctx.fillText("STICK CLASH", W / 2, wallY + 80);
    ctx.shadowBlur = 0;
    ctx.restore();
    // crowd
    ctx.save();
    ctx.translate(-cam * 0.5, 0);
    const cy = GROUND - 70;
    const hype = this.phase === "roundEnd" ? 3 : 1;
    for (const c of this.crowd) {
      const bob = Math.abs(Math.sin(t * 2.5 * hype + c.ph)) * 5 * hype;
      ctx.fillStyle = "#07070f";
      ctx.beginPath(); ctx.arc(c.x, cy - c.h - bob, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(c.x - 10, cy - c.h + 6 - bob, 20, c.h + 80);
    }
    ctx.restore();
    // spotlights
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const spots: [number, string, number][] = [[W * 0.22, "34,229,255", 0], [W * 0.78, "255,90,31", 2], [W * 0.5, "200,210,255", 4]];
    for (const [x, rgb, ph] of spots) {
      const sw = Math.sin(t * 0.5 + ph) * 120;
      const g = ctx.createLinearGradient(x, -20, x + sw, GROUND);
      g.addColorStop(0, `rgba(${rgb},0.28)`); g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x - 18, -20); ctx.lineTo(x + 18, -20); ctx.lineTo(x + sw + 170, GROUND + 20); ctx.lineTo(x + sw - 170, GROUND + 20); ctx.closePath(); ctx.fill();
      const pool = ctx.createRadialGradient(x + sw, GROUND + 20, 0, x + sw, GROUND + 20, 200);
      pool.addColorStop(0, `rgba(${rgb},0.18)`); pool.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = pool;
      ctx.fillRect(x + sw - 220, GROUND - 40, 440, 120);
    }
    ctx.restore();
    // floor
    const fg = ctx.createLinearGradient(0, GROUND, 0, H);
    fg.addColorStop(0, "#14122a"); fg.addColorStop(1, "#06060d");
    ctx.fillStyle = fg;
    ctx.fillRect(-40, GROUND, W + 80, H - GROUND + 40);
    ctx.save();
    ctx.beginPath(); ctx.rect(-40, GROUND, W + 80, H - GROUND + 40); ctx.clip();
    ctx.strokeStyle = "rgba(34,229,255,0.16)"; ctx.lineWidth = 1;
    const vx = W / 2 - cam * 0.9, vy = GROUND - 260;
    for (let i = -24; i <= 24; i++) {
      const bx = W / 2 + i * 90 - cam;
      ctx.beginPath(); ctx.moveTo(vx + (bx - vx) * ((GROUND - vy) / (H + 60 - vy)), GROUND); ctx.lineTo(bx, H + 60); ctx.stroke();
    }
    for (let i = 1; i < 9; i++) {
      const y = GROUND + Math.pow(i / 8, 1.8) * (H - GROUND);
      ctx.strokeStyle = `rgba(255,90,31,${0.05 + i * 0.015})`;
      ctx.beginPath(); ctx.moveTo(-40, y); ctx.lineTo(W + 40, y); ctx.stroke();
    }
    ctx.restore();
    const edge = ctx.createLinearGradient(0, 0, W, 0);
    edge.addColorStop(0, "#22e5ff"); edge.addColorStop(0.5, "#c9d4ff"); edge.addColorStop(1, "#ff5a1f");
    ctx.strokeStyle = edge; ctx.lineWidth = 3; ctx.shadowColor = "#ffffff"; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.moveTo(-40, GROUND); ctx.lineTo(W + 40, GROUND); ctx.stroke();
    ctx.shadowBlur = 0;
    // motes
    ctx.fillStyle = "rgba(200,220,255,0.35)";
    for (const m of this.motes) ctx.fillRect(m.x, m.y, m.s, m.s);
  }

  private drawShadow(ctx: CanvasRenderingContext2D, f: Fighter) {
    const hgt = GROUND - f.y;
    const sc = Math.max(0.35, 1 - hgt / 400);
    const w = f.state === "ko" && f.grounded ? 80 : 42;
    ctx.fillStyle = `rgba(0,0,0,${0.55 * sc})`;
    ctx.beginPath(); ctx.ellipse(f.x - (f.state === "ko" ? f.facing * 30 : 0), GROUND + 4, w * sc, 9 * sc, 0, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createRadialGradient(f.x, GROUND + 4, 0, f.x, GROUND + 4, 70 * sc);
    g.addColorStop(0, f.color + "40"); g.addColorStop(1, f.color + "00");
    ctx.fillStyle = g;
    ctx.fillRect(f.x - 80, GROUND - 10, 160, 30);
  }

  private drawFighter(ctx: CanvasRenderingContext2D, f: Fighter) {
    const k = this.skeleton(f);
    ctx.save();
    // squash & stretch around feet
    const sq = f.squash * 0.1;
    ctx.translate(f.x, f.y);
    ctx.scale(1 + sq, 1 - sq);
    ctx.translate(-f.x, -f.y);
    // special trail
    if (f.trail.length > 1) {
      ctx.lineCap = "round";
      for (let i = 1; i < f.trail.length; i++) {
        const a = f.trail[i - 1]!, b = f.trail[i]!;
        ctx.strokeStyle = `rgba(255,211,77,${b.life * 0.8})`;
        ctx.lineWidth = 18 * b.life;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
    const flash = f.flash > 0.5;
    const main = flash ? "#ffffff" : f.color;
    const back = flash ? "#dddddd" : f.dark;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    const limb = (pts: { x: number; y: number }[], color: string, w: number) => {
      ctx.strokeStyle = color; ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(pts[0]!.x, pts[0]!.y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y);
      ctx.stroke();
    };
    const dot = (p: { x: number; y: number }, r: number, color: string) => {
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
    };
    const boot = (knee: { x: number; y: number }, foot: { x: number; y: number }, color: string) => {
      const a = Math.atan2(foot.y - knee.y, foot.x - knee.x);
      ctx.save(); ctx.translate(foot.x, foot.y); ctx.rotate(a - Math.PI / 2 * f.facing);
      ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(f.facing * 5, 0, 10, 5.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    };
    ctx.shadowColor = f.color; ctx.shadowBlur = flash ? 30 : 14;
    // back limbs
    limb([k.hip, k.kneeB, k.footB], back, 7);
    boot(k.kneeB, k.footB, back);
    limb([k.sh, k.elbowB, k.handB], back, 6.5);
    dot(k.handB, 7.5, back);
    // torso & head
    limb([k.hip, k.sh], main, 10);
    ctx.strokeStyle = main; ctx.lineWidth = 2;
    dot(k.head, HR, "#0a0b16");
    ctx.lineWidth = 5; ctx.strokeStyle = main;
    ctx.beginPath(); ctx.arc(k.head.x, k.head.y, HR - 1, 0, Math.PI * 2); ctx.stroke();
    // headband / eye
    ctx.shadowBlur = 0;
    const ha = f.pose.torso + f.pose.head;
    const ex = k.head.x + Math.cos(ha) * 6 * f.facing, ey = k.head.y + Math.sin(ha) * 6 * f.facing * f.facing - 2;
    ctx.fillStyle = f.state === "ko" ? "#555" : "#ffffff";
    ctx.fillRect(ex - 2.5 + f.facing * 2, ey - 1.5, 5, 3);
    const tailX = k.head.x - Math.cos(ha) * HR * f.facing, tailY = k.head.y - 4;
    const wave = Math.sin(this.time * 10) * 4;
    limb([{ x: tailX, y: tailY }, { x: tailX - f.facing * 14, y: tailY + 4 + wave }, { x: tailX - f.facing * 24, y: tailY + 2 - wave }], f.color, 3);
    ctx.shadowBlur = 14;
    // front limbs
    limb([k.hip, k.kneeF, k.footF], main, 7.5);
    boot(k.kneeF, k.footF, main);
    limb([k.sh, k.elbowF, k.handF], main, 7);
    dot(k.handF, 8.5, main);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath(); ctx.arc(k.handF.x - 2, k.handF.y - 3, 3, 0, Math.PI * 2); ctx.fill();
    // block shield
    if (f.state === "block") {
      ctx.strokeStyle = "rgba(190,233,255,0.55)"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(f.x + f.facing * 10, f.y - 95, 62, -Math.PI / 2.6 + (f.facing < 0 ? Math.PI : 0), Math.PI / 2.6 + (f.facing < 0 ? Math.PI : 0)); ctx.stroke();
    }
    // charge aura
    if (f.attackPhase === "startup" && f.atk === "special") {
      ctx.strokeStyle = `rgba(255,211,77,${0.4 + Math.random() * 0.4})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(k.sh.x, k.sh.y + 20, 50 + Math.random() * 10, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  private drawFx(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    ctx.save();
    ctx.textAlign = "center";
    for (const t of this.texts) {
      ctx.globalAlpha = Math.min(1, t.life * 2);
      ctx.font = `${t.size}px Bungee, Impact, sans-serif`;
      ctx.lineWidth = 5; ctx.strokeStyle = "rgba(0,0,0,0.8)";
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.restore();
  }
}
