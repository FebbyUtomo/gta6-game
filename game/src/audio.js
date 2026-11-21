// Sound, all synthesized with WebAudio: no audio files, nothing over the network. Every
// effect is a small oscillator or noise burst with an envelope. The context is created on the
// first user gesture (browsers block audio before one) and the engine hum follows the car's
// speed while the siren wails whenever police are close. M toggles mute.

export function createAudio() {
  let context = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenHigh = false;
  let sirenTimer = 0;
  let muted = false;

  function ensure() {
    if (context !== null) return true;
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return false;
      context = new Ctor();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  /** Call from a user gesture (start, click) so the browser allows audio. */
  function unlock() {
    if (!ensure()) return;
    if (context.state === 'suspended') context.resume().catch(() => {});
  }

  function tone(freq, duration, type, volume, slideTo) {
    if (!ensure() || muted) return;
    const t = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + duration);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  function noise(duration, volume, lowpass) {
    if (!ensure() || muted) return;
    const t = context.currentTime;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    source.connect(gain);
    if (lowpass !== undefined) {
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      gain.connect(filter);
      filter.connect(master);
    } else {
      gain.connect(master);
    }
    source.start(t);
  }

  return {
    unlock,
    /** The UI click and the mission jingle share this little two-note blip. */
    click() {
      tone(660, 0.07, 'sine', 0.25);
    },
    punch() {
      tone(150, 0.12, 'sine', 0.5, 55);
      noise(0.08, 0.25, 900);
    },
    shoot() {
      noise(0.12, 0.55, 3200);
      tone(220, 0.08, 'square', 0.2, 70);
    },
    crash() {
      noise(0.22, 0.5, 700);
      tone(90, 0.2, 'sine', 0.4, 40);
    },
    pickup() {
      tone(880, 0.08, 'sine', 0.3);
      setTimeout(() => tone(1320, 0.1, 'sine', 0.3), 70);
    },
    mission() {
      const notes = [523, 659, 784, 1046];
      notes.forEach((freq, i) => setTimeout(() => tone(freq, 0.16, 'triangle', 0.35), i * 110));
    },
    busted() {
      const notes = [392, 330, 262];
      notes.forEach((freq, i) => setTimeout(() => tone(freq, 0.25, 'sawtooth', 0.22), i * 180));
    },
    /** The engine hum: call every frame with the car's speed (0 when not driving). */
    engine(speed, top) {
      if (!ensure()) return;
      if (speed <= 1) {
        if (engineOsc !== null) {
          try {
            engineGain.gain.setTargetAtTime(0, context.currentTime, 0.05);
          } catch {}
          engineOsc = null;
          engineGain = null;
        }
        return;
      }
      if (engineOsc === null) {
        engineOsc = context.createOscillator();
        engineOsc.type = 'sawtooth';
        engineGain = context.createGain();
        engineGain.gain.value = 0;
        const filter = context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 900;
        engineOsc.connect(engineGain);
        engineGain.connect(filter);
        filter.connect(master);
        engineOsc.start();
      }
      const ratio = Math.min(1, speed / Math.max(1, top));
      engineOsc.frequency.setTargetAtTime(60 + ratio * 160, context.currentTime, 0.08);
      engineGain.gain.setTargetAtTime(muted ? 0 : 0.05 + ratio * 0.05, context.currentTime, 0.08);
    },
    /** The siren: call every frame with whether any police car is near. */
    siren(active, dt) {
      if (!ensure()) return;
      if (!active) {
        if (sirenOsc !== null) {
          try {
            sirenGain.gain.setTargetAtTime(0, context.currentTime, 0.1);
          } catch {}
          sirenOsc = null;
          sirenGain = null;
        }
        return;
      }
      if (sirenOsc === null) {
        sirenOsc = context.createOscillator();
        sirenOsc.type = 'triangle';
        sirenGain = context.createGain();
        sirenGain.gain.value = 0;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(master);
        sirenOsc.start();
        sirenTimer = 0;
        sirenHigh = false;
      }
      sirenTimer += dt;
      if (sirenTimer > 0.42) {
        sirenTimer = 0;
        sirenHigh = !sirenHigh;
        sirenOsc.frequency.setTargetAtTime(sirenHigh ? 950 : 700, context.currentTime, 0.02);
      }
      sirenGain.gain.setTargetAtTime(muted ? 0 : 0.045, context.currentTime, 0.1);
    },
    toggleMute() {
      muted = !muted;
      if (master !== null) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() {
      return muted;
    },
  };
}
