// Single source of truth for the device performance tier so both the background
// dither and the blob cursor dither pick the same DPR ceiling and shader knobs.
// Detected once at module load.
const detect = () => {
  if (typeof window === 'undefined') return { tier: 'high', dprCap: 2, octaves: 3 };
  const ua = navigator.userAgent || '';
  const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
  const cores = navigator.hardwareConcurrency || 8;
  const mem = navigator.deviceMemory || 8;
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || cores <= 4 || mem <= 4) return { tier: 'low', dprCap: 1, octaves: 2 };
  if (isMobile) return { tier: 'mid', dprCap: 1.5, octaves: 2 };
  return { tier: 'high', dprCap: 2, octaves: 3 };
};

export const deviceTier = detect();

export const getEffectiveDPR = () =>
  Math.min(window.devicePixelRatio || 1, deviceTier.dprCap);
