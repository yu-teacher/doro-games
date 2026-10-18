/**
 * 소리. 효과음과 배경음은 Web Audio 로 그 자리에서 합성한다(파일·저작권 걱정이 없고 용량도 없다).
 * 목소리("DORO")만 파일이며, 없거나 못 불러오면 그냥 조용히 넘어간다.
 * 규칙 엔진과는 이벤트로만 이어진다: 엔진은 소리를 모르고, 여기서 이벤트를 소리로 바꾼다.
 */
import type { GameEvent } from './engine';
import { isTrap } from './jokes';

export type SoundId = 'kill' | 'bossKill' | 'good' | 'bad' | 'item' | 'bomb' | 'shield' | 'stage' | 'infinite' | 'warn' | 'bossIntro' | 'over';

export type VoiceId = 'cute' | 'cheer' | 'star' | 'sigh';

/** 목소리 파일 이름(그림과 같은 곳에 둔다). 이름만 정해 두고, 어떤 목소리인지는 docs/ASSETS.md 에 적는다. */
export const VOICE_FILES: Record<VoiceId, string> = {
  cute: 'voice-cute.m4a',
  cheer: 'voice-cheer.m4a',
  star: 'voice-star.m4a',
  sigh: 'voice-sigh.m4a',
};

/** 이벤트 하나가 내는 효과음(없으면 null). 총알 발사처럼 매우 잦은 것은 소리를 내지 않는다. */
export function soundFor(event: GameEvent): SoundId | null {
  switch (event.t) {
    case 'kill':
      return event.kind === 'boss' ? null : 'kill';
    case 'gate':
      return isTrap(event.kind) ? 'bad' : 'good';
    case 'item':
      return 'item';
    case 'bomb':
      return 'bomb';
    case 'shieldBreak':
      return 'shield';
    case 'stage':
      return 'stage';
    case 'infinite':
      return 'infinite';
    case 'warn':
      return 'warn';
    case 'bossIntro':
      return 'bossIntro';
    case 'bossDown':
      return 'bossKill';
    case 'over':
      return 'over';
    default:
      return null;
  }
}

/** 이벤트에 곁들이는 목소리와 그것이 나올 확률(%). 잦은 이벤트는 가끔만 말한다. */
export function voiceFor(event: GameEvent): { voice: VoiceId; chance: number } | null {
  switch (event.t) {
    case 'item':
      return { voice: 'cute', chance: 35 };
    case 'shieldBreak':
      return { voice: 'cute', chance: 100 };
    case 'gate':
      return isTrap(event.kind) ? null : { voice: 'cheer', chance: 30 };
    case 'stage':
      return { voice: 'cheer', chance: 25 };
    case 'infinite':
    case 'bossDown':
      return { voice: 'star', chance: 100 };
    case 'bossIntro':
    case 'over':
      return { voice: 'sigh', chance: 100 };
    default:
      return null;
  }
}

/** 배경음 속도(분당 박 수): 스테이지가 오를수록 빨라지고, 보스와 무한 모드는 더 급하다. */
export function tempoFor(stage: number, boss: boolean, infinite: boolean): number {
  const base = 104 + Math.min(stage, 100) * 0.5;
  return Math.round(base + (boss ? 16 : 0) + (infinite ? 14 : 0));
}

export type MusicMood = 'run' | 'boss' | 'infinite';

const STORAGE_KEY = 'doro-games.orange.sound';
/** 목소리 사이 최소 간격(ms): 말이 겹쳐 시끄럽지 않게 */
const VOICE_GAP_MS = 1400;

interface Saved {
  muted: boolean;
  volume: number;
}

export function loadSavedSound(): Saved {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<Saved> | null;
    const volume = typeof raw?.volume === 'number' && raw.volume >= 0 && raw.volume <= 1 ? raw.volume : 0.7;
    return { muted: raw?.muted === true, volume };
  } catch {
    return { muted: false, volume: 0.7 };
  }
}

function saveSound(saved: Saved): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // 저장이 막힌 환경(사생활 보호 모드 등)에서는 이번 방문에만 적용한다
  }
}

// 다음은 마이너 펜타토닉(라 도 레 미 솔)의 반음 간격
const PENTATONIC = [0, 3, 5, 7, 10];
const A2 = 110;
const noteHz = (semitones: number): number => A2 * 2 ** (semitones / 12);

export interface Audio {
  /** 사용자 입력 직후에 불러야 브라우저가 소리를 허용한다 */
  unlock(): void;
  play(event: GameEvent): void;
  music(mood: MusicMood | null, tempo?: number): void;
  setMuted(muted: boolean): void;
  setVolume(volume: number): void;
  readonly muted: boolean;
  readonly volume: number;
  loadVoices(base: string, signal?: AbortSignal): Promise<void>;
  dispose(): void;
}

export function createAudio(): Audio {
  const saved = loadSavedSound();
  let muted = saved.muted;
  let volume = saved.volume;
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  const voices: Partial<Record<VoiceId, AudioBuffer>> = {};
  let voiceBytes: Partial<Record<VoiceId, ArrayBuffer>> = {};
  let lastVoiceAt = -Infinity;

  let mood: MusicMood | null = null;
  let tempo = 110;
  let nextBeatAt = 0;
  let beat = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  const applyGain = () => {
    if (master && ctx) {
      master.gain.setTargetAtTime(muted ? 0 : volume * volume, ctx.currentTime, 0.02);
    }
  };

  const ensure = (): AudioContext | null => {
    if (ctx) {
      return ctx;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) {
      return null;
    }
    ctx = new Ctor();
    master = ctx.createGain();
    master.connect(ctx.destination);
    applyGain();
    // 목소리를 미리 받아 둔 게 있으면 이제 해독한다
    for (const id of Object.keys(voiceBytes) as VoiceId[]) {
      const bytes = voiceBytes[id];
      if (bytes) {
        ctx.decodeAudioData(bytes).then(
          (buffer) => {
            voices[id] = buffer;
          },
          () => undefined,
        );
      }
    }
    voiceBytes = {};
    return ctx;
  };

  const tone = (at: number, freq: number, dur: number, kind: OscillatorType, gain: number, slideTo?: number) => {
    if (!ctx || !master) {
      return;
    }
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = kind;
    osc.frequency.setValueAtTime(freq, at);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
    }
    amp.gain.setValueAtTime(0.0001, at);
    amp.gain.exponentialRampToValueAtTime(gain, at + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(amp).connect(master);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  };

  const noise = (at: number, dur: number, gain: number, cutoff: number) => {
    if (!ctx || !master) {
      return;
    }
    const length = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const amp = ctx.createGain();
    amp.gain.value = gain;
    src.connect(filter).connect(amp).connect(master);
    src.start(at);
  };

  const sfx: Record<SoundId, (t: number) => void> = {
    kill: (t) => tone(t, 520, 0.09, 'square', 0.09, 880),
    bossKill: (t) => {
      noise(t, 0.6, 0.4, 1800);
      [392, 523, 659, 784, 1046].forEach((f, i) => tone(t + i * 0.09, f, 0.25, 'square', 0.12));
    },
    good: (t) => {
      tone(t, 660, 0.09, 'triangle', 0.18);
      tone(t + 0.07, 990, 0.16, 'triangle', 0.18);
    },
    bad: (t) => {
      tone(t, 220, 0.22, 'sawtooth', 0.14, 110);
      tone(t + 0.09, 165, 0.25, 'sawtooth', 0.12, 80);
    },
    item: (t) => [784, 988, 1319].forEach((f, i) => tone(t + i * 0.05, f, 0.1, 'square', 0.1)),
    bomb: (t) => {
      noise(t, 0.7, 0.55, 900);
      tone(t, 140, 0.5, 'sine', 0.35, 40);
    },
    shield: (t) => {
      noise(t, 0.18, 0.3, 5000);
      tone(t, 1200, 0.2, 'triangle', 0.15, 300);
    },
    stage: (t) => [523, 659, 784].forEach((f, i) => tone(t + i * 0.08, f, 0.16, 'triangle', 0.16)),
    infinite: (t) => {
      [262, 330, 392, 523, 659, 784, 1046].forEach((f, i) => tone(t + i * 0.1, f, 0.3, 'square', 0.1));
      tone(t, 65, 1.2, 'sawtooth', 0.15, 55);
    },
    warn: (t) => {
      tone(t, 880, 0.14, 'square', 0.1);
      tone(t + 0.2, 880, 0.14, 'square', 0.1);
    },
    bossIntro: (t) => {
      tone(t, 98, 0.9, 'sawtooth', 0.22, 82);
      tone(t + 0.45, 92, 0.9, 'sawtooth', 0.22, 70);
      noise(t, 0.3, 0.25, 600);
    },
    over: (t) => [440, 370, 311, 220].forEach((f, i) => tone(t + i * 0.16, f, 0.3, 'triangle', 0.18)),
  };

  /** 배경음: 한 박씩 먼저 예약해 두는 방식(타이머가 조금 늦어도 박자가 흔들리지 않는다) */
  const schedule = () => {
    if (!ctx || !mood) {
      return;
    }
    const spb = 60 / tempo;
    while (nextBeatAt < ctx.currentTime + 0.25) {
      const t = Math.max(nextBeatAt, ctx.currentTime);
      const bar = Math.floor(beat / 8);
      const root = [0, 0, 5, 3][bar % 4];
      const step = beat % 8;
      // 베이스: 박마다 뿌리음과 옥타브를 번갈아
      tone(t, noteHz(root - 12 + (step % 2 === 0 ? 0 : 12)), spb * 0.45, mood === 'run' ? 'triangle' : 'sawtooth', mood === 'run' ? 0.16 : 0.1);
      // 선율: 펜타토닉 음을 정해진 규칙으로 고른다(같은 길이 순환이라 귀에 남는다)
      if (step % 2 === 1 || mood !== 'run') {
        const degree = PENTATONIC[(step * 3 + bar * 2) % PENTATONIC.length];
        tone(t + spb * 0.02, noteHz(root + degree + 12), spb * 0.4, 'square', 0.05);
      }
      if (mood !== 'run' && step % 4 === 0) {
        noise(t, 0.05, 0.12, 4000);
      }
      beat += 1;
      nextBeatAt += spb;
    }
  };

  return {
    unlock() {
      const c = ensure();
      if (c && c.state === 'suspended') {
        void c.resume();
      }
    },
    play(event) {
      const c = ensure();
      if (!c || muted) {
        return;
      }
      const id = soundFor(event);
      if (id) {
        sfx[id](c.currentTime);
      }
      const voice = voiceFor(event);
      const buffer = voice ? voices[voice.voice] : undefined;
      const now = performance.now();
      if (voice && buffer && master && now - lastVoiceAt > VOICE_GAP_MS && Math.random() * 100 < voice.chance) {
        lastVoiceAt = now;
        const src = c.createBufferSource();
        src.buffer = buffer;
        src.connect(master);
        src.start(c.currentTime + 0.05);
      }
    },
    music(next, bpm) {
      if (bpm) {
        tempo = bpm;
      }
      if (next === mood) {
        return;
      }
      mood = next;
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      if (mood && ensure()) {
        beat = 0;
        nextBeatAt = (ctx?.currentTime ?? 0) + 0.05;
        timer = setInterval(schedule, 80);
      }
    },
    setMuted(value) {
      muted = value;
      saveSound({ muted, volume });
      applyGain();
    },
    setVolume(value) {
      volume = Math.min(1, Math.max(0, value));
      saveSound({ muted, volume });
      applyGain();
    },
    get muted() {
      return muted;
    },
    get volume() {
      return volume;
    },
    async loadVoices(base, signal) {
      await Promise.all(
        (Object.keys(VOICE_FILES) as VoiceId[]).map(async (id) => {
          try {
            const response = await fetch(`${base}${VOICE_FILES[id]}`, { signal });
            if (!response.ok) {
              return;
            }
            const bytes = await response.arrayBuffer();
            if (ctx) {
              voices[id] = await ctx.decodeAudioData(bytes);
            } else {
              voiceBytes[id] = bytes;
            }
          } catch {
            // 목소리가 없으면 효과음만 낸다
          }
        }),
      );
    },
    dispose() {
      if (timer) {
        clearInterval(timer);
      }
      void ctx?.close();
      ctx = null;
    },
  };
}
