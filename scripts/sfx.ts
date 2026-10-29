/**
 * 用代码合成本系列的音效和环境声，写到 public/sfx/。没有第三方素材，结果每次都一样（固定随机种子）。
 *
 *   npm run sfx            生成全部
 *   npm run sfx -- drip    只生成名字里带 drip 的
 *
 * 每个声音都是几行 DSP：噪声 + 滤波 + 包络、正弦扫频。要改声音就改这里再重新生成，别手动替换文件。
 * 文件峰值大约 -6 dBFS，具体响度在 script.json 的 volume 里调。
 */
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./paths";

const SR = 48000;
const OUT = path.join(ROOT, "public", "sfx");
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- 基础件

/** mulberry32：固定种子的随机数 */
const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const buf = (sec: number) => new Float32Array(Math.round(sec * SR));
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

const white = (n: number, seed: number) => {
  const r = rng(seed);
  return Float32Array.from({ length: n }, () => r() * 2 - 1);
};

/** 粉红噪声（Paul Kellet 的近似） */
const pink = (n: number, seed: number) => {
  const w = white(n, seed);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  return w.map((x) => {
    b0 = 0.99886 * b0 + x * 0.0555179;
    b1 = 0.99332 * b1 + x * 0.0750759;
    b2 = 0.969 * b2 + x * 0.153852;
    b3 = 0.8665 * b3 + x * 0.3104856;
    b4 = 0.55 * b4 + x * 0.5329522;
    b5 = -0.7616 * b5 - x * 0.016898;
    const y = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + x * 0.5362) * 0.11;
    b6 = x * 0.115926;
    return y;
  });
};

/** RBJ 双二阶滤波，频率可以每个样本变（传函数） */
const biquad = (x: Float32Array, type: "lp" | "hp" | "bp", freq: number | ((i: number) => number), q = 0.707) => {
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const f = typeof freq === "number" ? () => freq : freq;
  for (let i = 0; i < x.length; i++) {
    const w = (TAU * Math.min(f(i), SR * 0.45)) / SR;
    const cs = Math.cos(w);
    const al = Math.sin(w) / (2 * q);
    let b0: number, b1: number, b2: number;
    if (type === "lp") [b0, b1, b2] = [(1 - cs) / 2, 1 - cs, (1 - cs) / 2];
    else if (type === "hp") [b0, b1, b2] = [(1 + cs) / 2, -(1 + cs), (1 + cs) / 2];
    else [b0, b1, b2] = [al, 0, -al];
    const a0 = 1 + al, a1 = -2 * cs, a2 = 1 - al;
    const v = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v;
    y[i] = v;
  }
  return y;
};

/** 正弦扫频：freq(t) 秒 → Hz，相位累加，不会有跳变 */
const sweep = (sec: number, freq: (t: number) => number, amp: (t: number) => number, phase = 0) => {
  const y = buf(sec);
  let ph = phase;
  for (let i = 0; i < y.length; i++) {
    const t = i / SR;
    ph += (TAU * freq(t)) / SR;
    y[i] = Math.sin(ph) * amp(t);
  }
  return y;
};

const env = (x: Float32Array, amp: (t: number) => number) => x.map((v, i) => v * amp(i / SR));
/** 把 src 叠到 dst 的第 at 秒 */
const mix = (dst: Float32Array, src: Float32Array, at = 0, gain = 1) => {
  const o = Math.round(at * SR);
  for (let i = 0; i < src.length && o + i < dst.length; i++) if (o + i >= 0) dst[o + i] += src[i] * gain;
  return dst;
};
/** 冲击衰减包络：attack 秒内升起，之后按 tau 指数衰减 */
const hit = (attack: number, tau: number) => (t: number) => (t < attack ? t / attack : Math.exp(-(t - attack) / tau));

/** 首尾交叉淡化，做成可以无缝循环的环境声：生成 len + xf 秒，把多出来的尾巴淡进开头 */
const loopable = (x: Float32Array, xf: number) => {
  const n = x.length - Math.round(xf * SR);
  const y = x.slice(0, n);
  for (let i = 0; i < x.length - n; i++) {
    const k = i / (x.length - n);
    y[i] = y[i] * Math.sqrt(k) + x[n + i] * Math.sqrt(1 - k);
  }
  return y;
};

const normalize = (x: Float32Array, peakDb = -6) => {
  let m = 0;
  for (const v of x) m = Math.max(m, Math.abs(v));
  const g = m > 0 ? Math.pow(10, peakDb / 20) / m : 1;
  return x.map((v) => v * g);
};

/** 文件两端各 3 ms 淡入淡出，避免咔哒声 */
const declick = (x: Float32Array) => {
  const n = Math.round(0.003 * SR);
  for (let i = 0; i < n && i < x.length; i++) {
    x[i] *= i / n;
    x[x.length - 1 - i] *= i / n;
  }
  return x;
};

const writeWav = (file: string, x: Float32Array) => {
  const data = Buffer.alloc(x.length * 2);
  x.forEach((v, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2));
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // mono
  h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, data]));
};

// ---------------------------------------------------------------- 声音

/** 一只鸟叫：几声往下滑的短哨 */
const birdChirp = (r: () => number) => {
  const notes = 2 + Math.floor(r() * 4);
  const f0 = 3200 + r() * 1600;
  const y = buf(notes * 0.13 + 0.1);
  for (let k = 0; k < notes; k++) {
    const len = 0.05 + r() * 0.05;
    const top = f0 * (1 + (r() - 0.5) * 0.12);
    mix(y, sweep(len, (t) => top * (1 - 0.35 * (t / len)) + 120 * Math.sin(TAU * 38 * t), (t) => Math.sin((Math.PI * t) / len) ** 2), k * (0.1 + r() * 0.05));
  }
  return y;
};

/** 一只鸟的颤音 */
const birdTrill = (r: () => number) => {
  const len = 0.35 + r() * 0.3;
  const f0 = 2600 + r() * 900;
  const rate = 20 + r() * 8;
  return sweep(len, (t) => f0 + 450 * Math.sin(TAU * rate * t) - 300 * (t / len), (t) => smooth(0, 0.04, t) * (1 - smooth(len - 0.12, len, t)));
};

const sounds: Record<string, () => Float32Array> = {
  /** 清晨营地：很轻的风声底 + 远处稀疏的鸟叫。12 秒无缝循环 */
  morning: () => {
    const len = 12, xf = 1.5;
    const air = env(biquad(biquad(pink(buf(len + xf).length, 11), "lp", 900), "hp", 120), (t) => 0.5 + 0.2 * Math.sin((TAU * t) / 6.75));
    const y = air.map((v) => v * 0.9);
    const r = rng(12);
    const birds = buf(len + xf);
    for (let t = 0.4; t < len - 1.2; t += 1.3 + r() * 1.6) {
      const b = r() < 0.65 ? birdChirp(r) : birdTrill(r);
      mix(birds, b, t, 0.18 + r() * 0.2);
    }
    // 远处的鸟：去掉一点高频
    mix(y, biquad(birds, "lp", 5200), 0, 1);
    return loopable(y, xf);
  },

  /** 夜里：三只蟋蟀 + 很低的风声。16 秒无缝循环 */
  night: () => {
    const len = 16, xf = 2;
    const n = buf(len + xf).length;
    const y = env(biquad(pink(n, 21), "lp", 420), (t) => 0.45 + 0.25 * Math.sin((TAU * t) / 9) ** 2);
    const crickets = [
      { f: 4400, period: 0.62, pulses: 3, gain: 0.16, seed: 22, pan: 0 },
      { f: 4850, period: 0.78, pulses: 4, gain: 0.1, seed: 23, pan: 0.21 },
      { f: 5300, period: 0.55, pulses: 3, gain: 0.06, seed: 24, pan: 0.37 },
    ];
    for (const c of crickets) {
      const r = rng(c.seed);
      const pulse = sweep(0.016, () => c.f, (t) => Math.sin((Math.PI * t) / 0.016) ** 2);
      // 一点二次谐波，听起来像翅膀摩擦而不是纯音
      mix(pulse, sweep(0.016, () => c.f * 2, (t) => 0.18 * Math.sin((Math.PI * t) / 0.016) ** 2));
      // 每只隔一会儿歇一下，不要一直一个节奏
      for (let t = c.pan; t < len + xf - 0.3; t += c.period * (0.94 + r() * 0.12)) {
        if (r() < 0.12) { t += 1 + r() * 1.5; continue; }
        const g = c.gain * (0.7 + 0.3 * Math.sin((TAU * t) / 7 + c.seed));
        for (let k = 0; k < c.pulses; k++) mix(y, pulse, t + k * 0.032, g * (k === c.pulses - 1 ? 0.7 : 1));
      }
    }
    return loopable(y, xf);
  },

  /** 倒带：时钟指针往回飞转的嘀嗒，越转越快再慢下来，底下一道往上走的气声 */
  rewind: () => {
    const len = 2.8;
    const y = buf(len);
    const r = rng(31);
    // 速度曲线：中间最快
    let t = 0.05;
    while (t < len - 0.25) {
      const speed = 7 + 26 * Math.sin(Math.PI * clamp01(t / (len - 0.2))) ** 1.5;
      const tick = env(biquad(white(Math.round(0.006 * SR), 32 + Math.round(t * 1000)), "bp", 3200 + r() * 600, 3), hit(0.0005, 0.0018));
      mix(tick, sweep(0.02, () => 2300, hit(0.001, 0.004)), 0, 0.5);
      mix(y, tick, t, 0.55 + 0.45 * Math.sin(Math.PI * clamp01(t / len)));
      t += 1 / speed;
    }
    const n = y.length;
    const swoosh = biquad(white(n, 33), "bp", (i) => 400 + 2600 * smooth(0, 1, i / n), 1.4);
    mix(y, env(swoosh, (tt) => 0.5 * Math.sin(Math.PI * clamp01(tt / len)) ** 2));
    mix(y, sweep(len, (tt) => 260 + 520 * (tt / len) + 18 * Math.sin(TAU * 6 * tt), (tt) => 0.08 * Math.sin(Math.PI * clamp01(tt / len))));
    return y;
  },

  /** 扫描线切进 Lab View：从高往低扫的细噪声 + 一道往下滑的电子音，1.4 秒扫完 */
  "scan-in": () => scan(-1),
  /** 扫描线退回去：反方向 */
  "scan-out": () => scan(1),

  /** Lab View 底下的电子低鸣。8 秒无缝循环（所有频率在 8 秒里都是整数个周期） */
  "lab-hum": () => {
    const len = 8;
    const lfo = (t: number) => 0.8 + 0.2 * Math.sin((TAU * t) / 4);
    const y = sweep(len, () => 110, lfo);
    mix(y, sweep(len, () => 110.25, (t) => 0.8 * lfo(t + 2)));
    mix(y, sweep(len, () => 165, (t) => 0.35 * lfo(t + 1)));
    mix(y, sweep(len, () => 220, () => 0.25));
    mix(y, sweep(len, () => 1760, (t) => 0.025 * (0.5 + 0.5 * Math.sin((TAU * t) / 2))));
    return y;
  },

  /** 大水珠砸在睡袋上：低沉的一声 + 一点溅开的水声 */
  tap: () => {
    const y = sweep(0.25, (t) => 150 - 60 * t, hit(0.002, 0.045));
    mix(y, env(biquad(white(buf(0.25).length, 41), "lp", 1400), hit(0.001, 0.02)), 0, 0.8);
    mix(y, env(biquad(white(buf(0.25).length, 42), "bp", 2600, 2), hit(0.004, 0.035)), 0.008, 0.45);
    return y;
  },

  /** 水珠：频率快速上扬的一声 “叮”（气泡共振） */
  "plink-1": () => plink(1100, 0.022),
  "plink-2": () => plink(1450, 0.018),
  "plink-3": () => plink(880, 0.026),

  /** 主角水珠长大：更圆、更慢的一声 */
  bloop: () => {
    const y = sweep(0.45, (t) => 520 + 700 * (1 - Math.exp(-t / 0.05)), hit(0.006, 0.09));
    mix(y, sweep(0.45, (t) => 2 * (520 + 700 * (1 - Math.exp(-t / 0.05))), hit(0.004, 0.03)), 0, 0.15);
    return y;
  },

  /** 拉链：一串齿响，速度先快后慢，1.1 秒 */
  zip: () => {
    const len = 1.1;
    const y = buf(len);
    const r = rng(51);
    let t = 0.02;
    while (t < len - 0.05) {
      const u = t / len;
      const rate = 45 + 40 * Math.sin(Math.PI * u);
      const click = env(biquad(white(Math.round(0.006 * SR), 52 + Math.round(t * 1e4)), "bp", 3000 + 1500 * u + r() * 400, 4), hit(0.0003, 0.0012));
      mix(y, click, t, (0.6 + 0.4 * r()) * smooth(0, 0.08, u) * (1 - smooth(0.85, 1, u)));
      t += 1 / rate;
    }
    const slide = biquad(white(y.length, 53), "bp", (i) => 1600 + 900 * (i / y.length), 2.5);
    mix(y, env(slide, (tt) => 0.12 * Math.sin(Math.PI * clamp01(tt / len))));
    return y;
  },

  /** 一阵风：带通噪声，中心频率和音量一起涨落，3.2 秒 */
  wind: () => {
    const len = 3.2;
    const n = buf(len).length;
    const shape = (i: number) => Math.sin(Math.PI * (i / n)) ** 1.6;
    const y = biquad(pink(n, 61), "bp", (i) => 260 + 520 * shape(i), 0.9);
    mix(y, biquad(white(n, 62), "bp", (i) => 900 + 900 * shape(i), 6), 0, 0.06);
    return env(y, (t) => shape(Math.round(t * SR)));
  },

  /** 镜头快速穿过：一道气声，重心在 0.85 秒左右 */
  whoosh: () => {
    const len = 1.3;
    const n = buf(len).length;
    const peak = 0.65;
    const shape = (u: number) => (u < peak ? (u / peak) ** 2.2 : Math.exp(-(u - peak) * 9));
    const y = biquad(pink(n, 71), "bp", (i) => 350 + 1500 * shape(i / n), 1.1);
    return env(y, (t) => shape(t / len));
  },

  /** 标注出现：很轻的一下 */
  tick: () => {
    const y = sweep(0.12, () => 1900, hit(0.001, 0.018));
    mix(y, sweep(0.12, () => 3800, hit(0.001, 0.008)), 0, 0.3);
    return y;
  },

  /** 量杯弹出来：往上挑的一声 */
  pop: () => sweep(0.2, (t) => 520 + 520 * Math.min(1, t / 0.05), hit(0.003, 0.05)),

  /** 篷布绷紧：一声往上收的“嘣” */
  tension: () => {
    const y = sweep(0.6, (t) => 150 + 50 * (1 - Math.exp(-t / 0.04)), hit(0.002, 0.11));
    mix(y, sweep(0.6, (t) => 2 * (150 + 50 * (1 - Math.exp(-t / 0.04))), hit(0.002, 0.06)), 0, 0.4);
    mix(y, env(biquad(white(y.length, 81), "bp", 1200, 1.5), hit(0.001, 0.015)), 0, 0.5);
    return y;
  },

  /** 树长出来：枝叶沙沙声，1.2 秒 */
  rustle: () => {
    const len = 1.2;
    const n = buf(len).length;
    const r = rng(91);
    const grains = new Float32Array(n);
    for (let i = 0; i < 260; i++) {
      const t = Math.pow(r(), 0.8) * (len - 0.05);
      mix(grains, env(white(Math.round(0.012 * SR), 92 + i), hit(0.001, 0.003)), t, 0.4 + r() * 0.6);
    }
    return env(biquad(biquad(grains, "hp", 1800), "lp", 7000), (t) => smooth(0, 0.15, t) * (1 - smooth(0.8, len, t)));
  },

  /** 清晨呼出的一口气 */
  breath: () => {
    const len = 1.3;
    const n = buf(len).length;
    const y = biquad(biquad(pink(n, 101), "bp", (i) => 1100 - 400 * (i / n), 0.8), "hp", 250);
    return env(y, (t) => smooth(0, 0.18, t) * (1 - smooth(0.4, len, t)));
  },

  /** 片尾品牌出现：两个音的小钟声 */
  chime: () => {
    const len = 2.2;
    const y = buf(len);
    const bell = (f: number) => {
      const b = sweep(len, () => f, hit(0.003, 0.7));
      mix(b, sweep(len, () => f * 2.76, hit(0.002, 0.18)), 0, 0.25);
      mix(b, sweep(len, () => f * 5.4, hit(0.001, 0.06)), 0, 0.1);
      return b;
    };
    mix(y, bell(659.25));
    mix(y, bell(987.77), 0.13, 0.8);
    return y;
  },
};

function scan(dir: 1 | -1) {
  const len = 1.6;
  const n = buf(len).length;
  const u = (i: number) => clamp01(i / SR / 1.4);
  const hi = 7000, lo = 900;
  const fc = (i: number) => (dir < 0 ? hi * Math.pow(lo / hi, u(i)) : lo * Math.pow(hi / lo, u(i)));
  const y = biquad(white(n, dir < 0 ? 111 : 112), "bp", fc, 5);
  const e = (t: number) => smooth(0, 0.08, t) * (1 - smooth(1.2, len, t));
  const out = env(y, (t) => 0.7 * e(t));
  mix(out, sweep(len, (t) => (dir < 0 ? 880 * Math.pow(0.5, clamp01(t / 1.4)) : 440 * Math.pow(2, clamp01(t / 1.4))), (t) => 0.22 * e(t)));
  // 起扫那一下亮一点
  mix(out, sweep(0.1, () => 2600, hit(0.001, 0.015)), 0, 0.3);
  return out;
}

function plink(f0: number, tau: number) {
  const y = sweep(0.25, (t) => f0 * (1 + 0.9 * (1 - Math.exp(-t / 0.012))), hit(0.0015, tau));
  mix(y, env(biquad(white(Math.round(0.004 * SR), Math.round(f0)), "hp", 3000), hit(0.0002, 0.0008)), 0, 0.2);
  return y;
}

/** 环境声要无缝循环，两端不能淡 */
const LOOPS = new Set(["morning", "night", "lab-hum"]);

fs.mkdirSync(OUT, { recursive: true });
const only = process.argv[2];
for (const [name, make] of Object.entries(sounds)) {
  if (only && !name.includes(only)) continue;
  const x = normalize(make());
  if (!LOOPS.has(name)) declick(x);
  writeWav(path.join(OUT, `${name}.wav`), x);
  console.log(`sfx/${name}.wav  ${(x.length / SR).toFixed(2)} s`);
}
