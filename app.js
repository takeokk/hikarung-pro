/**
 * HIKARUNG-PRO - Offline-First iPad Sound Cue & BGM Playlist Deck
 * Zero external dependencies. Web Audio API + IndexedDB + Service Worker.
 */

const APP_VERSION = 'v3.4.0';

function safeNum(val, fallback) {
  if (val === null || val === undefined || val === '') return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

const PAD_COLORS = [
  { id: 'cyan', hex: '#06b6d4', label: 'シアン' },
  { id: 'emerald', hex: '#10b981', label: 'エメラルド' },
  { id: 'amber', hex: '#f59e0b', label: 'アンバー' },
  { id: 'rose', hex: '#f43f5e', label: 'ローズ' },
  { id: 'purple', hex: '#8b5cf6', label: 'パープル' },
  { id: 'blue', hex: '#3b82f6', label: 'ブルー' },
  { id: 'pink', hex: '#ec4899', label: 'ピンク' },
  { id: 'slate', hex: '#94a3b8', label: 'スレート' }
];

const KEYBOARD_ROWS = [
  ['1', '2', '3', '4', '5', '6'],
  ['Q', 'W', 'E', 'R', 'T', 'Y'],
  ['A', 'S', 'D', 'F', 'G', 'H'],
  ['Z', 'X', 'C', 'V', 'B', 'N']
];

const DEFAULT_KEYS = [
  '1', '2', '3', '4', '5', '6',
  'Q', 'W', 'E', 'R', 'T', 'Y',
  'A', 'S', 'D', 'F', 'G', 'H',
  'Z', 'X', 'C', 'V', 'B', 'N'
];

const MODE_LABELS = {
  poly: 'POLY',
  retrig: 'RETRIG',
  mono: 'MONO',
  xfade: 'X-FADE',
  gate: 'GATE'
};

const INITIAL_SAMPLES = [
  {
    id: 'aud_init_jan',
    name: '🎉 タイトル・決定音 (ジャン！)',
    file: '01_タイトル決定音_ジャン.wav',
    url: './samples/01_タイトル決定音_ジャン.wav',
    mimeType: 'audio/wav',
    color: 'cyan',
    triggerMode: 'poly',
    loop: false,
    fadeOut: 1.5,
    addToBgm: false
  },
  {
    id: 'aud_init_correct',
    name: '⭕ クイズ正解 (ピンポン♪)',
    file: '02_クイズ正解_ピンポン.wav',
    url: './samples/02_クイズ正解_ピンポン.wav',
    mimeType: 'audio/wav',
    color: 'emerald',
    triggerMode: 'poly',
    loop: false,
    fadeOut: 1.0,
    addToBgm: false
  },
  {
    id: 'aud_init_wrong',
    name: '❌ クイズ不正解 (ブッブー)',
    file: '03_クイズ不正解_ブッブー.wav',
    url: './samples/03_クイズ不正解_ブッブー.wav',
    mimeType: 'audio/wav',
    color: 'rose',
    triggerMode: 'poly',
    loop: false,
    fadeOut: 1.0,
    addToBgm: false
  },
  {
    id: 'aud_initial_yoshi',
    name: '懸命にふんばりジャンプをするも足場に届かなかったヨッシーのモノマネ',
    file: '懸命にふんばりジャンプをするも足場に届かなかったヨッシーのモノマネ.mp3',
    url: './samples/懸命にふんばりジャンプをするも足場に届かなかったヨッシーのモノマネ.mp3',
    mimeType: 'audio/mpeg',
    color: 'emerald',
    triggerMode: 'poly',
    loop: false,
    fadeOut: 2.0,
    addToBgm: false
  },
  {
    id: 'aud_init_bgm_talk',
    name: '🎵 トークBGM (Chill Loop)',
    file: '07_トークBGM_ChillLoop.wav',
    url: './samples/07_トークBGM_ChillLoop.wav',
    mimeType: 'audio/wav',
    color: 'blue',
    triggerMode: 'xfade',
    loop: true,
    fadeOut: 3.0,
    addToBgm: true
  },
  {
    id: 'aud_init_bgm_upbeat',
    name: '🎵 オープニングBGM (Upbeat)',
    file: '08_オープニングBGM_Upbeat.wav',
    url: './samples/08_オープニングBGM_Upbeat.wav',
    mimeType: 'audio/wav',
    color: 'amber',
    triggerMode: 'xfade',
    loop: true,
    fadeOut: 3.0,
    addToBgm: true
  }
];

// ==================== INDEXEDDB STORAGE ====================
class HikarungDB {
  constructor() {
    this.dbName = 'KlangPadProDB'; // Keep same DB name so user settings persist
    this.version = 2;
    this.db = null;
  }

  async init() {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, this.version);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('audioFiles')) {
          db.createObjectStore('audioFiles', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('appState')) {
          db.createObjectStore('appState', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('mediaLibrary')) {
          db.createObjectStore('mediaLibrary', { keyPath: 'id' });
        }
      };
      req.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async saveAudioFile(record) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('audioFiles', 'readwrite');
      tx.objectStore('audioFiles').put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  async getAudioFile(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('audioFiles', 'readonly');
      const req = tx.objectStore('audioFiles').get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async getAllAudioFiles() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('audioFiles', 'readonly');
      const req = tx.objectStore('audioFiles').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async deleteAudioFile(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('audioFiles', 'readwrite');
      tx.objectStore('audioFiles').delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  async saveState(stateData) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('appState', 'readwrite');
      tx.objectStore('appState').put({ id: 'main', stateData });
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  async loadState() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('appState', 'readonly');
      const req = tx.objectStore('appState').get('main');
      req.onsuccess = () => resolve(req.result ? req.result.stateData : null);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async clearAll() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['audioFiles', 'appState'], 'readwrite');
      tx.objectStore('audioFiles').clear();
      tx.objectStore('appState').clear();
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  async saveLibraryItem(record) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('mediaLibrary', 'readwrite');
      tx.objectStore('mediaLibrary').put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  async getLibraryItem(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('mediaLibrary', 'readonly');
      const req = tx.objectStore('mediaLibrary').get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async getAllLibraryItems() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('mediaLibrary', 'readonly');
      const req = tx.objectStore('mediaLibrary').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async clearLibraryItems() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('mediaLibrary', 'readwrite');
      tx.objectStore('mediaLibrary').clear();
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  }
}

// ==================== MAIN APPLICATION ====================
class HikarungProApp {
  constructor() {
    this.db = new HikarungDB();
    this.audioCtx = null;
    this.offlineDecodeCtx = null;
    this.masterMixBus = null;
    this.masterLimiter = null;
    this.outMatrix = null;
    this.masterSeGain = null;
    this.masterBgmGain = null;
    this.analyserL = null;
    this.analyserR = null;
    this.analyserBufL = null;
    this.analyserBufR = null;

    // Decoded AudioBuffer cache: Map<audioId, AudioBuffer>
    this.audioBuffers = new Map();
    this.audioMeta = new Map(); // Map<audioId, { name, duration }>
    this.longBufferOrder = []; // LRU list of long (>=30s) AudioBuffers kept in RAM (max 3)
    this.pendingDecodes = new Map(); // Deduplicate concurrent decodeAudioData calls

    // Active Pad Voices: Map<padId, Set<VoiceObj>>
    this.activePadVoices = new Map();
    // Cached DOM elements for active pad progress: Map<padId, { padEl, bar, timeEl, miniControls }>
    this.padDomCache = new Map();
    // Async race guards
    this.bgmPlaySeq = 0;
    this.padTriggerSeq = new Map();
    this.gatePressedPads = new Set();
    this.bgmPrefetchedId = null;
    this.saveStateDebounceTimer = null;

    // App State (persisted to IndexedDB)
    this.state = {
      gridSize: '4x4',
      masterVol: 100,
      masterFadeSec: 3.0,
      currentBankId: 'bank_1',
      banks: [],
      currentPlaylistId: 'pl_1',
      playlists: [],
      bgmVol: 85,
      bgmMode: 'all_loop',
      bgmXfade: 3.0,
      bgmMonoLink: 'off',
      outputMode: 'stereo',
      slotKeys: {}
    };

    // Runtime UI state
    this.isEditMode = false;
    this.isTalkOver = false;
    this.animFrameId = null;
    this.bgTimerId = null;
    this.lastAnimTickMs = 0;
    this.bgKeepAliveAudio = null;
    this.bgKeepAliveStopTimer = null;

    // VU Meter runtime state
    this.vuState = {
      peakL: -60,
      peakR: -60,
      holdL: -60,
      holdR: -60,
      isIdleDrawn: false
    };

    // BGM Player Runtime
    this.bgmPlayer = {
      isPlaying: false,
      playingPlaylistId: null,
      currentTrackIndex: 0,
      activeNode: null,
      fadingNodes: new Set(),
      pausedAtOffset: 0,
      startedAtCtxTime: 0,
      isCrossfadingNext: false,
      isSeeking: false,
      lastScrubTime: 0
    };

    // Waveform Editor Modal Runtime
    this.editorTarget = null;
    this.editorDraft = null;
    this.previewVoice = null;
    this.draggingTrimHandle = null;
    this.editorZoom = 1;
    this.editorPanStart = 0; // 0..1 fraction of total duration

    // Media Library (Left Collapsible Column: PC folder watch + iPad pool)
    this.mediaLibrary = {
      dirHandle: null,
      dirName: '',
      fsItems: [],
      poolItems: [],
      searchQuery: '',
      folderFilter: '',
      watchTimer: null,
      lastSignature: '',
      isScanning: false,
      isOpen: false,
      previewAudio: null,
      previewUrl: null,
      previewItemId: null,
      previewSeq: 0
    };
    this.libDrag = null;
  }

  async init() {
    this.registerServiceWorker();
    this.bindUIEvents();
    await this.loadOrInitData();
    this.initMediaLibrary();
    this.startAnimationLoop();
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => { });
    }
    const updateBadge = () => {
      const badge = document.getElementById('offlineStatusBadge');
      if (!badge) return;
      badge.textContent = navigator.onLine ? 'OFFLINE READY' : 'OFFLINE MODE (機内/圏外)';
    };
    window.addEventListener('online', updateBadge);
    window.addEventListener('offline', updateBadge);
    updateBadge();
  }

  async updateAppCache() {
    if (window.__IS_STANDALONE_HTML__) {
      this.showToast('単体HTML版のためオンライン更新は不要です');
      return;
    }
    if (!navigator.onLine) {
      this.showToast('⚠️ オフラインのため更新できません（現在のアプリは安全に保護されました）');
      return;
    }
    const anyPlaying = this.activePadVoices.size > 0 || this.bgmPlayer.isPlaying;
    if (anyPlaying) {
      const ok = await this.showConfirmDialog('アプリ更新の確認', '現在音声が再生中です。更新すると再読み込みで音が止まりますがよろしいですか？');
      if (!ok) return;
    }

    this.showToast('サーバーへの接続を確認中...');
    try {
      const probe = await fetch('./sw.js', { cache: 'no-store' });
      if (!probe.ok) throw new Error('offline');
    } catch (_) {
      this.showToast('⚠️ サーバーに接続できないため更新を中止しました（現在のアプリを維持します）');
      return;
    }

    this.showToast('最新版を取得しています...');
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) {
          await reg.unregister();
        }
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch (_) { }
    location.reload();
  }

  ensureAudioContext() {
    // Request iOS/iPadOS 17+ Playback AudioSession (keeps Web Audio alive in background & ignores Silent Switch)
    if ('audioSession' in navigator) {
      try {
        if (navigator.audioSession.type !== 'playback') {
          navigator.audioSession.type = 'playback';
        }
      } catch (_) { }
    }

    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContextClass({ latencyHint: 'interactive' });

      // Master Mix Bus (explicit 2ch stereo so mono SEs always appear on both L/R VU channels)
      this.masterMixBus = this.audioCtx.createGain();
      this.masterMixBus.gain.value = 1.0;
      this.masterMixBus.channelCount = 2;
      this.masterMixBus.channelCountMode = 'explicit';
      this.masterMixBus.channelInterpretation = 'speakers';

      // Studio Brickwall Limiter to prevent digital clipping on high gain / POLY stacking
      this.masterLimiter = this.audioCtx.createDynamicsCompressor();
      this.masterLimiter.threshold.value = -1.0;
      this.masterLimiter.knee.value = 3.0;
      this.masterLimiter.ratio.value = 20.0;
      this.masterLimiter.attack.value = 0.002;
      this.masterLimiter.release.value = 0.08;

      this.masterMixBus.connect(this.masterLimiter);

      // 2x2 Output Routing Matrix (Stereo / Mono L+R / 1-Cable Balanced Safe L-Only)
      const outSplitter = this.audioCtx.createChannelSplitter(2);
      const outMerger = this.audioCtx.createChannelMerger(2);
      const matLL = this.audioCtx.createGain();
      const matRL = this.audioCtx.createGain();
      const matLR = this.audioCtx.createGain();
      const matRR = this.audioCtx.createGain();

      this.masterLimiter.connect(outSplitter);
      outSplitter.connect(matLL, 0);
      outSplitter.connect(matRL, 1);
      outSplitter.connect(matLR, 0);
      outSplitter.connect(matRR, 1);
      matLL.connect(outMerger, 0, 0);
      matRL.connect(outMerger, 0, 0);
      matLR.connect(outMerger, 0, 1);
      matRR.connect(outMerger, 0, 1);

      this.outMatrix = { matLL, matRL, matLR, matRR };
      this.applyOutputMode(0);

      outMerger.connect(this.audioCtx.destination);

      const vuSplitter = this.audioCtx.createChannelSplitter(2);
      this.analyserL = this.audioCtx.createAnalyser();
      this.analyserR = this.audioCtx.createAnalyser();
      this.analyserL.fftSize = 256;
      this.analyserR.fftSize = 256;
      this.analyserL.smoothingTimeConstant = 0.5;
      this.analyserR.smoothingTimeConstant = 0.5;
      this.analyserBufL = new Float32Array(this.analyserL.fftSize);
      this.analyserBufR = new Float32Array(this.analyserR.fftSize);

      outMerger.connect(vuSplitter);
      vuSplitter.connect(this.analyserL, 0);
      vuSplitter.connect(this.analyserR, 1);

      this.masterSeGain = this.audioCtx.createGain();
      this.masterSeGain.gain.value = this.state.masterVol / 100;
      this.masterSeGain.connect(this.masterMixBus);

      this.masterBgmGain = this.audioCtx.createGain();
      this.masterBgmGain.gain.value = this.getEffectiveBgmMasterGain();
      this.masterBgmGain.connect(this.masterMixBus);

      // Auto-recover if iPadOS marks AudioContext as interrupted/suspended during playback
      this.audioCtx.onstatechange = () => {
        const anyPlaying = this.activePadVoices.size > 0 || this.bgmPlayer.isPlaying;
        if (anyPlaying && this.audioCtx && (this.audioCtx.state === 'suspended' || this.audioCtx.state === 'interrupted')) {
          this.audioCtx.resume().catch(() => {});
        }
      };

      // Play a 1-sample silent buffer immediately to wake up iPadOS hardware audio with zero lag
      try {
        const silentBuf = this.audioCtx.createBuffer(1, 1, 22050);
        const src = this.audioCtx.createBufferSource();
        src.buffer = silentBuf;
        src.connect(this.audioCtx.destination);
        src.start(0);
      } catch (_) { }

      this.initBackgroundAudioKeepAlive();
    }
    if (this.audioCtx.state === 'suspended' || this.audioCtx.state === 'interrupted') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  /**
   * Creates an inaudible (-90dBFS) DOM HTML5 <audio loop> bridge so iPadOS keeps
   * Web Audio API (AudioContext) and BGM playlist transitions running even when
   * switching to another app (background) or locking the screen.
   */
  initBackgroundAudioKeepAlive() {
    if (this.bgKeepAliveAudio) return;
    try {
      const sr = 8000;
      const numSamples = sr; // 1.0 second loop
      const buf = new ArrayBuffer(44 + numSamples * 2);
      const view = new DataView(buf);
      const writeStr = (off, s) => {
        for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
      };
      writeStr(0, 'RIFF');
      view.setUint32(4, 36 + numSamples * 2, true);
      writeStr(8, 'WAVEfmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, sr, true);
      view.setUint32(28, sr * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      writeStr(36, 'data');
      view.setUint32(40, numSamples * 2, true);
      // 1-LSB (-90dBFS) alternating value prevents iOS from optimizing away pure-zero streams
      for (let i = 0; i < numSamples; i++) {
        view.setInt16(44 + i * 2, (i & 1) ? 1 : -1, true);
      }

      const b64 = this.arrayBufferToBase64(buf);
      const audio = document.createElement('audio');
      audio.src = `data:audio/wav;base64,${b64}`;
      audio.loop = true;
      audio.volume = 1.0; // WAV itself is -90dBFS inaudible; full element volume prevents iOS muting
      audio.setAttribute('playsinline', 'true');
      audio.setAttribute('webkit-playsinline', 'true');
      audio.style.display = 'none';
      document.body.appendChild(audio);

      // Use HTML5 audio timeupdate in background to drive BGM crossfades without multiplying timers
      audio.addEventListener('timeupdate', () => {
        if (this.audioCtx && (this.audioCtx.state === 'suspended' || this.audioCtx.state === 'interrupted')) {
          this.audioCtx.resume().catch(() => {});
        }
        if (document.hidden && this.bgTimerId === null && this.animFrameId === null) {
          this.runAnimationTick(performance.now());
        }
      });

      this.bgKeepAliveAudio = audio;
      this.setupMediaSessionHandlers();
    } catch (_) {}
  }

  activateBackgroundKeepAlive() {
    this.initBackgroundAudioKeepAlive();
    if (this.bgKeepAliveStopTimer) {
      clearTimeout(this.bgKeepAliveStopTimer);
      this.bgKeepAliveStopTimer = null;
    }
    if (this.bgKeepAliveAudio && this.bgKeepAliveAudio.paused) {
      this.bgKeepAliveAudio.play().catch(() => {});
    }
    this.updateMediaSessionMetadata();
  }

  scheduleStopBackgroundKeepAliveIfIdle() {
    if (this.bgKeepAliveStopTimer) clearTimeout(this.bgKeepAliveStopTimer);
    this.bgKeepAliveStopTimer = setTimeout(() => {
      this.bgKeepAliveStopTimer = null;
      const anyPlaying = this.activePadVoices.size > 0 || this.bgmPlayer.isPlaying || Boolean(this.previewVoice);
      if (!anyPlaying && this.bgKeepAliveAudio && !this.bgKeepAliveAudio.paused) {
        this.bgKeepAliveAudio.pause();
      }
    }, 2500);
  }

  setupMediaSessionHandlers() {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.setActionHandler('play', () => {
        if (!this.bgmPlayer.isPlaying) this.toggleBgmPlayPause();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        if (this.bgmPlayer.isPlaying) this.toggleBgmPlayPause();
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        const pl = this.getPlayingPlaylist();
        if (pl && pl.tracks.length > 0) {
          const xfade = this.bgmPlayer.isPlaying ? Number(this.state.bgmXfade) || 0 : 0;
          this.playBgmTrack(this.bgmPlayer.currentTrackIndex - 1, xfade, pl.id);
        }
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        const pl = this.getPlayingPlaylist();
        if (pl && pl.tracks.length > 0) {
          const xfade = this.bgmPlayer.isPlaying ? Number(this.state.bgmXfade) || 0 : 0;
          this.playBgmTrack(this.bgmPlayer.currentTrackIndex + 1, xfade, pl.id);
        }
      });
    } catch (_) {}
  }

  updateMediaSessionMetadata() {
    if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
    try {
      const pl = this.getPlayingPlaylist();
      const track = pl && pl.tracks[this.bgmPlayer.currentTrackIndex];
      const title = (this.bgmPlayer.isPlaying && track)
        ? track.name
        : 'HIKARUNG-PRO (再生中)';
      const artist = (this.bgmPlayer.isPlaying && pl) ? pl.name : 'HIKARUNG-PRO';
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist,
        album: 'HIKARUNG-PRO'
      });
      navigator.mediaSession.playbackState = (this.bgmPlayer.isPlaying || this.activePadVoices.size > 0)
        ? 'playing'
        : 'paused';
    } catch (_) {}
  }

  getDecodeContext() {
    if (this.audioCtx) return this.audioCtx;
    if (!this.offlineDecodeCtx) {
      const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      this.offlineDecodeCtx = new OfflineCtx(2, 1, 44100);
    }
    return this.offlineDecodeCtx;
  }

  getEffectiveBgmMasterGain() {
    const base = (this.state.masterVol / 100) * (this.state.bgmVol / 100);
    return this.isTalkOver ? base * 0.25 : base;
  }

  updateMasterGainsSmooth(rampSec = 0.06) {
    if (!this.audioCtx) return;
    const now = this.audioCtx.currentTime;
    this.masterSeGain.gain.cancelScheduledValues(now);
    this.masterSeGain.gain.setTargetAtTime(this.state.masterVol / 100, now, rampSec);

    this.masterBgmGain.gain.cancelScheduledValues(now);
    this.masterBgmGain.gain.setTargetAtTime(this.getEffectiveBgmMasterGain(), now, rampSec);
  }

  applyOutputMode(rampSec = 0.02) {
    if (!this.audioCtx || !this.outMatrix) return;
    const mode = this.state.outputMode || 'stereo';
    let ll = 1, rl = 0, lr = 0, rr = 1;
    if (mode === 'mono_both') {
      ll = 0.5; rl = 0.5; lr = 0.5; rr = 0.5;
    } else if (mode === 'mono_l_only') {
      // Sum L+R to mono on L channel only; R channel is 0 so balanced TRS (L - R = L_mono - 0) has zero phase cancellation
      ll = 0.5; rl = 0.5; lr = 0; rr = 0;
    }

    const now = this.audioCtx.currentTime;
    const { matLL, matRL, matLR, matRR } = this.outMatrix;
    const pairs = [[matLL, ll], [matRL, rl], [matLR, lr], [matRR, rr]];
    for (const [node, val] of pairs) {
      node.gain.cancelScheduledValues(now);
      if (rampSec > 0) {
        node.gain.setTargetAtTime(val, now, rampSec);
      } else {
        node.gain.setValueAtTime(val, now);
      }
    }
  }

  // ==================== DATA INITIALIZATION & PERSISTENCE ====================
  createDefaultPad(index) {
    return {
      id: `pad_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 6)}`,
      name: `PAD ${index + 1}`,
      audioId: null,
      color: PAD_COLORS[index % PAD_COLORS.length].id,
      triggerMode: 'poly',
      loop: false,
      key: DEFAULT_KEYS[index] || '',
      gain: 100,
      trimStart: 0,
      trimEnd: 0,
      fadeIn: 0,
      fadeOut: 2.0,
      speed: 1.0,
      pitch: 0
    };
  }

  createDefaultBank(id, name) {
    const pads = [];
    for (let i = 0; i < 24; i++) {
      pads.push(this.createDefaultPad(i));
    }
    return { id, name, pads };
  }

  async loadOrInitData() {
    await this.db.init();
    const savedState = await this.db.loadState();
    const savedAudioFiles = await this.db.getAllAudioFiles();

    if (savedState && savedState.banks && savedState.banks.length > 0) {
      this.state = Object.assign(this.state, savedState);

      // Clean up any legacy auto-generated demo references (audio_demo_*)
      let cleanedDemo = false;
      for (const bank of this.state.banks) {
        bank.pads.forEach((pad, idx) => {
          if (pad.audioId && String(pad.audioId).startsWith('audio_demo_')) {
            bank.pads[idx] = this.createDefaultPad(idx);
            cleanedDemo = true;
          }
        });
      }
      for (const pl of this.state.playlists) {
        const before = pl.tracks.length;
        pl.tracks = pl.tracks.filter((t) => !t.audioId || !String(t.audioId).startsWith('audio_demo_'));
        if (pl.tracks.length !== before) cleanedDemo = true;
      }
      if (cleanedDemo) {
        await this.saveAppState();
      }
    } else {
      // Fresh empty setup (instant startup)
      this.state.banks = [
        this.createDefaultBank('bank_1', '1. オープニング・定番SE'),
        this.createDefaultBank('bank_2', '2. トーク・企画コーナー'),
        this.createDefaultBank('bank_3', '3. クイズ・ゲーム演出'),
        this.createDefaultBank('bank_4', '4. エンディング・予備')
      ];
      this.state.currentBankId = 'bank_1';
      this.state.playlists = [
        { id: 'pl_1', name: '開場・トークBGMリスト', tracks: [] },
        { id: 'pl_2', name: '盛り上げ・企画BGMリスト', tracks: [] }
      ];
      this.state.currentPlaylistId = 'pl_1';
      await this.saveAppState();
    }

    // Render UI immediately without waiting for audio decoding
    this.renderAll();

    // Purge any legacy audio_demo_* files from IndexedDB and populate metadata immediately
    const shortFilesToPreDecode = [];
    for (const fileRec of savedAudioFiles) {
      if (String(fileRec.id).startsWith('audio_demo_')) {
        await this.db.deleteAudioFile(fileRec.id);
      } else {
        this.audioMeta.set(fileRec.id, {
          name: fileRec.name,
          duration: Number(fileRec.duration) || 0
        });
        // Only pre-decode short SE files (<30s) into RAM at startup to prevent iPadOS OOM crashes.
        // Long BGM tracks (>=30s) are lazy-decoded on demand and LRU-cached (max 3 in RAM).
        if (!fileRec.duration || fileRec.duration < 30) {
          shortFilesToPreDecode.push(fileRec);
        }
      }
    }

    // Re-render immediately so all track/pad durations from audioMeta appear right away
    this.renderAll();

    if (shortFilesToPreDecode.length > 0) {
      // Decode short files in small batches (4 at a time) to avoid memory spikes on iPad
      for (let i = 0; i < shortFilesToPreDecode.length; i += 4) {
        const batch = shortFilesToPreDecode.slice(i, i + 4);
        await Promise.all(batch.map((rec) => this.decodeAndCacheAudioRecord(rec)));
      }
      this.renderAll();
    }

    // Load initial samples in background on first run (or if v2 pack not yet loaded)
    if (!this.state.initialSamplesV2Loaded) {
      this.loadInitialSamplesInBackground();
    }
  }

  async loadInitialSamplesInBackground() {
    try {
      const embeddedMap = window.__EMBEDDED_INITIAL_SAMPLES_B64__ || {};

      // Fetch & decode all initial samples in parallel in the background
      const loadedItems = await Promise.all(
        INITIAL_SAMPLES.map(async (sample) => {
          // Skip network fetch if already decoded in memory
          if (this.audioBuffers.has(sample.id)) {
            return { sample, duration: this.audioBuffers.get(sample.id).duration, alreadySaved: true };
          }
          let arrayBuffer = null;
          if (embeddedMap[sample.file]) {
            arrayBuffer = this.base64ToArrayBuffer(embeddedMap[sample.file]);
          } else if ( sample.id === 'aud_initial_yoshi' && window.__EMBEDDED_INITIAL_SAMPLE_B64__ ) {
            arrayBuffer = this.base64ToArrayBuffer(window.__EMBEDDED_INITIAL_SAMPLE_B64__);
          } else {
            const res = await fetch(encodeURI(sample.url));
            if (!res.ok) return null;
            arrayBuffer = await res.arrayBuffer();
          }
          if (!arrayBuffer) return null;

          const record = {
            id: sample.id,
            name: sample.name,
            mimeType: sample.mimeType,
            arrayBuffer,
            duration: 0
          };
          const decoded = await this.decodeAndCacheAudioRecord(record);
          if (!decoded) return null;
          record.duration = decoded.duration;
          await this.db.saveAudioFile(record);
          return { sample, duration: decoded.duration, alreadySaved: false };
        })
      );

      const firstBank = this.state.banks[0];
      const firstPl = this.state.playlists[0];

      for (const item of loadedItems) {
        if (!item) continue;
        const { sample, duration } = item;

        // Assign to first available empty pad in Bank 1 if not already present
        if (firstBank && Array.isArray(firstBank.pads)) {
          const existsOnPad = firstBank.pads.some((p) => p.audioId === sample.id);
          if (!existsOnPad) {
            const emptyPad = firstBank.pads.find((p) => !p.audioId);
            if (emptyPad) {
              emptyPad.name = sample.name;
              emptyPad.audioId = sample.id;
              emptyPad.color = sample.color;
              emptyPad.triggerMode = sample.triggerMode || (duration >= 30 ? 'xfade' : 'poly');
              emptyPad.loop = Boolean(sample.loop);
              emptyPad.trimStart = 0;
              emptyPad.trimEnd = Number(duration.toFixed(2));
              emptyPad.gain = 100;
              emptyPad.fadeIn = 0;
              emptyPad.fadeOut = sample.fadeOut ?? 2.0;
              emptyPad.speed = 1.0;
              emptyPad.pitch = 0;
            }
          }
        }

        // Also add BGM samples to the first playlist if not already present
        if (sample.addToBgm && firstPl && Array.isArray(firstPl.tracks)) {
          const existsInPl = firstPl.tracks.some((t) => t.audioId === sample.id);
          if (!existsInPl) {
            firstPl.tracks.push({
              id: `trk_init_${sample.id}`,
              name: sample.name,
              audioId: sample.id,
              gain: 90,
              trimStart: 0,
              trimEnd: Number(duration.toFixed(2)),
              fadeIn: 0.5,
              fadeOut: 2.5,
              speed: 1.0,
              pitch: 0
            });
          }
        }
      }

      this.state.initialSampleLoaded = true;
      this.state.initialSamplesV2Loaded = true;
      await this.saveAppState();
      this.renderAll();
    } catch (err) {
      console.warn('Initial samples background load warning:', err);
    }
  }

  isAudioIdCurrentlyProtected(audioId) {
    if (this.bgmPlayer.activeNode && this.bgmPlayer.activeNode.track?.audioId === audioId) return true;
    for (const fn of this.bgmPlayer.fadingNodes) {
      if (fn.track?.audioId === audioId) return true;
    }
    if (this.editorDraft && this.editorDraft.audioId === audioId && !document.getElementById('editorModal').classList.contains('hidden')) {
      return true;
    }
    for (const bank of this.state.banks) {
      for (const pad of bank.pads) {
        if (pad.audioId === audioId && this.activePadVoices.has(pad.id)) return true;
      }
    }
    return false;
  }

  touchLongBufferLRU(audioId, duration) {
    if (!duration || duration < 30) return;
    this.longBufferOrder = this.longBufferOrder.filter((id) => id !== audioId);
    this.longBufferOrder.push(audioId);
  }

  evictLongBuffersIfNeeded(keepIds = [], maxLongInRam = 3) {
    const keepSet = new Set(keepIds);
    while (this.longBufferOrder.length > maxLongInRam) {
      const candidateIdx = this.longBufferOrder.findIndex(
        (id) => !keepSet.has(id) && !this.isAudioIdCurrentlyProtected(id)
      );
      if (candidateIdx === -1) break;
      const [evictId] = this.longBufferOrder.splice(candidateIdx, 1);
      this.audioBuffers.delete(evictId);
    }
  }

  async getOrDecodeAudioBuffer(audioId) {
    if (!audioId) return null;
    if (this.audioBuffers.has(audioId)) {
      const existing = this.audioBuffers.get(audioId);
      this.touchLongBufferLRU(audioId, existing.duration);
      return existing;
    }
    if (this.pendingDecodes.has(audioId)) {
      return await this.pendingDecodes.get(audioId);
    }
    const p = (async () => {
      try {
        const rec = await this.db.getAudioFile(audioId);
        if (!rec) return null;
        return await this.decodeAndCacheAudioRecord(rec, true);
      } finally {
        this.pendingDecodes.delete(audioId);
      }
    })();
    this.pendingDecodes.set(audioId, p);
    return await p;
  }

  async gcOrphanAudioFiles() {
    try {
      const referenced = new Set();
      for (const bank of this.state.banks) {
        for (const pad of bank.pads) {
          if (pad.audioId) referenced.add(pad.audioId);
        }
      }
      for (const pl of this.state.playlists) {
        for (const trk of pl.tracks) {
          if (trk.audioId) referenced.add(trk.audioId);
        }
      }
      if (this.editorDraft && this.editorDraft.audioId) {
        referenced.add(this.editorDraft.audioId);
      }

      const allRecords = await this.db.getAllAudioFiles();
      for (const rec of allRecords) {
        if (!referenced.has(rec.id)) {
          await this.db.deleteAudioFile(rec.id);
          this.audioBuffers.delete(rec.id);
          this.audioMeta.delete(rec.id);
          this.longBufferOrder = this.longBufferOrder.filter((id) => id !== rec.id);
        }
      }
    } catch (_) {}
  }

  saveAppStateDebounced() {
    if (this.saveStateDebounceTimer) clearTimeout(this.saveStateDebounceTimer);
    this.saveStateDebounceTimer = setTimeout(() => {
      this.saveStateDebounceTimer = null;
      this.saveAppState();
    }, 250);
  }

  async decodeAndCacheAudioRecord(fileRec, keepInRam = true) {
    try {
      const ctx = this.getDecodeContext();
      const bufferCopy = fileRec.arrayBuffer.slice(0);
      const audioBuffer = await ctx.decodeAudioData(bufferCopy);
      this.audioMeta.set(fileRec.id, {
        name: fileRec.name,
        duration: audioBuffer.duration
      });
      if (keepInRam || audioBuffer.duration < 30) {
        this.audioBuffers.set(fileRec.id, audioBuffer);
        this.touchLongBufferLRU(fileRec.id, audioBuffer.duration);
        this.evictLongBuffersIfNeeded([fileRec.id], 3);
      }
      return audioBuffer;
    } catch (err) {
      console.warn('Audio decode warning:', err);
      return null;
    }
  }

  async saveAppState() {
    await this.db.saveState(this.state);
  }

  // ==================== GETTERS & POSITION-BASED KEYS ====================
  getCurrentBank() {
    return this.state.banks.find((b) => b.id === this.state.currentBankId) || this.state.banks[0];
  }

  getCurrentPlaylist() {
    return this.state.playlists.find((p) => p.id === this.state.currentPlaylistId) || this.state.playlists[0];
  }

  getPlayingPlaylist() {
    if (this.bgmPlayer.playingPlaylistId) {
      const found = this.state.playlists.find((p) => p.id === this.bgmPlayer.playingPlaylistId);
      if (found) return found;
    }
    return this.getCurrentPlaylist();
  }

  getVisiblePadCount() {
    const [cols, rows] = this.state.gridSize.split('x').map(Number);
    return cols * rows;
  }

  getDefaultKeyForSlot(slotIndex, gridSize = this.state.gridSize) {
    const [cols] = gridSize.split('x').map(Number);
    const row = Math.floor(slotIndex / cols);
    const col = slotIndex % cols;
    return (KEYBOARD_ROWS[row] && KEYBOARD_ROWS[row][col]) ? KEYBOARD_ROWS[row][col] : '';
  }

  getSlotKey(slotIndex) {
    const g = this.state.gridSize;
    const customMap = this.state.slotKeys && this.state.slotKeys[g];
    if (customMap && Object.prototype.hasOwnProperty.call(customMap, slotIndex)) {
      return customMap[slotIndex];
    }
    return this.getDefaultKeyForSlot(slotIndex, g);
  }

  setSlotKey(slotIndex, keyChar) {
    const g = this.state.gridSize;
    if (!this.state.slotKeys) this.state.slotKeys = {};
    if (!this.state.slotKeys[g]) this.state.slotKeys[g] = {};
    this.state.slotKeys[g][slotIndex] = String(keyChar || '').trim().toUpperCase();
  }

  hasNonFadingPadVoice(padId) {
    const set = this.activePadVoices.get(padId);
    if (!set || set.size === 0) return false;
    for (const v of set) {
      if (!v.isFadingOut) return true;
    }
    return false;
  }

  // ==================== SAMPLER PAD AUDIO ENGINE ====================
  async triggerPad(padIndex) {
    this.ensureAudioContext();
    const bank = this.getCurrentBank();
    if (!bank) return;
    const pad = bank.pads[padIndex];
    if (!pad || !pad.audioId) {
      // Only open editor on empty pad in EDIT mode (LIVE mode prevents accidental popups)
      if (this.isEditMode) {
        this.openEditorForPad(padIndex);
      }
      return;
    }

    // Unlock HTML5 background audio synchronously inside the user gesture BEFORE any await
    this.activateBackgroundKeepAlive();

    const mode = pad.triggerMode || 'poly';
    const seq = (this.padTriggerSeq.get(pad.id) || 0) + 1;
    this.padTriggerSeq.set(pad.id, seq);

    let buffer = this.audioBuffers.get(pad.audioId);
    if (!buffer) {
      buffer = await this.getOrDecodeAudioBuffer(pad.audioId);
      if (!buffer) {
        this.showToast('音源データを読み込めませんでした');
        return;
      }
      // Abort if another trigger/PANIC occurred or GATE finger was released while decoding
      if (this.padTriggerSeq.get(pad.id) !== seq) return;
      if (mode === 'gate' && !this.gatePressedPads.has(pad.id)) return;
    }

    const fadeOutSec = safeNum(pad.fadeOut, 2.0);

    if (mode === 'retrig') {
      this.stopPadVoices(pad.id, 0.03);
    } else if (mode === 'mono') {
      if (this.hasNonFadingPadVoice(pad.id)) {
        this.stopPadVoices(pad.id, 0.05);
        return;
      }
      this.stopPadsByMode('mono', 0.05);
      // MONO連動: If BGM Playlist is linked to MONO group, stop/fade BGM deck
      if (this.bgmPlayer.isPlaying && this.state.bgmMonoLink && this.state.bgmMonoLink !== 'off') {
        if (this.state.bgmMonoLink === 'fade') {
          this.fadeStopBgm(safeNum(this.state.bgmXfade, 2.0));
        } else {
          this.stopBgmImmediately();
        }
      }
    } else if (mode === 'xfade') {
      if (this.hasNonFadingPadVoice(pad.id)) {
        this.stopPadVoices(pad.id, Math.max(0.05, fadeOutSec));
        return;
      }
      this.stopPadsByMode('xfade', Math.max(0.05, fadeOutSec));
    }

    this.startPadVoice(pad, buffer);
  }

  startPadVoice(pad, buffer) {
    const ctx = this.ensureAudioContext();
    const now = ctx.currentTime;

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const speed = Math.max(0.25, Math.min(3.0, safeNum(pad.speed, 1.0)));
    const pitchSemi = safeNum(pad.pitch, 0);
    source.playbackRate.value = speed;
    if ('detune' in source) {
      source.detune.value = pitchSemi * 100;
    }
    const effectiveRate = speed * Math.pow(2, pitchSemi / 12);

    const trimStart = Math.max(0, Math.min(buffer.duration - 0.01, safeNum(pad.trimStart, 0)));
    const rawEnd = safeNum(pad.trimEnd, buffer.duration);
    const trimEnd = (rawEnd > trimStart && rawEnd <= buffer.duration) ? rawEnd : buffer.duration;
    const regionDur = Math.max(0.02, trimEnd - trimStart);
    const playWallDuration = regionDur / effectiveRate;

    const voiceGain = ctx.createGain();
    const targetGain = Math.max(0, safeNum(pad.gain, 100) / 100);
    const configuredFadeIn = Math.max(0, safeNum(pad.fadeIn, 0));
    const configuredFadeOut = Math.max(0, safeNum(pad.fadeOut, 2.0));

    const fadeInSec = (pad.triggerMode === 'xfade' && configuredFadeIn < 0.05)
      ? Math.min(2.0, Math.max(0.3, configuredFadeOut))
      : configuredFadeIn;

    if (fadeInSec > 0.02) {
      voiceGain.gain.setValueAtTime(0.0001, now);
      voiceGain.gain.linearRampToValueAtTime(targetGain, now + Math.min(fadeInSec, playWallDuration));
    } else {
      voiceGain.gain.setValueAtTime(targetGain, now);
    }

    source.connect(voiceGain);
    voiceGain.connect(this.masterSeGain);

    const isLoop = Boolean(pad.loop);
    if (isLoop) {
      source.loop = true;
      source.loopStart = trimStart;
      source.loopEnd = trimEnd;
      source.start(now, trimStart);
    } else {
      if (configuredFadeOut > 0.05 && playWallDuration > configuredFadeOut * 1.6 && pad.triggerMode === 'xfade') {
        const fadeStartWall = now + playWallDuration - configuredFadeOut;
        voiceGain.gain.setValueAtTime(targetGain, fadeStartWall);
        voiceGain.gain.linearRampToValueAtTime(0.0001, now + playWallDuration);
      }
      // Web Audio spec: 3rd arg duration is wall-clock AudioContext seconds
      source.start(now, trimStart, playWallDuration);
    }

    const voiceObj = {
      padId: pad.id,
      triggerMode: pad.triggerMode || 'poly',
      source,
      gainNode: voiceGain,
      startedAt: now,
      trimStart,
      trimEnd,
      regionDur,
      effectiveRate,
      playWallDuration,
      isLoop,
      isFadingOut: false
    };

    if (!this.activePadVoices.has(pad.id)) {
      this.activePadVoices.set(pad.id, new Set());
    }
    this.activePadVoices.get(pad.id).add(voiceObj);

    source.onended = () => {
      const set = this.activePadVoices.get(pad.id);
      if (set) {
        set.delete(voiceObj);
        if (set.size === 0) this.activePadVoices.delete(pad.id);
      }
      try {
        voiceGain.disconnect();
      } catch (_) { }
      this.updatePadVisualState(pad.id);
    };

    this.updatePadVisualState(pad.id);
    this.activateBackgroundKeepAlive();
    this.wakeAnimationLoop();
  }

  stopPadVoices(padId, fadeSec = 0.04) {
    const set = this.activePadVoices.get(padId);
    if (!set || set.size === 0) return;
    const ctx = this.ensureAudioContext();
    const now = ctx.currentTime;

    for (const v of set) {
      if (v.isFadingOut && fadeSec > 0.1) continue;
      v.isFadingOut = true;
      try {
        v.gainNode.gain.cancelScheduledValues(now);
        v.gainNode.gain.setValueAtTime(Math.max(0.0001, v.gainNode.gain.value), now);
        v.gainNode.gain.linearRampToValueAtTime(0.0001, now + Math.max(0.02, fadeSec));
        v.source.stop(now + Math.max(0.025, fadeSec + 0.01));
      } catch (_) { }
    }
  }

  stopPadsByMode(modeName, fadeSec = 0.05) {
    for (const [padId, set] of this.activePadVoices.entries()) {
      for (const v of set) {
        if (v.triggerMode === modeName) {
          this.stopPadVoices(padId, fadeSec);
          break;
        }
      }
    }
  }

  fadeOutAllEverything(fadeSec) {
    for (const padId of this.activePadVoices.keys()) {
      this.stopPadVoices(padId, fadeSec);
    }
    if (this.bgmPlayer.isPlaying) {
      this.fadeStopBgm(fadeSec);
    }
    this.showToast(`全音源を ${fadeSec}秒 でフェードアウト中...`);
  }

  panicStopAll() {
    this.bgmPlaySeq++;
    this.gatePressedPads.clear();
    for (const padId of this.padTriggerSeq.keys()) {
      this.padTriggerSeq.set(padId, (this.padTriggerSeq.get(padId) || 0) + 1);
    }
    for (const padId of this.activePadVoices.keys()) {
      this.stopPadVoices(padId, 0.02);
    }
    this.stopBgmImmediately();
    this.stopEditorPreview();
    this.stopLibraryPreview();
    this.showToast('🛑 すべての音声を即時停止しました');
  }

  // ==================== BGM PLAYLIST DECK ENGINE ====================
  applyBgmMonoLinkStopPads() {
    if (!this.state.bgmMonoLink || this.state.bgmMonoLink === 'off') return;
    const fadeSec = this.state.bgmMonoLink === 'fade' ? Math.max(0.05, safeNum(this.state.bgmXfade, 2.0)) : 0.05;
    this.stopPadsByMode('mono', fadeSec);
  }

  async playBgmTrack(index, crossfadeSec = 0, targetPlaylistId = null) {
    this.ensureAudioContext();
    // Unlock HTML5 background audio synchronously inside user gesture BEFORE await
    this.activateBackgroundKeepAlive();

    const seq = ++this.bgmPlaySeq;
    const resolvedPlId = targetPlaylistId || this.bgmPlayer.playingPlaylistId || this.state.currentPlaylistId;
    const pl = this.state.playlists.find((p) => p.id === resolvedPlId) || this.getCurrentPlaylist();
    if (!pl || pl.tracks.length === 0) {
      this.showToast('プレイリストに曲がありません。「＋音源ファイル追加」から追加してください');
      return;
    }

    const safeIndex = ((index % pl.tracks.length) + pl.tracks.length) % pl.tracks.length;
    const track = pl.tracks[safeIndex];
    const buffer = await this.getOrDecodeAudioBuffer(track.audioId);

    // Abort if stopped, panicked, or another track was requested while decoding
    if (seq !== this.bgmPlaySeq) return;

    if (!buffer) {
      this.bgmPlayer.isPlaying = false;
      this.renderBgmTrackList();
      this.updateBgmTransportUI();
      this.showToast('BGM音源データを読み込めませんでした');
      return;
    }

    if (this.bgmPlayer.activeNode) {
      this.retireActiveBgmNode(crossfadeSec);
    }

    // MONO連動: stop/fade any active MONO pads when BGM starts
    this.applyBgmMonoLinkStopPads();

    this.bgmPlayer.playingPlaylistId = pl.id;
    this.bgmPlayer.currentTrackIndex = safeIndex;
    this.bgmPlayer.pausedAtOffset = 0;
    this.bgmPrefetchedId = null;
    this.startBgmNodeFromOffset(track, buffer, 0, crossfadeSec);
    this.renderBgmTrackList();
  }

  startBgmNodeFromOffset(track, buffer, offsetInTrimmedRegion = 0, fadeInOverrideSec = 0) {
    const ctx = this.ensureAudioContext();
    const now = ctx.currentTime;

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const speed = Math.max(0.25, Math.min(3.0, safeNum(track.speed, 1.0)));
    const pitchSemi = safeNum(track.pitch, 0);
    source.playbackRate.value = speed;
    if ('detune' in source) {
      source.detune.value = pitchSemi * 100;
    }
    const effectiveRate = speed * Math.pow(2, pitchSemi / 12);

    const trimStart = Math.max(0, Math.min(buffer.duration - 0.02, safeNum(track.trimStart, 0)));
    const rawEnd = safeNum(track.trimEnd, buffer.duration);
    const trimEnd = (rawEnd > trimStart && rawEnd <= buffer.duration) ? rawEnd : buffer.duration;
    const regionDur = Math.max(0.05, trimEnd - trimStart);
    const startBufferPos = Math.min(trimEnd - 0.02, trimStart + offsetInTrimmedRegion);
    const remainBufferDur = Math.max(0.02, trimEnd - startBufferPos);
    const remainWallDur = remainBufferDur / effectiveRate;

    const gainNode = ctx.createGain();
    const targetGain = Math.max(0, safeNum(track.gain, 100) / 100);
    const fadeSec = Math.max(safeNum(fadeInOverrideSec, 0), safeNum(track.fadeIn, 0));

    if (fadeSec > 0.03) {
      gainNode.gain.setValueAtTime(0.0001, now);
      gainNode.gain.linearRampToValueAtTime(targetGain, now + Math.min(fadeSec, remainWallDur));
    } else {
      gainNode.gain.setValueAtTime(targetGain, now);
    }

    source.connect(gainNode);
    gainNode.connect(this.masterBgmGain);

    // Web Audio spec: 3rd arg duration is wall-clock AudioContext seconds
    source.start(now, startBufferPos, remainWallDur);

    const nodeObj = {
      source,
      gainNode,
      track,
      trimStart,
      trimEnd,
      regionDur,
      effectiveRate,
      startedAtCtxTime: now,
      initialRegionOffset: offsetInTrimmedRegion,
      retired: false
    };

    this.bgmPlayer.activeNode = nodeObj;
    this.bgmPlayer.isPlaying = true;
    this.bgmPlayer.isCrossfadingNext = false;

    source.onended = () => {
      if (this.bgmPlayer.activeNode === nodeObj && !nodeObj.retired) {
        this.bgmPlayer.activeNode = null;
        this.onBgmTrackNaturalEnd();
      }
      this.bgmPlayer.fadingNodes.delete(nodeObj);
      try {
        gainNode.disconnect();
      } catch (_) { }
    };

    this.updateBgmTransportUI();
    this.activateBackgroundKeepAlive();
    this.wakeAnimationLoop();
  }

  retireActiveBgmNode(fadeSec = 0.05) {
    const node = this.bgmPlayer.activeNode;
    if (!node) return;
    node.retired = true;
    this.bgmPlayer.activeNode = null;
    this.bgmPlayer.fadingNodes.add(node);

    const ctx = this.ensureAudioContext();
    const now = ctx.currentTime;
    try {
      node.gainNode.gain.cancelScheduledValues(now);
      node.gainNode.gain.setValueAtTime(Math.max(0.0001, node.gainNode.gain.value), now);
      node.gainNode.gain.linearRampToValueAtTime(0.0001, now + Math.max(0.02, fadeSec));
      node.source.stop(now + Math.max(0.03, fadeSec + 0.01));
    } catch (_) { }
  }

  async toggleBgmPlayPause() {
    this.ensureAudioContext();

    if (this.bgmPlayer.isPlaying && this.bgmPlayer.activeNode) {
      this.bgmPlaySeq++;
      const node = this.bgmPlayer.activeNode;
      const elapsedWall = this.audioCtx.currentTime - node.startedAtCtxTime;
      const elapsedRegion = node.initialRegionOffset + elapsedWall * node.effectiveRate;
      this.bgmPlayer.pausedAtOffset = Math.min(node.regionDur - 0.05, Math.max(0, elapsedRegion));
      this.retireActiveBgmNode(0.04);
      this.bgmPlayer.isPlaying = false;
      this.renderBgmTrackList();
      this.updateBgmTransportUI();
      return;
    }

    // Unlock HTML5 background audio synchronously inside user gesture BEFORE await
    this.activateBackgroundKeepAlive();
    const seq = ++this.bgmPlaySeq;

    // Resume paused track in playingPlaylist, or start current viewed playlist if none paused
    let pl = this.getPlayingPlaylist();
    if (!this.bgmPlayer.pausedAtOffset || !pl || pl.tracks.length === 0) {
      this.bgmPlayer.playingPlaylistId = this.state.currentPlaylistId;
      this.bgmPlayer.currentTrackIndex = 0;
      pl = this.getCurrentPlaylist();
    }
    if (!pl || pl.tracks.length === 0) {
      this.showToast('プレイリストに音源を追加してください');
      return;
    }

    const idx = Math.min(this.bgmPlayer.currentTrackIndex, pl.tracks.length - 1);
    const track = pl.tracks[idx];
    const buffer = await this.getOrDecodeAudioBuffer(track.audioId);
    if (seq !== this.bgmPlaySeq) return;
    if (!buffer) return;
    this.applyBgmMonoLinkStopPads();
    this.bgmPlayer.playingPlaylistId = pl.id;
    this.bgmPlayer.currentTrackIndex = idx;
    this.startBgmNodeFromOffset(track, buffer, this.bgmPlayer.pausedAtOffset || 0, 0.05);
    this.renderBgmTrackList();
  }

  fadeStopBgm(fadeSecOverride = null) {
    this.bgmPlaySeq++;
    const fadeSec = fadeSecOverride !== null ? safeNum(fadeSecOverride, 2.5) : safeNum(this.state.bgmXfade, 2.5);
    this.bgmPlayer.pausedAtOffset = 0;
    this.bgmPlayer.isPlaying = false;
    this.bgmPlayer.isCrossfadingNext = false;
    this.retireActiveBgmNode(Math.max(0.04, fadeSec));
    this.renderBgmTrackList();
    this.updateBgmTransportUI();
  }

  stopBgmImmediately() {
    this.bgmPlaySeq++;
    this.bgmPlayer.pausedAtOffset = 0;
    this.bgmPlayer.isPlaying = false;
    this.bgmPlayer.isCrossfadingNext = false;
    this.retireActiveBgmNode(0.02);
    for (const fn of this.bgmPlayer.fadingNodes) {
      try { fn.source.stop(); } catch (_) { }
    }
    this.bgmPlayer.fadingNodes.clear();
    this.renderBgmTrackList();
    this.updateBgmTransportUI();
  }

  onBgmTrackNaturalEnd() {
    if (!this.bgmPlayer.isPlaying || this.bgmPlayer.isCrossfadingNext) return;
    this.advanceBgmTrack(0.05);
  }

  advanceBgmTrack(crossfadeSec = 0) {
    const pl = this.getPlayingPlaylist();
    if (!pl || pl.tracks.length === 0) {
      this.bgmPlayer.isPlaying = false;
      this.renderBgmTrackList();
      this.updateBgmTransportUI();
      return;
    }

    const mode = this.state.bgmMode || 'all_loop';
    const cur = this.bgmPlayer.currentTrackIndex;

    if (mode === 'single') {
      this.bgmPlayer.isPlaying = false;
      this.bgmPlayer.pausedAtOffset = 0;
      this.renderBgmTrackList();
      this.updateBgmTransportUI();
      return;
    }

    if (mode === 'one_loop') {
      this.playBgmTrack(cur, crossfadeSec, pl.id);
      return;
    }

    if (mode === 'shuffle') {
      let nextIdx = Math.floor(Math.random() * pl.tracks.length);
      if (pl.tracks.length > 1 && nextIdx === cur) {
        nextIdx = (cur + 1) % pl.tracks.length;
      }
      this.playBgmTrack(nextIdx, crossfadeSec, pl.id);
      return;
    }

    if (mode === 'sequence') {
      if (cur + 1 >= pl.tracks.length) {
        this.bgmPlayer.isPlaying = false;
        this.bgmPlayer.pausedAtOffset = 0;
        this.renderBgmTrackList();
        this.updateBgmTransportUI();
        return;
      }
      this.playBgmTrack(cur + 1, crossfadeSec, pl.id);
      return;
    }

    this.playBgmTrack((cur + 1) % pl.tracks.length, crossfadeSec, pl.id);
  }

  getBgmTrackTiming(track, ratio = null) {
    if (!track || !track.audioId) return null;
    const buffer = this.audioBuffers.get(track.audioId) || null;
    const meta = this.audioMeta.get(track.audioId);
    const totalDuration = buffer ? buffer.duration : (meta ? Number(meta.duration) : 0);
    if (!totalDuration || totalDuration <= 0) return null;

    const speed = Math.max(0.25, Math.min(3.0, Number(track.speed) || 1.0));
    const pitchSemi = Number(track.pitch) || 0;
    const effectiveRate = speed * Math.pow(2, pitchSemi / 12);

    const trimStart = Math.max(0, Math.min(totalDuration - 0.02, Number(track.trimStart) || 0));
    const trimEnd = (Number(track.trimEnd) > trimStart && Number(track.trimEnd) <= totalDuration)
      ? Number(track.trimEnd)
      : totalDuration;
    const regionDur = Math.max(0.05, trimEnd - trimStart);
    const clampedRatio = ratio !== null
      ? Math.max(0, Math.min(1, ratio))
      : Math.max(0, Math.min(1, (this.bgmPlayer.pausedAtOffset || 0) / regionDur));

    const targetOffset = Math.max(0, Math.min(regionDur - 0.02, regionDur * clampedRatio));
    const totalWall = regionDur / effectiveRate;
    const curWall = targetOffset / effectiveRate;
    const remainWall = Math.max(0, totalWall - curWall);

    return { buffer, regionDur, effectiveRate, targetOffset, totalWall, curWall, remainWall, clampedRatio };
  }

  previewSeekBgmByRatio(ratio, showTenths = true) {
    const pl = this.getPlayingPlaylist();
    if (!pl || pl.tracks.length === 0) return;
    const track = pl.tracks[this.bgmPlayer.currentTrackIndex];
    const info = this.getBgmTrackTiming(track, ratio);
    if (!info) return;

    this.bgmPlayer.pausedAtOffset = info.targetOffset;
    const timeLabel = document.getElementById('bgmNowTime');
    if (timeLabel) {
      timeLabel.textContent = `${this.formatSeconds(info.curWall, showTenths)} / -${this.formatSeconds(info.remainWall, showTenths)}`;
    }
  }

  async seekBgmToRatio(ratio) {
    const pl = this.getPlayingPlaylist();
    if (!pl || pl.tracks.length === 0) return;
    const track = pl.tracks[this.bgmPlayer.currentTrackIndex];
    const info = this.getBgmTrackTiming(track, ratio);
    if (!info) return;

    this.bgmPlayer.pausedAtOffset = info.targetOffset;
    const timeLabel = document.getElementById('bgmNowTime');
    if (timeLabel) {
      timeLabel.textContent = `${this.formatSeconds(info.curWall, false)} / -${this.formatSeconds(info.remainWall, false)}`;
    }

    if (this.bgmPlayer.isPlaying) {
      const seq = ++this.bgmPlaySeq;
      const buf = info.buffer || await this.getOrDecodeAudioBuffer(track.audioId);
      if (seq !== this.bgmPlaySeq || !buf) return;
      this.retireActiveBgmNode(0.025);
      this.startBgmNodeFromOffset(track, buf, info.targetOffset, 0.025);
    }
  }

  // ==================== POWER-SAVING ON-DEMAND ANIMATION LOOP ====================
  startAnimationLoop() {
    document.addEventListener('visibilitychange', () => {
      if (!this.audioCtx) return;
      const anyPlaying = this.activePadVoices.size > 0 || this.bgmPlayer.isPlaying || Boolean(this.previewVoice);
      if (document.hidden && !anyPlaying && this.audioCtx.state === 'running') {
        this.audioCtx.suspend().catch(() => {});
      } else if (anyPlaying && (this.audioCtx.state === 'suspended' || this.audioCtx.state === 'interrupted')) {
        this.audioCtx.resume().catch(() => {});
      } else if (!document.hidden) {
        if (this.audioCtx.state === 'suspended' || this.audioCtx.state === 'interrupted') {
          this.audioCtx.resume().catch(() => {});
        }
        this.wakeAnimationLoop();
      }
    });
    this.wakeAnimationLoop();
  }

  wakeAnimationLoop() {
    if (this.animFrameId !== null || this.bgTimerId !== null) return;
    const step = (nowMs) => {
      this.animFrameId = null;
      this.bgTimerId = null;
      this.runAnimationTick(nowMs || performance.now());
    };
    this.animFrameId = requestAnimationFrame(step);
  }

  runAnimationTick(nowMs) {
    // Always clear any pending timers first so timer chains can NEVER multiply
    if (this.bgTimerId !== null) {
      clearTimeout(this.bgTimerId);
      this.bgTimerId = null;
    }
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    const hasPads = this.activePadVoices.size > 0;
    const hasBgm = Boolean(this.bgmPlayer.isPlaying && this.bgmPlayer.activeNode);
    const hasPreview = Boolean(this.previewVoice && !document.getElementById('editorModal').classList.contains('hidden'));

    // COMPLETE IDLE SLEEP: 0% CPU/GPU usage when no sound is playing
    if (!hasPads && !hasBgm && !hasPreview) {
      this.scheduleStopBackgroundKeepAliveIfIdle();
      if (!this.vuState.isIdleDrawn) {
        this.drawVuMeter(false);
      }
      return;
    }

    // Throttle interval: 55ms (~18fps) when foregrounded (smooth VU meter + pad countdown), 250ms when backgrounded
    const minIntervalMs = document.hidden ? 250 : 55;

    if (this.audioCtx && (nowMs - this.lastAnimTickMs >= minIntervalMs)) {
      this.lastAnimTickMs = nowMs;
      const now = this.audioCtx.currentTime;

      // 1. Update active SE Pads using cached DOM elements (zero querySelector calls)
      if (hasPads && !document.hidden) {
        for (const [padId, voices] of this.activePadVoices.entries()) {
          if (!voices || voices.size === 0) continue;
          const cached = this.padDomCache.get(padId);
          if (!cached) continue;

          let latest = null;
          for (const v of voices) latest = v;
          if (!latest) continue;

          const elapsedWall = now - latest.startedAt;
          let progress = 0;
          let remainWall = 0;
          if (latest.isLoop) {
            const cycleWall = latest.playWallDuration;
            const inCycle = elapsedWall % cycleWall;
            progress = (inCycle / cycleWall) * 100;
            remainWall = cycleWall - inCycle;
          } else {
            progress = Math.min(100, (elapsedWall / latest.playWallDuration) * 100);
            remainWall = Math.max(0, latest.playWallDuration - elapsedWall);
          }

          const widthStr = `${progress.toFixed(1)}%`;
          if (cached.bar && cached.bar._lastW !== widthStr) {
            cached.bar._lastW = widthStr;
            cached.bar.style.width = widthStr;
          }
          const timeStr = `-${this.formatSeconds(remainWall, true)}`;
          if (cached.timeEl && cached.timeEl._lastT !== timeStr) {
            cached.timeEl._lastT = timeStr;
            cached.timeEl.textContent = timeStr;
          }
        }
      }

      // 2. Update BGM Now Playing, Prefetch Next Track & Auto-Crossfade check
      if (hasBgm) {
        const node = this.bgmPlayer.activeNode;
        const elapsedWall = now - node.startedAtCtxTime;
        const curRegionOffset = Math.min(node.regionDur, node.initialRegionOffset + elapsedWall * node.effectiveRate);
        const totalWall = node.regionDur / node.effectiveRate;
        const curWall = curRegionOffset / node.effectiveRate;
        const remainWall = Math.max(0, totalWall - curWall);

        if (!this.bgmPlayer.isSeeking && !document.hidden) {
          const timeLabel = document.getElementById('bgmNowTime');
          if (timeLabel) {
            const newTimeText = `${this.formatSeconds(curWall, false)} / -${this.formatSeconds(remainWall, false)}`;
            if (timeLabel._lastT !== newTimeText) {
              timeLabel._lastT = newTimeText;
              timeLabel.textContent = newTimeText;
            }
          }

          const seekSlider = document.getElementById('sliderBgmSeek');
          if (seekSlider) {
            const newVal = String(Math.round((curRegionOffset / node.regionDur) * 1000));
            if (seekSlider._lastV !== newVal) {
              seekSlider._lastV = newVal;
              seekSlider.value = newVal;
            }
          }
        }

        const pl = this.getPlayingPlaylist();
        const mode = this.state.bgmMode || 'all_loop';
        const isLastOfSequence = mode === 'sequence' && pl && (this.bgmPlayer.currentTrackIndex + 1 >= pl.tracks.length);
        const xfadeSec = Math.max(0, safeNum(this.state.bgmXfade, 0));

        // Prefetch next track ~10s before crossfade so transitions are gapless
        if (pl && pl.tracks.length > 1 && mode !== 'single' && !isLastOfSequence && remainWall <= xfadeSec + 10) {
          const nextIdx = (this.bgmPlayer.currentTrackIndex + 1) % pl.tracks.length;
          const nextTrk = pl.tracks[nextIdx];
          if (nextTrk && nextTrk.audioId && this.bgmPrefetchedId !== nextTrk.audioId && !this.audioBuffers.has(nextTrk.audioId)) {
            this.bgmPrefetchedId = nextTrk.audioId;
            this.getOrDecodeAudioBuffer(nextTrk.audioId).catch(() => {});
          }
        }

        if (
          xfadeSec > 0.1 &&
          !this.bgmPlayer.isCrossfadingNext &&
          mode !== 'single' &&
          !isLastOfSequence &&
          totalWall > xfadeSec * 1.8 &&
          remainWall <= xfadeSec
        ) {
          this.bgmPlayer.isCrossfadingNext = true;
          this.advanceBgmTrack(xfadeSec);
        }
      }

      // 3. Draw Master Stereo Output VU Meter (only when foregrounded)
      if (!document.hidden) {
        this.drawVuMeter(true);
      }

      // 4. Editor Preview playhead
      if (hasPreview && !document.hidden) {
        this.drawEditorWaveform();
      }
    }

    // Schedule next tick safely (only one timer ever active)
    const nextDelay = document.hidden ? 250 : 55;
    this.bgTimerId = setTimeout(() => {
      this.bgTimerId = null;
      this.runAnimationTick(performance.now());
    }, nextDelay);
  }

  drawVuMeter(isActive) {
    const canvas = document.getElementById('vuMeterCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    let dbL = -60;
    let dbR = -60;

    if (isActive && this.analyserL && this.analyserR && this.analyserBufL && this.analyserBufR) {
      this.analyserL.getFloatTimeDomainData(this.analyserBufL);
      this.analyserR.getFloatTimeDomainData(this.analyserBufR);
      let maxL = 0;
      let maxR = 0;
      for (let i = 0; i < this.analyserBufL.length; i++) {
        const aL = Math.abs(this.analyserBufL[i]);
        const aR = Math.abs(this.analyserBufR[i]);
        if (aL > maxL) maxL = aL;
        if (aR > maxR) maxR = aR;
      }
      dbL = maxL > 0.0005 ? Math.max(-60, Math.min(3, 20 * Math.log10(maxL))) : -60;
      dbR = maxR > 0.0005 ? Math.max(-60, Math.min(3, 20 * Math.log10(maxR))) : -60;

      // Smooth falloff + peak hold
      this.vuState.peakL = dbL > this.vuState.peakL ? dbL : Math.max(-60, this.vuState.peakL - 3.2);
      this.vuState.peakR = dbR > this.vuState.peakR ? dbR : Math.max(-60, this.vuState.peakR - 3.2);
      this.vuState.holdL = dbL > this.vuState.holdL ? dbL : Math.max(-60, this.vuState.holdL - 0.9);
      this.vuState.holdR = dbR > this.vuState.holdR ? dbR : Math.max(-60, this.vuState.holdR - 0.9);
      this.vuState.isIdleDrawn = false;
    } else {
      this.vuState.peakL = -60;
      this.vuState.peakR = -60;
      this.vuState.holdL = -60;
      this.vuState.holdR = -60;
      this.vuState.isIdleDrawn = true;
    }

    // Clear background
    ctx.fillStyle = '#050810';
    ctx.fillRect(0, 0, w, h);

    const labelW = 18;
    const barW = w - labelW - 6;
    const segments = 48;
    const segGap = 2;
    const segW = (barW - (segments - 1) * segGap) / segments;
    const minDb = -48;
    const maxDb = 0;

    const drawChannel = (label, y, barH, dbVal, holdDb) => {
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(label, 3, y + barH - 2);

      const norm = Math.max(0, Math.min(1, (dbVal - minDb) / (maxDb - minDb)));
      const litSegs = Math.round(norm * segments);
      const holdNorm = Math.max(0, Math.min(1, (holdDb - minDb) / (maxDb - minDb)));
      const holdSeg = Math.round(holdNorm * segments) - 1;

      for (let s = 0; s < segments; s++) {
        const ratio = s / (segments - 1);
        const sx = labelW + s * (segW + segGap);
        let onColor = '#10b981'; // Green (-48 to -12dB)
        let offColor = 'rgba(16, 185, 129, 0.12)';
        if (ratio >= 0.90) {
          onColor = '#f43f5e'; // Red (-3 to 0dB CLIP)
          offColor = 'rgba(244, 63, 94, 0.14)';
        } else if (ratio >= 0.72) {
          onColor = '#f59e0b'; // Amber (-12 to -3dB)
          offColor = 'rgba(245, 158, 11, 0.14)';
        }

        if (s < litSegs) {
          ctx.fillStyle = onColor;
        } else if (isActive && s === holdSeg && holdDb > minDb + 1) {
          ctx.fillStyle = '#ffffff';
        } else {
          ctx.fillStyle = offColor;
        }
        ctx.fillRect(sx, y, segW, barH);
      }
    };

    drawChannel('L', 4, 12, this.vuState.peakL, this.vuState.holdL);
    drawChannel('R', 20, 12, this.vuState.peakR, this.vuState.holdR);

    // dB scale ticks at bottom
    ctx.fillStyle = '#64748b';
    ctx.font = '9px sans-serif';
    const marks = [-48, -36, -24, -12, -6, -3, 0];
    for (const m of marks) {
      const r = (m - minDb) / (maxDb - minDb);
      const mx = labelW + r * barW;
      ctx.fillText(m === 0 ? '0dB' : String(m), Math.min(w - 22, Math.max(labelW, mx - 8)), h - 1);
    }

    // Update numeric readout & ON AIR LED
    const peakMax = Math.max(this.vuState.peakL, this.vuState.peakR);
    const dbEl = document.getElementById('vuDbReadout');
    const ledEl = document.getElementById('vuOnAirLed');
    if (dbEl) {
      const txt = (isActive && peakMax > -59) ? `${peakMax.toFixed(1)} dB` : '-∞ dB';
      if (dbEl._lastT !== txt) {
        dbEl._lastT = txt;
        dbEl.textContent = txt;
      }
    }
    if (ledEl) {
      const isClipping = isActive && peakMax >= -1.5;
      const isSignal = isActive && peakMax > -52;
      ledEl.classList.toggle('active', isSignal && !isClipping);
      ledEl.classList.toggle('clip', isClipping);
      const ledTxt = isClipping ? 'CLIP!' : (isSignal ? 'OUTPUT ●' : 'OUTPUT');
      if (ledEl._lastT !== ledTxt) {
        ledEl._lastT = ledTxt;
        ledEl.textContent = ledTxt;
      }
    }
  }

  // ==================== UI RENDERING ====================
  renderAll() {
    this.renderTopBarState();
    this.renderBankTabs();
    this.renderPadGrid();
    this.renderPlaylistSelector();
    this.renderBgmTrackList();
    this.updateBgmTransportUI();
    if (this.activePadVoices.size === 0 && !this.bgmPlayer.isPlaying) {
      this.drawVuMeter(false);
    }
  }

  renderTopBarState() {
    const vBadge = document.getElementById('menuVersionBadge');
    const vDetail = document.getElementById('menuVersionDetail');
    if (vBadge) vBadge.textContent = APP_VERSION;
    if (vDetail) vDetail.textContent = `現在のバージョン: ${APP_VERSION}`;
    const updSec = document.getElementById('menuUpdateSection');
    if (updSec && window.__IS_STANDALONE_HTML__) {
      updSec.style.display = 'none';
    }

    document.body.classList.toggle('edit-mode-active', this.isEditMode);
    document.getElementById('btnModeLive').classList.toggle('active', !this.isEditMode);
    document.getElementById('btnModeEdit').classList.toggle('active', this.isEditMode);
    document.getElementById('padGrid').classList.toggle('edit-mode', this.isEditMode);

    document.getElementById('selectGridSize').value = this.state.gridSize;
    document.getElementById('sliderMasterVol').value = this.state.masterVol;
    document.getElementById('labelMasterVol').textContent = `${this.state.masterVol}%`;
    document.getElementById('selectMasterFadeSec').value = String(this.state.masterFadeSec);

    document.getElementById('sliderBgmVol').value = this.state.bgmVol;
    document.getElementById('labelBgmVol').textContent = `${this.state.bgmVol}%`;
    document.getElementById('selectBgmMode').value = this.state.bgmMode;
    document.getElementById('selectBgmXfade').value = String(this.state.bgmXfade);
    const monoSel = document.getElementById('selectBgmMonoLink');
    if (monoSel) monoSel.value = this.state.bgmMonoLink || 'off';

    const outSel = document.getElementById('selectOutputMode');
    if (outSel) {
      const mode = this.state.outputMode || 'stereo';
      outSel.value = mode;
      outSel.classList.toggle('mono-active', mode !== 'stereo');
    }
  }

  renderBankTabs() {
    const container = document.getElementById('bankTabsContainer');
    container.innerHTML = '';
    for (const bank of this.state.banks) {
      const hasPlayingInBank = bank.pads.some((p) => {
        const set = this.activePadVoices.get(p.id);
        return set && set.size > 0;
      });
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `bank-tab ${bank.id === this.state.currentBankId ? 'active' : ''} ${hasPlayingInBank ? 'has-playing' : ''}`;
      btn.textContent = hasPlayingInBank ? `● ${bank.name}` : bank.name;
      btn.addEventListener('click', () => {
        this.state.currentBankId = bank.id;
        this.saveAppState();
        this.renderBankTabs();
        this.renderPadGrid();
      });
      container.appendChild(btn);
    }
  }

  renderPadGrid() {
    const grid = document.getElementById('padGrid');
    grid.className = `pad-grid grid-${this.state.gridSize} ${this.isEditMode ? 'edit-mode' : ''}`;
    grid.innerHTML = '';
    this.padDomCache.clear();

    const bank = this.getCurrentBank();
    if (!bank) return;
    const count = this.getVisiblePadCount();

    while (bank.pads.length < count) {
      bank.pads.push(this.createDefaultPad(bank.pads.length));
    }

    for (let i = 0; i < count; i++) {
      const pad = bank.pads[i];
      const hasAudio = Boolean(pad.audioId && (this.audioBuffers.has(pad.audioId) || this.audioMeta.has(pad.audioId)));
      const voices = this.activePadVoices.get(pad.id);
      const isPlaying = Boolean(voices && voices.size > 0);
      const slotKey = this.getSlotKey(i);

      const padEl = document.createElement('div');
      padEl.className = `sound-pad ${hasAudio ? 'loaded-pad' : 'empty-pad'} ${isPlaying ? 'playing' : ''}`;
      padEl.dataset.padId = pad.id;
      padEl.dataset.padIndex = String(i);
      padEl.dataset.color = pad.color || 'cyan';

      const duration = this.getPadTrimmedDuration(pad);
      const timeStr = hasAudio ? this.formatSeconds(duration, true) : '--:--';

      padEl.innerHTML = `
        <div class="pad-top-row">
          <div class="pad-badges">
            <span class="pad-num-badge">#${i + 1}</span>
            ${hasAudio ? `<span class="pad-mode-badge">${MODE_LABELS[pad.triggerMode] || 'POLY'}</span>` : ''}
            ${hasAudio && pad.loop ? `<span class="pad-loop-badge">🔁 LOOP</span>` : ''}
            ${slotKey ? `<span class="pad-key-badge">${this.escapeHtml(slotKey)}</span>` : ''}
          </div>
          <button type="button" class="pad-gear-btn" title="波形編集・設定を開く">⚙️</button>
        </div>

        <div class="pad-title">${hasAudio ? this.escapeHtml(pad.name) : '＋ タップで音源割当'}</div>

        <div class="pad-bottom-row">
          <span class="pad-time">${timeStr}</span>
          <div class="pad-mini-controls">
            ${isPlaying && voices.size > 1 ? `<span class="pad-voice-count">×${voices.size}</span>` : ''}
            ${isPlaying ? `
              <button type="button" class="pad-sub-btn fade-btn" title="個別フェードアウト">📉FADE</button>
              <button type="button" class="pad-sub-btn stop-btn" title="即時停止">⏹</button>
            ` : ''}
          </div>
        </div>
        <div class="pad-progress-bar"></div>
      `;

      const gearBtn = padEl.querySelector('.pad-gear-btn');
      gearBtn.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this.openEditorForPad(i);
      });

      const fadeBtn = padEl.querySelector('.fade-btn');
      if (fadeBtn) {
        fadeBtn.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          this.stopPadVoices(pad.id, Number(pad.fadeOut) || 2.0);
        });
      }
      const stopBtn = padEl.querySelector('.stop-btn');
      if (stopBtn) {
        stopBtn.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          this.stopPadVoices(pad.id, 0.03);
        });
      }

      padEl.addEventListener('pointerdown', (e) => {
        if (e.button !== undefined && e.button !== 0) return;

        // LIVE MODE: Trigger immediately on touch/press (0ms latency)
        if (!this.isEditMode) {
          if (pad.triggerMode === 'gate') {
            this.gatePressedPads.add(pad.id);
          }
          this.triggerPad(i);
          return;
        }

        // EDIT MODE: Short tap -> Open Editor, Long-press + Swipe -> Drag & Swap Pads
        const startX = e.clientX;
        const startY = e.clientY;
        const rect = padEl.getBoundingClientRect();
        const offsetX = startX - rect.left;
        const offsetY = startY - rect.top;
        let isDragging = false;
        let movedTooMuch = false;
        let ghostEl = null;
        let currentTargetEl = null;

        try {
          padEl.setPointerCapture(e.pointerId);
        } catch (_) { }

        const startDrag = (curX, curY) => {
          isDragging = true;
          padEl.classList.add('dragging-source');

          ghostEl = padEl.cloneNode(true);
          ghostEl.classList.remove('dragging-source');
          ghostEl.classList.add('pad-drag-ghost');
          ghostEl.style.width = `${rect.width}px`;
          ghostEl.style.height = `${rect.height}px`;
          ghostEl.style.transform = `translate3d(${curX - offsetX}px, ${curY - offsetY}px, 0) scale(1.04)`;
          document.body.appendChild(ghostEl);
        };

        const longPressTimer = setTimeout(() => {
          startDrag(startX, startY);
        }, 250);

        const onPointerMove = (moveEv) => {
          const dx = moveEv.clientX - startX;
          const dy = moveEv.clientY - startY;

          if (!isDragging) {
            if (Math.hypot(dx, dy) > 14) {
              movedTooMuch = true;
              clearTimeout(longPressTimer);
            }
            return;
          }

          if (ghostEl) {
            ghostEl.style.transform = `translate3d(${moveEv.clientX - offsetX}px, ${moveEv.clientY - offsetY}px, 0) scale(1.04)`;
          }

          const hitEl = document.elementFromPoint(moveEv.clientX, moveEv.clientY);
          const overPad = hitEl ? hitEl.closest('.sound-pad') : null;

          if (currentTargetEl && currentTargetEl !== overPad) {
            currentTargetEl.classList.remove('drag-over-target');
          }
          if (overPad && overPad !== padEl) {
            overPad.classList.add('drag-over-target');
            currentTargetEl = overPad;
          } else {
            currentTargetEl = null;
          }
        };

        const cleanupAndFinish = (upEv, cancelled = false) => {
          clearTimeout(longPressTimer);
          padEl.removeEventListener('pointermove', onPointerMove);
          padEl.removeEventListener('pointerup', onPointerUp);
          padEl.removeEventListener('pointercancel', onPointerCancel);

          if (ghostEl) {
            ghostEl.remove();
            ghostEl = null;
          }
          padEl.classList.remove('dragging-source');
          if (currentTargetEl) {
            currentTargetEl.classList.remove('drag-over-target');
          }

          if (cancelled) return;

          if (isDragging) {
            const hitEl = document.elementFromPoint(upEv.clientX, upEv.clientY);
            const dropPad = hitEl ? hitEl.closest('.sound-pad') : currentTargetEl;
            if (dropPad && dropPad !== padEl && dropPad.dataset.padIndex !== undefined) {
              const targetIdx = Number(dropPad.dataset.padIndex);
              if (!Number.isNaN(targetIdx) && targetIdx !== i) {
                this.swapPads(i, targetIdx);
              }
            }
          } else if (!movedTooMuch) {
            // Short tap in Edit Mode -> Open Editor
            this.openEditorForPad(i);
          }
        };

        const onPointerUp = (upEv) => cleanupAndFinish(upEv, false);
        const onPointerCancel = (cancelEv) => cleanupAndFinish(cancelEv, true);

        padEl.addEventListener('pointermove', onPointerMove);
        padEl.addEventListener('pointerup', onPointerUp);
        padEl.addEventListener('pointercancel', onPointerCancel);
      });

      const handleGateRelease = () => {
        if (!this.isEditMode && pad.triggerMode === 'gate') {
          this.gatePressedPads.delete(pad.id);
          const gateRel = Math.min(0.2, Math.max(0.02, safeNum(pad.fadeOut, 0.08)));
          this.stopPadVoices(pad.id, gateRel);
        }
      };
      padEl.addEventListener('pointerup', handleGateRelease);
      padEl.addEventListener('pointercancel', handleGateRelease);
      padEl.addEventListener('pointerleave', handleGateRelease);

      grid.appendChild(padEl);
      this.padDomCache.set(pad.id, {
        padEl,
        bar: padEl.querySelector('.pad-progress-bar'),
        timeEl: padEl.querySelector('.pad-time'),
        miniControls: padEl.querySelector('.pad-mini-controls'),
        pad
      });
    }
  }

  /**
   * Differential single-pad visual update (NEVER rebuilds the grid DOM, so active
   * GATE holds and Edit-mode drag gestures are never broken).
   */
  updatePadVisualState(padId) {
    this.renderBankTabs();
    const cached = this.padDomCache.get(padId);
    if (!cached) return;

    const voices = this.activePadVoices.get(padId);
    const isPlaying = Boolean(voices && voices.size > 0);
    cached.padEl.classList.toggle('playing', isPlaying);

    if (!isPlaying) {
      if (cached.bar) {
        cached.bar._lastW = '0%';
        cached.bar.style.width = '0%';
      }
      if (cached.timeEl) {
        const hasAudio = Boolean(cached.pad.audioId && (this.audioBuffers.has(cached.pad.audioId) || this.audioMeta.has(cached.pad.audioId)));
        const durStr = hasAudio ? this.formatSeconds(this.getPadTrimmedDuration(cached.pad), true) : '--:--';
        cached.timeEl._lastT = durStr;
        cached.timeEl.textContent = durStr;
      }
    }

    if (cached.miniControls) {
      if (isPlaying) {
        cached.miniControls.innerHTML = `
          ${voices.size > 1 ? `<span class="pad-voice-count">×${voices.size}</span>` : ''}
          <button type="button" class="pad-sub-btn fade-btn" title="個別フェードアウト">📉FADE</button>
          <button type="button" class="pad-sub-btn stop-btn" title="即時停止">⏹</button>
        `;
        const fadeBtn = cached.miniControls.querySelector('.fade-btn');
        if (fadeBtn) {
          fadeBtn.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            this.stopPadVoices(padId, Math.max(0.05, safeNum(cached.pad.fadeOut, 2.0)));
          });
        }
        const stopBtn = cached.miniControls.querySelector('.stop-btn');
        if (stopBtn) {
          stopBtn.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            this.stopPadVoices(padId, 0.03);
          });
        }
      } else {
        cached.miniControls.innerHTML = '';
      }
    }
  }

  async swapPads(fromIndex, toIndex) {
    const bank = this.getCurrentBank();
    if (!bank || !bank.pads[fromIndex] || !bank.pads[toIndex]) return;

    const padA = bank.pads[fromIndex];
    const padB = bank.pads[toIndex];

    bank.pads[fromIndex] = padB;
    bank.pads[toIndex] = padA;

    // Keep default placeholder names ("PAD X") aligned with their slot number if empty
    [fromIndex, toIndex].forEach((idx) => {
      const p = bank.pads[idx];
      if (!p.audioId && /^PAD \d+$/.test(p.name)) {
        p.name = `PAD ${idx + 1}`;
      }
    });

    await this.saveAppState();
    this.renderPadGrid();
    this.showToast(`PAD #${fromIndex + 1} と PAD #${toIndex + 1} を入れ替えました`);
  }

  getPadTrimmedDuration(item) {
    if (!item || !item.audioId) return 0;
    const buf = this.audioBuffers.get(item.audioId);
    const meta = this.audioMeta.get(item.audioId);
    const totalDur = buf ? buf.duration : (meta ? Number(meta.duration) : 0);
    if (!totalDur || totalDur <= 0) return 0;
    const start = Math.max(0, Number(item.trimStart) || 0);
    const end = (Number(item.trimEnd) > start && Number(item.trimEnd) <= totalDur)
      ? Number(item.trimEnd)
      : totalDur;
    const speed = Math.max(0.25, Number(item.speed) || 1.0);
    const pitch = Number(item.pitch) || 0;
    const rate = speed * Math.pow(2, pitch / 12);
    return Math.max(0, (end - start) / rate);
  }

  // ==================== BGM PLAYLIST UI ====================
  renderPlaylistSelector() {
    const sel = document.getElementById('selectPlaylist');
    sel.innerHTML = '';
    for (const pl of this.state.playlists) {
      const opt = document.createElement('option');
      opt.value = pl.id;
      opt.textContent = `${pl.name} (${pl.tracks.length}曲)`;
      if (pl.id === this.state.currentPlaylistId) opt.selected = true;
      sel.appendChild(opt);
    }
  }

  renderBgmTrackList() {
    const listEl = document.getElementById('bgmTrackList');
    listEl.innerHTML = '';
    const pl = this.getCurrentPlaylist();
    if (!pl || pl.tracks.length === 0) {
      listEl.innerHTML = `<div class="bgm-empty-msg">プレイリストに曲がありません。<br>「＋音源ファイル追加」からBGMを追加してください。</div>`;
      return;
    }

    const activePlaylistId = this.bgmPlayer.playingPlaylistId || this.state.currentPlaylistId;
    const isPlayingPlaylist = pl.id === activePlaylistId;

    pl.tracks.forEach((trk, idx) => {
      const isCurrent = isPlayingPlaylist && idx === this.bgmPlayer.currentTrackIndex;
      const dur = this.getPadTrimmedDuration(trk);
      const item = document.createElement('div');
      item.className = `bgm-track-item ${isCurrent ? 'active' : ''}`;
      item.innerHTML = `
        <div class="bgm-track-left">
          <span class="bgm-track-idx">${isCurrent && this.bgmPlayer.isPlaying ? '▶' : idx + 1}</span>
          <div class="bgm-track-info">
            <div class="bgm-track-name">${this.escapeHtml(trk.name)}</div>
            <div class="bgm-track-meta">${this.formatSeconds(dur, false)} ・ 音量${trk.gain ?? 100}%</div>
          </div>
        </div>
        <div class="bgm-track-actions">
          <button type="button" class="btn-track-act btn-trk-edit" title="波形トリミング・音量編集">⚙️</button>
          <button type="button" class="btn-track-act btn-trk-up" title="上へ移動">▲</button>
          <button type="button" class="btn-track-act btn-trk-down" title="下へ移動">▼</button>
          <button type="button" class="btn-track-act btn-trk-del" title="リストから削除">✕</button>
        </div>
      `;

      item.querySelector('.bgm-track-left').addEventListener('click', () => {
        const xfade = this.bgmPlayer.isPlaying ? Number(this.state.bgmXfade) || 0 : 0;
        this.playBgmTrack(idx, xfade, pl.id);
      });

      item.querySelector('.btn-trk-edit').addEventListener('click', (e) => {
        e.stopPropagation();
        this.openEditorForBgmTrack(idx);
      });

      item.querySelector('.btn-trk-up').addEventListener('click', (e) => {
        e.stopPropagation();
        if (idx === 0) return;
        const tmp = pl.tracks[idx - 1];
        pl.tracks[idx - 1] = pl.tracks[idx];
        pl.tracks[idx] = tmp;
        if (isPlayingPlaylist) {
          if (this.bgmPlayer.currentTrackIndex === idx) this.bgmPlayer.currentTrackIndex = idx - 1;
          else if (this.bgmPlayer.currentTrackIndex === idx - 1) this.bgmPlayer.currentTrackIndex = idx;
        }
        this.saveAppState();
        this.renderBgmTrackList();
      });

      item.querySelector('.btn-trk-down').addEventListener('click', (e) => {
        e.stopPropagation();
        if (idx >= pl.tracks.length - 1) return;
        const tmp = pl.tracks[idx + 1];
        pl.tracks[idx + 1] = pl.tracks[idx];
        pl.tracks[idx] = tmp;
        if (isPlayingPlaylist) {
          if (this.bgmPlayer.currentTrackIndex === idx) this.bgmPlayer.currentTrackIndex = idx + 1;
          else if (this.bgmPlayer.currentTrackIndex === idx + 1) this.bgmPlayer.currentTrackIndex = idx;
        }
        this.saveAppState();
        this.renderBgmTrackList();
      });

      item.querySelector('.btn-trk-del').addEventListener('click', async (e) => {
        e.stopPropagation();
        const deletingCurrentTrack = isPlayingPlaylist && this.bgmPlayer.currentTrackIndex === idx;
        if (deletingCurrentTrack && this.bgmPlayer.isPlaying) {
          this.stopBgmImmediately();
        } else if (deletingCurrentTrack) {
          this.bgmPlayer.pausedAtOffset = 0;
        }
        pl.tracks.splice(idx, 1);
        if (isPlayingPlaylist) {
          if (idx < this.bgmPlayer.currentTrackIndex) {
            this.bgmPlayer.currentTrackIndex = Math.max(0, this.bgmPlayer.currentTrackIndex - 1);
          } else if (this.bgmPlayer.currentTrackIndex >= pl.tracks.length) {
            this.bgmPlayer.currentTrackIndex = Math.max(0, pl.tracks.length - 1);
          }
        }
        await this.saveAppState();
        this.gcOrphanAudioFiles();
        this.renderPlaylistSelector();
        this.renderBgmTrackList();
        this.updateBgmTransportUI();
      });

      listEl.appendChild(item);
    });
  }

  updateBgmTransportUI() {
    const playBtn = document.getElementById('btnBgmPlayPause');
    const titleEl = document.getElementById('bgmNowTitle');
    const timeLabel = document.getElementById('bgmNowTime');
    const seekSlider = document.getElementById('sliderBgmSeek');
    const playingPl = this.getPlayingPlaylist();
    const viewedPl = this.getCurrentPlaylist();
    const isViewingOtherPl = Boolean(playingPl && viewedPl && playingPl.id !== viewedPl.id);
    const track = playingPl && playingPl.tracks[this.bgmPlayer.currentTrackIndex];

    if (this.bgmPlayer.isPlaying && track) {
      playBtn.textContent = '⏸ 一時停止';
      playBtn.classList.add('playing');
      titleEl.textContent = isViewingOtherPl
        ? `♪ ${track.name}（${playingPl.name}）`
        : `♪ ${track.name}`;
    } else {
      playBtn.textContent = '▶ 再生';
      playBtn.classList.remove('playing');
      const standbyTrack = (this.bgmPlayer.pausedAtOffset > 0 && track)
        ? track
        : (viewedPl && viewedPl.tracks[0]);
      const standbyPl = (this.bgmPlayer.pausedAtOffset > 0 && track) ? playingPl : viewedPl;
      const showOtherTag = Boolean(this.bgmPlayer.pausedAtOffset > 0 && standbyPl && viewedPl && standbyPl.id !== viewedPl.id);

      titleEl.textContent = standbyTrack
        ? `${this.bgmPlayer.pausedAtOffset > 0 ? '一時停止' : '待機中'}: ${standbyTrack.name}${showOtherTag ? `（${standbyPl.name}）` : ''}`
        : '曲を選択または追加してください';
      if (standbyTrack) {
        const info = this.getBgmTrackTiming(standbyTrack, this.bgmPlayer.pausedAtOffset > 0 ? null : 0);
        if (info) {
          if (timeLabel && !this.bgmPlayer.isSeeking) {
            timeLabel.textContent = `${this.formatSeconds(info.curWall, false)} / -${this.formatSeconds(info.remainWall, false)}`;
          }
          if (seekSlider && !this.bgmPlayer.isSeeking) {
            seekSlider.value = Math.round(info.clampedRatio * 1000);
          }
        }
      } else {
        if (timeLabel) timeLabel.textContent = '00:00 / 00:00';
        if (seekSlider) seekSlider.value = 0;
      }
    }
  }

  // ==================== WAVEFORM & AUDIO EDITOR MODAL ====================
  async openEditorForPad(padIndex) {
    const bank = this.getCurrentBank();
    if (!bank) return;
    const pad = bank.pads[padIndex];
    if (!pad) return;

    this.editorTarget = { type: 'pad', bankId: bank.id, padIndex };
    this.editorDraft = JSON.parse(JSON.stringify(pad));
    this.editorDraft.key = this.getSlotKey(padIndex);
    this.editorZoom = 1;
    this.editorPanStart = 0;

    document.getElementById('editorTargetBadge').textContent = `PAD #${padIndex + 1}`;
    document.getElementById('editorModalTitle').textContent = 'パッド設定・波形簡易編集';
    document.getElementById('padOnlyModeGroup').style.display = '';
    document.getElementById('padOnlyLoopGroup').style.display = '';
    document.getElementById('padOnlyKeyGroup').style.display = '';
    document.getElementById('padOnlyColorRow').style.display = '';
    document.getElementById('btnClearTarget').style.display = '';

    if (this.editorDraft.audioId && !this.audioBuffers.has(this.editorDraft.audioId)) {
      await this.getOrDecodeAudioBuffer(this.editorDraft.audioId);
    }

    this.populateEditorModalFields();
    this.updateWaveformZoomUI();
    document.getElementById('editorModal').classList.remove('hidden');
    this.drawEditorWaveform();
  }

  async openEditorForBgmTrack(trackIndex) {
    const pl = this.getCurrentPlaylist();
    if (!pl) return;
    const track = pl.tracks[trackIndex];
    if (!track) return;

    this.editorTarget = { type: 'bgm', playlistId: pl.id, trackIndex };
    this.editorDraft = JSON.parse(JSON.stringify(track));
    this.editorZoom = 1;
    this.editorPanStart = 0;

    document.getElementById('editorTargetBadge').textContent = `BGM #${trackIndex + 1}`;
    document.getElementById('editorModalTitle').textContent = 'BGMトラック波形・音量・フェード編集';
    document.getElementById('padOnlyModeGroup').style.display = 'none';
    document.getElementById('padOnlyLoopGroup').style.display = 'none';
    document.getElementById('padOnlyKeyGroup').style.display = 'none';
    document.getElementById('padOnlyColorRow').style.display = 'none';
    document.getElementById('btnClearTarget').style.display = 'none';

    if (this.editorDraft.audioId && !this.audioBuffers.has(this.editorDraft.audioId)) {
      await this.getOrDecodeAudioBuffer(this.editorDraft.audioId);
    }

    this.populateEditorModalFields();
    this.updateWaveformZoomUI();
    document.getElementById('editorModal').classList.remove('hidden');
    this.drawEditorWaveform();
  }

  populateEditorModalFields() {
    const d = this.editorDraft;
    document.getElementById('inputEditName').value = d.name || '';
    document.getElementById('selectEditTriggerMode').value = d.triggerMode || 'poly';
    document.getElementById('checkEditLoop').checked = Boolean(d.loop);
    document.getElementById('inputEditKey').value = d.key || '';

    const swatchesEl = document.getElementById('colorSwatches');
    swatchesEl.innerHTML = '';
    for (const c of PAD_COLORS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `color-swatch ${d.color === c.id ? 'active' : ''}`;
      btn.style.backgroundColor = c.hex;
      btn.title = c.label;
      btn.addEventListener('click', () => {
        this.editorDraft.color = c.id;
        this.populateEditorModalFields();
      });
      swatchesEl.appendChild(btn);
    }

    const buf = d.audioId ? this.audioBuffers.get(d.audioId) : null;
    const emptyOverlay = document.getElementById('waveformEmptyOverlay');
    const metaLabel = document.getElementById('labelAudioMeta');

    if (buf) {
      emptyOverlay.classList.add('hidden');
      const dur = buf.duration;
      if (!d.trimEnd || d.trimEnd <= d.trimStart || d.trimEnd > dur) {
        d.trimEnd = Number(dur.toFixed(2));
      }
      const meta = this.audioMeta.get(d.audioId);
      metaLabel.textContent = `${meta ? meta.name : '音源'} (全長 ${dur.toFixed(2)}秒 / 有効 ${(d.trimEnd - d.trimStart).toFixed(2)}秒)`;

      const sStart = document.getElementById('sliderTrimStart');
      const sEnd = document.getElementById('sliderTrimEnd');
      const nStart = document.getElementById('numTrimStart');
      const nEnd = document.getElementById('numTrimEnd');

      sStart.max = dur.toFixed(2);
      sEnd.max = dur.toFixed(2);
      nStart.max = dur.toFixed(2);
      nEnd.max = dur.toFixed(2);

      sStart.value = d.trimStart;
      sEnd.value = d.trimEnd;
      nStart.value = Number(d.trimStart).toFixed(2);
      nEnd.value = Number(d.trimEnd).toFixed(2);
    } else {
      emptyOverlay.classList.remove('hidden');
      metaLabel.textContent = '音源ファイル未割当';
    }

    document.getElementById('sliderEditGain').value = d.gain ?? 100;
    document.getElementById('labelEditGain').textContent = `${d.gain ?? 100}%`;

    document.getElementById('sliderEditFadeIn').value = d.fadeIn ?? 0;
    document.getElementById('labelEditFadeIn').textContent = `${Number(d.fadeIn ?? 0).toFixed(1)}秒`;

    document.getElementById('sliderEditFadeOut').value = d.fadeOut ?? 2.0;
    document.getElementById('labelEditFadeOut').textContent = `${Number(d.fadeOut ?? 2.0).toFixed(1)}秒`;

    document.getElementById('sliderEditSpeed').value = d.speed ?? 1.0;
    document.getElementById('labelEditSpeed').textContent = `${Number(d.speed ?? 1.0).toFixed(2)}x`;

    const pitch = Number(d.pitch ?? 0);
    document.getElementById('sliderEditPitch').value = pitch;
    document.getElementById('labelEditPitch').textContent = `${pitch > 0 ? '+' : ''}${pitch} 半音`;
  }

  getWaveformViewWindow(dur) {
    const zoom = Math.max(1, Math.min(32, Number(this.editorZoom) || 1));
    const spanFrac = 1 / zoom;
    const maxPan = Math.max(0, 1 - spanFrac);
    const startFrac = Math.max(0, Math.min(maxPan, Number(this.editorPanStart) || 0));
    const endFrac = Math.min(1, startFrac + spanFrac);
    return {
      zoom,
      startFrac,
      endFrac,
      viewStart: startFrac * dur,
      viewEnd: endFrac * dur,
      viewDur: Math.max(0.01, (endFrac - startFrac) * dur)
    };
  }

  updateWaveformZoomUI() {
    const zoom = Math.max(1, Math.min(32, Number(this.editorZoom) || 1));
    const maxPan = Math.max(0, 1 - 1 / zoom);
    this.editorPanStart = Math.max(0, Math.min(maxPan, this.editorPanStart || 0));

    const label = document.getElementById('labelZoomLevel');
    const panSlider = document.getElementById('sliderWaveformPan');
    if (label) label.textContent = `${zoom.toFixed(1)}x`;
    if (panSlider) {
      panSlider.disabled = zoom <= 1.01;
      panSlider.value = maxPan > 0 ? String(Math.round((this.editorPanStart / maxPan) * 1000)) : '0';
    }
  }

  setEditorZoom(newZoom, focusFrac = null) {
    const clampedZoom = Math.max(1, Math.min(32, newZoom));
    const oldSpan = 1 / (this.editorZoom || 1);
    const centerFrac = focusFrac !== null ? focusFrac : (this.editorPanStart + oldSpan / 2);
    const newSpan = 1 / clampedZoom;
    this.editorZoom = clampedZoom;
    this.editorPanStart = Math.max(0, Math.min(1 - newSpan, centerFrac - newSpan / 2));
    this.updateWaveformZoomUI();
    this.drawEditorWaveform();
  }

  focusEditorZoomOnTime(timeSec) {
    const d = this.editorDraft;
    const buf = d && d.audioId ? this.audioBuffers.get(d.audioId) : null;
    if (!buf || buf.duration <= 0) return;
    const targetZoom = this.editorZoom < 4 ? 8 : this.editorZoom;
    this.setEditorZoom(targetZoom, Math.max(0, Math.min(1, timeSec / buf.duration)));
  }

  drawEditorWaveform() {
    const canvas = document.getElementById('waveformCanvas');
    if (!canvas || !this.editorDraft) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = '#060911';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    const d = this.editorDraft;
    const buf = d.audioId ? this.audioBuffers.get(d.audioId) : null;
    if (!buf) return;

    const data = buf.getChannelData(0);
    const dur = buf.duration;
    const { startFrac, endFrac, viewStart, viewEnd, viewDur } = this.getWaveformViewWindow(dur);

    const timeToX = (t) => ((t - viewStart) / viewDur) * w;
    const trimStart = Math.max(0, Math.min(dur, Number(d.trimStart) || 0));
    const trimEnd = Math.max(trimStart, Math.min(dur, Number(d.trimEnd) || dur));
    const startX = timeToX(trimStart);
    const endX = timeToX(trimEnd);
    const gainScale = (Number(d.gain ?? 100) / 100);

    // Highlight active trimmed zone within viewport
    const visStartX = Math.max(0, Math.min(w, startX));
    const visEndX = Math.max(0, Math.min(w, endX));
    if (visEndX > visStartX) {
      ctx.fillStyle = 'rgba(6, 182, 212, 0.1)';
      ctx.fillRect(visStartX, 0, visEndX - visStartX, h);
    }

    const viewSampleStart = Math.floor(startFrac * data.length);
    const viewSampleEnd = Math.min(data.length, Math.ceil(endFrac * data.length));
    const viewSamples = Math.max(1, viewSampleEnd - viewSampleStart);
    const step = Math.max(1, Math.floor(viewSamples / w));

    for (let x = 0; x < w; x++) {
      const sampleIdx = viewSampleStart + Math.floor((x / w) * viewSamples);
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step && sampleIdx + j < data.length; j++) {
        const val = data[sampleIdx + j];
        if (val < min) min = val;
        if (val > max) max = val;
      }
      const inRegion = x >= startX && x <= endX;
      const scale = inRegion ? gainScale : 1.0;
      const y1 = (h / 2) - Math.min(1, max * scale) * (h * 0.45);
      const y2 = (h / 2) - Math.max(-1, min * scale) * (h * 0.45);

      ctx.fillStyle = inRegion ? '#22d3ee' : 'rgba(148, 163, 184, 0.25)';
      ctx.fillRect(x, y1, 1, Math.max(1, y2 - y1));
    }

    // Dim trimmed-out areas
    ctx.fillStyle = 'rgba(3, 7, 18, 0.65)';
    if (visStartX > 0) ctx.fillRect(0, 0, visStartX, h);
    if (visEndX < w) ctx.fillRect(visEndX, 0, w - visEndX, h);

    // Fade-in & Fade-out envelope
    const fadeInSec = Number(d.fadeIn) || 0;
    const fadeOutSec = Number(d.fadeOut) || 0;
    const fadeInEndX = timeToX(Math.min(trimEnd, trimStart + fadeInSec));
    const fadeOutStartX = timeToX(Math.max(trimStart, trimEnd - fadeOutSec));

    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(startX, h - 6);
    ctx.lineTo(fadeInEndX, 10);
    ctx.lineTo(fadeOutStartX, 10);
    ctx.lineTo(endX, h - 6);
    ctx.stroke();

    // Start handle (if visible)
    if (startX >= -4 && startX <= w + 4) {
      ctx.fillStyle = '#10b981';
      ctx.fillRect(startX - 2, 0, 4, h);
      ctx.beginPath();
      ctx.roundRect(Math.min(w - 50, Math.max(2, startX)), 4, 48, 20, 4);
      ctx.fill();
      ctx.fillStyle = '#052e16';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('IN ▶', Math.min(w - 44, Math.max(8, startX + 6)), 18);
    }

    // End handle (if visible)
    if (endX >= -4 && endX <= w + 4) {
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(endX - 2, 0, 4, h);
      ctx.beginPath();
      ctx.roundRect(Math.max(2, Math.min(w - 50, endX - 48)), h - 24, 48, 20, 4);
      ctx.fill();
      ctx.fillStyle = '#451a03';
      ctx.fillText('◀ OUT', Math.max(8, Math.min(w - 44, endX - 42)), h - 10);
    }

    // Viewport time range indicator when zoomed in
    if (this.editorZoom > 1) {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.85)';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(`${viewStart.toFixed(2)}s`, 6, h - 6);
      const endLabel = `${viewEnd.toFixed(2)}s`;
      ctx.fillText(endLabel, w - ctx.measureText(endLabel).width - 6, 14);
    }

    // Preview playhead
    if (this.previewVoice && this.audioCtx) {
      const elapsedWall = this.audioCtx.currentTime - this.previewVoice.startedAt;
      const curBufTime = this.previewVoice.trimStart + elapsedWall * this.previewVoice.effectiveRate;
      if (curBufTime >= viewStart && curBufTime <= viewEnd && curBufTime <= this.previewVoice.trimEnd) {
        const px = timeToX(curBufTime);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(px - 1, 0, 2.5, h);
      }
    }
  }

  autoTrimSilenceInEditor() {
    const d = this.editorDraft;
    if (!d || !d.audioId) return;
    const buf = this.audioBuffers.get(d.audioId);
    if (!buf) return;

    const channels = [];
    for (let c = 0; c < buf.numberOfChannels; c++) channels.push(buf.getChannelData(c));
    const len = buf.length;
    const sr = buf.sampleRate;
    const threshold = 0.015;

    const sampleMaxAbs = (idx) => {
      let m = 0;
      for (let c = 0; c < channels.length; c++) {
        const a = Math.abs(channels[c][idx]);
        if (a > m) m = a;
      }
      return m;
    };

    let firstIdx = 0;
    while (firstIdx < len && sampleMaxAbs(firstIdx) < threshold) {
      firstIdx++;
    }
    let lastIdx = len - 1;
    while (lastIdx > firstIdx && sampleMaxAbs(lastIdx) < threshold) {
      lastIdx--;
    }

    if (firstIdx >= lastIdx) {
      this.showToast('無音閾値を超える波形が検出されませんでした');
      return;
    }

    const safetySec = 0.015;
    d.trimStart = Number(Math.max(0, firstIdx / sr - safetySec).toFixed(2));
    d.trimEnd = Number(Math.min(buf.duration, lastIdx / sr + safetySec * 2).toFixed(2));

    this.populateEditorModalFields();
    this.drawEditorWaveform();
    this.showToast(`前後の無音をカットしました (${d.trimStart}秒 〜 ${d.trimEnd}秒)`);
  }

  autoNormalizeInEditor() {
    const d = this.editorDraft;
    if (!d || !d.audioId) return;
    const buf = this.audioBuffers.get(d.audioId);
    if (!buf) return;

    const sr = buf.sampleRate;
    const sIdx = Math.max(0, Math.floor(safeNum(d.trimStart, 0) * sr));
    const eIdx = Math.min(buf.length, Math.ceil(safeNum(d.trimEnd, buf.duration) * sr));

    let peak = 0;
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const data = buf.getChannelData(c);
      for (let i = sIdx; i < eIdx; i++) {
        const abs = Math.abs(data[i]);
        if (abs > peak) peak = abs;
      }
    }

    if (peak < 0.001) {
      this.showToast('音源レベルが小さすぎるため計測できませんでした');
      return;
    }

    const targetPeak = 0.90;
    const idealGain = Math.round((targetPeak / peak) * 100);
    d.gain = Math.max(25, Math.min(300, idealGain));

    this.populateEditorModalFields();
    this.drawEditorWaveform();
    this.showToast(`ピーク音量に合わせて音量を ${d.gain}% に自動調整しました`);
  }

  startEditorPreview() {
    this.stopEditorPreview();
    const d = this.editorDraft;
    if (!d || !d.audioId) {
      this.showToast('先に音源ファイルを選択してください');
      return;
    }
    const buf = this.audioBuffers.get(d.audioId);
    if (!buf) return;

    const ctx = this.ensureAudioContext();
    const now = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = buf;

    const speed = Math.max(0.25, Math.min(3.0, safeNum(d.speed, 1.0)));
    const pitch = safeNum(d.pitch, 0);
    source.playbackRate.value = speed;
    if ('detune' in source) source.detune.value = pitch * 100;
    const effectiveRate = speed * Math.pow(2, pitch / 12);

    const trimStart = Math.max(0, Math.min(buf.duration - 0.02, safeNum(d.trimStart, 0)));
    const rawEnd = safeNum(d.trimEnd, buf.duration);
    const trimEnd = (rawEnd > trimStart && rawEnd <= buf.duration) ? rawEnd : buf.duration;
    const regionDur = Math.max(0.02, trimEnd - trimStart);
    const wallDur = regionDur / effectiveRate;

    const gainNode = ctx.createGain();
    const targetGain = Math.max(0, safeNum(d.gain, 100) / 100);
    const fadeIn = Math.max(0, safeNum(d.fadeIn, 0));
    if (fadeIn > 0.02) {
      gainNode.gain.setValueAtTime(0.0001, now);
      gainNode.gain.linearRampToValueAtTime(targetGain, now + Math.min(fadeIn, wallDur));
    } else {
      gainNode.gain.setValueAtTime(targetGain, now);
    }

    source.connect(gainNode);
    gainNode.connect(this.masterSeGain);
    source.start(now, trimStart, wallDur);

    const voiceObj = {
      source,
      gainNode,
      startedAt: now,
      trimStart,
      trimEnd,
      effectiveRate
    };
    this.previewVoice = voiceObj;

    source.onended = () => {
      if (this.previewVoice === voiceObj) {
        this.previewVoice = null;
        this.drawEditorWaveform();
      }
    };
    this.wakeAnimationLoop();
  }

  stopEditorPreview() {
    if (!this.previewVoice) return;
    try {
      this.previewVoice.source.stop();
      this.previewVoice.gainNode.disconnect();
    } catch (_) { }
    this.previewVoice = null;
    this.drawEditorWaveform();
  }

  async saveEditorChanges() {
    this.stopEditorPreview();
    if (!this.editorTarget || !this.editorDraft) return;

    this.editorDraft.name = document.getElementById('inputEditName').value.trim() || '無題';
    this.editorDraft.triggerMode = document.getElementById('selectEditTriggerMode').value;
    this.editorDraft.loop = document.getElementById('checkEditLoop').checked;
    const editedKey = document.getElementById('inputEditKey').value.trim().toUpperCase();

    if (this.editorTarget.type === 'pad') {
      this.setSlotKey(this.editorTarget.padIndex, editedKey);
      const bank = this.state.banks.find((b) => b.id === this.editorTarget.bankId);
      if (bank && bank.pads[this.editorTarget.padIndex]) {
        bank.pads[this.editorTarget.padIndex] = JSON.parse(JSON.stringify(this.editorDraft));
      }
    } else if (this.editorTarget.type === 'bgm') {
      const pl = this.state.playlists.find((p) => p.id === this.editorTarget.playlistId);
      if (pl && pl.tracks[this.editorTarget.trackIndex]) {
        pl.tracks[this.editorTarget.trackIndex] = JSON.parse(JSON.stringify(this.editorDraft));
      }
    }

    await this.saveAppState();
    document.getElementById('editorModal').classList.add('hidden');
    this.renderAll();
    this.showToast('設定を保存しました');
  }

  // ==================== FILE IMPORT & BACKUP ====================
  async importAudioFileToRecord(file, keepInRam = true) {
    const arrayBuffer = await file.arrayBuffer();
    const audioId = `aud_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const cleanName = file.name.replace(/\.[^/.]+$/, '');
    const record = {
      id: audioId,
      name: cleanName,
      mimeType: file.type || 'audio/mpeg',
      arrayBuffer,
      duration: 0
    };
    const decoded = await this.decodeAndCacheAudioRecord(record, keepInRam);
    if (!decoded) {
      throw new Error(`「${file.name}」のデコードに失敗しました`);
    }
    record.duration = decoded.duration;
    await this.db.saveAudioFile(record);
    // For batch imports of long BGM files, evict immediately to avoid iPadOS OOM crash
    if (!keepInRam && decoded.duration >= 30) {
      this.audioBuffers.delete(audioId);
      this.longBufferOrder = this.longBufferOrder.filter((id) => id !== audioId);
    }
    return { audioId, name: cleanName, duration: decoded.duration };
  }

  async exportFullBackup() {
    this.showToast('バックアップデータを作成中...');
    const audioFiles = await this.db.getAllAudioFiles();
    const serializedAudio = audioFiles.map((rec) => ({
      id: rec.id,
      name: rec.name,
      mimeType: rec.mimeType,
      duration: rec.duration,
      base64: this.arrayBufferToBase64(rec.arrayBuffer)
    }));

    const payload = {
      app: 'HIKARUNG-PRO',
      version: 2,
      exportedAt: new Date().toISOString(),
      state: this.state,
      audioFiles: serializedAudio
    };

    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `hikarung-pro-backup-${dateStr}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    this.showToast('バックアップファイルを書き出しました');
  }

  async importFullBackup(file) {
    try {
      const ok = await this.showConfirmDialog(
        'バックアップの復元',
        `「${file.name}」から復元すると、現在の音源と設定がすべて上書きされます。よろしいですか？`
      );
      if (!ok) return;

      this.showToast('バックアップファイルを検証中...');
      const text = await file.text();
      const payload = JSON.parse(text);
      if (
        !payload ||
        !payload.state ||
        !Array.isArray(payload.state.banks) ||
        payload.state.banks.length === 0 ||
        !Array.isArray(payload.state.playlists) ||
        !Array.isArray(payload.audioFiles)
      ) {
        throw new Error('無効なバックアップファイル形式です');
      }

      // Pre-validate all base64 entries BEFORE clearing existing DB (prevents data loss on corrupt file)
      const preparedRecords = [];
      for (const item of payload.audioFiles) {
        if (!item || !item.id || typeof item.base64 !== 'string') {
          throw new Error('バックアップ内の音源データが破損しています');
        }
        const arrayBuffer = this.base64ToArrayBuffer(item.base64);
        preparedRecords.push({
          id: item.id,
          name: item.name || '音源',
          mimeType: item.mimeType || 'audio/wav',
          duration: safeNum(item.duration, 0),
          arrayBuffer
        });
      }

      this.panicStopAll();
      await this.db.clearAll();
      this.audioBuffers.clear();
      this.audioMeta.clear();
      this.longBufferOrder = [];
      this.pendingDecodes.clear();
      this.bgmPlayer.playingPlaylistId = null;
      this.bgmPlayer.currentTrackIndex = 0;
      this.bgmPlayer.pausedAtOffset = 0;

      for (const rec of preparedRecords) {
        await this.db.saveAudioFile(rec);
        this.audioMeta.set(rec.id, { name: rec.name, duration: rec.duration });
        // Only pre-decode short SEs (<30s) into RAM; keep long BGM tracks lazy-decoded to prevent OOM
        if (rec.duration > 0 && rec.duration < 30) {
          await this.decodeAndCacheAudioRecord(rec, true);
        }
      }

      // Merge onto default state so older backups don't lose newly added properties
      this.state = Object.assign({
        gridSize: '4x4',
        masterVol: 100,
        masterFadeSec: 3.0,
        currentBankId: payload.state.banks[0].id,
        banks: [],
        currentPlaylistId: payload.state.playlists[0]?.id || 'pl_1',
        playlists: [],
        bgmVol: 85,
        bgmMode: 'all_loop',
        bgmXfade: 3.0,
        bgmMonoLink: 'off',
        outputMode: 'stereo',
        slotKeys: {}
      }, payload.state);

      this.applyOutputMode(0.02);
      await this.saveAppState();
      this.renderAll();
      document.getElementById('menuModal').classList.add('hidden');
      this.showToast('バックアップから全音源・設定を復元しました');
    } catch (err) {
      this.showToast(`復元エラー: ${err.message}`);
    }
  }

  arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // ==================== EVENT BINDINGS ====================
  bindUIEvents() {
    window.addEventListener('pointerdown', () => this.ensureAudioContext(), { once: true });

    document.getElementById('btnModeLive').addEventListener('click', () => {
      this.isEditMode = false;
      this.stopLibraryPreview();
      this.renderTopBarState();
      this.renderPadGrid();
      this.showToast('🟢 本番モード（タップで即発音）');
    });
    document.getElementById('btnModeEdit').addEventListener('click', () => {
      this.isEditMode = true;
      this.renderTopBarState();
      this.renderPadGrid();
      this.showToast('🛠️ 編集モード（短くタップで設定 / 長押しスワイプで場所入替）');
    });

    document.getElementById('selectGridSize').addEventListener('change', (e) => {
      const prevCount = this.getVisiblePadCount();
      this.state.gridSize = e.target.value;
      const newCount = this.getVisiblePadCount();
      // Stop any playing pads that became hidden after shrinking grid size
      if (newCount < prevCount) {
        const bank = this.getCurrentBank();
        if (bank) {
          for (let i = newCount; i < bank.pads.length; i++) {
            this.stopPadVoices(bank.pads[i].id, 0.05);
          }
        }
      }
      this.saveAppState();
      this.renderPadGrid();
    });

    document.getElementById('sliderMasterVol').addEventListener('input', (e) => {
      this.state.masterVol = Number(e.target.value);
      document.getElementById('labelMasterVol').textContent = `${this.state.masterVol}%`;
      this.updateMasterGainsSmooth(0.04);
      this.saveAppStateDebounced();
    });

    const outModeSel = document.getElementById('selectOutputMode');
    if (outModeSel) {
      outModeSel.addEventListener('change', (e) => {
        this.state.outputMode = e.target.value;
        outModeSel.classList.toggle('mono-active', this.state.outputMode !== 'stereo');
        this.applyOutputMode(0.02);
        this.saveAppState();
        const labels = {
          stereo: '🔊 ステレオ出力',
          mono_both: '🔈 モノラル L+R 出力',
          mono_l_only: '🔌 Lのみ出力 / R無音（バランス1本挿し対応）'
        };
        this.showToast(labels[this.state.outputMode] || this.state.outputMode);
      });
    }

    document.getElementById('selectMasterFadeSec').addEventListener('change', (e) => {
      this.state.masterFadeSec = Number(e.target.value);
      this.saveAppState();
    });
    document.getElementById('btnMasterFade').addEventListener('click', () => {
      this.fadeOutAllEverything(Number(this.state.masterFadeSec) || 3.0);
    });
    document.getElementById('btnPanic').addEventListener('click', () => {
      this.panicStopAll();
    });

    document.getElementById('btnToggleBgmDeck').addEventListener('click', (e) => {
      const deck = document.getElementById('bgmDeck');
      const collapsed = deck.classList.toggle('collapsed');
      e.currentTarget.classList.toggle('active', !collapsed);
    });

    const btnToggleLib = document.getElementById('btnToggleLibrary');
    if (btnToggleLib) {
      btnToggleLib.addEventListener('click', () => {
        const panel = document.getElementById('mediaLibraryPanel');
        const collapsed = panel.classList.toggle('collapsed');
        this.mediaLibrary.isOpen = !collapsed;
        btnToggleLib.classList.toggle('active', this.mediaLibrary.isOpen);
        if (this.mediaLibrary.isOpen && this.mediaLibrary.dirHandle) {
          this.scanWatchedDirectory(true);
          this.startLibraryWatchLoop();
        } else {
          this.stopLibraryWatchLoop();
          if (!this.mediaLibrary.isOpen) this.stopLibraryPreview();
        }
      });
    }

    const btnLibWatch = document.getElementById('btnLibWatchFolder');
    if (btnLibWatch) {
      btnLibWatch.addEventListener('click', () => this.pickWatchFolder());
    }
    const btnLibAdd = document.getElementById('btnLibAddFiles');
    if (btnLibAdd) {
      btnLibAdd.addEventListener('click', () => document.getElementById('inputLibFiles').click());
    }
    const btnLibRescan = document.getElementById('btnLibRescan');
    if (btnLibRescan) {
      btnLibRescan.addEventListener('click', () => this.scanWatchedDirectory(false));
    }
    const btnLibClear = document.getElementById('btnLibClear');
    if (btnLibClear) {
      btnLibClear.addEventListener('click', () => this.clearMediaLibrary());
    }
    const btnLibResume = document.getElementById('btnLibResumeWatch');
    if (btnLibResume) {
      btnLibResume.addEventListener('click', () => this.resumeWatchFolderPermission());
    }
    const inputLibFolder = document.getElementById('inputLibFolder');
    if (inputLibFolder) {
      inputLibFolder.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []);
        e.target.value = '';
        if (files.length > 0) await this.importFilesToLibraryPool(files);
      });
    }
    const inputLibFiles = document.getElementById('inputLibFiles');
    if (inputLibFiles) {
      inputLibFiles.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []);
        e.target.value = '';
        if (files.length > 0) await this.importFilesToLibraryPool(files);
      });
    }
    const inputLibSearch = document.getElementById('inputLibSearch');
    if (inputLibSearch) {
      inputLibSearch.addEventListener('input', (e) => {
        this.mediaLibrary.searchQuery = e.target.value.trim().toLowerCase();
        this.renderMediaLibrary();
      });
    }
    const selectLibFolder = document.getElementById('selectLibFolder');
    if (selectLibFolder) {
      selectLibFolder.addEventListener('change', (e) => {
        this.mediaLibrary.folderFilter = e.target.value;
        this.renderMediaLibrary();
      });
    }

    document.getElementById('btnAddBank').addEventListener('click', async () => {
      const name = await this.showPromptDialog('バンク追加', '新しい進行バンク（セットリスト）の名前を入力してください:', `${this.state.banks.length + 1}. 新規コーナー`);
      if (!name) return;
      const newBank = this.createDefaultBank(`bank_${Date.now()}`, name.trim());
      this.state.banks.push(newBank);
      this.state.currentBankId = newBank.id;
      this.saveAppState();
      this.renderBankTabs();
      this.renderPadGrid();
    });

    document.getElementById('btnRenameBank').addEventListener('click', async () => {
      const bank = this.getCurrentBank();
      if (!bank) return;
      const name = await this.showPromptDialog('バンク名変更', '新しいバンク名を入力してください:', bank.name);
      if (!name) return;
      bank.name = name.trim();
      this.saveAppState();
      this.renderBankTabs();
    });

    document.getElementById('btnDeleteBank').addEventListener('click', async () => {
      if (this.state.banks.length <= 1) {
        this.showToast('最低1つのバンクが必要です');
        return;
      }
      const bank = this.getCurrentBank();
      const ok = await this.showConfirmDialog('バンク削除', `バンク「${bank.name}」を削除しますか？`);
      if (!ok) return;
      for (const p of bank.pads) {
        this.stopPadVoices(p.id, 0.04);
      }
      const curIdx = this.state.banks.findIndex((b) => b.id === bank.id);
      this.state.banks = this.state.banks.filter((b) => b.id !== bank.id);
      const nextIdx = Math.min(curIdx, this.state.banks.length - 1);
      this.state.currentBankId = this.state.banks[nextIdx].id;
      await this.saveAppState();
      this.gcOrphanAudioFiles();
      this.renderBankTabs();
      this.renderPadGrid();
    });

    document.getElementById('btnBatchImport').addEventListener('click', () => {
      document.getElementById('inputBatchAudio').click();
    });
    document.getElementById('inputBatchAudio').addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;
      const bank = this.getCurrentBank();
      const visibleCount = this.getVisiblePadCount();
      let importedCount = 0;
      let xfadeAutoCount = 0;
      let skippedCount = 0;
      const isBulk = files.length >= 3;
      for (let fIdx = 0; fIdx < files.length; fIdx++) {
        const file = files[fIdx];
        const emptyPad = bank.pads.slice(0, visibleCount).find((p) => !p.audioId);
        if (!emptyPad) {
          skippedCount = files.length - fIdx;
          break;
        }
        try {
          if (isBulk) this.showToast(`読み込み中... (${fIdx + 1}/${files.length})`);
          const info = await this.importAudioFileToRecord(file, !isBulk);
          emptyPad.name = info.name;
          emptyPad.audioId = info.audioId;
          emptyPad.trimStart = 0;
          emptyPad.trimEnd = Number(info.duration.toFixed(2));
          if (info.duration >= 30) {
            emptyPad.triggerMode = 'xfade';
            xfadeAutoCount++;
          }
          importedCount++;
        } catch (err) {
          this.showToast(err.message);
        }
      }
      e.target.value = '';
      await this.saveAppState();
      this.renderPadGrid();
      const xfadeSuffix = xfadeAutoCount > 0 ? `（うち30秒以上の${xfadeAutoCount}件をX-FADEに設定）` : '';
      const skipSuffix = skippedCount > 0 ? ` ※空きパッド不足で${skippedCount}件スキップ` : '';
      this.showToast(`${importedCount}件の音源を割り当てました${xfadeSuffix}${skipSuffix}`);
    });

    document.getElementById('selectPlaylist').addEventListener('change', (e) => {
      this.state.currentPlaylistId = e.target.value;
      if (!this.bgmPlayer.isPlaying) {
        this.bgmPlayer.playingPlaylistId = this.state.currentPlaylistId;
        this.bgmPlayer.currentTrackIndex = 0;
        this.bgmPlayer.pausedAtOffset = 0;
      }
      this.saveAppState();
      this.renderBgmTrackList();
      this.updateBgmTransportUI();
    });

    document.getElementById('btnAddPlaylist').addEventListener('click', async () => {
      const name = await this.showPromptDialog('プレイリスト追加', '新しいBGMプレイリストの名前を入力してください:', '新規BGMプレイリスト');
      if (!name) return;
      const pl = { id: `pl_${Date.now()}`, name: name.trim(), tracks: [] };
      this.state.playlists.push(pl);
      this.state.currentPlaylistId = pl.id;
      if (!this.bgmPlayer.isPlaying) {
        this.bgmPlayer.playingPlaylistId = pl.id;
        this.bgmPlayer.currentTrackIndex = 0;
        this.bgmPlayer.pausedAtOffset = 0;
      }
      this.saveAppState();
      this.renderPlaylistSelector();
      this.renderBgmTrackList();
      this.updateBgmTransportUI();
    });

    document.getElementById('btnRenamePlaylist').addEventListener('click', async () => {
      const pl = this.getCurrentPlaylist();
      if (!pl) return;
      const name = await this.showPromptDialog('プレイリスト名変更', '新しいプレイリスト名を入力してください:', pl.name);
      if (!name) return;
      pl.name = name.trim();
      this.saveAppState();
      this.renderPlaylistSelector();
      this.updateBgmTransportUI();
    });

    document.getElementById('btnDeletePlaylist').addEventListener('click', async () => {
      if (this.state.playlists.length <= 1) {
        this.showToast('最低1つのプレイリストが必要です');
        return;
      }
      const pl = this.getCurrentPlaylist();
      const ok = await this.showConfirmDialog('プレイリスト削除', `プレイリスト「${pl.name}」を削除しますか？`);
      if (!ok) return;
      if (this.bgmPlayer.playingPlaylistId === pl.id) {
        this.stopBgmImmediately();
      }
      this.state.playlists = this.state.playlists.filter((p) => p.id !== pl.id);
      this.state.currentPlaylistId = this.state.playlists[0].id;
      if (!this.bgmPlayer.isPlaying) {
        this.bgmPlayer.playingPlaylistId = this.state.currentPlaylistId;
        this.bgmPlayer.currentTrackIndex = 0;
      }
      await this.saveAppState();
      this.gcOrphanAudioFiles();
      this.renderPlaylistSelector();
      this.renderBgmTrackList();
      this.updateBgmTransportUI();
    });

    document.getElementById('btnAddBgmFiles').addEventListener('click', () => {
      document.getElementById('inputBgmAudio').click();
    });
    document.getElementById('inputBgmAudio').addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;
      const pl = this.getCurrentPlaylist();
      let added = 0;
      for (let fIdx = 0; fIdx < files.length; fIdx++) {
        const file = files[fIdx];
        try {
          if (files.length >= 2) this.showToast(`BGM読み込み中... (${fIdx + 1}/${files.length})`);
          // keepInRam = false for bulk BGM imports to prevent iPadOS OOM crash when adding 10+ songs
          const info = await this.importAudioFileToRecord(file, files.length === 1);
          pl.tracks.push({
            id: `trk_${Date.now()}_${added}`,
            name: info.name,
            audioId: info.audioId,
            gain: 90,
            trimStart: 0,
            trimEnd: Number(info.duration.toFixed(2)),
            fadeIn: 0.5,
            fadeOut: 2.5,
            speed: 1.0,
            pitch: 0
          });
          added++;
          // Save incrementally every 3 tracks so progress is never lost
          if (added % 3 === 0) {
            await this.saveAppState();
          }
        } catch (err) {
          this.showToast(err.message);
        }
      }
      e.target.value = '';
      await this.saveAppState();
      this.renderPlaylistSelector();
      this.renderBgmTrackList();
      this.updateBgmTransportUI();
      this.showToast(`プレイリストに ${added}曲 追加しました`);
    });

    document.getElementById('btnBgmPlayPause').addEventListener('click', () => {
      this.toggleBgmPlayPause();
    });
    document.getElementById('btnBgmFadeStop').addEventListener('click', () => {
      this.fadeStopBgm();
    });
    document.getElementById('btnBgmPrev').addEventListener('click', () => {
      const pl = this.getPlayingPlaylist();
      if (!pl || pl.tracks.length === 0) return;
      const xfade = this.bgmPlayer.isPlaying ? Number(this.state.bgmXfade) || 0 : 0;
      this.playBgmTrack(this.bgmPlayer.currentTrackIndex - 1, xfade, pl.id);
    });
    document.getElementById('btnBgmNext').addEventListener('click', () => {
      const pl = this.getPlayingPlaylist();
      if (!pl || pl.tracks.length === 0) return;
      const xfade = this.bgmPlayer.isPlaying ? Number(this.state.bgmXfade) || 0 : 0;
      this.playBgmTrack(this.bgmPlayer.currentTrackIndex + 1, xfade, pl.id);
    });

    const seekSliderEl = document.getElementById('sliderBgmSeek');
    const beginBgmSeek = () => {
      this.bgmPlayer.isSeeking = true;
    };
    const commitBgmSeek = () => {
      if (!this.bgmPlayer.isSeeking) return;
      const ratio = Number(seekSliderEl.value) / 1000;
      this.bgmPlayer.isSeeking = false;
      this.seekBgmToRatio(ratio);
    };

    seekSliderEl.addEventListener('pointerdown', beginBgmSeek);
    seekSliderEl.addEventListener('touchstart', beginBgmSeek, { passive: true });
    seekSliderEl.addEventListener('mousedown', beginBgmSeek);

    seekSliderEl.addEventListener('input', (e) => {
      this.bgmPlayer.isSeeking = true;
      const ratio = Number(e.target.value) / 1000;
      this.previewSeekBgmByRatio(ratio, true);
      const nowMs = performance.now();
      if (this.bgmPlayer.isPlaying && nowMs - this.bgmPlayer.lastScrubTime > 90) {
        this.bgmPlayer.lastScrubTime = nowMs;
        this.seekBgmToRatio(ratio);
      }
    });

    seekSliderEl.addEventListener('change', (e) => {
      if (!this.bgmPlayer.isSeeking) return;
      const ratio = Number(e.target.value) / 1000;
      this.bgmPlayer.isSeeking = false;
      this.seekBgmToRatio(ratio);
    });
    seekSliderEl.addEventListener('pointerup', commitBgmSeek);
    seekSliderEl.addEventListener('pointercancel', commitBgmSeek);
    seekSliderEl.addEventListener('touchend', commitBgmSeek);
    seekSliderEl.addEventListener('mouseup', commitBgmSeek);

    document.getElementById('btnTalkOver').addEventListener('click', (e) => {
      this.isTalkOver = !this.isTalkOver;
      e.currentTarget.classList.toggle('active', this.isTalkOver);
      this.updateMasterGainsSmooth(0.25);
      this.showToast(this.isTalkOver ? '🎙️ TALK OVER ON (BGM音量を25%へ減衰中)' : '🎙️ TALK OVER OFF (BGM音量を復帰)');
    });

    document.getElementById('sliderBgmVol').addEventListener('input', (e) => {
      this.state.bgmVol = Number(e.target.value);
      document.getElementById('labelBgmVol').textContent = `${this.state.bgmVol}%`;
      this.updateMasterGainsSmooth(0.05);
      this.saveAppStateDebounced();
    });

    document.getElementById('selectBgmMode').addEventListener('change', (e) => {
      this.state.bgmMode = e.target.value;
      this.saveAppState();
    });

    document.getElementById('selectBgmXfade').addEventListener('change', (e) => {
      this.state.bgmXfade = Number(e.target.value);
      this.saveAppState();
    });

    document.getElementById('selectBgmMonoLink').addEventListener('change', (e) => {
      this.state.bgmMonoLink = e.target.value;
      this.saveAppState();
      const labelMap = { off: 'OFF', stop: '排他 (即停止)', fade: '排他 (フェード)' };
      this.showToast(`BGMデッキ MONO連動: ${labelMap[e.target.value] || e.target.value}`);
    });

    // ==================== EDITOR MODAL EVENTS ====================
    document.getElementById('btnCloseEditor').addEventListener('click', () => {
      this.stopEditorPreview();
      document.getElementById('editorModal').classList.add('hidden');
    });

    document.getElementById('btnChangeAudioFile').addEventListener('click', () => {
      document.getElementById('inputSingleAudio').click();
    });

    document.getElementById('inputSingleAudio').addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file || !this.editorDraft) return;
      try {
        const info = await this.importAudioFileToRecord(file);
        this.editorDraft.audioId = info.audioId;
        this.editorDraft.name = info.name;
        this.editorDraft.trimStart = 0;
        this.editorDraft.trimEnd = Number(info.duration.toFixed(2));
        const isLongAudio = info.duration >= 30 && (!this.editorTarget || this.editorTarget.type === 'pad');
        if (isLongAudio) {
          this.editorDraft.triggerMode = 'xfade';
        }
        this.populateEditorModalFields();
        this.drawEditorWaveform();
        this.showToast(
          isLongAudio
            ? `「${info.name}」を読み込みました（30秒以上のため X-FADE を自動選択）`
            : `「${info.name}」を読み込みました`
        );
      } catch (err) {
        this.showToast(err.message);
      }
      e.target.value = '';
    });

    const syncTrimStart = (val) => {
      if (!this.editorDraft) return;
      const maxEnd = Number(this.editorDraft.trimEnd) || 100;
      const v = Math.max(0, Math.min(maxEnd - 0.02, Number(val) || 0));
      this.editorDraft.trimStart = Number(v.toFixed(2));
      document.getElementById('sliderTrimStart').value = this.editorDraft.trimStart;
      document.getElementById('numTrimStart').value = this.editorDraft.trimStart.toFixed(2);
      this.drawEditorWaveform();
    };

    const syncTrimEnd = (val) => {
      if (!this.editorDraft) return;
      const buf = this.editorDraft.audioId ? this.audioBuffers.get(this.editorDraft.audioId) : null;
      const maxDur = buf ? buf.duration : 100;
      const minStart = Number(this.editorDraft.trimStart) || 0;
      const v = Math.max(minStart + 0.02, Math.min(maxDur, Number(val) || maxDur));
      this.editorDraft.trimEnd = Number(v.toFixed(2));
      document.getElementById('sliderTrimEnd').value = this.editorDraft.trimEnd;
      document.getElementById('numTrimEnd').value = this.editorDraft.trimEnd.toFixed(2);
      this.drawEditorWaveform();
    };

    document.getElementById('sliderTrimStart').addEventListener('input', (e) => syncTrimStart(e.target.value));
    document.getElementById('numTrimStart').addEventListener('change', (e) => syncTrimStart(e.target.value));
    document.getElementById('sliderTrimEnd').addEventListener('input', (e) => syncTrimEnd(e.target.value));
    document.getElementById('numTrimEnd').addEventListener('change', (e) => syncTrimEnd(e.target.value));

    const wfCanvas = document.getElementById('waveformCanvas');
    const getCanvasTime = (e) => {
      const rect = wfCanvas.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const buf = this.editorDraft && this.editorDraft.audioId
        ? this.audioBuffers.get(this.editorDraft.audioId)
        : null;
      if (!buf) return 0;
      const { viewStart, viewDur } = this.getWaveformViewWindow(buf.duration);
      return Math.max(0, Math.min(buf.duration, viewStart + ratio * viewDur));
    };

    wfCanvas.addEventListener('wheel', (e) => {
      if (!this.editorDraft || !this.editorDraft.audioId) return;
      e.preventDefault();
      const rect = wfCanvas.getBoundingClientRect();
      const mouseRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const buf = this.audioBuffers.get(this.editorDraft.audioId);
      if (!buf) return;
      const { startFrac, endFrac } = this.getWaveformViewWindow(buf.duration);
      const focusFrac = startFrac + mouseRatio * (endFrac - startFrac);
      const clampedDelta = Math.max(-180, Math.min(180, e.deltaY));
      const factor = Math.pow(1.003, -clampedDelta);
      this.setEditorZoom(this.editorZoom * factor, focusFrac);
    }, { passive: false });

    document.getElementById('btnZoomIn').addEventListener('click', () => {
      this.setEditorZoom(this.editorZoom * 2);
    });
    document.getElementById('btnZoomOut').addEventListener('click', () => {
      this.setEditorZoom(this.editorZoom / 2);
    });
    document.getElementById('btnZoomReset').addEventListener('click', () => {
      this.setEditorZoom(1, 0);
    });
    document.getElementById('btnZoomFocusIn').addEventListener('click', () => {
      if (this.editorDraft) this.focusEditorZoomOnTime(Number(this.editorDraft.trimStart) || 0);
    });
    document.getElementById('btnZoomFocusOut').addEventListener('click', () => {
      if (this.editorDraft) this.focusEditorZoomOnTime(Number(this.editorDraft.trimEnd) || 0);
    });
    document.getElementById('sliderWaveformPan').addEventListener('input', (e) => {
      const maxPan = Math.max(0, 1 - 1 / Math.max(1, this.editorZoom));
      this.editorPanStart = (Number(e.target.value) / 1000) * maxPan;
      this.drawEditorWaveform();
    });

    // Multi-touch pinch-to-zoom + handle proximity grab / pan on Waveform Canvas
    const activeWfPointers = new Map();
    let pinchStartDist = 0;
    let pinchStartZoom = 1;
    let panDragStartX = 0;
    let panDragStartOffset = 0;

    wfCanvas.addEventListener('pointerdown', (e) => {
      if (!this.editorDraft || !this.editorDraft.audioId) return;
      const buf = this.audioBuffers.get(this.editorDraft.audioId);
      if (!buf) return;

      activeWfPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { wfCanvas.setPointerCapture(e.pointerId); } catch (_) {}

      // 2-finger pinch zoom start
      if (activeWfPointers.size === 2) {
        this.draggingTrimHandle = null;
        const pts = Array.from(activeWfPointers.values());
        pinchStartDist = Math.max(10, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y));
        pinchStartZoom = this.editorZoom || 1;
        return;
      }

      const rect = wfCanvas.getBoundingClientRect();
      const { viewStart, viewDur } = this.getWaveformViewWindow(buf.duration);
      const clickX = e.clientX - rect.left;
      const startX = (((Number(this.editorDraft.trimStart) || 0) - viewStart) / viewDur) * rect.width;
      const endX = (((Number(this.editorDraft.trimEnd) || buf.duration) - viewStart) / viewDur) * rect.width;
      const distStartPx = Math.abs(clickX - startX);
      const distEndPx = Math.abs(clickX - endX);

      // When zoomed in, only grab handles within ±26px; dragging elsewhere pans the waveform
      if (this.editorZoom > 1.05 && distStartPx > 26 && distEndPx > 26) {
        this.draggingTrimHandle = 'pan';
        panDragStartX = e.clientX;
        panDragStartOffset = this.editorPanStart;
        return;
      }

      this.draggingTrimHandle = distStartPx <= distEndPx ? 'start' : 'end';
      const t = getCanvasTime(e);
      if (this.draggingTrimHandle === 'start') syncTrimStart(t);
      else syncTrimEnd(t);
    });

    wfCanvas.addEventListener('pointermove', (e) => {
      if (activeWfPointers.has(e.pointerId)) {
        activeWfPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }
      // 2-finger pinch zoom update
      if (activeWfPointers.size === 2 && pinchStartDist > 0) {
        const pts = Array.from(activeWfPointers.values());
        const dist = Math.max(10, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y));
        const rect = wfCanvas.getBoundingClientRect();
        const midRatio = Math.max(0, Math.min(1, ((pts[0].x + pts[1].x) / 2 - rect.left) / rect.width));
        const buf = this.editorDraft && this.audioBuffers.get(this.editorDraft.audioId);
        if (buf) {
          const { startFrac, endFrac } = this.getWaveformViewWindow(buf.duration);
          const focusFrac = startFrac + midRatio * (endFrac - startFrac);
          this.setEditorZoom(pinchStartZoom * (dist / pinchStartDist), focusFrac);
        }
        return;
      }

      if (!this.draggingTrimHandle) return;
      if (this.draggingTrimHandle === 'pan') {
        const rect = wfCanvas.getBoundingClientRect();
        const dxFrac = (e.clientX - panDragStartX) / rect.width;
        const spanFrac = 1 / Math.max(1, this.editorZoom);
        const maxPan = Math.max(0, 1 - spanFrac);
        this.editorPanStart = Math.max(0, Math.min(maxPan, panDragStartOffset - dxFrac * spanFrac));
        this.updateWaveformZoomUI();
        this.drawEditorWaveform();
        return;
      }
      const t = getCanvasTime(e);
      if (this.draggingTrimHandle === 'start') syncTrimStart(t);
      else syncTrimEnd(t);
    });

    const endCanvasDrag = (e) => {
      if (e && e.pointerId !== undefined) activeWfPointers.delete(e.pointerId);
      if (activeWfPointers.size < 2) pinchStartDist = 0;
      if (activeWfPointers.size === 0) this.draggingTrimHandle = null;
    };
    wfCanvas.addEventListener('pointerup', endCanvasDrag);
    wfCanvas.addEventListener('pointercancel', endCanvasDrag);

    document.getElementById('btnAutoTrimSilence').addEventListener('click', () => this.autoTrimSilenceInEditor());
    document.getElementById('btnAutoNormalize').addEventListener('click', () => this.autoNormalizeInEditor());
    document.getElementById('btnResetTrim').addEventListener('click', () => {
      if (!this.editorDraft) return;
      const buf = this.editorDraft.audioId ? this.audioBuffers.get(this.editorDraft.audioId) : null;
      this.editorDraft.trimStart = 0;
      this.editorDraft.trimEnd = buf ? Number(buf.duration.toFixed(2)) : 0;
      this.editorDraft.gain = 100;
      this.editorDraft.fadeIn = 0;
      this.editorDraft.fadeOut = 2.0;
      this.editorDraft.speed = 1.0;
      this.editorDraft.pitch = 0;
      this.populateEditorModalFields();
      this.drawEditorWaveform();
    });

    document.getElementById('btnPreviewPlay').addEventListener('click', () => this.startEditorPreview());
    document.getElementById('btnPreviewStop').addEventListener('click', () => this.stopEditorPreview());

    document.getElementById('sliderEditGain').addEventListener('input', (e) => {
      this.editorDraft.gain = Number(e.target.value);
      document.getElementById('labelEditGain').textContent = `${this.editorDraft.gain}%`;
      this.drawEditorWaveform();
    });
    document.getElementById('sliderEditFadeIn').addEventListener('input', (e) => {
      this.editorDraft.fadeIn = Number(e.target.value);
      document.getElementById('labelEditFadeIn').textContent = `${this.editorDraft.fadeIn.toFixed(1)}秒`;
      this.drawEditorWaveform();
    });
    document.getElementById('sliderEditFadeOut').addEventListener('input', (e) => {
      this.editorDraft.fadeOut = Number(e.target.value);
      document.getElementById('labelEditFadeOut').textContent = `${this.editorDraft.fadeOut.toFixed(1)}秒`;
      this.drawEditorWaveform();
    });
    document.getElementById('sliderEditSpeed').addEventListener('input', (e) => {
      this.editorDraft.speed = Number(e.target.value);
      document.getElementById('labelEditSpeed').textContent = `${this.editorDraft.speed.toFixed(2)}x`;
    });
    document.getElementById('sliderEditPitch').addEventListener('input', (e) => {
      this.editorDraft.pitch = Number(e.target.value);
      const p = this.editorDraft.pitch;
      document.getElementById('labelEditPitch').textContent = `${p > 0 ? '+' : ''}${p} 半音`;
    });

    document.getElementById('btnClearTarget').addEventListener('click', async () => {
      if (!this.editorTarget || this.editorTarget.type !== 'pad') return;
      this.stopEditorPreview();
      const idx = this.editorTarget.padIndex;
      const bank = this.getCurrentBank();
      if (bank.pads[idx]) {
        this.stopPadVoices(bank.pads[idx].id, 0.03);
      }
      bank.pads[idx] = this.createDefaultPad(idx);
      this.editorDraft = null;
      await this.saveAppState();
      this.gcOrphanAudioFiles();
      document.getElementById('editorModal').classList.add('hidden');
      this.renderPadGrid();
      this.showToast(`PAD #${idx + 1} を空にしました`);
    });

    document.getElementById('btnSaveEditor').addEventListener('click', () => this.saveEditorChanges());

    // ==================== MENU / BACKUP MODAL EVENTS ====================
    document.getElementById('btnOpenBackupModal').addEventListener('click', () => {
      document.getElementById('menuModal').classList.remove('hidden');
    });
    document.getElementById('btnCloseMenuModal').addEventListener('click', () => {
      document.getElementById('menuModal').classList.add('hidden');
    });
    document.getElementById('btnUpdateAppCache').addEventListener('click', () => {
      this.updateAppCache();
    });
    document.getElementById('btnExportBackup').addEventListener('click', () => {
      this.exportFullBackup();
    });
    document.getElementById('btnImportBackup').addEventListener('click', () => {
      document.getElementById('inputRestoreBackup').click();
    });
    document.getElementById('inputRestoreBackup').addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) this.importFullBackup(file);
      e.target.value = '';
    });
    document.getElementById('btnFactoryReset').addEventListener('click', async () => {
      const ok = await this.showConfirmDialog('全データの初期化', 'すべての音源と設定を初期状態（初期サンプル構成）にリセットしますか？');
      if (!ok) return;
      this.panicStopAll();
      await this.db.clearAll();
      location.reload();
    });

    // ==================== EXTERNAL KEYBOARD SHORTCUTS (POSITION-BASED & IME-SAFE) ====================
    const resolveKeyChar = (e) => {
      if (e.code) {
        if (/^Key([A-Z])$/.test(e.code)) return e.code.slice(3);
        if (/^Digit([0-9])$/.test(e.code)) return e.code.slice(5);
      }
      return String(e.key || '').toUpperCase();
    };

    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

      const dialogOpen = !document.getElementById('dialogModal').classList.contains('hidden');
      const editorOpen = !document.getElementById('editorModal').classList.contains('hidden');
      const menuOpen = !document.getElementById('menuModal').classList.contains('hidden');

      if (e.key === 'Escape') {
        e.preventDefault();
        if (dialogOpen) {
          document.getElementById('btnDialogCancel').click();
        } else if (editorOpen) {
          this.stopEditorPreview();
          document.getElementById('editorModal').classList.add('hidden');
        } else if (menuOpen) {
          document.getElementById('menuModal').classList.add('hidden');
        } else {
          this.panicStopAll();
        }
        return;
      }

      if (dialogOpen || editorOpen || menuOpen) return;
      if (e.repeat) return;

      const pressed = resolveKeyChar(e);
      const bank = this.getCurrentBank();
      if (!bank) return;
      const count = this.getVisiblePadCount();
      for (let i = 0; i < count; i++) {
        if (this.getSlotKey(i) === pressed) {
          e.preventDefault();
          const pad = bank.pads[i];
          if (pad && pad.triggerMode === 'gate') {
            this.gatePressedPads.add(pad.id);
          }
          this.triggerPad(i);
          break;
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      const released = resolveKeyChar(e);
      const bank = this.getCurrentBank();
      if (!bank) return;
      const count = this.getVisiblePadCount();
      for (let i = 0; i < count; i++) {
        const pad = bank.pads[i];
        if (pad && this.getSlotKey(i) === released && pad.triggerMode === 'gate') {
          this.gatePressedPads.delete(pad.id);
          const gateRel = Math.min(0.2, Math.max(0.02, safeNum(pad.fadeOut, 0.08)));
          this.stopPadVoices(pad.id, gateRel);
        }
      }
    });
  }

  // ==================== MEDIA LIBRARY (HYBRID PC FOLDER WATCH + IPAD POOL) ====================
  isSupportedAudioFilename(filename) {
    const ext = (String(filename).split('.').pop() || '').toLowerCase();
    return ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'webm', 'opus', 'aiff', 'aif'].includes(ext);
  }

  async initMediaLibrary() {
    try {
      const records = await this.db.getAllLibraryItems();
      const pool = [];
      let savedHandleRec = null;

      for (const rec of records) {
        if (rec.id === 'dir_handle' && rec.type === 'handle' && rec.handle) {
          savedHandleRec = rec;
        } else if (rec.type === 'pool_file') {
          pool.push({
            id: rec.id,
            source: 'pool',
            name: rec.name,
            ext: rec.ext || '',
            folder: rec.folder || '',
            relPath: rec.relPath || rec.name,
            mimeType: rec.mimeType || 'audio/mpeg',
            size: rec.size || 0
          });
        }
      }

      pool.sort((a, b) => a.relPath.localeCompare(b.relPath, 'ja', { numeric: true }));
      this.mediaLibrary.poolItems = pool;

      if (savedHandleRec && 'showDirectoryPicker' in window) {
        this.mediaLibrary.dirHandle = savedHandleRec.handle;
        this.mediaLibrary.dirName = savedHandleRec.name || savedHandleRec.handle.name || 'フォルダ';
        try {
          const perm = await savedHandleRec.handle.queryPermission({ mode: 'read' });
          if (perm === 'granted') {
            await this.scanWatchedDirectory(true);
          } else {
            const banner = document.getElementById('libraryPermissionBanner');
            const btn = document.getElementById('btnLibResumeWatch');
            if (btn) btn.textContent = `🔓 「${this.mediaLibrary.dirName}」の監視を再開`;
            if (banner) banner.classList.remove('hidden');
          }
        } catch (_) { }
      }

      this.renderMediaLibrary();
    } catch (_) { }
  }

  async pickWatchFolder() {
    if ('showDirectoryPicker' in window) {
      try {
        const handle = await window.showDirectoryPicker({ mode: 'read' });
        this.mediaLibrary.dirHandle = handle;
        this.mediaLibrary.dirName = handle.name;
        this.mediaLibrary.lastSignature = '';
        await this.db.saveLibraryItem({
          id: 'dir_handle',
          type: 'handle',
          handle,
          name: handle.name
        });
        const banner = document.getElementById('libraryPermissionBanner');
        if (banner) banner.classList.add('hidden');
        await this.scanWatchedDirectory(false);
        this.startLibraryWatchLoop();
      } catch (err) {
        if (err && err.name !== 'AbortError') {
          this.showToast(`フォルダ読み込みエラー: ${err.message}`);
        }
      }
    } else {
      // iPadOS Safari fallback: folder/multi-file picker into IndexedDB Media Library pool
      const folderInput = document.getElementById('inputLibFolder');
      if (folderInput) folderInput.click();
    }
  }

  async resumeWatchFolderPermission() {
    const handle = this.mediaLibrary.dirHandle;
    if (!handle) return;
    try {
      const perm = await handle.requestPermission({ mode: 'read' });
      if (perm === 'granted') {
        const banner = document.getElementById('libraryPermissionBanner');
        if (banner) banner.classList.add('hidden');
        await this.scanWatchedDirectory(false);
        this.startLibraryWatchLoop();
      }
    } catch (err) {
      this.showToast(`権限取得エラー: ${err.message}`);
    }
  }

  async scanWatchedDirectory(silent = false) {
    const rootHandle = this.mediaLibrary.dirHandle;
    if (!rootHandle || this.mediaLibrary.isScanning) return;
    this.mediaLibrary.isScanning = true;

    try {
      const found = [];
      const walk = async (dirHandle, prefix, depth) => {
        if (depth > 6) return;
        for await (const [entryName, handle] of dirHandle.entries()) {
          if (entryName.startsWith('.')) continue;
          if (handle.kind === 'directory') {
            await walk(handle, prefix ? `${prefix}/${entryName}` : entryName, depth + 1);
          } else if (handle.kind === 'file' && this.isSupportedAudioFilename(entryName)) {
            let size = 0;
            let lastModified = 0;
            try {
              const f = await handle.getFile();
              size = f.size;
              lastModified = f.lastModified;
            } catch (_) { }
            const ext = (entryName.split('.').pop() || '').toUpperCase();
            const cleanName = entryName.replace(/\.[^/.]+$/, '');
            const relPath = prefix ? `${prefix}/${entryName}` : entryName;
            found.push({
              id: `fs_${relPath}`,
              source: 'fs',
              name: cleanName,
              ext,
              folder: prefix || '',
              relPath,
              fileHandle: handle,
              size,
              lastModified
            });
          }
        }
      };

      await walk(rootHandle, '', 0);
      found.sort((a, b) => a.relPath.localeCompare(b.relPath, 'ja', { numeric: true }));

      const sig = found.map((f) => `${f.relPath}:${f.size}:${f.lastModified}`).join('|');
      if (silent && sig === this.mediaLibrary.lastSignature) {
        return;
      }

      this.mediaLibrary.lastSignature = sig;
      this.mediaLibrary.fsItems = found;
      this.renderMediaLibrary();
      if (!silent) {
        this.showToast(`📂 「${this.mediaLibrary.dirName}」から ${found.length}件 を検出しました`);
      }
    } catch (err) {
      if (!silent) {
        this.showToast(`フォルダスキャン失敗: ${err.message}`);
      }
    } finally {
      this.mediaLibrary.isScanning = false;
    }
  }

  startLibraryWatchLoop() {
    this.stopLibraryWatchLoop();
    if (!this.mediaLibrary.dirHandle) return;
    this.mediaLibrary.watchTimer = setInterval(() => {
      if (this.mediaLibrary.isOpen && !document.hidden && this.mediaLibrary.dirHandle) {
        this.scanWatchedDirectory(true);
      }
    }, 5000);
  }

  stopLibraryWatchLoop() {
    if (this.mediaLibrary.watchTimer) {
      clearInterval(this.mediaLibrary.watchTimer);
      this.mediaLibrary.watchTimer = null;
    }
  }

  async importFilesToLibraryPool(files) {
    const audioFiles = files.filter((f) => this.isSupportedAudioFilename(f.name) || (f.type && f.type.startsWith('audio/')));
    if (audioFiles.length === 0) {
      this.showToast('再生可能な音声ファイルが見つかりませんでした');
      return;
    }

    let added = 0;
    for (let i = 0; i < audioFiles.length; i++) {
      const file = audioFiles[i];
      try {
        if (audioFiles.length >= 3 && (i === 0 || (i + 1) % 5 === 0)) {
          this.showToast(`ライブラリへ登録中... (${i + 1}/${audioFiles.length})`);
        }
        const rel = file.webkitRelativePath || file.name;
        const parts = rel.split('/');
        const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
        const ext = (file.name.split('.').pop() || '').toUpperCase();
        const cleanName = file.name.replace(/\.[^/.]+$/, '');
        const id = `pool_${rel}_${file.size}`;
        const arrayBuffer = await file.arrayBuffer();

        await this.db.saveLibraryItem({
          id,
          type: 'pool_file',
          name: cleanName,
          ext,
          folder,
          relPath: rel,
          mimeType: file.type || 'audio/mpeg',
          size: file.size,
          arrayBuffer
        });

        const existingIdx = this.mediaLibrary.poolItems.findIndex((x) => x.id === id);
        const meta = {
          id,
          source: 'pool',
          name: cleanName,
          ext,
          folder,
          relPath: rel,
          mimeType: file.type || 'audio/mpeg',
          size: file.size
        };
        if (existingIdx >= 0) this.mediaLibrary.poolItems[existingIdx] = meta;
        else this.mediaLibrary.poolItems.push(meta);
        added++;
      } catch (_) { }
    }

    this.mediaLibrary.poolItems.sort((a, b) => a.relPath.localeCompare(b.relPath, 'ja', { numeric: true }));
    this.renderMediaLibrary();
    this.showToast(`📚 ライブラリに ${added}件 追加しました`);
  }

  async clearMediaLibrary() {
    const total = this.mediaLibrary.fsItems.length + this.mediaLibrary.poolItems.length;
    if (total === 0 && !this.mediaLibrary.dirHandle) {
      this.showToast('ライブラリはすでに空です');
      return;
    }
    const ok = await this.showConfirmDialog(
      'ライブラリをクリア',
      'メディアライブラリの一覧と監視フォルダ設定をクリアしますか？（パッドやBGMに登録済みの音源は消えません）'
    );
    if (!ok) return;

    this.stopLibraryWatchLoop();
    this.stopLibraryPreview();
    await this.db.clearLibraryItems();
    this.mediaLibrary.dirHandle = null;
    this.mediaLibrary.dirName = '';
    this.mediaLibrary.fsItems = [];
    this.mediaLibrary.poolItems = [];
    this.mediaLibrary.lastSignature = '';
    this.mediaLibrary.folderFilter = '';
    const banner = document.getElementById('libraryPermissionBanner');
    if (banner) banner.classList.add('hidden');
    this.renderMediaLibrary();
    this.showToast('メディアライブラリをクリアしました');
  }

  renderMediaLibrary() {
    const listEl = document.getElementById('libraryTrackList');
    const sourceLabel = document.getElementById('librarySourceLabel');
    const rescanBtn = document.getElementById('btnLibRescan');
    const folderSel = document.getElementById('selectLibFolder');
    const countLabel = document.getElementById('libraryCountLabel');
    if (!listEl) return;

    const allItems = [...this.mediaLibrary.fsItems, ...this.mediaLibrary.poolItems];

    if (sourceLabel) {
      if (this.mediaLibrary.dirHandle) {
        sourceLabel.textContent = `監視中: ${this.mediaLibrary.dirName}`;
      } else if (this.mediaLibrary.poolItems.length > 0) {
        sourceLabel.textContent = `ライブラリプール`;
      } else {
        sourceLabel.textContent = 'フォルダ未指定';
      }
    }
    if (rescanBtn) {
      rescanBtn.classList.toggle('hidden', !this.mediaLibrary.dirHandle);
    }

    // Update folder filter dropdown
    if (folderSel) {
      const folders = Array.from(new Set(allItems.map((it) => it.folder).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ja', { numeric: true }));
      const prevVal = this.mediaLibrary.folderFilter;
      folderSel.innerHTML = '<option value="">すべてのフォルダ</option>';
      for (const f of folders) {
        const opt = document.createElement('option');
        opt.value = f;
        opt.textContent = `📁 ${f}`;
        folderSel.appendChild(opt);
      }
      folderSel.value = folders.includes(prevVal) ? prevVal : '';
      this.mediaLibrary.folderFilter = folderSel.value;
    }

    const q = this.mediaLibrary.searchQuery;
    const fFilter = this.mediaLibrary.folderFilter;
    const filtered = allItems.filter((it) => {
      if (fFilter && it.folder !== fFilter) return false;
      if (q) {
        const hay = `${it.name} ${it.folder} ${it.ext}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (countLabel) {
      countLabel.textContent = filtered.length === allItems.length
        ? `${allItems.length}件`
        : `${filtered.length} / ${allItems.length}件`;
    }

    listEl.innerHTML = '';
    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'library-empty';
      empty.innerHTML = allItems.length === 0
        ? '<p>📂 フォルダ指定または「＋ 追加」で音源を読み込んでください</p><p class="library-empty-sub">項目をドラッグしてパッドやBGMリストへ直接ドロップできます</p>'
        : '<p>条件に一致する音源がありません</p>';
      listEl.appendChild(empty);
      return;
    }

    const frag = document.createDocumentFragment();
    for (const item of filtered) {
      const isPreviewing = this.mediaLibrary.previewItemId === item.id;
      const row = document.createElement('div');
      row.className = `lib-item${isPreviewing ? ' previewing' : ''}`;
      row.dataset.libId = item.id;
      row.title = item.relPath;
      row.innerHTML = `
        <span class="lib-drag-grip" aria-hidden="true">⋮⋮</span>
        <div class="lib-item-main">
          <div class="lib-item-name">${this.escapeHtml(item.name)}</div>
          ${item.folder ? `<div class="lib-item-folder">📁 ${this.escapeHtml(item.folder)}</div>` : ''}
        </div>
        <span class="lib-item-ext">${this.escapeHtml(item.ext || 'AUD')}</span>
        <button type="button" class="btn-lib-preview" title="サンプル試聴 (編集モード専用)">${isPreviewing ? '⏹' : '▶'}</button>
      `;
      const prevBtn = row.querySelector('.btn-lib-preview');
      if (prevBtn) {
        prevBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          this.toggleLibraryPreview(item);
        });
      }
      row.addEventListener('pointerdown', (e) => this.handleLibraryItemPointerDown(e, item, row));
      frag.appendChild(row);
    }
    listEl.appendChild(frag);
  }

  updateLibraryPreviewUI() {
    const listEl = document.getElementById('libraryTrackList');
    if (!listEl) return;
    const activeId = this.mediaLibrary.previewItemId;
    listEl.querySelectorAll('.lib-item').forEach((row) => {
      const isMatch = Boolean(activeId && row.dataset.libId === activeId);
      row.classList.toggle('previewing', isMatch);
      const btn = row.querySelector('.btn-lib-preview');
      if (btn) btn.textContent = isMatch ? '⏹' : '▶';
    });
  }

  stopLibraryPreview() {
    this.mediaLibrary.previewSeq++;
    if (this.mediaLibrary.previewAudio) {
      try {
        this.mediaLibrary.previewAudio.pause();
        this.mediaLibrary.previewAudio.src = '';
      } catch (_) { }
      this.mediaLibrary.previewAudio = null;
    }
    if (this.mediaLibrary.previewUrl) {
      try { URL.revokeObjectURL(this.mediaLibrary.previewUrl); } catch (_) { }
      this.mediaLibrary.previewUrl = null;
    }
    if (this.mediaLibrary.previewItemId !== null) {
      this.mediaLibrary.previewItemId = null;
      this.updateLibraryPreviewUI();
    }
  }

  async toggleLibraryPreview(item) {
    if (!this.isEditMode) return;
    if (this.mediaLibrary.previewItemId === item.id) {
      this.stopLibraryPreview();
      return;
    }
    this.stopLibraryPreview();
    const mySeq = ++this.mediaLibrary.previewSeq;
    try {
      const file = await this.getFileFromLibraryItem(item);
      if (mySeq !== this.mediaLibrary.previewSeq || !this.isEditMode) return;
      const url = URL.createObjectURL(file);
      const audio = new Audio(url);
      audio.volume = Math.max(0, Math.min(1, (this.state.masterVol || 100) / 100));
      this.mediaLibrary.previewAudio = audio;
      this.mediaLibrary.previewUrl = url;
      this.mediaLibrary.previewItemId = item.id;
      this.updateLibraryPreviewUI();

      audio.onended = () => {
        if (mySeq === this.mediaLibrary.previewSeq) this.stopLibraryPreview();
      };
      audio.onerror = () => {
        if (mySeq === this.mediaLibrary.previewSeq) {
          this.stopLibraryPreview();
          this.showToast(`「${item.name}」の試聴に失敗しました`);
        }
      };
      await audio.play();
    } catch (err) {
      if (mySeq === this.mediaLibrary.previewSeq) {
        this.stopLibraryPreview();
        this.showToast(`試聴エラー: ${err.message}`);
      }
    }
  }

  handleLibraryItemPointerDown(e, item, rowEl) {
    if (e.target.closest('.btn-lib-preview')) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    const isGrip = Boolean(e.target.closest('.lib-drag-grip'));
    const isMouse = e.pointerType === 'mouse';

    // On touch devices (iPad), only start drag from the left grip handle so the row body scrolls cleanly
    if (!isMouse && !isGrip) return;

    if (isGrip && !isMouse) {
      e.preventDefault();
    }

    const startX = e.clientX;
    const startY = e.clientY;
    let dragActive = false;
    let ghostEl = null;
    let lastDropEl = null;

    const activateDrag = (cx, cy) => {
      if (dragActive) return;
      dragActive = true;
      rowEl.classList.add('dragging-source');
      ghostEl = document.createElement('div');
      ghostEl.className = 'lib-drag-ghost';
      ghostEl.textContent = `🎵 ${item.name}`;
      ghostEl.style.left = `${cx}px`;
      ghostEl.style.top = `${cy}px`;
      document.body.appendChild(ghostEl);
    };

    const clearDropHighlight = () => {
      if (lastDropEl) {
        lastDropEl.classList.remove('lib-drop-target');
        lastDropEl = null;
      }
    };

    const findDropTarget = (cx, cy) => {
      const els = document.elementsFromPoint(cx, cy);
      for (const el of els) {
        const pad = el.closest && el.closest('.sound-pad');
        if (pad) return { type: 'pad', el: pad, padIndex: Number(pad.dataset.padIndex) };
        const bgm = el.closest && el.closest('#bgmDeck');
        if (bgm) return { type: 'bgm', el: bgm };
      }
      return null;
    };

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      if (!dragActive && Math.hypot(dx, dy) > 5) {
        activateDrag(ev.clientX, ev.clientY);
      }

      if (dragActive && ghostEl) {
        ev.preventDefault();
        ghostEl.style.left = `${ev.clientX}px`;
        ghostEl.style.top = `${ev.clientY}px`;
        const target = findDropTarget(ev.clientX, ev.clientY);
        const nextEl = target ? target.el : null;
        if (nextEl !== lastDropEl) {
          clearDropHighlight();
          if (nextEl) {
            nextEl.classList.add('lib-drop-target');
            lastDropEl = nextEl;
          }
        }
      }
    };

    const cleanup = () => {
      window.removeEventListener('pointermove', onMove, { passive: false });
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      rowEl.classList.remove('dragging-source');
      clearDropHighlight();
      if (ghostEl) {
        ghostEl.remove();
        ghostEl = null;
      }
    };

    const onUp = (ev) => {
      const wasActive = dragActive;
      const target = wasActive ? findDropTarget(ev.clientX, ev.clientY) : null;
      cleanup();
      if (!wasActive || !target) return;

      if (target.type === 'pad' && Number.isInteger(target.padIndex)) {
        this.assignLibraryItemToPad(item, target.padIndex);
      } else if (target.type === 'bgm') {
        this.addLibraryItemToBgmPlaylist(item);
      }
    };

    const onCancel = () => cleanup();

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
  }

  async getFileFromLibraryItem(item) {
    if (item.source === 'fs' && item.fileHandle) {
      return await item.fileHandle.getFile();
    }
    if (item.source === 'pool') {
      const rec = await this.db.getLibraryItem(item.id);
      if (!rec || !rec.arrayBuffer) {
        throw new Error('ライブラリ音源データが見つかりません');
      }
      const fname = (rec.relPath || rec.name).split('/').pop();
      return new File([rec.arrayBuffer], fname, { type: rec.mimeType || 'audio/mpeg' });
    }
    throw new Error('音源を取得できませんでした');
  }

  async assignLibraryItemToPad(item, padIndex) {
    const bank = this.getCurrentBank();
    if (!bank || !bank.pads[padIndex]) return;
    try {
      this.showToast(`「${item.name}」を読み込み中...`);
      const file = await this.getFileFromLibraryItem(item);
      const info = await this.importAudioFileToRecord(file, true);
      const pad = bank.pads[padIndex];
      const wasEmpty = !pad.audioId;

      pad.name = info.name;
      pad.audioId = info.audioId;
      pad.trimStart = 0;
      pad.trimEnd = Number(info.duration.toFixed(2));
      if (info.duration >= 30) {
        pad.triggerMode = 'xfade';
      } else if (wasEmpty) {
        pad.triggerMode = 'poly';
      }

      await this.saveAppState();
      this.gcOrphanAudioFiles();
      this.renderPadGrid();
      const xfadeNote = info.duration >= 30 ? '（30秒以上のため X-FADE）' : '';
      this.showToast(`PAD #${padIndex + 1} に「${info.name}」をセットしました${xfadeNote}`);
    } catch (err) {
      this.showToast(`登録エラー: ${err.message}`);
    }
  }

  async addLibraryItemToBgmPlaylist(item) {
    const pl = this.getCurrentPlaylist();
    if (!pl) return;
    try {
      this.showToast(`BGMへ「${item.name}」を追加中...`);
      const file = await this.getFileFromLibraryItem(item);
      const info = await this.importAudioFileToRecord(file, false);
      pl.tracks.push({
        id: `trk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: info.name,
        audioId: info.audioId,
        gain: 90,
        trimStart: 0,
        trimEnd: Number(info.duration.toFixed(2)),
        fadeIn: 0.5,
        fadeOut: 2.5,
        speed: 1.0,
        pitch: 0
      });
      await this.saveAppState();
      this.renderPlaylistSelector();
      this.renderBgmTrackList();
      this.updateBgmTransportUI();
      this.showToast(`BGMリストに「${info.name}」を追加しました`);
    } catch (err) {
      this.showToast(`BGM追加エラー: ${err.message}`);
    }
  }

  // ==================== NON-BLOCKING CUSTOM DIALOGS (NEVER STOPS AUDIO, IME-SAFE) ====================
  showPromptDialog(title, message, defaultValue = '') {
    return new Promise((resolve) => {
      const modal = document.getElementById('dialogModal');
      const titleEl = document.getElementById('dialogTitle');
      const msgEl = document.getElementById('dialogMessage');
      const inputEl = document.getElementById('dialogInput');
      const btnOk = document.getElementById('btnDialogOk');
      const btnCancel = document.getElementById('btnDialogCancel');
      const btnClose = document.getElementById('btnDialogClose');

      titleEl.textContent = title;
      msgEl.textContent = message;
      inputEl.value = defaultValue;
      inputEl.classList.remove('hidden');
      modal.classList.remove('hidden');
      setTimeout(() => {
        inputEl.focus();
        inputEl.select();
      }, 30);

      const finish = (result) => {
        if (result !== null) {
          const trimmed = String(result).trim();
          if (!trimmed) {
            this.showToast('名前を入力してください');
            inputEl.focus();
            return;
          }
          result = trimmed;
        }
        modal.classList.add('hidden');
        btnOk.onclick = null;
        btnCancel.onclick = null;
        btnClose.onclick = null;
        inputEl.onkeydown = null;
        resolve(result);
      };

      btnOk.onclick = () => finish(inputEl.value);
      btnCancel.onclick = () => finish(null);
      btnClose.onclick = () => finish(null);
      inputEl.onkeydown = (ev) => {
        if (ev.isComposing || ev.keyCode === 229) return;
        if (ev.key === 'Enter') {
          ev.preventDefault();
          finish(inputEl.value);
        } else if (ev.key === 'Escape') {
          ev.preventDefault();
          finish(null);
        }
      };
    });
  }

  showConfirmDialog(title, message) {
    return new Promise((resolve) => {
      const modal = document.getElementById('dialogModal');
      const titleEl = document.getElementById('dialogTitle');
      const msgEl = document.getElementById('dialogMessage');
      const inputEl = document.getElementById('dialogInput');
      const btnOk = document.getElementById('btnDialogOk');
      const btnCancel = document.getElementById('btnDialogCancel');
      const btnClose = document.getElementById('btnDialogClose');

      titleEl.textContent = title;
      msgEl.textContent = message;
      inputEl.classList.add('hidden');
      modal.classList.remove('hidden');
      setTimeout(() => btnOk.focus(), 30);

      const onKey = (ev) => {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          finish(true);
        } else if (ev.key === 'Escape') {
          ev.preventDefault();
          finish(false);
        }
      };

      const finish = (result) => {
        modal.classList.add('hidden');
        btnOk.onclick = null;
        btnCancel.onclick = null;
        btnClose.onclick = null;
        window.removeEventListener('keydown', onKey, true);
        resolve(result);
      };

      window.addEventListener('keydown', onKey, true);
      btnOk.onclick = () => finish(true);
      btnCancel.onclick = () => finish(false);
      btnClose.onclick = () => finish(false);
    });
  }

  // ==================== UTILITIES ====================
  formatSeconds(sec, showTenths = false) {
    const s = Math.max(0, Number(sec) || 0);
    const mins = Math.floor(s / 60);
    const rem = s % 60;
    const mm = String(mins).padStart(2, '0');
    if (showTenths) {
      const whole = String(Math.floor(rem)).padStart(2, '0');
      const tenth = Math.floor((rem - Math.floor(rem)) * 10);
      return `${mm}:${whole}.${tenth}`;
    }
    return `${mm}:${String(Math.floor(rem)).padStart(2, '0')}`;
  }

  escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  showToast(msg) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => {
      el.remove();
    }, 2800);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.hikarungApp = new HikarungProApp();
  window.hikarungApp.init();
});
