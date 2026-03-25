export class AudioManager {
  constructor() {
    this.ctx = null;
    this.initialized = false;
    this.engineNode = null;
    this.engineGain = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;
    this._sfxVolume = 1;
    this._musicVolume = 1;
    this._paused = false;
    this._iosUnlocked = false;
  }

  async init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
    }

    // iOS: unlock audio session (defeats silent/ringer switch)
    this._unlockiOSAudioSession();

    // Must await resume — iOS needs this to complete before any audio plays
    if (this.ctx.state !== 'running') {
      try { await this.ctx.resume(); } catch (e) {}
    }

    // Listen for iOS interruptions (tab switch, phone call, lock screen)
    if (!this._stateChangeListening) {
      this._stateChangeListening = true;
      this.ctx.addEventListener('statechange', () => {
        if (this.ctx.state === 'interrupted' || this.ctx.state === 'suspended') {
          // Will re-resume on next user interaction
        }
      });
    }

    if (this.initialized) return;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.5;
    this.masterGain.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this._sfxVolume;
    this.sfxGain.connect(this.masterGain);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this._musicVolume;
    this.musicGain.connect(this.masterGain);

    this.initialized = true;
    this.startEngine();
    if (!this.skipIntro) this.playIntro();
  }

  // Play a silent MP3 via HTML Audio to unlock iOS audio session
  // This defeats the silent/ringer switch — crucial for iPhone
  _unlockiOSAudioSession() {
    if (this._iosUnlocked) return;
    try {
      const audio = new Audio('src/audio/silence.mp3');
      audio.volume = 0.01;
      audio.playsInline = true;
      const p = audio.play();
      if (p && p.then) {
        p.then(() => {
          this._iosUnlocked = true;
          // Clean up after short play
          setTimeout(() => { audio.pause(); audio.remove?.(); }, 600);
        }).catch(() => {});
      }
    } catch (e) {}
  }

  async ensureResumed() {
    if (!this.ctx) return;
    this._unlockiOSAudioSession();
    if (this.ctx.state !== 'running') {
      try { await this.ctx.resume(); } catch (e) {}
    }
  }

  setSFXVolume(v) {
    this._sfxVolume = Math.max(0, Math.min(1, v));
    if (this.sfxGain && !this._paused) {
      this.sfxGain.gain.setTargetAtTime(this._sfxVolume, this.ctx.currentTime, 0.02);
    }
  }

  setMusicVolume(v) {
    this._musicVolume = Math.max(0, Math.min(1, v));
    if (this.musicGain && !this._paused) {
      this.musicGain.gain.setTargetAtTime(this._musicVolume, this.ctx.currentTime, 0.02);
    }
  }

  pauseAudio() {
    if (!this.ctx || this._paused) return;
    this._paused = true;
    const t = this.ctx.currentTime;
    this.sfxGain.gain.setTargetAtTime(0, t, 0.05);
    this.musicGain.gain.setTargetAtTime(0, t, 0.05);
  }

  resumeAudio() {
    if (!this.ctx || !this._paused) return;
    this._paused = false;
    this.ensureResumed();
    const t = this.ctx.currentTime;
    this.sfxGain.gain.setTargetAtTime(this._sfxVolume, t, 0.05);
    this.musicGain.gain.setTargetAtTime(this._musicVolume, t, 0.05);
  }

  _decode(arrayBuffer) {
    return new Promise((resolve, reject) => {
      this.ctx.decodeAudioData(
        arrayBuffer,
        (decoded) => resolve(decoded),
        (err) => reject(err || new Error('decode failed'))
      );
    });
  }

  async playIntro() {
    if (!this.ctx) return;
    try {
      const resp = await fetch('src/audio/intro.mp3');
      const buf = await resp.arrayBuffer();
      this.introBuffer = await this._decode(buf);
      // Ensure context is running before playing
      if (this.ctx.state !== 'running') {
        try { await this.ctx.resume(); } catch (e) {}
      }
      this.introSource = this.ctx.createBufferSource();
      this.introSource.buffer = this.introBuffer;
      this.introSource.loop = false;
      this.introGain = this.ctx.createGain();
      this.introGain.gain.value = 0.4;
      this.introSource.connect(this.introGain);
      this.introGain.connect(this.musicGain);
      this.introSource.start(0);
    } catch (e) {
      console.warn('Failed to load intro music:', e);
    }
  }

  async playTrackMusic(music) {
    if (!this.ctx || !music) return;
    await this.ensureResumed();
    this.stopTrackMusic();
    const tracks = Array.isArray(music) ? music : [{ url: music, volume: 0.3 }];
    this.trackSources = [];
    for (const track of tracks) {
      try {
        const resp = await fetch(track.url);
        const buf = await resp.arrayBuffer();
        const decoded = await this._decode(buf);
        const source = this.ctx.createBufferSource();
        source.buffer = decoded;
        source.loop = false;
        const gain = this.ctx.createGain();
        gain.gain.value = track.volume ?? 0.3;
        source.connect(gain);
        gain.connect(this.musicGain);
        source.start(0);
        this.trackSources.push({ source, gain });
      } catch (e) {
        console.warn('Failed to load track music:', track.url, e);
      }
    }
  }

  stopTrackMusic() {
    if (!this.trackSources || this.trackSources.length === 0) return;
    const t = this.ctx.currentTime;
    for (const { source, gain } of this.trackSources) {
      try {
        gain.gain.linearRampToValueAtTime(0, t + 1.0);
        setTimeout(() => { try { source.stop(); } catch(e) {} }, 1100);
      } catch (e) {}
    }
    this.trackSources = [];
  }

  stopIntro() {
    if (!this.introSource) return;
    try {
      this.introGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1.0);
      const src = this.introSource;
      setTimeout(() => { try { src.stop(); } catch(e) {} }, 1100);
      this.introSource = null;
    } catch (e) {}
  }

  startEngine() {
    if (!this.ctx) return;
    this.engineStopped = false;

    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 60;

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.08;

    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 400;
    this.engineFilter.Q.value = 2;

    this.engineOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.sfxGain);
    this.engineOsc.start(0);

    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = 'square';
    this.engineOsc2.frequency.value = 120;

    this.engineGain2 = this.ctx.createGain();
    this.engineGain2.gain.value = 0.03;

    this.engineOsc2.connect(this.engineGain2);
    this.engineGain2.connect(this.sfxGain);
    this.engineOsc2.start(0);
  }

  restartEngine() {
    if (!this.ctx || !this.engineGain) return;
    this.ensureResumed();
    this.engineStopped = false;
    const t = this.ctx.currentTime;
    this.engineGain.gain.linearRampToValueAtTime(0.08, t + 0.3);
    this.engineGain2.gain.linearRampToValueAtTime(0.03, t + 0.3);
    this.engineOsc.frequency.linearRampToValueAtTime(60, t + 0.3);
    this.engineOsc2.frequency.linearRampToValueAtTime(120, t + 0.3);
  }

  stopEngine() {
    if (!this.ctx || !this.engineGain) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.linearRampToValueAtTime(0, t + 1.0);
    this.engineGain2.gain.linearRampToValueAtTime(0, t + 1.0);
    this.engineOsc.frequency.linearRampToValueAtTime(40, t + 1.0);
    this.engineOsc2.frequency.linearRampToValueAtTime(80, t + 1.0);
    this.engineStopped = true;
  }

  updateEngine(speed, boosting) {
    if (!this.engineOsc || this.engineStopped) return;
    const normalizedSpeed = Math.abs(speed) / 45;
    const freq = 60 + normalizedSpeed * 140;
    const vol = 0.04 + normalizedSpeed * 0.08;

    this.engineOsc.frequency.linearRampToValueAtTime(freq, this.ctx.currentTime + 0.1);
    this.engineOsc2.frequency.linearRampToValueAtTime(freq * 2, this.ctx.currentTime + 0.1);
    this.engineGain.gain.linearRampToValueAtTime(vol, this.ctx.currentTime + 0.1);
    this.engineFilter.frequency.linearRampToValueAtTime(
      300 + normalizedSpeed * 600 + (boosting ? 400 : 0),
      this.ctx.currentTime + 0.1
    );
  }

  playTone(freq, duration, type = 'sine', volume = 0.15) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;

    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(0);
    osc.stop(this.ctx.currentTime + duration);
  }

  playCountdown(number) {
    if (number > 0) {
      this.playTone(440, 0.2, 'sine', 0.2);
    } else {
      this.playTone(880, 0.4, 'sine', 0.3);
    }
  }

  playSplash() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.15, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() - 0.5) * 0.5 * (1 - i / data.length);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.1;
    src.connect(gain);
    gain.connect(this.sfxGain);
    src.start(0);
  }

  playBoost() {
    this.playTone(660, 0.1, 'sawtooth', 0.1);
    setTimeout(() => this.playTone(880, 0.15, 'sawtooth', 0.08), 50);
  }

  playCheckpoint() {
    this.playTone(523, 0.1, 'sine', 0.15);
    setTimeout(() => this.playTone(659, 0.1, 'sine', 0.15), 80);
  }

  playLapComplete() {
    this.playTone(523, 0.15, 'sine', 0.2);
    setTimeout(() => this.playTone(659, 0.15, 'sine', 0.2), 100);
    setTimeout(() => this.playTone(784, 0.2, 'sine', 0.2), 200);
  }

  playFinish() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((n, i) => {
      setTimeout(() => this.playTone(n, 0.3, 'sine', 0.2), i * 120);
    });
  }

  playPickup() {
    this.playTone(880, 0.12, 'sine', 0.18);
    setTimeout(() => this.playTone(1320, 0.15, 'sine', 0.15), 80);
  }

  playCollision() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 80;
    osc.frequency.linearRampToValueAtTime(30, this.ctx.currentTime + 0.2);

    const gain = this.ctx.createGain();
    gain.gain.value = 0.25;
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.3);

    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.15, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() - 0.5) * 0.6 * (1 - i / data.length);
    }
    const noiseSrc = this.ctx.createBufferSource();
    noiseSrc.buffer = buffer;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.value = 0.15;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(0);
    osc.stop(this.ctx.currentTime + 0.3);

    noiseSrc.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
    noiseSrc.start(0);
  }
}
