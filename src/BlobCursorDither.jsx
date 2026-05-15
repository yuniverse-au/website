import React, { useEffect, useRef, useCallback, useMemo } from "react";
import gsap from "gsap";
import { getEffectiveDPR } from "./deviceTier";

// WebGL2 dither program. Replaces the previous CPU pipeline (getImageData +
// per-cell JS Bayer loop + Path2D fill), which scaled poorly on weak hardware.
// The blob radial gradients are still composed on a 2D canvas (drawCan); this
// shader takes that as a texture and produces the dithered output directly.
const BLOB_VS = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const BLOB_FS = `#version 300 es
precision mediump float;
out vec4 outColor;
uniform sampler2D uSrc;
uniform vec2 uResolution;
uniform vec3 uColor;
uniform float uPixelSize;
uniform float uThreshold;
uniform float uWhiteCutoff;
uniform float uThresholdShift;
uniform float uColorNum;

const float bayer[64] = float[64](
  0.0/64.0, 32.0/64.0,  8.0/64.0, 40.0/64.0,  2.0/64.0, 34.0/64.0, 10.0/64.0, 42.0/64.0,
  48.0/64.0,16.0/64.0, 56.0/64.0, 24.0/64.0, 50.0/64.0, 18.0/64.0, 58.0/64.0, 26.0/64.0,
  12.0/64.0,44.0/64.0,  4.0/64.0, 36.0/64.0, 14.0/64.0, 46.0/64.0,  6.0/64.0, 38.0/64.0,
  60.0/64.0,28.0/64.0, 52.0/64.0, 20.0/64.0, 62.0/64.0, 30.0/64.0, 54.0/64.0, 22.0/64.0,
  3.0/64.0, 35.0/64.0, 11.0/64.0, 43.0/64.0,  1.0/64.0, 33.0/64.0,  9.0/64.0, 41.0/64.0,
  51.0/64.0,19.0/64.0, 59.0/64.0, 27.0/64.0, 49.0/64.0, 17.0/64.0, 57.0/64.0, 25.0/64.0,
  15.0/64.0,47.0/64.0,  7.0/64.0, 39.0/64.0, 13.0/64.0, 45.0/64.0,  5.0/64.0, 37.0/64.0,
  63.0/64.0,31.0/64.0, 55.0/64.0, 23.0/64.0, 61.0/64.0, 29.0/64.0, 53.0/64.0, 21.0/64.0
);

void main() {
  vec2 cell = floor(gl_FragCoord.xy / uPixelSize);
  vec2 cellCenter = cell * uPixelSize + uPixelSize * 0.5;
  // gl_FragCoord origin is bottom-left, but the source canvas is top-left, so flip Y.
  vec2 uv = vec2(cellCenter.x / uResolution.x, 1.0 - cellCenter.y / uResolution.y);
  float a = texture(uSrc, uv).a;

  float stepped = a >= uThreshold ? (a - uThreshold) / (1.0 - uThreshold) : 0.0;

  int bx = int(mod(cell.x, 8.0));
  int by = int(mod(cell.y, 8.0));
  float bv = bayer[by * 8 + bx];

  float q = max(2.0, uColorNum - 1.0);
  float stepSize = 1.0 / q;
  float localCut = clamp(uWhiteCutoff - (bv + uThresholdShift) * stepSize, 0.0, 1.0);

  if (stepped < localCut) {
    outColor = vec4(0.0, 0.0, 0.0, 0.0);
    return;
  }
  outColor = vec4(uColor, 1.0);
}
`;

function compileShader(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn("Blob dither shader compile error:", gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

function createBlobDitherGL(canvas) {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    desynchronized: true,
    powerPreference: "high-performance"
  });
  if (!gl) return null;

  const vs = compileShader(gl, gl.VERTEX_SHADER, BLOB_VS);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, BLOB_FS);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  // Bind attribute location before linking (location 0).
  gl.bindAttribLocation(prog, 0, "aPos");
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn("Blob dither program link error:", gl.getProgramInfoLog(prog));
    return null;
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  // Single oversized triangle covering the screen.
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  // LINEAR so the downsampled source canvas (35% scale) returns a smooth alpha
  // gradient when sampled at the cell centers; the dither itself is the only
  // thing producing the visible blockiness.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const uSrc = gl.getUniformLocation(prog, "uSrc");
  const uResolution = gl.getUniformLocation(prog, "uResolution");
  const uColor = gl.getUniformLocation(prog, "uColor");
  const uPixelSize = gl.getUniformLocation(prog, "uPixelSize");
  const uThreshold = gl.getUniformLocation(prog, "uThreshold");
  const uWhiteCutoff = gl.getUniformLocation(prog, "uWhiteCutoff");
  const uThresholdShift = gl.getUniformLocation(prog, "uThresholdShift");
  const uColorNum = gl.getUniformLocation(prog, "uColorNum");

  // Clear immediately so the canvas presents as transparent before the first
  // loop frame paints anything — otherwise some browsers composite the
  // freshly-allocated drawing buffer as opaque black.
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  return {
    gl,
    clear() {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    },
    render(source, params) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(prog);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.uniform1i(uSrc, 0);
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform3f(uColor, params.color[0] / 255, params.color[1] / 255, params.color[2] / 255);
      gl.uniform1f(uPixelSize, params.pixelSize);
      gl.uniform1f(uThreshold, params.threshold);
      gl.uniform1f(uWhiteCutoff, params.whiteCutoff);
      gl.uniform1f(uThresholdShift, params.thresholdShift);
      gl.uniform1f(uColorNum, params.colorNum);
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
    }
  };
}

// Keep padding configurable in one place so the canvas can draw past the viewport edge
const CANVAS_PADDING = 150;
const MAX_AUTO_RESOLUTION = 8;
const AUTO_RESOLUTION_STEP = 0.5;
const HASH_IDLE_Z_INDEX = 2; // Set z-index for hash overlay when idle
const SKIP_DITHER_WHEN_IDLE = true; // Skip dithering entirely when blob is settled and no input
const IDLE_DITHER_SKIP_THRESHOLD = 200; // ms of no movement before skipping dither
const IDLE_LEAD_ONLY = true; // When idle, draw only the lead blob (skip trails)
const SKIP_MAGNETISM_ON_HIGH_VELOCITY = true; // Skip link detection on fast movement
const HIGH_VELOCITY_THRESHOLD = 150; // pixels/frame - above this, skip magnetism checks
const REDUCE_TRAILS_ON_HIGH_VELOCITY = true; // Skip rendering trail blobs when moving fast

const hexToRgb = (hex) => {
  if (typeof hex !== "string") {
    return { r: 0, g: 0, b: 0 };
  }
  let normalized = hex.trim();
  if (normalized.startsWith("#")) {
    normalized = normalized.slice(1);
  }
  if (normalized.length === 3) {
    normalized = normalized
      .split("")
      .map((char) => char + char)
      .join("");
  }
  if (normalized.length !== 6) {
    return { r: 0, g: 0, b: 0 };
  }
  const int = parseInt(normalized, 16);
  if (Number.isNaN(int)) {
    return { r: 0, g: 0, b: 0 };
  }
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
};

export default function BlobCursorDither({
  trailCount = 4,
  sizes = [200, 125, 75, 50],
  opacities = [0.6, 0.6, 0.6, 0.6],
  fastDuration = 0.1,
  slowDuration = 0.3,
  fastEase = "power3.out",
  slowEase = "power1.out",
  threshold = 0.35,
  color = "#000000",
  hashColor = "#ffffff",
  zIndex = 1,
  homeZIndex = zIndex,
  maskZIndex = zIndex,
  colorNum = 4,
  pixelSize = 2,
  whiteCutoff = 0.7,
  thresholdShift = -0.4,
  onExpansionComplete = null,
  onExpansionStart = null,
  onReturnComplete = null,
  onReturnStart = null,
  mode = "ink",
  maskColor = "#000000",
  clipTargetRef = null,
  additionalClipRefs = [],
  homeClipRefs = [],
  homeMaskSelector = ".home-mask-target",
  maskActivation = "always",
  hashOverlayActive = false,
  logoMagnetism = false,
  logoMagnetismSelector = ".privacy-logo"
}) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const drawCanRef = useRef(null);
  const drawCtxRef = useRef(null);
  // Use the same DPR cap as the background dither so cell sizes line up.
  const DPRRef = useRef(getEffectiveDPR());
  const glRef = useRef(null);
  const maskColorRef = useRef(maskColor);
  const isMaskMode = mode === "mask";
  const maskActiveRef = useRef(isMaskMode && maskActivation === "always");
  const additionalClipRefsMemo = useMemo(
    () => (Array.isArray(additionalClipRefs) ? additionalClipRefs.filter(Boolean) : []),
    [additionalClipRefs]
  );
  const homeClipRefsMemo = useMemo(
    () => (Array.isArray(homeClipRefs) ? homeClipRefs.filter(Boolean) : []),
    [homeClipRefs]
  );
  const activeMaskGroupRef = useRef("hash");
  const maskVisibleTargetsRef = useRef([]);
  const baseColorRef = useRef(hexToRgb(color));
  const hashColorRef = useRef(hexToRgb(hashColor));
  const rgb = useRef(hashOverlayActive ? { ...hashColorRef.current } : { ...baseColorRef.current });
  const maskSizeMultiplierRef = useRef(1);
  const maskSizeTweenRef = useRef(null);
  const autoReactivateOnMoveRef = useRef(false);

  const getMaskTargetsForGroup = useCallback((group) => {
    const targets = [];
    if (group === "home") {
      homeClipRefsMemo.forEach(ref => {
        const node = ref?.current;
        if (node && !targets.includes(node)) {
          targets.push(node);
        }
      });
      if (typeof homeMaskSelector === "string" && homeMaskSelector.trim().length > 0) {
        document.querySelectorAll(homeMaskSelector).forEach(node => {
          if (node instanceof HTMLElement && !targets.includes(node)) {
            targets.push(node);
          }
        });
      }
      return targets;
    }

    if (clipTargetRef?.current) {
      targets.push(clipTargetRef.current);
    }
    additionalClipRefsMemo.forEach(ref => {
      const node = ref?.current;
      if (node && !targets.includes(node)) {
        targets.push(node);
      }
    });
    return targets;
  }, [clipTargetRef, additionalClipRefsMemo, homeClipRefsMemo, homeMaskSelector]);

  const refreshMaskTargets = useCallback(() => {
    const targets = getMaskTargetsForGroup(activeMaskGroupRef.current);
    maskVisibleTargetsRef.current = targets;
    return targets;
  }, [getMaskTargetsForGroup]);

  const getActiveMaskTargets = useCallback(() => {
    if (!maskVisibleTargetsRef.current || maskVisibleTargetsRef.current.length === 0) {
      return refreshMaskTargets();
    }
    return maskVisibleTargetsRef.current;
  }, [refreshMaskTargets]);

  const setActiveMaskGroup = useCallback((group) => {
    if (activeMaskGroupRef.current !== group) {
      activeMaskGroupRef.current = group;
    }
    return refreshMaskTargets();
  }, [refreshMaskTargets]);

  const forEachMaskTarget = useCallback((cb) => {
    const targets = getActiveMaskTargets();
    targets.forEach(cb);
    return targets;
  }, [getActiveMaskTargets]);

  const getPrimaryMaskTarget = useCallback(() => {
    const targets = getActiveMaskTargets();
    return targets[0] || null;
  }, [getActiveMaskTargets]);

  const normalizeHashValue = useCallback((value) => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith("#")) {
      return trimmed.length > 1 ? trimmed.toLowerCase() : null;
    }

    const hashIndex = trimmed.indexOf("#");
    if (hashIndex === -1) return null;

    const hashSegment = trimmed.slice(hashIndex);
    return hashSegment.length > 1 ? hashSegment.toLowerCase() : null;
  }, []);

  const executePendingNavigation = useCallback((overrideUrl) => {
    const target = overrideUrl ?? pendingNavigationRef.current;
    if (!target) {
      return false;
    }

    pendingNavigationRef.current = null;

    try {
      const hashIndex = target.indexOf("#");
      if (hashIndex !== -1) {
        const hashValue = target.slice(hashIndex + 1);
        if (hashValue.length > 0) {
          window.location.hash = hashValue;
        } else {
          window.location.href = target;
        }
      } else {
        const { origin, pathname, search } = window.location;
        const currentBase = `${origin}${pathname}${search}`;
        if (target === currentBase) {
          window.history.replaceState({}, "", target);
        } else {
          window.location.href = target;
        }
      }
    } catch {
      window.location.href = target;
    }

    return true;
  }, []);

  const applyCanvasBlend = useCallback(() => {
    if (!isMaskMode) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    const shouldBlend = hashOverlayActive && !maskActiveRef.current;
    wrap.style.mixBlendMode = shouldBlend ? "difference" : "normal";
  }, [hashOverlayActive, isMaskMode]);

  const setMaskActive = useCallback((active) => {
    maskActiveRef.current = active;
    applyCanvasBlend();
  }, [applyCanvasBlend]);

  const resetBlobZIndex = useCallback(() => {
    if (!wrapRef.current) return;
    const hasHash = window.location.hash && window.location.hash.length > 1;
    wrapRef.current.style.zIndex = hasHash ? String(HASH_IDLE_Z_INDEX) : String(homeZIndex);
  }, [homeZIndex]);

  const restoreHomeContent = useCallback((options = {}) => {
    const { keepVisibleOverrides = false } = options;

    document.querySelectorAll('#site-logo, #site-logo-solid').forEach(logo => {
      if (keepVisibleOverrides) {
        logo.style.display = 'block';
        logo.style.visibility = 'visible';
        logo.style.opacity = '1';
      } else {
        logo.style.display = '';
        logo.style.visibility = 'visible';
        logo.style.opacity = '';
      }
      logo.style.zIndex = '';
    });

    document.querySelectorAll('.side-links:not([data-floating-links])').forEach(nav => {
      if (nav.closest('.home-mask-content')) {
        return;
      }
      if (keepVisibleOverrides) {
        nav.style.display = 'flex';
        nav.style.visibility = 'visible';
        nav.style.opacity = '1';
      } else {
        nav.style.display = '';
        nav.style.visibility = 'visible';
        nav.style.opacity = '';
      }
      nav.style.zIndex = '';
    });

    const baseMessage = document.querySelector('.small-message--base');
    if (baseMessage) {
      if (keepVisibleOverrides) {
        baseMessage.classList.remove('small-message--base-hidden');
        baseMessage.style.display = '';
        baseMessage.style.visibility = 'visible';
        baseMessage.style.opacity = '1';
      } else {
        baseMessage.style.display = '';
        baseMessage.style.visibility = 'visible';
        baseMessage.style.opacity = '';
      }
      baseMessage.style.zIndex = '';
    }

    const ditherLayer = document.querySelector('.app-background-dither');
    if (ditherLayer) {
      ditherLayer.style.display = '';
      ditherLayer.style.visibility = 'visible';
      ditherLayer.style.opacity = '';
    }

    document.querySelectorAll('[data-floating-links="true"]').forEach(node => {
      node.remove();
    });
  }, []);

  const revealHomeLayerDuringReturn = useCallback(() => {
    const targetZ = Math.max(0, Number(homeZIndex) - 1) || 0;

    document.querySelectorAll('#site-logo, #site-logo-solid').forEach(logo => {
      logo.style.display = 'block';
      logo.style.visibility = 'visible';
      logo.style.opacity = '';
      logo.style.zIndex = String(targetZ);
    });

    document.querySelectorAll('.side-links:not([data-floating-links])').forEach(nav => {
      if (nav.closest('.home-mask-content')) {
        return;
      }
      nav.style.display = 'flex';
      nav.style.visibility = 'visible';
      nav.style.opacity = '';
      nav.style.zIndex = String(targetZ);
    });

    const baseMessage = document.querySelector('.small-message--base');
    if (baseMessage) {
      baseMessage.classList.remove('small-message--base-hidden');
      baseMessage.style.display = '';
      baseMessage.style.visibility = 'visible';
      baseMessage.style.opacity = '';
      baseMessage.style.zIndex = String(targetZ);
    }
  }, [homeZIndex]);

  useEffect(() => {
    maskColorRef.current = maskColor;
  }, [maskColor]);

  useEffect(() => {
    if (isExpanding.current) return;
    resetBlobZIndex();
  }, [hashOverlayActive, resetBlobZIndex]);

  // points animated by GSAP
  const points = useRef(
    Array.from({ length: trailCount }, () => ({ x: -9999, y: -9999 }))
  );
  
  // Track previous positions to detect when animation has settled
  const prevPoints = useRef(
    Array.from({ length: trailCount }, () => ({ x: -9999, y: -9999 }))
  );

  // Track link elements and whether we're hovering over one
  const linkElements = useRef([]);
  const logoElements = useRef([]);
  const magnetState = useRef({ active: false, type: null });
  const currentSizeMultiplier = useRef(1);
  const magnetStrength = 120; // Distance within which magnetism activates (increased from 80)

  // Expansion animation state
  const isExpanding = useRef(false);
  const expansionMultiplier = useRef(1);
  const colorTransition = useRef({ r: 0, g: 0, b: 0 });
  const blobOpacity = useRef(1); // Control blob visibility during transition
  const isBlobDisabled = useRef(false);
  const resolutionMultiplier = useRef(1); // Smoothly adjust render resolution during transitions
  const resolutionTween = useRef(null);
  const autoResolutionMultiplier = useRef(1); // Automatic performance-driven resolution scaling
  const autoResolutionTween = useRef(null);
  const temporarilyReenabled = useRef(false);
  const slowFrameDebtRef = useRef(0);
  const fastFrameStreakRef = useRef(0);
  const clipPathCacheRef = useRef("none");
  const isCursorFrozen = useRef(false);
  const latestPointerRef = useRef({ x: 0, y: 0 });
  const pendingNavigationRef = useRef(null);
  const pointerInsideViewportRef = useRef(true);
  const logoFallbackPositionRef = useRef({ x: 0, y: 0 });
  const returnFollowActiveRef = useRef(false);

  const scaledToViewport = useCallback((point) => {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      return null;
    }
    const DPR = DPRRef.current || 1;
    const padding = CANVAS_PADDING;
    return {
      x: point.x / DPR - padding,
      y: point.y / DPR - padding
    };
  }, []);

  const getLatestViewportPointer = useCallback(() => {
    const { x, y } = latestPointerRef.current;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return null;
    }
    return scaledToViewport({ x, y });
  }, [scaledToViewport]);

  const computeFullscreenMultiplier = useCallback((pointerPosition = null) => {
    const smallestBlob = sizes.length > 0 ? Math.min(...sizes) : 200;
    if (!Number.isFinite(smallestBlob) || smallestBlob <= 0) {
      return 1;
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const viewportDiagonal = Math.hypot(viewportWidth, viewportHeight);
    const defaultX = viewportWidth / 2;
    const defaultY = viewportHeight / 2;
    const px = pointerPosition && Number.isFinite(pointerPosition.x) ? pointerPosition.x : defaultX;
    const py = pointerPosition && Number.isFinite(pointerPosition.y) ? pointerPosition.y : defaultY;
    const clampedX = Math.min(Math.max(px, 0), viewportWidth);
    const clampedY = Math.min(Math.max(py, 0), viewportHeight);
    const distances = [
      Math.hypot(clampedX - 0, clampedY - 0),
      Math.hypot(clampedX - viewportWidth, clampedY - 0),
      Math.hypot(clampedX - 0, clampedY - viewportHeight),
      Math.hypot(clampedX - viewportWidth, clampedY - viewportHeight)
    ];
    const maxDistanceToCorner = Math.max(...distances, viewportDiagonal * 0.5);
    const coveragePadding = 1.04;
    const targetDiameter = maxDistanceToCorner * 2 * coveragePadding;
    return targetDiameter / smallestBlob;
  }, [sizes]);

  useEffect(() => {
    const parsedBase = hexToRgb(color);
    baseColorRef.current = parsedBase;
    if (!hashOverlayActive && !isExpanding.current) {
      rgb.current = { ...parsedBase };
    }
  }, [color, hashOverlayActive]);

  useEffect(() => {
    const parsedHash = hexToRgb(hashColor);
    hashColorRef.current = parsedHash;
    if (hashOverlayActive) {
      rgb.current = { ...parsedHash };
    }
  }, [hashColor, hashOverlayActive]);

  useEffect(() => {
    const targetColor = hashOverlayActive ? hashColorRef.current : baseColorRef.current;
    rgb.current = { ...targetColor };
  }, [hashOverlayActive]);

  useEffect(() => {
    const targets = refreshMaskTargets();
    const initialActive = isMaskMode && maskActivation === "always" && maskActivation !== "transition";
    setMaskActive(initialActive);

    if (!targets.length) return;

    // By default keep each clip target cleared and hidden unless the mask is explicitly always-on.
    // NOTE: this sets inline `opacity/visibility` which will win over CSS rules. We intentionally
    // hide the target to avoid showing unmasked content during initial render when the blob isn't
    // yet ready to reveal it. However, if the app is already on a hash page (hashOverlayActive)
    // we must ensure the target is visible immediately — otherwise the inline hidden styles will
    // keep it invisible even when `hash-page-content--visible` is applied.
    if (!isMaskMode || !initialActive) {
      targets.forEach(targetEl => {
        targetEl.style.clipPath = "none";
        targetEl.style.webkitClipPath = "none";
        targetEl.style.opacity = "0";
        targetEl.style.visibility = "hidden"; // Keep masked content out of view until the blob reveals it
      });
      clipPathCacheRef.current = "none";
    }

    // If the parent/app indicates the hash overlay should be active right away (e.g. user landed
    // on a hash page), make sure each clip target is visible. This prevents the inline hiding
    // above from keeping the content invisible when no transition runs.
    if (hashOverlayActive) {
      targets.forEach(targetEl => {
        targetEl.style.clipPath = "none";
        targetEl.style.webkitClipPath = "none";
        targetEl.style.opacity = "1";
        targetEl.style.visibility = "visible";
      });
      clipPathCacheRef.current = "none";
    }
  }, [isMaskMode, maskActivation, setMaskActive, hashOverlayActive, refreshMaskTargets]);

  useEffect(() => {
    applyCanvasBlend();
  }, [applyCanvasBlend]);

  // Quick tweens to avoid re-creating on every move
  const quickX = useRef([]);
  const quickY = useRef([]);

  const setBlobTargetPosition = useCallback((targetX, targetY, { immediate = false, duration = null } = {}) => {
    if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) {
      return;
    }

    latestPointerRef.current.x = targetX;
    latestPointerRef.current.y = targetY;

    const hasQuickTweens = Array.isArray(quickX.current) && quickX.current.length >= trailCount;
    const useCustomTween = Number.isFinite(duration) && duration > 0;

    for (let i = 0; i < trailCount; i++) {
      const point = points.current[i];
      if (!point) continue;

      if (immediate || !hasQuickTweens || useCustomTween) {
        gsap.killTweensOf(point);
        if (immediate || !hasQuickTweens) {
          point.x = targetX;
          point.y = targetY;
          prevPoints.current[i].x = targetX;
          prevPoints.current[i].y = targetY;
        }

        if (useCustomTween) {
          const staggeredDuration = Math.max(0.01, duration + i * 0.08);
          gsap.to(point, {
            x: targetX,
            y: targetY,
            duration: staggeredDuration,
            ease: "power2.out"
          });
          continue;
        }
      }

      quickX.current[i]?.(targetX);
      quickY.current[i]?.(targetY);
    }
  }, [trailCount]);
  
  // Track last movement direction for off-screen animation
  const pendingFadeOut = useRef(false);
  
  // Track velocity for movement-based optimizations
  const isHighVelocityRef = useRef(false);

  // Touch state tracking for mobile fade behavior
  const isTouchingRef = useRef(false);
  const touchFadeTimeoutRef = useRef(null);
  const lastTouchEndTimeRef = useRef(0);
  const velocityRef = useRef({ x: 0, y: 0 });
  const lastTouchPosRef = useRef({ x: 0, y: 0 });
  const lastTouchTimeRef = useRef(0);
  const momentumAnimationRef = useRef(null);

  const resize = useCallback(() => {
    const DPR = getEffectiveDPR();
    DPRRef.current = DPR;

    const c = canvasRef.current;
    if (!c) return;
    
    // Extend canvas beyond viewport so the blob can render past the edge without clipping
    const padding = CANVAS_PADDING;
    const styleWidth = window.innerWidth + padding * 2;
    const styleHeight = window.innerHeight + padding * 2;
    c.width = Math.floor(styleWidth * DPR);
    c.height = Math.floor(styleHeight * DPR);
    c.style.width = `${styleWidth}px`;
    c.style.height = `${styleHeight}px`;
    c.style.left = `-${padding}px`;
    c.style.top = `-${padding}px`;

    // Offscreen draw canvas at 35% resolution. The blob radial gradients are
    // composed here in 2D, then this canvas is uploaded as a texture for the
    // GL dither pass — sampling the smaller source is plenty for the dither.
    const drawScale = 0.35;
    const drawCan = drawCanRef.current || (drawCanRef.current = document.createElement("canvas"));
    drawCan.width = Math.floor(c.width * drawScale);
    drawCan.height = Math.floor(c.height * drawScale);
    drawCtxRef.current = drawCan.getContext("2d", { alpha: true });
  }, []);

  const disableBlob = useCallback((options = {}) => {
    const { autoReactivateOnPointerMove = false } = options;

    autoReactivateOnMoveRef.current = autoReactivateOnPointerMove;
    if (isBlobDisabled.current) {
      return;
    }

    isBlobDisabled.current = true;
    temporarilyReenabled.current = false;
    gsap.killTweensOf(blobOpacity);
    gsap.killTweensOf(resolutionMultiplier);
    gsap.killTweensOf(autoResolutionMultiplier);
    maskSizeTweenRef.current?.kill();
    maskSizeTweenRef.current = null;
    maskSizeMultiplierRef.current = 1;
    resolutionTween.current?.kill();
    resolutionTween.current = null;
    autoResolutionTween.current?.kill();
    autoResolutionTween.current = null;
    blobOpacity.current = 0;
    resolutionMultiplier.current = 1;
    autoResolutionMultiplier.current = 1;
    slowFrameDebtRef.current = 0;
    fastFrameStreakRef.current = 0;
    isCursorFrozen.current = false;

    glRef.current?.clear();
  }, []);

  const fadeOutBlobs = useCallback(() => {
    if (isBlobDisabled.current) return;
    gsap.killTweensOf(blobOpacity);
    gsap.to(blobOpacity, {
      current: 0,
      duration: 1,
      ease: "power2.out"
    });
  }, []);

  const fadeInBlobs = useCallback(() => {
    if (isBlobDisabled.current) return;
    pendingFadeOut.current = false;
    gsap.killTweensOf(blobOpacity);
    gsap.to(blobOpacity, {
      current: 1,
      duration: 0.5,
      ease: "power2.out"
    });
  }, []);

  const scheduleTouchFade = useCallback(() => {
    // Clear any existing fade timeout
    if (touchFadeTimeoutRef.current) {
      clearTimeout(touchFadeTimeoutRef.current);
    }
    
    // Schedule fade out after a delay
    touchFadeTimeoutRef.current = setTimeout(() => {
      if (!isTouchingRef.current && !isExpanding.current) {
        fadeOutBlobs();
      }
    }, 150); // Fade after 150ms of no touch on mobile
  }, [fadeOutBlobs]);

  const applyMomentum = useCallback(() => {
    if (momentumAnimationRef.current) {
      momentumAnimationRef.current.kill();
    }

    const velocity = velocityRef.current;
    const currentPos = { ...latestPointerRef.current };
    
    // Calculate momentum distance based on velocity (reduce by friction)
    const momentumDuration = 0.6;
    const friction = 0.85; // How much velocity to maintain
    const momentumX = velocity.x * friction * 30; // Scale factor for visual effect
    const momentumY = velocity.y * friction * 30;
    
    const targetX = currentPos.x + momentumX;
    const targetY = currentPos.y + momentumY;
    
    // Animate to momentum target with easing
    momentumAnimationRef.current = gsap.to(latestPointerRef.current, {
      x: targetX,
      y: targetY,
      duration: momentumDuration,
      ease: "power2.out",
      onUpdate: () => {
        if (!isTouchingRef.current) {
          // Update blob position during momentum
          const lead = points.current[0];
          if (lead) {
            for (let i = 0; i < trailCount; i++) {
              quickX.current[i]?.(latestPointerRef.current.x);
              quickY.current[i]?.(latestPointerRef.current.y);
            }
          }
        }
      },
      onComplete: () => {
        momentumAnimationRef.current = null;
      }
    });
  }, [trailCount]);

  const reactivateBlob = useCallback((pointerInfo = null) => {
    if (!isBlobDisabled.current) {
      autoReactivateOnMoveRef.current = false;
      return;
    }

    isBlobDisabled.current = false;
    autoReactivateOnMoveRef.current = false;
    temporarilyReenabled.current = false;
    pendingFadeOut.current = false;

    gsap.killTweensOf(blobOpacity);
    gsap.killTweensOf(resolutionMultiplier);
    gsap.killTweensOf(autoResolutionMultiplier);

    resolutionTween.current?.kill();
    resolutionTween.current = null;
    autoResolutionTween.current?.kill();
    autoResolutionTween.current = null;
    maskSizeTweenRef.current?.kill();
    maskSizeTweenRef.current = null;
    maskSizeMultiplierRef.current = 1;

    expansionMultiplier.current = 1;
    currentSizeMultiplier.current = 1;
    blobOpacity.current = 0;
    resolutionMultiplier.current = 1;
    autoResolutionMultiplier.current = 1;
    slowFrameDebtRef.current = 0;
    fastFrameStreakRef.current = 0;
    isCursorFrozen.current = false;

    const hasPointer = pointerInfo && Number.isFinite(pointerInfo.scaledX) && Number.isFinite(pointerInfo.scaledY);
    if (hasPointer) {
      latestPointerRef.current.x = pointerInfo.scaledX;
      latestPointerRef.current.y = pointerInfo.scaledY;

      for (let i = 0; i < trailCount; i++) {
        const point = points.current[i];
        if (!point) continue;
        gsap.killTweensOf(point);
        point.x = pointerInfo.scaledX;
        point.y = pointerInfo.scaledY;
        const prevPoint = prevPoints.current[i];
        if (prevPoint) {
          prevPoint.x = pointerInfo.scaledX;
          prevPoint.y = pointerInfo.scaledY;
        }
      }
    }

    fadeInBlobs();
  }, [fadeInBlobs, trailCount]);

  const onMove = useCallback((e) => {
    if (isBlobDisabled.current) return;

    const wasOutsideViewport = !pointerInsideViewportRef.current;
    pointerInsideViewportRef.current = true;

    // Detect if this is a touch event
    const isTouchEvent = e.type.startsWith('touch');
    
    // Update touch state
    if (isTouchEvent) {
      isTouchingRef.current = true;
      // Clear any pending fade timeout since user is touching
      if (touchFadeTimeoutRef.current) {
        clearTimeout(touchFadeTimeoutRef.current);
        touchFadeTimeoutRef.current = null;
      }
      // Cancel momentum animation when user touches again
      if (momentumAnimationRef.current) {
        momentumAnimationRef.current.kill();
        momentumAnimationRef.current = null;
      }
    }

    const DPR = DPRRef.current;
    const padding = CANVAS_PADDING; // Must match padding in resize()
    let x = "clientX" in e ? e.clientX : e.touches?.[0]?.clientX || 0;
    let y = "clientY" in e ? e.clientY : e.touches?.[0]?.clientY || 0;

    // Track velocity for momentum
    const currentTime = performance.now();
    const timeDelta = currentTime - lastTouchTimeRef.current;
    if (isTouchEvent && timeDelta > 0) {
      const dx = x - lastTouchPosRef.current.x;
      const dy = y - lastTouchPosRef.current.y;
      velocityRef.current.x = dx / timeDelta * 16; // Normalize to ~60fps
      velocityRef.current.y = dy / timeDelta * 16;
    }
    lastTouchPosRef.current.x = x;
    lastTouchPosRef.current.y = y;
    lastTouchTimeRef.current = currentTime;

    // Keep track of the latest pointer position so we can snap to it after transitions
    const pointerScaledX = (x + padding) * DPR;
    const pointerScaledY = (y + padding) * DPR;
    latestPointerRef.current.x = pointerScaledX;
    latestPointerRef.current.y = pointerScaledY;

    if (returnFollowActiveRef.current && wasOutsideViewport) {
      setBlobTargetPosition(pointerScaledX, pointerScaledY, { duration: 0.35 });
      return;
    }

    if (isCursorFrozen.current) {
      return;
    }

    // Check if we're on a subpage (hash route like #about, #linkone, etc.)
    const isOnSubpage = window.location.hash && window.location.hash.length > 1;

    // Calculate cursor velocity for performance optimization
    const prevX = points.current[0].x / DPRRef.current - CANVAS_PADDING;
    const prevY = points.current[0].y / DPRRef.current - CANVAS_PADDING;
    const velocityX = x - prevX;
    const velocityY = y - prevY;
    const velocity = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
    const isHighVelocity = velocity > HIGH_VELOCITY_THRESHOLD;
    isHighVelocityRef.current = isHighVelocity; // Store in ref for rendering loop

    const magnetStatus = magnetState.current;
    const previousMagnetType = magnetStatus.type;
    const wasMagnetActive = magnetStatus.active;
    magnetStatus.active = false;
    magnetStatus.type = null;

    let activeTarget = null;
    let activeTargetType = null;

    if (!isExpanding.current && !isHighVelocity) {
      // Check for privacy page logo magnetism first
      if (logoMagnetism) {
        const privacyLogo = document.querySelector(logoMagnetismSelector);
        if (privacyLogo) {
          const rect = privacyLogo.getBoundingClientRect();
          if (rect && rect.width > 0 && rect.height > 0) {
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const dx = x - centerX;
            const dy = y - centerY;
            const distFromCenter = Math.sqrt(dx * dx + dy * dy);
            
            // Define the logo radius (half the diagonal)
            const logoRadius = Math.sqrt(rect.width * rect.width + rect.height * rect.height) / 2;
            
            // Only apply magnetism if within the logo bounds
            const withinLogo = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
            
            if (withinLogo && distFromCenter < logoRadius) {
              // Calculate magnetism strength: stronger at center (1.0), weaker at edges (near 0)
              // Use a quadratic falloff for smooth transition
              const normalizedDist = distFromCenter / logoRadius;
              const magnetStrengthFactor = Math.pow(1 - normalizedDist, 2); // quadratic falloff
              
              activeTarget = { 
                x: centerX, 
                y: centerY, 
                dist: distFromCenter, 
                radius: logoRadius,
                magnetStrength: magnetStrengthFactor
              };
              activeTargetType = "privacyLogo";
              magnetStatus.active = true;
              magnetStatus.type = activeTargetType;
            }
          }
        }
      }
      
      // Only check other targets if privacy logo magnetism didn't activate
      if (!magnetStatus.active) {
        if (isOnSubpage) {
        for (const logo of logoElements.current) {
          if (!logo) continue;
          const rect = logo.getBoundingClientRect();
          if (!rect || rect.width === 0 || rect.height === 0) {
            continue;
          }

          const withinLogo =
            x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;

          if (!withinLogo) {
            continue;
          }

          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const dx = x - centerX;
          const dy = y - centerY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          const radius = Math.max(rect.width, rect.height) * 0.5;
          const adjustedRadius = Math.max(radius, magnetStrength * 0.75);

          activeTarget = { x: centerX, y: centerY, dist, radius: adjustedRadius };
          activeTargetType = "logo";
          magnetStatus.active = true;
          magnetStatus.type = activeTargetType;
          break;
        }
      } else {
        let closestLink = null;
        let minDist = magnetStrength;

        for (const link of linkElements.current) {
          const rect = link.getBoundingClientRect();
          const linkCenterX = rect.left + rect.width / 2;
          const linkCenterY = rect.top + rect.height / 2;
          const dx = x - linkCenterX;
          const dy = y - linkCenterY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < minDist) {
            minDist = dist;
            closestLink = { x: linkCenterX, y: linkCenterY, dist, radius: magnetStrength };
          }
        }

        if (closestLink && closestLink.dist < magnetStrength) {
          activeTarget = closestLink;
          activeTargetType = "link";
          magnetStatus.active = true;
          magnetStatus.type = activeTargetType;
        }
      }
      }
    }

    if (magnetStatus.active && activeTarget) {
      const magnetRadius = activeTarget.radius ?? magnetStrength;
      const distanceRatio = Math.min(1, magnetRadius > 0 ? activeTarget.dist / magnetRadius : 1);

      let pullStrength = 0;
      if (activeTargetType === "privacyLogo") {
        // Use the pre-calculated magnetStrength from the activeTarget
        // This gives us the quadratic falloff (strong at center, weak at edges)
        pullStrength = activeTarget.magnetStrength * 0.95; // Scale to max 0.95
      } else if (activeTargetType === "logo") {
        const proximity = Math.max(0, 1 - distanceRatio);
        const eased = Math.pow(proximity, 0.85);
        pullStrength = Math.min(0.95, eased * 1.05 + 0.12);
      } else {
        const basePull = Math.max(0, 1 - distanceRatio);
        pullStrength = Math.min(0.95, basePull * 1.2);
      }

      x = x + (activeTarget.x - x) * pullStrength;
      y = y + (activeTarget.y - y) * pullStrength;

      const targetSizeMultiplier = 1.3;
      if (!wasMagnetActive || previousMagnetType !== activeTargetType) {
        gsap.to(currentSizeMultiplier, {
          current: targetSizeMultiplier,
          duration: 0.3,
          ease: "power2.out"
        });
      }
    } else if (wasMagnetActive) {
      gsap.to(currentSizeMultiplier, {
        current: 1,
        duration: 0.3,
        ease: "power2.out"
      });
    }

    if (!isExpanding.current && blobOpacity.current < 1) {
      fadeInBlobs();
    }

    // Skip if movement is too small (< 2px) - reduces unnecessary updates
    // On high velocity, increase threshold to skip more micro-movements
    const threshold = isHighVelocity ? 4 : 2;
    // Add padding offset to account for extended canvas
    const scaledX = (x + padding) * DPR;
    const scaledY = (y + padding) * DPR;
    const lead = points.current[0];
    
    if (Math.abs(lead.x - scaledX) < threshold && Math.abs(lead.y - scaledY) < threshold) {
      return;
    }
    
    // Use traditional loop instead of forEach to avoid callback overhead
    for (let i = 0; i < trailCount; i++) {
      quickX.current[i]?.(scaledX);
      quickY.current[i]?.(scaledY);
    }
  }, [sizes, fadeInBlobs, setBlobTargetPosition]);

  const onLeave = useCallback(() => {
    pointerInsideViewportRef.current = false;

    if (returnFollowActiveRef.current) {
      const { x: fallbackX, y: fallbackY } = logoFallbackPositionRef.current;
      if (Number.isFinite(fallbackX) && Number.isFinite(fallbackY)) {
        setBlobTargetPosition(fallbackX, fallbackY, { duration: 0.45 });
      }
    }

    if (isExpanding.current) {
      pendingFadeOut.current = true;
      return;
    }

    fadeOutBlobs();
  }, [fadeOutBlobs, setBlobTargetPosition]);

  const onTouchEnd = useCallback(() => {
    isTouchingRef.current = false;
    lastTouchEndTimeRef.current = performance.now();

    // Apply momentum if there's sufficient velocity
    const velocityMagnitude = Math.sqrt(
      velocityRef.current.x * velocityRef.current.x +
      velocityRef.current.y * velocityRef.current.y
    );
    
    if (velocityMagnitude > 1) {
      applyMomentum();
    }
    
    // Schedule fade out
    scheduleTouchFade();
  }, [applyMomentum, scheduleTouchFade]);

  const onEnter = useCallback(() => {
    pointerInsideViewportRef.current = true;
    pendingFadeOut.current = false;

    if (hashOverlayActive) {
      return;
    }

    // Kill any ongoing exit animations
    points.current.forEach((p) => {
      gsap.killTweensOf(p);
    });

    if (!isExpanding.current) {
      fadeInBlobs();
    }
  }, [fadeInBlobs, hashOverlayActive]);

  const handleLinkClick = useCallback((e) => {
    if (isExpanding.current) return;

    const targetUrl = e.currentTarget.href;
    pendingNavigationRef.current = targetUrl;
    const targetHash = normalizeHashValue(targetUrl);

    if (e.defaultPrevented) return;
    if ((typeof e.button === "number" && e.button !== 0) || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }

    e.preventDefault();

    setActiveMaskGroup("hash");

  const hashContentNode = document.querySelector('.hash-page-content');
    if (hashContentNode) {
      hashContentNode.style.opacity = '1';
      hashContentNode.style.visibility = 'visible';
    }
    const hashBackgroundNode = document.querySelector('.hash-page-background');
    if (hashBackgroundNode) {
      hashBackgroundNode.style.opacity = '1';
      hashBackgroundNode.style.visibility = 'visible';
    }

    const wasBlobDisabled = isBlobDisabled.current;
    const activateMaskForTransition = isMaskMode && maskActivation === "transition";

    if (wasBlobDisabled) {
      isBlobDisabled.current = false;
      temporarilyReenabled.current = true;
      gsap.killTweensOf(blobOpacity);
      blobOpacity.current = 1;
      resolutionTween.current?.kill();
      resolutionTween.current = null;
      autoResolutionTween.current?.kill();
      autoResolutionTween.current = null;
      resolutionMultiplier.current = 1;
      autoResolutionMultiplier.current = 1;
      slowFrameDebtRef.current = 0;
      fastFrameStreakRef.current = 0;
    } else {
      temporarilyReenabled.current = false;
    }

    isExpanding.current = true;
    if (activateMaskForTransition) {
      setMaskActive(true);
      const targets = forEachMaskTarget(targetEl => {
        targetEl.style.opacity = "1";
        targetEl.style.visibility = "visible";
        targetEl.style.clipPath = "circle(0px at 50% 50%)";
        targetEl.style.webkitClipPath = "circle(0px at 50% 50%)";
      });
      if (targets.length) {
        clipPathCacheRef.current = "circle(0px at 50% 50%)";
      }
    }
    // Begin degrading resolution before the visual expansion fully kicks in
    resolutionTween.current?.kill();
    resolutionTween.current = gsap.to(resolutionMultiplier, {
      current: 6,
      duration: 0.5,
      ease: "power2.out"
    });

    // Freeze blob position - stop tracking cursor
    const frozenPositions = points.current.map(p => ({ x: p.x, y: p.y }));
    points.current.forEach((p, i) => {
      gsap.killTweensOf(p);
      p.x = frozenPositions[i].x;
      p.y = frozenPositions[i].y;
    });
    if (frozenPositions.length > 0) {
      latestPointerRef.current.x = frozenPositions[0].x;
      latestPointerRef.current.y = frozenPositions[0].y;
    }
    isCursorFrozen.current = true;
    magnetState.current.active = false;
    magnetState.current.type = null;
    
    // Remove any previous floating overlays
    document.querySelectorAll('[data-floating-links="true"]').forEach(node => {
      node.remove();
    });

    const sideNavs = Array.from(document.querySelectorAll('.side-links'));

    // Duplicate each side nav so layout/spacing matches the original stack
    sideNavs.forEach(nav => {
      const computedNav = window.getComputedStyle(nav);
      const navClone = nav.cloneNode(true);

  navClone.setAttribute('data-floating-links', 'true');
  navClone.setAttribute('aria-hidden', 'true');
  navClone.style.position = 'fixed';
  navClone.style.pointerEvents = 'none';
  navClone.style.mixBlendMode = computedNav.mixBlendMode;
  navClone.style.filter = computedNav.filter;
  navClone.style.zIndex = '100';

      const anchorNodes = Array.from(navClone.querySelectorAll('.side-links__a'));
      anchorNodes.forEach(anchor => {
        const span = document.createElement('span');
        span.className = anchor.className;
        span.textContent = anchor.textContent;
        span.setAttribute('aria-hidden', 'true');

        const anchorStyles = window.getComputedStyle(anchor);
        span.style.display = anchorStyles.display;
        span.style.transform = anchorStyles.transform;
        span.style.transformOrigin = anchorStyles.transformOrigin;
        span.style.whiteSpace = anchorStyles.whiteSpace;
        span.style.fontFamily = anchorStyles.fontFamily;
        span.style.fontSize = anchorStyles.fontSize;
        span.style.fontWeight = anchorStyles.fontWeight;
        span.style.letterSpacing = anchorStyles.letterSpacing;
        span.style.lineHeight = anchorStyles.lineHeight;
        span.style.padding = anchorStyles.padding;
        span.style.pointerEvents = 'none';
        span.style.color = 'inherit';
        span.style.textDecoration = 'none';

        const anchorAttr = anchor.getAttribute('href') || '';
        const anchorHash = normalizeHashValue(anchorAttr);
        const isTarget = targetHash ? anchorHash === targetHash : anchor.href === targetUrl;
        span.style.opacity = (isTarget || !targetHash) ? '1' : '0';
        span.style.visibility = (isTarget || !targetHash) ? 'visible' : 'hidden';

        anchor.replaceWith(span);
      });

      // Append floating link to hash page content wrapper so it gets masked
      const hashPageContent = document.querySelector('.hash-page-content');
      if (hashPageContent) {
        hashPageContent.appendChild(navClone);
      } else {
        document.body.appendChild(navClone);
      }
    });
    
    // Raise blob above everything (above both hash content and floating links)
    if (wrapRef.current) {
      wrapRef.current.style.zIndex = String(maskZIndex);
    }
    
  // Initialize color transition tracker to the active blob color
  colorTransition.current = { ...rgb.current };
    
    const coveragePointer = (() => {
      const latestPointer = getLatestViewportPointer();
      if (latestPointer) return latestPointer;
      const leadPoint = points.current[0];
      if (leadPoint) {
        return scaledToViewport({ x: leadPoint.x, y: leadPoint.y });
      }
      return null;
    })();

    const finalMultiplier = computeFullscreenMultiplier(coveragePointer);
    
    // Pause the dither background rendering during expansion for better performance
    if (onExpansionStart) {
      onExpansionStart();
    }
    
    // Phase 1: Expand blob to fill screen (1 second pulse)
    const isHashNavigation = Boolean(targetHash);

    gsap.to(expansionMultiplier, {
      current: finalMultiplier,
      duration: 1.5,
      ease: "expo.out",
      onUpdate: () => {
        currentSizeMultiplier.current = expansionMultiplier.current;
      },
      onComplete: () => {
        // Phase 2: Swap background to black while the mask still hides content
        document.body.style.backgroundColor = '#000000';

        if (activateMaskForTransition) {
          // Drop mask as soon as expansion finishes so only the blob fade remains visible
          setMaskActive(false);
          const targets = forEachMaskTarget(targetEl => {
            targetEl.style.clipPath = "none";
            targetEl.style.webkitClipPath = "none";
            targetEl.style.opacity = "1";
            targetEl.style.visibility = "visible";
          });
          if (targets.length) {
            clipPathCacheRef.current = "none";
          }
        }
        
        // Hide the anchored logos so only the masked clone remains visible
        document.querySelectorAll('#site-logo, #site-logo-solid').forEach(logo => {
          logo.style.display = 'none';
        });
        document.querySelectorAll('.side-links:not([data-floating-links])').forEach(nav => {
          if (nav.closest('.home-mask-content')) {
            return;
          }
          nav.style.display = 'none';
        });
        
        // Phase 3: Hide blobs and shrink back to original size
        const finalizeTransition = () => {
          maskSizeTweenRef.current?.kill();
          maskSizeTweenRef.current = null;
          maskSizeMultiplierRef.current = 1;
          rgb.current = { ...hashColorRef.current };

          resolutionTween.current?.kill();
          resolutionTween.current = gsap.to(resolutionMultiplier, {
            current: 1,
            duration: 0.6,
            ease: "power2.inOut"
          });

          if (onExpansionComplete) {
            onExpansionComplete();
          }

          executePendingNavigation(targetUrl);

          isExpanding.current = false; // Allow cursor tracking to resume

          if (pendingFadeOut.current) {
            pendingFadeOut.current = false;
            if (temporarilyReenabled.current) {
              disableBlob();
              temporarilyReenabled.current = false;
            }
            fadeOutBlobs();
            setTimeout(() => {
              executePendingNavigation(targetUrl);
              requestAnimationFrame(resetBlobZIndex);
            }, 1000);
            return;
          }

          setTimeout(() => {
            if (temporarilyReenabled.current) {
              disableBlob();
              temporarilyReenabled.current = false;
              executePendingNavigation(targetUrl);
              requestAnimationFrame(resetBlobZIndex);
              return;
            }

            if (isHashNavigation) {
              // Keep the blob disabled and preserve the expanded scale for hash destinations.
              disableBlob();
              temporarilyReenabled.current = false;
              executePendingNavigation();
              requestAnimationFrame(resetBlobZIndex);
              return;
            }

            // Restore blob layer z-index before fading back in so the canvas
            // returns to its normal stacking order while it fades into view.
            resetBlobZIndex();

            gsap.to(blobOpacity, {
              current: 1,
              duration: 0.8,
              ease: "power2.inOut",
              onComplete: () => {
                // Navigate to the target URL
                executePendingNavigation();
                // Reset blob layer depth once the fade completes
                requestAnimationFrame(resetBlobZIndex);
              }
            });
          }, 50); // Small delay to let cursor tracking resume
        };

        gsap.to(blobOpacity, {
          current: 0,
          duration: 0.25,
          ease: "power2.out",
          onComplete: () => {
            // Allow blobs to resume tracking before the color swap
            isCursorFrozen.current = false;
            const { x: resumeX, y: resumeY } = latestPointerRef.current;
            if (Number.isFinite(resumeX) && Number.isFinite(resumeY)) {
              for (let i = 0; i < trailCount; i++) {
                if (quickX.current[i]) {
                  quickX.current[i](resumeX);
                }
                if (quickY.current[i]) {
                  quickY.current[i](resumeY);
                }
              }
            }
            if (isHashNavigation) {
              // Preserve the expansion scale for hash pages rather than shrinking back.
              currentSizeMultiplier.current = expansionMultiplier.current;
              finalizeTransition();
              return;
            }

            // Shrink back to original size (while still hidden)
            maskSizeMultiplierRef.current = 1;
            maskSizeTweenRef.current?.kill();
            const shrinkTimeline = gsap.timeline({
              onComplete: () => {
                maskSizeTweenRef.current = null;
                finalizeTransition();
              }
            });
            maskSizeTweenRef.current = shrinkTimeline;
            shrinkTimeline.to(maskSizeMultiplierRef, {
              current: 0.01,
              duration: 0.9,
              ease: "expo.out"
            }, 0);
            shrinkTimeline.to(expansionMultiplier, {
              current: 1,
              duration: 0.6,
              ease: "expo.out",
              onUpdate: () => {
                currentSizeMultiplier.current = expansionMultiplier.current;
              }
            }, 0);
          }
        });
      }
    });
  }, [sizes, onExpansionComplete, onExpansionStart, zIndex, fadeOutBlobs, disableBlob, setMaskActive, forEachMaskTarget, normalizeHashValue, setActiveMaskGroup, resetBlobZIndex, computeFullscreenMultiplier, getLatestViewportPointer, scaledToViewport]);

  // Handle clicking on the logo to return to home (remove hash) with a mirrored transition
  const handleLogoClick = useCallback((e) => {
    if (isExpanding.current) return;

    const currentHash = window.location.hash;
    if (!currentHash || currentHash.length <= 1) return;

    e.preventDefault();

    const { origin, pathname, search } = window.location;
    const baseUrl = `${origin}${pathname}${search}`;
    pendingNavigationRef.current = baseUrl;

    if (onReturnStart) {
      onReturnStart();
    }

    const activateMaskForTransition = isMaskMode && maskActivation === "transition";
    const wasBlobDisabled = isBlobDisabled.current;

    if (wasBlobDisabled) {
      isBlobDisabled.current = false;
      temporarilyReenabled.current = false;
      gsap.killTweensOf(blobOpacity);
      blobOpacity.current = 1;
      resolutionTween.current?.kill();
      resolutionTween.current = null;
      autoResolutionTween.current?.kill();
      autoResolutionTween.current = null;
      resolutionMultiplier.current = 1;
      autoResolutionMultiplier.current = 1;
      slowFrameDebtRef.current = 0;
      fastFrameStreakRef.current = 0;
    } else {
      temporarilyReenabled.current = false;
      if (blobOpacity.current < 1) {
        blobOpacity.current = 1;
      }
    }

    returnFollowActiveRef.current = true;

    const DPR = DPRRef.current;
    const padding = CANVAS_PADDING;
    const logoNode = e.currentTarget;
    const logoRect = logoNode instanceof HTMLElement ? logoNode.getBoundingClientRect() : null;

    let fallbackX = (window.innerWidth * 0.5 + padding) * DPR;
    let fallbackY = (window.innerHeight * 0.5 + padding) * DPR;
    if (logoRect && logoRect.width > 0 && logoRect.height > 0) {
      const logoCenterX = logoRect.left + logoRect.width / 2;
      const logoCenterY = logoRect.top + logoRect.height / 2;
      fallbackX = (logoCenterX + padding) * DPR;
      fallbackY = (logoCenterY + padding) * DPR;
    }
    logoFallbackPositionRef.current = { x: fallbackX, y: fallbackY };

    const pointerInside = pointerInsideViewportRef.current;
    const initialX = pointerInside ? latestPointerRef.current.x : fallbackX;
    const initialY = pointerInside ? latestPointerRef.current.y : fallbackY;
    setBlobTargetPosition(initialX, initialY, { immediate: true });

    magnetState.current.active = false;
    magnetState.current.type = null;
    isCursorFrozen.current = false;
    rgb.current = { ...hashColorRef.current };

    if (wrapRef.current) {
      wrapRef.current.style.zIndex = String(maskZIndex);
    }

    const hashContentNode = document.querySelector('.hash-page-content');
    if (hashContentNode) {
      hashContentNode.style.pointerEvents = 'none';
      hashContentNode.style.visibility = 'visible';
      hashContentNode.style.opacity = '1';
      gsap.killTweensOf(hashContentNode);
    }

    const hashBackgroundNode = document.querySelector('.hash-page-background');
    if (hashBackgroundNode) {
      gsap.killTweensOf(hashBackgroundNode);
      hashBackgroundNode.style.visibility = 'visible';
      hashBackgroundNode.style.opacity = '1';
    }

    document.querySelectorAll('[data-floating-links="true"]').forEach(node => {
      node.style.visibility = 'visible';
      node.style.opacity = '1';
    });

    setActiveMaskGroup("hash");
    revealHomeLayerDuringReturn();
    maskSizeTweenRef.current?.kill();
    maskSizeTweenRef.current = null;
    maskSizeMultiplierRef.current = 1;
    if (activateMaskForTransition) {
      setMaskActive(true);
      const targets = forEachMaskTarget(targetEl => {
        targetEl.style.opacity = "1";
        targetEl.style.visibility = "visible";
        targetEl.style.clipPath = "circle(0px at 50% 50%)";
        targetEl.style.webkitClipPath = "circle(0px at 50% 50%)";
      });
      if (targets.length) {
        clipPathCacheRef.current = "circle(0px at 50% 50%)";
      }
    }

    resolutionTween.current?.kill();
    resolutionTween.current = gsap.to(resolutionMultiplier, {
      current: 6,
      duration: 0.5,
      ease: "power2.out"
    });

    isExpanding.current = true;

    const coveragePointer = (() => {
      if (pointerInsideViewportRef.current) {
        const latestPointer = getLatestViewportPointer();
        if (latestPointer) {
          return latestPointer;
        }
      }
      const fallbackViewport = scaledToViewport(logoFallbackPositionRef.current);
      if (fallbackViewport) {
        return fallbackViewport;
      }
      return getLatestViewportPointer();
    })();

    const finalMultiplier = computeFullscreenMultiplier(coveragePointer);

    const finalizeTransition = () => {
  returnFollowActiveRef.current = false;
      pendingFadeOut.current = false;
      maskSizeTweenRef.current?.kill();
      maskSizeTweenRef.current = null;
      maskSizeMultiplierRef.current = 1;

      document.body.style.backgroundColor = '';

      if (hashContentNode) {
        hashContentNode.style.pointerEvents = 'none';
        hashContentNode.style.opacity = '0';
        hashContentNode.style.visibility = 'hidden';
      }
      if (hashBackgroundNode) {
        hashBackgroundNode.style.opacity = '0';
        hashBackgroundNode.style.visibility = 'hidden';
      }

      document.querySelectorAll('[data-floating-links="true"]').forEach(node => node.remove());
      document.querySelectorAll('.side-links--diff').forEach(nav => {
        nav.style.display = 'none';
      });

      resolutionTween.current?.kill();
      resolutionTween.current = null;
      autoResolutionTween.current?.kill();
      autoResolutionTween.current = null;

      resolutionMultiplier.current = 1;
      autoResolutionMultiplier.current = 1;
      slowFrameDebtRef.current = 0;
      fastFrameStreakRef.current = 0;

  rgb.current = { ...baseColorRef.current };
  expansionMultiplier.current = 0.01;
  currentSizeMultiplier.current = 0.01;

      setMaskActive(false);
      const targets = forEachMaskTarget(targetEl => {
        targetEl.style.clipPath = "none";
        targetEl.style.webkitClipPath = "none";
        targetEl.style.opacity = "0";
        targetEl.style.visibility = "hidden";
      });
      if (targets.length) {
        clipPathCacheRef.current = "none";
      }

      restoreHomeContent({ keepVisibleOverrides: true });

      isExpanding.current = false;
      isCursorFrozen.current = false;
      temporarilyReenabled.current = false;

      if (wrapRef.current) {
        wrapRef.current.style.zIndex = String(homeZIndex);
      }
      resetBlobZIndex();

      if (onReturnComplete) {
        onReturnComplete();
      }

      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(() => restoreHomeContent());
      } else {
        setTimeout(() => restoreHomeContent(), 0);
      }

      disableBlob({ autoReactivateOnPointerMove: true });
      executePendingNavigation();
      requestAnimationFrame(resetBlobZIndex);
    };

    const beginShrink = () => {
      const pointerInsideNow = pointerInsideViewportRef.current;
      const { x: fallbackTargetX, y: fallbackTargetY } = logoFallbackPositionRef.current;
      if (!pointerInsideNow && Number.isFinite(fallbackTargetX) && Number.isFinite(fallbackTargetY)) {
        setBlobTargetPosition(fallbackTargetX, fallbackTargetY, { immediate: false });
      }

      resolutionTween.current?.kill();
      resolutionTween.current = gsap.to(resolutionMultiplier, {
        current: 1,
        duration: 0.6,
        ease: "power2.inOut"
      });

      maskSizeMultiplierRef.current = 1;
      maskSizeTweenRef.current?.kill();
      const shrinkTimeline = gsap.timeline({
        onComplete: () => {
          maskSizeTweenRef.current = null;
          finalizeTransition();
        }
      });
      maskSizeTweenRef.current = shrinkTimeline;
      shrinkTimeline.to(maskSizeMultiplierRef, {
        current: 0.01,
        duration: 0.9,
        ease: "expo.out"
      }, 0);
      shrinkTimeline.to(expansionMultiplier, {
        current: 0.01,
        duration: 0.6,
        ease: "expo.out",
        onUpdate: () => {
          currentSizeMultiplier.current = expansionMultiplier.current;
        }
      }, 0);
    };

    gsap.killTweensOf(blobOpacity);
    blobOpacity.current = 1;

    expansionMultiplier.current = finalMultiplier;
    currentSizeMultiplier.current = finalMultiplier;

    gsap.delayedCall(0.1, () => {
      document.body.style.backgroundColor = '';
      beginShrink();
    });
  }, [sizes, maskZIndex, homeZIndex, isMaskMode, maskActivation, onReturnStart, onReturnComplete, setActiveMaskGroup, setMaskActive, forEachMaskTarget, setBlobTargetPosition, resetBlobZIndex, restoreHomeContent, executePendingNavigation, computeFullscreenMultiplier, revealHomeLayerDuringReturn, getLatestViewportPointer, scaledToViewport]);

  useEffect(() => {
    resize();
    
    // Cache link element references and attach click handlers
    const updateInteractiveElements = () => {
      // Remove existing handlers to avoid duplicates when refreshing references
      linkElements.current.forEach(link => {
        link.removeEventListener('click', handleLinkClick);
      });
      logoElements.current.forEach(logo => {
        logo.removeEventListener('click', handleLogoClick);
      });

      linkElements.current = Array.from(document.querySelectorAll('.side-links__a'));
      logoElements.current = Array.from(document.querySelectorAll('#site-logo, #site-logo-solid, .logo--hash'));

      // Attach click handlers to all links
      linkElements.current.forEach(link => {
        link.addEventListener('click', handleLinkClick);
      });
      // Attach handler to logos (for return transition)
      logoElements.current.forEach(logo => {
        logo.addEventListener('click', handleLogoClick);
      });
    };
    updateInteractiveElements();
    
    // Update link positions on resize
    let resizeRaf = 0;
    const onResize = () => {
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
  resize();
  updateInteractiveElements();
      });
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("touchstart", onMove, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    if (!hashOverlayActive) {
      window.addEventListener("mouseleave", onLeave);
      window.addEventListener("mouseenter", onEnter);
      document.documentElement.addEventListener("mouseleave", onLeave);
    }

    // set up quickTo tweens once
    points.current.forEach((p, i) => {
      const isLead = i === 0;
      quickX.current[i] = gsap.quickTo(p, "x", {
        duration: isLead ? fastDuration : slowDuration,
        ease: isLead ? fastEase : slowEase
      });
      quickY.current[i] = gsap.quickTo(p, "y", {
        duration: isLead ? fastDuration : slowDuration,
        ease: isLead ? fastEase : slowEase
      });
    });

    const c = canvasRef.current;
    if (!glRef.current) glRef.current = createBlobDitherGL(c);
    const blobGL = glRef.current;
    if (!blobGL) {
      // WebGL2 unavailable — bail out cleanly. The blob is decorative.
      return () => {};
    }

    const drawCtx = () => drawCtxRef.current;
    const drawCan = () => drawCanRef.current;

    let raf = 0;
    let lastMoveTime = performance.now();
    let isMoving = false;
  let idleTimer = null;
    
    // Track if animations are still settling
    const settlementThreshold = 0.5; // pixels - if all blobs move less than this, consider settled
    let isSettled = false;
    let settledFrameCount = 0;
    const requiredSettledFrames = 3; // Need 3 consecutive frames of minimal movement to confirm settled
    
    const loop = (currentTime) => {
      raf = requestAnimationFrame(loop);

      if (isBlobDisabled.current) {
        return;
      }

      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      
      // Check if blobs are still animating by comparing current vs previous positions
      let maxMovement = 0;
      for (let i = 0; i < trailCount; i++) {
        const curr = points.current[i];
        const prev = prevPoints.current[i];
        if (!curr || !prev) continue;
        const dx = curr.x - prev.x;
        const dy = curr.y - prev.y;
        const movement = Math.sqrt(dx * dx + dy * dy);
        maxMovement = Math.max(maxMovement, movement);
        
        // Update previous positions for next frame
        prev.x = curr.x;
        prev.y = curr.y;
      }
      
      // Check if animations have settled
      if (maxMovement < settlementThreshold) {
        settledFrameCount++;
        if (settledFrameCount >= requiredSettledFrames) {
          isSettled = true;
        }
      } else {
        settledFrameCount = 0;
        isSettled = false;
      }
      
      // Only render if cursor moved recently OR animations are still settling OR expanding OR fading
      const timeSinceMove = currentTime - lastMoveTime;
      const isFading = blobOpacity.current > 0 && blobOpacity.current < 1;
      const maskActive = isMaskMode && (maskActivation === "always" || (maskActivation === "transition" && maskActiveRef.current));
      const isRecentTouch = (currentTime - lastTouchEndTimeRef.current) < 3000;
      const isIdle = timeSinceMove > IDLE_DITHER_SKIP_THRESHOLD && !isMoving && isSettled && !isExpanding.current && !isFading && !isRecentTouch;
      const shouldSkipIdle = SKIP_DITHER_WHEN_IDLE && !maskActive;

      if (isIdle && shouldSkipIdle) {
        return; // Skip rendering entirely when blob is idle to save CPU
      }

      if (!maskActive && timeSinceMove > 100 && !isMoving && isSettled && !isExpanding.current && !isFading && !isRecentTouch) {
        return; // Skip rendering when everything is settled and not exiting or expanding or fading
      }
      
      // Measure render time for adaptive performance
      const renderStartTime = performance.now();

      const DPR = DPRRef.current;
      const dctx = drawCtx();
      const dcan = drawCan();
      const drawScale = dcan.width / c.width;

      dctx.clearRect(0, 0, dcan.width, dcan.height);

      let activeTrailCount = trailCount;
      if (isHighVelocityRef.current && REDUCE_TRAILS_ON_HIGH_VELOCITY) {
        activeTrailCount = Math.max(1, Math.ceil(trailCount * 0.5));
      }
      if (autoResolutionMultiplier.current >= 4 && trailCount > 3) {
        activeTrailCount = Math.min(activeTrailCount, trailCount - 1);
      }
      if (autoResolutionMultiplier.current >= 6 && trailCount > 2) {
        activeTrailCount = Math.min(activeTrailCount, trailCount - 2);
      }

      // Compose blob radial gradients onto the small 2D draw canvas. The GL
      // dither pass below uses this canvas as a texture.
      dctx.globalCompositeOperation = "source-over";
      const trailsToRender = (isIdle && IDLE_LEAD_ONLY) ? 1 : activeTrailCount;

      for (let i = 0; i < trailCount; i++) {
        if (i >= trailsToRender) break;
        const p = points.current[i];
        if (!p || p.x < -9000) continue;
        const baseSize = sizes[i] || sizes[sizes.length - 1];
        const R = baseSize * DPR * drawScale * 0.5 * currentSizeMultiplier.current;
        const scaledX = p.x * drawScale;
        const scaledY = p.y * drawScale;

        // Fade trailing blobs at high velocity so motion reads as a soft trail
        // instead of a jittery stack.
        const velocityOpacityMultiplier = isHighVelocityRef.current && i > 0 ? 0.5 : 1;
        dctx.globalAlpha = (opacities[i] ?? 1) * blobOpacity.current * velocityOpacityMultiplier;

        const grad = dctx.createRadialGradient(scaledX, scaledY, 0, scaledX, scaledY, R);
        grad.addColorStop(0, "rgba(0,0,0,1)");
        grad.addColorStop(1, "rgba(0,0,0,0)");
        dctx.fillStyle = grad;
        dctx.beginPath();
        dctx.arc(scaledX, scaledY, R, 0, Math.PI * 2);
        dctx.fill();
      }

      dctx.globalAlpha = 1;

      const cssScale = 1 / DPR;
      const primaryMaskTarget = getPrimaryMaskTarget();
      const shouldUpdateCircleClip = maskActive && primaryMaskTarget;
      const canvasRect = shouldUpdateCircleClip ? c.getBoundingClientRect() : null;

      const shouldUseMaskColor = maskActive && activeMaskGroupRef.current !== "home";
      let fillR, fillG, fillB;
      if (shouldUseMaskColor) {
        const m = hexToRgb(maskColorRef.current);
        fillR = m.r; fillG = m.g; fillB = m.b;
      } else {
        const cur = rgb.current;
        fillR = cur.r; fillG = cur.g; fillB = cur.b;
      }

      // pixelSize is in device px of the rendered canvas, matching the
      // background dither's semantics. Both canvases share getEffectiveDPR(),
      // so the same value yields the same on-screen cell size.
      blobGL.render(dcan, {
        color: [fillR, fillG, fillB],
        pixelSize: Math.max(1, pixelSize),
        threshold,
        whiteCutoff,
        thresholdShift,
        colorNum
      });

      if (shouldUpdateCircleClip) {
        const lead = points.current[0];
        const defaultMaskReference = (() => {
          if (!Array.isArray(sizes) || sizes.length === 0) return 0;
          if (sizes.length === 1) return sizes[0];
          const sorted = [...sizes].sort((a, b) => a - b);
          return sorted[1] ?? sorted[0];
        })();
        const smallestSize = Array.isArray(sizes) && sizes.length ? Math.min(...sizes) : 0;
        let sizeReference = defaultMaskReference;

        // During the expansion swell keep the mask tied to the smallest blob so it never exposes content.
        if (isExpanding.current && smallestSize > 0) {
          sizeReference = smallestSize;
        }
        if (sizeReference <= 0 && smallestSize > 0) {
          sizeReference = smallestSize;
        }

        const leadSize = Array.isArray(sizes) && sizes.length ? sizes[0] : sizeReference;
        const hasPosition = lead && lead.x > -9000 && lead.y > -9000;
        const maskScale = maskSizeMultiplierRef.current;
        let radius = hasPosition ? Math.max(0, (sizeReference * currentSizeMultiplier.current * maskScale) / 2) : 0;

        if (radius > 0 && leadSize > 0) {
          const maxMaskRadius = (leadSize * currentSizeMultiplier.current * maskScale) / 2;
          const clampFactor = isExpanding.current ? 0.96 : 1;
          const safeRadius = Math.max(0, maxMaskRadius * clampFactor);
          radius = Math.min(radius, safeRadius || radius);
        }

        if (primaryMaskTarget && radius > 0 && canvasRect) {
          const centerX = lead.x * cssScale + canvasRect.left;
          const centerY = lead.y * cssScale + canvasRect.top;
          const formatPx = (value) => `${Math.round(value * 100) / 100}px`;
          const clipValue = `circle(${formatPx(radius)} at ${formatPx(centerX)} ${formatPx(centerY)})`;

          if (clipPathCacheRef.current !== clipValue) {
            clipPathCacheRef.current = clipValue;
            forEachMaskTarget(targetEl => {
              targetEl.style.clipPath = clipValue;
              targetEl.style.webkitClipPath = clipValue;
            });
          }
        } else if (clipPathCacheRef.current !== "none" && primaryMaskTarget) {
          clipPathCacheRef.current = "none";
          forEachMaskTarget(targetEl => {
            targetEl.style.clipPath = "none";
            targetEl.style.webkitClipPath = "none";
          });
        }
      } else if (clipPathCacheRef.current !== "none" && primaryMaskTarget) {
        clipPathCacheRef.current = "none";
        forEachMaskTarget(targetEl => {
          targetEl.style.clipPath = "none";
          targetEl.style.webkitClipPath = "none";
        });
      }
      
    // Adaptive performance: measure frame time and adjust target FPS
    const renderEndTime = performance.now();
    const frameTime = renderEndTime - renderStartTime;

  const fastRecoveryDuration = 1000 / 45; // ~45fps threshold to recover faster
    const frameDebtThreshold = 65; // milliseconds before we consider frame too slow
      const frameDebtMax = 6;
      const frameRecoveryMax = 8;

      if (!isExpanding.current) {
        if (frameTime > frameDebtThreshold) {
          slowFrameDebtRef.current = Math.min(frameDebtMax, slowFrameDebtRef.current + 1);
          fastFrameStreakRef.current = Math.max(0, fastFrameStreakRef.current - 1);
        } else if (frameTime < fastRecoveryDuration) {
          fastFrameStreakRef.current = Math.min(frameRecoveryMax, fastFrameStreakRef.current + 1);
          slowFrameDebtRef.current = Math.max(0, slowFrameDebtRef.current - 1);
        } else {
          slowFrameDebtRef.current = Math.max(0, slowFrameDebtRef.current - 1);
          fastFrameStreakRef.current = Math.max(0, fastFrameStreakRef.current - 1);
        }

        if (slowFrameDebtRef.current >= frameDebtMax) {
          const resolutionMaxed = autoResolutionMultiplier.current >= MAX_AUTO_RESOLUTION - 0.001;

          if (resolutionMaxed && !isFading && !isRecentTouch) {
            disableBlob();
            return;
          }

          if (!resolutionMaxed) {
            const nextMultiplier = Math.min(MAX_AUTO_RESOLUTION, autoResolutionMultiplier.current + AUTO_RESOLUTION_STEP);
            if (nextMultiplier > autoResolutionMultiplier.current + 0.001) {
              autoResolutionTween.current?.kill();
              autoResolutionTween.current = gsap.to(autoResolutionMultiplier, {
                current: nextMultiplier,
                duration: 0.3,
                ease: "power2.out",
                onComplete: () => { autoResolutionTween.current = null; }
              });
            }
          }

          slowFrameDebtRef.current = 0;
          fastFrameStreakRef.current = 0;
        }

        if (fastFrameStreakRef.current >= frameRecoveryMax) {
          if (autoResolutionMultiplier.current > 1) {
            const nextMultiplier = Math.max(1, autoResolutionMultiplier.current - AUTO_RESOLUTION_STEP);
            if (nextMultiplier < autoResolutionMultiplier.current - 0.001) {
              autoResolutionTween.current?.kill();
              autoResolutionTween.current = gsap.to(autoResolutionMultiplier, {
                current: nextMultiplier,
                duration: 0.4,
                ease: "power2.inOut",
                onComplete: () => { autoResolutionTween.current = null; }
              });
            }
          }

          fastFrameStreakRef.current = 0;
          slowFrameDebtRef.current = 0;
        }
      }

      // Hard kill if a frame blew the budget while we're already maxed out.
      if (
        !isExpanding.current &&
        !isFading &&
        !isRecentTouch &&
        autoResolutionMultiplier.current >= MAX_AUTO_RESOLUTION - 0.001 &&
        frameTime > frameDebtThreshold * 3
      ) {
        disableBlob();
        return;
      }
    };

    // Track mouse movement to conditionally render
    const originalOnMove = onMove;
    const wrappedOnMove = (e) => {
      const DPR = DPRRef.current;
      const padding = CANVAS_PADDING;
      const pointerX = "clientX" in e ? e.clientX : e.touches?.[0]?.clientX || 0;
      const pointerY = "clientY" in e ? e.clientY : e.touches?.[0]?.clientY || 0;
      const scaledX = (pointerX + padding) * DPR;
      const scaledY = (pointerY + padding) * DPR;

      if (isBlobDisabled.current) {
        if (autoReactivateOnMoveRef.current) {
          reactivateBlob({ scaledX, scaledY });
        }
        if (isBlobDisabled.current) {
          return;
        }
      }

      lastMoveTime = performance.now();
      isMoving = true;
      isSettled = false; // Reset settlement when mouse moves
      settledFrameCount = 0;
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        isMoving = false;
      }, 100);
      
      // Kill any exit animations when mouse moves
      if (!isExpanding.current && blobOpacity.current < 1) {
        fadeInBlobs();
      }

      originalOnMove(e);
    };
    
    // Wrap onLeave to set exit flag
    const originalOnLeave = onLeave;
    const wrappedOnLeave = () => {
      isSettled = false; // Keep rendering during exit
      originalOnLeave();
    };
    
  window.removeEventListener("pointermove", onMove);
  window.removeEventListener("touchstart", onMove);
  window.removeEventListener("touchmove", onMove);
    window.removeEventListener("mouseleave", onLeave);
    document.documentElement.removeEventListener("mouseleave", onLeave);
    window.removeEventListener("touchend", onTouchEnd);
    window.removeEventListener("touchcancel", onTouchEnd);
    
    window.addEventListener("pointermove", wrappedOnMove, { passive: true });
  window.addEventListener("touchstart", wrappedOnMove, { passive: true });
    window.addEventListener("touchmove", wrappedOnMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    if (!hashOverlayActive) {
      window.addEventListener("mouseleave", wrappedOnLeave);
      document.documentElement.addEventListener("mouseleave", wrappedOnLeave);
    }

    loop(performance.now());

    // On touch-primary devices, fade out immediately at load since there's no cursor
    const isTouchPrimary = navigator.maxTouchPoints > 0 && !window.matchMedia("(hover: hover)").matches;
    if (isTouchPrimary) {
      fadeOutBlobs();
    }

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(idleTimer);
      if (touchFadeTimeoutRef.current) {
        clearTimeout(touchFadeTimeoutRef.current);
      }
      if (momentumAnimationRef.current) {
        momentumAnimationRef.current.kill();
      }
      const targets = forEachMaskTarget(targetEl => {
        targetEl.style.clipPath = "";
        targetEl.style.webkitClipPath = "";
      });
      if (targets.length) {
        clipPathCacheRef.current = "";
      }
      
      // Remove click handlers from links
      linkElements.current.forEach(link => {
        link.removeEventListener('click', handleLinkClick);
      });
      logoElements.current.forEach(logo => {
        logo.removeEventListener('click', handleLogoClick);
      });
      
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", wrappedOnMove);
      window.removeEventListener("touchstart", wrappedOnMove);
      window.removeEventListener("touchmove", wrappedOnMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      window.removeEventListener("mouseleave", wrappedOnLeave);
      window.removeEventListener("mouseenter", onEnter);
      document.documentElement.removeEventListener("mouseleave", wrappedOnLeave);
      resolutionTween.current?.kill();
      autoResolutionTween.current?.kill();
      maskSizeTweenRef.current?.kill();
      maskSizeTweenRef.current = null;
    };
      }, [
        resize,
        onMove,
        onLeave,
        onEnter,
        onTouchEnd,
        handleLinkClick,
        handleLogoClick,
        trailCount,
        sizes,
        opacities,
        threshold,
        colorNum,
        pixelSize,
        whiteCutoff,
        thresholdShift,
        fadeInBlobs,
        reactivateBlob,
        fastDuration,
        slowDuration,
        fastEase,
        slowEase,
        disableBlob,
        isMaskMode,
        clipTargetRef,
        maskActivation,
        forEachMaskTarget,
        setBlobTargetPosition,
        hashOverlayActive
      ]);

  return (
    <div
      ref={wrapRef}
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: homeZIndex,
        pointerEvents: "none",
        overflow: "hidden", // Clip extended canvas at viewport edges
        mixBlendMode: isMaskMode ? "normal" : "difference"
      }}
      aria-hidden
    >
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute"
        }}
      />
    </div>
  );
}
