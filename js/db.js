/**
 * HIKARUNG-PRO v4.0.0 - Clean IndexedDB Storage Layer (HikarungProDB v1)
 * Separates lightweight metadata from heavy audio ArrayBuffers so startup never OOMs on iPadOS.
 */

class HikarungDB {
  constructor() {
    this.dbName = 'HikarungProDB';
    this.version = 1;
    this.db = null;
  }

  async init() {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, this.version);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        const stores = ['appState', 'audioMeta', 'audioBlobs', 'libraryMeta', 'libraryBlobs'];
        for (const name of stores) {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, { keyPath: 'id' });
          }
        }
      };
      req.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  // ---- Project App State ----
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

  // ---- Project Audio (Meta + Blob separated) ----
  async saveAudioFile(record) {
    await this.init();
    const meta = {
      id: record.id,
      name: record.name || '音源',
      mimeType: record.mimeType || 'audio/mpeg',
      duration: safeNum(record.duration, 0),
      size: record.arrayBuffer ? record.arrayBuffer.byteLength : safeNum(record.size, 0)
    };
    const blob = { id: record.id, arrayBuffer: record.arrayBuffer };
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['audioMeta', 'audioBlobs'], 'readwrite');
      tx.objectStore('audioMeta').put(meta);
      tx.objectStore('audioBlobs').put(blob);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  async getAllAudioMeta() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('audioMeta', 'readonly');
      const req = tx.objectStore('audioMeta').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async getAudioFile(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['audioMeta', 'audioBlobs'], 'readonly');
      let meta = null;
      let blob = null;
      tx.objectStore('audioMeta').get(id).onsuccess = (e) => { meta = e.target.result || null; };
      tx.objectStore('audioBlobs').get(id).onsuccess = (e) => { blob = e.target.result || null; };
      tx.oncomplete = () => {
        if (!meta || !blob) resolve(null);
        else resolve({ ...meta, arrayBuffer: blob.arrayBuffer });
      };
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  async deleteAudioFile(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['audioMeta', 'audioBlobs'], 'readwrite');
      tx.objectStore('audioMeta').delete(id);
      tx.objectStore('audioBlobs').delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  async clearProjectData() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['appState', 'audioMeta', 'audioBlobs'], 'readwrite');
      tx.objectStore('appState').clear();
      tx.objectStore('audioMeta').clear();
      tx.objectStore('audioBlobs').clear();
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  // ---- Media Library (Meta + Blob separated — 0 binary bytes loaded at startup!) ----
  async saveLibraryHandle(handle) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('libraryMeta', 'readwrite');
      tx.objectStore('libraryMeta').put({
        id: 'dir_handle',
        type: 'handle',
        handle,
        name: handle.name
      });
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  async saveLibraryPoolEntry(meta, arrayBuffer) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['libraryMeta', 'libraryBlobs'], 'readwrite');
      tx.objectStore('libraryMeta').put({ ...meta, type: 'pool_file' });
      tx.objectStore('libraryBlobs').put({ id: meta.id, arrayBuffer });
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  async getAllLibraryMeta() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('libraryMeta', 'readonly');
      const req = tx.objectStore('libraryMeta').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async getLibraryBlob(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('libraryBlobs', 'readonly');
      const req = tx.objectStore('libraryBlobs').get(id);
      req.onsuccess = () => resolve(req.result ? req.result.arrayBuffer : null);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async deleteLibraryEntry(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['libraryMeta', 'libraryBlobs'], 'readwrite');
      tx.objectStore('libraryMeta').delete(id);
      tx.objectStore('libraryBlobs').delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  async clearLibrary() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['libraryMeta', 'libraryBlobs'], 'readwrite');
      tx.objectStore('libraryMeta').clear();
      tx.objectStore('libraryBlobs').clear();
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  // ---- Factory Reset (reclaims 100% of storage across all stores) ----
  async clearAll() {
    await this.init();
    return new Promise((resolve, reject) => {
      const stores = ['appState', 'audioMeta', 'audioBlobs', 'libraryMeta', 'libraryBlobs'];
      const tx = this.db.transaction(stores, 'readwrite');
      for (const s of stores) tx.objectStore(s).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  }
}
