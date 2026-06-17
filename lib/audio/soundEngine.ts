"use client";

/**
 * 轻量音效引擎：用 Web Audio API 程序化合成麻将对局音效，无需任何音频素材文件。
 * 浏览器要求 AudioContext 必须在用户手势后才能恢复，故在首次手势时解锁。
 */

export type SoundName =
  | "discard"  // 出牌
  | "draw"     // 摸牌
  | "diceRoll" // 骰子落桌
  | "peng"     // 碰
  | "gang"     // 杠
  | "win"      // 胡
  | "liangdao" // 亮倒
  | "pass"     // 过
  | "liuju"    // 流局
  | "deal"     // 新局发牌
  | "settlement"; // 结算弹窗

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

const DISCARD_SRCS = [
  "/sounds/tiles/mahjong_tile_1.mp3",
  "/sounds/tiles/mahjong_tile_2.mp3",
  "/sounds/tiles/mahjong_tile_3.mp3",
  "/sounds/tiles/mahjong_tile_4.mp3",
];
const discardBuffers: (AudioBuffer | null)[] = [null, null, null, null];
const DEAL_SRC = "/sounds/tiles/mahjong_tile_4.mp3";
let dealBuffer: AudioBuffer | null = null;
let dealBufferPromise: Promise<void> | null = null;
const MELD_SRC = "/sounds/tiles/mahjong_tile_3.mp3";
let meldBuffer: AudioBuffer | null = null;
let meldBufferPromise: Promise<void> | null = null;
const DICE_ROLL_SRCS = [
  "/sounds/roll/roll_two_dice_1.mp3",
  "/sounds/roll/roll_two_dice_2.mp3",
  "/sounds/roll/roll_two_dice_3.mp3",
];
const diceRollBuffers: (AudioBuffer | null)[] = [null, null, null];
let diceRollBuffersPromise: Promise<void> | null = null;
const SETTLEMENT_SRC = "/sounds/riichbet/riich_bets_1.mp3";
let settlementBuffer: AudioBuffer | null = null;
let settlementBufferPromise: Promise<void> | null = null;

async function preloadDiscardBuffers(c: AudioContext): Promise<void> {
  await Promise.all(
    DISCARD_SRCS.map(async (src, i) => {
      if (discardBuffers[i]) return;
      try {
        const res = await fetch(src);
        discardBuffers[i] = await c.decodeAudioData(await res.arrayBuffer());
      } catch { /* 静默失败，回退合成音 */ }
    })
  );
}

function playDiscard(c: AudioContext): void {
  const buf = discardBuffers[Math.floor(Math.random() * discardBuffers.length)];
  if (buf) {
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(master!);
    src.start();
    return;
  }
  // 尚未加载完毕时回退合成音，并触发一次预加载
  void preloadDiscardBuffers(c);
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
  playMeld(c);
}

function playGang(c: AudioContext): void {
  playMeld(c);
}

function playDiceRoll(c: AudioContext): void {
  const buf = diceRollBuffers[Math.floor(Math.random() * diceRollBuffers.length)];
  if (buf) {
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(master!);
    src.start();
    return;
  }
  void preloadDiceRollBuffers(c);
  playPass(c);
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
  if (dealBuffer) {
    const src = c.createBufferSource();
    src.buffer = dealBuffer;
    src.connect(master!);
    src.start();
    return;
  }
  void preloadDealBuffer(c).then(() => {
    if (dealBuffer) playDeal(c);
    else playDealFallback(c);
  });
}

async function preloadDealBuffer(c: AudioContext): Promise<void> {
  if (dealBuffer) return;
  if (!dealBufferPromise) {
    dealBufferPromise = (async () => {
      try {
        const res = await fetch(DEAL_SRC);
        dealBuffer = await c.decodeAudioData(await res.arrayBuffer());
      } catch {
        // 静默失败，保留合成回退
      }
    })();
  }
  await dealBufferPromise;
}

function playDealFallback(c: AudioContext): void {
  const t = now();
  crack(c, 0.45, 2200, 0.05, t);
  tone(c, 260, "sine", 0.16, 0.001, 0.06, t);
}

function playSettlementFallback(c: AudioContext): void {
  const t = now();
  tone(c, 392, "sine", 0.28, 0.005, 0.16, t);
  tone(c, 587, "sine", 0.24, 0.005, 0.2, t + 0.07);
  tone(c, 784, "sine", 0.18, 0.005, 0.24, t + 0.14);
}

function playSettlement(c: AudioContext): void {
  if (settlementBuffer) {
    const src = c.createBufferSource();
    src.buffer = settlementBuffer;
    src.connect(master!);
    src.start();
    return;
  }
  void preloadSettlementBuffer(c).then(() => {
    if (settlementBuffer) playSettlement(c);
    else playSettlementFallback(c);
  });
}

async function preloadSettlementBuffer(c: AudioContext): Promise<void> {
  if (settlementBuffer) return;
  if (!settlementBufferPromise) {
    settlementBufferPromise = (async () => {
      try {
        const res = await fetch(SETTLEMENT_SRC);
        settlementBuffer = await c.decodeAudioData(await res.arrayBuffer());
      } catch {
        // 静默失败，保留合成回退
      }
    })();
  }
  await settlementBufferPromise;
}

function playMeld(c: AudioContext): void {
  if (meldBuffer) {
    const src = c.createBufferSource();
    src.buffer = meldBuffer;
    src.connect(master!);
    src.start();
    return;
  }
  void preloadMeldBuffer(c).then(() => {
    if (meldBuffer) playMeld(c);
    else playDealFallback(c);
  });
}

async function preloadMeldBuffer(c: AudioContext): Promise<void> {
  if (meldBuffer) return;
  if (!meldBufferPromise) {
    meldBufferPromise = (async () => {
      try {
        const res = await fetch(MELD_SRC);
        meldBuffer = await c.decodeAudioData(await res.arrayBuffer());
      } catch {
        // 静默失败，保留合成回退
      }
    })();
  }
  await meldBufferPromise;
}

async function preloadDiceRollBuffers(c: AudioContext): Promise<void> {
  if (diceRollBuffers.every(Boolean)) return;
  if (!diceRollBuffersPromise) {
    diceRollBuffersPromise = Promise.all(
      DICE_ROLL_SRCS.map(async (src, i) => {
        if (diceRollBuffers[i]) return;
        try {
          const res = await fetch(src);
          diceRollBuffers[i] = await c.decodeAudioData(await res.arrayBuffer());
        } catch {
          // 静默失败，保留合成回退
        }
      }),
    ).then(() => undefined);
  }
  await diceRollBuffersPromise;
}

// ── 主播放入口 ────────────────────────────────────────────

export function playSound(name: SoundName): void {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  const fn: Record<SoundName, (c: AudioContext) => void> = {
    discard: playDiscard,
    draw: playDraw,
    diceRoll: playDiceRoll,
    peng: playPeng,
    gang: playGang,
    win: playWin,
    liangdao: playLiangDao,
    pass: playPass,
    liuju: playLiuju,
    deal: playDeal,
    settlement: playSettlement,
  };
  const run = () => {
    try { fn[name](c); } catch { /* 忽略音频错误，不影响游戏逻辑 */ }
  };
  if (c.state === "suspended") {
    void c.resume().then(run).catch(() => undefined);
    return;
  }
  run();
}

export function preloadSound(name: SoundName): void {
  const c = getCtx();
  if (!c) return;
  if (name === "diceRoll") {
    void preloadDiceRollBuffers(c);
  } else if (name === "deal") {
    void preloadDealBuffer(c);
  } else if (name === "discard") {
    void preloadDiscardBuffers(c);
  } else if (name === "peng" || name === "gang") {
    void preloadMeldBuffer(c);
  } else if (name === "settlement") {
    void preloadSettlementBuffer(c);
  }
}
