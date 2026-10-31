/**
 * Motor de Procesamiento Digital de Señales (DSP) con Web Audio API
 */
import { AppState, subscribeState } from '../state.js';
import { calculateSplAtPosition, calculateOffAxisLoss } from '../physics/acoustics.js';

class AudioEngine {
  constructor() {
    this.audioCtx = null;
    this.isPlaying = false;
    
    this.oscillator = null;
    this.subOscillator = null;
    this.gainNode = null;
    this.subGainNode = null;
    this.filterNode = null;
    this.delayNode = null;
    this.feedbackGain = null;

    subscribeState((state) => this.updateAudioParams(state));
  }

  initContext() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  toggleAudio() {
    this.initContext();
    if (this.isPlaying) {
      this.stop();
    } else {
      this.start();
    }
    return this.isPlaying;
  }

  start() {
    if (this.isPlaying) return;

    const now = this.audioCtx.currentTime;

    this.oscillator = this.audioCtx.createOscillator();
    this.subOscillator = this.audioCtx.createOscillator();
    this.subOscillator.type = 'sine';

    this.configureSourceProfile(AppState.sourceProfile, now);

    this.filterNode = this.audioCtx.createBiquadFilter();
    this.filterNode.type = 'lowpass';
    this.filterNode.frequency.setValueAtTime(12000, now);

    this.gainNode = this.audioCtx.createGain();
    this.gainNode.gain.setValueAtTime(0.001, now);

    this.subGainNode = this.audioCtx.createGain();
    this.subGainNode.gain.setValueAtTime(0.001, now);

    this.delayNode = this.audioCtx.createDelay();
    this.delayNode.delayTime.setValueAtTime(0.12, now);

    this.feedbackGain = this.audioCtx.createGain();
    this.feedbackGain.gain.setValueAtTime(0.15, now);

    this.oscillator.connect(this.filterNode);
    this.subOscillator.connect(this.subGainNode);
    this.subGainNode.connect(this.gainNode);

    this.filterNode.connect(this.gainNode);

    this.filterNode.connect(this.delayNode);
    this.delayNode.connect(this.feedbackGain);
    this.feedbackGain.connect(this.delayNode);
    this.feedbackGain.connect(this.gainNode);

    this.gainNode.connect(this.audioCtx.destination);

    this.oscillator.start();
    this.subOscillator.start();
    this.isPlaying = true;

    this.updateAudioParams(AppState);
  }

  configureSourceProfile(profile, now) {
    if (!this.oscillator || !this.subOscillator) return;

    switch (profile) {
      case 'speech':
        this.oscillator.type = 'triangle';
        this.oscillator.frequency.setValueAtTime(320, now);
        this.subOscillator.frequency.setValueAtTime(0, now);
        break;

      case 'strings':
        this.oscillator.type = 'sawtooth';
        this.oscillator.frequency.setValueAtTime(660, now);
        this.subOscillator.frequency.setValueAtTime(0, now);
        break;

      case 'percussion':
        this.oscillator.type = 'square';
        this.oscillator.frequency.setValueAtTime(180, now);
        this.subOscillator.frequency.setValueAtTime(55, now);
        break;

      case 'live_band':
        this.oscillator.type = 'square';
        this.oscillator.frequency.setValueAtTime(220, now);
        this.subOscillator.frequency.setValueAtTime(60, now);
        break;

      case 'edm':
        this.oscillator.type = 'sawtooth';
        this.oscillator.frequency.setValueAtTime(110, now);
        this.subOscillator.frequency.setValueAtTime(45, now);
        break;

      default:
        this.oscillator.type = 'sawtooth';
        this.oscillator.frequency.setValueAtTime(220, now);
        this.subOscillator.frequency.setValueAtTime(0, now);
        break;
    }
  }

  stop() {
    if (!this.isPlaying) return;

    if (this.oscillator) {
      this.oscillator.stop();
      this.oscillator.disconnect();
    }
    if (this.subOscillator) {
      this.subOscillator.stop();
      this.subOscillator.disconnect();
    }
    this.isPlaying = false;
  }

  updateAudioParams(state) {
    if (!this.isPlaying || !this.audioCtx) return;

    const now = this.audioCtx.currentTime;

    this.configureSourceProfile(state.sourceProfile, now);

    const spl = calculateSplAtPosition(
      state.speakers,
      state.listener.x,
      state.listener.y,
      1.2,
      state.venue.type,
      state.subwoofers
    );

    const normalizedSpl = Math.max(0, Math.min(1, (spl - 65) / 40));
    const targetGain = Math.pow(normalizedSpl, 2) * 0.25;

    this.gainNode.gain.setTargetAtTime(Math.max(0.001, targetGain), now, 0.05);

    // Sub-bass presencial según subwoofers en pantalla
    const activeSubCount = state.subwoofers ? state.subwoofers.filter(s => s.active).length : 0;
    const subGainTarget = activeSubCount > 0 ? Math.min(1.0, activeSubCount * 0.35) : 0;
    this.subGainNode.gain.setTargetAtTime(subGainTarget, now, 0.05);

    let maxOffAxis = 0;
    state.speakers.forEach(spk => {
      if (spk.active) {
        const loss = calculateOffAxisLoss(spk, state.listener.x, state.listener.y, 1.2);
        if (loss > maxOffAxis) maxOffAxis = loss;
      }
    });

    const cutoffFreq = Math.max(600, 14000 - maxOffAxis * 900);
    this.filterNode.frequency.setTargetAtTime(cutoffFreq, now, 0.05);

    let feedbackLevel = 0.1;
    if (state.venue.type === 'indoor') {
      if (state.venue.material === 'concrete') feedbackLevel = 0.45;
      else if (state.venue.material === 'drywall') feedbackLevel = 0.25;
      else if (state.venue.material === 'panels') feedbackLevel = 0.05;
    } else {
      feedbackLevel = 0.02;
    }

    this.feedbackGain.gain.setTargetAtTime(feedbackLevel, now, 0.1);
  }
}

export const dspEngine = new AudioEngine();