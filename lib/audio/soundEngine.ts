"use client";

/**
 * 轻量音效引擎：用 Web Audio API 程序化合成麻将对局音效，无需任何音频素材文件。
 * 浏览器要求 AudioContext 必须在用户手势后才能恢复，故在首次手势时解锁。
 */

export type SoundName =
  | "discard"  // 出牌
  | "draw"     // 摸牌
  | "peng"     // 碰
  | "gang"     // 杠
  | "win"      // 胡
  | "liangdao" // 亮倒
  | "pass"     // 过
  | "liuju"    // 流局
  | "deal";    // 新局发牌

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const Ctor =
    window.AudioContext ??
    (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = 0.8;
  master.connect(ctx.destination);
  return ctx;
}

export function unlockAudio(): void {
  const c = getCtx();
  if (c?.state === "suspended") void c.resume();
}

export function setMuted(v: boolean): void { muted = v; }
export function isMuted(): boolean { return muted; }

// ── 合成工具函数 ─────────────────────────────────────────

function now(): number { return getCtx()?.currentTime ?? 0; }
function out(): AudioNode | null { return master; }

/** 噪声节点（白噪）*/
function noiseNode(c: AudioContext, duration: number): AudioBufferSourceNode {
  const len = Math.ceil(c.sampleRate * duration);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  return src;
}

/** 包络增益（attack + release 形状）*/
function envGain(c: AudioContext, peak: number, attack: number, release: number, startAt: number): GainNode {
  const g = c.createGain();
  g.gain.setValueAtTime(0, startAt);
  g.gain.linearRampToValueAtTime(peak, startAt + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, startAt + attack + release);
  return g;
}

/** 单振荡器音调 */
function tone(c: AudioContext, freq: number, type: OscillatorType, peak: number, attack: number, release: number, startAt: number): void {
  const dst = out();
  if (!dst) return;
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const g = envGain(c, peak, attack, release, startAt);
  osc.connect(g);
  g.connect(dst);
  osc.start(startAt);
  osc.stop(startAt + attack + release + 0.01);
}

/** 噪声爆破（模拟牌碰击）*/
function crack(c: AudioContext, peak: number, filterFreq: number, release: number, startAt: number): void {
  const dst = out();
  if (!dst) return;
  const src = noiseNode(c, release + 0.05);
  const filt = c.createBiquadFilter();
  filt.type = "bandpass";
  filt.frequency.value = filterFreq;
  filt.Q.value = 0.8;
  const g = envGain(c, peak, 0.002, release, startAt);
  src.connect(filt);
  filt.connect(g);
  g.connect(dst);
  src.start(startAt);
  src.stop(startAt + release + 0.06);
}

// ── 各音效合成函数 ───────────────────────────────────────

function playDiscard(c: AudioContext): void {
  const t = now();
  crack(c, 0.9, 1800, 0.07, t);
  tone(c, 220, "sine", 0.25, 0.001, 0.08, t);
}

function playDraw(c: AudioContext): void {
  const t = now();
  crack(c, 0.5, 2400, 0.04, t);
  tone(c, 320, "sine", 0.12, 0.001, 0.05, t);
}

function playPeng(c: AudioContext): void {
  const t = now();
  crack(c, 0.9, 1600, 0.07, t);
  tone(c, 200, "sine", 0.2, 0.001, 0.09, t);
  crack(c, 0.7, 1600, 0.06, t + 0.1);
  tone(c, 200, "sine", 0.15, 0.001, 0.08, t + 0.1);
}

function playGang(c: AudioContext): void {
  const t = now();
  for (let i = 0; i < 3; i++) {
    crack(c, 0.85, 1400, 0.07, t + i * 0.08);
    tone(c, 160, "sine", 0.2, 0.001, 0.1, t + i * 0.08);
  }
  // 低频共鸣
  tone(c, 80, "sine", 0.35, 0.005, 0.5, t + 0.24);
}

function playWin(c: AudioContext): void {
  const t = now();
  const freqs = [330, 415, 523, 659];
  freqs.forEach((f, i) => {
    tone(c, f, "sine", 0.5, 0.01, 0.4, t + i * 0.1);
    tone(c, f * 2, "sine", 0.12, 0.01, 0.35, t + i * 0.1);
  });
  // 顶部闪光
  tone(c, 1320, "sine", 0.2, 0.005, 0.6, t + 0.4);
}

function playLiangDao(c: AudioContext): void {
  const t = now();
  // 清亮铃声
  tone(c, 880, "sine", 0.4, 0.002, 0.6, t);
  tone(c, 1320, "sine", 0.2, 0.002, 0.5, t + 0.02);
  tone(c, 1760, "sine", 0.1, 0.002, 0.4, t + 0.04);
}

function playPass(c: AudioContext): void {
  const t = now();
  tone(c, 160, "sine", 0.2, 0.003, 0.12, t);
  crack(c, 0.3, 800, 0.06, t);
}

function playLiuju(c: AudioContext): void {
  const t = now();
  tone(c, 440, "sine", 0.3, 0.01, 0.3, t);
  tone(c, 330, "sine", 0.3, 0.01, 0.4, t + 0.25);
  tone(c, 220, "sine", 0.25, 0.01, 0.5, t + 0.5);
}

function playDeal(c: AudioContext): void {
  const t = now();
  // 洗牌扫频：噪声 + 滤波器频率快速上扫
  const dst = out();
  if (!dst) return;
  const src = noiseNode(c, 0.45);
  const filt = c.createBiquadFilter();
  filt.type = "bandpass";
  filt.frequency.setValueAtTime(200, t);
  filt.frequency.exponentialRampToValueAtTime(3000, t + 0.35);
  filt.Q.value = 1.2;
  const g = c.createGain();
  g.gain.setValueAtTime(0.5, t);
  g.gain.linearRampToValueAtTime(0.7, t + 0.1);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
  src.connect(filt);
  filt.connect(g);
  g.connect(dst);
  src.start(t);
  src.stop(t + 0.46);
}

// ── 主播放入口 ────────────────────────────────────────────

export function playSound(name: SoundName): void {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") { void c.resume(); return; }
  const fn: Record<SoundName, (c: AudioContext) => void> = {
    discard: playDiscard,
    draw: playDraw,
    peng: playPeng,
    gang: playGang,
    win: playWin,
    liangdao: playLiangDao,
    pass: playPass,
    liuju: playLiuju,
    deal: playDeal,
  };
  try { fn[name](c); } catch { /* 忽略音频错误，不影响游戏逻辑 */ }
}
