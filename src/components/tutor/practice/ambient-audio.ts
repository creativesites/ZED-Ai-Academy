// Procedural WebAudio ambient room soundscape (zero downloads, ultra-subtle, respects Mute & Volume).
// Generates warm filtered room ambience matched to the active scene (Classroom, Studio, Cafe/TeaHouse, etc.).

import type { SceneArtboard } from "@/lib/tutor/rive-driver";

type AudioContextCtor = typeof AudioContext;

export class AmbientSoundscape {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseSource: AudioBufferSourceNode | null = null;
  private padOsc: OscillatorNode | null = null;
  private running = false;
  private baseLevel = 0.065;

  start(scene: SceneArtboard | null | undefined, volume = 1): void {
    if (this.running || typeof window === "undefined") return;
    const Ctor: AudioContextCtor | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
    if (!Ctor) return;

    try {
      const ctx = new Ctor();
      this.ctx = ctx;

      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, ctx.currentTime);
      master.gain.exponentialRampToValueAtTime(
        Math.max(0.0001, this.baseLevel * Math.max(0, Math.min(1, volume))),
        ctx.currentTime + 0.8,
      );
      master.connect(ctx.destination);
      this.masterGain = master;

      // 3-second seamless brown-ish noise buffer for warm room air / gentle rain / cafe murmur
      const sampleRate = ctx.sampleRate;
      const length = sampleRate * 3;
      const buffer = ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0;
      for (let i = 0; i < length; i += 1) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = data[i];
        data[i] *= 2.4;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      const isCafe = scene === "Scene_Cafe" || scene === "Scene_TeaHouse";
      const isStudio = scene === "Scene_Studio" || scene === "Scene_Rooftop";
      filter.frequency.value = isCafe ? 520 : isStudio ? 340 : 420;
      filter.Q.value = 0.7;

      noise.connect(filter);
      filter.connect(master);
      noise.start();
      this.noiseSource = noise;

      // Ultra-soft warm harmonic pad for Studio / TeaHouse focus feel
      const osc = ctx.createOscillator();
      const padGain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = isStudio ? 146.83 : isCafe ? 174.61 : 130.81; // D3 / F3 / C3
      padGain.gain.value = 0.08;
      osc.connect(padGain);
      padGain.connect(master);
      osc.start();
      this.padOsc = osc;

      this.running = true;
    } catch {
      this.stop();
    }
  }

  setLevel(volume: number, muted: boolean): void {
    if (!this.ctx || !this.masterGain) return;
    const target = muted ? 0.0001 : Math.max(0.0001, this.baseLevel * Math.max(0, Math.min(1, volume)));
    this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.15);
  }

  stop(): void {
    this.running = false;
    try {
      this.noiseSource?.stop();
    } catch {
      // ignore
    }
    try {
      this.padOsc?.stop();
    } catch {
      // ignore
    }
    this.noiseSource = null;
    this.padOsc = null;
    this.masterGain = null;
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }
}
