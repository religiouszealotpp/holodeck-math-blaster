var DEBUG_LOGS = (typeof DEBUG_LOGS !== 'undefined') ? DEBUG_LOGS : false;
class HolodeckGame {
  constructor() {
    this.audio = new HolodeckAudio();
    this.container = document.getElementById('canvas-container');
    this.viewport = document.getElementById('app-viewport');

    this.mode = 'velocity';
    this.rank = 'admiral';
    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('holodeck_math_high_score') || '0', 10);
    this.combo = 0;
    this.maxCombo = 0;
    this.level = 1;
    this.warpFactor = 1.0;
    
    this.shieldsLeft = 3;
    this.totalAttempts = 0;
    this.missedProblems = [];
    this.correctHits = 0;
    this.elapsedSeconds = 0;
    this.isPlaying = false;
    this.isPaused = false;
    this.isTransitioning = false;
    this.isVisualizerOpen = true;
    this.showStats = false;
    this.isFirstShotOnProblem = true;
    this.jamCharges = 1;
    this.isJamActive = false;
    this.jamRemainingSeconds = 0;
    this.phaserCharges = 1;
    this.initCosmicSectors();
    this.isWarpJumping = false;

    // FPS Counter tracking
    this.frameCount = 0;
    this.fpsLastTime = performance.now();
    this.currentFps = 60;

    this.waveTotalTime = 50.0;
    this.waveRemainingTime = 50.0;

    this.currentProblem = null;
    this.lastSolvedProblem = null;
    this.targetPanels = [];
    this.photonBalls = [];
    this.particles = [];
    this.shockwaves = [];
    this.impactRipples = [];
    this.impactLights = [];
    this.impactSparks = [];
    this.targetCornerFlares = [];
    this.illuminatedGridLines = [];
    this.photometricLightTex = null;

    // Mathematical Holodeck Grid Line Coordinates (Exact match to 14x8x22 visual texture rungs)
    this.gridLinesX = [];
    for (let i = 0; i <= 14; i++) {
      this.gridLinesX.push(-21.0 + i * (42.0 / 14.0)); // Spacing = 3.0u: [-21.0, -18.0, ... +21.0]
    }
    this.gridLinesY = [];
    for (let i = 0; i <= 8; i++) {
      this.gridLinesY.push(-12.5 + i * (25.0 / 8.0));  // Spacing = 3.125u: [-12.5, -9.375, ... +12.5]
    }
    this.gridLinesZ = [];
    for (let i = 0; i <= 22; i++) {
      this.gridLinesZ.push(10.0 - i * (65.0 / 22.0));  // Spacing = 2.9545u: [+10.0, ... -55.0]
    }

    // Cosmic background objects
    this.cosmicGroup = null;
    this.planetMesh = null;
    this.planetRings = null;
    this.moon1Mesh = null;
    this.moon2Mesh = null;
    this.starParticles = null;

    // Exact Holodeck 3D Geometry Boundaries:
    // Room Dimensions: Width = 42 (X: ±21.0), Height = 25 (Y: ±12.5), Depth = 65 (Z: +10.0 to -55.0)
    // Target Panel Box Extents: Width = 4.4 (half 2.2), Height = 2.9 (half 1.45), Depth = 0.75 (half 0.375)
    this.bounds = {
      minX: -18.8,  // -21.0 + 2.2 -> Left face contacts visual Left Wall at X = -21.0 exactly
      maxX: 18.8,   // +21.0 - 2.2 -> Right face contacts visual Right Wall at X = +21.0 exactly
      minY: -11.05, // -12.5 + 1.45 -> Bottom face contacts visual Floor at Y = -12.5 exactly
      maxY: 11.05,  // +12.5 - 1.45 -> Top face contacts visual Ceiling at Y = +12.5 exactly
      minZ: -54.6,  // -55.0 + 0.375 -> Back face contacts visual Back Wall at Z = -55.0 exactly
      maxZ: -10.0   // Front tactical turnaround boundary within holodeck
    };

    this.hazardTimer = null;

    // Dedicated Sandbox Tuning Matrix Properties (Baseline Defaults)
    this.testTargetCount = 1;
    this.testSpeedMult = 0.50;
    this.testSpinMult = 0.5;
    this.testGlowMult = 0.8;
    this.testTextHighlightMult = 0.5;
    this.testExplosionParticles = 250;
    this.isTestVelocityPaused = false;

    // In-Engine Flight Recorder Properties (H.264 MP4 / 75 FPS)
    this.isVisualizerAnswersHidden = false;
    this.isVisualizerMinimized = false;
    this.isRecording = false;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.recStartTime = null;
    this.recTimerInterval = null;
    this.recSource = 'canvas'; // 'canvas' (3D Engine) or 'tab' (Full LCARS UI)
    this.recTargetFPS = '75';
    this.recPreferredCodec = 'h264';
    this.recBitrate = 16000000;
    this.recAudioEnabled = true;
    this.detectedDisplayHz = 75;
    this.lastRecordedBlobUrl = null;
    this.lastRecordedFilename = null;
    this.activeRecordingMime = 'video/mp4;codecs=avc1';
    this.activeRecordingFPS = 75;
    this.activeRecordingRes = '1920x1080';

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.phaserMesh = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2(0, 0);

    this.initDOMCache();
    this.initInteractionLogger();
    this.initThree();
    this.bindEvents();
    this.initTooltips();
    this.detectDisplayRefreshRate();
    this.updateHighScoreDisplay();
    this.setRicochetSoundProfile('tachyon_deflect', true);
    this.syncAudioUI();
    this.adjustRightDockLayout();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  adjustRightDockLayout() {
    const vis = document.getElementById('lcars-visualizer-panel');
    const shield = document.getElementById('voyager-shield-panel');
    const isVisVisible = vis && !vis.classList.contains('hidden');
    const visH = isVisVisible ? vis.offsetHeight : 0;
    const shieldH = shield ? shield.offsetHeight : 0;
    const windowH = window.innerHeight;

    if (DEBUG_LOGS) console.log(`[LCARS Telemetry] Layout: Window H=${windowH}px | Visualizer H=${visH}px | Shield Dock H=${shieldH}px | Overlap: 0px.`);
  }

  updateHighScoreDisplay() {
    const el = document.getElementById('hud-highscore');
    if (el) el.innerText = String(this.highScore).padStart(4, '0');
    const startEl = document.getElementById('start-highscore');
    if (startEl) startEl.innerText = String(this.highScore).padStart(4, '0');
    const goEl = document.getElementById('go-highscore');
    if (goEl) goEl.innerText = String(this.highScore);
  }

  calculateWaveTimeLimit(lvl) {
    return Math.max(18.0, 50.0 - (lvl - 1) * 2.8);
  }


  initDOMCache() {
    this.dom = {
      statsFps: document.getElementById('stats-fps'),
      statsTargets: document.getElementById('stats-targets'),
      statsParticles: document.getElementById('stats-particles'),
      statsWarp: document.getElementById('stats-warp'),
      waveTimerFill: document.getElementById('wave-timer-fill'),
      waveTimerVal: document.getElementById('wave-timer-val'),
      temporalJamFx: document.getElementById('temporal-jam-fx'),
      jamChargeBadge: document.getElementById('jam-charge-badge'),
      redAlertFlash: document.getElementById('red-alert-flash'),
      hudScore: document.getElementById('hud-score'),
      hudLevel: document.getElementById('hud-level'),
      hudMultiplier: document.getElementById('hud-multiplier'),
      hudCombo: document.getElementById('hud-combo'),
      hudStreak: document.getElementById('hud-streak'),
      hudShields: document.getElementById('hud-shields'),
      hudHighscore: document.getElementById('hud-highscore'),
      hudSector: document.getElementById('hud-sector'),
      hudWarp: document.getElementById('hud-warp'),
      hudProblemText: document.getElementById('hud-problem-text'),
      bannerContainer: document.getElementById('banner-container'),
      activeBanner: document.getElementById('active-banner'),
      viewport: document.getElementById('holodeck-viewport'),
      crosshair: document.getElementById('reticle-crosshair'),
      ttTitle: document.getElementById('tt-title'),
      ttClass: document.getElementById('tt-class'),
      ttBody: document.getElementById('tt-body'),
      ttNote: document.getElementById('tt-note')
    };
  }

  initInteractionLogger() {
    if (typeof window === 'undefined') return;
    window.lcarsBlackBox = window.lcarsBlackBox || [];
    window.ENABLE_INTERACTION_LOGS = (typeof window.ENABLE_INTERACTION_LOGS !== 'undefined') ? window.ENABLE_INTERACTION_LOGS : true;

    this.logInteraction = (type, detail) => {
      const timestamp = (typeof performance !== 'undefined' && performance.now) 
        ? (performance.now() / 1000).toFixed(3)
        : '0.000';
      const entry = { time: timestamp, type, detail };
      window.lcarsBlackBox.push(entry);
      if (window.lcarsBlackBox.length > 100) window.lcarsBlackBox.shift();
      if (window.ENABLE_INTERACTION_LOGS || DEBUG_LOGS) {
        console.log(`[LCARS Black Box] [${timestamp}s] ${type.toUpperCase()} -> ${detail}`);
      }
    };

    window.getInteractionLog = () => {
      if (console && console.table) console.table(window.lcarsBlackBox);
      return window.lcarsBlackBox;
    };

    // Global click and tap logger
    window.addEventListener('click', (e) => {
      const target = e.target;
      if (!target) return;
      const el = target.closest('button, .clcars-ammo-pill, .lcars-dropdown-item, .hud-sector-block, .vis-close-btn, .modal-backdrop');
      if (el) {
        const id = el.id ? `#${el.id}` : (el.className ? `.${el.className.split(' ')[0]}` : el.tagName);
        const text = (el.innerText || '').trim().replace(/\s+/g, ' ').substring(0, 28);
        this.logInteraction('click', `${id} ("${text}")`);
      }
    }, { capture: true });

    // Global keydown logger
    window.addEventListener('keydown', (e) => {
      this.logInteraction('keydown', `Key '${e.key}' (code: ${e.code || e.key})`);
    }, { capture: true });
  }

  triggerHaptic(type = 'tap') {
    if (typeof navigator === 'undefined' || !navigator.vibrate) return;
    try {
      if (type === 'tap') {
        navigator.vibrate(15); // Crisp 15ms micro-pulse on ammo tap
      } else if (type === 'shield_breach') {
        navigator.vibrate([40, 20, 40]); // Heavy 40ms-20ms-40ms double rumble on shield breach
      } else if (type === 'phaser') {
        navigator.vibrate(60); // Sharp 60ms kick on phaser discharge
      } else if (type === 'jam') {
        navigator.vibrate([20, 30, 20]); // Spacetime distortion pulse
      } else if (type === 'success') {
        navigator.vibrate(25); // Crisp victory confirm
      }
    } catch(e) {}
  }

  disposeObject(obj) {
    if (!obj) return;
    if (obj.children && obj.children.length > 0) {
      for (let i = obj.children.length - 1; i >= 0; i--) {
        const child = obj.children[i];
        obj.remove(child);
        this.disposeObject(child);
      }
    }
    if (obj.geometry && typeof obj.geometry.dispose === 'function') {
      if (!obj.geometry.isShared) obj.geometry.dispose();
    }
    if (obj.material) {
      if (Array.isArray(obj.material)) {
        obj.material.forEach(m => this.disposeMaterial(m));
      } else {
        this.disposeMaterial(obj.material);
      }
    }
  }

  disposeMaterial(mat) {
    if (!mat) return;
    if (mat.isShared) return;
    if (mat.map && typeof mat.map.dispose === 'function') {
      if (!mat.map.isPersistent) mat.map.dispose();
    }
    if (mat.emissiveMap && typeof mat.emissiveMap.dispose === 'function') {
      if (!mat.emissiveMap.isPersistent) mat.emissiveMap.dispose();
    }
    if (mat.specularMap && typeof mat.specularMap.dispose === 'function') {
      if (!mat.specularMap.isPersistent) mat.specularMap.dispose();
    }
    if (mat.roughnessMap && typeof mat.roughnessMap.dispose === 'function') {
      if (!mat.roughnessMap.isPersistent) mat.roughnessMap.dispose();
    }
    if (typeof mat.dispose === 'function') mat.dispose();
  }

  disposeGroup(group) {
    if (!group) return;
    while (group.children && group.children.length > 0) {
      const child = group.children[0];
      this.disposeGroup(child);
      group.remove(child);
      this.disposeObject(child);
    }
    this.disposeObject(group);
  }

  initThree() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x02040a, 0.007);

    this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 0, 10);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.0));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.container.appendChild(this.renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0x182436, 0.40);
    this.scene.add(ambientLight);

    this.pointLight = new THREE.PointLight(0xffaa00, 1.2, 50);
    this.pointLight.position.set(0, 6, 6);
    this.scene.add(this.pointLight);

    this.buildHolodeckRoom();
    this.buildCosmicBackground();
    this.buildPhaserCannon();
    this.buildCockpitShield();

    // High-Performance Shared Geometries & Material Cache (Zero allocations during bounces)
    this.sharedPlaneGeo = (typeof THREE.PlaneGeometry === 'function') ? new THREE.PlaneGeometry(1.0, 1.0) : null;
    if (this.sharedPlaneGeo) this.sharedPlaneGeo.isShared = true;
    this.sharedDiamondGeo = (typeof THREE.PlaneGeometry === 'function') ? new THREE.PlaneGeometry(0.32, 0.32) : null;
    if (this.sharedDiamondGeo) this.sharedDiamondGeo.isShared = true;
    this.sharedSparkGeo = (typeof THREE.SphereGeometry === 'function') ? new THREE.SphereGeometry(0.12, 6, 6) : null;
    if (this.sharedSparkGeo) this.sharedSparkGeo.isShared = true;
    this.sharedShardGeo = (typeof THREE.TetrahedronGeometry === 'function') ? new THREE.TetrahedronGeometry(0.38, 0) : (this.sharedDiamondGeo || new THREE.BoxGeometry(0.35, 0.35, 0.35));
    if (this.sharedShardGeo) this.sharedShardGeo.isShared = true;
    this.sharedVertexGeo = (typeof THREE.SphereGeometry === 'function') ? new THREE.SphereGeometry(0.24, 8, 8) : null;
    if (this.sharedVertexGeo) this.sharedVertexGeo.isShared = true;
    this.sharedCoronaGeo = (typeof THREE.SphereGeometry === 'function') ? new THREE.SphereGeometry(0.48, 8, 8) : null;
    if (this.sharedCoronaGeo) this.sharedCoronaGeo.isShared = true;
    this.sharedTargetBoxGeo = (typeof THREE.BoxGeometry === 'function') ? new THREE.BoxGeometry(4.4, 2.9, 0.75) : null;
    if (this.sharedTargetBoxGeo) this.sharedTargetBoxGeo.isShared = true;
    this.sharedPraxisRingGeo = (typeof THREE.RingGeometry === 'function') ? new THREE.RingGeometry(0.8, 2.2, 48) : null;
    if (this.sharedPraxisRingGeo) this.sharedPraxisRingGeo.isShared = true;

    this.sharedWhiteAdditiveMat = (typeof THREE.MeshBasicMaterial === 'function') ? new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1.0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    }) : null;
    if (this.sharedWhiteAdditiveMat) this.sharedWhiteAdditiveMat.isShared = true;
    this.pulseMatCache = new Map();

    this.initNumeralGeos();
    this.initTargetCanvasPool();

    // High-Performance Reusable PointLight Pool (Pre-attached to scene to prevent dynamic shader recompilation)
    this.impactLightPool = [];
    this.impactLightNextIdx = 0;
    for (let i = 0; i < 4; i++) {
      const pLight = (typeof THREE.PointLight === 'function')
        ? new THREE.PointLight(0x0088ff, 0, 16.0, 1.5)
        : null;
      if (pLight) {
        pLight.position.set(0, 0, -20);
        this.scene.add(pLight);
        this.impactLightPool.push({
          light: pLight,
          life: 0,
          decay: 0.065
        });
      }
    }

    // High-Performance Reusable Spark Particle Pool (24 pre-allocated meshes)
    this.sparkPool = [];
    this.sparkNextIdx = 0;
    if (this.sharedSparkGeo && typeof THREE.Mesh === 'function' && typeof THREE.MeshBasicMaterial === 'function') {
      for (let i = 0; i < 24; i++) {
        const spkMesh = new THREE.Mesh(
          this.sharedSparkGeo,
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 })
        );
        spkMesh.visible = false;
        this.scene.add(spkMesh);
        this.sparkPool.push({
          mesh: spkMesh,
          velocity: new THREE.Vector3(),
          life: 0,
          decay: 0.045
        });
      }
    }

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.0));
      this.adjustRightDockLayout();
      this.checkTargetCanvasPoolResolution();
    });
  }

  getTargetResolutionTier() {
    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    const screenW = typeof window !== 'undefined' ? (window.screen ? window.screen.width : window.innerWidth) : 1920;
    const screenH = typeof window !== 'undefined' ? (window.screen ? window.screen.height : window.innerHeight) : 1080;
    const physicalW = screenW * dpr;
    const physicalH = screenH * dpr;
    const isMobile = (typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent))
                  || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1 && window.innerWidth < 1024);

    if (isMobile) {
      return { width: 512, height: 320, tier: 'MOBILE_LEAN' };
    } else if (physicalW >= 3440 || (physicalW >= 2560 && physicalH >= 1440 && dpr >= 1.5)) {
      return { width: 1024, height: 640, tier: '4K_ULTRA_CRISP' };
    } else {
      return { width: 768, height: 480, tier: 'DESKTOP_BALANCED' };
    }
  }

  initTargetCanvasPool() {
    if (this.targetCanvasPool && this.targetCanvasPool.length === 4) return;
    const res = this.getTargetResolutionTier();
    this.currentCanvasTier = res.tier;
    this.targetCanvasPool = [];
    this.targetTexturePool = [];

    for (let i = 0; i < 4; i++) {
      const c = document.createElement('canvas');
      c.width = res.width;
      c.height = res.height;
      const tex = (typeof THREE.CanvasTexture === 'function') ? new THREE.CanvasTexture(c) : null;
      if (tex) {
        tex.isPersistent = true;
        tex.generateMipmaps = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        if (this.renderer && this.renderer.capabilities) {
          tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        }
      }
      this.targetCanvasPool.push(c);
      this.targetTexturePool.push(tex);
    }
  }

  checkTargetCanvasPoolResolution() {
    const res = this.getTargetResolutionTier();
    if (res.tier !== this.currentCanvasTier && this.targetCanvasPool) {
      this.currentCanvasTier = res.tier;
      this.targetCanvasPool.forEach((c, idx) => {
        c.width = res.width;
        c.height = res.height;
        if (this.targetTexturePool && this.targetTexturePool[idx]) {
          this.targetTexturePool[idx].needsUpdate = true;
        }
      });
    }
  }

  initNumeralGeos() {
    if (this.numeralGeos) return;
    if (typeof THREE.BoxGeometry !== 'function') return;

    this.numeralGeos = {
      H_SEG: new THREE.BoxGeometry(0.58, 0.15, 0.06),
      V_SEG: new THREE.BoxGeometry(0.15, 0.50, 0.06),
      D_SEG: new THREE.BoxGeometry(0.15, 0.15, 0.06),
      MINUS_SEG: new THREE.BoxGeometry(0.46, 0.15, 0.06),
      SIX_UNDERLINE: new THREE.BoxGeometry(0.72, 0.09, 0.05)
    };

    this.numeralEdgeGeos = {};
    for (const [key, geo] of Object.entries(this.numeralGeos)) {
      geo.isShared = true;
      if (typeof THREE.EdgesGeometry === 'function') {
        const edgeGeo = new THREE.EdgesGeometry(geo);
        edgeGeo.isShared = true;
        this.numeralEdgeGeos[key] = edgeGeo;
      }
    }
  }

  getPulseMaterial(colorHex) {
    if (!this.pulseMatCache) this.pulseMatCache = new Map();
    if (!this.pulseMatCache.has(colorHex)) {
      if (typeof THREE.MeshBasicMaterial === 'function') {
        const mat = new THREE.MeshBasicMaterial({
          color: colorHex,
          transparent: true,
          opacity: 1.0,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending
        });
        this.pulseMatCache.set(colorHex, mat);
      }
    }
    return this.pulseMatCache.get(colorHex);
  }


  // =========================================================================
  // STAR TREK PROCEDURAL STARSHIP FLEET ENGINE (10 MODELS)
  // =========================================================================
  initFleetEngine() {
    if (!this.fleetGroup) {
      this.fleetGroup = new THREE.Group();
      if (this.cosmicGroup) {
        this.cosmicGroup.add(this.fleetGroup);
      } else {
        this.scene.add(this.fleetGroup);
      }
    }
    this.activeShipId = 'enterprise_d';
    this.activeShipMesh = null;
    this.shipPosMode = 'flank'; // 'flank', 'background', 'flyby', 'inspect'
    this.isFleetVisible = true;
    this.spawnStarship(this.activeShipId);
  }

  buildStarship(shipId) {
    const group = new THREE.Group();
    if (!group.scale || typeof group.scale.set !== 'function') {
      group.scale = { x: 1, y: 1, z: 1, set(x, y, z) { this.x = x; this.y = y; this.z = z; }, clone() { return { x: this.x, y: this.y, z: this.z }; }, copy(s) { this.x = s.x; this.y = s.y; this.z = s.z; } };
    }

    const setScale = (mesh, x, y, z) => {
      if (!mesh) return;
      if (!mesh.scale || typeof mesh.scale.set !== 'function') {
        mesh.scale = { x: 1, y: 1, z: 1, set(sx, sy, sz) { this.x = sx; this.y = sy; this.z = sz; } };
      }
      mesh.scale.set(x, y, z);
    };

    const createLight = (color, intensity, distance = 30) => {
      if (typeof THREE.PointLight === 'function') {
        const light = new THREE.PointLight(color, intensity, distance);
        light.userData = { baseIntensity: intensity };
        return light;
      }
      return { 
        position: { set() {} }, 
        userData: { baseIntensity: intensity }, 
        color: { setHex() {} } 
      };
    };

    group.userData = {
      shipId: shipId,
      glowMeshes: [],
      shipLights: [],
      baseY: 0,
      baseX: 0,
      rotY: 0
    };

    // Shared Palette Materials with Enhanced Emissive Ambient Lighting
    const MaterialConstructor = THREE.MeshStandardMaterial || THREE.MeshBasicMaterial;
    const hullMatFed = new MaterialConstructor({ 
      color: 0xe0ecf4, 
      roughness: 0.35, 
      metalness: 0.3,
      emissive: 0x142028,
      emissiveIntensity: 0.65
    });
    const hullMatFedDark = new MaterialConstructor({ 
      color: 0x90a8be, 
      roughness: 0.4, 
      metalness: 0.35,
      emissive: 0x0e1620,
      emissiveIntensity: 0.6
    });
    const hullMatKlingon = new MaterialConstructor({ 
      color: 0x2d462d, 
      roughness: 0.45, 
      metalness: 0.4,
      emissive: 0x0c200c,
      emissiveIntensity: 0.75
    });
    const hullMatRomulan = new MaterialConstructor({ 
      color: 0x1d5236, 
      roughness: 0.35, 
      metalness: 0.45,
      emissive: 0x0a2816,
      emissiveIntensity: 0.8
    });
    const hullMatBorg = new MaterialConstructor({ 
      color: 0x1a2228, 
      roughness: 0.25, 
      metalness: 0.7,
      emissive: 0x061e0e,
      emissiveIntensity: 0.95
    });
    const hullMatCardassian = new MaterialConstructor({ 
      color: 0xa88544, 
      roughness: 0.4, 
      metalness: 0.35,
      emissive: 0x221808,
      emissiveIntensity: 0.65
    });

    const glowRed = new THREE.MeshBasicMaterial({ color: 0xff1122 });
    const glowBlue = new THREE.MeshBasicMaterial({ color: 0x00c4ff });
    const glowCyan = new THREE.MeshBasicMaterial({ color: 0x00f5ff });
    const glowAmber = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    const glowGreen = new THREE.MeshBasicMaterial({ color: 0x00ff55 });
    const glowYellow = new THREE.MeshBasicMaterial({ color: 0xffea00 });
    const glowWhite = new THREE.MeshBasicMaterial({ color: 0xfffae0 });

    if (shipId === 'enterprise_d') {
      // 1. USS Enterprise NCC-1701-D (Galaxy-Class Flagship)
      // Primary Saucer
      const saucerGeo = new THREE.CylinderGeometry(4.4, 4.0, 0.45, 32);
      const saucer = new THREE.Mesh(saucerGeo, hullMatFed);
      setScale(saucer, 1.2, 1.0, 1.0); // Galaxy-class elliptical saucer
      saucer.position.set(0, 0.5, 2.2);
      group.add(saucer);

      // Saucer Observation Lounge / Window Stripe (Glowing warm white)
      const winRing = new THREE.Mesh(new THREE.CylinderGeometry(4.1, 4.1, 0.1, 24), glowWhite);
      winRing.position.set(0, 0.5, 2.2);
      setScale(winRing, 1.18, 1.0, 0.98);
      group.add(winRing);
      group.userData.glowMeshes.push(winRing);

      // Bridge Dome
      const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 0.2, 16), hullMatFedDark);
      bridge.position.set(0, 0.8, 2.2);
      group.add(bridge);

      // Connecting Neck
      const neck = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 1.6), hullMatFedDark);
      neck.position.set(0, 0.0, 0.8);
      neck.rotation.x = 0.2;
      group.add(neck);

      // Secondary Stardrive Hull
      const engHull = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.45, 3.4, 16), hullMatFed);
      engHull.rotation.x = Math.PI / 2;
      engHull.position.set(0, -0.6, -0.6);
      group.add(engHull);

      // Navigational Deflector (Glowing Gold/Amber Emitter)
      const deflector = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), glowAmber);
      deflector.rotation.x = -Math.PI / 2;
      deflector.position.set(0, -0.6, 1.1);
      group.add(deflector);
      group.userData.glowMeshes.push(deflector);

      // Deflector Point Light (Forward Amber Radiance)
      const deflLight = createLight(0xffaa00, 2.4, 22);
      deflLight.position.set(0, -0.6, 1.4);
      group.add(deflLight);
      group.userData.shipLights.push(deflLight);

      // Saucer Impulse Engine (Ruby Glow on Trailing Saucer Edge)
      const impulse = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.16, 0.3), glowRed);
      impulse.position.set(0, 0.5, 0.3);
      group.add(impulse);
      group.userData.glowMeshes.push(impulse);

      // Warp Pylons & Nacelles (Red Bussards & Cobalt-Blue Warp Coils)
      [-2.6, 2.6].forEach(xSign => {
        const pylon = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.15, 0.6), hullMatFedDark);
        pylon.position.set(xSign * 0.5, 0.2, -1.0);
        pylon.rotation.z = (xSign > 0 ? -0.45 : 0.45);
        group.add(pylon);

        const nacelle = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 3.2), hullMatFed);
        nacelle.position.set(xSign, 0.7, -1.4);
        group.add(nacelle);

        // Bussard Ramscoop (Ruby Red Glow)
        const bussard = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), glowRed);
        bussard.position.set(xSign, 0.7, 0.2);
        group.add(bussard);
        group.userData.glowMeshes.push(bussard);

        // Warp Grille (Vibrant Cobalt Blue Plasma Glow)
        const grille = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.24, 2.1), glowBlue);
        grille.position.set(xSign > 0 ? xSign - 0.24 : xSign + 0.24, 0.7, -1.4);
        group.add(grille);
        group.userData.glowMeshes.push(grille);
      });

      // Nacelle Field Point Light (Blue/Cyan Plasma Radiance)
      const nacelleLight = createLight(0x00d4ff, 2.8, 28);
      nacelleLight.position.set(0, 0.8, -1.4);
      group.add(nacelleLight);
      group.userData.shipLights.push(nacelleLight);

    } else if (shipId === 'voyager') {
      // 2. USS Voyager NCC-74656 (Intrepid-Class)
      // Streamlined Arrowhead Saucer
      const saucerGeo = new THREE.CylinderGeometry(2.4, 3.2, 0.4, 5);
      const saucer = new THREE.Mesh(saucerGeo, hullMatFed);
      setScale(saucer, 0.8, 1.0, 1.6);
      saucer.position.set(0, 0.2, 1.8);
      group.add(saucer);

      // Compact Secondary Hull
      const engHull = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 2.8), hullMatFed);
      engHull.position.set(0, -0.3, -0.4);
      group.add(engHull);

      // Aero Nav Deflector (Cyan/Teal Glow)
      const defl = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 12), glowCyan);
      defl.position.set(0, -0.3, 1.0);
      group.add(defl);
      group.userData.glowMeshes.push(defl);

      const deflLight = createLight(0x00f0ff, 2.5, 20);
      deflLight.position.set(0, -0.3, 1.3);
      group.add(deflLight);
      group.userData.shipLights.push(deflLight);

      // Impulse Thruster (Aft Red Manifold)
      const impulse = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.15, 0.2), glowRed);
      impulse.position.set(0, 0.1, -0.6);
      group.add(impulse);
      group.userData.glowMeshes.push(impulse);

      // Articulated Upward Warp Nacelles (Ruby Bussards & Cyan Grilles)
      [-1.8, 1.8].forEach(xSign => {
        const pylon = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.12, 0.5), hullMatFedDark);
        pylon.position.set(xSign * 0.5, 0.1, -1.2);
        pylon.rotation.z = (xSign > 0 ? 0.35 : -0.35);
        group.add(pylon);

        const nacelle = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 2.4), hullMatFed);
        nacelle.position.set(xSign, 0.5, -1.4);
        group.add(nacelle);

        const bussard = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), glowRed);
        bussard.position.set(xSign, 0.5, -0.2);
        group.add(bussard);
        group.userData.glowMeshes.push(bussard);

        const grille = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 1.7), glowCyan);
        grille.position.set(xSign > 0 ? xSign - 0.18 : xSign + 0.18, 0.5, -1.4);
        group.add(grille);
        group.userData.glowMeshes.push(grille);
      });

      const nacLight = createLight(0x00f0ff, 2.6, 26);
      nacLight.position.set(0, 0.6, -1.4);
      group.add(nacLight);
      group.userData.shipLights.push(nacLight);

    } else if (shipId === 'defiant') {
      // 3. USS Defiant NX-74205 (Armored Tactical Escort)
      // Primary Armored Elliptical Hull (No blocky square faces)
      const hullGeo = new THREE.CylinderGeometry(1.8, 2.3, 0.45, 24);
      const mainHull = new THREE.Mesh(hullGeo, hullMatFedDark);
      setScale(mainHull, 0.85, 1.0, 1.3);
      mainHull.position.set(0, 0, 0.1);
      group.add(mainHull);

      // Smooth Rounded Armored Forward Nose (Tapered dome, completely seamless)
      const noseGeo = new THREE.SphereGeometry(1.35, 16, 16);
      const nose = new THREE.Mesh(noseGeo, hullMatFed);
      setScale(nose, 0.8, 0.32, 1.3);
      nose.position.set(0, 0, 1.3);
      group.add(nose);

      // Bridge Module (Low-profile circular command dome)
      const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 0.14, 16), hullMatFed);
      bridge.position.set(0, 0.26, 0.3);
      group.add(bridge);

      // Forward Nav Deflector & Torpedo Emitter (Recessed Amber Notch)
      const defl = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), glowAmber);
      defl.position.set(0, 0, 2.7);
      group.add(defl);
      group.userData.glowMeshes.push(defl);

      // Forward Amber Torpedo Point Light
      const defLight = createLight(0xffaa00, 2.6, 22);
      defLight.position.set(0, 0, 2.8);
      group.add(defLight);
      group.userData.shipLights.push(defLight);

      // Aft Sublight Impulse Exhaust (Ruby Glow at Stern)
      const impulse = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.14, 0.2), glowRed);
      impulse.position.set(0, 0.05, -1.4);
      group.add(impulse);
      group.userData.glowMeshes.push(impulse);

      // Integrated Flank Warp Nacelle Cowlings & Quad Pulse Phaser Cannons
      [-1.35, 1.35].forEach(xSign => {
        // Nacelle Armored Sponson Pod
        const pod = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.42, 2.5), hullMatFed);
        pod.position.set(xSign, 0, -0.15);
        group.add(pod);

        // Cyan Warp Field Vent (Lateral plasma coil)
        const vent = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 1.7), glowCyan);
        vent.position.set(xSign > 0 ? xSign + 0.26 : xSign - 0.26, 0, -0.15);
        group.add(vent);
        group.userData.glowMeshes.push(vent);

        // Forward Bussard Intake (Ruby Cap)
        const bussard = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), glowRed);
        bussard.position.set(xSign, 0, 1.1);
        group.add(bussard);
        group.userData.glowMeshes.push(bussard);

        // Quad Heavy Pulse Phaser Cannons (Dual Barrels protruding forward)
        const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.8, 8), hullMatFedDark);
        cannon.rotation.x = Math.PI / 2;
        cannon.position.set(xSign * 0.65, 0, 1.5);
        group.add(cannon);

        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), glowAmber);
        tip.position.set(xSign * 0.65, 0, 1.9);
        group.add(tip);
        group.userData.glowMeshes.push(tip);
      });

    } else if (shipId === 'klingon_bop') {
      // 4. Klingon Bird-of-Prey (B'rel Class - Flat Raptor Command Head)
      // Main Raptor Command Bridge (Beveled flat armor)
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.32, 1.4), hullMatKlingon);
      head.position.set(0, 0.18, 1.8);
      group.add(head);

      // Forward Armored Raptor Prow / Beak
      const beak = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.22, 0.9), hullMatKlingon);
      beak.position.set(0, 0.14, 2.5);
      group.add(beak);

      // Forward Tapered Nose Tip
      const noseTip = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.5), hullMatKlingon);
      noseTip.position.set(0, 0.12, 3.0);
      group.add(noseTip);

      // Piercing Red Sensor Cockpit Visor
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.12), glowRed);
      visor.position.set(0, 0.16, 2.85);
      group.add(visor);
      group.userData.glowMeshes.push(visor);

      // Narrow Spine Neck
      const spine = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.24, 1.8), hullMatKlingon);
      spine.position.set(0, 0.14, 0.9);
      group.add(spine);

      // Main Engineering Engine Block
      const engine = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.65, 1.6), hullMatKlingon);
      engine.position.set(0, 0, -0.2);
      group.add(engine);

      // Glowing Green Impulse Manifold
      const imp = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.15), glowGreen);
      imp.position.set(0, 0, -1.0);
      group.add(imp);
      group.userData.glowMeshes.push(imp);

      // Downward Swept Wings & Wingtip Disruptor Cannons
      [-2.6, 2.6].forEach(xSign => {
        const wing = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 1.6), hullMatKlingon);
        wing.position.set(xSign * 0.6, -0.4, -0.2);
        wing.rotation.z = (xSign > 0 ? 0.35 : -0.35);
        group.add(wing);

        // Wingtip Disruptor Cannon (High-Intensity Green Glow)
        const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 1.4, 8), hullMatKlingon);
        cannon.rotation.x = Math.PI / 2;
        cannon.position.set(xSign * 1.1, -0.8, 0.3);
        group.add(cannon);

        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), glowGreen);
        tip.position.set(xSign * 1.1, -0.8, 1.0);
        group.add(tip);
        group.userData.glowMeshes.push(tip);

        const tipLight = createLight(0x00ff55, 2.8, 22);
        tipLight.position.set(xSign * 1.1, -0.8, 1.1);
        group.add(tipLight);
        group.userData.shipLights.push(tipLight);
      });

    } else if (shipId === 'klingon_d7') {
      // 5. Klingon D7 / K't'inga Battlecruiser
      // Forward Command Bulb
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.85, 16, 16), hullMatKlingon);
      setScale(bulb, 1.2, 0.7, 1.0);
      bulb.position.set(0, 0, 3.0);
      group.add(bulb);

      // Forward Torpedo Disruptor Port (Crimson Glow)
      const torp = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), glowRed);
      torp.position.set(0, 0, 3.8);
      group.add(torp);
      group.userData.glowMeshes.push(torp);

      const torpLight = createLight(0xff2222, 2.5, 20);
      torpLight.position.set(0, 0, 4.0);
      group.add(torpLight);
      group.userData.shipLights.push(torpLight);

      // Long Slender Boom Neck
      const neck = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.28, 3.2), hullMatKlingon);
      neck.position.set(0, 0, 1.2);
      group.add(neck);

      // Main Engineering Core Block (Clean swept delta body, NO giant triangle plane)
      const engCore = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 2.2), hullMatKlingon);
      engCore.position.set(0, 0, -0.8);
      group.add(engCore);

      // Dorsal Command Spine
      const spine = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.28, 1.6), hullMatKlingon);
      spine.position.set(0, 0.35, -0.8);
      group.add(spine);

      // Aft Impulse Manifold (Ruby Glow)
      const impulse = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.16, 0.15), glowRed);
      impulse.position.set(0, 0.1, -1.9);
      group.add(impulse);
      group.userData.glowMeshes.push(impulse);

      // Swept Wing Shoulders
      [-1.2, 1.2].forEach(xSign => {
        const shoulder = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.3, 1.8), hullMatKlingon);
        shoulder.position.set(xSign * 0.85, -0.05, -0.9);
        shoulder.rotation.y = (xSign > 0 ? -0.28 : 0.28);
        group.add(shoulder);
      });

      // Underslung Nacelles with Emerald Green Plasma Coils
      [-1.8, 1.8].forEach(xSign => {
        const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 0.4), hullMatKlingon);
        pylon.position.set(xSign * 0.6, -0.4, -1.0);
        pylon.rotation.z = (xSign > 0 ? 0.4 : -0.4);
        group.add(pylon);

        const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 2.6, 10), hullMatKlingon);
        nacelle.rotation.x = Math.PI / 2;
        nacelle.position.set(xSign, -0.7, -1.2);
        group.add(nacelle);

        const glow = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), glowGreen);
        glow.position.set(xSign, -0.7, 0.1);
        group.add(glow);
        group.userData.glowMeshes.push(glow);
      });

      const d7Light = createLight(0x00ff55, 2.6, 25);
      d7Light.position.set(0, -0.7, -1.0);
      group.add(d7Light);
      group.userData.shipLights.push(d7Light);

    } else if (shipId === 'romulan_warbird') {
      // 6. Romulan D'deridex Warbird (Hollow Double Crescent)
      // Upper Wing Arch
      const upperWing = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.35, 8, 24, Math.PI), hullMatRomulan);
      upperWing.rotation.x = Math.PI / 2;
      upperWing.rotation.z = -Math.PI / 2;
      upperWing.position.set(0, 1.1, 0);
      setScale(upperWing, 0.65, 1.0, 0.8);
      group.add(upperWing);

      // Lower Wing Arch
      const lowerWing = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.35, 8, 24, Math.PI), hullMatRomulan);
      lowerWing.rotation.x = -Math.PI / 2;
      lowerWing.rotation.z = -Math.PI / 2;
      lowerWing.position.set(0, -1.1, 0);
      setScale(lowerWing, 0.65, 1.0, 0.8);
      group.add(lowerWing);

      // Forward Raptor Command Beak (Flat layered raptor armor)
      const beak = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.45, 2.2), hullMatRomulan);
      beak.position.set(0, 0, 2.5);
      group.add(beak);

      const beakTip = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.28, 1.0), hullMatRomulan);
      beakTip.position.set(0, 0, 3.5);
      group.add(beakTip);

      // Pulsing Green Quantum Singularity Core (Inside Void)
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 16), glowGreen);
      core.position.set(0, 0, -0.5);
      group.add(core);
      group.userData.glowMeshes.push(core);

      // Powerful Singularity Point Light Illuminating Inner Hollow Void
      const singLight = createLight(0x00ff66, 3.8, 32);
      singLight.position.set(0, 0, -0.5);
      group.add(singLight);
      group.userData.shipLights.push(singLight);

      // Twin Side Engine Nacelles
      [-2.4, 2.4].forEach(xSign => {
        const pod = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 3.4), hullMatRomulan);
        pod.position.set(xSign, 0, -0.4);
        group.add(pod);

        const glow = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.32, 2.5), glowGreen);
        glow.position.set(xSign > 0 ? xSign - 0.24 : xSign + 0.24, 0, -0.4);
        group.add(glow);
        group.userData.glowMeshes.push(glow);
      });

    } else if (shipId === 'romulan_bird_of_prey') {
      // 7. Romulan Bird-of-Prey / Valdore
      const mainWing = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.18, 2.4), hullMatRomulan);
      mainWing.position.set(0, 0, 0);
      group.add(mainWing);

      const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 0.4, 8), hullMatRomulan);
      bridge.position.set(0, 0.2, 0.6);
      group.add(bridge);

      // Green Plasma Torpedo Bow Launcher
      const torp = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 12), glowGreen);
      torp.position.set(0, 0.05, 1.4);
      group.add(torp);
      group.userData.glowMeshes.push(torp);

      const torpLight = createLight(0x00ff88, 3.2, 24);
      torpLight.position.set(0, 0.05, 1.6);
      group.add(torpLight);
      group.userData.shipLights.push(torpLight);

      // Trailing Warp Vents
      [-2.0, 2.0].forEach(xSign => {
        const vent = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.8), glowGreen);
        vent.position.set(xSign, 0, -1.0);
        group.add(vent);
        group.userData.glowMeshes.push(vent);
      });

    } else if (shipId === 'borg_cube') {
      // 8. Borg Tactical Cube (Monolithic Cybernetic Entity)
      const cubeGeo = new THREE.BoxGeometry(3.6, 3.6, 3.6);
      const cube = new THREE.Mesh(cubeGeo, hullMatBorg);
      group.add(cube);

      // Glowing Cybernetic Perimeter Edge Conduits (Clean 12 edges, NO diagonal lines on faces)
      const s = 1.81;
      const edgeBeams = [
        // 4 edges along X-axis
        { size: [3.68, 0.08, 0.08], pos: [0, s, s] },
        { size: [3.68, 0.08, 0.08], pos: [0, -s, s] },
        { size: [3.68, 0.08, 0.08], pos: [0, s, -s] },
        { size: [3.68, 0.08, 0.08], pos: [0, -s, -s] },
        // 4 edges along Y-axis
        { size: [0.08, 3.68, 0.08], pos: [s, 0, s] },
        { size: [0.08, 3.68, 0.08], pos: [-s, 0, s] },
        { size: [0.08, 3.68, 0.08], pos: [s, 0, -s] },
        { size: [0.08, 3.68, 0.08], pos: [-s, 0, -s] },
        // 4 edges along Z-axis
        { size: [0.08, 0.08, 3.68], pos: [s, s, 0] },
        { size: [0.08, 0.08, 3.68], pos: [-s, s, 0] },
        { size: [0.08, 0.08, 3.68], pos: [s, -s, 0] },
        { size: [0.08, 0.08, 3.68], pos: [-s, -s, 0] }
      ];
      edgeBeams.forEach(b => {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(b.size[0], b.size[1], b.size[2]), glowGreen);
        beam.position.set(b.pos[0], b.pos[1], b.pos[2]);
        group.add(beam);
        group.userData.glowMeshes.push(beam);
      });

      // Flat Central Tractor Beam Aperture (Recessed flush octagonal plate)
      const apertureGeo = new THREE.CylinderGeometry(0.38, 0.42, 0.04, 8);
      const emitter = new THREE.Mesh(apertureGeo, glowGreen);
      emitter.rotation.x = Math.PI / 2;
      emitter.position.set(0, 0, 1.815);
      group.add(emitter);
      group.userData.glowMeshes.push(emitter);

      // Pulsing Cybernetic Fractal Circuit Traces across the front face
      group.userData.fractalConduits = [];
      const fractalTracks = [
        // Inner square ring (4 segments)
        { size: [1.1, 0.03, 0.02], pos: [0, 0.55, 1.812], dist: 0.55 },
        { size: [1.1, 0.03, 0.02], pos: [0, -0.55, 1.812], dist: 0.55 },
        { size: [0.03, 1.1, 0.02], pos: [0.55, 0, 1.812], dist: 0.55 },
        { size: [0.03, 1.1, 0.02], pos: [-0.55, 0, 1.812], dist: 0.55 },

        // Mid concentric square ring (4 segments)
        { size: [2.1, 0.035, 0.02], pos: [0, 1.05, 1.812], dist: 1.05 },
        { size: [2.1, 0.035, 0.02], pos: [0, -1.05, 1.812], dist: 1.05 },
        { size: [0.035, 2.1, 0.02], pos: [1.05, 0, 1.812], dist: 1.05 },
        { size: [0.035, 2.1, 0.02], pos: [-1.05, 0, 1.812], dist: 1.05 },

        // Outer concentric square ring (4 segments)
        { size: [3.0, 0.04, 0.02], pos: [0, 1.5, 1.812], dist: 1.5 },
        { size: [3.0, 0.04, 0.02], pos: [0, -1.5, 1.812], dist: 1.5 },
        { size: [0.04, 3.0, 0.02], pos: [1.5, 0, 1.812], dist: 1.5 },
        { size: [0.04, 3.0, 0.02], pos: [-1.5, 0, 1.812], dist: 1.5 },

        // Branching cross & diagonal fractal interconnects
        { size: [0.03, 0.5, 0.02], pos: [0, 0.8, 1.812], dist: 0.8 },
        { size: [0.03, 0.5, 0.02], pos: [0, -0.8, 1.812], dist: 0.8 },
        { size: [0.5, 0.03, 0.02], pos: [0.8, 0, 1.812], dist: 0.8 },
        { size: [0.5, 0.03, 0.02], pos: [-0.8, 0, 1.812], dist: 0.8 },

        // Stepped L-circuit branch bars
        { size: [0.45, 0.03, 0.02], pos: [0.78, 1.05, 1.812], dist: 1.3 },
        { size: [0.45, 0.03, 0.02], pos: [-0.78, 1.05, 1.812], dist: 1.3 },
        { size: [0.45, 0.03, 0.02], pos: [0.78, -1.05, 1.812], dist: 1.3 },
        { size: [0.45, 0.03, 0.02], pos: [-0.78, -1.05, 1.812], dist: 1.3 },

        { size: [0.03, 0.45, 0.02], pos: [1.05, 0.78, 1.812], dist: 1.3 },
        { size: [0.03, 0.45, 0.02], pos: [-1.05, 0.78, 1.812], dist: 1.3 },
        { size: [0.03, 0.45, 0.02], pos: [1.05, -0.78, 1.812], dist: 1.3 },
        { size: [0.03, 0.45, 0.02], pos: [-1.05, -0.78, 1.812], dist: 1.3 }
      ];

      fractalTracks.forEach(t => {
        const mat = new THREE.MeshBasicMaterial({ color: 0x00ff55, transparent: true, opacity: 0.75 });
        const bar = new THREE.Mesh(new THREE.BoxGeometry(t.size[0], t.size[1], t.size[2]), mat);
        bar.position.set(t.pos[0], t.pos[1], t.pos[2]);
        bar.userData = { dist: t.dist };
        group.add(bar);
        group.userData.fractalConduits.push(bar);
      });

      // Internal Cybernetic Matrix Light (Glowing outward to illuminate edges and core)
      const coreLight = createLight(0x00ff44, 4.5, 40);
      coreLight.position.set(0, 0, 0);
      group.add(coreLight);
      group.userData.shipLights.push(coreLight);

      group.userData.rotY = 0.003;

    } else if (shipId === 'borg_sphere') {
      // 9. Borg Scout Sphere (Matte Industrial Dark Borg Metal with Flush Cybernetic Seams & Inner Green Glow)
      const blackConduitMat = new MaterialConstructor({ color: 0x050709, roughness: 0.68, metalness: 0.65 });
      const polarMat = new MaterialConstructor({ color: 0x020304, roughness: 0.75, metalness: 0.7 });
      const greeblePlateMat = new MaterialConstructor({ color: 0x12171b, roughness: 0.65, metalness: 0.6 });
      const borgSphereMat = new MaterialConstructor({
        color: 0x111915,
        roughness: 0.72,
        metalness: 0.58,
        emissive: 0x003b12,
        emissiveIntensity: 0.68
      });

      // Primary Matte Spherical Monolith
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(2.2, 36, 36), borgSphereMat);
      group.add(sphere);

      // 1. Horizontal Equatorial Seam Ring (XZ plane at y = 0)
      const eqRing = new THREE.Mesh(new THREE.TorusGeometry(2.205, 0.035, 8, 48), blackConduitMat);
      eqRing.rotation.x = Math.PI / 2;
      group.add(eqRing);

      // 2. Vertical Meridian Seam Rings (Passing through North/South poles at yaw angles 0°, 45°, 90°, 135°)
      [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4].forEach(rotY => {
        const mRing = new THREE.Mesh(new THREE.TorusGeometry(2.205, 0.032, 8, 48), blackConduitMat);
        mRing.rotation.y = rotY;
        group.add(mRing);
      });

      // 3. Flush Horizontal Latitude Seam Rings (Parallel to equator, rotated X = 90°)
      [
        { y: 1.265, r: 1.806, tube: 0.028 },
        { y: -1.265, r: 1.806, tube: 0.028 },
        { y: 1.998, r: 0.932, tube: 0.025 },
        { y: -1.998, r: 0.932, tube: 0.025 }
      ].forEach(lat => {
        const latRing = new THREE.Mesh(new THREE.TorusGeometry(lat.r, lat.tube, 8, 36), blackConduitMat);
        latRing.rotation.x = Math.PI / 2;
        latRing.position.set(0, lat.y, 0);
        group.add(latRing);
      });

      // 4. Flush Dark Polar Aperture Caps (Flat discs hugging the North & South poles)
      [2.18, -2.18].forEach(yPos => {
        const polarCap = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.52, 0.04, 24), polarMat);
        polarCap.position.set(0, yPos, 0);
        group.add(polarCap);
      });

      // 5. Interlocking Cybernetic Greeble Armor Sub-Panels (8 Octant Quadrants flush on surface)
      [-1, 1].forEach(xSign => {
        [-1, 1].forEach(ySign => {
          [-1, 1].forEach(zSign => {
            const plate = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.28, 0.03), greeblePlateMat);
            const dir = new THREE.Vector3(xSign * 0.577, ySign * 0.577, zSign * 0.577).normalize();
            plate.position.set(dir.x * 2.205, dir.y * 2.205, dir.z * 2.205);
            plate.lookAt(dir.x * 4, dir.y * 4, dir.z * 4);
            group.add(plate);
          });
        });
      });

      // 6. Spooky Internal Glowing Cybernetic Core Matrix (Deep Green Radiance)
      const innerCore = new THREE.Mesh(new THREE.SphereGeometry(1.4, 20, 20), glowGreen);
      group.add(innerCore);
      group.userData.glowMeshes.push(innerCore);

      // Internal Green Core Point Light (Spooky green radiance radiating outward through seams)
      const sphereLight = createLight(0x00ff44, 4.8, 38);
      sphereLight.position.set(0, 0, 0);
      group.add(sphereLight);
      group.userData.shipLights.push(sphereLight);

      group.userData.rotY = 0.004;

    } else if (shipId === 'cardassian_galor') {
      // 10. Cardassian Galor-Class Warship (Iconic Ochre Flat Cruciform Warship)
      // Flat Armored Main Spine Hull
      const mainHull = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.38, 4.6), hullMatCardassian);
      mainHull.position.set(0, 0, 0.4);
      group.add(mainHull);

      // Tapered Forward Prow Arrowhead
      const prow = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.28, 1.8), hullMatCardassian);
      prow.position.set(0, 0, 2.6);
      group.add(prow);

      // Tapered Nose Tip
      const noseTip = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.2, 0.8), hullMatCardassian);
      noseTip.position.set(0, 0, 3.4);
      group.add(noseTip);

      // Bow Spiral-Wave Disruptor Array (Amber Emitter Crystal)
      const bowDisruptor = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.16, 0.4), glowAmber);
      bowDisruptor.position.set(0, 0, 3.8);
      group.add(bowDisruptor);
      group.userData.glowMeshes.push(bowDisruptor);

      const bowLight = createLight(0xffaa00, 3.5, 26);
      bowLight.position.set(0, 0, 4.0);
      group.add(bowLight);
      group.userData.shipLights.push(bowLight);

      // Elevated Dorsal Command Bridge Tower
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.35, 1.6), hullMatCardassian);
      bridge.position.set(0, 0.32, 0.2);
      group.add(bridge);

      // Signature Cardassian Dorsal Tail Fin
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.75, 1.6), hullMatCardassian);
      fin.position.set(0, 0.55, -1.0);
      group.add(fin);

      // Wide Lateral Swept Wings (Iconic Cruciform Profile)
      [-2.1, 2.1].forEach(xSign => {
        const wing = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.14, 1.8), hullMatCardassian);
        wing.position.set(xSign * 0.7, -0.02, -0.4);
        wing.rotation.y = (xSign > 0 ? -0.22 : 0.22);
        group.add(wing);

        // Wingtip Sensor Pylons
        const tipPylon = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.35, 1.2), hullMatCardassian);
        tipPylon.position.set(xSign * 1.35, 0.05, -0.4);
        group.add(tipPylon);

        // Amber Sublight Engine Exhaust Ports
        const engine = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.14, 0.15), glowAmber);
        engine.position.set(xSign * 0.7, -0.02, -1.35);
        group.add(engine);
        group.userData.glowMeshes.push(engine);
      });
    }

    return group;
  }

  spawnStarship(shipId = 'enterprise_d') {
    if (!this.fleetGroup) return;

    // Remove existing ship and dispose GPU buffers
    if (this.activeShipMesh) {
      this.disposeGroup(this.activeShipMesh);
      this.fleetGroup.remove(this.activeShipMesh);
      this.activeShipMesh = null;
    }

    this.activeShipId = shipId;
    this.activeShipMesh = this.buildStarship(shipId);
    this.fleetGroup.add(this.activeShipMesh);

    this.applyStarshipPositionMode(this.shipPosMode);
  }

  applyStarshipPositionMode(mode = 'flank') {
    if (!this.activeShipMesh) return;
    this.shipPosMode = mode;

    const setScale = (mesh, x, y, z) => {
      if (!mesh) return;
      if (!mesh.scale || typeof mesh.scale.set !== 'function') {
        mesh.scale = { x: 1, y: 1, z: 1, set(sx, sy, sz) { this.x = sx; this.y = sy; this.z = sz; }, clone() { return { x: this.x, y: this.y, z: this.z }; }, copy(s) { this.x = s.x; this.y = s.y; this.z = s.z; } };
      }
      mesh.scale.set(x, y, z);
    };

    if (mode === 'flank') {
      // Flank Cruiser (Right side of holodeck arena, escorting forward)
      this.activeShipMesh.position.set(38, 6, -55);
      this.activeShipMesh.rotation.set(0.1, -0.5, -0.05);
      setScale(this.activeShipMesh, 1.4, 1.4, 1.4);
      this.activeShipMesh.userData.baseX = 38;
      this.activeShipMesh.userData.baseY = 6;
    } else if (mode === 'background') {
      // Deep Cosmic Space Backdrop (In the stars behind the sector sun)
      this.activeShipMesh.position.set(-32, 14, -110);
      this.activeShipMesh.rotation.set(0.15, 0.4, 0.08);
      setScale(this.activeShipMesh, 2.4, 2.4, 2.4);
      this.activeShipMesh.userData.baseX = -32;
      this.activeShipMesh.userData.baseY = 14;
    } else if (mode === 'flyby') {
      // Cinematic Flyby (Angled dramatic pass)
      this.activeShipMesh.position.set(-18, -4, -40);
      this.activeShipMesh.rotation.set(-0.2, 0.6, 0.15);
      setScale(this.activeShipMesh, 1.8, 1.8, 1.8);
      this.activeShipMesh.userData.baseX = -18;
      this.activeShipMesh.userData.baseY = -4;
    } else if (mode === 'inspect') {
      // Close-Up Inspection Mode (Directly showcased in center arena)
      this.activeShipMesh.position.set(0, 2, -28);
      this.activeShipMesh.rotation.set(0.15, 0.25, 0.0);
      setScale(this.activeShipMesh, 2.0, 2.0, 2.0);
      this.activeShipMesh.userData.baseX = 0;
      this.activeShipMesh.userData.baseY = 2;
    }
  }

  toggleFleetVisibility() {
    this.isFleetVisible = !this.isFleetVisible;
    if (this.fleetGroup) {
      this.fleetGroup.visible = this.isFleetVisible;
    }
    this.showBanner(this.isFleetVisible ? '🚀 STARFLEET ESCORT: ENGAGED' : '🚀 STARFLEET ESCORT: CLOAKED');
  }

  triggerWarpFlash() {
    if (!this.activeShipMesh || !this.activeShipMesh.scale) return;
    const origX = this.activeShipMesh.scale.x || 1.0;
    const origY = this.activeShipMesh.scale.y || 1.0;
    const origZ = this.activeShipMesh.scale.z || 1.0;
    
    if (typeof this.activeShipMesh.scale.set === 'function') {
      this.activeShipMesh.scale.set(origX * 0.1, origY * 0.1, origZ * 4.0);
    }
    this.audio.playRicochet(false, 0, 0);
    setTimeout(() => {
      if (this.activeShipMesh && typeof this.activeShipMesh.scale.set === 'function') {
        this.activeShipMesh.scale.set(origX, origY, origZ);
      }
    }, 280);
    this.showBanner('⚡ WARP SIGNATURE PULSE ENGAGED');
  }


  generateMissionPatrolRoute(startSectorIndex = 0) {
    const total = (this.sectors && this.sectors.length) ? this.sectors.length : 10;
    const remaining = [];
    for (let i = 0; i < total; i++) {
      if (i !== startSectorIndex) remaining.push(i);
    }
    // Shuffle remaining sectors for RNG adventure
    for (let i = remaining.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = remaining[i];
      remaining[i] = remaining[j];
      remaining[j] = tmp;
    }
    return [startSectorIndex, ...remaining];
  }

  initPatrolRoute() {
    if (!this.patrolRoute || this.patrolRoute.length !== this.sectors.length) {
      this.patrolRoute = this.generateMissionPatrolRoute(this.currentSectorIndex || 0);
      this.patrolProgress = 0;
    }
  }

  initCosmicSectors() {
    this.sectorLore = {
      betelgeuse: {
        title: "BETELGEUSE // ALPHA ORIONIS",
        class: "CLASS-M RED SUPERGIANT",
        desc: "Colossal pulsing red supergiant star nearing core-collapse supernova. Features boiling turbulent convection plasma cells, magnetic flux loops, and superheated coronal prominences.",
        note: "High solar radiation flux detected. Holodeck shields holding at operational levels."
      },
      blackhole: {
        title: "CYGNUS X-1 // GARGANTUA",
        class: "STELLAR-MASS ACCRETION SINGULARITY",
        desc: "High-density gravitational singularity with active relativistic frame dragging, Einstein photon lensing ring, and superheated Doppler accretion disk vortex.",
        note: "Extreme gravitational gradient. Maintain safe orbital perimeter."
      },
      nebula: {
        title: "MUTARA NEBULA",
        class: "IONIZED STELLAR NURSERY",
        desc: "Dense multi-layered protostellar cloud rich in ionized deuterium and subatomic plasma filaments. Nursery to dozens of glittering infant proto-stars.",
        note: "Sensor resolution reduced by 12% due to static ionization."
      },
      pulsar: {
        title: "CRAB PULSAR // PSR B0531+21",
        class: "RELATIVISTIC MAGNETAR",
        desc: "Ultra-dense remnant of Supernova 1054 spinning at 30.2 rotations per second. Generates catastrophic magnetic flux rings and sweeping twin relativistic lighthouse beam jets.",
        note: "High-frequency electromagnetic pulses detected in 3D holodeck matrix."
      },
      ringed_giant: {
        title: "AETHELGARD EXOPLANET",
        class: "JOVIAN-CLASS GAS GIANT",
        desc: "Massive banded gas giant world boasting an iridescent concentric ice ring system spanning 64,000 km, orbited by twin captured celestial moons.",
        note: "Orbital gravity assist engaged. Quantum navigation aligned."
      },
      binary_stars: {
        title: "KEPLER-47 // ANDROMEDA BINARY",
        class: "CONTACT BINARY SYSTEM",
        desc: "Luminous interacting stellar pair consisting of a brilliant sapphire Blue Giant and an ultra-dense Golden Dwarf locked in mutual Roche-lobe tidal mass transfer.",
        note: "Active ionized plasma bridge detected between stellar barycenters."
      },
      badlands_rift: {
        title: "BADLANDS // CHRONITON RIFT",
        class: "IONIC PLASMA STORM & SPACETIME ANOMALY",
        desc: "Treacherous plasma storm corridor plagued by violent subspace shear, electric violet plasma vortex ribbons, and spinning chroniton anomaly crystals.",
        note: "Navigational hazard. Chroniton distortion field active."
      },
      dyson_sphere: {
        title: "KARDASHEV SWARM // DYSON RING",
        class: "TIER-II STELLAR MEGASTRUCTURE",
        desc: "Ancient alien stellar megastructure engineered to harvest solar radiation via orbiting segmented hexagonal collector arrays and magnetic induction guide rings.",
        note: "Artificial megastructure telemetry synchronized with Starfleet library."
      },
      hypernova: {
        title: "CASSIOPEIA A // HYPERNOVA REMNANT",
        class: "RELATIVISTIC BLAST ENVELOPE",
        desc: "Expanding multi-million degree relativistic shockwave envelope produced by an ultra-energetic hypernova explosion, surrounding a dense quark core.",
        note: "Synchrotron radiation detected along expanding shockwave fronts."
      },
      crystalline_entity: {
        title: "EPSILON MATRIX // CRYSTALLINE ENTITY",
        class: "SILICON-BASED MACRO-INTELLIGENCE",
        desc: "Enigmatic spaceborne crystalline intelligence capable of converting matter into pure warp energy via resonant faceted fractal crystal shards and harmonic lattices.",
        note: "Complex harmonic frequency emissions detected in sub-space range."
      }
    };

    this.sectors = [
      {
        id: 'betelgeuse',
        name: 'BETELGEUSE',
        type: 'RED SUPERGIANT // ALPHA ORIONIS',
        color: '#ff4400',
        lightColor: 0xff5500
      },
      {
        id: 'blackhole',
        name: 'CYGNUS X-1',
        type: 'ACCRETION SINGULARITY',
        color: '#33ccff',
        lightColor: 0x3399ff
      },
      {
        id: 'nebula',
        name: 'MUTARA NEBULA',
        type: 'IONIZED STELLAR NURSERY',
        color: '#cc33aa',
        lightColor: 0xaa22bb
      },
      {
        id: 'pulsar',
        name: 'CRAB PULSAR',
        type: 'RELATIVISTIC MAGNETAR',
        color: '#0088ff',
        lightColor: 0x0066ff
      },
      {
        id: 'ringed_giant',
        name: 'AETHELGARD',
        type: 'RINGED GAS GIANT',
        color: '#d97d55',
        lightColor: 0x5588cc
      },
      {
        id: 'binary_stars',
        name: 'KEPLER-47',
        type: 'ANDROMEDA BINARY',
        color: '#00aaff',
        lightColor: 0x0088ff
      },
      {
        id: 'badlands_rift',
        name: 'BADLANDS RIFT',
        type: 'CHRONITON ANOMALY',
        color: '#ee6600',
        lightColor: 0xff6600
      },
      {
        id: 'dyson_sphere',
        name: 'KARDASHEV SWARM',
        type: 'DYSON MEGASTRUCTURE',
        color: '#f59e0b',
        lightColor: 0xffdd55
      },
      {
        id: 'hypernova',
        name: 'CASSIOPEIA A',
        type: 'HYPERNOVA REMNANT',
        color: '#00f0ff',
        lightColor: 0x00eeff
      },
      {
        id: 'crystalline_entity',
        name: 'EPSILON MATRIX',
        type: 'CRYSTALLINE ENTITY',
        color: '#d946ef',
        lightColor: 0xee33ff
      }
    ];

    this.currentSectorIndex = Math.floor(Math.random() * this.sectors.length);
  }

  buildCosmicBackground() {
    this.cosmicGroup = new THREE.Group();
    this.scene.add(this.cosmicGroup);

    // Tier 1: Hyperspace Micro-Star Dust (1,200 points)
    this.starCount = 1200;
    this.starGeo = new THREE.BufferGeometry();
    this.starPos = new Float32Array(this.starCount * 3);

    for (let i = 0; i < this.starCount; i++) {
      this.starPos[i * 3] = (Math.random() - 0.5) * 360;
      this.starPos[i * 3 + 1] = (Math.random() - 0.5) * 220;
      this.starPos[i * 3 + 2] = -120.0 - Math.random() * 180.0;
    }

    this.starGeo.setAttribute('position', new THREE.BufferAttribute(this.starPos, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.4,
      transparent: true,
      opacity: 0.85
    });
    this.starParticles = new THREE.Points(this.starGeo, starMat);
    this.cosmicGroup.add(this.starParticles);

    // Tier 2: Spectral Stellar Giants (120 colored star bodies: Class O, M, G, A)
    this.specStarCount = 120;
    this.specStarGeo = new THREE.BufferGeometry();
    const specPos = new Float32Array(this.specStarCount * 3);
    const specCols = new Float32Array(this.specStarCount * 3);
    const stellarPalettes = [
      [0.4, 0.8, 1.0],  // Class O Blue Giant
      [1.0, 0.3, 0.2],  // Class M Red Supergiant
      [1.0, 0.85, 0.3], // Class G Solar Gold
      [1.0, 1.0, 1.0]   // Class A Diamond
    ];

    for (let i = 0; i < this.specStarCount; i++) {
      specPos[i * 3] = (Math.random() - 0.5) * 340;
      specPos[i * 3 + 1] = (Math.random() - 0.5) * 200;
      specPos[i * 3 + 2] = -100.0 - Math.random() * 160.0;

      const pal = stellarPalettes[i % stellarPalettes.length];
      specCols[i * 3] = pal[0];
      specCols[i * 3 + 1] = pal[1];
      specCols[i * 3 + 2] = pal[2];
    }
    this.specStarGeo.setAttribute('position', new THREE.BufferAttribute(specPos, 3));
    this.specStarGeo.setAttribute('color', new THREE.BufferAttribute(specCols, 3));
    const specMat = new THREE.PointsMaterial({
      size: 3.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.95
    });
    this.specStarParticles = new THREE.Points(this.specStarGeo, specMat);
    this.cosmicGroup.add(this.specStarParticles);

    // Tier 3: Relativistic Hyperdrive Warp Streaks (60 speed lines along Z)
    this.warpStreakGroup = new THREE.Group();
    this.warpStreakGroup.visible = false;
    this.warpStreaks = [];
    this.isWarpStreaksActive = false;

    const streakMat = new THREE.MeshBasicMaterial({
      color: 0x88ddff,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });
    const streakGeo = (typeof THREE.CylinderGeometry === 'function') 
      ? new THREE.CylinderGeometry(0.08, 0.08, 1.0, 4) 
      : (this.sharedDiamondGeo || new THREE.BoxGeometry(0.12, 0.12, 1.0));

    for (let i = 0; i < 60; i++) {
      const mesh = new THREE.Mesh(streakGeo, streakMat);
      mesh.rotation.x = Math.PI / 2;
      const rx = (Math.random() - 0.5) * 60;
      const ry = (Math.random() - 0.5) * 36;
      const rz = -180 + Math.random() * 200;
      mesh.position.set(rx, ry, rz);
      mesh.scale.set(1, 1, 0.01);
      this.warpStreakGroup.add(mesh);
      this.warpStreaks.push({
        mesh,
        baseX: rx,
        baseY: ry,
        speed: 3.5 + Math.random() * 4.0,
        len: 12 + Math.random() * 24
      });
    }
    this.cosmicGroup.add(this.warpStreakGroup);

    // 2. Active Stellar Sector
    this.buildSector(this.currentSectorIndex);
    // 3. Star Trek Spaceship Escort Fleet
    this.initFleetEngine();
  }

  buildSector(sectorIndex) {
    if (!this.celestialGroup) {
      this.celestialGroup = new THREE.Group();
      if (this.cosmicGroup) this.cosmicGroup.add(this.celestialGroup);
    }

    // Clear and dispose old celestial objects from GPU VRAM
    if (this.celestialGroup) {
      this.disposeGroup(this.celestialGroup);
    }

    this.activeSunMesh = null;
    this.betelgeuseSunsetAura = null;
    this.betelgeuseSunsetHemi = null;
    this.betelgeuseSunsetLight = null;
    this.activeCoronaMesh = null;
    this.activeLoopMesh = null;
    this.activeHoleMesh = null;
    this.activePhotonRing = null;
    this.activeAccretionDisk = null;
    this.activeJetTop = null;
    this.activeJetBottom = null;
    this.nebulaClouds = null;
    this.activePulsarMesh = null;
    this.pulsarBeamGroup = null;
    this.pulsarSpotTop = null;
    this.pulsarSpotBottom = null;
    this.pulsarSpotTargetTop = null;
    this.pulsarSpotTargetBottom = null;
    this.pulsarCoreLight = null;
    this.pulsarImpactTop = null;
    this.pulsarImpactBottom = null;
    this.pulsarBounceLightTop = null;
    this.pulsarBounceLightBottom = null;
    this.activeMagRing1 = null;
    this.activeMagRing2 = null;
    this.planetMesh = null;
    this.planetRings = null;
    this.moon1Mesh = null;
    this.moon2Mesh = null;
    this.binaryGroup = null;
    this.activeRiftCrystal = null;
    this.activeRibbon1 = null;
    this.activeRibbon2 = null;
    this.dysonStar = null;
    this.dysonRingGroup = null;
    this.dysonRingSpinGroup = null;
    this.dysonInnerRingGroup = null;
    this.dysonInnerRingSpinGroup = null;
    this.hyperCore = null;
    this.hyperShellInner = null;
    this.hyperShellOuter = null;
    this.crystalEntity = null;
    this.crystalShardsGroup = null;
    this.crystalSatellites = [];
    this.crystalLatticeMat = null;
    this.crystalRefractionPulse = null;

    const sec = this.sectors[sectorIndex % this.sectors.length];
    this.currentSector = sec;
    this.currentSectorIndex = sectorIndex % this.sectors.length;

    const sectorHud = document.getElementById('hud-sector');
    if (sectorHud) {
      sectorHud.innerText = sec.name;
      sectorHud.style.color = sec.color;
    }
    const sectorBtnVal = document.getElementById('val-sandbox-sector');
    if (sectorBtnVal) {
      sectorBtnVal.innerText = sec.name;
      sectorBtnVal.style.color = sec.color;
    }

    // Dynamically update room grid textures & theme specifically for this sector
    this.updateRoomGridForSector(sec.id);

    // 1. BETELGEUSE (Colossal Red Supergiant Sun)
    if (sec.id === 'betelgeuse') {
      const sunCanvas = document.createElement('canvas');
      sunCanvas.width = 1024; sunCanvas.height = 512;
      const sCtx = sunCanvas.getContext('2d');
      const sGrad = sCtx.createLinearGradient(0, 0, 0, 512);
      sGrad.addColorStop(0, '#550800');
      sGrad.addColorStop(0.2, '#aa1a00');
      sGrad.addColorStop(0.4, '#ff3b00');
      sGrad.addColorStop(0.55, '#ffaa00');
      sGrad.addColorStop(0.7, '#ff4400');
      sGrad.addColorStop(0.85, '#991100');
      sGrad.addColorStop(1, '#440400');
      sCtx.fillStyle = sGrad;
      sCtx.fillRect(0, 0, 1024, 512);

      // Boiling plasma granules
      for (let i = 0; i < 110; i++) {
        sCtx.fillStyle = `rgba(255, ${Math.floor(120 + Math.random()*120)}, 0, ${0.08 + Math.random()*0.15})`;
        const rx = Math.random() * 1024;
        const ry = Math.random() * 512;
        const rw = 15 + Math.random() * 55;
        const rh = 10 + Math.random() * 32;
        sCtx.beginPath();
        sCtx.ellipse(rx, ry, rw, rh, Math.random() * Math.PI, 0, Math.PI * 2);
        sCtx.fill();
      }

      // ENLARGED: Colossal Supergiant Geometry (Radius 58)
      const sunGeo = new THREE.SphereGeometry(58, 48, 48);
      const sunMat = new THREE.MeshStandardMaterial({
        map: new THREE.CanvasTexture(sunCanvas),
        roughness: 0.8,
        emissive: 0xff3300,
        emissiveIntensity: 0.90
      });
      this.activeSunMesh = new THREE.Mesh(sunGeo, sunMat);
      this.activeSunMesh.position.set(48, 14, -145);
      this.celestialGroup.add(this.activeSunMesh);

      // Seamless Soft-Radial Corona Glow (No sharp ring edges)
      const coronaCanvas = document.createElement('canvas');
      coronaCanvas.width = 512; coronaCanvas.height = 512;
      const cCtx = coronaCanvas.getContext('2d');
      const cGrad = cCtx.createRadialGradient(256, 256, 110, 256, 256, 256);
      cGrad.addColorStop(0.0, 'rgba(255, 120, 20, 0.45)');
      cGrad.addColorStop(0.4, 'rgba(255, 70, 0, 0.25)');
      cGrad.addColorStop(0.75, 'rgba(200, 30, 50, 0.08)');
      cGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
      cCtx.fillStyle = cGrad;
      cCtx.fillRect(0, 0, 512, 512);

      const coronaGeo = new THREE.PlaneGeometry(240, 240);
      const coronaMat = new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(coronaCanvas),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      this.activeCoronaMesh = new THREE.Mesh(coronaGeo, coronaMat);
      this.activeSunMesh.add(this.activeCoronaMesh);

      // Coronal Prominence Loop
      const loopGeo = new THREE.TorusGeometry(60, 2.0, 16, 48, Math.PI * 0.75);
      const loopMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.75 });
      this.activeLoopMesh = new THREE.Mesh(loopGeo, loopMat);
      this.activeLoopMesh.rotation.z = Math.PI / 4;
      this.activeSunMesh.add(this.activeLoopMesh);

      // 1. Ultra-Wide, Super-Soft Sunset Atmospheric Backdrop Aura (520x520u)
      const sunsetCanvas = document.createElement('canvas');
      sunsetCanvas.width = 1024; sunsetCanvas.height = 1024;
      const sunsetCtx = sunsetCanvas.getContext('2d');
      const sunsetGrad = sunsetCtx.createRadialGradient(512, 512, 80, 512, 512, 512);
      sunsetGrad.addColorStop(0.0, 'rgba(255, 110, 30, 0.38)');
      sunsetGrad.addColorStop(0.25, 'rgba(215, 55, 65, 0.24)');
      sunsetGrad.addColorStop(0.55, 'rgba(125, 25, 85, 0.13)');
      sunsetGrad.addColorStop(0.80, 'rgba(45, 10, 60, 0.05)');
      sunsetGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
      sunsetCtx.fillStyle = sunsetGrad;
      sunsetCtx.fillRect(0, 0, 1024, 1024);

      const auraGeo = new THREE.PlaneGeometry(520, 520);
      const auraMat = (THREE.MeshBasicMaterial ? new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(sunsetCanvas),
        transparent: true,
        opacity: 0.50,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      }) : new THREE.MeshBasicMaterial({ color: 0xff3344 }));
      this.betelgeuseSunsetAura = new THREE.Mesh(auraGeo, auraMat);
      this.betelgeuseSunsetAura.position.set(48, 14, -149);
      this.celestialGroup.add(this.betelgeuseSunsetAura);

      // 2. Diffused Sunset Ambience (Balanced, gentle, no harsh hotspots)
      if (THREE.HemisphereLight) {
        this.betelgeuseSunsetHemi = new THREE.HemisphereLight(0xff6622, 0x2e0624, 0.50);
        this.celestialGroup.add(this.betelgeuseSunsetHemi);
      } else {
        this.betelgeuseSunsetHemi = new THREE.AmbientLight(0x44120e, 0.50);
        this.celestialGroup.add(this.betelgeuseSunsetHemi);
      }

      // 3. Ultra-Soft Sunset Horizon Fill Light (Low intensity, wide spread)
      this.betelgeuseSunsetLight = new THREE.DirectionalLight(0xff7744, 0.30);
      this.betelgeuseSunsetLight.position.set(48, 14, -145);
      this.celestialGroup.add(this.betelgeuseSunsetLight);

    } else if (sec.id === 'blackhole') {
      // 2. CYGNUS X-1 ACCRETION SINGULARITY
      const horizonGeo = new THREE.SphereGeometry(18, 36, 36);
      const horizonMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
      this.activeHoleMesh = new THREE.Mesh(horizonGeo, horizonMat);
      this.activeHoleMesh.position.set(38, 12, -145);
      this.celestialGroup.add(this.activeHoleMesh);

      // Photon Lensing Ring
      const photonGeo = new THREE.RingGeometry(18.2, 21.5, 48);
      const photonMat = new THREE.MeshBasicMaterial({
        color: 0x99ddff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
        depthWrite: false
      });
      this.activePhotonRing = new THREE.Mesh(photonGeo, photonMat);
      this.activeHoleMesh.add(this.activePhotonRing);

      // Swirling Relativistic Accretion Disk
      const diskCanvas = document.createElement('canvas');
      diskCanvas.width = 512; diskCanvas.height = 512;
      const dCtx = diskCanvas.getContext('2d');
      const dGrad = dCtx.createRadialGradient(256, 256, 40, 256, 256, 250);
      dGrad.addColorStop(0, '#ffffff');
      dGrad.addColorStop(0.18, '#33ddff');
      dGrad.addColorStop(0.45, '#0088ff');
      dGrad.addColorStop(0.72, '#ff6600');
      dGrad.addColorStop(0.92, '#880000');
      dGrad.addColorStop(1, 'rgba(0,0,0,0)');
      dCtx.fillStyle = dGrad;
      dCtx.fillRect(0, 0, 512, 512);

      const diskTex = new THREE.CanvasTexture(diskCanvas);
      const diskGeo = new THREE.RingGeometry(21, 62, 48);
      const diskMat = new THREE.MeshBasicMaterial({
        map: diskTex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.90,
        depthWrite: false
      });
      this.activeAccretionDisk = new THREE.Mesh(diskGeo, diskMat);
      this.activeAccretionDisk.rotation.x = Math.PI / 2.8;
      this.activeHoleMesh.add(this.activeAccretionDisk);

      // Relativistic Plasma Jets
      const jetMat = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.45,
        depthWrite: false
      });
      const jetGeo = new THREE.ConeGeometry(3.5, 48, 16, 1, true);
      
      this.activeJetTop = new THREE.Mesh(jetGeo, jetMat);
      this.activeJetTop.position.y = 26;
      this.activeHoleMesh.add(this.activeJetTop);

      this.activeJetBottom = new THREE.Mesh(jetGeo, jetMat);
      this.activeJetBottom.position.y = -26;
      this.activeJetBottom.rotation.x = Math.PI;
      this.activeHoleMesh.add(this.activeJetBottom);

    } else if (sec.id === 'nebula') {
      // 3. MUTARA IONIZED DEUTERIUM NEBULA
      this.nebulaClouds = [];
      const colors = ['#cc33aa', '#aa22bb', '#5511aa', '#3388ff'];
      
      for (let i = 0; i < 4; i++) {
        const nCanvas = document.createElement('canvas');
        nCanvas.width = 512; nCanvas.height = 512;
        const nCtx = nCanvas.getContext('2d');

        const grad = nCtx.createRadialGradient(256, 256, 20, 256, 256, 250);
        grad.addColorStop(0, colors[i]);
        grad.addColorStop(0.5, colors[(i + 1) % colors.length]);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        nCtx.fillStyle = grad;
        nCtx.fillRect(0, 0, 512, 512);

        for (let p = 0; p < 25; p++) {
          nCtx.fillStyle = `rgba(255, 255, 255, ${0.05 + Math.random()*0.15})`;
          nCtx.beginPath();
          nCtx.arc(Math.random()*512, Math.random()*512, 4 + Math.random()*22, 0, Math.PI*2);
          nCtx.fill();
        }

        const nTex = new THREE.CanvasTexture(nCanvas);
        const nGeo = new THREE.PlaneGeometry(120 + i*20, 90 + i*15);
        const nMat = new THREE.MeshBasicMaterial({
          map: nTex,
          transparent: true,
          opacity: 0.35 - i*0.05,
          depthWrite: false
        });
        const nMesh = new THREE.Mesh(nGeo, nMat);
        nMesh.position.set(30 + (i*8 - 12), 10 + (i*6 - 9), -145 - i*5);
        nMesh.rotation.z = i * 0.4;
        this.celestialGroup.add(nMesh);
        this.nebulaClouds.push(nMesh);
      }

      // Newborn Protostar Clusters
      const protoGeo = new THREE.SphereGeometry(2.5, 16, 16);
      const protoMat = new THREE.MeshBasicMaterial({ color: 0xeeffff });
      for (let p = 0; p < 6; p++) {
        const proto = new THREE.Mesh(protoGeo, protoMat);
        proto.position.set(15 + p*9 + Math.random()*4, 5 + (p%3)*8 + Math.random()*3, -140 - Math.random()*10);
        this.celestialGroup.add(proto);
      }

    } else if (sec.id === 'pulsar') {
      // 4. CRAB PULSAR // PSR B0531+21 - Relativistic Magnetar with Deep Sapphire Blue Projecting Lights
      const pGeo = new THREE.SphereGeometry(11, 32, 32);
      const pMat = new THREE.MeshStandardMaterial({
        color: 0x0055ff,
        emissive: 0x0044ee,
        emissiveIntensity: 0.95,
        roughness: 0.2,
        metalness: 0.7
      });
      this.activePulsarMesh = new THREE.Mesh(pGeo, pMat);
      this.activePulsarMesh.position.set(36, 10, -142);
      this.celestialGroup.add(this.activePulsarMesh);

      // Core Physical Pulsar PointLight (Rich Electric Blue, No White)
      this.pulsarCoreLight = new THREE.PointLight(0x0066ff, 3.0, 260, 1.2);
      this.pulsarCoreLight.position.set(36, 10, -142);
      this.celestialGroup.add(this.pulsarCoreLight);

      // Sweeping Relativistic Twin Lighthouse Beams (Deep Blue Volumetric Sheaths, No Harsh White)
      this.pulsarBeamGroup = new THREE.Group();

      const beamGeoInner = new THREE.CylinderGeometry(0.5, 10, 105, 16, 1, true);
      const beamMatInner = new THREE.MeshBasicMaterial({
        color: 0x00aaff,
        transparent: true,
        opacity: 0.50,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const beamGeoOuter = new THREE.CylinderGeometry(1.5, 18, 110, 16, 1, true);
      const beamMatOuter = new THREE.MeshBasicMaterial({
        color: 0x0044ff,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });

      // Top Beam
      const beamTopInner = new THREE.Mesh(beamGeoInner, beamMatInner);
      beamTopInner.position.y = 52;
      this.pulsarBeamGroup.add(beamTopInner);

      const beamTopOuter = new THREE.Mesh(beamGeoOuter, beamMatOuter);
      beamTopOuter.position.y = 55;
      this.pulsarBeamGroup.add(beamTopOuter);

      // Bottom Beam
      const beamBottomInner = new THREE.Mesh(beamGeoInner, beamMatInner);
      beamBottomInner.position.y = -52;
      beamBottomInner.rotation.x = Math.PI;
      this.pulsarBeamGroup.add(beamBottomInner);

      const beamBottomOuter = new THREE.Mesh(beamGeoOuter, beamMatOuter);
      beamBottomOuter.position.y = -55;
      beamBottomOuter.rotation.x = Math.PI;
      this.pulsarBeamGroup.add(beamBottomOuter);

      this.activePulsarMesh.add(this.pulsarBeamGroup);

      // Actual Physical Relativistic Sweeping SpotLights (Rich Luminous Sapphire Blue, 0x0066ff)
      if (typeof THREE.SpotLight === 'function') {
        this.pulsarSpotTop = new THREE.SpotLight(0x0066ff, 8.5, 320, Math.PI / 5.5, 0.45, 1.1);
        this.pulsarSpotTop.position.set(36, 10, -142);
        this.pulsarSpotTargetTop = (typeof THREE.Object3D === 'function' ? new THREE.Object3D() : new THREE.Group());
        this.pulsarSpotTargetTop.position.set(36, 80, -142);
        this.celestialGroup.add(this.pulsarSpotTargetTop);
        this.pulsarSpotTop.target = this.pulsarSpotTargetTop;
        this.celestialGroup.add(this.pulsarSpotTop);

        this.pulsarSpotBottom = new THREE.SpotLight(0x0066ff, 8.5, 320, Math.PI / 5.5, 0.45, 1.1);
        this.pulsarSpotBottom.position.set(36, 10, -142);
        this.pulsarSpotTargetBottom = (typeof THREE.Object3D === 'function' ? new THREE.Object3D() : new THREE.Group());
        this.pulsarSpotTargetBottom.position.set(36, -60, -142);
        this.celestialGroup.add(this.pulsarSpotTargetBottom);
        this.pulsarSpotBottom.target = this.pulsarSpotTargetBottom;
        this.celestialGroup.add(this.pulsarSpotBottom);
      }

      // Magnetic Flux Rings (Deep Blue Plasma)
      const magGeo1 = new THREE.TorusGeometry(18, 0.9, 16, 48);
      const magMat = new THREE.MeshBasicMaterial({
        color: 0x0088ff,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending
      });
      this.activeMagRing1 = new THREE.Mesh(magGeo1, magMat);
      this.activeMagRing1.rotation.x = Math.PI / 3;
      this.activePulsarMesh.add(this.activeMagRing1);

      const magGeo2 = new THREE.TorusGeometry(25, 0.7, 16, 48);
      this.activeMagRing2 = new THREE.Mesh(magGeo2, magMat);
      this.activeMagRing2.rotation.y = Math.PI / 4;
      this.activePulsarMesh.add(this.activeMagRing2);

      // Realistic Relativistic Impact Caustic Splashes & Secondary Bounce Lights on Room Walls!
      const impactCanvas = document.createElement('canvas');
      impactCanvas.width = 128;
      impactCanvas.height = 128;
      const iCtx = impactCanvas.getContext('2d');
      if (iCtx) {
        const radGrad = iCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
        radGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0.95)');
        radGrad.addColorStop(0.25, 'rgba(0, 200, 255, 0.85)');
        radGrad.addColorStop(0.60, 'rgba(0, 100, 255, 0.45)');
        radGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
        iCtx.fillStyle = radGrad;
        iCtx.fillRect(0, 0, 128, 128);
      }
      const impactTex = new THREE.CanvasTexture(impactCanvas);
      const impactGeo = new THREE.PlaneGeometry(6.5, 6.5);
      const impactMatTop = new THREE.MeshBasicMaterial({
        map: impactTex,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const impactMatBottom = new THREE.MeshBasicMaterial({
        map: impactTex,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      });

      this.pulsarImpactTop = new THREE.Mesh(impactGeo, impactMatTop);
      this.pulsarImpactTop.visible = false;
      this.celestialGroup.add(this.pulsarImpactTop);

      this.pulsarImpactBottom = new THREE.Mesh(impactGeo, impactMatBottom);
      this.pulsarImpactBottom.visible = false;
      this.celestialGroup.add(this.pulsarImpactBottom);

      // Secondary Bounce Lights (Radiosity reflected from room walls into the holodeck interior)
      if (typeof THREE.PointLight === 'function') {
        this.pulsarBounceLightTop = new THREE.PointLight(0x0088ff, 0.0, 45, 1.4);
        this.celestialGroup.add(this.pulsarBounceLightTop);

        this.pulsarBounceLightBottom = new THREE.PointLight(0x0088ff, 0.0, 45, 1.4);
        this.celestialGroup.add(this.pulsarBounceLightBottom);
      }

    } else if (sec.id === 'ringed_giant') {
      // 5. AETHELGARD EXOPLANET
      const pCanvas = document.createElement('canvas');
      pCanvas.width = 1024; pCanvas.height = 512;
      const pCtx = pCanvas.getContext('2d');
      const pGrad = pCtx.createLinearGradient(0, 0, 0, 512);
      pGrad.addColorStop(0, '#1a334d');
      pGrad.addColorStop(0.15, '#2e6b9e');
      pGrad.addColorStop(0.35, '#85c2e0');
      pGrad.addColorStop(0.5, '#d97d55');
      pGrad.addColorStop(0.65, '#a64d2e');
      pGrad.addColorStop(0.85, '#402015');
      pGrad.addColorStop(1, '#110804');
      pCtx.fillStyle = pGrad;
      pCtx.fillRect(0, 0, 1024, 512);

      const pGeo = new THREE.SphereGeometry(28, 48, 48);
      const pMat = new THREE.MeshStandardMaterial({
        map: new THREE.CanvasTexture(pCanvas),
        roughness: 0.5,
        metalness: 0.2
      });
      this.planetMesh = new THREE.Mesh(pGeo, pMat);
      this.planetMesh.position.set(38, 8, -145);
      this.planetMesh.rotation.z = Math.PI / 6;
      this.celestialGroup.add(this.planetMesh);

      // Concentric Ice Rings
      const ringGeo = new THREE.RingGeometry(34, 62, 64);
      const ringCanvas = document.createElement('canvas');
      ringCanvas.width = 512; ringCanvas.height = 512;
      const rCtx = ringCanvas.getContext('2d');
      const rGrad = rCtx.createRadialGradient(256, 256, 120, 256, 256, 250);
      rGrad.addColorStop(0, 'rgba(217, 125, 85, 0.9)');
      rGrad.addColorStop(0.3, 'rgba(133, 194, 224, 0.7)');
      rGrad.addColorStop(0.5, 'rgba(0,0,0,0)');
      rGrad.addColorStop(0.6, 'rgba(230, 240, 255, 0.8)');
      rGrad.addColorStop(0.85, 'rgba(180, 210, 230, 0.6)');
      rGrad.addColorStop(1, 'rgba(0,0,0,0)');
      rCtx.fillStyle = rGrad;
      rCtx.fillRect(0, 0, 512, 512);

      const ringMat = new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(ringCanvas),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85
      });
      this.planetRings = new THREE.Mesh(ringGeo, ringMat);
      this.planetRings.rotation.x = Math.PI / 2.2;
      this.planetMesh.add(this.planetRings);

      // Orbiting Moons
      const moonGeo1 = new THREE.SphereGeometry(3.2, 16, 16);
      const moonMat1 = new THREE.MeshStandardMaterial({ color: 0x99aabb, roughness: 0.8 });
      this.moon1Mesh = new THREE.Mesh(moonGeo1, moonMat1);
      this.celestialGroup.add(this.moon1Mesh);

      const moonGeo2 = new THREE.SphereGeometry(2.0, 16, 16);
      const moonMat2 = new THREE.MeshStandardMaterial({ color: 0xcc8866, roughness: 0.8 });
      this.moon2Mesh = new THREE.Mesh(moonGeo2, moonMat2);
      this.celestialGroup.add(this.moon2Mesh);

    } else if (sec.id === 'binary_stars') {
      // 6. KEPLER-47 // ANDROMEDA BINARY (Contact Binary Stars)
      this.binaryGroup = new THREE.Group();
      this.binaryGroup.position.set(34, 10, -145);

      // Blue Giant Star (Kepler-47A)
      const blueGeo = new THREE.SphereGeometry(26, 36, 36);
      const blueMat = new THREE.MeshStandardMaterial({
        color: 0x0088ff,
        emissive: 0x0066ff,
        emissiveIntensity: 0.95,
        roughness: 0.4
      });
      const blueStar = new THREE.Mesh(blueGeo, blueMat);
      blueStar.position.set(-18, 0, 0);
      this.binaryGroup.add(blueStar);

      const blueCoronaGeo = new THREE.RingGeometry(27, 42, 36);
      const blueCoronaMat = new THREE.MeshBasicMaterial({
        color: 0x33bbff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.50,
        depthWrite: false
      });
      const blueCorona = new THREE.Mesh(blueCoronaGeo, blueCoronaMat);
      blueStar.add(blueCorona);

      // Golden Dwarf Star (Kepler-47B)
      const goldGeo = new THREE.SphereGeometry(16, 32, 32);
      const goldMat = new THREE.MeshStandardMaterial({
        color: 0xffaa00,
        emissive: 0xff6600,
        emissiveIntensity: 0.90,
        roughness: 0.4
      });
      const goldStar = new THREE.Mesh(goldGeo, goldMat);
      goldStar.position.set(24, 0, 0);
      this.binaryGroup.add(goldStar);

      const goldCoronaGeo = new THREE.RingGeometry(17, 28, 32);
      const goldCoronaMat = new THREE.MeshBasicMaterial({
        color: 0xffaa00,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.50,
        depthWrite: false
      });
      const goldCorona = new THREE.Mesh(goldCoronaGeo, goldCoronaMat);
      goldStar.add(goldCorona);

      // Ionized Roche-Lobe Plasma Bridge
      const bridgeGeo = new THREE.CylinderGeometry(2.4, 3.4, 42, 16, 1, true);
      const bridgeMat = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const bridge = new THREE.Mesh(bridgeGeo, bridgeMat);
      bridge.position.set(3, 0, 0);
      bridge.rotation.z = Math.PI / 2;
      this.binaryGroup.add(bridge);

      this.celestialGroup.add(this.binaryGroup);

    } else if (sec.id === 'badlands_rift') {
      // 7. BADLANDS // CHRONITON RIFT
      const riftGroup = new THREE.Group();
      riftGroup.position.set(36, 10, -142);

      // Central Chroniton Anomaly Crystal
      const crystalGeo = (THREE.OctahedronGeometry ? new THREE.OctahedronGeometry(15, 0) : new THREE.SphereGeometry(15, 8, 8));
      const crystalMat = new THREE.MeshStandardMaterial({
        color: 0x00ffcc,
        emissive: 0x00e5ff,
        emissiveIntensity: 0.95,
        roughness: 0.1,
        metalness: 0.9
      });
      this.activeRiftCrystal = new THREE.Mesh(crystalGeo, crystalMat);
      riftGroup.add(this.activeRiftCrystal);

      // Inner Core Glow
      const coreGeo = new THREE.SphereGeometry(6, 16, 16);
      const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      this.activeRiftCrystal.add(coreMesh);

      // Twisting Fiery Amber Plasma Ribbon
      const ribGeo1 = new THREE.TorusGeometry(30, 2.2, 16, 64, Math.PI * 1.7);
      const ribMat1 = new THREE.MeshBasicMaterial({
        color: 0xff6600,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending
      });
      this.activeRibbon1 = new THREE.Mesh(ribGeo1, ribMat1);
      this.activeRibbon1.rotation.x = Math.PI / 3;
      riftGroup.add(this.activeRibbon1);

      // Electric Violet Spacetime Ribbon
      const ribGeo2 = new THREE.TorusGeometry(24, 1.8, 16, 64, Math.PI * 1.5);
      const ribMat2 = new THREE.MeshBasicMaterial({
        color: 0xaa22ff,
        transparent: true,
        opacity: 0.70,
        blending: THREE.AdditiveBlending
      });
      this.activeRibbon2 = new THREE.Mesh(ribGeo2, ribMat2);
      this.activeRibbon2.rotation.y = Math.PI / 2.5;
      riftGroup.add(this.activeRibbon2);

      this.celestialGroup.add(riftGroup);

    } else if (sec.id === 'dyson_sphere') {
      // 8. KARDASHEV SWARM // DYSON RING (Dual Pure Orbital Track Rotation around Planet)
      const dysonGroup = new THREE.Group();
      dysonGroup.position.set(36, 12, -145);

      // Central Enclosed Star / Celestial Planet World
      const starGeo = new THREE.SphereGeometry(22, 32, 32);
      const starMat = new THREE.MeshStandardMaterial({
        color: 0xffeedd,
        emissive: 0xffcc44,
        emissiveIntensity: 0.95,
        roughness: 0.5
      });
      this.dysonStar = new THREE.Mesh(starGeo, starMat);
      dysonGroup.add(this.dysonStar);

      // 1. Outer Megastructure Ring (Tilted Orbital Plane + Pure Planar Track Spin)
      this.dysonRingGroup = new THREE.Group();
      this.dysonRingGroup.rotation.x = 0; // Initial un-tilted reference plane

      this.dysonRingSpinGroup = new THREE.Group();

      // Primary Outer Ring
      const ringGeo = new THREE.TorusGeometry(50, 1.4, 16, 64);
      const ringMat = new THREE.MeshStandardMaterial({
        color: 0x223344,
        emissive: 0x0088cc,
        emissiveIntensity: 0.6,
        metalness: 0.8
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      this.dysonRingSpinGroup.add(ringMesh);

      // Outer Concentric Amber Guide Ring
      const ring2Geo = new THREE.TorusGeometry(56, 0.8, 16, 64);
      const ring2Mat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.65 });
      const ring2Mesh = new THREE.Mesh(ring2Geo, ring2Mat);
      this.dysonRingSpinGroup.add(ring2Mesh);

      // 6 Orbiting Hexagonal Solar Collector Arrays along Outer Track
      const hexGeo = new THREE.CylinderGeometry(3.2, 3.2, 0.4, 6);
      const hexMat = new THREE.MeshStandardMaterial({ color: 0x00ddff, emissive: 0x004488, metalness: 0.9 });
      for (let h = 0; h < 6; h++) {
        const hex = new THREE.Mesh(hexGeo, hexMat);
        const angle = (h / 6) * Math.PI * 2;
        hex.position.set(Math.cos(angle) * 50, Math.sin(angle) * 50, 0);
        hex.rotation.x = Math.PI / 2;
        this.dysonRingSpinGroup.add(hex);
      }

      this.dysonRingGroup.add(this.dysonRingSpinGroup);
      dysonGroup.add(this.dysonRingGroup);

      // 2. Inner Glowing Blue Ring (Contrasting Inclination + Pure Opposite Planar Track Spin)
      this.dysonInnerRingGroup = new THREE.Group();
      this.dysonInnerRingGroup.rotation.x = -Math.PI / 3.2;
      this.dysonInnerRingGroup.rotation.y = Math.PI / 6;

      this.dysonInnerRingSpinGroup = new THREE.Group();

      // Inner Sapphire/Cyan Quantum Ring
      const innerRingGeo = new THREE.TorusGeometry(34, 1.2, 16, 64);
      const innerRingMat = new THREE.MeshStandardMaterial({
        color: 0x0088ff,
        emissive: 0x00aaff,
        emissiveIntensity: 0.95,
        roughness: 0.2,
        metalness: 0.8
      });
      const innerRingMesh = new THREE.Mesh(innerRingGeo, innerRingMat);
      this.dysonInnerRingSpinGroup.add(innerRingMesh);

      // Inner Glowing Cyan Power Conduit Halo
      const innerHaloGeo = new THREE.TorusGeometry(34, 0.45, 16, 64);
      const innerHaloMat = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending
      });
      const innerHaloMesh = new THREE.Mesh(innerHaloGeo, innerHaloMat);
      this.dysonInnerRingSpinGroup.add(innerHaloMesh);

      // 4 Orbiting Blue Quantum Relay Nodes along Inner Track
      const nodeGeo = new THREE.SphereGeometry(1.6, 12, 12);
      const nodeMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        blending: THREE.AdditiveBlending
      });
      for (let n = 0; n < 4; n++) {
        const node = new THREE.Mesh(nodeGeo, nodeMat);
        const angle = (n / 4) * Math.PI * 2;
        node.position.set(Math.cos(angle) * 34, Math.sin(angle) * 34, 0);
        this.dysonInnerRingSpinGroup.add(node);
      }

      this.dysonInnerRingGroup.add(this.dysonInnerRingSpinGroup);
      dysonGroup.add(this.dysonInnerRingGroup);

      this.celestialGroup.add(dysonGroup);

    } else if (sec.id === 'hypernova') {
      // 9. CASSIOPEIA A // HYPERNOVA REMNANT
      const hyperGroup = new THREE.Group();
      hyperGroup.position.set(36, 10, -142);

      // Pulsing Quark Core
      const coreGeo = new THREE.SphereGeometry(9, 24, 24);
      const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending });
      this.hyperCore = new THREE.Mesh(coreGeo, coreMat);
      hyperGroup.add(this.hyperCore);

      // Inner Turquoise Relativistic Shockwave Shell
      const shell1Geo = new THREE.RingGeometry(18, 30, 48);
      const shell1Mat = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      this.hyperShellInner = new THREE.Mesh(shell1Geo, shell1Mat);
      hyperGroup.add(this.hyperShellInner);

      // Outer Fiery Gold Blast Envelope
      const shell2Geo = new THREE.RingGeometry(32, 60, 48);
      const shell2Mat = new THREE.MeshBasicMaterial({
        color: 0xff5500,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      this.hyperShellOuter = new THREE.Mesh(shell2Geo, shell2Mat);
      hyperGroup.add(this.hyperShellOuter);

      this.celestialGroup.add(hyperGroup);

    } else if (sec.id === 'crystalline_entity') {
      // 10. EPSILON MATRIX // CRYSTALLINE ENTITY (Dynamic Refraction, Specular Reflection & Holodeck Bounce Optics)
      const entityGroup = new THREE.Group();
      entityGroup.position.set(34, 10, -142);

      // Faceted Icosahedron Core Lattice
      const entityGeo = (THREE.IcosahedronGeometry ? new THREE.IcosahedronGeometry(22, 1) : new THREE.SphereGeometry(22, 12, 12));
      const entityMat = new THREE.MeshStandardMaterial({
        color: 0xee33ff,
        emissive: 0x8800cc,
        emissiveIntensity: 0.85,
        roughness: 0.05,
        metalness: 0.92,
        wireframe: false
      });
      this.crystalEntity = new THREE.Mesh(entityGeo, entityMat);
      entityGroup.add(this.crystalEntity);

      // Inner White Resonance Core
      const innerCoreGeo = (THREE.OctahedronGeometry ? new THREE.OctahedronGeometry(10, 0) : new THREE.SphereGeometry(10, 8, 8));
      const innerCoreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending });
      const innerCore = new THREE.Mesh(innerCoreGeo, innerCoreMat);
      this.crystalEntity.add(innerCore);

      // Orbiting Crystal Satellites & Faint Interconnecting Vertex Lines
      this.crystalShardsGroup = new THREE.Group();
      this.crystalSatellites = [];

      const shardGeo = (THREE.OctahedronGeometry ? new THREE.OctahedronGeometry(4.5, 0) : new THREE.SphereGeometry(4.5, 6, 6));
      const shardPositions = [];

      for (let s = 0; s < 6; s++) {
        // High-reflectivity crystalline facet material
        const shardMat = new THREE.MeshStandardMaterial({
          color: 0x00ffff,
          emissive: 0x0088cc,
          emissiveIntensity: 0.80,
          roughness: 0.05,
          metalness: 0.95
        });
        const shard = new THREE.Mesh(shardGeo, shardMat);
        const angle = (s / 6) * Math.PI * 2;
        const sx = Math.cos(angle) * 36;
        const sy = Math.sin(angle) * 24;
        const sz = Math.sin(angle * 2) * 12;
        shard.position.set(sx, sy, sz);
        this.crystalShardsGroup.add(shard);
        this.crystalSatellites.push(shard);
        shardPositions.push(new THREE.Vector3(sx, sy, sz));
      }

      // Faint crystalline vertex lines connecting satellites in 3D matrix lattice
      const linePositions = [];
      for (let s = 0; s < 6; s++) {
        const next = (s + 1) % 6;
        // 1. Perimeter ring links between adjacent satellites
        linePositions.push(shardPositions[s].x, shardPositions[s].y, shardPositions[s].z);
        linePositions.push(shardPositions[next].x, shardPositions[next].y, shardPositions[next].z);

        // 2. Cross-diagonal geometric lattice struts between opposing satellites
        const diag = (s + 2) % 6;
        linePositions.push(shardPositions[s].x, shardPositions[s].y, shardPositions[s].z);
        linePositions.push(shardPositions[diag].x, shardPositions[diag].y, shardPositions[diag].z);

        // 3. Faint resonant focal filaments to central origin
        linePositions.push(shardPositions[s].x, shardPositions[s].y, shardPositions[s].z);
        linePositions.push(0, 0, 0);
      }

      const matrixLineGeo = new THREE.BufferGeometry();
      matrixLineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePositions), 3));
      this.crystalLatticeMat = (THREE.LineBasicMaterial ? new THREE.LineBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.32,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      }) : new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: true, transparent: true, opacity: 0.32 }));

      const matrixLattice = (THREE.LineSegments ? new THREE.LineSegments(matrixLineGeo, this.crystalLatticeMat) : new THREE.Mesh(matrixLineGeo, this.crystalLatticeMat));
      this.crystalShardsGroup.add(matrixLattice);

      entityGroup.add(this.crystalShardsGroup);
      this.celestialGroup.add(entityGroup);
    }
  }
  buildHolodeckRoom() {
    const roomWidth = 42;
    const roomHeight = 25;
    const roomDepth = 65;
    const roomCenterZ = -roomDepth / 2 + 10; // Center Z = -22.5, Spanning Z = -55.0 to Z = +10.0

    // --- A. Standard LCARS Gold Grid Textures (Transparent background so celestial objects are crystal clear!) ---
    const createStandardFloorGridTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512; canvas.height = 1024;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, 512, 1024);

      // Subtle dark depth gradient that does NOT block stars
      const bgGrad = ctx.createLinearGradient(0, 0, 0, 1024);
      bgGrad.addColorStop(0.0, 'rgba(2, 3, 6, 0.35)');
      bgGrad.addColorStop(0.5, 'rgba(4, 6, 12, 0.20)');
      bgGrad.addColorStop(1.0, 'rgba(6, 8, 16, 0.12)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 512, 1024);

      // Longitudinal lines running back to front (14 columns)
      const lineGrad = ctx.createLinearGradient(0, 0, 0, 1024);
      lineGrad.addColorStop(0.0, 'rgba(90, 65, 12, 0.50)');   // Deep back: subtle dark gold
      lineGrad.addColorStop(0.40, 'rgba(175, 125, 18, 0.75)');
      lineGrad.addColorStop(0.75, 'rgba(235, 180, 25, 0.92)');
      lineGrad.addColorStop(1.0, 'rgba(248, 200, 34, 1.0)');  // Front POV: Vibrant LCARS gold
      
      const cols = 14;
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = lineGrad;
      for (let c = 0; c <= cols; c++) {
        const x = (c / cols) * 512;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 1024);
        ctx.stroke();
      }

      // Transverse lines stepping forward along depth (22 rows)
      const rows = 22;
      for (let r = 0; r <= rows; r++) {
        const y = (r / rows) * 1024;
        const p = r / rows;
        let color = '#553c0a'; // subtle dark gold at rear
        if (p > 0.75) color = '#f8c822';
        else if (p > 0.45) color = '#c89614';
        else if (p > 0.20) color = '#886210';

        ctx.strokeStyle = color;
        ctx.lineWidth = (r === 0 || r === rows) ? 4.5 : 2.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(512, y);
        ctx.stroke();
      }
      return new THREE.CanvasTexture(canvas);
    };

    const createStandardLeftWallGridTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1024; canvas.height = 512;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, 1024, 512);

      const bgGrad = ctx.createLinearGradient(0, 0, 1024, 0);
      bgGrad.addColorStop(0.0, 'rgba(6, 8, 16, 0.12)');
      bgGrad.addColorStop(0.5, 'rgba(4, 6, 12, 0.20)');
      bgGrad.addColorStop(1.0, 'rgba(2, 3, 6, 0.35)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 1024, 512);

      const lineGrad = ctx.createLinearGradient(1024, 0, 0, 0);
      lineGrad.addColorStop(0.0, 'rgba(90, 65, 12, 0.50)');
      lineGrad.addColorStop(0.40, 'rgba(175, 125, 18, 0.75)');
      lineGrad.addColorStop(0.75, 'rgba(235, 180, 25, 0.92)');
      lineGrad.addColorStop(1.0, 'rgba(248, 200, 34, 1.0)');

      const rows = 8;
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = lineGrad;
      for (let r = 0; r <= rows; r++) {
        const y = (r / rows) * 512;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1024, y); ctx.stroke();
      }

      const cols = 22;
      for (let c = 0; c <= cols; c++) {
        const x = (c / cols) * 1024;
        const p = 1.0 - (c / cols);
        let color = '#553c0a';
        if (p > 0.75) color = '#f8c822';
        else if (p > 0.45) color = '#c89614';
        else if (p > 0.20) color = '#886210';

        ctx.strokeStyle = color;
        ctx.lineWidth = (c === 0 || c === cols) ? 4.5 : 2.5;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke();
      }
      return new THREE.CanvasTexture(canvas);
    };

    const createStandardRightWallGridTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1024; canvas.height = 512;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, 1024, 512);

      const bgGrad = ctx.createLinearGradient(0, 0, 1024, 0);
      bgGrad.addColorStop(0.0, 'rgba(2, 3, 6, 0.35)');
      bgGrad.addColorStop(0.5, 'rgba(4, 6, 12, 0.20)');
      bgGrad.addColorStop(1.0, 'rgba(6, 8, 16, 0.12)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 1024, 512);

      const lineGrad = ctx.createLinearGradient(0, 0, 1024, 0);
      lineGrad.addColorStop(0.0, 'rgba(90, 65, 12, 0.50)');
      lineGrad.addColorStop(0.40, 'rgba(175, 125, 18, 0.75)');
      lineGrad.addColorStop(0.75, 'rgba(235, 180, 25, 0.92)');
      lineGrad.addColorStop(1.0, 'rgba(248, 200, 34, 1.0)');

      const rows = 8;
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = lineGrad;
      for (let r = 0; r <= rows; r++) {
        const y = (r / rows) * 512;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1024, y); ctx.stroke();
      }

      const cols = 22;
      for (let c = 0; c <= cols; c++) {
        const x = (c / cols) * 1024;
        const p = c / cols;
        let color = '#553c0a';
        if (p > 0.75) color = '#f8c822';
        else if (p > 0.45) color = '#c89614';
        else if (p > 0.20) color = '#886210';

        ctx.strokeStyle = color;
        ctx.lineWidth = (c === 0 || c === cols) ? 4.5 : 2.5;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke();
      }
      return new THREE.CanvasTexture(canvas);
    };

    // Transparent Rear Panel / Back Wall Texture (Z = -55) -> 100% unobstructed view of cosmic objects!
    const createStandardBackWallGridTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512; canvas.height = 512;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, 512, 512);

      // Subtle dark vignette border
      ctx.strokeStyle = '#664a10';
      ctx.lineWidth = 4.0;
      ctx.strokeRect(0, 0, 512, 512);

      ctx.strokeStyle = '#3d2805';
      ctx.lineWidth = 1.8;
      const cols = 14, rows = 8;
      for (let c = 1; c < cols; c++) {
        const x = (c / cols) * 512;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke();
      }
      for (let r = 1; r < rows; r++) {
        const y = (r / rows) * 512;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke();
      }
      return new THREE.CanvasTexture(canvas);
    };

    this.standardFloorTex = createStandardFloorGridTexture();
    this.standardLeftWallTex = createStandardLeftWallGridTexture();
    this.standardRightWallTex = createStandardRightWallGridTexture();
    this.standardBackTex = createStandardBackWallGridTexture();

    // --- B. Betelgeuse Burning Sunset Gradient Grid Textures (Transparent background) ---
    const createSunsetGradient = (ctx, x0, y0, x1, y1) => {
      const grad = ctx.createLinearGradient(x0, y0, x1, y1);
      grad.addColorStop(0.0, 'rgba(85, 25, 8, 0.45)');   // Deep Back (Z = -55): Dark burnt ember
      grad.addColorStop(0.20, 'rgba(175, 36, 0, 0.70)'); // Mid-Back: Deep molten crimson
      grad.addColorStop(0.45, 'rgba(240, 75, 0, 0.88)'); // Mid-Room: Burning sunset orange
      grad.addColorStop(0.72, 'rgba(255, 145, 12, 0.96)');// Forward: Radiant sunset amber
      grad.addColorStop(1.0, 'rgba(255, 215, 55, 1.0)');  // Front (POV Z = +10): Blazing solar sunburst gold!
      return grad;
    };

    const createBetelgeuseFloorGridTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512; canvas.height = 1024;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, 512, 1024);

      const bgGrad = ctx.createLinearGradient(0, 0, 0, 1024);
      bgGrad.addColorStop(0.0, 'rgba(3, 4, 8, 0.35)');
      bgGrad.addColorStop(0.5, 'rgba(6, 6, 12, 0.20)');
      bgGrad.addColorStop(1.0, 'rgba(12, 8, 14, 0.12)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 512, 1024);

      const sunsetGrad = createSunsetGradient(ctx, 0, 0, 0, 1024);
      const cols = 14;
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = sunsetGrad;
      for (let c = 0; c <= cols; c++) {
        const x = (c / cols) * 512;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 1024);
        ctx.stroke();
      }

      const rows = 22;
      for (let r = 0; r <= rows; r++) {
        const y = (r / rows) * 1024;
        const p = r / rows;
        let color = '#4b1606';
        if (p > 0.8) color = '#ffd737';
        else if (p > 0.6) color = '#ff8c0a';
        else if (p > 0.35) color = '#eb4600';
        else if (p > 0.15) color = '#a02000';

        ctx.strokeStyle = color;
        ctx.lineWidth = (r === 0 || r === rows) ? 4.5 : 2.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(512, y);
        ctx.stroke();
      }
      return new THREE.CanvasTexture(canvas);
    };

    const createBetelgeuseLeftWallGridTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1024; canvas.height = 512;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, 1024, 512);

      const bgGrad = ctx.createLinearGradient(0, 0, 1024, 0);
      bgGrad.addColorStop(0.0, 'rgba(12, 8, 14, 0.12)');
      bgGrad.addColorStop(0.5, 'rgba(6, 6, 12, 0.20)');
      bgGrad.addColorStop(1.0, 'rgba(3, 4, 8, 0.35)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 1024, 512);

      const sunsetGrad = createSunsetGradient(ctx, 1024, 0, 0, 0);
      const rows = 8;
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = sunsetGrad;
      for (let r = 0; r <= rows; r++) {
        const y = (r / rows) * 512;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1024, y); ctx.stroke();
      }

      const cols = 22;
      for (let c = 0; c <= cols; c++) {
        const x = (c / cols) * 1024;
        const p = 1.0 - (c / cols);
        let color = '#4b1606';
        if (p > 0.8) color = '#ffd737';
        else if (p > 0.6) color = '#ff8c0a';
        else if (p > 0.35) color = '#eb4600';
        else if (p > 0.15) color = '#a02000';

        ctx.strokeStyle = color;
        ctx.lineWidth = (c === 0 || c === cols) ? 4.5 : 2.5;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke();
      }
      return new THREE.CanvasTexture(canvas);
    };

    const createBetelgeuseRightWallGridTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1024; canvas.height = 512;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, 1024, 512);

      const bgGrad = ctx.createLinearGradient(0, 0, 1024, 0);
      bgGrad.addColorStop(0.0, 'rgba(3, 4, 8, 0.35)');
      bgGrad.addColorStop(0.5, 'rgba(6, 6, 12, 0.20)');
      bgGrad.addColorStop(1.0, 'rgba(12, 8, 14, 0.12)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 1024, 512);

      const sunsetGrad = createSunsetGradient(ctx, 0, 0, 1024, 0);
      const rows = 8;
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = sunsetGrad;
      for (let r = 0; r <= rows; r++) {
        const y = (r / rows) * 512;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1024, y); ctx.stroke();
      }

      const cols = 22;
      for (let c = 0; c <= cols; c++) {
        const x = (c / cols) * 1024;
        const p = c / cols;
        let color = '#4b1606';
        if (p > 0.8) color = '#ffd737';
        else if (p > 0.6) color = '#ff8c0a';
        else if (p > 0.35) color = '#eb4600';
        else if (p > 0.15) color = '#a02000';

        ctx.strokeStyle = color;
        ctx.lineWidth = (c === 0 || c === cols) ? 4.5 : 2.5;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke();
      }
      return new THREE.CanvasTexture(canvas);
    };

    const createBetelgeuseBackWallGridTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512; canvas.height = 512;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, 512, 512);

      ctx.strokeStyle = '#4a1606';
      ctx.lineWidth = 4;
      ctx.strokeRect(0, 0, 512, 512);

      ctx.strokeStyle = '#280f04';
      ctx.lineWidth = 1.8;
      const cols = 14, rows = 8;
      for (let c = 1; c < cols; c++) {
        const x = (c / cols) * 512;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke();
      }
      for (let r = 1; r < rows; r++) {
        const y = (r / rows) * 512;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke();
      }
      return new THREE.CanvasTexture(canvas);
    };

    this.betelgeuseFloorTex = createBetelgeuseFloorGridTexture();
    this.betelgeuseLeftWallTex = createBetelgeuseLeftWallGridTexture();
    this.betelgeuseRightWallTex = createBetelgeuseRightWallGridTexture();
    this.betelgeuseBackWallTex = createBetelgeuseBackWallGridTexture();

    // 1. Floor Mesh (Y = -12.5, Z centered at -22.5)
    const floorGeo = new THREE.PlaneGeometry(roomWidth, roomDepth);
    const floorMat = new THREE.MeshStandardMaterial({
      map: this.standardFloorTex,
      roughness: 0.88,
      metalness: 0.05,
      transparent: true,
      opacity: 0.85
    });
    this.roomFloor = new THREE.Mesh(floorGeo, floorMat);
    this.roomFloor.position.x = 0;
    this.roomFloor.position.y = -roomHeight / 2;
    this.roomFloor.position.z = roomCenterZ;
    this.roomFloor.rotation.x = -Math.PI / 2;
    this.roomFloor.rotation.y = 0;
    this.roomFloor.rotation.z = 0;
    this.scene.add(this.roomFloor);

    // 2. Ceiling Mesh (Y = +12.5, Z centered at -22.5)
    const ceilingMat = new THREE.MeshStandardMaterial({
      map: this.standardFloorTex,
      roughness: 0.88,
      metalness: 0.05,
      transparent: true,
      opacity: 0.85
    });
    this.roomCeiling = new THREE.Mesh(floorGeo, ceilingMat);
    this.roomCeiling.position.x = 0;
    this.roomCeiling.position.y = roomHeight / 2;
    this.roomCeiling.position.z = roomCenterZ;
    this.roomCeiling.rotation.x = Math.PI / 2;
    this.roomCeiling.rotation.y = 0;
    this.roomCeiling.rotation.z = Math.PI;
    this.scene.add(this.roomCeiling);

    // 3. Left Wall Mesh (X = -21.0, Z centered at -22.5)
    const sideGeo = new THREE.PlaneGeometry(roomDepth, roomHeight);
    const leftWallMat = new THREE.MeshStandardMaterial({
      map: this.standardLeftWallTex,
      roughness: 0.85,
      metalness: 0.05,
      transparent: true,
      opacity: 0.82
    });
    this.roomLeftWall = new THREE.Mesh(sideGeo, leftWallMat);
    this.roomLeftWall.position.x = -roomWidth / 2;
    this.roomLeftWall.position.y = 0;
    this.roomLeftWall.position.z = roomCenterZ;
    this.roomLeftWall.rotation.x = 0;
    this.roomLeftWall.rotation.y = Math.PI / 2;
    this.roomLeftWall.rotation.z = 0;
    this.scene.add(this.roomLeftWall);

    // 4. Right Wall Mesh (X = +21.0, Z centered at -22.5)
    const rightWallMat = new THREE.MeshStandardMaterial({
      map: this.standardRightWallTex,
      roughness: 0.85,
      metalness: 0.05,
      transparent: true,
      opacity: 0.82
    });
    this.roomRightWall = new THREE.Mesh(sideGeo, rightWallMat);
    this.roomRightWall.position.x = roomWidth / 2;
    this.roomRightWall.position.y = 0;
    this.roomRightWall.position.z = roomCenterZ;
    this.roomRightWall.rotation.x = 0;
    this.roomRightWall.rotation.y = -Math.PI / 2;
    this.roomRightWall.rotation.z = 0;
    this.scene.add(this.roomRightWall);

    // 5. Deep Dark Back Wall Mesh (Z = -55.0, Transparent Matrix)
    const backGeo = new THREE.PlaneGeometry(roomWidth, roomHeight);
    const backWallMat = new THREE.MeshStandardMaterial({
      map: this.standardBackTex,
      roughness: 0.90,
      metalness: 0.05,
      transparent: true,
      opacity: 0.75
    });
    this.roomBackWall = new THREE.Mesh(backGeo, backWallMat);
    this.roomBackWall.position.x = 0;
    this.roomBackWall.position.y = 0;
    this.roomBackWall.position.z = -roomDepth + 10;
    this.roomBackWall.rotation.x = 0;
    this.roomBackWall.rotation.y = 0;
    this.roomBackWall.rotation.z = 0;
    this.scene.add(this.roomBackWall);
  }

  updateRoomGridForSector(sectorId) {
    if (!this.roomFloor || !this.roomCeiling || !this.roomLeftWall || !this.roomRightWall || !this.roomBackWall) return;

    if (sectorId === 'betelgeuse') {
      this.roomFloor.material.map = this.betelgeuseFloorTex;
      this.roomCeiling.material.map = this.betelgeuseFloorTex;
      this.roomLeftWall.material.map = this.betelgeuseLeftWallTex;
      this.roomRightWall.material.map = this.betelgeuseRightWallTex;
      this.roomBackWall.material.map = this.betelgeuseBackWallTex;
    } else {
      this.roomFloor.material.map = this.standardFloorTex;
      this.roomCeiling.material.map = this.standardFloorTex;
      this.roomLeftWall.material.map = this.standardLeftWallTex;
      this.roomRightWall.material.map = this.standardRightWallTex;
      this.roomBackWall.material.map = this.standardBackTex;
    }

    this.roomFloor.material.needsUpdate = true;
    this.roomCeiling.material.needsUpdate = true;
    this.roomLeftWall.material.needsUpdate = true;
    this.roomRightWall.material.needsUpdate = true;
    this.roomBackWall.material.needsUpdate = true;
  }

  buildPhaserCannon() {
    const group = new THREE.Group();

    const bodyGeo = new THREE.CylinderGeometry(0.18, 0.3, 1.6, 16);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.8, roughness: 0.2 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.rotation.x = Math.PI / 2;
    group.add(body);

    const ringGeo = new THREE.TorusGeometry(0.24, 0.04, 16, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x33ccff });
    this.phaserRing = new THREE.Mesh(ringGeo, ringMat);
    this.phaserRing.position.z = 0.2;
    group.add(this.phaserRing);

    const nozzleGeo = new THREE.ConeGeometry(0.16, 0.4, 16);
    const nozzleMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    const nozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
    nozzle.rotation.x = -Math.PI / 2;
    nozzle.position.z = -0.9;
    group.add(nozzle);

    group.position.set(1.5, -1.2, 7.5);
    this.camera.add(group);
    this.scene.add(this.camera);
    this.phaserMesh = group;
  }

  create3DNumeralGroup(strVal, colorHex = 0x0088ff, glowMult = 1.0, textHlMult = 1.0) {
    const root = new THREE.Group();
    const str = String(strVal || '');
    if (!str) return root;
    const chars = str.split('');

    this.initNumeralGeos();

    const H_SEG = (this.numeralGeos && this.numeralGeos.H_SEG) || new THREE.BoxGeometry(0.58, 0.15, 0.06);
    const V_SEG = (this.numeralGeos && this.numeralGeos.V_SEG) || new THREE.BoxGeometry(0.15, 0.50, 0.06);
    const D_SEG = (this.numeralGeos && this.numeralGeos.D_SEG) || new THREE.BoxGeometry(0.15, 0.15, 0.06);
    const MINUS_SEG = (this.numeralGeos && this.numeralGeos.MINUS_SEG) || new THREE.BoxGeometry(0.46, 0.15, 0.06);
    const SIX_UNDERLINE = (this.numeralGeos && this.numeralGeos.SIX_UNDERLINE) || new THREE.BoxGeometry(0.72, 0.09, 0.05);

    const safeHl = typeof textHlMult === 'number' ? textHlMult : 1.0;
    const safeGlow = typeof glowMult === 'number' ? glowMult : 1.0;

    const whiteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.95 * Math.min(2.5, Math.max(0.4, safeHl)),
      roughness: 0.12,
      metalness: 0.05
    });

    const edgeMat = (typeof THREE.LineBasicMaterial === 'function')
      ? new THREE.LineBasicMaterial({ color: colorHex, linewidth: 2 })
      : new THREE.MeshBasicMaterial({ color: colorHex });

    const segPositions = {
      a: { geo: H_SEG, edgeGeo: this.numeralEdgeGeos && this.numeralEdgeGeos.H_SEG, pos: [0, 0.52, 0] },
      b: { geo: V_SEG, edgeGeo: this.numeralEdgeGeos && this.numeralEdgeGeos.V_SEG, pos: [0.28, 0.25, 0] },
      c: { geo: V_SEG, edgeGeo: this.numeralEdgeGeos && this.numeralEdgeGeos.V_SEG, pos: [0.28, -0.25, 0] },
      d: { geo: H_SEG, edgeGeo: this.numeralEdgeGeos && this.numeralEdgeGeos.H_SEG, pos: [0, -0.52, 0] },
      e: { geo: V_SEG, edgeGeo: this.numeralEdgeGeos && this.numeralEdgeGeos.V_SEG, pos: [-0.28, -0.25, 0] },
      f: { geo: V_SEG, edgeGeo: this.numeralEdgeGeos && this.numeralEdgeGeos.V_SEG, pos: [-0.28, 0.25, 0] },
      g: { geo: H_SEG, edgeGeo: this.numeralEdgeGeos && this.numeralEdgeGeos.H_SEG, pos: [0, 0, 0] },
      minus: { geo: MINUS_SEG, edgeGeo: this.numeralEdgeGeos && this.numeralEdgeGeos.MINUS_SEG, pos: [0, 0, 0] },
      dot: { geo: D_SEG, edgeGeo: this.numeralEdgeGeos && this.numeralEdgeGeos.D_SEG, pos: [0, -0.52, 0] }
    };

    const digitMap = {
      '0': ['a', 'b', 'c', 'd', 'e', 'f'],
      '1': ['b', 'c'],
      '2': ['a', 'b', 'g', 'e', 'd'],
      '3': ['a', 'b', 'g', 'c', 'd'],
      '4': ['f', 'g', 'b', 'c'],
      '5': ['a', 'f', 'g', 'c', 'd'],
      '6': ['a', 'f', 'e', 'd', 'c', 'g'],
      '7': ['a', 'b', 'c'],
      '8': ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
      '9': ['a', 'b', 'c', 'd', 'f', 'g'],
      '-': ['minus'],
      '.': ['dot']
    };

    const charWidth = 0.88;
    const totalWidth = (chars.length - 1) * charWidth;
    const startX = -totalWidth / 2;

    chars.forEach((ch, idx) => {
      const charGroup = new THREE.Group();
      const charX = startX + idx * charWidth;
      charGroup.position.set(charX, 0, 0);

      const activeSegs = digitMap[ch] || ['g'];
      activeSegs.forEach(segKey => {
        const s = segPositions[segKey];
        if (!s) return;
        const mesh = new THREE.Mesh(s.geo, whiteMat);
        mesh.position.set(s.pos[0], s.pos[1], s.pos[2]);

        if (typeof THREE.LineSegments === 'function' && s.edgeGeo) {
          const edges = new THREE.LineSegments(s.edgeGeo, edgeMat);
          mesh.add(edges);
        } else if (typeof THREE.EdgesGeometry === 'function' && typeof THREE.LineSegments === 'function') {
          const edges = new THREE.LineSegments(new THREE.EdgesGeometry(s.geo), edgeMat);
          mesh.add(edges);
        }
        charGroup.add(mesh);
      });

      if (ch === '6' && str.trim() === '6') {
        const ulMesh = new THREE.Mesh(SIX_UNDERLINE, whiteMat);
        ulMesh.position.set(0, -0.76, 0);
        const ulEdgeGeo = this.numeralEdgeGeos && this.numeralEdgeGeos.SIX_UNDERLINE;
        if (typeof THREE.LineSegments === 'function' && ulEdgeGeo) {
          const ulEdges = new THREE.LineSegments(ulEdgeGeo, edgeMat);
          ulMesh.add(ulEdges);
        } else if (typeof THREE.EdgesGeometry === 'function' && typeof THREE.LineSegments === 'function') {
          const ulEdges = new THREE.LineSegments(new THREE.EdgesGeometry(SIX_UNDERLINE), edgeMat);
          ulMesh.add(ulEdges);
        }
        charGroup.add(ulMesh);
      }

      root.add(charGroup);
    });

    // Real Physical 3D Numeral PointLight
    if (typeof THREE.PointLight === 'function') {
      const numLight = new THREE.PointLight(colorHex, 2.2 * Math.max(0.2, safeHl), 8.0, 1.8);
      numLight.position.set(0, 0, 0.15);
      root.add(numLight);
      root.userData = { whiteMat, edgeMat, numLight, colorHex };
    } else {
      root.userData = { whiteMat, edgeMat, colorHex };
    }

    return root;
  }

  createTargetTexture(text, isCharging = false, targetId = '01', choiceIndex = 0) {
    const numIdx = typeof choiceIndex === 'number' ? (choiceIndex % 4) : 0;
    if (!this.targetCanvasPool || this.targetCanvasPool.length < 4) {
      this.initTargetCanvasPool();
    }

    const canvas = (this.targetCanvasPool && this.targetCanvasPool[numIdx]) || document.createElement('canvas');
    if (!canvas.width) { canvas.width = 1024; canvas.height = 640; }
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (ctx.save) ctx.save();
    // Normalize rendering coordinate space to 1024x640 design baseline
    if (ctx.scale) ctx.scale(canvas.width / 1024, canvas.height / 640);

    const glowMult = typeof this.testGlowMult === 'number' ? this.testGlowMult : 1.0;

    const lightedBoxPalettes = [
      { // Slot [1]: Radiant Coral Peach Lighted Box
        base: '#ff6f59',
        bright: '#ffa090',
        glow: '#ff6f59',
        faceTop: 'rgba(175, 50, 32, 0.96)',
        faceMid: 'rgba(135, 36, 22, 0.96)',
        faceBottom: 'rgba(95, 24, 14, 0.98)'
      },
      { // Slot [2]: Electric Cobalt Blue Lighted Box
        base: '#0088ff',
        bright: '#88ccff',
        glow: '#0088ff',
        faceTop: 'rgba(0, 95, 210, 0.96)',
        faceMid: 'rgba(0, 65, 160, 0.96)',
        faceBottom: 'rgba(0, 38, 110, 0.98)'
      },
      { // Slot [3]: Vibrant Radiant Pink Lighted Box
        base: '#ee66cc',
        bright: '#ffaae8',
        glow: '#ee66cc',
        faceTop: 'rgba(175, 45, 145, 0.96)',
        faceMid: 'rgba(130, 28, 105, 0.96)',
        faceBottom: 'rgba(85, 15, 68, 0.98)'
      },
      { // Slot [4]: Blazing Amber / Gold Lighted Box
        base: '#ffbb00',
        bright: '#ffe066',
        glow: '#ffbb00',
        faceTop: 'rgba(195, 125, 10, 0.96)',
        faceMid: 'rgba(150, 90, 6, 0.96)',
        faceBottom: 'rgba(100, 56, 3, 0.98)'
      }
    ];

    const chargingBoxPalette = {
      base: '#ff2222',
      bright: '#ff7777',
      glow: '#ff2222',
      faceTop: 'rgba(210, 25, 25, 0.96)',
      faceMid: 'rgba(150, 12, 12, 0.96)',
      faceBottom: 'rgba(90, 6, 6, 0.98)'
    };

    const pal = isCharging ? chargingBoxPalette : lightedBoxPalettes[numIdx];

    // 1. Clean Self-Illuminating Lighted Box Face
    const faceGrad = ctx.createLinearGradient(0, 16, 0, 624);
    faceGrad.addColorStop(0.0, pal.faceTop);
    faceGrad.addColorStop(0.5, pal.faceMid);
    faceGrad.addColorStop(1.0, pal.faceBottom);
    ctx.fillStyle = faceGrad;
    ctx.roundRect(16, 16, 992, 608, 28);
    ctx.fill();

    // 2. Lighted Box Perimeter Frame & Asymmetrical LCARS Top/Bottom Orientation
    if (ctx.save) ctx.save();
    const frameGlowBlur = Math.round(Math.min(50, 20 * Math.sqrt(Math.max(0.1, glowMult))));
    ctx.shadowColor = pal.glow;
    ctx.shadowBlur = frameGlowBlur;
    ctx.lineWidth = 14;
    ctx.strokeStyle = pal.base;
    ctx.roundRect(20, 20, 984, 600, 26);
    ctx.stroke();

    // Top LCARS Header Bracket & Elbow Notch (Instant Top Reference)
    ctx.fillStyle = pal.base;
    ctx.fillRect(44, 34, 250, 12);
    ctx.fillRect(44, 46, 14, 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px "Share Tech Mono", monospace';
    ctx.fillText(`TAR-${targetId}`, 310, 46);

    // Bottom Solid Grounding Baseline Strip
    ctx.fillStyle = pal.base;
    ctx.fillRect(44, 590, 936, 6);

    if (ctx.restore) {
      ctx.restore(); // restore shadow
      ctx.restore(); // restore scale
    }

    const texture = (this.targetTexturePool && this.targetTexturePool[numIdx]) || new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.isPersistent = true;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    if (this.renderer && this.renderer.capabilities) {
      texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    }
    return texture;
  }

  spawnTargets() {
    this.targetPanels.forEach(p => {
      this.scene.remove(p.mesh);
      this.disposeObject(p.mesh);
    });
    this.targetPanels = [];
    this.attacksThisProblem = 0;
    this.audio.playTransporterBeam(0);

    // Multi-Target Sandbox Infinite Ricochet Test Mode (1 to 4 Targets)
    if (this.mode === 'ricochet_test') {
      this.waveTotalTime = 999.0;
      this.waveRemainingTime = 999.0;

      const count = Math.min(4, Math.max(1, this.testTargetCount || 1));
      const speed = (this.testSpeedMult !== undefined ? this.testSpeedMult : 1.0) * 0.20;
      const spin = this.testSpinMult || 1.0;

      const choices = (this.currentProblem && this.currentProblem.choices) ? this.currentProblem.choices : [4, 8, 12, 16];

      // Distinct, organic rotation profiles so each target rotates at a unique rate & trajectory in test mode
      const sandboxSpinProfiles = [
        { rotX: 0.0065, rotY: 0.0140, signX: 1,  signY: 1  }, // Target 1: Smooth horizontal yaw-dominant sweep
        { rotX: 0.0125, rotY: 0.0075, signX: -1, signY: 1  }, // Target 2: Pitch-dominant asymmetric tumble
        { rotX: 0.0080, rotY: 0.0175, signX: 1,  signY: -1 }, // Target 3: Brisk counter-spin yaw sweep
        { rotX: 0.0145, rotY: 0.0110, signX: -1, signY: -1 }  // Target 4: Dynamic compound tumble
      ];

      for (let i = 0; i < count; i++) {
        const val = choices[i % choices.length] || (i + 1);
        const colorIdx = i % 4;
        const choiceHexes = [0xff6f59, 0x0088ff, 0xee66cc, 0xffbb00];
        const choiceCss = ['#ff6f59', '#0088ff', '#ee66cc', '#ffbb00'];
        const choiceEmissives = [0x601c10, 0x003388, 0x550e44, 0x553300];

        const curGlowMult = typeof this.testGlowMult === 'number' ? this.testGlowMult : 1.0;
        const textHlMult = typeof this.testTextHighlightMult === 'number' ? this.testTextHighlightMult : 1.0;
        const geo = this.sharedTargetBoxGeo || new THREE.BoxGeometry(4.4, 2.9, 0.75);
        const tex = this.createTargetTexture('', false, `0${i + 1}`, colorIdx);
        const mat = new THREE.MeshStandardMaterial({
          map: tex,
          roughness: 0.15,
          metalness: 0.10,
          emissive: choiceEmissives[colorIdx],
          emissiveIntensity: 0.85 * Math.min(2.5, Math.max(0.2, curGlowMult))
        });
        const panel = new THREE.Mesh(geo, mat);

        // Radiant 3D Physical PointLight projecting the 3D target shape's light onto room & walls
        const internalLight = new THREE.PointLight(choiceHexes[colorIdx], 2.8 * Math.max(0.1, curGlowMult), 16.0, 1.5);
        internalLight.position.set(0, 0, 0.20);
        panel.add(internalLight);

        // 3D Geometric Numerals with Cybernetic Colored Edges (Front & Back Faces)
        const numGroupFront = this.create3DNumeralGroup(String(val), choiceHexes[colorIdx], curGlowMult, textHlMult);
        numGroupFront.position.set(0, 0, 0.385);
        panel.add(numGroupFront);

        const numGroupBack = this.create3DNumeralGroup(String(val), choiceHexes[colorIdx], curGlowMult, textHlMult);
        numGroupBack.position.set(0, 0, -0.385);
        numGroupBack.rotation.y = Math.PI;
        panel.add(numGroupBack);

        const xPos = (i - (count - 1) / 2) * 8.5 + (Math.random() * 1.5 - 0.75);
        const yPos = (i % 2 === 0 ? 3.0 : -3.0) + (Math.random() * 1.5 - 0.75);
        const zPos = -28 - (i * 4);

        panel.position.set(xPos, yPos, zPos);
        // Holodeck Transporter Beam-In Initial State (Thin vertical shimmer)
        panel.scale.set(0.02, 1.8, 0.02);
        if (mat) { mat.transparent = true; mat.opacity = 0.05; }
        this.scene.add(panel);

        const baseVx = (i % 2 === 0 ? 1 : -1) * (0.34 + Math.random() * 0.08);
        const baseVy = ((i + 1) % 2 === 0 ? 1 : -1) * (0.26 + Math.random() * 0.06);
        const baseVz = (i % 3 === 0 ? 1 : -1) * (0.20 + Math.random() * 0.06);

        const sp = sandboxSpinProfiles[i % sandboxSpinProfiles.length];
        const baseRotX = sp.rotX * sp.signX;
        const baseRotY = sp.rotY * sp.signY;

        this.targetPanels.push({
          mesh: panel,
          internalLight: internalLight,
          numGroupFront: numGroupFront,
          numGroupBack: numGroupBack,
          spawnProgress: 0.0,
          value: val,
          index: i + 1,
          choiceIndex: colorIdx,
          choiceColorHex: choiceHexes[colorIdx],
          choiceColorCss: choiceCss[colorIdx],
          isCorrect: true,
          baseVx: baseVx,
          baseVy: baseVy,
          baseVz: baseVz,
          vx: baseVx * speed,
          vy: baseVy * speed,
          vz: baseVz * speed,
          baseRotX: baseRotX,
          baseRotY: baseRotY,
          rotX: baseRotX * spin,
          rotY: baseRotY * spin,
          isAttacking: false
        });
      }

      document.getElementById('red-alert-flash').classList.remove('active');
      return;
    }

    const choices = this.currentProblem.choices;
    const count = choices.length;

    this.waveTotalTime = this.calculateWaveTimeLimit(this.level);
    this.waveRemainingTime = this.waveTotalTime;

    choices.forEach((val, i) => {
      const colorIdx = i % 4;
      const choiceHexes = [0xff6f59, 0x0088ff, 0xee66cc, 0xffbb00];
      const choiceCss = ['#ff6f59', '#0088ff', '#ee66cc', '#ffbb00'];
      const choiceEmissives = [0x601c10, 0x003388, 0x550e44, 0x553300];

      const curGlowMult = typeof this.testGlowMult === 'number' ? this.testGlowMult : 1.0;
      const textHlMult = typeof this.testTextHighlightMult === 'number' ? this.testTextHighlightMult : 1.0;
      const geo = this.sharedTargetBoxGeo || new THREE.BoxGeometry(4.4, 2.9, 0.75);
      const tex = this.createTargetTexture('', false, `0${i + 1}`, colorIdx);
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.15,
        metalness: 0.10,
        emissive: choiceEmissives[colorIdx],
        emissiveIntensity: 0.85 * Math.min(2.5, Math.max(0.2, curGlowMult))
      });
      const panel = new THREE.Mesh(geo, mat);

      // Radiant 3D Physical PointLight projecting the 3D target shape's light onto room & walls
      const internalLight = new THREE.PointLight(choiceHexes[colorIdx], 2.8 * Math.max(0.1, curGlowMult), 16.0, 1.5);
      internalLight.position.set(0, 0, 0.20);
      panel.add(internalLight);

      // 3D Geometric Numerals with Cybernetic Colored Edges (Front & Back Faces)
      const numGroupFront = this.create3DNumeralGroup(String(val), choiceHexes[colorIdx], curGlowMult, textHlMult);
      numGroupFront.position.set(0, 0, 0.385);
      panel.add(numGroupFront);

      const numGroupBack = this.create3DNumeralGroup(String(val), choiceHexes[colorIdx], curGlowMult, textHlMult);
      numGroupBack.position.set(0, 0, -0.385);
      numGroupBack.rotation.y = Math.PI;
      panel.add(numGroupBack);

      const xPos = (i - (count - 1) / 2) * 7.4 + (Math.random() * 2 - 1);
      const yPos = (i % 2 === 0 ? 3.4 : -3.4) + (Math.random() * 2 - 1);
      const zPos = -28 - (i * 3);

      panel.position.set(xPos, yPos, zPos);
      this.scene.add(panel);

      // Unified 3D Ricochet Velocity Timings Baseline across all modes
      const speedMult = 0.06 + (this.warpFactor * 0.02);
      const vx = (Math.random() > 0.5 ? 1 : -1) * (0.05 + Math.random() * 0.04) * speedMult * 12;
      const vy = (Math.random() > 0.5 ? 1 : -1) * (0.04 + Math.random() * 0.04) * speedMult * 12;
      const vz = (Math.random() > 0.5 ? 1 : -1) * (0.04 + Math.random() * 0.03);

      this.targetPanels.push({
        mesh: panel,
        internalLight: internalLight,
        numGroupFront: numGroupFront,
        numGroupBack: numGroupBack,
        spawnProgress: 0.0,
        value: val,
        index: i + 1,
        choiceIndex: colorIdx,
        choiceColorHex: choiceHexes[colorIdx],
        choiceColorCss: choiceCss[colorIdx],
        isCorrect: val === this.currentProblem.answer,
        vx: vx,
        vy: vy,
        vz: vz,
        rotX: (Math.random() - 0.5) * 0.015,
        rotY: (Math.random() - 0.5) * 0.02,
        isAttacking: false
      });
    });

    document.getElementById('red-alert-flash').classList.remove('active');
    this.resetHazardTimer();
  }

  resetHazardTimer() {
    if (this.hazardTimer) clearTimeout(this.hazardTimer);
    if (!this.isPlaying || this.isPaused || this.isTransitioning || this.mode === 'ricochet_test') return;

    const minDelay = Math.max(3500, 6500 - (this.level * 200));
    const delay = Math.floor(minDelay + Math.random() * 2500);

    this.hazardTimer = setTimeout(() => {
      if (this.isPlaying && !this.isPaused && !this.isTransitioning) {
        this.triggerTargetAttack();
      }
    }, delay);
  }

  triggerTargetAttack() {
    if (!this.isPlaying || this.isPaused || this.isTransitioning || this.targetPanels.length === 0) return;

    const candidates = this.targetPanels.filter(t => !t.isAttacking);
    if (candidates.length === 0) return;

    // Rule: At least 1 other wrong answer (distractor) must always attack first before the real answer can ever be chosen
    let eligible = candidates;
    if (this.attacksThisProblem === 0) {
      const wrongCandidates = candidates.filter(t => !t.isCorrect);
      if (wrongCandidates.length > 0) {
        eligible = wrongCandidates;
      }
    }

    const attacker = eligible[Math.floor(Math.random() * eligible.length)];
    attacker.isAttacking = true;
    this.attacksThisProblem++;
    
    const redTex = this.createTargetTexture('', true, `0${attacker.index}`, (attacker.index - 1) % 4);
    attacker.mesh.material.map = redTex;
    attacker.mesh.material.emissive.setHex(0x550000);
    attacker.mesh.material.emissiveIntensity = 1.4;
    attacker.mesh.material.needsUpdate = true;

    // Update 3D numeral groups to glowing red attack outline & crimson point light
    if (attacker.numGroupFront) {
      attacker.mesh.remove(attacker.numGroupFront);
      this.disposeObject(attacker.numGroupFront);
    }
    if (attacker.numGroupBack) {
      attacker.mesh.remove(attacker.numGroupBack);
      this.disposeObject(attacker.numGroupBack);
    }
    const textHl = typeof this.testTextHighlightMult === 'number' ? this.testTextHighlightMult : 1.0;
    const curGlow = typeof this.testGlowMult === 'number' ? this.testGlowMult : 1.0;
    attacker.numGroupFront = this.create3DNumeralGroup(String(attacker.value), 0xff2222, curGlow, textHl);
    attacker.numGroupFront.position.set(0, 0, 0.385);
    attacker.mesh.add(attacker.numGroupFront);

    attacker.numGroupBack = this.create3DNumeralGroup(String(attacker.value), 0xff2222, curGlow, textHl);
    attacker.numGroupBack.position.set(0, 0, -0.385);
    attacker.numGroupBack.rotation.y = Math.PI;
    attacker.mesh.add(attacker.numGroupBack);

    attacker.vz = 0.17 + (this.warpFactor * 0.04);
    attacker.vx *= 0.35;
    attacker.vy *= 0.35;

    this.audio.playRedAlert();
    this.showBanner('⚠️ RED ALERT: INCOMING QUANTUM ATTACK!', true);
    document.getElementById('red-alert-flash').classList.add('active');
    this.audio.playVoice('incoming_attack', 'Warning. Quantum projectile incoming.');
  }

  fireProjectile(targetPoint = null, selectedValue = null) {
    this.audio.playLaser();

    if (this.phaserMesh) {
      this.phaserMesh.position.z = 7.7;
      setTimeout(() => { if (this.phaserMesh) this.phaserMesh.position.z = 7.5; }, 80);
    }

    const geo = new THREE.SphereGeometry(0.38, 16, 16);
    const mat = new THREE.MeshBasicMaterial({ color: 0x33ccff });
    const sphere = new THREE.Mesh(geo, mat);

    const origin = new THREE.Vector3(1.5, -1.2, 6.6);
    sphere.position.copy(origin);

    let dir = new THREE.Vector3();
    if (targetPoint) {
      dir.subVectors(targetPoint, origin).normalize();
    } else {
      this.raycaster.setFromCamera(this.mouse, this.camera);
      dir.copy(this.raycaster.ray.direction).normalize();
    }

    this.scene.add(sphere);

    const photonLight = new THREE.PointLight(0x33ccff, 3, 10);
    sphere.add(photonLight);

    this.photonBalls.push({
      mesh: sphere,
      velocity: dir.multiplyScalar(2.3),
      lifespan: 60,
      selectedValue: selectedValue
    });
  }

  createPhotometricLightTexture() {
    if (typeof document === 'undefined') return null;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');

      const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
      grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
      grad.addColorStop(0.15, 'rgba(255, 255, 255, 0.92)');
      grad.addColorStop(0.35, 'rgba(255, 255, 255, 0.60)');
      grad.addColorStop(0.65, 'rgba(255, 255, 255, 0.22)');
      grad.addColorStop(0.88, 'rgba(255, 255, 255, 0.06)');
      grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);

      const tex = new THREE.CanvasTexture(canvas);
      return tex;
    } catch(e) {
      return null;
    }
  }

  spawnIlluminatedGridLines(wallName, contactPos, pulseColor) {
    if (!this.scene) return;

    const linesGroup = new THREE.Group();
    const cx = contactPos.x;
    const cy = contactPos.y;
    const cz = contactPos.z;

    const pulseMat = this.getPulseMaterial(pulseColor);
    const whiteMat = this.sharedWhiteAdditiveMat || (typeof THREE.MeshBasicMaterial === 'function' ? new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1.0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    }) : null);

    const planeGeo = this.sharedPlaneGeo || (typeof THREE.PlaneGeometry === 'function' ? new THREE.PlaneGeometry(1.0, 1.0) : null);
    const diamondGeo = this.sharedDiamondGeo || (typeof THREE.PlaneGeometry === 'function' ? new THREE.PlaneGeometry(0.32, 0.32) : null);

    if (!planeGeo || !pulseMat) return;

    // Case A: Left Wall (X = -21.0) or Right Wall (X = +21.0)
    if (wallName.includes('LEFT WALL') || wallName.includes('RIGHT WALL')) {
      const isLeft = wallName.includes('LEFT WALL');
      const wallX = isLeft ? -20.94 : 20.94;
      const rotY = isLeft ? Math.PI / 2 : -Math.PI / 2;

      // 1. Horizontal grid lines (along Z at constant Y)
      const nearbyY = this.gridLinesY ? this.gridLinesY.filter(y => Math.abs(y - cy) <= 4.5) : [];
      nearbyY.forEach(gridY => {
        const distY = Math.abs(gridY - cy);
        const lenZ = 10.0 - distY * 0.8;
        const mesh = new THREE.Mesh(planeGeo, pulseMat);
        mesh.scale.set(lenZ, 0.12, 1.0);
        mesh.position.set(wallX, gridY, cz);
        mesh.rotation.y = rotY;
        linesGroup.add(mesh);
      });

      // 2. Vertical grid lines (along Y at constant Z)
      const nearbyZ = this.gridLinesZ ? this.gridLinesZ.filter(z => Math.abs(z - cz) <= 5.5) : [];
      nearbyZ.forEach(gridZ => {
        const distZ = Math.abs(gridZ - cz);
        const lenY = 8.5 - distZ * 0.7;
        const mesh = new THREE.Mesh(planeGeo, pulseMat);
        mesh.scale.set(0.12, lenY, 1.0);
        mesh.position.set(wallX, cy, gridZ);
        mesh.rotation.y = rotY;
        linesGroup.add(mesh);
      });

      // 3. Grid Intersection Energy Nodes
      if (diamondGeo && whiteMat) {
        nearbyY.forEach(gridY => {
          nearbyZ.forEach(gridZ => {
            const d = Math.hypot(gridY - cy, gridZ - cz);
            if (d <= 5.0) {
              const nodeMesh = new THREE.Mesh(diamondGeo, whiteMat);
              nodeMesh.position.set(wallX, gridY, gridZ);
              nodeMesh.rotation.y = rotY;
              nodeMesh.rotation.z = Math.PI / 4;
              linesGroup.add(nodeMesh);
            }
          });
        });
      }
    }
    // Case B: Floor (Y = -12.5) or Ceiling (Y = +12.5)
    else if (wallName.includes('FLOOR') || wallName.includes('CEILING')) {
      const isFloor = wallName.includes('FLOOR');
      const wallY = isFloor ? -12.44 : 12.44;
      const rotX = isFloor ? -Math.PI / 2 : Math.PI / 2;

      // 1. Longitudinal grid lines (along Z at constant X)
      const nearbyX = this.gridLinesX ? this.gridLinesX.filter(x => Math.abs(x - cx) <= 5.0) : [];
      nearbyX.forEach(gridX => {
        const distX = Math.abs(gridX - cx);
        const lenZ = 10.0 - distX * 0.8;
        const mesh = new THREE.Mesh(planeGeo, pulseMat);
        mesh.scale.set(0.12, lenZ, 1.0);
        mesh.position.set(gridX, wallY, cz);
        mesh.rotation.x = rotX;
        linesGroup.add(mesh);
      });

      // 2. Transverse grid lines (along X at constant Z)
      const nearbyZ = this.gridLinesZ ? this.gridLinesZ.filter(z => Math.abs(z - cz) <= 5.5) : [];
      nearbyZ.forEach(gridZ => {
        const distZ = Math.abs(gridZ - cz);
        const lenX = 9.0 - distZ * 0.7;
        const mesh = new THREE.Mesh(planeGeo, pulseMat);
        mesh.scale.set(lenX, 0.12, 1.0);
        mesh.position.set(cx, wallY, gridZ);
        mesh.rotation.x = rotX;
        linesGroup.add(mesh);
      });

      // 3. Grid Intersection Energy Nodes
      if (diamondGeo && whiteMat) {
        nearbyX.forEach(gridX => {
          nearbyZ.forEach(gridZ => {
            const d = Math.hypot(gridX - cx, gridZ - cz);
            if (d <= 5.2) {
              const nodeMesh = new THREE.Mesh(diamondGeo, whiteMat);
              nodeMesh.position.set(gridX, wallY, gridZ);
              nodeMesh.rotation.x = rotX;
              nodeMesh.rotation.z = Math.PI / 4;
              linesGroup.add(nodeMesh);
            }
          });
        });
      }
    }
    // Case C: Back Wall (Z = -55.0)
    else if (wallName.includes('BACK WALL')) {
      const wallZ = -54.94;

      const nearbyY = this.gridLinesY ? this.gridLinesY.filter(y => Math.abs(y - cy) <= 4.5) : [];
      nearbyY.forEach(gridY => {
        const distY = Math.abs(gridY - cy);
        const lenX = 9.0 - distY * 0.7;
        const mesh = new THREE.Mesh(planeGeo, pulseMat);
        mesh.scale.set(lenX, 0.12, 1.0);
        mesh.position.set(cx, gridY, wallZ);
        linesGroup.add(mesh);
      });

      const nearbyX = this.gridLinesX ? this.gridLinesX.filter(x => Math.abs(x - cx) <= 4.5) : [];
      nearbyX.forEach(gridX => {
        const distX = Math.abs(gridX - cx);
        const lenY = 8.5 - distX * 0.7;
        const mesh = new THREE.Mesh(planeGeo, pulseMat);
        mesh.scale.set(0.12, lenY, 1.0);
        mesh.position.set(gridX, cy, wallZ);
        linesGroup.add(mesh);
      });

      if (diamondGeo && whiteMat) {
        nearbyX.forEach(gridX => {
          nearbyY.forEach(gridY => {
            const d = Math.hypot(gridX - cx, gridY - cy);
            if (d <= 5.0) {
              const nodeMesh = new THREE.Mesh(diamondGeo, whiteMat);
              nodeMesh.position.set(gridX, gridY, wallZ);
              nodeMesh.rotation.z = Math.PI / 4;
              linesGroup.add(nodeMesh);
            }
          });
        });
      }
    }

    this.scene.add(linesGroup);
    this.illuminatedGridLines.push({
      group: linesGroup,
      life: 1.0,
      decay: 0.040
    });
  }

  createWallImpactPulse(wallName, contactPos, target) {
    if (!this.scene) return;
    const ricochetStartTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

    let pos = new THREE.Vector3().copy(contactPos);
    let sparkNormal = new THREE.Vector3(0, 0, 0);

    // Strictly represent the target's exact multiple choice answer color on wall grid & bounces
    // Slot 1: Peach 0xff9966, Slot 2: Periwinkle 0x66aaff, Slot 3: Mauve/Pink 0xee66cc, Slot 4: Amber 0xffbb00
    const choiceHexes = [0xff6f59, 0x0088ff, 0xee66cc, 0xffbb00];
    const targetIdx = (target && typeof target.choiceIndex === 'number') ? target.choiceIndex : ((target && target.index) ? (target.index - 1) : 0);
    const pulseColor = (target && target.choiceColorHex) ? target.choiceColorHex : (choiceHexes[targetIdx % choiceHexes.length] || 0xff9966);

    if (wallName.includes('LEFT WALL')) {
      pos.x = -20.90;
      sparkNormal.set(1, 0, 0);
    } else if (wallName.includes('RIGHT WALL')) {
      pos.x = 20.90;
      sparkNormal.set(-1, 0, 0);
    } else if (wallName.includes('FLOOR')) {
      pos.y = -12.40;
      sparkNormal.set(0, 1, 0);
    } else if (wallName.includes('CEILING')) {
      pos.y = 12.40;
      sparkNormal.set(0, -1, 0);
    } else if (wallName.includes('BACK WALL')) {
      pos.z = -54.90;
      sparkNormal.set(0, 0, 1);
    }

    // 1. Trigger Crystalline Entity Refraction Flash if active
    if (this.currentSector && this.currentSector.id === 'crystalline_entity') {
      const enhanceCount = (targetIdx % 4) + 1;
      const enhancedIndices = [];
      for (let e = 0; e < enhanceCount; e++) {
        enhancedIndices.push((targetIdx * 2 + e) % 6);
      }

      this.crystalRefractionPulse = {
        startTime: (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(),
        color: pulseColor,
        targetColor: pulseColor,
        enhancedIndices: enhancedIndices,
        enhanceCount: enhanceCount
      };
    }

    // 2. Highlight Exact Mathematical Holodeck Grid Lines (Zero Allocation)
    this.spawnIlluminatedGridLines(wallName, contactPos, pulseColor);

    // 3. High-Performance Pooled PointLight Flash (Zero WebGL Shader Recompilation)
    if (this.impactLightPool && this.impactLightPool.length > 0) {
      const poolEntry = this.impactLightPool[this.impactLightNextIdx % this.impactLightPool.length];
      this.impactLightNextIdx++;
      const lightOffsetPos = pos.clone().add(sparkNormal.clone().multiplyScalar(0.75));
      if (poolEntry && poolEntry.light) {
        poolEntry.light.color.setHex(pulseColor);
        poolEntry.light.position.copy(lightOffsetPos);
        poolEntry.light.intensity = 4.5;
        poolEntry.life = 1.0;
      }
    }

    // 4. High-Performance Pooled Plasma Sparks (Zero Mesh Allocation)
    const sparkCount = 6;
    if (this.sparkPool && this.sparkPool.length > 0) {
      for (let i = 0; i < sparkCount; i++) {
        const poolSpk = this.sparkPool[(this.sparkNextIdx || 0) % this.sparkPool.length];
        this.sparkNextIdx = ((this.sparkNextIdx || 0) + 1) % this.sparkPool.length;
        if (poolSpk && poolSpk.mesh) {
          if (poolSpk.mesh.material && poolSpk.mesh.material.color) {
            poolSpk.mesh.material.color.setHex(pulseColor);
          }
          poolSpk.mesh.position.copy(pos);
          poolSpk.mesh.visible = true;
          poolSpk.mesh.scale.setScalar(1.0);
          poolSpk.velocity.set(
            sparkNormal.x * (0.12 + Math.random() * 0.14) + (Math.random() - 0.5) * 0.12,
            sparkNormal.y * (0.12 + Math.random() * 0.14) + (Math.random() - 0.5) * 0.12,
            sparkNormal.z * (0.12 + Math.random() * 0.14) + (Math.random() - 0.5) * 0.12
          );
          poolSpk.life = 1.0;
          poolSpk.decay = 0.045;
        }
      }
    }

    // 5. Illuminate ONLY the specific 3D corner on the target (Zero geometry allocation)
    if (target && target.mesh) {
      const localCorners = [
        new THREE.Vector3(-2.2, -1.45, -0.375),
        new THREE.Vector3(-2.2, -1.45,  0.375),
        new THREE.Vector3(-2.2,  1.45, -0.375),
        new THREE.Vector3(-2.2,  1.45,  0.375),
        new THREE.Vector3( 2.2, -1.45, -0.375),
        new THREE.Vector3( 2.2, -1.45,  0.375),
        new THREE.Vector3( 2.2,  1.45, -0.375),
        new THREE.Vector3( 2.2,  1.45,  0.375)
      ];

      let contactCorner = localCorners[0];
      let extremeVal = null;

      for (let c = 0; c < localCorners.length; c++) {
        const cornerWorld = localCorners[c].clone();
        if (cornerWorld.applyEuler && target.mesh.rotation) {
          cornerWorld.applyEuler(target.mesh.rotation);
        }
        if (cornerWorld.add && target.mesh.position) {
          cornerWorld.add(target.mesh.position);
        }

        if (wallName.includes('LEFT WALL')) {
          if (extremeVal === null || cornerWorld.x < extremeVal) { extremeVal = cornerWorld.x; contactCorner = localCorners[c]; }
        } else if (wallName.includes('RIGHT WALL')) {
          if (extremeVal === null || cornerWorld.x > extremeVal) { extremeVal = cornerWorld.x; contactCorner = localCorners[c]; }
        } else if (wallName.includes('FLOOR')) {
          if (extremeVal === null || cornerWorld.y < extremeVal) { extremeVal = cornerWorld.y; contactCorner = localCorners[c]; }
        } else if (wallName.includes('CEILING')) {
          if (extremeVal === null || cornerWorld.y > extremeVal) { extremeVal = cornerWorld.y; contactCorner = localCorners[c]; }
        }
      }

      const cornerGroup = new THREE.Group();
      cornerGroup.position.copy(contactCorner);

      const pulseMat = this.getPulseMaterial(pulseColor);
      const whiteMat = this.sharedWhiteAdditiveMat;
      const planeGeo = this.sharedPlaneGeo;

      const sX = contactCorner.x > 0 ? -1 : 1;
      const sY = contactCorner.y > 0 ? -1 : 1;
      const sZ = contactCorner.z > 0 ? -1 : 1;

      if (planeGeo && pulseMat) {
        // Edge 1 along X
        const edgeXMesh = new THREE.Mesh(planeGeo, pulseMat);
        edgeXMesh.scale.set(1.6, 0.14, 1.0);
        edgeXMesh.position.set(sX * 0.8, 0, 0);
        cornerGroup.add(edgeXMesh);

        // Edge 2 along Y
        const edgeYMesh = new THREE.Mesh(planeGeo, pulseMat);
        edgeYMesh.scale.set(0.14, 1.4, 1.0);
        edgeYMesh.position.set(0, sY * 0.7, 0);
        cornerGroup.add(edgeYMesh);

        // Edge 3 along Z
        const edgeZMesh = new THREE.Mesh(planeGeo, pulseMat);
        edgeZMesh.scale.set(0.14, 0.55, 1.0);
        edgeZMesh.position.set(0, 0, sZ * 0.275);
        edgeZMesh.rotation.y = Math.PI / 2;
        cornerGroup.add(edgeZMesh);
      }

      // Glowing vertex node at tip
      if (this.sharedVertexGeo && whiteMat) {
        const vertexMesh = new THREE.Mesh(this.sharedVertexGeo, whiteMat);
        cornerGroup.add(vertexMesh);
      }

      target.mesh.add(cornerGroup);

      this.targetCornerFlares.push({
        parentMesh: target.mesh,
        group: cornerGroup,
        life: 1.0,
        decay: 0.045
      });
    }

    const ricochetDuration = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - ricochetStartTime;
    if (DEBUG_LOGS) {
      console.log(`[LCARS Ricochet Performance] Bounce: ${wallName} | Execution: ${ricochetDuration.toFixed(3)}ms | Target #${targetIdx + 1}`);
    }
  }

  createMassiveExplosion(position, isCorrect = true, answerColorHex = null) {
    if (!this.sharedParticleGeo) {
      this.sharedParticleGeo = new THREE.SphereGeometry(0.18, 8, 8);
    }
    if (!this.sharedRingGeo) {
      this.sharedRingGeo = new THREE.RingGeometry(0.2, 0.65, 32);
    }

    // 1. INCORRECT TARGET -> OLD CLASSIC EXPLOSION STYLE (75 Red/Orange Spheres & Red Flash)
    if (!isCorrect) {
      if (!this.sharedMats) {
        this.sharedMats = {
          green: new THREE.MeshBasicMaterial({ color: 0x33ff66 }),
          yellow: new THREE.MeshBasicMaterial({ color: 0xffcc00 }),
          red: new THREE.MeshBasicMaterial({ color: 0xff3333 }),
          orange: new THREE.MeshBasicMaterial({ color: 0xff7700 }),
          ringGreen: new THREE.MeshBasicMaterial({ color: 0x33ff66, side: THREE.DoubleSide, transparent: true, opacity: 0.95 }),
          ringRed: new THREE.MeshBasicMaterial({ color: 0xff3333, side: THREE.DoubleSide, transparent: true, opacity: 0.95 })
        };
      }

      const mat1 = this.sharedMats.red;
      const mat2 = this.sharedMats.orange;
      const count = 75;

      for (let i = 0; i < count; i++) {
        const p = new THREE.Mesh(this.sharedParticleGeo, Math.random() > 0.4 ? mat1 : mat2);
        p.position.copy(position);

        const speed = 0.8 + Math.random() * 1.6;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);

        const vel = new THREE.Vector3(
          speed * Math.sin(phi) * Math.cos(theta),
          speed * Math.sin(phi) * Math.sin(theta),
          speed * Math.cos(phi)
        );

        this.scene.add(p);
        this.particles.push({
          mesh: p,
          velocity: vel,
          life: 1.0,
          decay: 0.02 + Math.random() * 0.025
        });
      }

      const ring = new THREE.Mesh(this.sharedRingGeo, this.sharedMats.ringRed);
      ring.position.copy(position);
      ring.lookAt(this.camera.position);
      this.scene.add(ring);

      this.shockwaves.push({
        mesh: ring,
        scale: 1.0,
        opacity: 0.95
      });

      this.triggerGridPointLight(position, 0xff3333, 5.0, 0.08);

      if (DEBUG_LOGS) {
        console.log(`[LCARS Explosion FX] Incorrect Target -> Classic Red Explosion (75 particles)`);
      }
      return;
    }

    // 2. CORRECT ANSWER TARGET -> NEW RADIANT MULTI-GEOMETRY 100s+ PARTICLE EXPLOSION IN ANSWER COLOR
    const primaryColor = (answerColorHex !== null && answerColorHex !== undefined) ? answerColorHex : 0x33ff66;
    const secondaryColor = new THREE.Color(primaryColor).offsetHSL(0.06, 0.15, 0.12).getHex();
    const coreHighlightColor = 0xffffff;

    if (!this.sharedShardGeo) {
      this.sharedShardGeo = new THREE.TetrahedronGeometry(0.24, 0);
    }
    if (!this.sharedExplosionSparkGeo) {
      this.sharedExplosionSparkGeo = new THREE.BoxGeometry(0.08, 0.08, 0.55);
    }

    if (!this.explosionMatCache) {
      this.explosionMatCache = new Map();
    }
    const getExplosionMat = (hex, isDouble = false) => {
      const key = `${hex}_${isDouble}`;
      if (!this.explosionMatCache.has(key)) {
        this.explosionMatCache.set(key, new THREE.MeshBasicMaterial({
          color: hex,
          side: isDouble ? THREE.DoubleSide : THREE.FrontSide,
          transparent: true,
          opacity: 0.95,
          blending: THREE.AdditiveBlending
        }));
      }
      return this.explosionMatCache.get(key);
    };

    const matPrimary = getExplosionMat(primaryColor);
    const matSecondary = getExplosionMat(secondaryColor);
    const matCore = getExplosionMat(coreHighlightColor);
    const matRing = getExplosionMat(primaryColor, true);

    const count = typeof this.testExplosionParticles === 'number' ? this.testExplosionParticles : 250;

    for (let i = 0; i < count; i++) {
      // Varied debris types: 60% spheres, 25% crystalline shards, 15% elongated plasma sparks
      let geo = this.sharedParticleGeo;
      const randType = Math.random();
      if (randType > 0.85) geo = this.sharedExplosionSparkGeo;
      else if (randType > 0.60) geo = this.sharedShardGeo;

      // Color distribution: 55% primary answer color, 30% secondary harmonic, 15% intense white core
      let mat = matPrimary;
      const randColor = Math.random();
      if (randColor > 0.85) mat = matCore;
      else if (randColor > 0.55) mat = matSecondary;

      const p = new THREE.Mesh(geo, mat);
      p.position.copy(position);

      const speed = 0.6 + Math.random() * 2.8;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);

      const vel = new THREE.Vector3(
        speed * Math.sin(phi) * Math.cos(theta),
        speed * Math.sin(phi) * Math.sin(theta),
        speed * Math.cos(phi)
      );

      // Random initial tumble and scale
      p.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      const scaleBase = 0.6 + Math.random() * 1.4;
      p.scale.setScalar(scaleBase);

      this.scene.add(p);
      this.particles.push({
        mesh: p,
        velocity: vel,
        life: 1.0,
        decay: 0.012 + Math.random() * 0.024
      });
    }

    // Dynamic Expanding Concentric Shockwave Ring in answer color
    const ring = new THREE.Mesh(this.sharedRingGeo, matRing);
    ring.position.copy(position);
    ring.lookAt(this.camera.position);
    this.scene.add(ring);

    this.shockwaves.push({
      mesh: ring,
      scale: 1.0,
      opacity: 0.95
    });

    // Radiant Dynamic PointLight illuminating holodeck walls & room in the exact answer color
    const flashIntensity = 5.5 + Math.min(4.0, count / 75.0);
    this.triggerGridPointLight(position, primaryColor, flashIntensity, 0.055);

    if (DEBUG_LOGS) {
      console.log(`[LCARS Explosion FX] Correct Answer Color: 0x${primaryColor.toString(16)} | Particles: ${count} | Light Intensity: ${flashIntensity.toFixed(1)}`);
    }
  }

  buildCockpitShield() {
    if (this.cockpitShieldMesh) return;
    try {
      // Procedural Starfleet Hexagonal Honeycomb Canvas Texture
      const hexCanvas = document.createElement('canvas');
      hexCanvas.width = 512;
      hexCanvas.height = 512;
      const ctx = hexCanvas.getContext('2d');
      ctx.clearRect(0, 0, 512, 512);

      const r = 24;
      const h = r * Math.sqrt(3);
      ctx.strokeStyle = '#ffbb33';
      ctx.lineWidth = 2.4;

      for (let y = -h; y < 512 + h; y += h) {
        for (let x = -r * 3; x < 512 + r * 3; x += r * 3) {
          const drawHex = (cx, cy) => {
            ctx.beginPath();
            for (let a = 0; a < 6; a++) {
              const angle = (a * Math.PI) / 3;
              const hx = cx + r * Math.cos(angle);
              const hy = cy + r * Math.sin(angle);
              if (a === 0) ctx.moveTo(hx, hy);
              else ctx.lineTo(hx, hy);
            }
            ctx.closePath();
            ctx.stroke();
          };
          drawHex(x, y);
          drawHex(x + r * 1.5, y + h / 2);
        }
      }

      this.hexShieldTex = new THREE.CanvasTexture(hexCanvas);
      this.hexShieldTex.wrapS = THREE.RepeatWrapping;
      this.hexShieldTex.wrapT = THREE.RepeatWrapping;
      this.hexShieldTex.repeat.set(3, 2);

      const shieldGeo = (typeof THREE.PlaneGeometry === 'function') ? new THREE.PlaneGeometry(32, 20) : null;
      this.cockpitShieldMat = (typeof THREE.MeshBasicMaterial === 'function') ? new THREE.MeshBasicMaterial({
        map: this.hexShieldTex,
        color: 0xffaa00,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      }) : null;

      if (shieldGeo && this.cockpitShieldMat && this.camera) {
        this.cockpitShieldMesh = new THREE.Mesh(shieldGeo, this.cockpitShieldMat);
        this.cockpitShieldMesh.position.set(0, 0, -4.5);
        this.camera.add(this.cockpitShieldMesh);
        this.scene.add(this.camera);
      }
      this.hexShieldImpact = null;
    } catch(e) {
      if (DEBUG_LOGS) console.warn('[LCARS Shields] Cockpit shield init error:', e);
    }
  }

  triggerHexShieldImpact(x = 0, y = 0, colorHex = 0xff3344) {
    this.buildCockpitShield();
    if (!this.cockpitShieldMat || !this.cockpitShieldMesh) return;
    if (this.cockpitShieldMat.color && typeof this.cockpitShieldMat.color.setHex === 'function') {
      this.cockpitShieldMat.color.setHex(colorHex);
    }
    this.cockpitShieldMat.opacity = 0.95;
    this.hexShieldImpact = {
      life: 1.0,
      decay: 0.040
    };
    this.triggerHaptic('shield_breach');
    if (DEBUG_LOGS) console.log(`[LCARS Shields] Hexagonal Deflector Shield impact triggered at (${x.toFixed(1)}, ${y.toFixed(1)})`);
  }

  spawnPraxisShockwave(pos, colorHex = 0x00f0ff) {
    if (!this.scene) return;
    try {
      const ringGeo = this.sharedPraxisRingGeo || ((typeof THREE.RingGeometry === 'function') ? new THREE.RingGeometry(0.8, 2.2, 48) : null);
      const ringMat = (typeof THREE.MeshBasicMaterial === 'function') ? new THREE.MeshBasicMaterial({
        color: colorHex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      }) : null;

      if (ringGeo && ringMat) {
        const mesh = new THREE.Mesh(ringGeo, ringMat);
        mesh.position.copy(pos);
        mesh.rotation.x = Math.PI * 0.15;
        this.scene.add(mesh);

        if (!this.praxisWaves) this.praxisWaves = [];
        this.praxisWaves.push({
          mesh,
          scale: 1.0,
          opacity: 0.95,
          growth: 0.72,
          decay: 0.038
        });
        this.showBanner('🪐 PRAXIS SUBSPACE SHOCKWAVE DISCHARGED');
      }
    } catch(e) {}
  }

  spawnDebrisShards(pos, colorHex = 0xffaa00, count = 18) {
    if (!this.scene) return;
    try {
      if (!this.debrisShards) this.debrisShards = [];
      const shardGeo = this.sharedShardGeo || (typeof THREE.TetrahedronGeometry === 'function' ? new THREE.TetrahedronGeometry(0.38, 0) : null);
      if (!shardGeo) return;

      const sharedMat = (typeof THREE.MeshBasicMaterial === 'function') ? new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      }) : null;

      for (let i = 0; i < count; i++) {
        const mesh = new THREE.Mesh(shardGeo, sharedMat);
        mesh.position.copy(pos);
        this.scene.add(mesh);

        const angle = Math.random() * Math.PI * 2;
        const speed = 2.2 + Math.random() * 7.5;
        this.debrisShards.push({
          mesh,
          sharedMat,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          vz: (Math.random() - 0.5) * 5.5,
          rx: (Math.random() - 0.5) * 0.35,
          ry: (Math.random() - 0.5) * 0.35,
          rz: (Math.random() - 0.5) * 0.35,
          life: 1.0,
          decay: 0.032 + Math.random() * 0.02
        });
      }
    } catch(e) {}
  }

  triggerWarpStreaks(duration = 2.5) {
    if (!this.warpStreakGroup) return;
    this.warpStreakGroup.visible = true;
    this.isWarpStreaksActive = true;
    this.showBanner('⚡ RELATIVISTIC HYPERDRIVE WARP STREAKS ENGAGED');
    if (this._warpStreakTimeout) clearTimeout(this._warpStreakTimeout);
    this._warpStreakTimeout = setTimeout(() => {
      if (!this.isWarpJumping) {
        this.isWarpStreaksActive = false;
        if (this.warpStreakGroup) this.warpStreakGroup.visible = false;
      }
    }, duration * 1000);
  }

  triggerGridPointLight(pos, colorHex = 0xffaa00, intensity = 4.0, decay = 0.05) {
    if (this.impactLightPool && this.impactLightPool.length > 0) {
      const entry = this.impactLightPool[(this.impactLightNextIdx || 0) % this.impactLightPool.length];
      this.impactLightNextIdx = ((this.impactLightNextIdx || 0) + 1) % this.impactLightPool.length;
      if (entry && entry.light) {
        entry.light.position.copy(pos);
        if (entry.light.color && entry.light.color.setHex) entry.light.color.setHex(colorHex);
        entry.light.intensity = intensity;
        entry.life = 1.0;
        entry.decay = decay;
      }
    }
  }

  triggerScreenShake() {
    this.viewport.classList.remove('shake-screen');
    void this.viewport.offsetWidth;
    this.viewport.classList.add('shake-screen');
    setTimeout(() => this.viewport.classList.remove('shake-screen'), 350);
  }

  handleWaveTimeout() {
    if (!this.isPlaying || this.isPaused || this.isTransitioning || this.mode === 'ricochet_test') return;

    this.combo = 0;
    this.shieldsLeft = Math.max(0, this.shieldsLeft - 1);

    this.audio.playError();
    this.audio.playShieldBreak();
    this.triggerScreenShake();
    this.showBanner('⏰ TIME EXPIRED! SHIELD SHATTERED!', true);
    this.updateHUD();

    if (this.shieldsLeft <= 0) {
      this.startFailureIntermission('TIME EXPIRED // 3 SHIELDS COLLAPSED');
    } else {
      this.audio.playVoice('time_expired', 'Time limit exceeded. Containment damaged.');
      setTimeout(() => this.nextProblem(), 300);
    }
  }

  submitAnswer(val, spawnBall = true) {
    if (!this.isPlaying || this.isPaused || this.isTransitioning) return;

    this.totalAttempts++;
    const isFirstAttempt = this.isFirstShotOnProblem;
    this.isFirstShotOnProblem = false;
    const isCorrect = (this.currentProblem && val === this.currentProblem.answer);

    const target = this.targetPanels.find(p => p.value === val);
    const targetPos = target ? target.mesh.position.clone() : new THREE.Vector3(0, 0, -32);
    const targetColorHex = target ? target.choiceColorHex : (isCorrect ? 0x33ff66 : 0xff3333);

    if (spawnBall) {
      this.fireProjectile(targetPos, val);
    }

    // High-Performance Sandbox Test Matrix Mode (Continuous non-blocking sandbox)
    if (this.mode === 'ricochet_test') {
      const timeBonus = Math.floor((this.waveRemainingTime || 50) * 15);
      const points = 100 + timeBonus;
      this.score += points;

      if (isCorrect) {
        this.correctHits++;
        this.combo++;
        if (this.combo > this.maxCombo) this.maxCombo = this.combo;
        this.level++;
        const hitPanX = target ? target.mesh.position.x : 0;
        this.audio.playHit(hitPanX);
        this.audio.playLevelUp();
        this.triggerHaptic('success');
        this.createMassiveExplosion(targetPos, true, targetColorHex);
        this.spawnDebrisShards(targetPos, targetColorHex, 20);
        if (this.combo >= 3 || this.rank === 'commander' || this.rank === 'captain' || this.rank === 'admiral') {
          this.spawnPraxisShockwave(targetPos, targetColorHex);
        }
        this.showBanner(`🎯 MATRIX SOLVED +${points} PTS // NEXT EQUATION`);
        this.updateHUD();

        setTimeout(() => {
          if (this.mode === 'ricochet_test' && this.isPlaying) {
            this.nextProblem();
            const sb = document.getElementById('test-sandbox-panel');
            if (sb) sb.classList.remove('hidden');
          }
        }, 350);
      } else {
        const hitPanX = target ? target.mesh.position.x : 0;
        this.audio.playError();
        this.triggerScreenShake();
        this.triggerHaptic('shield_breach');
        this.createMassiveExplosion(targetPos, false, 0xff3333);

        if (target) {
          this.targetPanels = this.targetPanels.filter(t => t !== target);
          target.isPOVAttacking = true;
          target.povSpeed = 1.8;
          if (!this.povAttackingTargets) this.povAttackingTargets = [];
          this.povAttackingTargets.push(target);
          this.showBanner('⚠️ TEST MATRIX // INCOMING RICOCHET SMASH!', true);
        } else {
          this.showBanner('❌ TEST MATRIX // INCORRECT // TRY AGAIN', true);
        }
        this.shieldsLeft = 3; // Keep infinite shields in sandbox test mode!
        this.updateHUD();
      }

      if (DEBUG_LOGS) {
        console.log(`[LCARS Test Matrix] Answer: ${val} | Correct: ${isCorrect} | Wave: ${this.level} | Sandbox Panel Active: true`);
      }
      return;
    }

    if (isCorrect) {
      this.correctHits++;
      this.combo++;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;

      // First-Strike Precision Hit: If player hits correct answer on first shot after level 1, recharge 1 shield!
      let shieldRecharged = false;
      if (isFirstAttempt && this.level > 1 && this.shieldsLeft < 3) {
        this.shieldsLeft = Math.min(3, this.shieldsLeft + 1);
        shieldRecharged = true;
        this.audio.playShieldRecharge();
        this.showBanner('🛡️ FIRST-STRIKE BONUS: +1 SHIELD RECHARGED!', false);
      }

      const timeBonus = Math.floor(this.waveRemainingTime * 15);
      const attackBonus = (target && target.isAttacking) ? 250 : 0;
      const points = Math.floor(100 * (1 + this.combo * 0.25) * this.warpFactor) + timeBonus + attackBonus;
      this.score += points;

      if (this.score > this.highScore) {
        this.highScore = this.score;
        localStorage.setItem('holodeck_math_high_score', String(this.highScore));
        this.updateHighScoreDisplay();
      }

      this.lastSolvedProblem = {
        question: this.currentProblem.question,
        category: this.currentProblem.category,
        answer: this.currentProblem.answer,
        points: points,
        timeBonus: timeBonus,
        shieldRecharged: shieldRecharged
      };

      this.level++;
      this.warpFactor = Math.min(9.9, 1.0 + (this.level * 0.3));

      const hitPanX = target ? target.mesh.position.x : 0;
      this.audio.playHit(hitPanX);
      this.audio.playLevelUp();
      this.triggerHaptic('success');
      this.createMassiveExplosion(targetPos, true, targetColorHex);
      this.spawnDebrisShards(targetPos, targetColorHex, 22);

      if (this.combo >= 3 || this.rank === 'commander' || this.rank === 'captain' || this.rank === 'admiral') {
        this.spawnPraxisShockwave(targetPos, targetColorHex);
      }

      document.getElementById('red-alert-flash').classList.remove('active');
      if (this.hazardTimer) clearTimeout(this.hazardTimer);

      if (target) {
        this.scene.remove(target.mesh);
        this.disposeObject(target.mesh);
        this.targetPanels = this.targetPanels.filter(t => t !== target);
      }

      this.updateHUD();
      this.startSuccessIntermission(points, shieldRecharged);

    } else {
      this.combo = 0;
      this.shieldsLeft = Math.max(0, this.shieldsLeft - 1);

      this.audio.playError();
      this.audio.playShieldBreak();
      this.triggerScreenShake();
      this.triggerHaptic('shield_breach');

      if (this.currentProblem) {
        this.missedProblems.push({
          wave: this.level,
          question: this.currentProblem.question,
          selected: val,
          correct: this.currentProblem.answer,
          formulaStr: (this.currentProblem.visData && this.currentProblem.visData.formulaStr) || this.currentProblem.question,
          hint: (this.currentProblem.visData && this.currentProblem.visData.hint) || `Correct calculation: ${this.currentProblem.answer}`
        });
      }

      if (target) {
        this.targetPanels = this.targetPanels.filter(t => t !== target);
        target.isPOVAttacking = true;
        target.povSpeed = 1.8;
        if (!this.povAttackingTargets) this.povAttackingTargets = [];
        this.povAttackingTargets.push(target);
        this.showBanner('⚠️ RICOCHET INCOMING: BRACE FOR IMPACT!', true);
      } else {
        this.showBanner('❌ INCORRECT! SHIELD SHATTERED!', true);
      }

      this.updateHUD();

      if (this.shieldsLeft <= 0) {
        this.startFailureIntermission('CONTAINMENT BREACH: 3 SHIELDS COLLAPSED');
      } else {
        this.audio.playVoice('shield_damaged', 'Containment shield damaged.');
      }
    }
  }

  /* Enhanced 4.5s Target Vaporized Review Hologram (Success) */
  startSuccessIntermission(earnedPoints, shieldRecharged = false) {
    this.isTransitioning = true;
    const nextLimit = this.calculateWaveTimeLimit(this.level);
    const card = document.getElementById('level-transition-card');

    // Check if every 3 waves triggers a Hyperspace Warp Jump to a new Sector!
    const isWarpJumpWave = ((this.level - 1) % 3 === 0 && (this.level - 1) > 0);
    const nextSector = this.sectors[(this.currentSectorIndex + 1) % this.sectors.length];

    if (isWarpJumpWave) {
      this.isWarpJumping = true;
      this.audio.playWarpJump();
      card.className = 'warp-theme';
    } else {
      card.className = '';
    }

    const pill = document.getElementById('lt-header-pill');
    if (isWarpJumpWave) {
      pill.className = 'lt-header-pill warp-pill';
      pill.innerText = `🌀 HYPERSPACE WARP JUMP // SECTOR ROTATION`;
    } else {
      pill.className = 'lt-header-pill';
      pill.innerText = shieldRecharged 
        ? '🛡️ TARGET VAPORIZED // +1 SHIELD RESTORED!' 
        : '🎯 TARGET VAPORIZED // MATRIX SOLVED';
    }

    const eqBox = document.getElementById('lt-equation-box');
    eqBox.className = 'lt-equation-box';

    const ansEl = document.getElementById('lt-eq-answer');
    ansEl.className = 'lt-eq-answer';

    if (this.lastSolvedProblem) {
      document.getElementById('lt-eq-category').innerText = this.lastSolvedProblem.category;
      document.getElementById('lt-eq-question').innerText = this.lastSolvedProblem.question;
      ansEl.innerText = this.lastSolvedProblem.answer;
    }

    document.getElementById('lt-stat-lbl-1').innerText = 'STREAK BONUS';
    document.getElementById('lt-streak-text').innerText = `${this.combo}X STREAK`;
    document.getElementById('lt-streak-text').className = 'lt-stat-val gold';

    document.getElementById('lt-stat-lbl-2').innerText = 'POINTS EARNED';
    document.getElementById('lt-points-text').innerText = `+${earnedPoints} PTS`;
    document.getElementById('lt-points-text').className = 'lt-stat-val green';

    document.getElementById('lt-stat-lbl-3').innerText = 'WARP SPEED';
    document.getElementById('lt-warp-badge').innerText = isWarpJumpWave ? 'WARP 9.9' : `WARP ${this.warpFactor.toFixed(1)}`;
    document.getElementById('lt-warp-badge').className = 'lt-stat-val purple';

    const infoEl = document.getElementById('lt-next-info');
    if (isWarpJumpWave) {
      infoEl.innerText = `🌌 DESTINATION: ${nextSector.name} [${nextSector.type}]`;
      infoEl.style.color = '#00ddff';
    } else if (shieldRecharged) {
      infoEl.innerText = `🛡️ FIRST-STRIKE HIT: +1 SHIELD RECHARGED! // NEXT WAVE: ${nextLimit.toFixed(1)}s`;
      infoEl.style.color = '#33ff66';
    } else {
      infoEl.innerText = `WAVE ${this.level} TIME LIMIT: ${nextLimit.toFixed(1)}s`;
      infoEl.style.color = 'var(--voyager-periwinkle)';
    }
    card.classList.remove('hidden');

    let countdown = 4;
    const cdEl = document.getElementById('lt-countdown');
    cdEl.innerText = isWarpJumpWave ? `WARPING TO NEW SECTOR IN ${countdown}...` : `WARP SPEED IN ${countdown}...`;

    if (isWarpJumpWave) {
      this.audio.playVoice('warp_jump', `Warp speed engaged. Approaching sector ${nextSector.name}.`);
    } else {
      this.audio.playVoice('target_vaporized', 'Target vaporized. Quantum matrix solved.');
    }

    const countInterval = setInterval(() => {
      countdown--;
      if (countdown > 0) {
        cdEl.innerText = isWarpJumpWave ? `WARPING TO NEW SECTOR IN ${countdown}...` : `WARP SPEED IN ${countdown}...`;
        if (isWarpJumpWave && countdown === 2) {
          // Halfway through warp jump: advance to next RNG sector in patrol route!
          if (!this.patrolRoute || this.patrolRoute.length === 0) {
            this.patrolRoute = this.generateMissionPatrolRoute(this.currentSectorIndex || 0);
          }
          this.patrolProgress = Math.min(this.sectors.length - 1, (this.patrolProgress || 0) + 1);
          this.currentSectorIndex = this.patrolRoute[this.patrolProgress];
          this.buildSector(this.currentSectorIndex);
        }
      } else {
        clearInterval(countInterval);
        card.classList.add('hidden');
        this.isWarpJumping = false;
        this.resetStarfieldPositions();
        this.isTransitioning = false;
        if (isWarpJumpWave) {
          this.showBanner(`🌌 ARRIVED: ${this.sectors[this.currentSectorIndex].name}`);
        }
        this.nextProblem();
      }
    }, 1100);
  }

  /* Enhanced 4.5s Failure / Containment Breach Screen showing Correct Answer */
  startFailureIntermission(reason) {
    this.isTransitioning = true;
    this.isPlaying = false;

    if (this.clockInterval) clearInterval(this.clockInterval);
    if (this.hazardTimer) clearTimeout(this.hazardTimer);
    document.getElementById('red-alert-flash').classList.add('active');

    const card = document.getElementById('level-transition-card');
    card.className = 'failure-theme';

    const pill = document.getElementById('lt-header-pill');
    pill.className = 'lt-header-pill fail';
    pill.innerText = '⚠️ CONTAINMENT BREACH // SHIELDS COLLAPSED';

    const eqBox = document.getElementById('lt-equation-box');
    eqBox.className = 'lt-equation-box fail';

    const ansEl = document.getElementById('lt-eq-answer');
    ansEl.className = 'lt-eq-answer fail-ans';

    const correctAns = this.currentProblem ? this.currentProblem.answer : '';

    if (this.currentProblem) {
      document.getElementById('lt-eq-category').innerText = `${this.currentProblem.category} // MATRIX FAILED`;
      document.getElementById('lt-eq-question').innerText = this.currentProblem.question;
      ansEl.innerText = `${correctAns} (CORRECT ANSWER)`;
    }

    const accuracy = this.totalAttempts > 0 ? Math.round((this.correctHits / this.totalAttempts) * 100) : 0;

    document.getElementById('lt-stat-lbl-1').innerText = 'FINAL SCORE';
    document.getElementById('lt-streak-text').innerText = `${this.score} PTS`;
    document.getElementById('lt-streak-text').className = 'lt-stat-val gold';

    document.getElementById('lt-stat-lbl-2').innerText = 'WAVES CLEARED';
    document.getElementById('lt-points-text').innerText = `WAVE ${this.level - 1}`;
    document.getElementById('lt-points-text').className = 'lt-stat-val red';

    document.getElementById('lt-stat-lbl-3').innerText = 'ACCURACY';
    document.getElementById('lt-warp-badge').innerText = `${accuracy}%`;
    document.getElementById('lt-warp-badge').className = 'lt-stat-val purple';

    document.getElementById('lt-next-info').innerText = 'ALL CONTAINMENT CELLS COMPROMISED';
    card.classList.remove('hidden');

    let countdown = 4;
    const cdEl = document.getElementById('lt-countdown');
    cdEl.innerText = `DEBRIEFING IN ${countdown}...`;

    this.audio.playVoice('containment_breach', 'Containment failure. Simulation terminated.');
    setTimeout(() => {
      this.audio.speakCorrectAnswer(correctAns);
    }, 2200);

    const countInterval = setInterval(() => {
      countdown--;
      if (countdown > 0) {
        cdEl.innerText = `DEBRIEFING IN ${countdown}...`;
      } else {
        clearInterval(countInterval);
        card.classList.add('hidden');
        this.isTransitioning = false;
        this.gameOver(reason);
      }
    }, 1100);
  }

  toggleVisualizerMinimize() {
    const panel = document.getElementById('lcars-visualizer-panel');
    const btn = document.getElementById('btn-vis-minimize');
    if (!panel) return;
    this.isVisualizerMinimized = !this.isVisualizerMinimized;
    if (this.isVisualizerMinimized) {
      panel.classList.add('minimized');
      if (btn) btn.innerText = '▼';
      this.showBanner('🔬 VISUALIZER: MINIMIZED');
    } else {
      panel.classList.remove('minimized');
      if (btn) btn.innerText = '▲';
      this.showBanner('🔬 VISUALIZER: EXPANDED');
    }
    this.adjustRightDockLayout();
    this.audio.playComputerChirp();
  }

  toggleVisualizerAnswers() {
    this.isVisualizerAnswersHidden = !this.isVisualizerAnswersHidden;
    this.updateVisualizer();
    this.showBanner(this.isVisualizerAnswersHidden ? '🙈 VISUALIZER: ANSWERS CONCEALED' : '👁️ VISUALIZER: ANSWERS DISPLAYED');
    this.audio.playComputerChirp();
  }

  updateVisualizer() {
    const panel = document.getElementById('lcars-visualizer-panel');
    if (!this.isVisualizerOpen || !this.currentProblem || !this.currentProblem.visData) {
      panel.classList.add('hidden');
      this.adjustRightDockLayout();
      return;
    }

    panel.classList.remove('hidden');
    const vis = this.currentProblem.visData;
    const hideAns = !!this.isVisualizerAnswersHidden;

    // Update toggle button text & state
    const toggleBtn = document.getElementById('btn-vis-toggle-ans');
    if (toggleBtn) {
      if (hideAns) {
        toggleBtn.innerText = '🙈 ANS: HIDE';
        toggleBtn.classList.add('hidden-mode');
      } else {
        toggleBtn.innerText = '👁️ ANS: SHOW';
        toggleBtn.classList.remove('hidden-mode');
      }
    }

    document.getElementById('vis-topic-tag').innerText = vis.title || 'LCARS DIAGNOSTIC';

    // Formula Text
    let formulaText = vis.formulaStr || this.currentProblem.question;
    if (hideAns) {
      formulaText = formulaText.replace(/=\s*-?\d+(\.\d+)?\s*$/g, '= [?]');
    }
    document.getElementById('vis-formula-box').innerText = formulaText;

    // Hint Text
    let hintHtml = vis.hint || 'Analyze coordinate relationships.';
    if (hideAns && this.currentProblem) {
      const ansVal = this.currentProblem.answer;
      if (ansVal !== undefined && ansVal !== null) {
        const ansStr = String(ansVal).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const reg = new RegExp(`<b>\\s*${ansStr}\\s*</b>`, 'g');
        hintHtml = hintHtml.replace(reg, '<span class="vis-redacted">[?]</span>');
      } else {
        hintHtml = hintHtml.replace(/<b>([0-9.-]+)<\/b>(?!.*<b>[0-9.-]+<\/b>)/g, '<span class="vis-redacted">[?]</span>');
      }
    }
    document.getElementById('vis-hint-text').innerHTML = hintHtml;

    const canvas = document.getElementById('math-graph-canvas');
    MathGenerator.renderGraph(canvas, vis, hideAns);
    this.adjustRightDockLayout();
  }

  activateSensorJam() {
    if (!this.isPlaying || this.isPaused || this.isTransitioning) return;
    if (this.jamCharges <= 0) {
      this.showBanner('⚠️ SENSOR JAM DEPLETED (1 CHARGE PER LEVEL)');
      this.audio.playError();
      return;
    }
    if (this.isJamActive) return;

    this.jamCharges--;
    this.isJamActive = true;
    this.jamRemainingSeconds = 5.0;

    const fx = document.getElementById('temporal-jam-fx');
    if (fx) fx.classList.add('active');

    this.audio.playTimeDilation();
    this.audio.playVoice('sensor_jam', 'Temporal sensors jammed. Target vectors dilated.');
    this.showBanner('⏳ SENSOR JAM ACTIVE: TIME DILATED (5s)!');
    this.triggerHaptic('jam');
    this.updateAbilityHUD();
  }

  activatePhaserStrike() {
    if (!this.isPlaying || this.isPaused || this.isTransitioning) return;
    if (this.phaserCharges <= 0) {
      const nextWave = this.level % 2 === 0 ? this.level + 1 : this.level + 2;
      this.showBanner(`⚠️ PHASER DEPLETED (RECHARGES IN WAVE ${nextWave})`);
      this.audio.playError();
      return;
    }

    const aliveDistractors = this.targetPanels.filter(t => !t.isCorrect && t.mesh && t.mesh.parent);
    if (aliveDistractors.length === 0) {
      this.showBanner('⚠️ ONLY THE CORRECT TARGET MATRIX REMAINS!');
      this.audio.playError();
      return;
    }

    this.phaserCharges--;
    this.triggerHaptic('phaser');

    const targetToDestroy = aliveDistractors[Math.floor(Math.random() * aliveDistractors.length)];
    const targetIdx = targetToDestroy.index;
    const targetVal = targetToDestroy.value;
    const targetPos = targetToDestroy.mesh.position.clone();

    this.fireProjectile(targetPos, null);

    setTimeout(() => {
      if (targetToDestroy.mesh && targetToDestroy.mesh.parent) {
        this.createMassiveExplosion(targetPos, false);
        this.scene.remove(targetToDestroy.mesh);
        this.disposeObject(targetToDestroy.mesh);
        this.targetPanels = this.targetPanels.filter(t => t !== targetToDestroy);
      }
    }, 60);

    const ammoPod = document.getElementById(`ammo-${targetIdx}`);
    if (ammoPod) {
      ammoPod.classList.add('vaporized');
    }

    this.audio.playLaser();
    this.audio.playHit(targetPos.x);
    this.audio.playVoice('distractor_eliminated', 'Distractor vaporized. Tactical probability updated.');
    this.showBanner(`💥 PHASER STRIKE: [${targetVal}] VAPORIZED!`);
    this.updateAbilityHUD();
  }

  updateAbilityHUD() {
    const jamBtn = document.getElementById('btn-jam');
    const jamBadge = document.getElementById('jam-charge-badge');
    if (jamBtn && jamBadge) {
      if (this.isJamActive) {
        jamBtn.className = 'clcars-ribbon-btn jam-ribbon-btn active-jam';
        jamBadge.innerText = `${Math.ceil(this.jamRemainingSeconds)}s`;
      } else if (this.jamCharges > 0) {
        jamBtn.className = 'clcars-ribbon-btn jam-ribbon-btn';
        jamBadge.innerText = `${this.jamCharges}/1`;
      } else {
        jamBtn.className = 'clcars-ribbon-btn jam-ribbon-btn depleted';
        jamBadge.innerText = '0/1';
      }
    }

    const phaserBtn = document.getElementById('btn-phaser-strike');
    const phaserBadge = document.getElementById('phaser-charge-badge');
    if (phaserBtn && phaserBadge) {
      if (this.phaserCharges > 0) {
        phaserBtn.className = 'clcars-phaser-strike-btn';
        phaserBadge.innerText = `⚡ ${this.phaserCharges} CHARGE${this.phaserCharges > 1 ? 'S' : ''}`;
        phaserBadge.style.color = 'var(--voyager-amber)';
      } else {
        phaserBtn.className = 'clcars-phaser-strike-btn depleted';
        phaserBadge.innerText = '0 CHARGES';
        phaserBadge.style.color = '#7b94ad';
      }
    }
  }

  cycleSandboxSector() {
    this.currentSectorIndex = (this.currentSectorIndex + 1) % this.sectors.length;
    this.buildSector(this.currentSectorIndex);
    const sec = this.sectors[this.currentSectorIndex];
    
    const sectorBtnVal = document.getElementById('val-sandbox-sector');
    if (sectorBtnVal) {
      sectorBtnVal.innerText = sec.name;
      sectorBtnVal.style.color = sec.color;
    }

    this.showBanner(`🌌 STELLAR SECTOR: ${sec.name} // ${sec.type}`);
    if (DEBUG_LOGS) console.log(`[LCARS Sector Telemetry] Active Stellar Sector -> [${this.currentSectorIndex + 1}/${this.sectors.length}] ${sec.name} (${sec.id})`);
  }

  setSandboxTargetCount(count) {
    this.testTargetCount = Math.min(4, Math.max(1, count));
    document.querySelectorAll('.sandbox-pill').forEach(pill => {
      if (parseInt(pill.getAttribute('data-count'), 10) === this.testTargetCount) {
        pill.classList.add('active');
      } else {
        pill.classList.remove('active');
      }
    });
    if (this.mode === 'ricochet_test' && this.isPlaying) {
      this.spawnTargets();
    }
    this.showBanner(`🎯 SANDBOX TARGETS: ${this.testTargetCount} ACTIVE`);
  }

  setSandboxSpeed(val) {
    const num = parseFloat(val);
    let speedMult;
    if (num <= 38 && Number.isInteger(num)) {
      if (num <= 20) {
        speedMult = num * 0.05;
      } else {
        speedMult = 1.0 + (num - 20) * 0.5;
      }
    } else {
      speedMult = num;
    }
    this.testSpeedMult = speedMult;
    const speedEl = document.getElementById('val-sandbox-speed');
    if (speedEl) speedEl.innerText = `${this.testSpeedMult.toFixed(2)}x`;

    if (this.mode === 'ricochet_test') {
      const effectiveSpeed = this.testSpeedMult * 0.20;
      this.targetPanels.forEach(t => {
        const signX = t.vx >= 0 ? 1 : -1;
        const signY = t.vy >= 0 ? 1 : -1;
        const signZ = t.vz >= 0 ? 1 : -1;
        t.vx = signX * Math.abs(t.baseVx || 0.34) * effectiveSpeed;
        t.vy = signY * Math.abs(t.baseVy || 0.26) * effectiveSpeed;
        t.vz = signZ * Math.abs(t.baseVz || 0.20) * effectiveSpeed;
      });
    }
  }

  setSandboxSpin(val) {
    this.testSpinMult = parseFloat(val);
    const spinEl = document.getElementById('val-sandbox-spin');
    if (spinEl) spinEl.innerText = `${this.testSpinMult.toFixed(1)}x`;

    if (this.mode === 'ricochet_test') {
      this.targetPanels.forEach(t => {
        t.rotX = (t.baseRotX || 0.008) * this.testSpinMult;
        t.rotY = (t.baseRotY || 0.012) * this.testSpinMult;
      });
    }
  }

  toggleSandboxVelocityPause() {
    this.isTestVelocityPaused = !this.isTestVelocityPaused;
    const btn = document.getElementById('btn-sandbox-pause-vel');
    if (btn) {
      if (this.isTestVelocityPaused) {
        btn.classList.add('paused', 'is-off');
        btn.innerText = '▶️ TEST MATRIX';
        this.showBanner('⏸️ TARGET VELOCITY: FROZEN (ROTATION ACTIVE)');
      } else {
        btn.classList.remove('paused', 'is-off');
        btn.innerText = '⏸️ TEST MATRIX';
        this.showBanner('▶️ TARGET VELOCITY: RESUMED');
      }
    }
  }

  setSandboxGlow(val) {
    this.testGlowMult = parseFloat(val);
    const glowEl = document.getElementById('val-sandbox-glow');
    if (glowEl) glowEl.innerText = `${this.testGlowMult.toFixed(1)}x`;

    // Live update all active target glowing 3D lights, material emissives, and 3D numerals!
    if (this.targetPanels && this.targetPanels.length > 0) {
      this.targetPanels.forEach((t, i) => {
        if (t.internalLight) {
          t.internalLight.intensity = 2.8 * Math.max(0.1, this.testGlowMult);
        }
        if (t.mesh && t.mesh.material) {
          t.mesh.material.emissiveIntensity = 0.85 * Math.min(2.5, Math.max(0.2, this.testGlowMult));
        }
        if (t.mesh) {
          const colorHex = t.isAttacking ? 0xff2222 : (t.choiceColorHex || 0xff6f59);
          if (t.numGroupFront) {
            t.mesh.remove(t.numGroupFront);
            this.disposeObject(t.numGroupFront);
          }
          if (t.numGroupBack) {
            t.mesh.remove(t.numGroupBack);
            this.disposeObject(t.numGroupBack);
          }
          t.numGroupFront = this.create3DNumeralGroup(String(t.value), colorHex, this.testGlowMult, this.testTextHighlightMult);
          t.numGroupFront.position.set(0, 0, 0.385);
          t.mesh.add(t.numGroupFront);

          t.numGroupBack = this.create3DNumeralGroup(String(t.value), colorHex, this.testGlowMult, this.testTextHighlightMult);
          t.numGroupBack.position.set(0, 0, -0.385);
          t.numGroupBack.rotation.y = Math.PI;
          t.mesh.add(t.numGroupBack);
        }
      });
    }
    if (DEBUG_LOGS) console.log(`[LCARS Physics Sandbox] Internal Glow Mult -> ${this.testGlowMult.toFixed(1)}x`);
  }

  setSandboxTextHighlight(val) {
    this.testTextHighlightMult = parseFloat(val);
    const hlEl = document.getElementById('val-sandbox-text-highlight');
    if (hlEl) hlEl.innerText = `${this.testTextHighlightMult.toFixed(1)}x`;

    // Live update all active target 3D numerals and point lights!
    if (this.targetPanels && this.targetPanels.length > 0) {
      this.targetPanels.forEach((t, i) => {
        if (t.mesh) {
          const colorHex = t.isAttacking ? 0xff2222 : (t.choiceColorHex || 0xff6f59);
          if (t.numGroupFront) {
            t.mesh.remove(t.numGroupFront);
            this.disposeObject(t.numGroupFront);
          }
          if (t.numGroupBack) {
            t.mesh.remove(t.numGroupBack);
            this.disposeObject(t.numGroupBack);
          }
          t.numGroupFront = this.create3DNumeralGroup(String(t.value), colorHex, this.testGlowMult, this.testTextHighlightMult);
          t.numGroupFront.position.set(0, 0, 0.385);
          t.mesh.add(t.numGroupFront);

          t.numGroupBack = this.create3DNumeralGroup(String(t.value), colorHex, this.testGlowMult, this.testTextHighlightMult);
          t.numGroupBack.position.set(0, 0, -0.385);
          t.numGroupBack.rotation.y = Math.PI;
          t.mesh.add(t.numGroupBack);
        }
      });
    }
    if (DEBUG_LOGS) console.log(`[LCARS Physics Sandbox] Text Highlight Mult -> ${this.testTextHighlightMult.toFixed(1)}x`);
  }

  setSandboxExplosionParticles(val) {
    this.testExplosionParticles = parseInt(val, 10) || 250;
    const el = document.getElementById('val-sandbox-particles');
    if (el) el.innerText = `${this.testExplosionParticles}`;
    if (DEBUG_LOGS) console.log(`[LCARS Physics Sandbox] Explosion Particles -> ${this.testExplosionParticles}`);
  }

  setRicochetSoundProfile(profileKey, silent = false) {
    const profile = this.audio.setRicochetProfile(profileKey, !silent);
    const profileNames = {
      baseline: 'BASELINE [R] ▾',
      harmonic: 'HARMONIC [R] ▾',
      deep_bass: 'DEEP BASS [R] ▾',
      warp_ping: 'STARFLEET PING [R] ▾',
      tachyon_deflect: 'TACHYON [R] ▾'
    };
    const toastNames = {
      baseline: '1. BASELINE CHIRP (680Hz-1.8kHz)',
      harmonic: '2. HARMONIC TRIAD (C5-E5-G5)',
      deep_bass: '3. DEEP BASS BOOP (185Hz-52Hz)',
      warp_ping: '4. STARFLEET WARP-PING (1760Hz)',
      tachyon_deflect: '5. TACHYON DEFLECT (1450Hz-320Hz)'
    };
    
    const btn = document.getElementById('btn-ricochet-sfx');
    if (btn) {
      btn.innerText = `🔊 SFX: ${profileNames[profile] || profile.toUpperCase()}`;
    }

    const items = document.querySelectorAll('.lcars-dropdown-item');
    items.forEach(item => {
      if (item.getAttribute('data-sfx') === profile) item.classList.add('active');
      else item.classList.remove('active');
    });

    const menu = document.getElementById('ricochet-sfx-menu');
    if (menu) menu.classList.add('hidden');

    if (!silent) {
      this.showBanner(`🔊 SFX ACTIVE: ${toastNames[profile] || profile}`);
    }
  }

  cycleRicochetSoundProfile() {
    const next = this.audio.cycleRicochetProfile();
    this.setRicochetSoundProfile(next);
  }

  syncAudioUI() {
    const muteBtn = document.getElementById('btn-mute-toggle');
    const pauseSoundBtn = document.getElementById('btn-pause-sound-toggle');
    const isMuted = this.audio.isMuted;

    if (muteBtn) {
      if (isMuted) {
        muteBtn.classList.add('muted', 'is-off');
        muteBtn.innerText = '🔇 MUTE [M]';
      } else {
        muteBtn.classList.remove('muted', 'is-off');
        muteBtn.innerText = '🔊 MUTE [M]';
      }
    }

    if (pauseSoundBtn) {
      if (isMuted) {
        pauseSoundBtn.classList.add('is-off');
        pauseSoundBtn.innerText = '🔇 SOUND: OFF';
      } else {
        pauseSoundBtn.classList.remove('is-off');
        pauseSoundBtn.innerText = '🔊 SOUND: ON';
      }
    }

    const ambBtn = document.getElementById('btn-ambient-toggle');
    if (ambBtn) {
      if (!this.audio.ambientEnabled) {
        ambBtn.classList.add('is-off');
        ambBtn.innerText = '🌌 AMBIENT: OFF [A]';
      } else {
        ambBtn.classList.remove('is-off');
        ambBtn.innerText = '🌌 AMBIENT [A]';
      }
    }

    const voiceBtn = document.getElementById('btn-voice-toggle');
    if (voiceBtn) {
      if (!this.audio.voiceEnabled) {
        voiceBtn.classList.add('is-off');
        voiceBtn.innerText = '🎙️ VOICE: OFF [T]';
        voiceBtn.style.color = '#888888';
      } else {
        voiceBtn.classList.remove('is-off');
        const p = this.audio.voicePersona;
        if (p === 'commander') {
          voiceBtn.innerText = '🎙️ VOICE: COMMANDER [T]';
          voiceBtn.style.color = '#33ffaa';
        } else if (p === 'computer') {
          voiceBtn.innerText = '🖥️ VOICE: COMPUTER [T]';
          voiceBtn.style.color = 'var(--voyager-periwinkle)';
        } else if (p === 'sisko') {
          voiceBtn.innerText = '🖖 VOICE: SISKO [T]';
          voiceBtn.style.color = '#ffbb00';
        } else if (p === 'bashir') {
          voiceBtn.innerText = '🩺 VOICE: BASHIR [T]';
          voiceBtn.style.color = '#00f0ff';
        } else if (p === 'emh') {
          voiceBtn.innerText = '🚑 VOICE: EMH DOCTOR [T]';
          voiceBtn.style.color = '#ff66aa';
        }
      }
    }
  }

  toggleVoicePersona() {
    const persona = this.audio.toggleVoicePersona();
    this.syncAudioUI();
    const bannerMap = {
      commander: '🎙️ VOICE MATRIX: TACTICAL COMMANDER (AUTHORITATIVE FEMALE)',
      computer: '🖥️ VOICE MATRIX: LCARS COMPUTER (MAJEL BARRETT)',
      sisko: '🖖 VOICE MATRIX: CAPTAIN BENJAMIN SISKO (DEEP BARITONE)',
      bashir: '🩺 VOICE MATRIX: DR. JULIAN BASHIR (BRITISH RP)',
      emh: '🚑 VOICE MATRIX: EMH HOLOGRAM DOCTOR (ROBERT PICARDO)'
    };
    this.showBanner(bannerMap[persona] || '🎙️ VOICE MATRIX UPDATED');
    if (this.logInteraction) this.logInteraction('voice', `Voice Persona set to: ${persona}`);
  }

  toggleVisualizer() {
    this.isVisualizerOpen = !this.isVisualizerOpen;
    const btn = document.getElementById('btn-visualizer-toggle');
    if (btn) {
      if (this.isVisualizerOpen) {
        btn.classList.add('active');
        btn.classList.remove('is-off');
        btn.innerText = '🔬 VISUALIZER [V]';
        this.audio.playVoice('visualizer_engaged', 'Computer visualizer engaged.');
      } else {
        btn.classList.remove('active');
        btn.classList.add('is-off');
        btn.innerText = '🔬 VISUALIZER: OFF [V]';
        this.audio.playVoice('visualizer_off', 'Computer visualizer offline.');
      }
    }
    this.updateVisualizer();
  }

  toggleStats() {
    this.showStats = !this.showStats;
    const hud = document.getElementById('lcars-stats-hud');
    const btn = document.getElementById('btn-stats-toggle');
    if (this.showStats) {
      if (hud) hud.classList.remove('hidden');
      if (btn) {
        btn.classList.add('active');
        btn.classList.remove('is-off');
      }
      this.showBanner('📊 FPS & STATS HUD: ON [F]');
    } else {
      if (hud) hud.classList.add('hidden');
      if (btn) {
        btn.classList.remove('active');
        btn.classList.add('is-off');
      }
      this.showBanner('📊 STATS HUD: OFF [F]');
    }
  }

  toggleNormalPlay() {
    const btn = document.getElementById('btn-toggle-normal-play');
    if (this.mode === 'ricochet_test') {
      // Switch from Sandbox Test Matrix to Live Normal Mission Play
      this.mode = 'velocity';
      this.shieldsLeft = 3;
      this.waveTotalTime = this.calculateWaveTimeLimit(this.level);
      this.waveRemainingTime = this.waveTotalTime;
      this.updateHUD();
      this.spawnTargets();
      if (btn) {
        btn.innerText = '🎮 NORMAL PLAY: ON (LIVE RULES)';
        btn.style.background = '#004422';
        btn.style.borderColor = '#33ff66';
        btn.style.color = '#33ff66';
      }
      this.showBanner('🎮 NORMAL RUN MODE ENGAGED // STANDARD TIMERS & SHIELDS');
    } else {
      // Switch from Live Normal Play to Sandbox Test Matrix
      this.mode = 'ricochet_test';
      this.shieldsLeft = 3;
      this.waveTotalTime = 999.0;
      this.waveRemainingTime = 999.0;
      this.updateHUD();
      this.spawnTargets();
      if (btn) {
        btn.innerText = '🎮 TOGGLE NORMAL PLAY';
        btn.style.background = '#0e2a22';
        btn.style.borderColor = '#33ff88';
        btn.style.color = '#33ff88';
      }
      this.showBanner('🎯 TEST MATRIX ENGAGED // INFINITE SHIELDS & SANDBOX TIMERS');
    }
    const sb = document.getElementById('test-sandbox-panel');
    if (sb) sb.classList.remove('hidden');
    if (DEBUG_LOGS) console.log(`[LCARS Test Matrix] Toggled Gameplay Mode -> ${this.mode}`);
  }

  detectDisplayRefreshRate() {
    let frameCount = 0;
    let startTime = null;
    const sampleFrames = (now) => {
      if (!startTime) startTime = now;
      frameCount++;
      if (frameCount < 35) {
        requestAnimationFrame(sampleFrames);
      } else {
        const elapsed = (now - startTime) / 1000;
        const rawHz = Math.round(frameCount / elapsed);
        if (Math.abs(rawHz - 75) <= 4) this.detectedDisplayHz = 75;
        else if (Math.abs(rawHz - 60) <= 4) this.detectedDisplayHz = 60;
        else if (Math.abs(rawHz - 120) <= 6) this.detectedDisplayHz = 120;
        else if (Math.abs(rawHz - 144) <= 6) this.detectedDisplayHz = 144;
        else this.detectedDisplayHz = rawHz > 30 ? rawHz : 75;
        if (DEBUG_LOGS) console.log(`[LCARS Hardware Telemetry] Detected Display Refresh Rate: ${this.detectedDisplayHz}Hz (Raw: ${rawHz})`);
        this.updateRecordingTelemetry();
      }
    };
    requestAnimationFrame(sampleFrames);
  }

  toggleRecording() {
    if (this.isRecording) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  }

  async startRecording() {
    if (this.isRecording) return;
    try {
      const targetFPS = this.recTargetFPS === 'auto' ? (this.detectedDisplayHz || 75) : parseInt(this.recTargetFPS || 75, 10);
      let videoStream = null;
      let captureRes = '';

      if (this.recSource === 'tab') {
        // 1. Full LCARS HUD Tab / Display Capture via getDisplayMedia
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
          this.showBanner('⚠️ Screen & Tab Capture not supported in this browser', true);
          return;
        }
        try {
          const displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              displaySurface: 'browser',
              frameRate: { ideal: targetFPS, max: 120 }
            },
            audio: true,
            preferCurrentTab: true,
            selfBrowserSurface: 'include',
            systemAudio: 'include'
          });
          this.recDisplayStream = displayStream;

          const vTrack = displayStream.getVideoTracks()[0];
          let rawW = window.innerWidth;
          let rawH = window.innerHeight;
          if (vTrack) {
            const settings = vTrack.getSettings ? vTrack.getSettings() : {};
            if (settings.width && settings.height) {
              rawW = settings.width;
              rawH = settings.height;
            }
            vTrack.onended = () => {
              if (this.isRecording) this.stopRecording();
            };
          }

          // Anti-Green Screen Sanitizer: Enforce strictly even integer dimensions (multiples of 2)
          // Hardware H.264 / NV12 chroma subsamplers glitch and flash green when dimensions are odd
          const cleanW = Math.max(320, Math.floor(rawW / 2) * 2);
          const cleanH = Math.max(240, Math.floor(rawH / 2) * 2);
          captureRes = `${cleanW}x${cleanH}`;

          // Create or reuse hidden relay video element
          if (!this.tabRelayVideo) {
            this.tabRelayVideo = document.createElement('video');
            this.tabRelayVideo.muted = true;
            this.tabRelayVideo.playsInline = true;
            this.tabRelayVideo.autoplay = true;
          }
          this.tabRelayVideo.srcObject = displayStream;
          try {
            await this.tabRelayVideo.play();
          } catch(e) {}

          // Create or reuse relay canvas with alpha disabled to prevent YUV zero green bleed
          if (!this.tabRelayCanvas) {
            this.tabRelayCanvas = document.createElement('canvas');
          }
          this.tabRelayCanvas.width = cleanW;
          this.tabRelayCanvas.height = cleanH;
          const relayCtx = this.tabRelayCanvas.getContext('2d', { alpha: false, desynchronized: true });

          // Start steady rendering loop to guarantee fixed framerate and opaque background
          const drawTabFrame = () => {
            if (!this.isRecording || this.recSource !== 'tab') return;
            if (this.tabRelayVideo && this.tabRelayVideo.readyState >= 2) {
              if (relayCtx) {
                relayCtx.fillStyle = '#000000'; // Guaranteed opaque black base
                relayCtx.fillRect(0, 0, cleanW, cleanH);
                relayCtx.drawImage(this.tabRelayVideo, 0, 0, cleanW, cleanH);
              }
            }
            this.tabRelayAnimId = requestAnimationFrame(drawTabFrame);
          };
          if (this.tabRelayAnimId) cancelAnimationFrame(this.tabRelayAnimId);
          this.tabRelayAnimId = requestAnimationFrame(drawTabFrame);

          // Capture smooth, perfectly aligned canvas stream - immune to NV12 green flickering!
          videoStream = this.tabRelayCanvas.captureStream ? this.tabRelayCanvas.captureStream(targetFPS) : null;
          if (!videoStream) {
            videoStream = displayStream;
          }
        } catch(e) {
          if (e.name !== 'NotAllowedError') {
            console.error('[LCARS Flight Recorder] Tab capture error:', e);
            this.showBanner('⚠️ TAB CAPTURE ERROR: ' + e.message, true);
          }
          return;
        }
      } else {
        // 2. 3D Engine WebGL Canvas Stream
        if (!this.renderer) return;
        const canvas = this.renderer.domElement;
        videoStream = canvas.captureStream ? canvas.captureStream(targetFPS) : null;
        if (!videoStream) {
          this.showBanner('⚠️ Canvas captureStream not supported in this browser', true);
          return;
        }
        captureRes = `${canvas.width}x${canvas.height}`;
      }

      // Mix Web Audio Tracks into MediaStream
      let combinedStream = videoStream;
      const gameAudioStream = (this.recAudioEnabled && this.audio && this.audio.getMediaStream) ? this.audio.getMediaStream() : null;
      
      const audioTracks = [];
      if (gameAudioStream && gameAudioStream.getAudioTracks().length > 0) {
        audioTracks.push(...gameAudioStream.getAudioTracks());
      }
      if (videoStream.getAudioTracks().length > 0) {
        audioTracks.push(...videoStream.getAudioTracks());
      }

      if (audioTracks.length > 0) {
        combinedStream = new MediaStream([
          ...videoStream.getVideoTracks(),
          ...audioTracks
        ]);
      }

      // 3. Select Video Codec (Pure H.264 MP4 with WebM Safe Mode Fallback)
      const preferredCodec = this.recPreferredCodec || 'h264';
      let selectedMime = '';
      const codecCandidates = {
        h264: [
          'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
          'video/mp4;codecs=avc1.4d002a,mp4a.40.2',
          'video/mp4;codecs=avc1',
          'video/mp4',
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=vp8,opus',
          'video/webm'
        ],
        h264_high: [
          'video/mp4;codecs=avc1.64002a,mp4a.40.2',
          'video/mp4;codecs=avc1.4d002a,mp4a.40.2',
          'video/mp4;codecs=avc1',
          'video/mp4',
          'video/webm;codecs=vp9,opus',
          'video/webm'
        ],
        webm: [
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=vp8,opus',
          'video/webm',
          'video/mp4;codecs=avc1',
          'video/mp4'
        ]
      };

      const candidateList = [
        ...(codecCandidates[preferredCodec] || []),
        ...codecCandidates.h264,
        ...codecCandidates.h264_high,
        ...codecCandidates.webm,
        'video/mp4'
      ];

      for (const mime of candidateList) {
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(mime)) {
          selectedMime = mime;
          break;
        }
      }

      const bitrate = parseInt(this.recBitrate || 16000000, 10);
      const options = { videoBitsPerSecond: bitrate };
      if (selectedMime) options.mimeType = selectedMime;

      this.mediaRecorder = new MediaRecorder(combinedStream, options);
      this.recordedChunks = [];
      this.recStartTime = Date.now();
      this.isRecording = true;
      this.activeRecordingMime = (this.mediaRecorder && this.mediaRecorder.mimeType) ? this.mediaRecorder.mimeType : (selectedMime || 'video/mp4');
      this.activeRecordingFPS = targetFPS;
      this.activeRecordingRes = captureRes || (this.renderer ? `${this.renderer.domElement.width}x${this.renderer.domElement.height}` : `${window.innerWidth}x${window.innerHeight}`);

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.handleRecordingComplete();
      };

      this.mediaRecorder.start(400);

      if (this.recTimerInterval) clearInterval(this.recTimerInterval);
      this.recTimerInterval = setInterval(() => {
        this.updateRecordingTelemetry(false);
      }, 100);

      this.updateRecordingUI(true);
      const srcLabel = this.recSource === 'tab' ? 'FULL LCARS UI' : '3D ENGINE';
      this.showBanner(`🔴 RECORDING ENGAGED [${srcLabel} // ${targetFPS} FPS // ${this.activeRecordingRes}]`);
      if (DEBUG_LOGS) {
        console.log(`[LCARS Flight Recorder] Started -> Source: ${this.recSource} | Mime: ${this.activeRecordingMime} | FPS: ${targetFPS} | Res: ${this.activeRecordingRes} | Bitrate: ${(bitrate/1e6).toFixed(1)} Mbps`);
      }
    } catch (err) {
      console.error('[LCARS Flight Recorder] Recording error:', err);
      this.showBanner('⚠️ RECORDING ERROR: ' + err.message, true);
      this.isRecording = false;
      this.updateRecordingUI(false);
    }
  }

  stopRecording() {
    if (!this.isRecording || !this.mediaRecorder) return;
    this.isRecording = false;
    if (this.recTimerInterval) clearInterval(this.recTimerInterval);
    if (this.tabRelayAnimId) {
      cancelAnimationFrame(this.tabRelayAnimId);
      this.tabRelayAnimId = null;
    }
    if (this.tabRelayVideo) {
      try {
        this.tabRelayVideo.pause();
        this.tabRelayVideo.srcObject = null;
      } catch(e) {}
    }
    if (this.recDisplayStream) {
      try {
        this.recDisplayStream.getTracks().forEach(t => t.stop());
      } catch(e) {}
      this.recDisplayStream = null;
    }
    if (this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    if (this.mediaRecorder && this.mediaRecorder.stream) {
      try {
        this.mediaRecorder.stream.getTracks().forEach(t => t.stop());
      } catch(e) {}
    }
    this.updateRecordingUI(false);
  }

  handleRecordingComplete() {
    if (!this.recordedChunks || this.recordedChunks.length === 0) return;
    const mimeType = this.activeRecordingMime || 'video/mp4';
    const blob = new Blob(this.recordedChunks, { type: mimeType });
    const ext = this.activeRecordingMime.includes('webm') ? 'webm' : 'mp4';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const srcTag = this.recSource === 'tab' ? 'full-ui' : 'engine';
    const filename = `holodeck-math-blaster-${srcTag}-${this.activeRecordingRes}-${this.activeRecordingFPS}fps-${timestamp}.${ext}`;

    // Clean up previous blob URL to prevent memory leaks
    if (this.lastRecordedBlobUrl) {
      try { URL.revokeObjectURL(this.lastRecordedBlobUrl); } catch(e) {}
      this.lastRecordedBlobUrl = null;
    }

    const url = URL.createObjectURL(blob);
    this.lastRecordedBlobUrl = url;
    this.lastRecordedFilename = filename;

    // 1. Populate Preview Modal
    const previewModal = document.getElementById('recorder-preview-modal');
    const previewVideo = document.getElementById('rec-preview-video');
    const metaRes = document.getElementById('rec-meta-res');
    const metaFps = document.getElementById('rec-meta-fps');
    const metaCodec = document.getElementById('rec-meta-codec');
    const metaSize = document.getElementById('rec-meta-size');

    if (previewVideo) {
      previewVideo.src = url;
      previewVideo.load();
    }
    if (metaRes) metaRes.innerText = this.activeRecordingRes;
    if (metaFps) metaFps.innerText = `${this.activeRecordingFPS} FPS`;
    if (metaCodec) metaCodec.innerText = ext === 'webm' ? 'WebM (VP8/VP9)' : 'H.264 (MP4)';
    if (metaSize) metaSize.innerText = `${(blob.size / (1024 * 1024)).toFixed(2)} MB`;

    if (previewModal) previewModal.classList.remove('hidden');

    // 2. Trigger automatic download
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => document.body.removeChild(a), 200);

    this.showBanner(`💾 RECORDING SAVED: ${filename}`);
  }

  updateRecordingTelemetry(fullUpdate = true) {
    const elDuration = document.getElementById('rec-val-duration');

    if (this.isRecording) {
      const elapsedMs = Date.now() - (this.recStartTime || Date.now());
      const totalSec = Math.floor(elapsedMs / 1000);
      const mins = String(Math.floor(totalSec / 60)).padStart(2, '0');
      const secs = String(totalSec % 60).padStart(2, '0');
      const tenths = Math.floor((elapsedMs % 1000) / 100);
      const durStr = `${mins}:${secs}.${tenths}`;
      if (elDuration && elDuration.innerText !== durStr) {
        elDuration.innerText = durStr;
      }
    } else {
      if (elDuration && !this.lastRecordedBlobUrl && elDuration.innerText !== '00:00.0') {
        elDuration.innerText = '00:00.0';
      }
    }

    if (!fullUpdate) return;

    const canvas = this.renderer ? this.renderer.domElement : null;
    const resStr = canvas ? `${canvas.width}x${canvas.height}` : `${window.innerWidth}x${window.innerHeight}`;
    const isPortrait = window.innerHeight > window.innerWidth;
    const orientTag = isPortrait ? 'Portrait' : 'Landscape';
    const targetFPS = this.recTargetFPS === 'auto' ? (this.detectedDisplayHz || 75) : (this.recTargetFPS || 75);

    const elStatus = document.getElementById('rec-val-status');
    const elSource = document.getElementById('rec-val-source');
    const elRes = document.getElementById('rec-val-resolution');
    const elFps = document.getElementById('rec-val-fps');
    const elCodec = document.getElementById('rec-val-codec');

    if (elSource) {
      elSource.innerText = this.recSource === 'tab' ? 'FULL LCARS UI (TAB CAPTURE)' : '3D ENGINE (CANVAS STREAM)';
    }
    if (elRes) elRes.innerText = `${resStr} [${orientTag}]`;
    if (elFps) elFps.innerText = `${targetFPS} FPS [${this.detectedDisplayHz || 75}Hz Display Synced]`;

    if (this.isRecording) {
      if (elStatus) {
        elStatus.innerText = '🔴 RECORDING ACTIVE';
        elStatus.style.color = '#ff3355';
      }
      if (elCodec) elCodec.innerText = this.activeRecordingMime || (this.recPreferredCodec === 'webm' ? 'VP9 (video/webm)' : 'H.264 (video/mp4; codecs=avc1)');
    } else {
      if (elStatus) {
        elStatus.innerText = 'READY // STANDBY';
        elStatus.style.color = '#33ff88';
      }
      if (elCodec) elCodec.innerText = this.recPreferredCodec === 'webm' ? 'VP9 (video/webm; codecs=vp9)' : 'H.264 (video/mp4; codecs=avc1)';
    }
  }

  updateRecordingUI(isRecording) {
    const btn = document.getElementById('btn-toggle-recording');
    const lbl = document.getElementById('rec-btn-label');
    const dot = document.getElementById('rec-status-dot');
    if (btn) {
      if (isRecording) {
        btn.classList.add('recording');
        if (lbl) lbl.innerText = 'STOP & EXPORT VIDEO';
        if (dot) dot.innerText = '⏹️';
      } else {
        btn.classList.remove('recording');
        const targetFPS = this.recTargetFPS === 'auto' ? (this.detectedDisplayHz || 75) : this.recTargetFPS;
        if (lbl) lbl.innerText = `START ${targetFPS} FPS RECORDING`;
        if (dot) dot.innerText = '⏺️';
      }
    }
    this.updateRecordingTelemetry(true);
  }

  setRecordingSource(source) {
    this.recSource = source; // 'canvas' or 'tab'
    document.querySelectorAll('#rec-source-pills button').forEach(btn => {
      if (btn.getAttribute('data-source') === source) btn.classList.add('active');
      else btn.classList.remove('active');
    });
    this.updateRecordingTelemetry(true);
    const srcLabels = {
      canvas: '3D ENGINE (CANVAS STREAM)',
      tab: 'FULL LCARS UI (TAB CAPTURE)'
    };
    this.showBanner(`🎥 CAPTURE SOURCE: ${srcLabels[source] || source.toUpperCase()}`);
  }

  setRecordingFPS(fps) {
    this.recTargetFPS = fps;
    document.querySelectorAll('#rec-fps-pills button').forEach(btn => {
      if (btn.getAttribute('data-fps') === String(fps)) btn.classList.add('active');
      else btn.classList.remove('active');
    });
    this.updateRecordingUI(this.isRecording);
    this.showBanner(`⚡ RECORDING FPS: ${fps === 'auto' ? 'DISPLAY REFRESH SYNC' : fps + ' FPS'}`);
  }

  setRecordingCodec(codec) {
    this.recPreferredCodec = codec;
    document.querySelectorAll('#rec-codec-pills button').forEach(btn => {
      if (btn.getAttribute('data-codec') === codec) btn.classList.add('active');
      else btn.classList.remove('active');
    });
    this.updateRecordingTelemetry(true);
    const codecLabels = {
      h264: 'H.264 (UNIVERSAL MP4)',
      h264_high: 'H.264 HIGH PROFILE (MP4)',
      webm: 'VP9 (WEBM SAFE MODE)'
    };
    this.showBanner(`🎞️ VIDEO FORMAT: ${codecLabels[codec] || codec.toUpperCase()}`);
  }

  setRecordingBitrate(bitrate) {
    this.recBitrate = parseInt(bitrate, 10);
    document.querySelectorAll('#rec-bitrate-pills button').forEach(btn => {
      if (btn.getAttribute('data-bitrate') === String(bitrate)) btn.classList.add('active');
      else btn.classList.remove('active');
    });
    const mbps = (this.recBitrate / 1000000).toFixed(0);
    this.showBanner(`💾 RECORDING BITRATE: ${mbps} MBPS`);
  }

  toggleMasterMute() {
    const isMuted = this.audio.toggleMasterMute();
    this.syncAudioUI();
    if (isMuted) {
      this.showBanner('🔇 ALL AUDIO MUTED [M]');
    } else {
      this.showBanner('🔊 AUDIO RESTORED [M]');
    }
  }

  toggleAmbient() {
    const active = this.audio.toggleAmbient();
    this.syncAudioUI();
    if (active) {
      this.showBanner('🌌 AMBIENT HUM: ON [A]');
    } else {
      this.showBanner('🌌 AMBIENT HUM: OFF [A]');
    }
  }

  nextProblem() {
    this.isFirstShotOnProblem = true;
    this.jamCharges = 1;
    this.isJamActive = false;
    this.jamRemainingSeconds = 0;
    // Phaser Disruptor gains +1 charge every 2 rounds (on odd waves >= 3)
    if (this.level > 1 && this.level % 2 === 1) {
      this.phaserCharges++;
    }
    this.currentProblem = MathGenerator.generateProblem(this.rank, this.level);
    
    // Randomized Starfleet Directive Code (e.g., 04-8291, 17-4092, 42-8819)
    const p1 = String(Math.floor(Math.random() * 90 + 10)).padStart(2, '0');
    const p2 = String(Math.floor(Math.random() * 9000 + 1000)).padStart(4, '0');
    const randDirectiveCode = `${p1}-${p2}`;

    // Compute tactical category initials for mobile (e.g. FLEET ADMIRAL CALCULUS MATRIX -> F.A.C.M.)
    const rawCategory = this.currentProblem.category || 'TACTICAL MATRIX';
    const words = rawCategory.toUpperCase().replace(/[^A-Z\s]/g, '').trim().split(/\s+/);
    let shortCat = '';
    if (words.length >= 3) {
      shortCat = words.map(w => w[0]).join('.') + '.';
    } else if (words.length === 2) {
      shortCat = `${words[0].slice(0, 3)}. ${words[1].slice(0, 4)}.`;
    } else {
      shortCat = rawCategory;
    }

    const catEl = document.getElementById('target-q-category');
    if (catEl) {
      catEl.innerHTML = `<span class="cat-full">${rawCategory} // ${randDirectiveCode}</span><span class="cat-short">${shortCat} // ${randDirectiveCode}</span>`;
    }

    document.getElementById('target-equation-text').innerText = `${this.currentProblem.question} = ?`;

    this.currentProblem.choices.forEach((choice, idx) => {
      const el = document.getElementById(`ammo-val-${idx}`);
      if (el) {
        const choiceStr = String(choice).trim();
        if (choiceStr === '6') {
          el.innerHTML = `<span class="lcars-underlined-digit">${choiceStr}</span>`;
        } else {
          el.innerText = choiceStr;
        }
      }
    });

    document.querySelectorAll(".clcars-ammo-pill").forEach(pod => pod.classList.remove("vaporized"));
    this.spawnTargets();
    this.updateAbilityHUD();
    this.updateVisualizer();

    if (this.mode === 'ricochet_test') {
      const sb = document.getElementById('test-sandbox-panel');
      if (sb) sb.classList.remove('hidden');
    }
  }

  showBanner(text, isDanger = false) {
    const banner = document.getElementById('center-banner');
    banner.innerText = text;
    if (isDanger) banner.classList.add('danger');
    else banner.classList.remove('danger');

    banner.classList.add('show');
    setTimeout(() => banner.classList.remove('show'), 1300);
  }

  updateHUD() {
    document.getElementById('hud-score').innerText = String(this.score).padStart(4, '0');
    document.getElementById('hud-level').innerText = `WAVE ${this.level}`;
    document.getElementById('hud-warp').innerText = `WARP ${this.warpFactor.toFixed(1)}`;
    this.updateHighScoreDisplay();
    
    // Update Voyager Oval Shield Capsule Status
    const pctEl = document.getElementById('shield-pct-text');
    const tagEl = document.getElementById('shield-matrix-tag');
    const ovalEl = document.getElementById('v-shield-oval');

    if (this.shieldsLeft === 3) {
      pctEl.innerText = '100%';
      pctEl.style.color = '#33ff66';
      if (tagEl) { tagEl.innerText = 'PRIMARY OPTIMAL'; tagEl.className = 'v-pill-btn v-mauve'; }
      if (ovalEl) ovalEl.style.borderColor = 'var(--voyager-peach)';
    } else if (this.shieldsLeft === 2) {
      pctEl.innerText = '66%';
      pctEl.style.color = '#ffaa00';
      if (tagEl) { tagEl.innerText = 'SECONDARY ONLINE'; tagEl.className = 'v-pill-btn v-amber'; }
      if (ovalEl) ovalEl.style.borderColor = 'var(--voyager-amber)';
    } else if (this.shieldsLeft === 1) {
      pctEl.innerText = '33%';
      pctEl.style.color = '#ff3333';
      if (tagEl) { tagEl.innerText = 'TERTIARY CRITICAL'; tagEl.className = 'v-pill-btn v-peach'; }
      if (ovalEl) ovalEl.style.borderColor = '#ff3333';
    } else {
      pctEl.innerText = '0%';
      pctEl.style.color = '#ff3333';
      if (tagEl) { tagEl.innerText = 'SHIELDS COLLAPSED'; tagEl.className = 'v-pill-btn v-peach'; }
      if (ovalEl) ovalEl.style.borderColor = '#ff0000';
    }

    for (let i = 1; i <= 3; i++) {
      const cell = document.getElementById(`shield-cell-${i}`);
      if (cell) {
        if (i <= this.shieldsLeft) {
          cell.className = 'v-level-row active';
        } else {
          cell.className = 'v-level-row shattered';
        }
      }
      const dot = document.getElementById(`v-dot-${i}`);
      if (dot) {
        if (i <= this.shieldsLeft) {
          dot.className = (this.shieldsLeft === 3 ? 'v-shield-dot active' : (this.shieldsLeft === 2 ? 'v-shield-dot amber' : 'v-shield-dot red'));
        } else {
          dot.className = 'v-shield-dot depleted';
        }
      }
    }

    const mins = String(Math.floor(this.elapsedSeconds / 60)).padStart(2, '0');
    const secs = String(this.elapsedSeconds % 60).padStart(2, '0');
    document.getElementById('hud-timer').innerText = `${mins}:${secs}`;
  }

  initTooltips() {
    const tooltip = document.getElementById('lcars-tooltip');
    if (!tooltip) return;

    // Smart Dynamic Boundary & Collision-Aware Positioner (Never Off-Screen, Never Blocks Panels)
    const updateTooltipPosition = (e, targetEl = null) => {
      const tw = tooltip.offsetWidth || 310;
      const th = tooltip.offsetHeight || 150;
      const pad = 12;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const cursorX = e ? e.clientX : (targetEl ? targetEl.getBoundingClientRect().left : 50);
      const cursorY = e ? e.clientY : (targetEl ? targetEl.getBoundingClientRect().top : 50);

      let posX = cursorX + 16;
      let posY = cursorY + 14;

      // 1. Horizontal Smart Flip:
      // If hovering elements in the right 35% of the screen (e.g. Tactical Shields header), flip to the LEFT of the element/cursor
      if (cursorX > vw * 0.65 || posX + tw + pad > vw) {
        posX = cursorX - tw - 16;
      }
      posX = Math.max(pad, Math.min(vw - tw - pad, posX));

      // 2. Vertical Smart Flip:
      // If hovering elements in the bottom 40% of the screen (e.g. Phaser Strike, Jam button), flip strictly ABOVE the cursor/element
      if (cursorY > vh * 0.60 || posY + th + pad > vh) {
        posY = cursorY - th - 16;
      }
      posY = Math.max(pad, Math.min(vh - th - pad, posY));

      // 3. Explicit Target Element Offset Check:
      if (targetEl && typeof targetEl.getBoundingClientRect === 'function') {
        const rect = targetEl.getBoundingClientRect();
        // If bottom dock button, guarantee tooltip bottom is comfortably above button top
        if (rect.bottom > vh * 0.70) {
          posY = Math.max(pad, rect.top - th - 10);
        }
        // If right header panel, guarantee tooltip right is to the left of panel
        if (rect.right > vw * 0.70 && rect.left > tw + 20) {
          posX = Math.max(pad, rect.left - tw - 12);
        }
      }

      tooltip.style.left = `${Math.round(posX)}px`;
      tooltip.style.top = `${Math.round(posY)}px`;
    };

    const showTooltip = (e, title, cls, body, note, targetEl = null) => {
      document.getElementById('tt-title').innerText = title;
      document.getElementById('tt-class').innerText = cls;
      document.getElementById('tt-body').innerText = body;
      document.getElementById('tt-note').innerText = note || 'TACTICAL INTEL // STARFLEET ARCHIVES';
      
      tooltip.classList.add('visible');
      updateTooltipPosition(e, targetEl);
    };

    const hideTooltip = () => {
      tooltip.classList.remove('visible');
    };

    // 1. Sector Hover Tooltip (HUD badge, container, and Sandbox button)
    const setupSectorTooltip = (el) => {
      if (!el) return;
      el.addEventListener('mouseenter', (e) => {
        const sec = this.sectors[this.currentSectorIndex] || this.sectors[0];
        const lore = (this.sectorLore && this.sectorLore[sec.id]) ? this.sectorLore[sec.id] : null;
        if (lore) {
          showTooltip(
            e,
            `STELLAR SECTOR: ${sec.name}`,
            lore.class,
            lore.desc,
            `TACTICAL TELEMETRY: ${lore.note}`,
            el
          );
        }
      });
      el.addEventListener('mousemove', (e) => updateTooltipPosition(e, el));
      el.addEventListener('mouseleave', hideTooltip);
    };

    setupSectorTooltip(document.getElementById('hud-sector'));
    setupSectorTooltip(document.getElementById('hud-sector-container'));
    setupSectorTooltip(document.getElementById('btn-sandbox-sector'));

    const setupCustomTooltip = (el, title, cls, body, note) => {
      if (!el) return;
      el.addEventListener('mouseenter', (e) => showTooltip(e, title, cls, body, note, el));
      el.addEventListener('mousemove', (e) => updateTooltipPosition(e, el));
      el.addEventListener('mouseleave', hideTooltip);
    };

    setupCustomTooltip(
      document.getElementById('hud-holodeck-pill'),
      'HOLODECK SIMULATION',
      'ACTIVE GRID // HOLOSUITE PROTOCOL',
      'Holodeck matrix is currently engaged in active tactical calculus calibration. Safety protocols are operating within Starfleet parameters.',
      'STATUS: GRID OCCUPIED // IN USE'
    );

    // 2. Tactical Abilities Hover Tooltips
    const jamBtn = document.getElementById('btn-jam');
    if (jamBtn) {
      jamBtn.addEventListener('mouseenter', (e) => {
        showTooltip(e, 'TEMPORAL SENSOR JAM [J]', 'LCARS TACTICAL DILATION', 'Dilates local spacetime, reducing all target velocities and rotations by 70% for 5.0 seconds. Recharges once per wave.', 'STATUS: 1 Charge Per Wave');
      });
      jamBtn.addEventListener('mouseleave', hideTooltip);
    }

    const phaserBtn = document.getElementById('btn-phaser-strike');
    if (phaserBtn) {
      phaserBtn.addEventListener('mouseenter', (e) => {
        showTooltip(e, 'PHASER DISRUPTOR [P / Space]', 'TACTICAL VAPORIZER', 'Fires a high-energy phaser discharge that instantly vaporizes 1 random wrong answer choice from the room.', 'STATUS: Recharges +1 every 2 rounds');
      });
      phaserBtn.addEventListener('mouseleave', hideTooltip);
    }

    // 3. Authentic Voyager Tactical Shields Lore & Telemetry Hover Tooltips
    // Note: btn-shield-minimize is a click-action button — no tooltip (avoids stuck tooltip on mobile touch)

    setupCustomTooltip(
      document.getElementById('shield-arch-header'),
      'TACTICAL DEFLECTOR SHIELDS',
      'CLASS-7 MULTIPHASIC DEFLECTOR ARRAY',
      'Multiphasic shield containment enveloping the holodeck matrix. Absorbs kinetic projectile impacts and disperses energy into auxiliary heat sinks with zero hull bleedthrough.',
      'CONTAINMENT PROTOCOL: ACTIVE (99.8% EFFICIENCY)'
    );

    setupCustomTooltip(
      document.getElementById('shield-arch-code'),
      'LCARS DIRECTIVE 927',
      'AUTOMATED DEFLECTOR SUBROUTINE',
      'Subroutine 927 monitors spatial harmonic flux and dynamically re-routes primary EPS power to forward containment emitters.',
      'ACCESS LEVEL: TACTICAL COMMAND // USS VOYAGER'
    );

    setupCustomTooltip(
      document.getElementById('combat-cap-927'),
      'LCARS DIRECTIVE 927',
      'AUTOMATED DEFLECTOR SUBROUTINE',
      'Subroutine 927 monitors spatial harmonic flux and dynamically re-routes primary EPS power to forward containment emitters.',
      'ACCESS LEVEL: TACTICAL COMMAND // USS VOYAGER'
    );

    setupCustomTooltip(
      document.getElementById('shield-freq-tag'),
      'SUBSPACE SHIELD FREQUENCY',
      'CARRIER: 434.8 MHz // COHERENT POLARITY',
      'Shield harmonic carrier oscillating at 434.8 MHz. Frequency auto-rotates across 12 subspace harmonic bands to prevent phase collapse during rapid ricochets.',
      'DEFLECTOR HARMONICS // ROTATIONAL CYCLES: 24/s'
    );

    setupCustomTooltip(
      document.getElementById('shield-flux-tag'),
      'SUB-GRID FLUX DISPERSION',
      'FLUX DENSITY: 1.21 GW/m²',
      'Real-time thermal and graviton flux rate across the 8-node containment grid. Dissipates kinetic shockwaves evenly to protect holodeck safety emitters.',
      'THERMAL EQUILIBRIUM: NOMINAL (99.98%)'
    );

    setupCustomTooltip(
      document.getElementById('shield-matrix-tag'),
      'SHIELD MATRIX STATUS',
      'PRIMARY CAPACITOR EFFICIENCY: 100%',
      'Displays real-time tactical shield integrity. Sustains 3 high-energy ricochet impacts before emergency containment protocols trigger.',
      'CONTAINMENT: OPTIMAL // AUTO-RECHARGE READY'
    );

    setupCustomTooltip(
      document.getElementById('btn-sandbox-pause-vel'),
      'TARGET VELOCITY STASIS',
      'TRANSLATION VELOCITY FREEZE',
      'Freezes linear translational motion and boundary ricochets while maintaining continuous 3D rotation for close-up visual and lighting inspection.',
      'CLICK TO TOGGLE VELOCITY STASIS [PAUSE VELOCITY]'
    );

    setupCustomTooltip(
      document.getElementById('slider-sandbox-speed'),
      'TARGET VELOCITY SCALING',
      'PIECEWISE SPEED REGIME',
      'Fine-tuned precision velocity scaling: Left half scales from 0.00x to 1.00x with 0.05 increments; right half extends from 1.0x to 10.0x hyper-speed.',
      'LEFT: 0.00x - 1.00x (0.05 step) // RIGHT: 1.0x - 10.0x'
    );

    setupCustomTooltip(
      document.getElementById('slider-sandbox-text-highlight'),
      'NUMERAL TEXT HIGHLIGHT',
      'HOLOGRAPHIC ANSWER GLOW',
      'Adjusts the multi-tier holographic text highlight intensity and neon corona bloom rendered across target face answer numerals.',
      'RANGE: 0.0x - 3.0x // REAL-TIME TEXTURE RE-PROJECTION'
    );

    setupCustomTooltip(
      document.getElementById('v-shield-oval'),
      '3D DEFLECTOR ENVELOPE',
      'SPATIAL PROJECTION SCHEMATIC',
      'Visual cross-section of the ellipsoidal graviton barrier surrounding the training holodeck. Resonates dynamically upon projectile wall ricochets.',
      'DEFLECTOR ARRAY: 100% RECHARGE READY'
    );
  }

  startMission(mode, rank) {
    this.audio.init();
    this.mode = mode;
    this.rank = rank;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.level = 1;
    this.warpFactor = 1.0;
    this.shieldsLeft = 3;
    this.totalAttempts = 0;
    this.missedProblems = [];
    this.correctHits = 0;
    this.elapsedSeconds = 0;
    this.isPlaying = true;
    this.isPaused = false;
    this.isTransitioning = false;
    this.isVisualizerOpen = true;

    const modeNames = {
      velocity: '3D RICOCHET',
      incursion: 'QUANTUM INCURSION',
      blitz: 'WARP BLITZ',
      academy: 'CADET ACADEMY',
      ricochet_test: '🎯 RICOCHET TEST'
    };
    document.getElementById('hud-mode-tag').innerText = modeNames[mode] || mode.toUpperCase();
    document.getElementById('hud-rank').innerText = rank.toUpperCase();

    document.getElementById('start-modal').classList.add('hidden');
    document.getElementById('gameover-modal').classList.add('hidden');
    document.getElementById('pause-modal').classList.add('hidden');
    document.getElementById('level-transition-card').classList.add('hidden');

    if (mode === 'ricochet_test') {
      // Ambient hum is automatically turned OFF in test mode
      this.audio.ambientEnabled = false;
      this.audio.stopWarpCoreHum();
      this.syncAudioUI();
    } else {
      this.audio.setAmbientMode('normal');
      this.syncAudioUI();
    }

    const sandboxPanel = document.getElementById('test-sandbox-panel');
    if (sandboxPanel) {
      if (mode === 'ricochet_test') {
        sandboxPanel.classList.remove('hidden');
        const sec = this.sectors[this.currentSectorIndex] || this.sectors[0];
        const sectorBtnVal = document.getElementById('val-sandbox-sector');
        if (sectorBtnVal) {
          sectorBtnVal.innerText = sec.name;
          sectorBtnVal.style.color = sec.color;
        }
      } else {
        sandboxPanel.classList.add('hidden');
      }
    }

    if (mode === 'ricochet_test') {
      this.showBanner(`🎯 RICOCHET TEST MATRIX // ${this.testTargetCount} TARGETS ACTIVE`);
    }
    this.audio.playVoice('engage_simulation', `Holodeck simulation engaged. Starfleet rank ${rank} active.`);
    this.nextProblem();
    this.updateHUD();

    if (this.clockInterval) clearInterval(this.clockInterval);
    this.clockInterval = setInterval(() => {
      if (!this.isPlaying || this.isPaused || this.isTransitioning) return;
      this.elapsedSeconds++;
      this.updateHUD();
    }, 1000);
  }


  loadFlightRecorder() {
    try {
      const data = localStorage.getItem('holodeck_flight_recorder');
      return data ? JSON.parse(data) : {
        totalMissions: 0,
        totalVaporized: 0,
        bestStreak: 0,
        totalAttempts: 0,
        totalCorrect: 0
      };
    } catch(e) {
      return { totalMissions: 0, totalVaporized: 0, bestStreak: 0, totalAttempts: 0, totalCorrect: 0 };
    }
  }

  saveFlightRecorder(data) {
    try {
      localStorage.setItem('holodeck_flight_recorder', JSON.stringify(data));
    } catch(e) {}
  }

  calculateStarfleetGrade(accuracy, avgReactionTime, shieldsRemaining) {
    // Efficiency: Accuracy (50%) + Shield Retention (30%) + Reaction Speed (20%)
    const shieldFactor = Math.min(1.0, Math.max(0, shieldsRemaining / 3));
    const speedFactor = Math.min(1.0, Math.max(0, (12.0 - avgReactionTime) / 10.0));
    
    const efficiency = Math.round((accuracy * 0.50) + (shieldFactor * 100 * 0.30) + (speedFactor * 100 * 0.20));

    if (efficiency >= 92 && accuracy >= 90) {
      return {
        grade: 'S',
        efficiency: efficiency,
        title: 'FLEET ADMIRAL COMMENDATION',
        desc: 'Tactical vectoring and quantum calculation efficiency are operating at peak Starfleet standards.'
      };
    } else if (efficiency >= 78 && accuracy >= 75) {
      return {
        grade: 'A',
        efficiency: efficiency,
        title: 'SENIOR TACTICAL SPECIALIST',
        desc: 'Exceptional mathematical targeting speed and resilient shield containment.'
      };
    } else if (efficiency >= 60) {
      return {
        grade: 'B',
        efficiency: efficiency,
        title: 'ACTIVE FLIGHT OFFICER',
        desc: 'Nominal holodeck operational proficiency. Deflector harmonics remained stable.'
      };
      return {
        grade: 'C',
        efficiency: efficiency,
        title: 'CADET RECALIBRATION REQUIRED',
        desc: 'Tactical solution accuracy degraded. Review holographic formulas below.'
      };
    }
  }


  // =========================================================================
  // ASTROMETRIC SECTOR GALAXY STAR CHART GENERATOR
  // =========================================================================
  renderSectorStarChart(customStepIndex = null) {
    this.initPatrolRoute();
    const totalSectors = this.sectors.length;
    const activeStep = (customStepIndex !== null) 
      ? Math.max(0, Math.min(totalSectors - 1, customStepIndex)) 
      : (this.patrolProgress || 0);

    const targets = [
      {
        svg: document.getElementById('sc-svg-map'),
        starsLayer: document.getElementById('sc-stars-layer'),
        pathsLayer: document.getElementById('sc-paths-layer'),
        nodesLayer: document.getElementById('sc-nodes-layer'),
        statusPill: document.getElementById('sc-flight-status'),
        intelName: document.getElementById('sc-intel-name'),
        intelBadge: document.getElementById('sc-intel-badge'),
        intelDesc: document.getElementById('sc-intel-desc'),
        glowGold: 'glow-gold',
        glowCyan: 'glow-cyan'
      },
      {
        svg: document.getElementById('sc-modal-svg-map'),
        starsLayer: document.getElementById('sc-modal-stars-layer'),
        pathsLayer: document.getElementById('sc-modal-paths-layer'),
        nodesLayer: document.getElementById('sc-modal-nodes-layer'),
        statusPill: document.getElementById('sc-modal-flight-status'),
        intelName: document.getElementById('sc-modal-intel-name'),
        intelBadge: document.getElementById('sc-modal-intel-badge'),
        intelDesc: document.getElementById('sc-modal-intel-desc'),
        glowGold: 'glow-gold-m',
        glowCyan: 'glow-cyan-m'
      }
    ];

    targets.forEach(tgt => {
      const { svg, starsLayer, pathsLayer, nodesLayer, statusPill, intelName, intelBadge, intelDesc, glowGold, glowCyan } = tgt;
      if (!svg || !pathsLayer || !nodesLayer) return;

      if (starsLayer) starsLayer.innerHTML = '';
      pathsLayer.innerHTML = '';
      nodesLayer.innerHTML = '';

      if (statusPill) {
        statusPill.innerText = `SECTOR ${activeStep + 1} OF ${totalSectors} // ${Math.round(((activeStep + 1) / totalSectors) * 100)}% PATROL COMPLETE`;
      }

      // 1. Generate Ambient Starfield Dots
      if (starsLayer) {
        for (let s = 0; s < 45; s++) {
          const sx = Math.floor(Math.random() * 520) + 10;
          const sy = Math.floor(Math.random() * 160) + 10;
          const sr = (Math.random() * 1.2 + 0.5).toFixed(1);
          const sop = (Math.random() * 0.5 + 0.3).toFixed(2);
          const starCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          starCircle.setAttribute('cx', sx);
          starCircle.setAttribute('cy', sy);
          starCircle.setAttribute('r', sr);
          starCircle.setAttribute('fill', '#ffffff');
          starCircle.setAttribute('opacity', sop);
          starsLayer.appendChild(starCircle);
        }
      }

      // 2. Fixed Sector Waypoint Coordinates across 540x180 Galaxy ViewBox
      const nodeCoords = [
        { x: 34,  y: 90,  labelY: 116 }, // Node 0: Wave 1 Starting Sector
        { x: 86,  y: 45,  labelY: 28  }, // Node 1
        { x: 140, y: 135, labelY: 162 }, // Node 2
        { x: 195, y: 55,  labelY: 38  }, // Node 3
        { x: 250, y: 130, labelY: 158 }, // Node 4
        { x: 305, y: 50,  labelY: 34  }, // Node 5
        { x: 360, y: 135, labelY: 162 }, // Node 6
        { x: 415, y: 60,  labelY: 42  }, // Node 7
        { x: 468, y: 125, labelY: 154 }, // Node 8
        { x: 512, y: 85,  labelY: 112 }  // Node 9: Final Sector
      ];

      // 3. Render Connecting Flight Path Segments
      for (let i = 0; i < totalSectors - 1; i++) {
        const p1 = nodeCoords[i];
        const p2 = nodeCoords[i + 1];
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', p1.x);
        line.setAttribute('y1', p1.y);
        line.setAttribute('x2', p2.x);
        line.setAttribute('y2', p2.y);

        if (i < activeStep) {
          line.setAttribute('class', 'sc-path-cleared');
        } else if (i === activeStep) {
          line.setAttribute('class', 'sc-path-active');
        } else {
          line.setAttribute('class', 'sc-path-future');
        }
        pathsLayer.appendChild(line);
      }

      // 4. Render Sector Nodes with Fog-of-War (Only current & next star system revealed)
      for (let step = 0; step < totalSectors; step++) {
        const secIdx = this.patrolRoute[step];
        const sec = this.sectors[secIdx] || this.sectors[0];
        const pt = nodeCoords[step] || { x: 50, y: 50, labelY: 70 };

        const isCleared = step < activeStep;
        const isCurrent = step === activeStep;
        const isNext = step === activeStep + 1;
        const isShrouded = step > activeStep + 1;

        const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        nodeGroup.setAttribute('class', `sc-node ${isCurrent ? 'active' : (isCleared ? 'cleared' : (isNext ? 'next' : 'shrouded'))}`);

        if (isCurrent) {
          const radar = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          radar.setAttribute('cx', pt.x);
          radar.setAttribute('cy', pt.y);
          radar.setAttribute('class', 'sc-radar-ring');
          nodeGroup.appendChild(radar);
        }

        const outerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        outerCircle.setAttribute('cx', pt.x);
        outerCircle.setAttribute('cy', pt.y);
        outerCircle.setAttribute('r', isCurrent ? '8' : (isCleared ? '6.5' : (isNext ? '6' : '4.5')));
        outerCircle.setAttribute('fill', isCurrent ? '#040d1e' : (isCleared ? '#061a28' : (isNext ? '#161400' : '#03060c')));
        outerCircle.setAttribute('stroke', isCurrent ? '#ffea00' : (isCleared ? '#00f0ff' : (isNext ? '#ffaa00' : 'rgba(100, 130, 160, 0.3)')));
        outerCircle.setAttribute('stroke-width', isCurrent ? '2.5' : (isCleared ? '1.8' : (isNext ? '1.6' : '1.0')));
        if (isCurrent) outerCircle.setAttribute('filter', `url(#${glowGold})`);
        if (isCleared) outerCircle.setAttribute('filter', `url(#${glowCyan})`);
        nodeGroup.appendChild(outerCircle);

        const innerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        innerCircle.setAttribute('cx', pt.x);
        innerCircle.setAttribute('cy', pt.y);
        innerCircle.setAttribute('r', isCurrent ? '4' : (isShrouded ? '1.8' : '2.5'));
        innerCircle.setAttribute('fill', isCurrent ? '#ffea00' : (isCleared ? (sec.color || '#00f0ff') : (isNext ? '#ffaa00' : '#283648')));
        nodeGroup.appendChild(innerCircle);

        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', pt.x);
        label.setAttribute('y', pt.labelY);
        label.setAttribute('text-anchor', 'middle');

        if (isShrouded) {
          label.textContent = '???';
          label.setAttribute('fill', 'rgba(120, 150, 180, 0.45)');
        } else {
          const shortName = sec.name.split(' ')[0];
          label.textContent = shortName;
          if (isCurrent) label.setAttribute('fill', '#ffea00');
          else if (isCleared) label.setAttribute('fill', '#00f0ff');
          else if (isNext) label.setAttribute('fill', '#ffaa00');
        }
        nodeGroup.appendChild(label);

        const selectSectorIntel = () => {
          if (!intelName || !intelBadge || !intelDesc) return;
          const lore = (this.sectorLore && this.sectorLore[sec.id]) ? this.sectorLore[sec.id] : null;

          if (isShrouded) {
            intelName.innerText = `SECTOR ${step + 1} // UNCHARTED ANOMALY`;
            intelBadge.innerText = 'COORDINATES ENCRYPTED';
            intelBadge.className = 'sc-intel-badge future';
            intelDesc.innerText = 'Long-range deflector sensors cannot resolve stellar harmonics at this distance. Complete current tactical calculations to decrypt warp trajectory.';
          } else {
            intelName.innerText = `${sec.name} // ${sec.type}`;
            if (isCurrent) {
              intelBadge.innerText = 'CURRENT STATION';
              intelBadge.className = 'sc-intel-badge';
            } else if (isCleared) {
              intelBadge.innerText = 'PATROL COMPLETED ✓';
              intelBadge.className = 'sc-intel-badge cleared';
            } else if (isNext) {
              intelBadge.innerText = 'NEXT DESTINATION ⚡';
              intelBadge.className = 'sc-intel-badge';
              intelBadge.style.borderColor = '#ffaa00';
              intelBadge.style.color = '#ffaa00';
            }
            intelDesc.innerText = lore ? lore.desc : `Stellar sector ${sec.name}. Navigational deflector online.`;
          }
        };

        nodeGroup.addEventListener('click', selectSectorIntel);
        nodeGroup.addEventListener('mouseenter', selectSectorIntel);

        nodesLayer.appendChild(nodeGroup);
      }

      // Populate initial active sector telemetry drawer
      const initialSecIdx = this.patrolRoute[activeStep];
      const initialSec = this.sectors[initialSecIdx] || this.sectors[0];
      const initialLore = (this.sectorLore && this.sectorLore[initialSec.id]) ? this.sectorLore[initialSec.id] : null;
      if (intelName) intelName.innerText = `${initialSec.name} // ${initialSec.type}`;
      if (intelBadge) {
        intelBadge.innerText = 'CURRENT STATION';
        intelBadge.className = 'sc-intel-badge';
        intelBadge.style.borderColor = '#ffea00';
        intelBadge.style.color = '#ffea00';
      }
      if (intelDesc) intelDesc.innerText = initialLore ? initialLore.desc : `Stellar sector ${initialSec.name}. Navigational deflector online.`;
    });
  }

  renderDiagnosticErrorReview() {
    const listEl = document.getElementById('dr-list-container');
    const countEl = document.getElementById('dr-error-count');
    if (!listEl || !countEl) return;

    listEl.innerHTML = '';
    const errors = this.missedProblems || [];

    if (errors.length === 0) {
      countEl.innerText = '0 ERRORS (PERFECT)';
      countEl.className = 'dr-count zero';
      listEl.innerHTML = `
        <div class="dr-perfect-msg">
          ★ 100% PERFECT TACTICAL PRECISION — ZERO CALCULUS DRIFT ★<br>
          <span style="font-size: 0.72rem; color: #a0e8b0; font-family: 'Rajdhani', sans-serif;">All target matrices vaporized with zero computational errors.</span>
        </div>
      `;
      return;
    }

    countEl.innerText = `${errors.length} ERROR${errors.length > 1 ? 'S' : ''}`;
    countEl.className = 'dr-count';

    errors.forEach((err, idx) => {
      const card = document.createElement('div');
      card.className = 'dr-card';
      card.innerHTML = `
        <div class="dr-card-top">
          <span class="dr-wave-badge">WAVE ${err.wave} // ANOMALY #${idx + 1}</span>
          <span class="dr-answers-compare">
            <span class="dr-wrong">[INPUT: ${err.selected}]</span>
            <span class="dr-right">[TARGET: ${err.correct}]</span>
          </span>
        </div>
        <div class="dr-question">${err.question}</div>
        <div class="dr-hint-box">${err.hint || err.formulaStr || 'Analyze formula.'}</div>
      `;
      listEl.appendChild(card);
    });
  }

  gameOver(reason = 'SIMULATION COMPLETE') {
    this.isPlaying = false;
    this.isPaused = false;
    this.audio.setAmbientMode('dimmed');
    document.body.classList.remove('is-paused');
    if (this.clockInterval) clearInterval(this.clockInterval);
    if (this.hazardTimer) clearTimeout(this.hazardTimer);
    document.getElementById('red-alert-flash').classList.remove('active');
    document.getElementById('level-transition-card').classList.add('hidden');
    document.getElementById('lcars-visualizer-panel').classList.add('hidden');
    if (this.mode !== 'ricochet_test' && !this.isSimulatingDebrief) {
      const sb = document.getElementById('test-sandbox-panel');
      if (sb) sb.classList.add('hidden');
    }
    if (DEBUG_LOGS) console.log('[LCARS Pause Telemetry] GameOver -> isPaused: false | Bokeh Disabled: true');
    const accuracy = this.totalAttempts > 0 ? Math.round((this.correctHits / this.totalAttempts) * 100) : 100;
    const wavesCompleted = Math.max(0, this.level - 1);
    const avgReactionTime = wavesCompleted > 0 ? (this.elapsedSeconds / wavesCompleted) : 0;
    
    // 1. Calculate Starfleet Grade (S / A / B / C) & Efficiency
    const gradeObj = this.calculateStarfleetGrade(accuracy, avgReactionTime, this.shields);
    
    const badgeEl = document.getElementById('go-grade-badge');
    if (badgeEl) {
      badgeEl.innerText = gradeObj.grade;
      badgeEl.className = `grade-badge-circle grade-${gradeObj.grade}`;
    }
    const gradeTitleEl = document.getElementById('go-grade-title');
    if (gradeTitleEl) gradeTitleEl.innerText = gradeObj.title;
    const gradeDescEl = document.getElementById('go-grade-desc');
    if (gradeDescEl) gradeDescEl.innerText = gradeObj.desc;
    const gradeEffEl = document.getElementById('go-grade-eff');
    if (gradeEffEl) gradeEffEl.innerText = `${gradeObj.efficiency}%`;
    const gradeTimeEl = document.getElementById('go-grade-time');
    if (gradeTimeEl) gradeTimeEl.innerText = `${avgReactionTime.toFixed(1)}s`;
    const gradeShieldsEl = document.getElementById('go-grade-shields');
    if (gradeShieldsEl) gradeShieldsEl.innerText = `${Math.round((this.shields / 3) * 100)}%`;

    // 2. Populate Standard Metrics
    document.getElementById('go-title').innerText = reason;
    document.getElementById('go-score').innerText = this.score;
    document.getElementById('go-level').innerText = wavesCompleted;
    document.getElementById('go-accuracy').innerText = `${accuracy}%`;
    this.updateHighScoreDisplay();

    // 3. Update & Render Career Flight Recorder
    const flightData = this.loadFlightRecorder();
    flightData.totalMissions = (flightData.totalMissions || 0) + 1;
    flightData.totalVaporized = (flightData.totalVaporized || 0) + wavesCompleted;
    flightData.bestStreak = Math.max(flightData.bestStreak || 0, this.streak);
    flightData.totalAttempts = (flightData.totalAttempts || 0) + this.totalAttempts;
    flightData.totalCorrect = (flightData.totalCorrect || 0) + this.correctHits;
    this.saveFlightRecorder(flightData);

    const crMissions = document.getElementById('cr-missions');
    if (crMissions) crMissions.innerText = flightData.totalMissions;
    const crVaporized = document.getElementById('cr-vaporized');
    if (crVaporized) crVaporized.innerText = flightData.totalVaporized;
    const crStreak = document.getElementById('cr-streak');
    if (crStreak) crStreak.innerText = flightData.bestStreak;
    const crAccuracy = document.getElementById('cr-accuracy');
    if (crAccuracy) {
      const cAcc = flightData.totalAttempts > 0 ? Math.round((flightData.totalCorrect / flightData.totalAttempts) * 100) : 100;
      crAccuracy.innerText = `${cAcc}%`;
    }

    // 4. Render Step-by-Step Diagnostic Error Review
    this.renderDiagnosticErrorReview();

    // 5. Render Astrometric Sector Galaxy Star Chart & Warp Flight Log
    this.renderSectorStarChart();

    document.getElementById('gameover-modal').classList.remove('hidden');
    this.audio.playVoice('simulation_complete', 'Simulation complete. Starfleet debriefing ready.');
  }

  togglePause(forceState = null) {
    if (!this.isPlaying || this.isTransitioning) return;
    this.isPaused = (forceState !== null) ? forceState : !this.isPaused;
    const modal = document.getElementById('pause-modal');
    const crosshair = document.getElementById('crosshair');
    const tooltip = document.getElementById('lcars-tooltip');
    
    this.audio.setPaused(this.isPaused);

    if (this.isPaused) {
      document.body.classList.add('is-paused');
      if (crosshair) crosshair.classList.add('hidden');
      if (modal) modal.classList.remove('hidden');
      this.syncAudioUI();
      this.showBanner('⏸️ SIMULATION PAUSED // HOVER INSPECTION ACTIVE');
      
      // Populate active sector lore in pause screen
      const sec = this.sectors[this.currentSectorIndex] || this.sectors[0];
      const lore = (this.sectorLore && this.sectorLore[sec.id]) ? this.sectorLore[sec.id] : null;
      if (lore) {
        const titleEl = document.getElementById('pause-sec-title');
        const classEl = document.getElementById('pause-sec-class');
        const descEl = document.getElementById('pause-sec-desc');
        const noteEl = document.getElementById('pause-sec-note');
        if (titleEl) titleEl.innerText = `STELLAR SECTOR: ${sec.name}`;
        if (classEl) classEl.innerText = lore.class;
        if (descEl) descEl.innerText = lore.desc;
        if (noteEl) noteEl.innerText = `TACTICAL TELEMETRY: ${lore.note}`;
      }
    } else {
      document.body.classList.remove('is-paused');
      if (crosshair) crosshair.classList.remove('hidden');
      if (tooltip) tooltip.classList.remove('visible');
      if (modal) modal.classList.add('hidden');
      if (document.body && document.body.style) document.body.style.cursor = 'default';
      this.syncAudioUI();
      this.showBanner('▶️ SIMULATION RESUMED');
    }
    if (DEBUG_LOGS) console.log(`[LCARS Pause Telemetry] isPaused: ${this.isPaused} | Bokeh Active: ${document.body.classList.contains('is-paused')}`);
  }

  initDraggablePanels() {
    const makeDraggable = (panelId, handleSelector) => {
      const panel = document.getElementById(panelId);
      if (!panel) return;
      const handle = (handleSelector && typeof panel.querySelector === 'function') ? panel.querySelector(handleSelector) : panel;
      if (!handle) return;

      if (handle.classList && handle.classList.add) handle.classList.add('is-draggable-handle');
      // Drag handle tooltip omitted to prevent browser tooltip collision
      if (typeof handle.addEventListener !== 'function') return;

      let startX = 0, startY = 0;
      let origLeft = 0, origTop = 0;
      let isDragging = false;

      const setStyle = (el, prop, val) => {
        if (!el || !el.style) return;
        if (typeof el.style.setProperty === 'function') {
          el.style.setProperty(prop, val, 'important');
        } else {
          el.style[prop] = val;
        }
      };

      const onStart = (e) => {
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.closest('button') || e.target.closest('.vis-close-btn') || e.target.id === 'btn-sandbox-pause-vel') {
          return;
        }

        const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
        const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

        const rect = panel.getBoundingClientRect();
        origLeft = rect.left;
        origTop = rect.top;
        startX = clientX;
        startY = clientY;
        isDragging = true;

        // Lock visualizer width once so it doesn't expand, but do not set scaled widths on other panels
        if (panelId === 'lcars-visualizer-panel' && !panel.style.width) {
          setStyle(panel, 'width', `${panel.offsetWidth || 275}px`);
        }
        setStyle(panel, 'position', 'fixed');
        setStyle(panel, 'left', `${origLeft}px`);
        setStyle(panel, 'top', `${origTop}px`);
        setStyle(panel, 'right', 'auto');
        setStyle(panel, 'bottom', 'auto');
        setStyle(panel, 'z-index', '999');
        if (panel.classList && panel.classList.add) panel.classList.add('is-dragging');

        const onMove = (moveEvt) => {
          if (!isDragging) return;
          if (moveEvt.cancelable) moveEvt.preventDefault();
          const curX = moveEvt.clientX !== undefined ? moveEvt.clientX : (moveEvt.touches && moveEvt.touches[0] ? moveEvt.touches[0].clientX : 0);
          const curY = moveEvt.clientY !== undefined ? moveEvt.clientY : (moveEvt.touches && moveEvt.touches[0] ? moveEvt.touches[0].clientY : 0);

          const dx = curX - startX;
          const dy = curY - startY;

          let newLeft = origLeft + dx;
          let newTop = origTop + dy;

          const panelW = panel.offsetWidth || 200;
          const panelH = panel.offsetHeight || 150;

          newLeft = Math.max(2, Math.min(window.innerWidth - panelW - 2, newLeft));
          newTop = Math.max(2, Math.min(window.innerHeight - panelH - 2, newTop));

          setStyle(panel, 'left', `${newLeft}px`);
          setStyle(panel, 'top', `${newTop}px`);
          setStyle(panel, 'right', 'auto');
        };

        const onEnd = () => {
          if (!isDragging) return;
          isDragging = false;
          panel.classList.remove('is-dragging');
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onEnd);
          window.removeEventListener('touchmove', onMove);
          window.removeEventListener('touchend', onEnd);
        };

        window.addEventListener('mousemove', onMove, { passive: false });
        window.addEventListener('mouseup', onEnd);
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('touchend', onEnd);
      };

      handle.addEventListener('mousedown', onStart);
      handle.addEventListener('touchstart', onStart, { passive: false });
    };

    makeDraggable('test-sandbox-panel', '.sandbox-header');
    makeDraggable('voyager-shield-panel', '.voyager-arch-top');
    makeDraggable('lcars-visualizer-panel', '.vis-header, .vis-arch-header');
  }

  bindEvents() {
    this.initDraggablePanels();
    const crosshair = document.getElementById('crosshair');
    const tooltip = document.getElementById('lcars-tooltip');
    let hoveredTarget = null;

    window.addEventListener('pointermove', (e) => {
      crosshair.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%)`;

      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

      // When paused, enable 3D Tactical Target Hover Stasis Inspection!
      if (this.isPaused && this.isPlaying && this.camera && this.raycaster && this.targetPanels.length > 0) {
        if (!e.target.closest('button, input, select, .modal-panel, .clcars-ammo-pill, #lcars-right-dock, .hud-panel')) {
          this.raycaster.setFromCamera(this.mouse, this.camera);
          const panelMeshes = this.targetPanels.map(p => p.mesh).filter(Boolean);
          const intersects = this.raycaster.intersectObjects(panelMeshes);

          if (intersects.length > 0) {
            const hitMesh = intersects[0].object;
            const target = this.targetPanels.find(p => p.mesh === hitMesh);
            if (target) {
              if (hoveredTarget && hoveredTarget !== target && hoveredTarget.mesh && hoveredTarget.mesh.material) {
                if (hoveredTarget.mesh.material.emissiveIntensity !== undefined) {
                  hoveredTarget.mesh.material.emissiveIntensity = 0.55;
                }
              }
              hoveredTarget = target;
              if (target.mesh && target.mesh.material && target.mesh.material.emissiveIntensity !== undefined) {
                target.mesh.material.emissiveIntensity = 0.95;
              }

              if (tooltip) {
                const titleEl = (this.dom && this.dom.ttTitle) || document.getElementById('tt-title');
                const classEl = (this.dom && this.dom.ttClass) || document.getElementById('tt-class');
                const bodyEl = (this.dom && this.dom.ttBody) || document.getElementById('tt-body');
                const noteEl = (this.dom && this.dom.ttNote) || document.getElementById('tt-note');
                if (titleEl) titleEl.innerText = `🎯 TARGET #${target.index || 1} // VALUE: "${target.value}"`;
                if (classEl) classEl.innerText = `STATUS: FROZEN IN TACTICAL STASIS`;
                if (bodyEl) bodyEl.innerText = `Sector Pos: [X: ${target.mesh.position.x.toFixed(1)}, Y: ${target.mesh.position.y.toFixed(1)}, Z: ${target.mesh.position.z.toFixed(1)}] | Velocity: [${Math.hypot(target.vx, target.vy, target.vz).toFixed(2)}u/s] | Spin: [${(target.rotY * 180 / Math.PI).toFixed(1)}°/f]`;
                if (noteEl) noteEl.innerText = `HARMONIC: ${target.harmonicName || 'Fundamental Root (1.0x)'} // PRESS [P / ESC] TO RESUME`;
                tooltip.style.left = `${Math.min(window.innerWidth - 340, Math.max(20, e.clientX + 15))}px`;
                tooltip.style.top = `${Math.max(20, e.clientY - 30)}px`;
                tooltip.classList.add('visible');
              }
              if (document.body && document.body.style) document.body.style.cursor = 'pointer';
              return;
            }
          }
        }
      }

      if (hoveredTarget) {
        if (hoveredTarget.mesh && hoveredTarget.mesh.material && hoveredTarget.mesh.material.emissiveIntensity !== undefined) {
          hoveredTarget.mesh.material.emissiveIntensity = 0.55;
        }
        hoveredTarget = null;
        if (tooltip && !e.target.closest('#hud-sector, #hud-sector-container, #btn-sandbox-sector, #btn-jam, #btn-phaser-strike')) {
          tooltip.classList.remove('visible');
        }
        if (this.isPaused && document.body && document.body.style) document.body.style.cursor = 'default';
      }
    });

    window.addEventListener('pointerdown', (e) => {
      if (!this.isPlaying || this.isPaused || this.isTransitioning) return;

      if (e.target.closest('button, input, .clcars-ammo-pill, .modal-panel, #lcars-right-dock')) {
        return;
      }

      this.audio.init();

      this.raycaster.setFromCamera(this.mouse, this.camera);
      const panelMeshes = this.targetPanels.map(p => p.mesh);
      const intersects = this.raycaster.intersectObjects(panelMeshes);

      if (intersects.length > 0) {
        const hitMesh = intersects[0].object;
        const target = this.targetPanels.find(p => p.mesh === hitMesh);
        if (target) {
          this.submitAnswer(target.value, true);
          return;
        }
      }

      const aimPoint = new THREE.Vector3();
      this.raycaster.ray.at(50, aimPoint);
      this.fireProjectile(aimPoint);
      this.audio.playRicochet(this.isPaused);
    });

    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();

      // [ESC] or [P] Pause / Resume Hotkey
      if (e.key === 'Escape' || k === 'p') {
        const confirmAbortModal = document.getElementById('confirm-abort-modal');
        if (confirmAbortModal && !confirmAbortModal.classList.contains('hidden')) {
          confirmAbortModal.classList.add('hidden');
          return;
        }
        const sectorMapModal = document.getElementById('sector-map-modal');
        if (sectorMapModal && !sectorMapModal.classList.contains('hidden')) {
          sectorMapModal.classList.add('hidden');
          return;
        }
        this.togglePause();
        return;
      }

      // [F] FPS / Render Stats Hotkey
      if (k === 'f') {
        this.toggleStats();
        return;
      }

      // [M] Master Mute Toggle Hotkey
      if (k === 'm') {
        this.toggleMasterMute();
        return;
      }

      // [A] Ambient Hum Toggle Hotkey
      if (k === 'a') {
        this.toggleAmbient();
        return;
      }

      // [V] or [C] Visualizer Toggle Hotkey
      if (k === 'v' || k === 'c') {
        this.toggleVisualizer();
        return;
      }

      // [R] Ricochet Sound Profile Hotkey
      if (k === 'r') {
        this.cycleRicochetSoundProfile();
        return;
      }

      // [T] Voice Persona Toggle Hotkey
      if (k === 't') {
        this.toggleVoicePersona();
        return;
      }

      // [J] Sensor Jam Hotkey
      if (k === 'j') {
        this.activateSensorJam();
        return;
      }

      // [Space] Phaser Disruptor Strike Hotkey
      if (e.key === ' ') {
        e.preventDefault();
        this.activatePhaserStrike();
        return;
      }

      if (!this.isPlaying || this.isPaused || this.isTransitioning) return;

      if (['1', '2', '3', '4'].includes(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        if (this.currentProblem && this.currentProblem.choices[idx] !== undefined) {
          const pod = document.getElementById(`ammo-${idx}`);
          if (pod) {
            pod.classList.add('pressed');
            setTimeout(() => pod.classList.remove('pressed'), 150);
          }
          this.submitAnswer(this.currentProblem.choices[idx], true);
        }
      }
    });

    document.querySelectorAll('.clcars-ammo-pill').forEach(pod => {
      pod.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!this.isPlaying || this.isPaused || this.isTransitioning) return;
        const idx = parseInt(pod.getAttribute('data-index'), 10);
        if (this.currentProblem && this.currentProblem.choices[idx] !== undefined) {
          this.submitAnswer(this.currentProblem.choices[idx], true);
        }
      });
    });

    const jamBtn = document.getElementById('btn-jam');
    if (jamBtn) {
      jamBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.activateSensorJam();
      });
    }

    const phaserBtn = document.getElementById('btn-phaser-strike');
    if (phaserBtn) {
      phaserBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.activatePhaserStrike();
      });
    }

    const voiceBtn = document.getElementById('btn-voice-toggle');
    if (voiceBtn) {
      voiceBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleVoicePersona();
      });
    }

    document.getElementById('btn-stats-toggle').addEventListener('click', () => {
      this.toggleStats();
    });

    document.getElementById('btn-mute-toggle').addEventListener('click', () => {
      this.toggleMasterMute();
    });

    document.getElementById('btn-ambient-toggle').addEventListener('click', () => {
      this.toggleAmbient();
    });

    document.getElementById('btn-visualizer-toggle').addEventListener('click', () => {
      this.toggleVisualizer();
    });

    const btnVisToggleAns = document.getElementById('btn-vis-toggle-ans');
    if (btnVisToggleAns) {
      btnVisToggleAns.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleVisualizerAnswers();
      });
    }

    const btnVisMinimize = document.getElementById('btn-vis-minimize');
    if (btnVisMinimize) {
      btnVisMinimize.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleVisualizerMinimize();
      });
    }

    document.getElementById('btn-vis-close').addEventListener('click', () => {
      this.toggleVisualizer();
    });

    document.getElementById('btn-pause').addEventListener('click', () => this.togglePause());
    document.getElementById('btn-resume').addEventListener('click', () => this.togglePause());
    const pauseSoundBtn = document.getElementById('btn-pause-sound-toggle');
    if (pauseSoundBtn) {
      pauseSoundBtn.addEventListener('click', () => {
        this.toggleMasterMute();
      });
    }

    // Pause Screen Sector Map View
    const pauseMapBtn = document.getElementById('btn-pause-sector-map');
    if (pauseMapBtn) {
      pauseMapBtn.addEventListener('click', () => {
        this.renderSectorStarChart();
        document.getElementById('sector-map-modal').classList.remove('hidden');
      });
    }
    const closeSectorMapBtn = document.getElementById('btn-close-sector-map');
    if (closeSectorMapBtn) {
      closeSectorMapBtn.addEventListener('click', () => {
        document.getElementById('sector-map-modal').classList.add('hidden');
      });
    }

    // End Mission Confirmation Modal Flow
    document.getElementById('btn-quit').addEventListener('click', () => {
      document.getElementById('confirm-abort-modal').classList.remove('hidden');
    });

    const btnAbortCancel = document.getElementById('btn-abort-cancel');
    if (btnAbortCancel) {
      btnAbortCancel.addEventListener('click', () => {
        document.getElementById('confirm-abort-modal').classList.add('hidden');
      });
    }

    const btnAbortConfirm = document.getElementById('btn-abort-confirm');
    if (btnAbortConfirm) {
      btnAbortConfirm.addEventListener('click', () => {
        document.getElementById('confirm-abort-modal').classList.add('hidden');
        document.getElementById('sector-map-modal').classList.add('hidden');
        document.getElementById('pause-modal').classList.add('hidden');
        this.isPlaying = false;
        this.isPaused = false;
        this.audio.setAmbientMode('dimmed');
        document.body.classList.remove('is-paused');
        if (this.hazardTimer) clearTimeout(this.hazardTimer);
        document.getElementById('red-alert-flash').classList.remove('active');
        document.getElementById('level-transition-card').classList.add('hidden');
        document.getElementById('lcars-visualizer-panel').classList.add('hidden');
        const sb = document.getElementById('test-sandbox-panel');
        if (sb) sb.classList.add('hidden');
        document.getElementById('start-modal').classList.remove('hidden');
        if (DEBUG_LOGS) console.log('[LCARS Pause Telemetry] Mission Aborted & Confirmed -> isPaused: false | Returned to Title');
      });
    }

    document.getElementById('btn-retry').addEventListener('click', () => {
      this.startMission(this.mode, this.rank);
    });

    // Debrief Screen Sector Map & Pause Review Handlers
    const debriefMapBtn = document.getElementById('btn-debrief-sector-map');
    if (debriefMapBtn) {
      debriefMapBtn.addEventListener('click', () => {
        this.renderSectorStarChart();
        document.getElementById('sector-map-modal').classList.remove('hidden');
      });
    }

    const debriefPauseBtn = document.getElementById('btn-debrief-pause-view');
    if (debriefPauseBtn) {
      debriefPauseBtn.addEventListener('click', () => {
        const sec = this.sectors[this.currentSectorIndex] || this.sectors[0];
        const lore = (this.sectorLore && this.sectorLore[sec.id]) ? this.sectorLore[sec.id] : null;
        const secTitle = document.getElementById('pause-sec-title');
        if (secTitle) secTitle.innerText = `STELLAR SECTOR: ${sec.name.toUpperCase()}`;
        const secClass = document.getElementById('pause-sec-class');
        if (secClass) secClass.innerText = `${sec.type.toUpperCase()} // PATROL SECTOR`;
        const secDesc = document.getElementById('pause-sec-desc');
        if (secDesc) secDesc.innerText = lore ? lore.desc : `Stellar sector ${sec.name}. Deflector array online.`;
        document.getElementById('pause-modal').classList.remove('hidden');
      });
    }

    const bindOptButtons = (containerId, callback) => {
      const container = document.getElementById(containerId);
      container.querySelectorAll('.opt-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          container.querySelectorAll('.opt-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          callback(btn);
        });
      });
    };

    bindOptButtons('mode-selector', (btn) => { this.mode = btn.getAttribute('data-mode'); });
    bindOptButtons('rank-selector', (btn) => { this.rank = btn.getAttribute('data-rank'); });

    // Sandbox UI Event Handlers
    document.querySelectorAll('.sandbox-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const count = parseInt(pill.getAttribute('data-count'), 10);
        this.setSandboxTargetCount(count);
      });
    });

    const speedSlider = document.getElementById('slider-sandbox-speed');
    if (speedSlider) {
      speedSlider.addEventListener('input', (e) => {
        this.setSandboxSpeed(e.target.value);
      });
    }

    const spinSlider = document.getElementById('slider-sandbox-spin');
    if (spinSlider) {
      spinSlider.addEventListener('input', (e) => {
        this.setSandboxSpin(e.target.value);
      });
    }

    const glowSlider = document.getElementById('slider-sandbox-glow');
    if (glowSlider) {
      glowSlider.addEventListener('input', (e) => {
        this.setSandboxGlow(e.target.value);
      });
    }

    const textHlSlider = document.getElementById('slider-sandbox-text-highlight');
    if (textHlSlider) {
      textHlSlider.addEventListener('input', (e) => {
        this.setSandboxTextHighlight(e.target.value);
      });
    }

    const particlesSlider = document.getElementById('slider-sandbox-particles');
    if (particlesSlider) {
      particlesSlider.addEventListener('input', (e) => {
        this.setSandboxExplosionParticles(e.target.value);
      });
    }

    const sectorBtn = document.getElementById('btn-sandbox-sector');
    if (sectorBtn) {
      sectorBtn.addEventListener('click', () => {
        this.cycleSandboxSector();
      });
    }

    const shieldMinBtn = document.getElementById('btn-shield-minimize');
    if (shieldMinBtn) {
      shieldMinBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const dock = document.getElementById('voyager-shield-panel');
        if (!dock) return;

        // 3-State Cycle: 0 (Expanded) -> 1 (Ultra-Minimized Header) -> 2 (Bottom-Right Corner Dock) -> 0
        if (!dock.classList.contains('minimized') && !dock.classList.contains('corner-docked')) {
          // Move to State 1: Ultra-Minimized Slim Header
          dock.classList.add('minimized');
          dock.classList.remove('corner-docked');
          shieldMinBtn.innerText = '↘';
          this.showBanner('🛡️ SHIELD CONSOLE: ULTRA-MINIMIZED');
        } else if (dock.classList.contains('minimized') && !dock.classList.contains('corner-docked')) {
          // Move to State 2: Bottom-Right Corner Docked
          dock.classList.remove('minimized');
          dock.classList.add('corner-docked');
          shieldMinBtn.innerText = '▲';
          this.showBanner('🛡️ SHIELD CONSOLE: DOCKED TO CORNER');
        } else {
          // Move to State 0: Fully Expanded Normal Dock
          dock.classList.remove('minimized');
          dock.classList.remove('corner-docked');
          // Clear fixed positioning if it was corner-docked or dragged so it restores cleanly
          dock.style.removeProperty('bottom');
          dock.style.removeProperty('right');
          dock.style.removeProperty('top');
          dock.style.removeProperty('left');
          dock.style.removeProperty('position');
          shieldMinBtn.innerText = '▲';
          this.showBanner('🛡️ SHIELD CONSOLE: EXPANDED');
        }
      });
    }

    const pauseVelBtn = document.getElementById('btn-sandbox-pause-vel');
    if (pauseVelBtn) {
      pauseVelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleSandboxVelocityPause();
      });
    }

    const respawnBtn = document.getElementById('btn-sandbox-respawn');
    if (respawnBtn) {
      respawnBtn.addEventListener('click', () => {
        if (this.mode === 'ricochet_test') {
          this.spawnTargets();
          this.showBanner('🔄 TARGET POSITIONS RE-CENTERED');
        }
      });
    }


    // Chrome-Like LCARS Test Matrix Tab Switcher
    document.querySelectorAll('.sandbox-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.stopPropagation();
        const tabId = tab.getAttribute('data-tab');
        document.querySelectorAll('.sandbox-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.sandbox-tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        const targetContent = document.getElementById(`stab-${tabId}`);
        if (targetContent) targetContent.classList.add('active');
      });
    });


    // Star Trek Fleet Tab Selection & Position Controls
    document.querySelectorAll('.ship-opt-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.ship-opt-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const shipId = btn.getAttribute('data-ship');
        this.spawnStarship(shipId);
        this.showBanner(`🚀 STARSHIP: ${btn.innerText.toUpperCase()}`);
      });
    });

    const posPills = document.querySelectorAll('#sandbox-ship-pos-pills .sandbox-pill-sm');
    posPills.forEach(pill => {
      pill.addEventListener('click', (e) => {
        e.stopPropagation();
        posPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const pos = pill.getAttribute('data-pos');
        this.applyStarshipPositionMode(pos);
        this.showBanner(`📍 SHIP POSITION: ${pos.toUpperCase()}`);
      });
    });

    const btnToggleVis = document.getElementById('btn-toggle-fleet-vis');
    if (btnToggleVis) {
      btnToggleVis.addEventListener('click', () => {
        this.toggleFleetVisibility();
      });
    }

    const btnWarpFlyby = document.getElementById('btn-warp-flyby');
    if (btnWarpFlyby) {
      btnWarpFlyby.addEventListener('click', () => {
        this.triggerWarpFlash();
      });
    }

    // Tab 2: Tactical & FX Test Buttons
    const btnTestExplosion = document.getElementById('btn-test-explosion');
    if (btnTestExplosion) {
      btnTestExplosion.addEventListener('click', () => {
        const testColorHex = (this.targetPanels.length > 0 && this.targetPanels[0].choiceColorHex) 
          ? this.targetPanels[0].choiceColorHex 
          : 0x0088ff;
        this.createMassiveExplosion(new THREE.Vector3(0, 0, -28), true, testColorHex);
        this.audio.playHit(0);
        this.audio.playLevelUp();
        this.triggerScreenShake();
        this.showBanner(`💥 TEST: ${this.testExplosionParticles} PARTICLES EXPLOSION`);
      });
    }

    const btnTestJam = document.getElementById('btn-test-jam');
    if (btnTestJam) {
      btnTestJam.addEventListener('click', () => {
        this.isJamActive = true;
        this.jamRemainingSeconds = 5.0;
        const fx = document.getElementById('temporal-jam-fx');
        if (fx) fx.classList.add('active');
        this.audio.playTimeDilation();
        this.triggerHaptic('jam');
        this.showBanner('⏳ TEST: TEMPORAL JAM DILATION (5s)');
        this.updateAbilityHUD();
      });
    }

    const btnTestPhaser = document.getElementById('btn-test-phaser');
    if (btnTestPhaser) {
      btnTestPhaser.addEventListener('click', () => {
        this.phaserCharges = Math.max(1, this.phaserCharges);
        this.activatePhaserStrike();
      });
    }

    const btnTestBeamin = document.getElementById('btn-test-beamin');
    if (btnTestBeamin) {
      btnTestBeamin.addEventListener('click', () => {
        this.spawnTargets();
        this.showBanner('✨ TEST: BEAM-IN MATERIALIZATION SHIMMER');
      });
    }

    const btnTestShake = document.getElementById('btn-test-shake');
    if (btnTestShake) {
      btnTestShake.addEventListener('click', () => {
        this.triggerScreenShake();
        this.triggerHaptic('shield_breach');
        this.showBanner('💢 TEST: SCREEN SHAKE & HAPTIC RUMBLE');
      });
    }

    // Tab 2: Holographic & Combat FX Suite Test Buttons
    const btnTestHexShield = document.getElementById('btn-test-hex-shield');
    if (btnTestHexShield) {
      btnTestHexShield.addEventListener('click', () => {
        this.triggerHexShieldImpact(0, 0, 0xffaa00);
        this.showBanner('🛡️ TEST: HEXAGONAL COCKPIT FORCEFIELD IMPACT');
      });
    }

    const btnTestPovSmash = document.getElementById('btn-test-pov-smash');
    if (btnTestPovSmash) {
      btnTestPovSmash.addEventListener('click', () => {
        if (this.targetPanels && this.targetPanels.length > 0) {
          const wrongTgt = this.targetPanels.find(p => p.value !== (this.currentProblem && this.currentProblem.answer)) || this.targetPanels[0];
          this.submitAnswer(wrongTgt.value, false);
        } else {
          this.triggerHexShieldImpact(0, 0, 0xff3344);
          this.spawnDebrisShards(new THREE.Vector3(0, 0, 4.0), 0xff3344, 24);
          this.triggerScreenShake(0.5);
          this.showBanner('💥 TEST: POV WRONG-ANSWER RICOCHET SMASH');
        }
      });
    }

    const btnTestPraxisWave = document.getElementById('btn-test-praxis-wave');
    if (btnTestPraxisWave) {
      btnTestPraxisWave.addEventListener('click', () => {
        this.spawnPraxisShockwave(new THREE.Vector3(0, 0, -25), 0x00f0ff);
        this.showBanner('🪐 TEST: PRAXIS SUBSPACE SHOCKWAVE RING');
      });
    }

    const btnTestDebrisShards = document.getElementById('btn-test-debris-shards');
    if (btnTestDebrisShards) {
      btnTestDebrisShards.addEventListener('click', () => {
        this.spawnDebrisShards(new THREE.Vector3(0, 0, -20), 0xffaa00, 24);
        this.showBanner('✨ TEST: GEOMETRIC DEBRIS VAPORIZATION SHARDS');
      });
    }

    const btnTestWarpStreaks = document.getElementById('btn-test-warp-streaks');
    if (btnTestWarpStreaks) {
      btnTestWarpStreaks.addEventListener('click', () => {
        this.triggerWarpStreaks(3.0);
      });
    }

    const btnTestGridLight = document.getElementById('btn-test-grid-light');
    if (btnTestGridLight) {
      btnTestGridLight.addEventListener('click', () => {
        this.triggerGridPointLight(new THREE.Vector3(0, -6, -20), 0xffaa00, 5.0, 0.04);
        this.showBanner('💡 TEST: DYNAMIC GRID POINT-LIGHT ILLUMINATION');
      });
    }

    // Mobile Haptic Direct Test Buttons
    const hapTap = document.getElementById('btn-hap-tap');
    if (hapTap) hapTap.addEventListener('click', () => { this.triggerHaptic('tap'); this.showBanner('📳 HAPTIC: 15ms TAP PULSE'); });
    const hapRumble = document.getElementById('btn-hap-rumble');
    if (hapRumble) hapRumble.addEventListener('click', () => { this.triggerHaptic('shield_breach'); this.showBanner('📳 HAPTIC: [40,20,40] SHIELD RUMBLE'); });
    const hapPhaser = document.getElementById('btn-hap-phaser');
    if (hapPhaser) hapPhaser.addEventListener('click', () => { this.triggerHaptic('phaser'); this.showBanner('📳 HAPTIC: 60ms PHASER KICK'); });
    const hapJam = document.getElementById('btn-hap-jam');
    if (hapJam) hapJam.addEventListener('click', () => { this.triggerHaptic('jam'); this.showBanner('📳 HAPTIC: [20,30,20] JAM RIPPLE'); });

    // Tab 3: 3D Spatial Audio Pan Test Buttons
    const panLeft = document.getElementById('btn-pan-left');
    if (panLeft) panLeft.addEventListener('click', () => { this.audio.playRicochet(this.isPaused, 0, -21.0); this.showBanner('🎧 3D SPATIAL AUDIO: LEFT PAN (-0.85)'); });
    const panCenter = document.getElementById('btn-pan-center');
    if (panCenter) panCenter.addEventListener('click', () => { this.audio.playRicochet(this.isPaused, 1, 0.0); this.showBanner('🎧 3D SPATIAL AUDIO: CENTER PAN (0.0)'); });
    const panRight = document.getElementById('btn-pan-right');
    if (panRight) panRight.addEventListener('click', () => { this.audio.playRicochet(this.isPaused, 2, 21.0); this.showBanner('🎧 3D SPATIAL AUDIO: RIGHT PAN (+0.85)'); });

    const sfxPing = document.getElementById('btn-test-sfx-ping');
    if (sfxPing) sfxPing.addEventListener('click', () => { this.audio.cycleRicochetProfile(); this.showBanner(`🔊 SFX PROFILE: ${this.audio.ricochetProfile.toUpperCase()}`); });

    const sfxShieldChime = document.getElementById('btn-test-shield-chime');
    if (sfxShieldChime) sfxShieldChime.addEventListener('click', () => { this.audio.playShieldRecharge(); this.showBanner('🛡️ SFX: SHIELD RECHARGE CHIME'); });

    // Tab 4: Debrief Simulator Buttons
    const simulateDebrief = (grade) => {
      this.isSimulatingDebrief = true;
      const prevMode = this.mode;
      this.shields = grade === 'S' ? 3 : (grade === 'A' ? 2 : (grade === 'B' ? 1 : 0));
      this.totalAttempts = 10;
      this.correctHits = grade === 'S' ? 10 : (grade === 'A' ? 8 : (grade === 'B' ? 6 : 4));
      this.level = 6;
      this.score = grade === 'S' ? 4500 : (grade === 'A' ? 3200 : (grade === 'B' ? 2100 : 950));
      this.elapsedSeconds = 18;
      
      if (grade === 'C' || grade === 'B') {
        this.missedProblems = [
          { wave: 2, question: 'd/dx (x² + 3x) [x=1]', selected: 4, correct: 5, hint: 'Power rule: 2x + 3. At x=1: 2(1)+3 = 5.' },
          { wave: 4, question: '∫ 2x dx [0 to 3]', selected: 6, correct: 9, hint: 'Integral is x². Evaluated 3² - 0 = 9.' }
        ];
      } else {
        this.missedProblems = [];
      }
      this.gameOver(`SIMULATION COMPLETE (${grade}-RANK PREVIEW)`);
      this.isSimulatingDebrief = false;
      this.mode = prevMode;
    };

    const btnToggleNormal = document.getElementById('btn-toggle-normal-play');
    if (btnToggleNormal) {
      btnToggleNormal.addEventListener('click', () => {
        this.toggleNormalPlay();
      });
    }

    const btnSimS = document.getElementById('btn-sim-grade-s');
    if (btnSimS) btnSimS.addEventListener('click', () => simulateDebrief('S'));
    const btnSimA = document.getElementById('btn-sim-grade-a');
    if (btnSimA) btnSimA.addEventListener('click', () => simulateDebrief('A'));
    const btnSimB = document.getElementById('btn-sim-grade-b');
    if (btnSimB) btnSimB.addEventListener('click', () => simulateDebrief('B'));
    const btnSimC = document.getElementById('btn-sim-grade-c');
    if (btnSimC) btnSimC.addEventListener('click', () => simulateDebrief('C'));

    const btnTestStarChart = document.getElementById('btn-test-starchart');
    if (btnTestStarChart) {
      btnTestStarChart.addEventListener('click', () => {
        this.initPatrolRoute();
        this.patrolProgress = ((this.patrolProgress || 0) + 1) % this.sectors.length;
        const currentSec = this.sectors[this.patrolRoute[this.patrolProgress]];
        this.renderSectorStarChart(this.patrolProgress);
        this.showBanner(`🌌 STAR CHART STEP ${this.patrolProgress + 1}/10: ${currentSec.name}`);
        document.getElementById('gameover-modal').classList.remove('hidden');
      });
    }

    const btnSimErrors = document.getElementById('btn-test-err-review');
    if (btnSimErrors) btnSimErrors.addEventListener('click', () => simulateDebrief('C'));

    const btnClearFlight = document.getElementById('btn-test-clear-flight');
    if (btnClearFlight) {
      btnClearFlight.addEventListener('click', () => {
        localStorage.removeItem('holodeck_flight_recorder');
        this.showBanner('🗑️ CAREER FLIGHT RECORDER RESET');
      });
    }

    // Tab 5: Holodeck Flight Recorder (H.264 MP4 / 75 FPS) Controls
    const btnToggleRec = document.getElementById('btn-toggle-recording');
    if (btnToggleRec) {
      btnToggleRec.addEventListener('click', () => {
        this.toggleRecording();
      });
    }

    const sourcePills = document.querySelectorAll('#rec-source-pills button');
    sourcePills.forEach(pill => {
      pill.addEventListener('click', () => {
        const src = pill.getAttribute('data-source');
        this.setRecordingSource(src);
      });
    });

    const fpsPills = document.querySelectorAll('#rec-fps-pills button');
    fpsPills.forEach(pill => {
      pill.addEventListener('click', () => {
        const fps = pill.getAttribute('data-fps');
        this.setRecordingFPS(fps);
      });
    });

    const codecPills = document.querySelectorAll('#rec-codec-pills button');
    codecPills.forEach(pill => {
      pill.addEventListener('click', () => {
        const codec = pill.getAttribute('data-codec');
        this.setRecordingCodec(codec);
      });
    });

    const bitratePills = document.querySelectorAll('#rec-bitrate-pills button');
    bitratePills.forEach(pill => {
      pill.addEventListener('click', () => {
        const bitrate = pill.getAttribute('data-bitrate');
        this.setRecordingBitrate(bitrate);
      });
    });

    const btnRecDownload = document.getElementById('btn-rec-download');
    if (btnRecDownload) {
      btnRecDownload.addEventListener('click', () => {
        if (this.lastRecordedBlobUrl && this.lastRecordedFilename) {
          const a = document.createElement('a');
          a.href = this.lastRecordedBlobUrl;
          a.download = this.lastRecordedFilename;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => document.body.removeChild(a), 200);
          this.showBanner('💾 VIDEO FILE EXPORTED');
        }
      });
    }

    const btnRecClose = document.getElementById('btn-rec-close');
    if (btnRecClose) {
      btnRecClose.addEventListener('click', () => {
        const modal = document.getElementById('recorder-preview-modal');
        if (modal) modal.classList.add('hidden');
        const video = document.getElementById('rec-preview-video');
        if (video) {
          video.pause();
          video.removeAttribute('src');
          video.load();
        }
      });
    }

    const testRicochetBtn = document.getElementById('btn-test-ricochet');
    if (testRicochetBtn) {
      testRicochetBtn.addEventListener('click', () => {
        this.startMission('ricochet_test', this.rank);
      });
    }

    document.getElementById('btn-engage').addEventListener('click', () => {
      this.startMission(this.mode, this.rank);
    });
  }


  // Analytical Ray-Plane Room Intersection for Pulsar Wall Caustics & Reflection Bounces
  findPulsarRoomHit(origin, dir) {
    let closestT = Infinity;
    let hitPoint = null;
    let hitNormal = null;

    const planes = [
      { name: 'back',    axis: 'z', val: -55.0, normal: { x: 0, y: 0, z: 1 },  test: (p) => Math.abs(p.x) <= 21.2 && Math.abs(p.y) <= 12.8 },
      { name: 'left',    axis: 'x', val: -21.0, normal: { x: 1, y: 0, z: 0 },  test: (p) => Math.abs(p.y) <= 12.8 && p.z <= -9.8 && p.z >= -55.2 },
      { name: 'right',   axis: 'x', val: 21.0,  normal: { x: -1, y: 0, z: 0 }, test: (p) => Math.abs(p.y) <= 12.8 && p.z <= -9.8 && p.z >= -55.2 },
      { name: 'floor',   axis: 'y', val: -12.5, normal: { x: 0, y: 1, z: 0 },  test: (p) => Math.abs(p.x) <= 21.2 && p.z <= -9.8 && p.z >= -55.2 },
      { name: 'ceiling', axis: 'y', val: 12.5,  normal: { x: 0, y: -1, z: 0 }, test: (p) => Math.abs(p.x) <= 21.2 && p.z <= -9.8 && p.z >= -55.2 }
    ];

    for (let i = 0; i < planes.length; i++) {
      const pl = planes[i];
      const dComp = dir[pl.axis];
      if (Math.abs(dComp) < 0.0001) continue;
      const t = (pl.val - origin[pl.axis]) / dComp;
      if (t > 0 && t < closestT) {
        const pt = {
          x: origin.x + t * dir.x,
          y: origin.y + t * dir.y,
          z: origin.z + t * dir.z
        };
        if (pl.test(pt)) {
          closestT = t;
          hitPoint = pt;
          hitNormal = pl.normal;
        }
      }
    }

    return hitPoint ? { point: hitPoint, normal: hitNormal, distance: closestT } : null;
  }

  animate(timestamp) {
    requestAnimationFrame(this.animate);

    const now = performance.now();
    if (!this.lastFrameTime) this.lastFrameTime = now;
    const delta = (now - this.lastFrameTime) * 0.001;
    this.lastFrameTime = now;

    // Rolling FPS tracking (Throttled 4Hz Telemetry without per-frame DOM Lookups)
    this.frameCount++;
    if (now - this.fpsLastTime >= 250) {
      this.currentFps = Math.round((this.frameCount * 1000) / (now - this.fpsLastTime));
      this.frameCount = 0;
      this.fpsLastTime = now;

      if (this.showStats && this.dom) {
        if (this.dom.statsFps) {
          this.dom.statsFps.innerText = `${this.currentFps} FPS`;
          this.dom.statsFps.className = this.currentFps >= 55 ? 'stats-item fps-good' : (this.currentFps >= 30 ? 'stats-item fps-med' : 'stats-item fps-low');
        }
        if (this.dom.statsTargets) this.dom.statsTargets.innerText = `🎯 ${this.targetPanels.length} TARGETS`;
        if (this.dom.statsParticles) this.dom.statsParticles.innerText = `✨ ${this.particles.length} PARTICLES`;
        if (this.dom.statsWarp) this.dom.statsWarp.innerText = `WARP ${this.warpFactor.toFixed(1)}`;
      }
    }

    const time = (typeof timestamp === 'number' && timestamp > 0 ? timestamp : now) * 0.001;

    // Starfield Movement - ONLY moves forward during Hyperspace Warp Jump!
    if (this.starPos && this.starGeo && this.starGeo.attributes && this.starGeo.attributes.position) {
      if (this.isWarpJumping) {
        for (let i = 0; i < this.starCount; i++) {
          this.starPos[i * 3 + 2] += 34.0;
          if (this.starPos[i * 3 + 2] > 10.0) {
            this.starPos[i * 3 + 2] = -260.0;
            this.starPos[i * 3] = (Math.random() - 0.5) * 320;
            this.starPos[i * 3 + 1] = (Math.random() - 0.5) * 200;
          }
        }
        this.starGeo.attributes.position.needsUpdate = true;
      }
    }

    // Active Sector Dynamic Animations
    // 1. Betelgeuse Red Supergiant (Overwhelming Sunset Atmosphere & Projection Ambience - ONLY IN BETELGEUSE SECTOR)
    if (this.activeSunMesh) {
      this.activeSunMesh.rotation.y = time * 0.03;
      if (this.activeCoronaMesh) this.activeCoronaMesh.rotation.z = -time * 0.02;
      if (this.activeLoopMesh) this.activeLoopMesh.rotation.z = Math.sin(time * 1.5) * 0.2 + (Math.PI / 4);

      // Dynamic Sunset Atmospheric Breathing (Soft & Wide)
      const sunsetPulse = Math.sin(time * 1.2) * 0.05;
      if (this.betelgeuseSunsetAura && this.betelgeuseSunsetAura.material) {
        this.betelgeuseSunsetAura.material.opacity = 0.48 + sunsetPulse;
      }
      if (this.betelgeuseSunsetHemi) {
        this.betelgeuseSunsetHemi.intensity = 0.50 + sunsetPulse * 0.3;
      }
      if (this.betelgeuseSunsetLight) {
        this.betelgeuseSunsetLight.intensity = 0.30 + sunsetPulse * 0.4;
      }

      // Smooth Sunset Ambience Enveloping Target Projections (Betelgeuse Only)
      if (this.targetPanels && this.targetPanels.length > 0) {
        this.targetPanels.forEach(t => {
          if (t.mesh && t.mesh.material) {
            const baseGlow = (this.isJamActive ? 1.1 : 0.75);
            t.mesh.material.emissiveIntensity = baseGlow + sunsetPulse * 0.5;
            if (t.mesh.material.emissive && t.mesh.material.emissive.setHex) {
              t.mesh.material.emissive.setHex(0x3a0d18); // Deep sunset crimson-amber dusk
            }
          }
        });
      }
    } else {
      // In all other 9 sectors, maintain standard quantum cyan holographic projection emissive
      if (this.targetPanels && this.targetPanels.length > 0) {
        this.targetPanels.forEach(t => {
          if (t.mesh && t.mesh.material && !t.isAttacking) {
            if (t.mesh.material.emissive && t.mesh.material.emissive.setHex) {
              t.mesh.material.emissive.setHex(0x051122);
            }
            if (t.mesh.material.emissiveIntensity !== undefined && !this.isJamActive) {
              t.mesh.material.emissiveIntensity = 0.60;
            }
          }
        });
      }
    }

    if (this.activeHoleMesh) {
      if (this.activeAccretionDisk) this.activeAccretionDisk.rotation.z = time * 0.75;
      if (this.activePhotonRing) this.activePhotonRing.rotation.z = -time * 0.4;
      if (this.activeJetTop) this.activeJetTop.rotation.y = time * 1.2;
      if (this.activeJetBottom) this.activeJetBottom.rotation.y = time * 1.2;
    }

    if (this.nebulaClouds) {
      this.nebulaClouds.forEach((c, idx) => {
        c.rotation.z = time * (0.01 + idx * 0.005);
        c.rotation.y = Math.sin(time * 0.1 + idx) * 0.1;
      });
    }

    if (this.activePulsarMesh) {
      this.activePulsarMesh.rotation.y = time * 3.5;
      if (this.pulsarBeamGroup) {
        this.pulsarBeamGroup.rotation.z = time * 2.8;
        this.pulsarBeamGroup.rotation.x = Math.sin(time * 1.8) * 0.45;

        // Dynamic Spotlight Geometry Projection: Direct analytical trigonometric direction calculation
        const rx = this.pulsarBeamGroup.rotation.x || 0;
        const ry = this.activePulsarMesh.rotation.y || 0;
        const rz = this.pulsarBeamGroup.rotation.z || 0;

        const cosX = Math.cos(rx), sinX = Math.sin(rx);
        const cosY = Math.cos(ry), sinY = Math.sin(ry);
        const cosZ = Math.cos(rz), sinZ = Math.sin(rz);

        const topX = sinY * cosX * cosZ + sinX * sinZ;
        const topY = cosX * cosY;
        const topZ = -sinX * cosZ + sinY * cosX * sinZ;

        const pX = this.activePulsarMesh.position.x;
        const pY = this.activePulsarMesh.position.y;
        const pZ = this.activePulsarMesh.position.z;

        if (this.pulsarSpotTargetTop && this.pulsarSpotTargetTop.position && this.pulsarSpotTargetTop.position.set) {
          this.pulsarSpotTargetTop.position.set(
            pX + topX * 120,
            pY + topY * 120,
            pZ + topZ * 120
          );
        }
        if (this.pulsarSpotTargetBottom && this.pulsarSpotTargetBottom.position && this.pulsarSpotTargetBottom.position.set) {
          this.pulsarSpotTargetBottom.position.set(
            pX - topX * 120,
            pY - topY * 120,
            pZ - topZ * 120
          );
        }

        // Continuous Physical Lighthouse Projection (Steady, powerful sweeping beams, no rapid flashing/strobe)
        if (this.pulsarCoreLight) {
          this.pulsarCoreLight.intensity = 3.0;
        }
        if (this.pulsarSpotTop) {
          this.pulsarSpotTop.intensity = 8.5;
        }
        if (this.pulsarSpotBottom) {
          this.pulsarSpotBottom.intensity = 8.5;
        }

        const pulsarPos = { x: pX, y: pY, z: pZ };
        const topDir = { x: topX, y: topY, z: topZ };
        const bottomDir = { x: -topX, y: -topY, z: -topZ };

        // 1. Realistic Wall/Floor/Ceiling Caustic Splashes & Secondary Bounce Light Bounces!
        const hitTop = this.findPulsarRoomHit(pulsarPos, topDir);
        if (hitTop && this.pulsarImpactTop) {
          this.pulsarImpactTop.visible = true;
          this.pulsarImpactTop.position.set(
            hitTop.point.x + hitTop.normal.x * 0.08,
            hitTop.point.y + hitTop.normal.y * 0.08,
            hitTop.point.z + hitTop.normal.z * 0.08
          );
          // Orient caustic disc to match wall plane normal
          if (hitTop.normal.z !== 0) {
            this.pulsarImpactTop.rotation.set(0, 0, 0);
          } else if (hitTop.normal.x !== 0) {
            this.pulsarImpactTop.rotation.set(0, Math.PI / 2, 0);
          } else if (hitTop.normal.y !== 0) {
            this.pulsarImpactTop.rotation.set(Math.PI / 2, 0, 0);
          }
          if (this.pulsarImpactTop.material) {
            this.pulsarImpactTop.material.opacity = Math.max(0.25, 0.85 - (hitTop.distance / 240));
          }
          if (this.pulsarBounceLightTop) {
            this.pulsarBounceLightTop.intensity = 2.0;
            this.pulsarBounceLightTop.position.set(
              hitTop.point.x + hitTop.normal.x * 0.5,
              hitTop.point.y + hitTop.normal.y * 0.5,
              hitTop.point.z + hitTop.normal.z * 0.5
            );
          }
        } else if (this.pulsarImpactTop) {
          this.pulsarImpactTop.visible = false;
          if (this.pulsarBounceLightTop) this.pulsarBounceLightTop.intensity = 0.0;
        }

        const hitBottom = this.findPulsarRoomHit(pulsarPos, bottomDir);
        if (hitBottom && this.pulsarImpactBottom) {
          this.pulsarImpactBottom.visible = true;
          this.pulsarImpactBottom.position.set(
            hitBottom.point.x + hitBottom.normal.x * 0.08,
            hitBottom.point.y + hitBottom.normal.y * 0.08,
            hitBottom.point.z + hitBottom.normal.z * 0.08
          );
          if (hitBottom.normal.z !== 0) {
            this.pulsarImpactBottom.rotation.set(0, 0, 0);
          } else if (hitBottom.normal.x !== 0) {
            this.pulsarImpactBottom.rotation.set(0, Math.PI / 2, 0);
          } else if (hitBottom.normal.y !== 0) {
            this.pulsarImpactBottom.rotation.set(Math.PI / 2, 0, 0);
          }
          if (this.pulsarImpactBottom.material) {
            this.pulsarImpactBottom.material.opacity = Math.max(0.25, 0.85 - (hitBottom.distance / 240));
          }
          if (this.pulsarBounceLightBottom) {
            this.pulsarBounceLightBottom.intensity = 2.0;
            this.pulsarBounceLightBottom.position.set(
              hitBottom.point.x + hitBottom.normal.x * 0.5,
              hitBottom.point.y + hitBottom.normal.y * 0.5,
              hitBottom.point.z + hitBottom.normal.z * 0.5
            );
          }
        } else if (this.pulsarImpactBottom) {
          this.pulsarImpactBottom.visible = false;
          if (this.pulsarBounceLightBottom) this.pulsarBounceLightBottom.intensity = 0.0;
        }

        // 2. Realistic Target Beam Refraction, Reflection Flare & Specular Highlights!
        this.targetPanels.forEach(tp => {
          if (!tp.mesh || !tp.mesh.material) return;
          const tx = tp.mesh.position.x - pX;
          const ty = tp.mesh.position.y - pY;
          const tz = tp.mesh.position.z - pZ;
          const dist = Math.hypot(tx, ty, tz) || 1;
          const nx = tx / dist, ny = ty / dist, nz = tz / dist;

          const dotTop = nx * topDir.x + ny * topDir.y + nz * topDir.z;
          const dotBottom = nx * bottomDir.x + ny * bottomDir.y + nz * bottomDir.z;
          const maxDot = Math.max(dotTop, dotBottom);

          // Within beam cone (~16 degrees -> cos(16 deg) = 0.961)
          if (maxDot > 0.950) {
            const beamAlignment = (maxDot - 0.950) / 0.050; // 0.0 to 1.0
            tp.mesh.material.emissiveIntensity = 0.60 + (beamAlignment * 1.6);
            if (tp.mesh.material.emissive && tp.mesh.material.emissive.setHex) {
              tp.mesh.material.emissive.setHex(0x00aaff);
            }
          } else {
            // Restore standard emissive baseline
            tp.mesh.material.emissiveIntensity = 0.60;
            if (tp.mesh.material.emissive && tp.mesh.material.emissive.setHex) {
              tp.mesh.material.emissive.setHex(0x051122);
            }
          }
        });
      }
      if (this.activeMagRing1) this.activeMagRing1.rotation.y = time * 1.2;
      if (this.activeMagRing2) this.activeMagRing2.rotation.z = -time * 1.5;
    }

    if (this.planetMesh) {
      this.planetMesh.rotation.y = time * 0.025;
      if (this.planetRings) this.planetRings.rotation.z = time * 0.008;

      if (this.moon1Mesh) {
        const m1Angle = time * 0.06;
        this.moon1Mesh.position.x = this.planetMesh.position.x + Math.cos(m1Angle) * 44;
        this.moon1Mesh.position.y = this.planetMesh.position.y + Math.sin(m1Angle * 0.5) * 12;
        this.moon1Mesh.position.z = this.planetMesh.position.z + Math.sin(m1Angle) * 44;
        this.moon1Mesh.rotation.y = time * 0.08;
      }

      if (this.moon2Mesh) {
        const m2Angle = -time * 0.09 + 2.0;
        this.moon2Mesh.position.x = this.planetMesh.position.x + Math.cos(m2Angle) * 32;
        this.moon2Mesh.position.y = this.planetMesh.position.y + Math.sin(m2Angle * 0.8) * 9;
        this.moon2Mesh.position.z = this.planetMesh.position.z + Math.sin(m2Angle) * 32;
        this.moon2Mesh.rotation.y = time * 0.12;
      }
    }

    // 6. Kepler-47 Andromeda Binary
    if (this.binaryGroup) {
      this.binaryGroup.rotation.y = time * 0.12;
      this.binaryGroup.rotation.z = Math.sin(time * 0.4) * 0.08;
    }

    // 7. Badlands Chroniton Rift
    if (this.activeRiftCrystal) {
      this.activeRiftCrystal.rotation.x = time * 0.7;
      this.activeRiftCrystal.rotation.y = time * 1.1;
      if (this.activeRibbon1) this.activeRibbon1.rotation.z = time * 0.5;
      if (this.activeRibbon2) this.activeRibbon2.rotation.z = -time * 0.7;
    }

    // 8. Kardashev Dyson Swarm: 90° Rigid Body Plane Tilt via Rx(alpha) about in-plane X-axis
    if (this.dysonStar) {
      this.dysonStar.rotation.y = time * 0.04;
      
      // alpha(t) goes smoothly from 0 to PI/2 (90 degrees) as a rigid rotation of the whole ring plane
      const alpha = ((1 - Math.cos(time * 0.45)) / 2) * (Math.PI / 2);
      
      // 1. Highlighted Outer Ring: Rigid body 90° tilt about the X-axis passing through planet center
      if (this.dysonRingGroup) {
        this.dysonRingGroup.rotation.x = alpha; // Rx(alpha) with alpha in [0, PI/2]
        this.dysonRingGroup.rotation.y = 0;
        this.dysonRingGroup.rotation.z = time * 0.06;
      }
      if (this.dysonRingSpinGroup) {
        this.dysonRingSpinGroup.rotation.z = time * 0.10;
      }

      // 2. Inner Blue Ring: Intersecting rigid body tilt & counter-spin
      if (this.dysonInnerRingGroup) {
        const innerAlpha = -((1 - Math.sin(time * 0.45)) / 2) * (Math.PI / 2);
        this.dysonInnerRingGroup.rotation.x = innerAlpha;
        this.dysonInnerRingGroup.rotation.y = Math.PI / 6;
      }
      if (this.dysonInnerRingSpinGroup) {
        this.dysonInnerRingSpinGroup.rotation.z = -time * 0.16;
      }
    }

    // 9. Cassiopeia A Hypernova (Opposite Phase & Direction 90° Rigid Body Rx(alpha) Plane Tilt)
    if (this.hyperCore) {
      this.hyperCore.rotation.y = -time * 1.2;

      // Opposite Starting Phase: Starts at PI/2 (90°) and descends to 0°, opposing Kardashev's 0° -> 90°
      const alphaOuter = ((1 + Math.cos(time * 0.45)) / 2) * (Math.PI / 2);
      const alphaInner = ((1 + Math.sin(time * 0.45)) / 2) * (Math.PI / 2);

      // Outer Fiery Gold Blast Envelope: Opposite Plane Tilt & Counter-Clockwise Roll
      if (this.hyperShellOuter) {
        this.hyperShellOuter.rotation.x = alphaOuter;
        this.hyperShellOuter.rotation.y = 0;
        this.hyperShellOuter.rotation.z = -time * 0.12;
      }

      // Inner Turquoise Relativistic Shockwave Shell: Opposite Intersecting Tilt & Clockwise Spin
      if (this.hyperShellInner) {
        this.hyperShellInner.rotation.x = alphaInner;
        this.hyperShellInner.rotation.y = -Math.PI / 6;
        this.hyperShellInner.rotation.z = time * 0.20;
      }
    }

    // 10. Epsilon Crystalline Entity (Dynamic Refraction, Specular Reflection & Holodeck Ricochet Optics)
    if (this.crystalEntity) {
      this.crystalEntity.rotation.x = time * 0.35;
      this.crystalEntity.rotation.y = time * 0.55;
      if (this.crystalShardsGroup) {
        this.crystalShardsGroup.rotation.y = -time * 0.4;
        this.crystalShardsGroup.rotation.z = time * 0.18;
      }

      // Check for active ricochet refraction pulse from holodeck wall bounce
      let refractionGlow = 0;
      let refractionColor = 0x00ffff;
      if (this.crystalRefractionPulse) {
        const elapsed = now - this.crystalRefractionPulse.startTime;
        if (elapsed < 850) {
          const decay = 1.0 - (elapsed / 850);
          refractionGlow = Math.pow(decay, 1.4) * 2.8; // Sharp surge & smooth optical refraction decay
          refractionColor = this.crystalRefractionPulse.color;
        } else {
          this.crystalRefractionPulse = null;
        }
      }

      // Sample closest target projectile for continuous chromatic proximity refraction
      let targetProximityRefraction = 0;
      let targetColorHex = 0x00ffff;
      if (this.targetPanels && this.targetPanels.length > 0) {
        let minDist = Infinity;
        const choiceHexes = [0xff6f59, 0x0088ff, 0xee66cc, 0xffbb00];
        this.targetPanels.forEach(t => {
          if (t.mesh) {
            const d = Math.hypot(t.mesh.position.x - 34, t.mesh.position.y - 10, t.mesh.position.z + 142);
            if (d < minDist) {
              minDist = d;
              targetColorHex = t.choiceColorHex || choiceHexes[((t.index || 1) - 1) % choiceHexes.length];
            }
          }
        });
        targetProximityRefraction = Math.max(0, 1.0 - (minDist / 180)) * 0.45;
      }

      // Apply dynamic specular refraction & 1 to 4 enhanced optical crystals
      if (this.crystalSatellites && this.crystalSatellites.length > 0) {
        const enhancedIndices = (this.crystalRefractionPulse && this.crystalRefractionPulse.enhancedIndices) ? this.crystalRefractionPulse.enhancedIndices : [0];

        this.crystalSatellites.forEach((sat, sIdx) => {
          if (sat.material) {
            const isEnhanced = enhancedIndices.includes(sIdx);
            const facetPhase = Math.sin(time * 3.0 + sIdx * 1.2) * 0.15;

            if (isEnhanced && refractionGlow > 0.05) {
              // 1 to 4 Enhanced Satellites: Hyper-boosted chromatic refraction & prism scaling!
              const enhanceMultiplier = 1.65;
              sat.material.emissiveIntensity = 0.85 + (refractionGlow * enhanceMultiplier) + facetPhase;
              if (sat.material.emissive && sat.material.emissive.setHex) {
                sat.material.emissive.setHex(refractionColor);
              }
              if (sat.scale && sat.scale.setScalar) {
                sat.scale.setScalar(1.0 + (refractionGlow * 0.15));
              }
            } else {
              // Non-enhanced satellites: Soft ambient dispersion
              const passiveGlow = refractionGlow * 0.45;
              sat.material.emissiveIntensity = 0.75 + passiveGlow + targetProximityRefraction + facetPhase;
              if (sat.material.emissive && sat.material.emissive.setHex) {
                if (refractionGlow > 0.3) {
                  sat.material.emissive.setHex(refractionColor);
                } else {
                  sat.material.emissive.setHex(0x0088cc);
                }
              }
              if (sat.scale && sat.scale.setScalar) {
                sat.scale.setScalar(1.0);
              }
            }
          }
        });
      }

      // Flare connecting matrix lattice lines during ricochet refraction pulse
      if (this.crystalLatticeMat) {
        this.crystalLatticeMat.opacity = Math.min(1.0, 0.32 + refractionGlow * 0.45);
        if (refractionGlow > 0.2 && this.crystalLatticeMat.color && this.crystalLatticeMat.color.setHex) {
          this.crystalLatticeMat.color.setHex(refractionColor);
        } else if (this.crystalLatticeMat.color && this.crystalLatticeMat.color.setHex) {
          this.crystalLatticeMat.color.setHex(0x00f0ff);
        }
      }

      // Core prism internal glow refraction
      if (this.crystalEntity.material) {
        this.crystalEntity.material.emissiveIntensity = 0.85 + (refractionGlow * 0.6);
      }
    }

    // Starship Fleet Idle Motion, Banking & Structure-Relative Glow Animation
    if (this.activeShipMesh && this.isFleetVisible) {
      const shipUserData = this.activeShipMesh.userData || {};
      const baseX = shipUserData.baseX !== undefined ? shipUserData.baseX : 0;
      const baseY = shipUserData.baseY !== undefined ? shipUserData.baseY : 0;
      
      // Gentle sinusoidal idle banking and drift
      this.activeShipMesh.position.y = baseY + Math.sin(time * 0.8) * 0.6;
      this.activeShipMesh.position.x = baseX + Math.cos(time * 0.5) * 0.4;
      
      // 3D rotation for Borg Cube & Sphere, or subtle bank for cruisers
      if (shipUserData.rotY) {
        this.activeShipMesh.rotation.y += shipUserData.rotY;
        if (shipUserData.shipId === 'borg_cube') {
          this.activeShipMesh.rotation.x = Math.sin(time * 0.4) * 0.15;
          this.activeShipMesh.rotation.z = Math.cos(time * 0.3) * 0.1;
        } else if (shipUserData.shipId === 'borg_sphere') {
          this.activeShipMesh.rotation.x = Math.sin(time * 0.35) * 0.2;
          this.activeShipMesh.rotation.z = Math.cos(time * 0.25) * 0.15;
        }
      } else {
        this.activeShipMesh.rotation.z = Math.sin(time * 0.8) * 0.04;
      }

      // Structure-relative glow pulsation for nacelles, deflector, singularity core & Borg conduits
      if (shipUserData.glowMeshes && shipUserData.glowMeshes.length > 0) {
        const pulse = 0.85 + Math.sin(time * 4.0) * 0.25;
        const borgFlicker = 0.75 + Math.sin(time * 7.5) * 0.25;
        
        shipUserData.glowMeshes.forEach(mesh => {
          if (mesh && mesh.material && mesh.material.opacity !== undefined && mesh.material.transparent) {
            const isBorg = shipUserData.shipId === 'borg_cube' || shipUserData.shipId === 'borg_sphere';
            mesh.material.opacity = isBorg ? Math.min(1.0, 0.45 + borgFlicker * 0.35) : Math.min(1.0, 0.65 + pulse * 0.35);
          }
        });
      }

      // Dynamic ship point light pulse
      if (shipUserData.shipLights && shipUserData.shipLights.length > 0) {
        const lightPulse = 1.0 + Math.sin(time * 3.2) * 0.25;
        shipUserData.shipLights.forEach(light => {
          if (light && light.userData && light.userData.baseIntensity) {
            light.intensity = light.userData.baseIntensity * lightPulse;
          }
        });
      }

      // Pulsating fractal cybernetic lines across Borg Cube face
      if (shipUserData.fractalConduits && shipUserData.fractalConduits.length > 0) {
        shipUserData.fractalConduits.forEach(conduit => {
          const dist = (conduit.userData && conduit.userData.dist) ? conduit.userData.dist : 0;
          const wave = Math.sin(time * 6.0 - dist * 2.8);
          const brightness = Math.max(0.12, Math.pow(Math.max(0, wave), 2.2) * 0.95);
          if (conduit.material) {
            conduit.material.opacity = Math.min(1.0, brightness);
          }
        });
      }
    }

    if (this.cosmicGroup) {
      this.cosmicGroup.rotation.y = Math.sin(time * 0.02) * 0.04;
    }

    if (this.isPlaying && !this.isPaused && !this.isTransitioning) {
      this.waveRemainingTime -= delta;

      const pct = Math.max(0, (this.waveRemainingTime / this.waveTotalTime) * 100);
      const fillEl = (this.dom && this.dom.waveTimerFill) || document.getElementById('wave-timer-fill');
      const valEl = (this.dom && this.dom.waveTimerVal) || document.getElementById('wave-timer-val');

      const timerStr = `${Math.max(0, this.waveRemainingTime).toFixed(1)}s`;
      if (valEl && timerStr !== this._lastTimerStr) {
        valEl.innerText = timerStr;
        this._lastTimerStr = timerStr;

        const critState = this.waveRemainingTime <= 6.0 ? 2 : (this.waveRemainingTime <= 15.0 ? 1 : 0);
        if (critState !== this._lastCritState) {
          this._lastCritState = critState;
          if (critState === 2) {
            valEl.classList.add('critical');
            if (fillEl) fillEl.style.background = '#ff3333';
          } else if (critState === 1) {
            valEl.classList.remove('critical');
            if (fillEl) fillEl.style.background = 'var(--voyager-amber)';
          } else {
            valEl.classList.remove('critical');
            if (fillEl) fillEl.style.background = 'var(--voyager-peach)';
          }
        }

        if (this.waveRemainingTime <= 6.0) {
          if (!this.lastTickSec || Math.floor(this.waveRemainingTime) !== this.lastTickSec) {
            this.lastTickSec = Math.floor(this.waveRemainingTime);
            this.audio.playTimeTick();
          }
        }
      }

      if (fillEl) {
        const roundedPct = Math.round(pct * 10) / 10;
        if (roundedPct !== this._lastTimerPct) {
          fillEl.style.width = `${roundedPct}%`;
          this._lastTimerPct = roundedPct;
        }
      }

      if (this.waveRemainingTime <= 0) {
        this.handleWaveTimeout();
      }
    }

    if (this.phaserMesh) {
      this.phaserMesh.position.y = -1.2 + Math.sin(time * 2) * 0.02;
      this.phaserMesh.rotation.y = -this.mouse.x * 0.45;
      this.phaserMesh.rotation.x = this.mouse.y * 0.4;
      if (this.phaserRing) {
        this.phaserRing.rotation.z = time * 6;
      }
    }

    if (this.isJamActive) {
      this.jamRemainingSeconds -= 0.016;
      if (this.jamRemainingSeconds <= 0) {
        this.isJamActive = false;
        const fx = (this.dom && this.dom.temporalJamFx) || document.getElementById('temporal-jam-fx');
        if (fx) fx.classList.remove('active');
        this.showBanner('⚡ SENSOR JAM EXPIRED');
        this.updateAbilityHUD();
      } else {
        const jamBadge = (this.dom && this.dom.jamChargeBadge) || document.getElementById('jam-charge-badge');
        const jamStr = `${Math.max(0, this.jamRemainingSeconds).toFixed(1)}s`;
        if (jamBadge && jamStr !== this._lastJamStr) {
          jamBadge.innerText = jamStr;
          this._lastJamStr = jamStr;
        }
      }
    }

    const speedMult = this.isJamActive ? 0.30 : 1.0;

    if (!this.isTransitioning) {
      this.targetPanels.forEach(target => {
        const mesh = target.mesh;
        if (!mesh) return;

        // Holodeck Transporter Beam-In Holographic Materialization
        if (target.spawnProgress !== undefined && target.spawnProgress < 1.0) {
          target.spawnProgress = Math.min(1.0, target.spawnProgress + delta * 2.8);
          const sp = target.spawnProgress;
          const scaleX = Math.min(1.0, sp * 1.25);
          const scaleY = 1.0 + (1.0 - sp) * 0.75;
          const scaleZ = Math.min(1.0, sp * 1.25);
          mesh.scale.set(scaleX, scaleY, scaleZ);
          if (mesh.material) {
            mesh.material.opacity = Math.min(1.0, 0.1 + sp * 0.9);
          }
        }

        if (!this.isTestVelocityPaused) {
          mesh.position.x += target.vx * speedMult;
          mesh.position.y += target.vy * speedMult;
          mesh.position.z += target.vz * speedMult;
        }

        // Dynamic Distance-from-POV Glow & Outline Compensation:
        // Keeps cybernetic color outlines crisp, bright, and readable even when moving far back to Z = -55
        const camDist = Math.hypot(mesh.position.x, mesh.position.y, mesh.position.z - 7.5);
        const distLuminanceBoost = Math.min(2.5, Math.max(1.0, 1.0 + (camDist - 18.0) / 22.0));

        if (mesh.material && mesh.material.emissiveIntensity !== undefined) {
          const baseGlow = typeof this.testGlowMult === 'number' ? this.testGlowMult : 1.0;
          const textHl = typeof this.testTextHighlightMult === 'number' ? this.testTextHighlightMult : 1.0;
          const targetEmissive = 0.85 * Math.min(2.8, Math.max(0.2, baseGlow * 0.65 + textHl * 0.35)) * distLuminanceBoost;
          mesh.material.emissiveIntensity = targetEmissive;
        }

        if (target.internalLight) {
          const baseGlow = typeof this.testGlowMult === 'number' ? this.testGlowMult : 1.0;
          target.internalLight.intensity = 2.8 * Math.max(0.1, baseGlow) * Math.min(1.8, distLuminanceBoost);
        }

        const textHl = typeof this.testTextHighlightMult === 'number' ? this.testTextHighlightMult : 1.0;
        const numEmissive = 0.95 * Math.min(2.8, Math.max(0.4, textHl)) * distLuminanceBoost;
        const numLightIntensity = 2.2 * Math.max(0.2, textHl) * Math.min(2.0, distLuminanceBoost);

        if (target.numGroupFront && target.numGroupFront.userData) {
          if (target.numGroupFront.userData.whiteMat) target.numGroupFront.userData.whiteMat.emissiveIntensity = numEmissive;
          if (target.numGroupFront.userData.numLight) target.numGroupFront.userData.numLight.intensity = numLightIntensity;
        }
        if (target.numGroupBack && target.numGroupBack.userData) {
          if (target.numGroupBack.userData.whiteMat) target.numGroupBack.userData.whiteMat.emissiveIntensity = numEmissive;
          if (target.numGroupBack.userData.numLight) target.numGroupBack.userData.numLight.intensity = numLightIntensity;
        }

        // Dynamic Player/Viewer-Facing Orientation Bias:
        // Slow down rotation when the large front face is presented to the viewer, speeding smoothly through edge-on/backward turns
        const curRotY = mesh.rotation.y || 0;
        const curRotX = mesh.rotation.x || 0;
        const frontFacingFactor = Math.max(0, Math.cos(curRotY) * Math.cos(curRotX));
        const dwellMult = 1.0 - (0.58 * Math.pow(frontFacingFactor, 1.5));

        mesh.rotation.x += target.rotX * speedMult * dwellMult;
        mesh.rotation.y += target.rotY * speedMult * dwellMult;

        // Linear Perspective & Rotation-Aware Dynamic Bounding Extents
        // Box Dimensions: 4.4w x 2.9h x 0.75d (Halves: 2.2w, 1.45h, 0.375d)
        const rotY = mesh.rotation.y || 0;
        const rotX = mesh.rotation.x || 0;
        const cosY = Math.abs(Math.cos(rotY)), sinY = Math.abs(Math.sin(rotY));
        const cosX = Math.abs(Math.cos(rotX)), sinX = Math.abs(Math.sin(rotX));

        const halfX = (2.2 * cosY) + (0.375 * sinY);
        const halfY = (1.45 * cosX) + (0.375 * sinX);
        const halfZ = (0.375 * cosY) + (2.2 * sinY);

        const roomWallX = 21.0;
        const roomFloorCeilY = 12.5;
        const roomBackZ = -55.0;
        const roomFrontZ = -10.0;

        let bouncedWall = null;
        let playWallChime = false;

        // 1. Left Wall (X = -21.0)
        if (!this.isTestVelocityPaused && (mesh.position.x - halfX) <= -roomWallX && target.vx < 0) {
          target.vx = Math.abs(target.vx);
          mesh.position.x = -roomWallX + halfX;
          bouncedWall = 'LEFT WALL (X = -21.0)';
          playWallChime = true;
        }
        // 2. Right Wall (X = +21.0)
        else if ((mesh.position.x + halfX) >= roomWallX && target.vx > 0) {
          target.vx = -Math.abs(target.vx);
          mesh.position.x = roomWallX - halfX;
          bouncedWall = 'RIGHT WALL (X = +21.0)';
          playWallChime = true;
        }

        // 3. Floor (Y = -12.5)
        if ((mesh.position.y - halfY) <= -roomFloorCeilY && target.vy < 0) {
          target.vy = Math.abs(target.vy);
          mesh.position.y = -roomFloorCeilY + halfY;
          bouncedWall = bouncedWall ? `${bouncedWall} + FLOOR (Y = -12.5)` : 'FLOOR (Y = -12.5)';
          playWallChime = true;
        }
        // 4. Ceiling (Y = +12.5)
        else if ((mesh.position.y + halfY) >= roomFloorCeilY && target.vy > 0) {
          target.vy = -Math.abs(target.vy);
          mesh.position.y = roomFloorCeilY - halfY;
          bouncedWall = bouncedWall ? `${bouncedWall} + CEILING (Y = +12.5)` : 'CEILING (Y = +12.5)';
          playWallChime = true;
        }

        // 5. Back Wall (Z = -55.0) - Physical bounce only (silent depth turnaround)
        if (!target.isAttacking && (mesh.position.z - halfZ) <= roomBackZ && target.vz < 0) {
          target.vz = Math.abs(target.vz);
          mesh.position.z = roomBackZ + halfZ;
          bouncedWall = bouncedWall ? `${bouncedWall} + BACK WALL (Z = -55.0)` : 'BACK WALL (Z = -55.0)';
        }

        // 6. In-Room Front Boundary (Z = -10.0) - Physical bounce only (silent depth turnaround)
        if (!target.isAttacking && (mesh.position.z + halfZ) >= roomFrontZ && target.vz > 0) {
          target.vz = -Math.abs(target.vz);
          mesh.position.z = roomFrontZ - halfZ;
          bouncedWall = bouncedWall ? `${bouncedWall} + FRONT BOUNDARY (Z = -10.0)` : 'FRONT BOUNDARY (Z = -10.0)';
        }

        // Single coordinated ricochet trigger and telemetry log per frame
        if (bouncedWall) {
          const nowMs = performance.now();
          const targetIdx = target.index ? (target.index - 1) : this.targetPanels.indexOf(target);

          if (playWallChime && (!target.lastBounceMs || (nowMs - target.lastBounceMs >= 60))) {
            target.lastBounceMs = nowMs;
            this.audio.playRicochet(this.isPaused, targetIdx, mesh.position.x);
            this.createWallImpactPulse(bouncedWall, mesh.position, target);
          }
          
          // Calculate screen-space projection for perspective verification
          let screenInfo = '';
          if (this.camera && typeof window !== 'undefined') {
            try {
              const proj = mesh.position.clone().project(this.camera);
              const sx = Math.round((proj.x * 0.5 + 0.5) * window.innerWidth);
              const sy = Math.round((-(proj.y) * 0.5 + 0.5) * window.innerHeight);
              screenInfo = ` | Screen: [${sx}px, ${sy}px]`;
            } catch(e) {}
          }

          const harmonicLabels = ['Root (1.0x)', '+Maj2 (1.12x)', '+Maj3 (1.26x)', '+Perf5 (1.50x)'];
          const harmLabel = harmonicLabels[targetIdx % harmonicLabels.length] || '1.0x';

          if (DEBUG_LOGS) console.log(`[LCARS Holodeck Physics] Target #${targetIdx + 1} (Harmonic: ${harmLabel} | Val: "${target.value}") ricochet on ${bouncedWall} | Pos: [${mesh.position.x.toFixed(1)}, ${mesh.position.y.toFixed(1)}, ${mesh.position.z.toFixed(1)}]${screenInfo} | Rot: [${(rotX*57.3).toFixed(0)}°, ${(rotY*57.3).toFixed(0)}°] | Paused: ${this.isPaused}`);
        }

        // Perimeter breach / Shield Hit
        if (mesh.position.z >= 6.0) {
          const wasCorrectTarget = target.isCorrect;
          this.scene.remove(mesh);
          this.disposeObject(mesh);
          this.targetPanels = this.targetPanels.filter(t => t !== target);

          if (wasCorrectTarget) {
            // The real correct answer crashed! The matrix is ruined and cannot be solved.
            // Instantly trigger loss debrief with correct answer so the player can restart cleanly.
            this.shieldsLeft = 0;
            this.combo = 0;
            this.audio.playError();
            this.audio.playShieldBreak();
            this.triggerScreenShake();
            this.showBanner('💥 CRITICAL TARGET LOST: MATRIX COMPROMISED!', true);
            document.getElementById('red-alert-flash').classList.remove('active');
            this.updateHUD();
            this.startFailureIntermission('TARGET MATRIX LOST // CORRECT ANSWER BREACHED');
          } else {
            // A distractor breached
            this.shieldsLeft = Math.max(0, this.shieldsLeft - 1);
            this.combo = 0;
            this.audio.playError();
            this.audio.playShieldBreak();
            this.triggerScreenShake();
            this.showBanner('CONTAINMENT SHIELD BREACHED!', true);
            document.getElementById('red-alert-flash').classList.remove('active');
            this.updateHUD();

            if (this.shieldsLeft <= 0) {
              this.startFailureIntermission('CONTAINMENT BREACH: 3 SHIELDS COLLAPSED');
            } else {
              this.audio.playVoice('shield_damaged', 'Containment shield damaged.');
              this.resetHazardTimer();
            }
          }
        }
      });
    }

    for (let i = this.photonBalls.length - 1; i >= 0; i--) {
      const ball = this.photonBalls[i];
      ball.mesh.position.add(ball.velocity);
      ball.lifespan--;

      let hitTarget = null;
      for (let j = 0; j < this.targetPanels.length; j++) {
        const t = this.targetPanels[j];
        if (ball.mesh.position.distanceToSquared(t.mesh.position) < 7.29) {
          hitTarget = t;
          break;
        }
      }

      if (hitTarget) {
        this.scene.remove(ball.mesh);
        this.disposeObject(ball.mesh);
        this.photonBalls.splice(i, 1);
        this.submitAnswer(hitTarget.value, false);
        continue;
      }

      if (ball.mesh.position.z <= -55.0 || ball.mesh.position.x <= -21.0 || ball.mesh.position.x >= 21.0 || ball.mesh.position.y <= -12.5 || ball.mesh.position.y >= 12.5 || ball.lifespan <= 0) {
        this.createMassiveExplosion(ball.mesh.position, false);
        this.scene.remove(ball.mesh);
        this.disposeObject(ball.mesh);
        this.photonBalls.splice(i, 1);
      }
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.scale += 0.28;
      if (sw.mesh && sw.mesh.scale) sw.mesh.scale.set(sw.scale, sw.scale, 1);
      sw.opacity -= 0.045;
      sw.mesh.material.opacity = Math.max(0, sw.opacity);

      if (sw.opacity <= 0) {
        this.scene.remove(sw.mesh);
        this.shockwaves.splice(i, 1);
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.mesh.position.add(p.velocity);
      p.velocity.multiplyScalar(0.98);
      p.life -= p.decay;
      p.mesh.scale.setScalar(Math.max(0.01, p.life));

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
      }
    }

    // 1. Target Corner Wireframe Flares (Rotates and moves with target mesh in 3D)
    for (let i = this.targetCornerFlares.length - 1; i >= 0; i--) {
      const cf = this.targetCornerFlares[i];
      cf.life -= cf.decay;

      if (cf.group && cf.group.children) {
        cf.group.children.forEach(child => {
          if (child.material) {
            child.material.opacity = Math.max(0, cf.life);
          }
        });
      }

      if (cf.life <= 0) {
        if (cf.parentMesh && cf.parentMesh.remove && cf.group) {
          cf.parentMesh.remove(cf.group);
        }
        if (cf.group) this.disposeGroup(cf.group);
        this.targetCornerFlares.splice(i, 1);
      }
    }

    // 2. Mathematical Holodeck Grid Line Illuminations
    for (let i = this.illuminatedGridLines.length - 1; i >= 0; i--) {
      const ig = this.illuminatedGridLines[i];
      ig.life -= ig.decay;

      if (ig.group && ig.group.children) {
        ig.group.children.forEach(child => {
          if (child.material) {
            child.material.opacity = Math.max(0, ig.life);
          }
        });
      }

      if (ig.life <= 0) {
        this.scene.remove(ig.group);
        if (ig.group) this.disposeGroup(ig.group);
        this.illuminatedGridLines.splice(i, 1);
      }
    }

    // 3. Pooled PointLight Grid Flashes (Zero WebGL Shader Recompilations)
    if (this.impactLightPool) {
      this.impactLightPool.forEach(entry => {
        if (entry.life > 0) {
          entry.life -= (entry.decay || 0.065);
          if (entry.light) entry.light.intensity = Math.max(0, entry.life * 4.5);
        }
      });
    }

    // 4. Pooled Impact Plasma Sparks (Zero Mesh Disposal & Allocation)
    if (this.sparkPool) {
      this.sparkPool.forEach(spk => {
        if (spk.life > 0) {
          spk.mesh.position.add(spk.velocity);
          spk.velocity.multiplyScalar(0.96);
          spk.life -= spk.decay;
          spk.mesh.scale.setScalar(Math.max(0.01, spk.life));

          if (spk.life <= 0) {
            spk.mesh.visible = false;
            if (spk.mesh && !spk.isPooled) this.disposeObject(spk.mesh);
          }
        }
      });
    }

    // 5. Update Incoming Wrong-Answer Projectiles Rushing at Player POV
    if (this.povAttackingTargets && this.povAttackingTargets.length > 0) {
      for (let i = this.povAttackingTargets.length - 1; i >= 0; i--) {
        const tgt = this.povAttackingTargets[i];
        const m = tgt.mesh;
        if (m) {
          m.position.z += tgt.povSpeed || 1.8;
          m.position.x += (0 - m.position.x) * 0.08;
          m.position.y += (0 - m.position.y) * 0.08;
          m.rotation.x += 0.16;
          m.rotation.y += 0.24;

          // Pulse red warning glow
          if (m.material && m.material.emissive && m.material.emissive.setHex) {
            m.material.emissive.setHex(0xff0033);
            m.material.emissiveIntensity = 2.0;
          }

          // Cockpit forcefield collision threshold
          if (m.position.z >= 3.8) {
            this.triggerHexShieldImpact(m.position.x, m.position.y, 0xff2244);
            this.spawnDebrisShards(new THREE.Vector3(m.position.x, m.position.y, 3.8), 0xff3344, 24);
            this.triggerScreenShake(0.5);
            this.triggerHaptic('shield_breach');
            this.scene.remove(m);
            this.disposeObject(m);
            this.povAttackingTargets.splice(i, 1);
          }
        }
      }
    }

    // 6. Hexagonal Cockpit Forcefield Shield Ripple Decay
    if (this.hexShieldImpact && this.cockpitShieldMat) {
      this.hexShieldImpact.life -= this.hexShieldImpact.decay;
      this.cockpitShieldMat.opacity = Math.max(0, this.hexShieldImpact.life * 0.95);
      if (this.hexShieldTex) {
        this.hexShieldTex.offset.x += 0.004;
        this.hexShieldTex.offset.y += 0.002;
      }
      if (this.hexShieldImpact.life <= 0) {
        this.hexShieldImpact = null;
        this.cockpitShieldMat.opacity = 0.0;
      }
    }

    // 7. Expanding Praxis Subspace Shockwaves
    if (this.praxisWaves && this.praxisWaves.length > 0) {
      for (let i = this.praxisWaves.length - 1; i >= 0; i--) {
        const pw = this.praxisWaves[i];
        pw.scale += pw.growth;
        pw.opacity -= pw.decay;
        if (pw.mesh && pw.mesh.scale) {
          pw.mesh.scale.set(pw.scale, pw.scale, 1);
          if (pw.mesh.material) pw.mesh.material.opacity = Math.max(0, pw.opacity);
        }
        if (pw.opacity <= 0) {
          this.scene.remove(pw.mesh);
          this.disposeObject(pw.mesh);
          this.praxisWaves.splice(i, 1);
        }
      }
    }

    // 8. Geometric Debris Vaporization Shards
    if (this.debrisShards && this.debrisShards.length > 0) {
      for (let i = this.debrisShards.length - 1; i >= 0; i--) {
        const ds = this.debrisShards[i];
        ds.mesh.position.x += ds.vx * 0.05;
        ds.mesh.position.y += ds.vy * 0.05;
        ds.mesh.position.z += ds.vz * 0.05;
        ds.mesh.rotation.x += ds.rx;
        ds.mesh.rotation.y += ds.ry;
        ds.mesh.rotation.z += ds.rz;
        ds.life -= ds.decay;
        ds.mesh.scale.setScalar(Math.max(0.01, ds.life));
        if (ds.mesh.material) ds.mesh.material.opacity = Math.max(0, ds.life);
        if (ds.life <= 0) {
          this.scene.remove(ds.mesh);
          this.disposeObject(ds.mesh);
          this.debrisShards.splice(i, 1);
        }
      }
    }

    // 9. Tier 3 Relativistic Hyperdrive Warp Streaks
    if ((this.isWarpJumping || this.isWarpStreaksActive) && this.warpStreaks) {
      if (this.warpStreakGroup) this.warpStreakGroup.visible = true;
      this.warpStreaks.forEach(st => {
        st.mesh.position.z += st.speed;
        st.mesh.scale.z = Math.min(st.len, st.mesh.scale.z + 1.2);
        if (st.mesh.position.z > 20) {
          st.mesh.position.z = -180;
          st.mesh.scale.z = 0.01;
        }
      });
    }

    // 10. Real-Time Performance & Stutter Profiler
    const frameNow = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (this._lastFrameTime) {
      const frameDelta = frameNow - this._lastFrameTime;
      if (frameDelta > 32.0 && DEBUG_LOGS) { // Dropped below 30 FPS
        console.warn(`[LCARS Performance Profiler] ⚠️ Frame stutter detected: ${frameDelta.toFixed(1)}ms (${(1000/frameDelta).toFixed(0)} FPS)`);
      }
    }
    this._lastFrameTime = frameNow;

    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.gameInstance = new HolodeckGame();
});
