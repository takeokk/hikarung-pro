/**
 * HIKARUNG-PRO - Offline-First iPad Sound Cue & BGM Playlist Deck
 * Zero external dependencies. Web Audio API + IndexedDB + Service Worker.
 */

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
    this.version = 1;
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
}

// ==================== MAIN APPLICATION ====================
class HikarungProApp {
  constructor() {
    this.db = new HikarungDB();
    this.audioCtx = null;
    this.offlineDecodeCtx = null;
    this.masterSeGain = null;
    this.masterBgmGain = null;

    // Decoded AudioBuffer cache: Map<audioId, AudioBuffer>
    this.audioBuffers = new Map();
    this.audioMeta = new Map(); // Map<audioId, { name, duration }>

    // Active Pad Voices: Map<padId, Set<VoiceObj>>
    this.activePadVoices = new Map();
    // Cached DOM elements for active pad progress: Map<padId, { bar, timeEl }>
    this.padDomCache = new Map();

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
      bgmXfade: 3.0
    };

    // Runtime UI state
    this.isEditMode = false;
    this.isTalkOver = false;
    this.animFrameId = null;
    this.bgTimerId = null;
    this.lastAnimTickMs = 0;

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
  }

  async init() {
    this.registerServiceWorker();
    this.bindUIEvents();
    await this.loadOrInitData();
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
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContextClass({ latencyHint: 'interactive' });

      this.masterSeGain = this.audioCtx.createGain();
      this.masterSeGain.gain.value = this.state.masterVol / 100;
      this.masterSeGain.connect(this.audioCtx.destination);

      this.masterBgmGain = this.audioCtx.createGain();
      this.masterBgmGain.gain.value = this.getEffectiveBgmMasterGain();
      this.masterBgmGain.connect(this.audioCtx.destination);

      // Play a 1-sample silent buffer immediately to wake up iPadOS hardware audio with zero lag
      try {
        const silentBuf = this.audioCtx.createBuffer(1, 1, 22050);
        const src = this.audioCtx.createBufferSource();
        src.buffer = silentBuf;
        src.connect(this.audioCtx.destination);
        src.start(0);
      } catch (_) { }
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
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

    // Purge any legacy audio_demo_* files from IndexedDB and decode user files in parallel
    const userFiles = [];
    for (const fileRec of savedAudioFiles) {
      if (String(fileRec.id).startsWith('audio_demo_')) {
        await this.db.deleteAudioFile(fileRec.id);
      } else {
        userFiles.push(fileRec);
      }
    }

    if (userFiles.length > 0) {
      await Promise.all(userFiles.map((rec) => this.decodeAndCacheAudioRecord(rec)));
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

  async decodeAndCacheAudioRecord(fileRec) {
    try {
      const ctx = this.getDecodeContext();
      const bufferCopy = fileRec.arrayBuffer.slice(0);
      const audioBuffer = await ctx.decodeAudioData(bufferCopy);
      this.audioBuffers.set(fileRec.id, audioBuffer);
      this.audioMeta.set(fileRec.id, {
        name: fileRec.name,
        duration: audioBuffer.duration
      });
      return audioBuffer;
    } catch (err) {
      console.warn('Audio decode warning:', err);
      return null;
    }
  }

  async saveAppState() {
    await this.db.saveState(this.state);
  }

  // ==================== GETTERS ====================
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

  // ==================== SAMPLER PAD AUDIO ENGINE ====================
  triggerPad(padIndex) {
    this.ensureAudioContext();
    const bank = this.getCurrentBank();
    if (!bank) return;
    const pad = bank.pads[padIndex];
    if (!pad || !pad.audioId) {
      this.openEditorForPad(padIndex);
      return;
    }

    const buffer = this.audioBuffers.get(pad.audioId);
    if (!buffer) {
      this.showToast('音源データをデコード中です...');
      return;
    }

    const mode = pad.triggerMode || 'poly';

    if (mode === 'retrig') {
      this.stopPadVoices(pad.id, 0.03);
    } else if (mode === 'mono') {
      const existing = this.activePadVoices.get(pad.id);
      if (existing && existing.size > 0) {
        this.stopPadVoices(pad.id, 0.05);
        return;
      }
      this.stopPadsByMode('mono', 0.05);
    } else if (mode === 'xfade') {
      const existing = this.activePadVoices.get(pad.id);
      if (existing && existing.size > 0) {
        this.stopPadVoices(pad.id, pad.fadeOut || 2.0);
        return;
      }
      this.stopPadsByMode('xfade', pad.fadeOut || 2.5);
    }

    this.startPadVoice(pad, buffer);
  }

  startPadVoice(pad, buffer) {
    const ctx = this.ensureAudioContext();
    const now = ctx.currentTime;

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const speed = Math.max(0.25, Math.min(3.0, Number(pad.speed) || 1.0));
    const pitchSemi = Number(pad.pitch) || 0;
    source.playbackRate.value = speed;
    if ('detune' in source) {
      source.detune.value = pitchSemi * 100;
    }
    const effectiveRate = speed * Math.pow(2, pitchSemi / 12);

    const trimStart = Math.max(0, Math.min(buffer.duration - 0.01, Number(pad.trimStart) || 0));
    const trimEnd = (Number(pad.trimEnd) > trimStart && Number(pad.trimEnd) <= buffer.duration)
      ? Number(pad.trimEnd)
      : buffer.duration;
    const regionDur = Math.max(0.02, trimEnd - trimStart);
    const playWallDuration = regionDur / effectiveRate;

    const voiceGain = ctx.createGain();
    const targetGain = Math.max(0, (Number(pad.gain) ?? 100) / 100);

    const fadeInSec = pad.triggerMode === 'xfade' && (!pad.fadeIn || pad.fadeIn < 0.3)
      ? Math.min(2.0, pad.fadeOut || 1.5)
      : Math.max(0, Number(pad.fadeIn) || 0);

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
      const autoFadeOut = Math.max(0, Number(pad.fadeOut) || 0);
      if (autoFadeOut > 0.05 && playWallDuration > autoFadeOut * 1.6 && pad.triggerMode === 'xfade') {
        const fadeStartWall = now + playWallDuration - autoFadeOut;
        voiceGain.gain.setValueAtTime(targetGain, fadeStartWall);
        voiceGain.gain.linearRampToValueAtTime(0.0001, now + playWallDuration);
      }
      source.start(now, trimStart, regionDur);
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
    for (const padId of this.activePadVoices.keys()) {
      this.stopPadVoices(padId, 0.02);
    }
    this.stopBgmImmediately();
    this.stopEditorPreview();
    this.showToast('🛑 すべての音声を即時停止しました');
  }

  // ==================== BGM PLAYLIST DECK ENGINE ====================
  playBgmTrack(index, crossfadeSec = 0, targetPlaylistId = null) {
    this.ensureAudioContext();
    if (targetPlaylistId) {
      this.bgmPlayer.playingPlaylistId = targetPlaylistId;
    } else if (!this.bgmPlayer.playingPlaylistId) {
      this.bgmPlayer.playingPlaylistId = this.state.currentPlaylistId;
    }

    const pl = this.getPlayingPlaylist();
    if (!pl || pl.tracks.length === 0) {
      this.showToast('プレイリストに曲がありません。「＋音源ファイル追加」から追加してください');
      return;
    }

    const safeIndex = ((index % pl.tracks.length) + pl.tracks.length) % pl.tracks.length;
    const track = pl.tracks[safeIndex];
    const buffer = this.audioBuffers.get(track.audioId);
    if (!buffer) {
      this.showToast('BGM音源データを読み込めませんでした');
      return;
    }

    if (this.bgmPlayer.activeNode) {
      this.retireActiveBgmNode(crossfadeSec);
    }

    this.bgmPlayer.playingPlaylistId = pl.id;
    this.bgmPlayer.currentTrackIndex = safeIndex;
    this.bgmPlayer.pausedAtOffset = 0;
    this.startBgmNodeFromOffset(track, buffer, 0, crossfadeSec);
    this.renderBgmTrackList();
  }

  startBgmNodeFromOffset(track, buffer, offsetInTrimmedRegion = 0, fadeInOverrideSec = 0) {
    const ctx = this.ensureAudioContext();
    const now = ctx.currentTime;

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const speed = Math.max(0.25, Math.min(3.0, Number(track.speed) || 1.0));
    const pitchSemi = Number(track.pitch) || 0;
    source.playbackRate.value = speed;
    if ('detune' in source) {
      source.detune.value = pitchSemi * 100;
    }
    const effectiveRate = speed * Math.pow(2, pitchSemi / 12);

    const trimStart = Math.max(0, Math.min(buffer.duration - 0.02, Number(track.trimStart) || 0));
    const trimEnd = (Number(track.trimEnd) > trimStart && Number(track.trimEnd) <= buffer.duration)
      ? Number(track.trimEnd)
      : buffer.duration;
    const regionDur = Math.max(0.05, trimEnd - trimStart);
    const startBufferPos = Math.min(trimEnd - 0.02, trimStart + offsetInTrimmedRegion);
    const remainBufferDur = Math.max(0.02, trimEnd - startBufferPos);
    const remainWallDur = remainBufferDur / effectiveRate;

    const gainNode = ctx.createGain();
    const targetGain = Math.max(0, (Number(track.gain) ?? 100) / 100);
    const fadeSec = Math.max(fadeInOverrideSec, Number(track.fadeIn) || 0);

    if (fadeSec > 0.03) {
      gainNode.gain.setValueAtTime(0.0001, now);
      gainNode.gain.linearRampToValueAtTime(targetGain, now + Math.min(fadeSec, remainWallDur));
    } else {
      gainNode.gain.setValueAtTime(targetGain, now);
    }

    source.connect(gainNode);
    gainNode.connect(this.masterBgmGain);

    source.start(now, startBufferPos, remainBufferDur);

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

  toggleBgmPlayPause() {
    this.ensureAudioContext();

    if (this.bgmPlayer.isPlaying && this.bgmPlayer.activeNode) {
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

    // Resume paused track in playingPlaylist, or start current viewed playlist if none paused
    let pl = this.getPlayingPlaylist();
    if (!this.bgmPlayer.pausedAtOffset || !pl || pl.tracks.length === 0) {
      this.bgmPlayer.playingPlaylistId = this.state.currentPlaylistId;
      pl = this.getCurrentPlaylist();
    }
    if (!pl || pl.tracks.length === 0) {
      this.showToast('プレイリストに音源を追加してください');
      return;
    }

    const idx = Math.min(this.bgmPlayer.currentTrackIndex, pl.tracks.length - 1);
    const track = pl.tracks[idx];
    const buffer = this.audioBuffers.get(track.audioId);
    if (!buffer) return;
    this.bgmPlayer.playingPlaylistId = pl.id;
    this.bgmPlayer.currentTrackIndex = idx;
    this.startBgmNodeFromOffset(track, buffer, this.bgmPlayer.pausedAtOffset || 0, 0.05);
    this.renderBgmTrackList();
  }

  fadeStopBgm(fadeSecOverride = null) {
    const fadeSec = fadeSecOverride !== null ? fadeSecOverride : (Number(this.state.bgmXfade) || 2.5);
    this.bgmPlayer.pausedAtOffset = 0;
    this.bgmPlayer.isPlaying = false;
    this.retireActiveBgmNode(fadeSec);
    this.renderBgmTrackList();
    this.updateBgmTransportUI();
  }

  stopBgmImmediately() {
    this.bgmPlayer.pausedAtOffset = 0;
    this.bgmPlayer.isPlaying = false;
    this.retireActiveBgmNode(0.02);
    for (const fn of this.bgmPlayer.fadingNodes) {
      try { fn.source.stop(); } catch (_) { }
    }
    this.bgmPlayer.fadingNodes.clear();
    this.renderBgmTrackList();
    this.updateBgmTransportUI();
  }

  onBgmTrackNaturalEnd() {
    if (!this.bgmPlayer.isPlaying) return;
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
    const buffer = this.audioBuffers.get(track.audioId);
    if (!buffer) return null;

    const speed = Math.max(0.25, Math.min(3.0, Number(track.speed) || 1.0));
    const pitchSemi = Number(track.pitch) || 0;
    const effectiveRate = speed * Math.pow(2, pitchSemi / 12);

    const trimStart = Math.max(0, Math.min(buffer.duration - 0.02, Number(track.trimStart) || 0));
    const trimEnd = (Number(track.trimEnd) > trimStart && Number(track.trimEnd) <= buffer.duration)
      ? Number(track.trimEnd)
      : buffer.duration;
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

  seekBgmToRatio(ratio) {
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
      this.retireActiveBgmNode(0.025);
      this.startBgmNodeFromOffset(track, info.buffer, info.targetOffset, 0.025);
    }
  }

  // ==================== POWER-SAVING ON-DEMAND ANIMATION LOOP ====================
  startAnimationLoop() {
    // Suspend AudioContext when tab/screen is locked AND nothing is playing to save iPad battery
    document.addEventListener('visibilitychange', () => {
      if (!this.audioCtx) return;
      const anyPlaying = this.activePadVoices.size > 0 || this.bgmPlayer.isPlaying || Boolean(this.previewVoice);
      if (document.hidden && !anyPlaying && this.audioCtx.state === 'running') {
        this.audioCtx.suspend().catch(() => {});
      } else if (!document.hidden && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
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
    const hasPads = this.activePadVoices.size > 0;
    const hasBgm = Boolean(this.bgmPlayer.isPlaying && this.bgmPlayer.activeNode);
    const hasPreview = Boolean(this.previewVoice && !document.getElementById('editorModal').classList.contains('hidden'));

    // COMPLETE IDLE SLEEP: 0% CPU/GPU usage when no sound is playing
    if (!hasPads && !hasBgm && !hasPreview) {
      return;
    }

    // Throttle interval: 60ms (~16fps) when SE pads/preview are active, 250ms (4fps) when ONLY BGM is playing
    const minIntervalMs = (hasPads || hasPreview) ? 60 : 250;

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

      // 2. Update BGM Now Playing & Auto-Crossfade check
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

        const xfadeSec = Number(this.state.bgmXfade) || 0;
        if (
          xfadeSec > 0.1 &&
          !this.bgmPlayer.isCrossfadingNext &&
          this.state.bgmMode !== 'single' &&
          totalWall > xfadeSec * 1.8 &&
          remainWall <= xfadeSec
        ) {
          this.bgmPlayer.isCrossfadingNext = true;
          this.advanceBgmTrack(xfadeSec);
        }
      }

      // 3. Editor Preview playhead
      if (hasPreview && !document.hidden) {
        this.drawEditorWaveform();
      }
    }

    // Schedule next tick: use low-power 250ms timer when only BGM is playing (or screen hidden), rAF only when SE pads are active
    if (document.hidden || (!hasPads && !hasPreview && hasBgm)) {
      this.bgTimerId = setTimeout(() => {
        this.bgTimerId = null;
        this.runAnimationTick(performance.now());
      }, 250);
    } else {
      this.animFrameId = requestAnimationFrame((nextMs) => {
        this.animFrameId = null;
        this.runAnimationTick(nextMs);
      });
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
  }

  renderTopBarState() {
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
  }

  renderBankTabs() {
    const container = document.getElementById('bankTabsContainer');
    container.innerHTML = '';
    for (const bank of this.state.banks) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `bank-tab ${bank.id === this.state.currentBankId ? 'active' : ''}`;
      btn.textContent = bank.name;
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
      const hasAudio = Boolean(pad.audioId && this.audioBuffers.has(pad.audioId));
      const voices = this.activePadVoices.get(pad.id);
      const isPlaying = Boolean(voices && voices.size > 0);

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
            ${pad.key ? `<span class="pad-key-badge">${this.escapeHtml(pad.key)}</span>` : ''}
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
          } else {
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
          this.stopPadVoices(pad.id, Number(pad.fadeOut) || 0.15);
        }
      };
      padEl.addEventListener('pointerup', handleGateRelease);
      padEl.addEventListener('pointercancel', handleGateRelease);
      padEl.addEventListener('pointerleave', handleGateRelease);

      grid.appendChild(padEl);
      this.padDomCache.set(pad.id, {
        bar: padEl.querySelector('.pad-progress-bar'),
        timeEl: padEl.querySelector('.pad-time')
      });
    }
  }

  updatePadVisualState(padId) {
    const bank = this.getCurrentBank();
    if (!bank) return;
    const padIndex = bank.pads.findIndex((p) => p.id === padId);
    if (padIndex === -1) return;
    this.renderPadGrid();
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
    if (!buf) return 0;
    const start = Math.max(0, Number(item.trimStart) || 0);
    const end = (Number(item.trimEnd) > start && Number(item.trimEnd) <= buf.duration)
      ? Number(item.trimEnd)
      : buf.duration;
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

      item.querySelector('.btn-trk-del').addEventListener('click', (e) => {
        e.stopPropagation();
        const deletingPlayingTrack = isPlayingPlaylist && this.bgmPlayer.isPlaying && this.bgmPlayer.currentTrackIndex === idx;
        if (deletingPlayingTrack) {
          this.stopBgmImmediately();
        }
        pl.tracks.splice(idx, 1);
        if (isPlayingPlaylist) {
          if (idx < this.bgmPlayer.currentTrackIndex) {
            this.bgmPlayer.currentTrackIndex = Math.max(0, this.bgmPlayer.currentTrackIndex - 1);
          } else if (this.bgmPlayer.currentTrackIndex >= pl.tracks.length) {
            this.bgmPlayer.currentTrackIndex = Math.max(0, pl.tracks.length - 1);
          }
        }
        this.saveAppState();
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
  openEditorForPad(padIndex) {
    const bank = this.getCurrentBank();
    if (!bank) return;
    const pad = bank.pads[padIndex];
    if (!pad) return;

    this.editorTarget = { type: 'pad', bankId: bank.id, padIndex };
    this.editorDraft = JSON.parse(JSON.stringify(pad));

    document.getElementById('editorTargetBadge').textContent = `PAD #${padIndex + 1}`;
    document.getElementById('editorModalTitle').textContent = 'パッド設定・波形簡易編集';
    document.getElementById('padOnlyModeGroup').style.display = '';
    document.getElementById('padOnlyLoopGroup').style.display = '';
    document.getElementById('padOnlyKeyGroup').style.display = '';
    document.getElementById('padOnlyColorRow').style.display = '';
    document.getElementById('btnClearTarget').style.display = '';

    this.populateEditorModalFields();
    document.getElementById('editorModal').classList.remove('hidden');
    this.drawEditorWaveform();
  }

  openEditorForBgmTrack(trackIndex) {
    const pl = this.getCurrentPlaylist();
    if (!pl) return;
    const track = pl.tracks[trackIndex];
    if (!track) return;

    this.editorTarget = { type: 'bgm', playlistId: pl.id, trackIndex };
    this.editorDraft = JSON.parse(JSON.stringify(track));

    document.getElementById('editorTargetBadge').textContent = `BGM #${trackIndex + 1}`;
    document.getElementById('editorModalTitle').textContent = 'BGMトラック波形・音量・フェード編集';
    document.getElementById('padOnlyModeGroup').style.display = 'none';
    document.getElementById('padOnlyLoopGroup').style.display = 'none';
    document.getElementById('padOnlyKeyGroup').style.display = 'none';
    document.getElementById('padOnlyColorRow').style.display = 'none';
    document.getElementById('btnClearTarget').style.display = 'none';

    this.populateEditorModalFields();
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
    const startRatio = Math.max(0, Math.min(1, (Number(d.trimStart) || 0) / dur));
    const endRatio = Math.max(startRatio, Math.min(1, (Number(d.trimEnd) || dur) / dur));
    const startX = startRatio * w;
    const endX = endRatio * w;
    const gainScale = (Number(d.gain ?? 100) / 100);

    ctx.fillStyle = 'rgba(6, 182, 212, 0.1)';
    ctx.fillRect(startX, 0, Math.max(2, endX - startX), h);

    const step = Math.max(1, Math.floor(data.length / w));
    for (let x = 0; x < w; x++) {
      const sampleIdx = Math.floor((x / w) * data.length);
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

    ctx.fillStyle = 'rgba(3, 7, 18, 0.65)';
    if (startX > 0) ctx.fillRect(0, 0, startX, h);
    if (endX < w) ctx.fillRect(endX, 0, w - endX, h);

    const fadeInSec = Number(d.fadeIn) || 0;
    const fadeOutSec = Number(d.fadeOut) || 0;
    const fadeInW = Math.min(endX - startX, (fadeInSec / dur) * w);
    const fadeOutW = Math.min(endX - startX, (fadeOutSec / dur) * w);

    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(startX, h - 6);
    ctx.lineTo(startX + fadeInW, 10);
    ctx.lineTo(endX - fadeOutW, 10);
    ctx.lineTo(endX, h - 6);
    ctx.stroke();

    ctx.fillStyle = '#10b981';
    ctx.fillRect(startX - 2, 0, 4, h);
    ctx.beginPath();
    ctx.roundRect(startX, 4, 48, 20, 4);
    ctx.fill();
    ctx.fillStyle = '#052e16';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('IN ▶', startX + 6, 18);

    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(endX - 2, 0, 4, h);
    ctx.beginPath();
    ctx.roundRect(endX - 48, h - 24, 48, 20, 4);
    ctx.fill();
    ctx.fillStyle = '#451a03';
    ctx.fillText('◀ OUT', endX - 42, h - 10);

    if (this.previewVoice && this.audioCtx) {
      const elapsedWall = this.audioCtx.currentTime - this.previewVoice.startedAt;
      const curBufTime = this.previewVoice.trimStart + elapsedWall * this.previewVoice.effectiveRate;
      if (curBufTime <= this.previewVoice.trimEnd) {
        const px = (curBufTime / dur) * w;
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

    const data = buf.getChannelData(0);
    const sr = buf.sampleRate;
    const threshold = 0.015;

    let firstIdx = 0;
    while (firstIdx < data.length && Math.abs(data[firstIdx]) < threshold) {
      firstIdx++;
    }
    let lastIdx = data.length - 1;
    while (lastIdx > firstIdx && Math.abs(data[lastIdx]) < threshold) {
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

    const data = buf.getChannelData(0);
    const sr = buf.sampleRate;
    const sIdx = Math.max(0, Math.floor((Number(d.trimStart) || 0) * sr));
    const eIdx = Math.min(data.length, Math.ceil((Number(d.trimEnd) || buf.duration) * sr));

    let peak = 0;
    for (let i = sIdx; i < eIdx; i++) {
      const abs = Math.abs(data[i]);
      if (abs > peak) peak = abs;
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

    const speed = Number(d.speed) || 1.0;
    const pitch = Number(d.pitch) || 0;
    source.playbackRate.value = speed;
    if ('detune' in source) source.detune.value = pitch * 100;
    const effectiveRate = speed * Math.pow(2, pitch / 12);

    const trimStart = Math.max(0, Number(d.trimStart) || 0);
    const trimEnd = (Number(d.trimEnd) > trimStart && Number(d.trimEnd) <= buf.duration)
      ? Number(d.trimEnd)
      : buf.duration;
    const regionDur = Math.max(0.02, trimEnd - trimStart);
    const wallDur = regionDur / effectiveRate;

    const gainNode = ctx.createGain();
    const targetGain = (Number(d.gain ?? 100) / 100);
    const fadeIn = Number(d.fadeIn) || 0;
    if (fadeIn > 0.02) {
      gainNode.gain.setValueAtTime(0.0001, now);
      gainNode.gain.linearRampToValueAtTime(targetGain, now + Math.min(fadeIn, wallDur));
    } else {
      gainNode.gain.setValueAtTime(targetGain, now);
    }

    source.connect(gainNode);
    gainNode.connect(this.masterSeGain);
    source.start(now, trimStart, regionDur);

    this.previewVoice = {
      source,
      gainNode,
      startedAt: now,
      trimStart,
      trimEnd,
      effectiveRate
    };

    source.onended = () => {
      this.previewVoice = null;
      this.drawEditorWaveform();
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
    this.editorDraft.key = document.getElementById('inputEditKey').value.trim().toUpperCase();

    if (this.editorTarget.type === 'pad') {
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
  async importAudioFileToRecord(file) {
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
    const decoded = await this.decodeAndCacheAudioRecord(record);
    if (!decoded) {
      throw new Error(`「${file.name}」のデコードに失敗しました`);
    }
    record.duration = decoded.duration;
    await this.db.saveAudioFile(record);
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
      const text = await file.text();
      const payload = JSON.parse(text);
      if (!payload || !payload.state || !Array.isArray(payload.audioFiles)) {
        throw new Error('無効なバックアップファイルです');
      }

      this.panicStopAll();
      await this.db.clearAll();
      this.audioBuffers.clear();
      this.audioMeta.clear();

      for (const item of payload.audioFiles) {
        const arrayBuffer = this.base64ToArrayBuffer(item.base64);
        const rec = {
          id: item.id,
          name: item.name,
          mimeType: item.mimeType || 'audio/wav',
          duration: item.duration || 0,
          arrayBuffer
        };
        await this.db.saveAudioFile(rec);
        await this.decodeAndCacheAudioRecord(rec);
      }

      this.state = payload.state;
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
      this.state.gridSize = e.target.value;
      this.saveAppState();
      this.renderPadGrid();
    });

    document.getElementById('sliderMasterVol').addEventListener('input', (e) => {
      this.state.masterVol = Number(e.target.value);
      document.getElementById('labelMasterVol').textContent = `${this.state.masterVol}%`;
      this.updateMasterGainsSmooth(0.04);
      this.saveAppState();
    });

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

    document.getElementById('btnAddBank').addEventListener('click', () => {
      const name = prompt('新しい進行バンク（セットリスト）の名前を入力してください:', `${this.state.banks.length + 1}. 新規コーナー`);
      if (!name) return;
      const newBank = this.createDefaultBank(`bank_${Date.now()}`, name.trim());
      this.state.banks.push(newBank);
      this.state.currentBankId = newBank.id;
      this.saveAppState();
      this.renderBankTabs();
      this.renderPadGrid();
    });

    document.getElementById('btnRenameBank').addEventListener('click', () => {
      const bank = this.getCurrentBank();
      if (!bank) return;
      const name = prompt('バンク名を変更:', bank.name);
      if (!name) return;
      bank.name = name.trim();
      this.saveAppState();
      this.renderBankTabs();
    });

    document.getElementById('btnDeleteBank').addEventListener('click', () => {
      if (this.state.banks.length <= 1) {
        this.showToast('最低1つのバンクが必要です');
        return;
      }
      const bank = this.getCurrentBank();
      if (!confirm(`バンク「${bank.name}」を削除しますか？`)) return;
      this.state.banks = this.state.banks.filter((b) => b.id !== bank.id);
      this.state.currentBankId = this.state.banks[0].id;
      this.saveAppState();
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
      let importedCount = 0;
      let xfadeAutoCount = 0;
      for (const file of files) {
        const emptyPad = bank.pads.find((p) => !p.audioId);
        if (!emptyPad) break;
        try {
          const info = await this.importAudioFileToRecord(file);
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
      const xfadeSuffix = xfadeAutoCount > 0 ? `（うち30秒以上の${xfadeAutoCount}件をX-FADEに自動設定）` : '';
      this.showToast(`${importedCount}件の音源を割り当てました${xfadeSuffix}`);
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

    document.getElementById('btnAddPlaylist').addEventListener('click', () => {
      const name = prompt('新しいBGMプレイリストの名前:', '新規BGMプレイリスト');
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

    document.getElementById('btnRenamePlaylist').addEventListener('click', () => {
      const pl = this.getCurrentPlaylist();
      if (!pl) return;
      const name = prompt('プレイリスト名を変更:', pl.name);
      if (!name) return;
      pl.name = name.trim();
      this.saveAppState();
      this.renderPlaylistSelector();
      this.updateBgmTransportUI();
    });

    document.getElementById('btnDeletePlaylist').addEventListener('click', () => {
      if (this.state.playlists.length <= 1) {
        this.showToast('最低1つのプレイリストが必要です');
        return;
      }
      const pl = this.getCurrentPlaylist();
      if (!confirm(`プレイリスト「${pl.name}」を削除しますか？`)) return;
      if (this.bgmPlayer.playingPlaylistId === pl.id) {
        this.stopBgmImmediately();
      }
      this.state.playlists = this.state.playlists.filter((p) => p.id !== pl.id);
      this.state.currentPlaylistId = this.state.playlists[0].id;
      if (!this.bgmPlayer.isPlaying) {
        this.bgmPlayer.playingPlaylistId = this.state.currentPlaylistId;
        this.bgmPlayer.currentTrackIndex = 0;
      }
      this.saveAppState();
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
      for (const file of files) {
        try {
          const info = await this.importAudioFileToRecord(file);
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
      const ratio = Number(e.target.value) / 1000;
      this.bgmPlayer.isSeeking = false;
      this.seekBgmToRatio(ratio);
    });
    seekSliderEl.addEventListener('pointerup', commitBgmSeek);
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
      this.saveAppState();
    });

    document.getElementById('selectBgmMode').addEventListener('change', (e) => {
      this.state.bgmMode = e.target.value;
      this.saveAppState();
    });

    document.getElementById('selectBgmXfade').addEventListener('change', (e) => {
      this.state.bgmXfade = Number(e.target.value);
      this.saveAppState();
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
      return buf ? ratio * buf.duration : 0;
    };

    wfCanvas.addEventListener('pointerdown', (e) => {
      if (!this.editorDraft || !this.editorDraft.audioId) return;
      const t = getCanvasTime(e);
      const distStart = Math.abs(t - (this.editorDraft.trimStart || 0));
      const distEnd = Math.abs(t - (this.editorDraft.trimEnd || 0));
      this.draggingTrimHandle = distStart <= distEnd ? 'start' : 'end';
      wfCanvas.setPointerCapture(e.pointerId);
      if (this.draggingTrimHandle === 'start') syncTrimStart(t);
      else syncTrimEnd(t);
    });

    wfCanvas.addEventListener('pointermove', (e) => {
      if (!this.draggingTrimHandle) return;
      const t = getCanvasTime(e);
      if (this.draggingTrimHandle === 'start') syncTrimStart(t);
      else syncTrimEnd(t);
    });

    const endCanvasDrag = () => { this.draggingTrimHandle = null; };
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
      bank.pads[idx] = this.createDefaultPad(idx);
      await this.saveAppState();
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
      if (!confirm('すべての音源と設定を初期状態（空）にリセットしますか？')) return;
      this.panicStopAll();
      await this.db.clearAll();
      location.reload();
    });

    // ==================== EXTERNAL KEYBOARD SHORTCUTS ====================
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (!document.getElementById('editorModal').classList.contains('hidden')) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        this.panicStopAll();
        return;
      }

      if (e.repeat) return;
      const pressed = e.key.toUpperCase();
      const bank = this.getCurrentBank();
      if (!bank) return;
      const count = this.getVisiblePadCount();
      for (let i = 0; i < count; i++) {
        if (bank.pads[i] && bank.pads[i].key === pressed) {
          e.preventDefault();
          this.triggerPad(i);
          break;
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      const released = e.key.toUpperCase();
      const bank = this.getCurrentBank();
      if (!bank) return;
      const count = this.getVisiblePadCount();
      for (let i = 0; i < count; i++) {
        const pad = bank.pads[i];
        if (pad && pad.key === released && pad.triggerMode === 'gate') {
          this.stopPadVoices(pad.id, Number(pad.fadeOut) || 0.15);
        }
      }
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
