/**
 * HIKARUNG-PRO v4.0.0 - Media Library Controller
 * Hybrid PC Folder Watch (File System Access API) + iPad IndexedDB Pool.
 * Routes sample preview through Web Audio master chain (respects 2x2 output matrix, limiter, MASTER vol & VU meter).
 */

class MediaLibraryController {
  constructor(app) {
    this.app = app;
    this.dirHandle = null;
    this.dirName = '';
    this.hasDirPermission = false;
    this.fsItems = [];
    this.poolItems = [];
    this.searchQuery = '';
    this.folderFilter = '';
    this.watchTimer = null;
    this.lastSignature = '';
    this.scanSeq = 0;
    this.isOpen = false;

    // Web Audio-routed preview element (zero PCM OOM, respects outMatrix & MASTER gain)
    this.previewEl = null;
    this.previewSourceNode = null;
    this.previewUrl = null;
    this.previewItemId = null;
    this.previewSeq = 0;
  }

  bindEvents() {
    const btnToggle = document.getElementById('btnToggleLibrary');
    if (btnToggle) {
      btnToggle.addEventListener('click', () => {
        const panel = document.getElementById('mediaLibraryPanel');
        const willOpen = panel.classList.contains('collapsed');
        if (willOpen && window.innerWidth <= 960) {
          // On portrait/narrow screens, keep Library and BGM mutually exclusive so Pads never crush
          const bgmDeck = document.getElementById('bgmDeck');
          const bgmBtn = document.getElementById('btnToggleBgmDeck');
          if (bgmDeck && !bgmDeck.classList.contains('collapsed')) {
            bgmDeck.classList.add('collapsed');
            if (bgmBtn) bgmBtn.classList.remove('active');
          }
        }
        panel.classList.toggle('collapsed', !willOpen);
        this.isOpen = willOpen;
        btnToggle.classList.toggle('active', this.isOpen);

        if (this.isOpen && this.dirHandle && this.hasDirPermission) {
          this.scanWatchedDirectory(true);
          this.startWatchLoop();
        } else {
          this.stopWatchLoop();
          if (!this.isOpen) this.stopPreview();
        }
      });
    }

    const btnWatch = document.getElementById('btnLibWatchFolder');
    if (btnWatch) {
      if (!('showDirectoryPicker' in window)) {
        btnWatch.textContent = '📁 フォルダ取込';
        btnWatch.title = 'フォルダ内の音源をライブラリプールへ取り込み';
      }
      btnWatch.addEventListener('click', () => this.pickWatchFolder());
    }

    const btnAdd = document.getElementById('btnLibAddFiles');
    if (btnAdd) btnAdd.addEventListener('click', () => document.getElementById('inputLibFiles').click());

    const btnRescan = document.getElementById('btnLibRescan');
    if (btnRescan) btnRescan.addEventListener('click', () => this.scanWatchedDirectory(false));

    const btnClear = document.getElementById('btnLibClear');
    if (btnClear) btnClear.addEventListener('click', () => this.clearAll());

    const btnResume = document.getElementById('btnLibResumeWatch');
    if (btnResume) btnResume.addEventListener('click', () => this.resumeWatchPermission());

    const inputFolder = document.getElementById('inputLibFolder');
    if (inputFolder) {
      inputFolder.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []);
        e.target.value = '';
        if (files.length > 0) await this.importFilesToPool(files);
      });
    }

    const inputFiles = document.getElementById('inputLibFiles');
    if (inputFiles) {
      inputFiles.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []);
        e.target.value = '';
        if (files.length > 0) await this.importFilesToPool(files);
      });
    }

    const inputSearch = document.getElementById('inputLibSearch');
    if (inputSearch) {
      inputSearch.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim().toLowerCase();
        this.render();
      });
    }

    const selectFolder = document.getElementById('selectLibFolder');
    if (selectFolder) {
      selectFolder.addEventListener('change', (e) => {
        this.folderFilter = e.target.value;
        this.render();
      });
    }
  }

  async init() {
    try {
      // Loads ONLY tiny metadata (0 binary bytes in RAM!)
      const records = await this.app.db.getAllLibraryMeta();
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
            mimeType: rec.mimeType || guessAudioMime(rec.relPath || rec.name),
            size: rec.size || 0
          });
        }
      }

      pool.sort((a, b) => a.relPath.localeCompare(b.relPath, 'ja', { numeric: true }));
      this.poolItems = pool;

      if (savedHandleRec && 'showDirectoryPicker' in window) {
        this.dirHandle = savedHandleRec.handle;
        this.dirName = savedHandleRec.name || savedHandleRec.handle.name || 'フォルダ';
        try {
          const perm = await savedHandleRec.handle.queryPermission({ mode: 'read' });
          this.hasDirPermission = perm === 'granted';
          if (!this.hasDirPermission) {
            this.showPermissionBanner(true);
          } else if (this.isOpen) {
            await this.scanWatchedDirectory(true);
          }
        } catch (_) {
          this.hasDirPermission = false;
        }
      }

      this.render();
    } catch (_) { }
  }

  showPermissionBanner(show) {
    const banner = document.getElementById('libraryPermissionBanner');
    const btn = document.getElementById('btnLibResumeWatch');
    if (btn && this.dirName) btn.textContent = `🔓 「${this.dirName}」の監視を再開`;
    if (banner) banner.classList.toggle('hidden', !show);
  }

  async pickWatchFolder() {
    if ('showDirectoryPicker' in window) {
      try {
        const handle = await window.showDirectoryPicker({ mode: 'read' });
        this.dirHandle = handle;
        this.dirName = handle.name;
        this.hasDirPermission = true;
        this.lastSignature = '';
        await this.app.db.saveLibraryHandle(handle);
        this.showPermissionBanner(false);
        await this.scanWatchedDirectory(false);
        this.startWatchLoop();
      } catch (err) {
        if (err && err.name !== 'AbortError') {
          this.app.showToast(`フォルダ読み込みエラー: ${err.message}`);
        }
      }
    } else {
      const folderInput = document.getElementById('inputLibFolder');
      if (folderInput) folderInput.click();
    }
  }

  async resumeWatchPermission() {
    if (!this.dirHandle) return;
    try {
      const perm = await this.dirHandle.requestPermission({ mode: 'read' });
      this.hasDirPermission = perm === 'granted';
      if (this.hasDirPermission) {
        this.showPermissionBanner(false);
        await this.scanWatchedDirectory(false);
        this.startWatchLoop();
      }
    } catch (err) {
      this.app.showToast(`権限取得エラー: ${err.message}`);
    }
  }

  async scanWatchedDirectory(silent = false) {
    const rootHandle = this.dirHandle;
    if (!rootHandle || !this.hasDirPermission) return;
    const mySeq = ++this.scanSeq;

    try {
      const found = [];
      const walk = async (dirHandle, prefix, depth) => {
        if (depth > 6 || mySeq !== this.scanSeq) return;
        for await (const [entryName, handle] of dirHandle.entries()) {
          if (mySeq !== this.scanSeq) return;
          if (entryName.startsWith('.')) continue;
          if (handle.kind === 'directory') {
            await walk(handle, prefix ? `${prefix}/${entryName}` : entryName, depth + 1);
          } else if (handle.kind === 'file' && isSupportedAudioFilename(entryName)) {
            const ext = getFileExtension(entryName).toUpperCase();
            const cleanName = entryName.replace(/\.[^/.]+$/, '');
            const relPath = prefix ? `${prefix}/${entryName}` : entryName;
            found.push({
              id: `fs_${relPath}`,
              source: 'fs',
              name: cleanName,
              ext,
              folder: prefix || '',
              relPath,
              fileHandle: handle
            });
          }
        }
      };

      await walk(rootHandle, '', 0);
      if (mySeq !== this.scanSeq) return;

      found.sort((a, b) => a.relPath.localeCompare(b.relPath, 'ja', { numeric: true }));
      const sig = found.map((f) => f.relPath).join('|');
      if (silent && sig === this.lastSignature) return;

      this.lastSignature = sig;
      this.fsItems = found;
      this.render();
      if (!silent) {
        this.app.showToast(`📂 「${this.dirName}」から ${found.length}件 を検出しました`);
      }
    } catch (err) {
      if (mySeq !== this.scanSeq) return;
      if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) {
        this.hasDirPermission = false;
        this.stopWatchLoop();
        this.showPermissionBanner(true);
      } else if (!silent) {
        this.app.showToast(`フォルダスキャン失敗: ${err.message}`);
      }
    }
  }

  startWatchLoop() {
    this.stopWatchLoop();
    if (!this.dirHandle || !this.hasDirPermission) return;
    this.watchTimer = setInterval(() => {
      if (this.isOpen && !document.hidden && this.dirHandle && this.hasDirPermission) {
        this.scanWatchedDirectory(true);
      }
    }, 6000);
  }

  stopWatchLoop() {
    if (this.watchTimer) {
      clearInterval(this.watchTimer);
      this.watchTimer = null;
    }
  }

  async importFilesToPool(files) {
    const audioFiles = files.filter((f) => isSupportedAudioFilename(f.name) || (f.type && f.type.startsWith('audio/')));
    if (audioFiles.length === 0) {
      this.app.showToast('再生可能な音声ファイルが見つかりませんでした');
      return;
    }

    let added = 0;
    let failed = 0;
    for (let i = 0; i < audioFiles.length; i++) {
      const file = audioFiles[i];
      try {
        if (audioFiles.length >= 3 && (i === 0 || (i + 1) % 5 === 0)) {
          this.app.showToast(`ライブラリへ登録中... (${i + 1}/${audioFiles.length})`);
        }
        const rel = file.webkitRelativePath || file.name;
        const parts = rel.split('/');
        const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
        const ext = getFileExtension(file.name).toUpperCase();
        const cleanName = file.name.replace(/\.[^/.]+$/, '');
        const mimeType = guessAudioMime(file.name, file.type);
        const id = `pool_${rel}_${file.size}_${file.lastModified || 0}`;
        const arrayBuffer = await file.arrayBuffer();

        const meta = {
          id,
          source: 'pool',
          name: cleanName,
          ext,
          folder,
          relPath: rel,
          mimeType,
          size: file.size
        };
        await this.app.db.saveLibraryPoolEntry(meta, arrayBuffer);

        const existingIdx = this.poolItems.findIndex((x) => x.id === id);
        if (existingIdx >= 0) this.poolItems[existingIdx] = meta;
        else this.poolItems.push(meta);
        added++;
      } catch (err) {
        failed++;
        if (err && err.name === 'QuotaExceededError') {
          this.app.showToast('⚠️ 端末のストレージ容量上限に達しました');
          break;
        }
      }
    }

    this.poolItems.sort((a, b) => a.relPath.localeCompare(b.relPath, 'ja', { numeric: true }));
    this.render();
    const failNote = failed > 0 ? `（${failed}件失敗）` : '';
    this.app.showToast(`📚 ライブラリに ${added}件 追加しました${failNote}`);
  }

  async deletePoolItem(item) {
    if (item.source !== 'pool') return;
    if (this.previewItemId === item.id) this.stopPreview();
    await this.app.db.deleteLibraryEntry(item.id);
    this.poolItems = this.poolItems.filter((x) => x.id !== item.id);
    this.render();
    this.app.showToast(`ライブラリから「${item.name}」を削除しました`);
  }

  async clearAll() {
    const total = this.fsItems.length + this.poolItems.length;
    if (total === 0 && !this.dirHandle) {
      this.app.showToast('ライブラリはすでに空です');
      return;
    }
    const ok = await this.app.showConfirmDialog(
      'ライブラリをクリア',
      'メディアライブラリの一覧と監視フォルダ設定をクリアしますか？（パッドやBGMに登録済みの音源は消えません）'
    );
    if (!ok) return;

    this.scanSeq++;
    this.stopWatchLoop();
    this.stopPreview();
    await this.app.db.clearLibrary();
    this.dirHandle = null;
    this.dirName = '';
    this.hasDirPermission = false;
    this.fsItems = [];
    this.poolItems = [];
    this.lastSignature = '';
    this.folderFilter = '';
    this.showPermissionBanner(false);
    this.render();
    this.app.showToast('メディアライブラリをクリアしました');
  }

  render() {
    const listEl = document.getElementById('libraryTrackList');
    const sourceLabel = document.getElementById('librarySourceLabel');
    const rescanBtn = document.getElementById('btnLibRescan');
    const folderSel = document.getElementById('selectLibFolder');
    const countLabel = document.getElementById('libraryCountLabel');
    if (!listEl) return;

    const allItems = [...this.fsItems, ...this.poolItems];

    if (sourceLabel) {
      if (this.dirHandle) {
        sourceLabel.textContent = `監視中: ${this.dirName}`;
      } else if (this.poolItems.length > 0) {
        sourceLabel.textContent = 'ライブラリプール';
      } else {
        sourceLabel.textContent = 'フォルダ未指定';
      }
    }
    if (rescanBtn) {
      rescanBtn.classList.toggle('hidden', !(this.dirHandle && this.hasDirPermission));
    }

    if (folderSel) {
      const folders = Array.from(new Set(allItems.map((it) => it.folder).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b, 'ja', { numeric: true }));
      const prevVal = this.folderFilter;
      folderSel.innerHTML = '<option value="">すべてのフォルダ</option>';
      for (const f of folders) {
        const opt = document.createElement('option');
        opt.value = f;
        opt.textContent = `📁 ${f}`;
        folderSel.appendChild(opt);
      }
      folderSel.value = folders.includes(prevVal) ? prevVal : '';
      this.folderFilter = folderSel.value;
    }

    const q = this.searchQuery;
    const fFilter = this.folderFilter;
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
        ? '<p>📂 フォルダ指定または「＋ 追加」で音源を読み込んでください</p><p class="library-empty-sub">編集モード時：⋮⋮ドラッグでパッド/BGMへ追加・▶で試聴</p>'
        : '<p>条件に一致する音源がありません</p>';
      listEl.appendChild(empty);
      return;
    }

    const frag = document.createDocumentFragment();
    for (const item of filtered) {
      const isPreviewing = this.previewItemId === item.id;
      const row = document.createElement('div');
      row.className = `lib-item${isPreviewing ? ' previewing' : ''}`;
      row.dataset.libId = item.id;
      row.title = item.relPath;
      row.innerHTML = `
        <span class="lib-drag-grip" aria-hidden="true" title="ドラッグしてパッド/BGMへ追加">⋮⋮</span>
        <div class="lib-item-main">
          <div class="lib-item-name">${this.app.escapeHtml(item.name)}</div>
          ${item.folder ? `<div class="lib-item-folder">📁 ${this.app.escapeHtml(item.folder)}</div>` : ''}
        </div>
        <span class="lib-item-ext">${this.app.escapeHtml(item.ext || 'AUD')}</span>
        <button type="button" class="btn-lib-preview edit-only-lib" title="サンプル試聴 (編集モード専用)">${isPreviewing ? '⏹' : '▶'}</button>
        ${item.source === 'pool' ? '<button type="button" class="btn-lib-del edit-only-lib" title="ライブラリから削除">✕</button>' : ''}
      `;

      const prevBtn = row.querySelector('.btn-lib-preview');
      if (prevBtn) {
        prevBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          this.togglePreview(item);
        });
      }
      const delBtn = row.querySelector('.btn-lib-del');
      if (delBtn) {
        delBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          this.deletePoolItem(item);
        });
      }
      row.addEventListener('pointerdown', (e) => this.handlePointerDown(e, item, row));
      frag.appendChild(row);
    }
    listEl.appendChild(frag);
  }

  updatePreviewUI() {
    const listEl = document.getElementById('libraryTrackList');
    if (!listEl) return;
    listEl.querySelectorAll('.lib-item').forEach((row) => {
      const isMatch = Boolean(this.previewItemId && row.dataset.libId === this.previewItemId);
      row.classList.toggle('previewing', isMatch);
      const btn = row.querySelector('.btn-lib-preview');
      if (btn) btn.textContent = isMatch ? '⏹' : '▶';
    });
  }

  ensurePreviewAudioChain() {
    const ctx = this.app.ensureAudioContext();
    if (!this.previewEl) {
      const el = document.createElement('audio');
      el.preload = 'auto';
      el.playsInline = true;
      el.setAttribute('playsinline', '');
      this.previewEl = el;
      // Route through masterSeGain -> masterMixBus -> masterLimiter -> 2x2 outMatrix -> destination + VU meter!
      this.previewSourceNode = ctx.createMediaElementSource(el);
      this.previewSourceNode.connect(this.app.masterSeGain);
    }
    return this.previewEl;
  }

  stopPreview() {
    this.previewSeq++;
    if (this.previewEl) {
      this.previewEl.onended = null;
      this.previewEl.onerror = null;
      try {
        this.previewEl.pause();
        this.previewEl.removeAttribute('src');
        this.previewEl.load();
      } catch (_) { }
    }
    if (this.previewUrl) {
      try { URL.revokeObjectURL(this.previewUrl); } catch (_) { }
      this.previewUrl = null;
    }
    if (this.previewItemId !== null) {
      this.previewItemId = null;
      this.updatePreviewUI();
    }
  }

  async togglePreview(item) {
    if (!this.app.isEditMode) return;
    if (this.previewItemId === item.id) {
      this.stopPreview();
      return;
    }
    this.stopPreview();
    // Synchronously unlock AudioContext & connect Web Audio chain inside user gesture BEFORE await
    const el = this.ensurePreviewAudioChain();
    const mySeq = ++this.previewSeq;

    try {
      const file = await this.getFileFromItem(item);
      if (mySeq !== this.previewSeq || !this.app.isEditMode) return;
      const url = URL.createObjectURL(file);
      this.previewUrl = url;
      this.previewItemId = item.id;
      el.src = url;
      this.updatePreviewUI();

      el.onended = () => {
        if (mySeq === this.previewSeq) this.stopPreview();
      };
      el.onerror = () => {
        if (mySeq === this.previewSeq) {
          this.stopPreview();
          this.app.showToast(`「${item.name}」の試聴に失敗しました`);
        }
      };
      await el.play();
      this.app.wakeAnimationLoop();
    } catch (err) {
      if (mySeq === this.previewSeq) {
        this.stopPreview();
        this.app.showToast(`試聴エラー: ${err.message}`);
      }
    }
  }

  handlePointerDown(e, item, rowEl) {
    if (e.target.closest('.btn-lib-preview, .btn-lib-del')) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    // Protect LIVE mode from accidental pad/BGM overwrites
    if (!this.app.isEditMode) {
      if (e.target.closest('.lib-drag-grip')) {
        this.app.showToast('🛠️ 「編集 EDIT」モードにするとドラッグ＆ドロップできます');
      }
      return;
    }

    const isGrip = Boolean(e.target.closest('.lib-drag-grip'));
    const isMouse = e.pointerType === 'mouse';
    if (!isMouse && !isGrip) return;
    if (isGrip && !isMouse) e.preventDefault();

    const pointerId = e.pointerId;
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
      if (ev.pointerId !== pointerId) return;
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
      if (ev.pointerId !== pointerId) return;
      const wasActive = dragActive;
      const target = wasActive ? findDropTarget(ev.clientX, ev.clientY) : null;
      cleanup();
      if (!wasActive || !target) return;

      if (target.type === 'pad' && Number.isInteger(target.padIndex)) {
        this.assignToPad(item, target.padIndex);
      } else if (target.type === 'bgm') {
        this.addToBgmPlaylist(item);
      }
    };

    const onCancel = (ev) => {
      if (ev.pointerId !== pointerId) return;
      cleanup();
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
  }

  async getFileFromItem(item) {
    if (item.source === 'fs' && item.fileHandle) {
      const f = await item.fileHandle.getFile();
      if (f.type && f.type.startsWith('audio/')) return f;
      return new File([f], f.name, { type: guessAudioMime(f.name) });
    }
    if (item.source === 'pool') {
      const arrayBuffer = await this.app.db.getLibraryBlob(item.id);
      if (!arrayBuffer) throw new Error('ライブラリ音源データが見つかりません');
      const fname = (item.relPath || item.name).split('/').pop();
      return new File([arrayBuffer], fname, { type: guessAudioMime(fname, item.mimeType) });
    }
    throw new Error('音源を取得できませんでした');
  }

  async assignToPad(item, padIndex) {
    const bank = this.app.getCurrentBank();
    if (!bank || !bank.pads[padIndex]) return;
    const pad = bank.pads[padIndex];

    if (pad.audioId) {
      const ok = await this.app.showConfirmDialog(
        'パッドの上書き確認',
        `PAD #${padIndex + 1}「${pad.name}」を「${item.name}」で上書きしますか？`
      );
      if (!ok) return;
      this.app.stopPadVoices(pad.id, 0.03);
    }

    try {
      this.app.showToast(`「${item.name}」を読み込み中...`);
      const file = await this.getFileFromItem(item);
      const info = await this.app.importAudioFileToRecord(file, true);

      // Reset audio parameters cleanly so old pad gain/pitch/speed never bleed into the new sound
      pad.name = info.name;
      pad.audioId = info.audioId;
      pad.gain = 100;
      pad.trimStart = 0;
      pad.trimEnd = Number(info.duration.toFixed(2));
      pad.fadeIn = 0;
      pad.fadeOut = info.duration >= 30 ? 2.5 : 1.5;
      pad.speed = 1.0;
      pad.pitch = 0;
      pad.loop = false;
      pad.triggerMode = info.duration >= 30 ? 'xfade' : 'poly';

      await this.app.saveAppState();
      this.app.gcOrphanAudioFiles();
      this.app.renderPadGrid();
      const xfadeNote = info.duration >= 30 ? '（30秒以上のため X-FADE）' : '';
      this.app.showToast(`PAD #${padIndex + 1} に「${info.name}」をセットしました${xfadeNote}`);
    } catch (err) {
      this.app.showToast(`登録エラー: ${err.message}`);
    }
  }

  async addToBgmPlaylist(item) {
    const pl = this.app.getCurrentPlaylist();
    if (!pl) return;
    try {
      this.app.showToast(`BGMへ「${item.name}」を追加中...`);
      const file = await this.getFileFromItem(item);
      const info = await this.app.importAudioFileToRecord(file, false);
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
      await this.app.saveAppState();
      this.app.renderPlaylistSelector();
      this.app.renderBgmTrackList();
      this.app.updateBgmTransportUI();
      this.app.showToast(`BGMリストに「${info.name}」を追加しました`);
    } catch (err) {
      this.app.showToast(`BGM追加エラー: ${err.message}`);
    }
  }
}
