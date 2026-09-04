var DEBUG_LOGS = (typeof DEBUG_LOGS !== 'undefined') ? DEBUG_LOGS : false;
class HolodeckAudio {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.soundEnabled = true;
    this.voiceEnabled = true;
    this.ambientEnabled = true;
    this.synth = (typeof window !== 'undefined' && window.speechSynthesis) ? window.speechSynthesis : null;
    this.computerVoice = null;
    this.commanderVoice = null;
    this.siskoVoice = null;
    this.bashirVoice = null;
    this.emhVoice = null;
    this.activeUtterance = null;
    this.voicePersona = "commander"; // 'commander', 'computer', 'sisko', 'bashir', 'emh'
    this.ricochetProfile = "tachyon_deflect"; // TACHYON DEFLECT default across all modes // 'baseline', 'harmonic', 'deep_bass', 'warp_ping', 'tachyon_deflect'
    this.isPaused = false;

    this.normalAmbientGain = 0.021375; // Dropped another 25% for subtle background atmosphere
    this.dimmedAmbientGain = 0.01603125; // 25% lower for menu and pause states
    this.currentAmbientMode = 'dimmed'; // Starts dimmed on the menu

    this.warpGain = null;
    this.warpOsc1 = null;
    this.warpOsc2 = null;
    this.warpFilter = null;
    this.isWarpRunning = false;

    this.masterGain = null;
    this.mediaStreamDest = null;
    this.audioCache = {};
    this.currentVoiceAudio = null;

    this.initVoices();
  }

  getMediaStream() {
    this.init();
    if (!this.mediaStreamDest && this.ctx && this.ctx.createMediaStreamDestination) {
      try {
        this.mediaStreamDest = this.ctx.createMediaStreamDestination();
        if (this.masterGain) {
          this.masterGain.connect(this.mediaStreamDest);
        }
      } catch(e) {
        if (DEBUG_LOGS) console.warn('[LCARS Audio] MediaStreamDestination error:', e);
      }
    }
    return this.mediaStreamDest ? this.mediaStreamDest.stream : null;
  }

  initPannerPool() {
    if (!this.ctx || typeof this.ctx.createStereoPanner !== 'function') return;
    if (this.pannerPool && this.pannerPool.length > 0) return;
    this.pannerPool = [];
    this.pannerPoolIndex = 0;
    const master = this.masterGain || this.ctx.destination;
    for (let i = 0; i < 8; i++) {
      try {
        const p = this.ctx.createStereoPanner();
        p.pan.setValueAtTime(0, this.ctx.currentTime);
        p.connect(master);
        this.pannerPool.push(p);
      } catch(e) {}
    }
  }

  getMasterNode(panX = null) {
    if (!this.ctx) return null;
    const master = this.masterGain || this.ctx.destination;
    if (typeof panX === 'number' && typeof this.ctx.createStereoPanner === 'function') {
      if (!this.pannerPool || this.pannerPool.length === 0) {
        this.initPannerPool();
      }
      if (this.pannerPool && this.pannerPool.length > 0) {
        try {
          const panVal = Math.max(-0.85, Math.min(0.85, panX / 21.0));
          const panner = this.pannerPool[this.pannerPoolIndex];
          this.pannerPoolIndex = (this.pannerPoolIndex + 1) % this.pannerPool.length;
          panner.pan.setValueAtTime(panVal, this.ctx.currentTime);
          return panner;
        } catch(e) {}
      }
    }
    return master;
  }

  initVoices() {
    if (!this.synth) return;
    try {
      const loadVoices = () => {
        try {
          const voices = this.synth.getVoices();
          if (!voices || voices.length === 0) return;

          // 1. Tactical Commander Female Voice (Tough, authoritative, crisp)
          const commanderPreferred = [
            'Microsoft Zira', 'Microsoft Jenny', 'Microsoft Aria', 'Google UK English Female',
            'Samantha', 'Victoria', 'Karen', 'Fiona', 'Moira', 'Google US English', 'en-US'
          ];
          for (const pref of commanderPreferred) {
            const match = voices.find(v => (v.name && v.name.toLowerCase().includes(pref.toLowerCase())) || (v.lang && v.lang.toLowerCase().includes(pref.toLowerCase())));
            if (match) {
              this.commanderVoice = match;
              break;
            }
          }
          if (!this.commanderVoice) {
            this.commanderVoice = voices.find(v => v.name && v.name.toLowerCase().includes('female')) || voices[0];
          }

          // 2. LCARS Mainframe Computer Voice (Calm, measured)
          const computerPreferred = ['Microsoft David', 'Google US English', 'Alex', 'Daniel', 'en-US', 'en-GB'];
          for (const pref of computerPreferred) {
            const match = voices.find(v => v !== this.commanderVoice && ((v.name && v.name.toLowerCase().includes(pref.toLowerCase())) || (v.lang && v.lang.toLowerCase().includes(pref.toLowerCase()))));
            if (match) {
              this.computerVoice = match;
              break;
            }
          }
          if (!this.computerVoice) {
            this.computerVoice = voices[0];
          }

          // 3. Captain Benjamin Sisko (Deep, commanding US baritone)
          const siskoPreferred = ['Microsoft David', 'Microsoft Guy', 'Google US English Male', 'Alex', 'Fred', 'en-US'];
          for (const pref of siskoPreferred) {
            const match = voices.find(v => (v.name && v.name.toLowerCase().includes(pref.toLowerCase())) || (v.lang && v.lang.toLowerCase().includes(pref.toLowerCase())));
            if (match) {
              this.siskoVoice = match;
              break;
            }
          }
          if (!this.siskoVoice) {
            this.siskoVoice = this.computerVoice || voices[0];
          }

          // 4. Dr. Julian Bashir (Cultured British RP)
          const bashirPreferred = ['Google UK English Male', 'Microsoft George', 'Microsoft Ryan', 'Oliver', 'Daniel', 'en-GB', 'en_GB', 'British'];
          for (const pref of bashirPreferred) {
            const match = voices.find(v => (v.name && v.name.toLowerCase().includes(pref.toLowerCase())) || (v.lang && v.lang.toLowerCase().includes(pref.toLowerCase())));
            if (match) {
              this.bashirVoice = match;
              break;
            }
          }
          if (!this.bashirVoice) {
            this.bashirVoice = voices.find(v => v.lang && (v.lang.includes('GB') || v.lang.includes('en-GB'))) || this.computerVoice || voices[0];
          }

          // 5. The EMH Hologram Doctor (Theatrical crisp American tenor)
          const emhPreferred = ['Microsoft Mark', 'Google US English', 'Alex', 'en-US'];
          for (const pref of emhPreferred) {
            const match = voices.find(v => (v.name && v.name.toLowerCase().includes(pref.toLowerCase())) || (v.lang && v.lang.toLowerCase().includes(pref.toLowerCase())));
            if (match) {
              this.emhVoice = match;
              break;
            }
          }
          if (!this.emhVoice) {
            this.emhVoice = this.computerVoice || voices[0];
          }
        } catch(e) {}
      };

      loadVoices();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    } catch(e) {}
  }

  toggleVoicePersona() {
    // 1. Stop any currently playing MP3 or Speech synthesis immediately
    if (this.currentVoiceAudio) {
      try {
        this.currentVoiceAudio.pause();
        this.currentVoiceAudio.currentTime = 0;
      } catch(e) {}
      this.currentVoiceAudio = null;
    }
    if (this.synth) {
      try { this.synth.cancel(); } catch(e) {}
    }

    const order = ['commander', 'computer', 'sisko', 'bashir', 'emh'];
    const currentIdx = order.indexOf(this.voicePersona);
    this.voicePersona = order[(currentIdx + 1) % order.length];
    
    // Ensure synthesizer voices are loaded
    if (this.synth) {
      this.initVoices();
    }

    // Speak audio preview test sample for the active persona ONLY
    if (!this.isMuted && this.voiceEnabled) {
      if (this.voicePersona === 'commander') {
        this.speak('Tactical Commander voice matrix active. Ready for combat simulation.', false);
      } else if (this.voicePersona === 'computer') {
        this.speak('LCARS computer voice interface online.', true);
      } else if (this.voicePersona === 'sisko') {
        this.speak('Captain Sisko here. Threat vectors plotted. Prepare quantum blasters.', false);
      } else if (this.voicePersona === 'bashir') {
        this.speak('Dr. Bashir here. My genetic enhancements suggest that answer was mathematically inevitable.', false);
      } else if (this.voicePersona === 'emh') {
        this.speak('Please state the nature of the mathematical emergency! EMH matrix online.', false);
      }
    }

    return this.voicePersona;
  }

  speakPreview(text, persona) {
    if (!this.synth) return;
    try {
      this.synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      this.activeUtterance = utterance;

      if (persona === 'commander' && this.commanderVoice) {
        utterance.voice = this.commanderVoice;
        utterance.pitch = 0.96;
        utterance.rate = 1.05;
        utterance.volume = 1.0;
      } else if (persona === 'sisko' && this.siskoVoice) {
        utterance.voice = this.siskoVoice;
        utterance.pitch = 0.78;
        utterance.rate = 0.93;
        utterance.volume = 1.0;
      } else if (persona === 'bashir' && this.bashirVoice) {
        utterance.voice = this.bashirVoice;
        utterance.pitch = 1.06;
        utterance.rate = 1.10;
        utterance.volume = 1.0;
      } else if (persona === 'emh' && this.emhVoice) {
        utterance.voice = this.emhVoice;
        utterance.pitch = 1.04;
        utterance.rate = 1.03;
        utterance.volume = 1.0;
      } else if (this.computerVoice) {
        utterance.voice = this.computerVoice;
        utterance.pitch = 1.10;
        utterance.rate = 0.95;
        utterance.volume = 0.95;
      }

      utterance.onend = () => { this.activeUtterance = null; };
      utterance.onerror = () => { this.activeUtterance = null; };

      setTimeout(() => {
        try {
          if (this.synth.paused) this.synth.resume();
          this.synth.speak(utterance);
        } catch(e) {}
      }, 25);
    } catch(e) {}
  }

  init() {
    try {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.ctx = new AudioContext();
        }
      }
      if (this.ctx && !this.masterGain) {
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
        if (this.mediaStreamDest) {
          try { this.masterGain.connect(this.mediaStreamDest); } catch(e) {}
        }
        this.initPannerPool();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      if (this.ambientEnabled && !this.isWarpRunning && !this.isMuted) {
        this.startWarpCoreHum();
      }
    } catch(e) {}
  }

  getVolumeScale() {
    return this.isPaused ? 0.5 : 1.0;
  }

  getVol(val) {
    return (val || 0) * (this.isPaused ? 0.5 : 1.0);
  }

  setPaused(isPaused) {
    this.isPaused = !!isPaused;
    if (this.warpGain && this.ctx) {
      try {
        const now = this.ctx.currentTime;
        this.warpGain.gain.cancelScheduledValues(now);
        if (this.isPaused) {
          // Pause mutes ambient warp hum immediately
          this.warpGain.gain.linearRampToValueAtTime(0.00001, now + 0.12);
        } else if (this.ambientEnabled && !this.isMuted) {
          // Resume restores ambient hum to target level
          const targetGain = (this.currentAmbientMode === 'dimmed') ? this.dimmedAmbientGain : this.normalAmbientGain;
          this.warpGain.gain.linearRampToValueAtTime(targetGain, now + 0.25);
        }
      } catch(e) {}
    }
  }

  playComputerChirp() {
    if (this.isMuted || !this.soundEnabled || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const vol = this.getVolumeScale();
      const output = this.getMasterNode();
      if (!output) return;
      
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(1864.66, now);
      gain1.gain.setValueAtTime(0.18 * vol, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
      osc1.connect(gain1);
      gain1.connect(output);
      osc1.start(now);
      osc1.stop(now + 0.045);

      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(2489.02, now + 0.045);
      gain2.gain.setValueAtTime(0.22 * vol, now + 0.045);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
      osc2.connect(gain2);
      gain2.connect(output);
      osc2.start(now + 0.045);
      osc2.stop(now + 0.095);
    } catch(e) {}
  }

  setAmbientMode(mode) {
    this.currentAmbientMode = mode; // 'dimmed' (25% lower for menu/pause) vs 'normal' (active play)
    if (this.isMuted || !this.ambientEnabled || !this.warpGain || !this.ctx) return;
    if (this.isPaused) return; // Ambient is muted while paused
    const targetGain = (mode === 'dimmed') ? this.dimmedAmbientGain : this.normalAmbientGain;
    try {
      this.warpGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.warpGain.gain.linearRampToValueAtTime(targetGain, this.ctx.currentTime + 0.35);
      if (DEBUG_LOGS) console.log(`[LCARS Audio Telemetry] Ambient Mode -> ${mode} (Gain: ${targetGain.toFixed(4)})`);
    } catch(e) {}
  }

  startWarpCoreHum() {
    if (!this.ctx || this.isWarpRunning) return;
    try {
      const now = this.ctx.currentTime;
      const targetGain = this.isMuted ? 0.00001 : (this.currentAmbientMode === 'dimmed' ? this.dimmedAmbientGain : this.normalAmbientGain);

      this.warpGain = this.ctx.createGain();
      // Gentle 1.8-second exponential attack ramp starting from 0.00001 to prevent any initial click/pop or sudden bass boom
      this.warpGain.gain.setValueAtTime(0.00001, now);
      this.warpGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, targetGain), now + 1.8);

      // Warm cinematic lowpass filter
      this.warpFilter = this.ctx.createBiquadFilter();
      this.warpFilter.type = 'lowpass';
      this.warpFilter.frequency.setValueAtTime(160, now);
      this.warpFilter.Q.setValueAtTime(0.5, now);

      // Gentle C2 (65.41 Hz) pure sine wave fundamental (warm, smooth, no harsh triangular rumble)
      this.warpOsc1 = this.ctx.createOscillator();
      this.warpOsc1.type = 'sine';
      this.warpOsc1.frequency.setValueAtTime(65.41, now);

      // Soft C3 (130.81 Hz) pure sine wave octave body
      this.warpOsc2 = this.ctx.createOscillator();
      this.warpOsc2.type = 'sine';
      this.warpOsc2.frequency.setValueAtTime(130.81, now);

      // Gentle G3 (196.00 Hz) sine wave musical harmonic fifth
      this.warpOsc3 = this.ctx.createOscillator();
      this.warpOsc3.type = 'sine';
      this.warpOsc3.frequency.setValueAtTime(196.00, now);

      // Slow 0.12 Hz subtle breathing LFO
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.setValueAtTime(0.12, now);
      lfoGain.gain.setValueAtTime(18, now);
      lfo.connect(lfoGain);
      lfoGain.connect(this.warpFilter.frequency);

      this.warpOsc1.connect(this.warpFilter);
      this.warpOsc2.connect(this.warpFilter);
      this.warpOsc3.connect(this.warpFilter);
      this.warpFilter.connect(this.warpGain);
      this.warpGain.connect(this.getMasterNode());

      this.warpOsc1.start(now);
      this.warpOsc2.start(now);
      this.warpOsc3.start(now);
      lfo.start(now);

      this.isWarpRunning = true;
    } catch(e) {}
  }

  stopWarpCoreHum() {
    if (!this.isWarpRunning || !this.warpGain) return;
    try {
      this.warpGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.5);
      setTimeout(() => {
        try {
          if (this.warpOsc1) { this.warpOsc1.stop(); this.warpOsc1.disconnect(); }
          if (this.warpOsc2) { this.warpOsc2.stop(); this.warpOsc2.disconnect(); }
          if (this.warpOsc3) { this.warpOsc3.stop(); this.warpOsc3.disconnect(); }
          if (this.warpFilter) { this.warpFilter.disconnect(); }
          if (this.warpGain) { this.warpGain.disconnect(); }
        } catch(e) {}
        this.isWarpRunning = false;
      }, 600);
    } catch(e) {}
  }

  toggleMasterMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      if (this.warpGain && this.ctx) {
        this.warpGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
      }
      if (this.currentVoiceAudio) {
        this.currentVoiceAudio.pause();
      }
    } else {
      if (this.ambientEnabled && this.warpGain && this.ctx) {
        const targetGain = (this.currentAmbientMode === 'dimmed') ? this.dimmedAmbientGain : this.normalAmbientGain;
        this.warpGain.gain.setValueAtTime(targetGain, this.ctx.currentTime);
      }
    }
    return this.isMuted;
  }

  toggleAmbient() {
    this.ambientEnabled = !this.ambientEnabled;
    if (this.ambientEnabled && !this.isMuted) {
      this.init();
      if (!this.isWarpRunning) this.startWarpCoreHum();
      else if (this.warpGain && this.ctx) {
        const targetGain = (this.currentAmbientMode === 'dimmed') ? this.dimmedAmbientGain : this.normalAmbientGain;
        this.warpGain.gain.setValueAtTime(targetGain, this.ctx.currentTime);
      }
    } else {
      if (this.warpGain && this.ctx) this.warpGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    }
    return this.ambientEnabled;
  }

  playRedAlert() {
    if (this.isMuted || !this.soundEnabled || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(740, now);
      osc.frequency.linearRampToValueAtTime(980, now + 0.2);
      osc.frequency.setValueAtTime(740, now + 0.25);
      osc.frequency.linearRampToValueAtTime(980, now + 0.45);

      gain.gain.setValueAtTime(this.getVol(0.28), now);
      gain.gain.linearRampToValueAtTime(this.getVol(0.28), now + 0.45);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

      osc.connect(gain);
      gain.connect(this.getMasterNode());

      osc.start(now);
      osc.stop(now + 0.55);
    } catch(e) {}
  }

  playTimeTick() {
    if (this.isMuted || !this.soundEnabled || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(this.getVol(0.12), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(this.getMasterNode());
      osc.start(now);
      osc.stop(now + 0.05);
    } catch(e) {}
  }

  playLaser() {
    if (this.isMuted || !this.soundEnabled || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(950, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.22);
      
      gain.gain.setValueAtTime(this.getVol(0.35), now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);

      osc.connect(gain);
      gain.connect(this.getMasterNode());

      osc.start(now);
      osc.stop(now + 0.22);
    } catch(e) {}
  }

  getNoiseBuffer() {
    if (!this.ctx) return null;
    if (!this.cachedNoiseBuffer) {
      const bufferSize = Math.floor(this.ctx.sampleRate * 1.0);
      this.cachedNoiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = this.cachedNoiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    }
    return this.cachedNoiseBuffer;
  }

  playTransporterBeam(panX = 0) {
    if (this.isMuted || !this.soundEnabled || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const outputNode = this.getMasterNode(panX);
      if (!outputNode) return;

      // Starfleet Holodeck Transporter Shimmer (High resonant harmonics shimmering 1860Hz - 3720Hz)
      const freqs = [1860, 2480, 3120, 3720];
      freqs.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.035);
        osc.frequency.linearRampToValueAtTime(freq * 1.09, now + idx * 0.035 + 0.16);
        osc.frequency.linearRampToValueAtTime(freq * 0.94, now + idx * 0.035 + 0.38);

        gain.gain.setValueAtTime(0.001, now + idx * 0.035);
        gain.gain.linearRampToValueAtTime(this.getVol(0.10), now + idx * 0.035 + 0.10);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.035 + 0.40);

        osc.connect(gain);
        gain.connect(outputNode);
        osc.start(now + idx * 0.035);
        osc.stop(now + idx * 0.035 + 0.40);
      });
    } catch(e) {}
  }

  playExplosion() {
    this.playHit();
  }

  playHit(panX = 0) {
    if (this.isMuted || !this.soundEnabled || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const buffer = this.getNoiseBuffer();
      if (!buffer) return;

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2200, now);
      filter.frequency.linearRampToValueAtTime(140, now + 0.38);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(this.getVol(0.65), now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.38);

      const outputNode = this.getMasterNode(panX);
      if (!outputNode) return;

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(outputNode);

      noise.start(now);

      const subOsc = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      subOsc.frequency.setValueAtTime(220, now);
      subOsc.frequency.exponentialRampToValueAtTime(30, now + 0.38);
      subGain.gain.setValueAtTime(this.getVol(0.85), now);
      subGain.gain.exponentialRampToValueAtTime(0.01, now + 0.38);

      subOsc.connect(subGain);
      subGain.connect(outputNode);

      subOsc.start(now);
      subOsc.stop(now + 0.38);
    } catch(e) {}
  }

  playShieldBreak() {
    if (this.isMuted || !this.soundEnabled || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.45);

      gain.gain.setValueAtTime(this.getVol(0.5), now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

      osc.connect(gain);
      gain.connect(this.getMasterNode());
      osc.start(now);
      osc.stop(now + 0.45);
    } catch(e) {}
  }

  playWarpJump() {
    if (this.isMuted || !this.soundEnabled || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, now);
      filter.frequency.exponentialRampToValueAtTime(7500, now + 1.2);
      filter.frequency.exponentialRampToValueAtTime(450, now + 3.2);

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(65, now);
      osc.frequency.exponentialRampToValueAtTime(920, now + 1.2);
      osc.frequency.exponentialRampToValueAtTime(80, now + 3.2);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(this.getVol(0.48), now + 0.8);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 3.4);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.getMasterNode());

      osc.start(now);
      osc.stop(now + 3.4);

      for (let i = 0; i < 5; i++) {
        const pOsc = this.ctx.createOscillator();
        const pGain = this.ctx.createGain();
        pOsc.type = 'sine';
        pOsc.frequency.setValueAtTime(660 * (i + 1), now + 0.25 * i);
        pOsc.frequency.exponentialRampToValueAtTime(1400 * (i + 1), now + 0.25 * i + 0.45);
        pGain.gain.setValueAtTime(this.getVol(0.12), now + 0.25 * i);
        pGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25 * i + 0.45);
        pOsc.connect(pGain);
        pGain.connect(this.getMasterNode());
        pOsc.start(now + 0.25 * i);
        pOsc.stop(now + 0.25 * i + 0.45);
      }
    } catch(e) {}
  }

  playTimeDilation() {
    if (this.isMuted || !this.soundEnabled || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2200, now);
      filter.frequency.exponentialRampToValueAtTime(140, now + 0.85);

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.85);

      gain.gain.setValueAtTime(this.getVol(0.45), now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.9);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.getMasterNode());

      osc.start(now);
      osc.stop(now + 0.9);
    } catch(e) {}
  }

  playShieldRecharge() {
    if (this.isMuted || !this.soundEnabled || !this.ctx) return;
    try {
      const chords = [349.23, 440.00, 523.25, 659.25, 880.00, 1046.50];
      const now = this.ctx.currentTime;
      chords.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.05);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.15, now + idx * 0.05 + 0.28);

        gain.gain.setValueAtTime(this.getVol(0.28), now + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.32);

        osc.connect(gain);
        gain.connect(this.getMasterNode());
        osc.start(now + idx * 0.05);
        osc.stop(now + idx * 0.05 + 0.32);
      });
    } catch(e) {}
  }

  playLevelUp() {
    if (this.isMuted || !this.soundEnabled || !this.ctx) return;
    try {
      const chords = [392.00, 523.25, 659.25, 783.99, 1046.50];
      const now = this.ctx.currentTime;
      chords.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        gain.gain.setValueAtTime(this.getVol(0.28), now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);

        osc.connect(gain);
        gain.connect(this.getMasterNode());
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.35);
      });
    } catch(e) {}
  }

  setRicochetProfile(profileId, playPreview = true) {
    const validProfiles = ['baseline', 'harmonic', 'deep_bass', 'warp_ping', 'tachyon_deflect'];
    if (validProfiles.includes(profileId)) {
      this.ricochetProfile = profileId;
      if (playPreview) {
        this.lastRicochetTime = 0;
        this.playRicochet(false);
      }
      if (DEBUG_LOGS) console.log(`[LCARS Audio Telemetry] Ricochet Sound Profile set to: ${profileId}`);
    }
    return this.ricochetProfile;
  }

  cycleRicochetProfile() {
    const profiles = ['baseline', 'harmonic', 'deep_bass', 'warp_ping', 'tachyon_deflect'];
    const idx = profiles.indexOf(this.ricochetProfile);
    const nextIdx = (idx + 1) % profiles.length;
    return this.setRicochetProfile(profiles[nextIdx], true);
  }

  playRicochet(isPaused = false, targetIndex = 0, panX = 0) {
    if (this.isMuted || !this.soundEnabled || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      // Hardware debounce throttle: prevent rapid-fire audio phase distortion
      if (this.lastRicochetTime && (now - this.lastRicochetTime < 0.045)) {
        return;
      }
      this.lastRicochetTime = now;

      // Harmonic scale multiplier per target index (Target 1: Root 1.0x, Target 2: +Maj2 1.1225x, Target 3: +Maj3 1.2599x, Target 4: +Perf5 1.4983x)
      const harmonicScale = [1.0, 1.1225, 1.2599, 1.4983];
      const safeIdx = Math.max(0, targetIndex || 0);
      const pitchScale = harmonicScale[safeIdx % harmonicScale.length] || 1.0;

      // 50% lower volume when paused via getVolumeScale()
      const maxGain = 0.15 * this.getVolumeScale();

      // Dynamic 3D Stereo Spatial Panning based on Holodeck Room X coordinate (X in [-21, +21])
      const outputNode = this.getMasterNode(panX);
      if (!outputNode) return;

      switch (this.ricochetProfile) {
        // 2. Harmonic Triad (C5: 523Hz, E5: 659Hz, G5: 784Hz base crystal chord)
        case 'harmonic': {
          const baseFreqs = [523.25, 659.25, 783.99];
          baseFreqs.forEach((baseFreq) => {
            const freq = baseFreq * pitchScale;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now);
            osc.frequency.exponentialRampToValueAtTime(freq * 1.06, now + 0.12);
            gain.gain.setValueAtTime(maxGain * 0.42, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
            osc.connect(gain);
            gain.connect(outputNode);
            osc.start(now);
            osc.stop(now + 0.12);
          });
          break;
        }

        // 3. Deep Bass Boop (Lowpass 185Hz -> 52Hz warm tactical thud)
        case 'deep_bass': {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(320 * pitchScale, now);
          filter.frequency.exponentialRampToValueAtTime(110 * pitchScale, now + 0.11);
          
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(185 * pitchScale, now);
          osc.frequency.exponentialRampToValueAtTime(52 * pitchScale, now + 0.11);
          
          gain.gain.setValueAtTime(maxGain * 1.35, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
          
          osc.connect(filter);
          filter.connect(gain);
          gain.connect(outputNode);
          osc.start(now);
          osc.stop(now + 0.11);
          break;
        }

        // 4. Starfleet Warp-Ping (1760Hz crystal chime with 880Hz body)
        case 'warp_ping': {
          const pOsc1 = this.ctx.createOscillator();
          const pGain1 = this.ctx.createGain();
          pOsc1.type = 'sine';
          pOsc1.frequency.setValueAtTime(1760 * pitchScale, now);
          pGain1.gain.setValueAtTime(maxGain * 0.70, now);
          pGain1.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
          pOsc1.connect(pGain1);
          pGain1.connect(outputNode);
          pOsc1.start(now);
          pOsc1.stop(now + 0.14);

          const pOsc2 = this.ctx.createOscillator();
          const pGain2 = this.ctx.createGain();
          pOsc2.type = 'sine';
          pOsc2.frequency.setValueAtTime(880 * pitchScale, now);
          pGain2.gain.setValueAtTime(maxGain * 0.40, now);
          pGain2.gain.exponentialRampToValueAtTime(0.001, now + 0.10);
          pOsc2.connect(pGain2);
          pGain2.connect(outputNode);
          pOsc2.start(now);
          pOsc2.stop(now + 0.10);
          break;
        }

        // 5. Tachyon Deflect (1450Hz -> 320Hz resonant sci-fi beam deflect)
        case 'tachyon_deflect': {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(1200 * pitchScale, now);
          filter.Q.setValueAtTime(3.0, now);
          filter.frequency.exponentialRampToValueAtTime(350 * pitchScale, now + 0.08);

          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(1450 * pitchScale, now);
          osc.frequency.exponentialRampToValueAtTime(320 * pitchScale, now + 0.08);

          gain.gain.setValueAtTime(maxGain * 0.85, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(outputNode);
          osc.start(now);
          osc.stop(now + 0.08);
          break;
        }

        // 1. Baseline Chirp (Original 680Hz -> 1800Hz upward sine sweep)
        case 'baseline':
        default: {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(680 * pitchScale, now);
          osc.frequency.exponentialRampToValueAtTime(1800 * pitchScale, now + 0.09);
          gain.gain.setValueAtTime(maxGain, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
          osc.connect(gain);
          gain.connect(outputNode);
          osc.start(now);
          osc.stop(now + 0.09);
          break;
        }
      }
    } catch(e) {}
  }

  playCombo(streak) {
    if (this.isMuted || !this.soundEnabled || !this.ctx) return;
    try {
      const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50, 1318.51];
      const baseFreq = notes[Math.min(streak, notes.length - 1)];
      const now = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.2);

      gain.gain.setValueAtTime(this.getVol(0.35), now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

      osc.connect(gain);
      gain.connect(this.getMasterNode());
      osc.start(now);
      osc.stop(now + 0.25);
    } catch(e) {}
  }

  playError() {
    if (this.isMuted || !this.soundEnabled || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.setValueAtTime(80, now + 0.18);

      gain.gain.setValueAtTime(this.getVol(0.4), now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

      osc.connect(gain);
      gain.connect(this.getMasterNode());
      osc.start(now);
      osc.stop(now + 0.35);
    } catch(e) {}
  }

  playVoice(soundKey, fallbackText) {
    if (this.isMuted || !this.voiceEnabled) return;

    // 1. Stop any active MP3 and cancel active speech
    if (this.currentVoiceAudio) {
      try {
        this.currentVoiceAudio.pause();
        this.currentVoiceAudio.currentTime = 0;
      } catch(e) {}
      this.currentVoiceAudio = null;
    }
    if (this.synth) {
      try { this.synth.cancel(); } catch(e) {}
    }

    // 2. Tactical Commander Persona: Route exclusively to synthesized female Commander voice
    if (this.voicePersona === 'commander') {
      const commanderPhrases = {
        engage_simulation: fallbackText || 'Holodeck simulation active. Engage.',
        incoming_attack: 'Warning! Incoming quantum projectile detected. Defend matrix!',
        target_vaporized: 'Target vaporized. Quantum matrix secure.',
        warp_jump: fallbackText || 'Warp drive engaged. Entering new sector.',
        shield_damaged: 'Containment shield damaged! Impact absorbed.',
        containment_breach: 'Containment failure. Simulation terminated.',
        sensor_jam: 'Sensor jam engaged. Spacetime vectors dilated.',
        distractor_eliminated: 'Distractor eliminated. Tactical probability optimized.',
        time_expired: 'Tactical time limit exceeded! Containment compromised.',
        simulation_complete: 'Simulation complete. Starfleet debriefing ready.',
        visualizer_engaged: 'Tactical visualizer online.',
        visualizer_off: 'Tactical visualizer offline.'
      };
      const textToSpeak = commanderPhrases[soundKey] || fallbackText;
      if (textToSpeak) this.speak(textToSpeak, false);
      return;
    }

    // 3. Captain Benjamin Sisko Persona (Deep baritone, commanding, deliberate)
    if (this.voicePersona === 'sisko') {
      const siskoPhrases = {
        engage_simulation: fallbackText || 'Captain Sisko here. Threat vectors plotted. Prepare quantum blasters.',
        incoming_attack: 'Incoming torpedo! All hands brace for impact!',
        target_vaporized: 'Target eliminated. Stand firm, crew!',
        warp_jump: fallbackText || 'Maximum warp. Let us see what is waiting for us in the next sector.',
        shield_damaged: 'Shields taking heavy fire! Reroute emergency power to forward emitters!',
        containment_breach: 'Containment breach! Abandon holodeck!',
        sensor_jam: 'Sensor jam active. Tactical field distorted.',
        distractor_eliminated: 'Distractor down. Keep firing on the prime target!',
        time_expired: 'Time has expired! We cannot afford hesitation in combat!',
        simulation_complete: 'Simulation terminated. Outstanding tactical execution, Commander.',
        visualizer_engaged: 'Astrometric visualizer on main viewer.',
        visualizer_off: 'Visualizer disengaged.'
      };
      const textToSpeak = siskoPhrases[soundKey] || fallbackText;
      if (textToSpeak) this.speak(textToSpeak, false);
      return;
    }

    // 4. Dr. Julian Bashir Persona (Cultured British RP, enthusiastic, mathematically brilliant)
    if (this.voicePersona === 'bashir') {
      const bashirPhrases = {
        engage_simulation: fallbackText || 'Dr. Bashir here. My genetic enhancements suggest this simulation is mathematically inevitable.',
        incoming_attack: 'Incoming projectile! Defensive action strongly advised!',
        target_vaporized: 'Splendid shot! Statistical probability of success was only 34 percent, but you did it!',
        warp_jump: fallbackText || 'Warp velocity achieved! Fascinating stellar readings in this sector.',
        shield_damaged: 'Hold on! Containment shields are degrading. Let us patch that plasma conduit!',
        containment_breach: 'Containment collapse! Medical team on standby!',
        sensor_jam: 'Temporal dilation active! Fascinating effect on their velocity vectors.',
        distractor_eliminated: 'Distractor vaporized! One less variable in our equation.',
        time_expired: 'Good heavens, time has run out! Deflector containment is buckling!',
        simulation_complete: 'Simulation complete! Statistically, an extraordinary intellectual performance.',
        visualizer_engaged: 'Mathematical visualizer initialized.',
        visualizer_off: 'Visualizer closed. Focusing on tactical telemetry.'
      };
      const textToSpeak = bashirPhrases[soundKey] || fallbackText;
      if (textToSpeak) this.speak(textToSpeak, false);
      return;
    }

    // 5. The EMH Hologram Doctor Persona (Voyager EMH, crisp, theatrical, pedantic, operatic)
    if (this.voicePersona === 'emh') {
      const emhPhrases = {
        engage_simulation: fallbackText || 'Please state the nature of the mathematical emergency! Emergency Hologram online.',
        incoming_attack: 'Warning! Incoming ordnance! Must I remind you that I am non-corporeal?!',
        target_vaporized: 'I am a doctor, not an artillery officer! But that calculation was surgical.',
        warp_jump: fallbackText || 'Warp speed engaged. Try not to induce warp sickness, if you please.',
        shield_damaged: 'Containment shield breach! Must I do everything myself around here?!',
        containment_breach: 'Containment failure! Holodeck safety protocols disengaged!',
        sensor_jam: 'Temporal sensors jammed. You are welcome. Now back to my diagnostic routines.',
        distractor_eliminated: 'Distractor eliminated! Clean incision.',
        time_expired: 'Chronometer expired! Your hesitation is medically hazardous!',
        simulation_complete: 'Simulation terminated. Your arithmetic was surprisingly adequate.',
        visualizer_engaged: 'Visualizer active. Do try to pay attention to the graph.',
        visualizer_off: 'Visualizer offline.'
      };
      const textToSpeak = emhPhrases[soundKey] || fallbackText;
      if (textToSpeak) this.speak(textToSpeak, false);
      return;
    }

    // 6. LCARS Computer Persona: Try classic MP3 clip first, fall back to Computer synth
    this.playComputerChirp();
    try {
      let audio = this.audioCache[soundKey];
      if (!audio) {
        audio = new Audio(`sounds/${soundKey}.mp3`);
        this.audioCache[soundKey] = audio;
      }

      audio.currentTime = 0;
      audio.volume = 1.0 * this.getVolumeScale();
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          this.currentVoiceAudio = audio;
        }).catch(() => {
          if (fallbackText) this.speak(fallbackText, false);
        });
      }
    } catch(e) {
      if (fallbackText) this.speak(fallbackText, false);
    }
  }

  speakCorrectAnswer(answerVal) {
    if (this.isMuted || !this.voiceEnabled) return;

    // Stop previous audio
    if (this.currentVoiceAudio) {
      try {
        this.currentVoiceAudio.pause();
        this.currentVoiceAudio.currentTime = 0;
      } catch(e) {}
      this.currentVoiceAudio = null;
    }
    if (this.synth) {
      try { this.synth.cancel(); } catch(e) {}
    }

    if (this.voicePersona === 'commander') {
      this.speak(`Correct value confirmed: ${answerVal}. Tactical advantage secured.`, false);
      return;
    } else if (this.voicePersona === 'sisko') {
      this.speak(`Target confirmed and neutralized: ${answerVal}. Stand firm, crew.`, false);
      return;
    } else if (this.voicePersona === 'bashir') {
      this.speak(`Mathematically brilliant: ${answerVal}. Genetic enhancements would approve.`, false);
      return;
    } else if (this.voicePersona === 'emh') {
      this.speak(`Surgical precision: ${answerVal}. I am a doctor, not an artillery officer!`, false);
      return;
    }

    // LCARS Computer voice
    this.playComputerChirp();
    try {
      const ansNum = parseInt(answerVal, 10);
      const hasValidNum = !isNaN(ansNum) && ansNum >= 0 && ansNum <= 50;

      if (hasValidNum) {
        let prefixAudio = this.audioCache['ans_correct_was'];
        if (!prefixAudio) {
          prefixAudio = new Audio('sounds/ans_correct_was.mp3');
          this.audioCache['ans_correct_was'] = prefixAudio;
        }

        prefixAudio.currentTime = 0;
        prefixAudio.volume = 1.0 * this.getVolumeScale();
        const p = prefixAudio.play();
        if (p !== undefined) {
          p.then(() => {
            this.currentVoiceAudio = prefixAudio;
            prefixAudio.onended = () => {
              try {
                let numAudio = this.audioCache[`num_${ansNum}`];
                if (!numAudio) {
                  numAudio = new Audio(`sounds/num_${ansNum}.mp3`);
                  this.audioCache[`num_${ansNum}`] = numAudio;
                }
                numAudio.currentTime = 0;
                numAudio.volume = 1.0 * this.getVolumeScale();
                numAudio.play().then(() => {
                  this.currentVoiceAudio = numAudio;
                }).catch(() => {});
              } catch(e) {}
            };
          }).catch(() => {
            this.speak(`The correct answer was ${answerVal}.`, false);
          });
        }
      } else {
        this.speak(`The correct answer was ${answerVal}.`, false);
      }
    } catch(e) {
      this.speak(`The correct answer was ${answerVal}.`, false);
    }
  }

  speak(text, playChirp = true) {
    if (this.isMuted || !this.voiceEnabled || !this.synth) return;
    try {
      if (playChirp && this.voicePersona === 'computer') this.playComputerChirp();
      
      // Chromium speech watchdog: un-pause if engine stalled
      if (this.synth.paused) {
        try { this.synth.resume(); } catch(e) {}
      }
      try { this.synth.cancel(); } catch(e) {}

      const utterance = new SpeechSynthesisUtterance(text);
      this.activeUtterance = utterance; // Pin reference to prevent GC drops
      
      const volScale = this.getVolumeScale();
      if (this.voicePersona === 'commander') {
        if (this.commanderVoice) utterance.voice = this.commanderVoice;
        utterance.pitch = 0.96; // Authoritative, firm Starfleet tactical officer
        utterance.rate = 1.05;  // Crisp, smart tactical delivery
        utterance.volume = 0.95 * volScale;
      } else if (this.voicePersona === 'sisko') {
        if (this.siskoVoice) utterance.voice = this.siskoVoice;
        utterance.pitch = 0.78; // Deep, commanding, resonant baritone
        utterance.rate = 0.93;  // Deliberate, rhythmic, dramatic cadence
        utterance.volume = 1.0 * volScale;
      } else if (this.voicePersona === 'bashir') {
        if (this.bashirVoice) utterance.voice = this.bashirVoice;
        utterance.pitch = 1.06; // Cultured British RP, articulate, melodic
        utterance.rate = 1.10;  // Quick, energetic, mathematically brilliant
        utterance.volume = 0.95 * volScale;
      } else if (this.voicePersona === 'emh') {
        if (this.emhVoice) utterance.voice = this.emhVoice;
        utterance.pitch = 1.04; // Crisp, theatrical enunciation
        utterance.rate = 1.03;  // Operatic, pedantic, precise diction
        utterance.volume = 0.98 * volScale;
      } else {
        // LCARS Computer
        if (this.computerVoice) utterance.voice = this.computerVoice;
        utterance.pitch = 1.10; // Resonant Starfleet LCARS mainframe
        utterance.rate = 0.95;  // Measured computer cadence
        utterance.volume = 0.90 * volScale;
      }

      utterance.onend = () => { this.activeUtterance = null; };
      utterance.onerror = () => { this.activeUtterance = null; };

      setTimeout(() => {
        try {
          if (this.synth.paused) this.synth.resume();
          this.synth.speak(utterance);
        } catch(e) {}
      }, 25);
    } catch(e) {}
  }
}