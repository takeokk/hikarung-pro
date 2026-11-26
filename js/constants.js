/**
 * HIKARUNG-PRO v4.0.0 - Shared Constants & Pure Utilities
 * Zero external dependencies. Classic script for both PWA and file:// Standalone HTML.
 */

const APP_VERSION = 'v4.0.0';

function safeNum(val, fallback) {
  if (val === null || val === undefined || val === '') return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

const AUDIO_EXT_MIME = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
  webm: 'audio/webm',
  opus: 'audio/opus',
  aiff: 'audio/aiff',
  aif: 'audio/aiff'
};

function getFileExtension(filename) {
  const name = String(filename || '');
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || dot === name.length - 1) return '';
  return name.slice(dot + 1).toLowerCase();
}

function isSupportedAudioFilename(filename) {
  const ext = getFileExtension(filename);
  return Boolean(ext && ext in AUDIO_EXT_MIME);
}

function guessAudioMime(filename, fallbackType = '') {
  if (fallbackType && fallbackType.startsWith('audio/')) return fallbackType;
  const ext = getFileExtension(filename);
  return AUDIO_EXT_MIME[ext] || 'audio/mpeg';
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
