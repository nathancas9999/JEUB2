import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SoundService {
  private audioCtx: AudioContext;
  private isMuted = false;
  private noiseBuffer: AudioBuffer;

  constructor() {
    const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
    this.audioCtx = new AudioContext();
    this.noiseBuffer = this.createNoiseBuffer(1.0); // 1 seconde de bruit blanc
  }

  resume() {
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  // =========================================================
  // 🎹 MOTEUR SYNTHÉTIQUE (BAS NIVEAU)
  // =========================================================

  playTone(freq: number, type: OscillatorType, duration: number, vol: number, detune = 0, filterFreq = 0) {
    if (this.isMuted) return;
    this.resume();
    const t = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.detune.value = detune;

    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    
    if (filterFreq > 0) {
      const filter = this.audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(filterFreq, t);
      osc.connect(filter).connect(gain).connect(this.audioCtx.destination);
    } else {
      osc.connect(gain).connect(this.audioCtx.destination);
    }

    osc.start(t);
    osc.stop(t + duration);
  }

  playNoise(duration: number, type: BiquadFilterType, freq: number, vol: number) {
    if (this.isMuted) return;
    this.resume();
    const t = this.audioCtx.currentTime;
    const src = this.audioCtx.createBufferSource();
    src.buffer = this.noiseBuffer;
    
    const filter = this.audioCtx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t);

    const gain = this.audioCtx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    src.connect(filter).connect(gain).connect(this.audioCtx.destination);
    src.start(t);
    src.stop(t + duration);
  }

  // =========================================================
  // 🎮 SONS DU JEU
  // =========================================================

  // NOUVEAU : Le fameux son "Ka-ching" !
  playCash() {
    this.playTone(1200, 'square', 0.1, 0.1);
    setTimeout(() => this.playTone(1600, 'square', 0.1, 0.1), 80);
  }

  playSuccess() {
    [523, 659, 783, 1046].forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'sine', 0.2, 0.1), i * 100);
    });
  }

  playError() {
    this.playTone(150, 'sawtooth', 0.3, 0.2);
  }

  playPop() {
    this.playTone(600, 'sine', 0.1, 0.1);
  }
  
  playSoftPop() {
    this.playTone(400, 'sine', 0.1, 0.05);
  }

  // --- INTRO ---
  startRainAmbience() {} 
  stopRainAmbience() {}

  playTrashInBin() { this.playNoise(0.2, 'lowpass', 200, 0.5); }
  playPaperSound() { this.playNoise(0.1, 'highpass', 1000, 0.3); }
  playLeafSound() { this.playNoise(0.15, 'bandpass', 500, 0.2); }
  playCanSound() { this.playNoise(0.1, 'highpass', 2000, 0.4); }
  playScratchSound() { this.playNoise(0.1, 'bandpass', 800, 0.3); }

  // --- FOODTRUCK ---
  playSteakSound() { this.playNoise(0.3, 'lowpass', 400, 0.4); }
  playSaladSound() { this.playNoise(0.1, 'highpass', 1500, 0.3); }

  // --- FREELANCE ---
  private getVariation() { return (Math.random() * 50) - 25; }
  playKeystroke() { this.playRandomKey(); }
  playRandomKey() { this.playTone(300, 'triangle', 0.05, 0.1, this.getVariation()); }
  playSpace() { this.playTone(150, 'square', 0.1, 0.15, this.getVariation()); }

  // --- UTILS ---
  private createNoiseBuffer(duration: number): AudioBuffer {
    const bufferSize = this.audioCtx.sampleRate * duration;
    const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }
}