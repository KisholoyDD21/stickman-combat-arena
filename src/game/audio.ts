// Procedural Web Audio sound effects — no external assets.
export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  muted = false;

  init() {
    if (typeof window === "undefined") return;
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.45;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 0.5;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.45;
  }

  dispose() {
    void this.ctx?.close();
    this.ctx = null;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0) {
    const c = this.ctx;
    if (!c || !this.master || this.muted) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private burst(dur: number, vol: number, freq: number, type: BiquadFilterType = "lowpass", delay = 0) {
    const c = this.ctx;
    if (!c || !this.master || !this.noise || this.muted) return;
    const t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t);
    s.stop(t + dur + 0.02);
  }

  whoosh() { this.burst(0.12, 0.18, 2200, "bandpass"); }
  punch() { this.burst(0.08, 0.7, 1600); this.tone(160, 0.12, "sine", 0.7, 55); }
  kick() { this.burst(0.12, 0.8, 1000); this.tone(110, 0.18, "sine", 0.9, 40); }
  block() { this.tone(900, 0.06, "square", 0.15, 600); this.burst(0.05, 0.3, 4000, "highpass"); }
  special() { this.tone(200, 0.4, "sawtooth", 0.25, 900); this.burst(0.3, 0.3, 3000, "bandpass"); }
  specialHit() { this.burst(0.3, 0.9, 700); this.tone(80, 0.45, "sine", 1, 30); this.tone(600, 0.2, "square", 0.12, 150); }
  ko() { this.tone(90, 0.9, "sine", 1, 25); this.burst(0.6, 0.6, 400); }
  jump() { this.tone(260, 0.12, "triangle", 0.15, 520); }
  deny() { this.tone(180, 0.1, "square", 0.12, 120); }
  beep(high = false) { this.tone(high ? 880 : 440, high ? 0.35 : 0.18, "square", 0.15); }
  fanfare() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.25, "square", 0.12, undefined, i * 0.12)); }
  lose() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.3, "triangle", 0.18, undefined, i * 0.16)); }
}
