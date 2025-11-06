import React, { useEffect, useRef, useCallback, useMemo } from "react";
import gsap from "gsap";

const BAYER_8 = [
  [0,32,8,40,2,34,10,42],
  [48,16,56,24,50,18,58,26],
  [12,44,4,36,14,46,6,38],
  [60,28,52,20,62,30,54,22],
  [3,35,11,43,1,33,9,41],
  [51,19,59,27,49,17,57,25],
  [15,47,7,39,13,45,5,37],
  [63,31,55,23,61,29,53,21],
];

// Pre-normalize Bayer to [0,1]
const BAYER_8_NORM = BAYER_8.map(row => row.map(v => v / 64));

// Keep padding configurable in one place so the canvas can draw past the viewport edge
const CANVAS_PADDING = 150;
const MAX_AUTO_RESOLUTION = 8;
const AUTO_RESOLUTION_STEP = 0.5;
const BLUR_MIN_SCALE = 0.35;
const BLUR_STEP_DOWN = 0.15;
const BLUR_STEP_UP = 0.1;
const BLUR_ENABLED = false; // Disable blur to reduce CPU load
const HASH_IDLE_Z_INDEX = 2; // Set z-index for hash overlay when idle
const SKIP_DITHER_WHEN_IDLE = true; // Skip dithering entirely when blob is settled and no input
const IDLE_DITHER_SKIP_THRESHOLD = 200; // ms of no movement before skipping dither
const AGGRESSIVE_GRID_REDUCTION = true; // Use 4x larger pixels when idle to reduce getImageData overhead
const SKIP_MAGNETISM_ON_HIGH_VELOCITY = true; // Skip link detection on fast movement
const HIGH_VELOCITY_THRESHOLD = 150; // pixels/frame - above this, skip magnetism checks
const REDUCE_TRAILS_ON_HIGH_VELOCITY = true; // Skip rendering trail blobs when moving fast
const FRAME_SKIP_ON_HIGH_VELOCITY = false; // Skip every other frame when very fast (aggressive)

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
  blurPx = 30,
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
  hashOverlayActive = false
}) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const drawCanRef = useRef(null);
  const blurCanRef = useRef(null);
  const drawCtxRef = useRef(null);
  const blurCtxRef = useRef(null);
  // Reduce DPR further for better performance - cap at 1.5x
  const DPRRef = useRef(Math.min(1.5, Math.max(1, window.devicePixelRatio || 1)));
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
        window.location.href = target;
      }
    } catch (err) {
      window.location.href = target;
    }

    return true;
  }, []);

  const applyCanvasBlend = useCallback(() => {
    if (!isMaskMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const shouldBlend = hashOverlayActive && !maskActiveRef.current;
    canvas.style.mixBlendMode = shouldBlend ? "difference" : "normal";
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
  const targetBlobSize = useRef(0); // Track target size for dynamic scaling
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
  const blurScaleRef = useRef(1);
  const blurScaleTween = useRef(null);
  const clipPathCacheRef = useRef("none");
  const isCursorFrozen = useRef(false);
  const latestPointerRef = useRef({ x: 0, y: 0 });
  const pendingNavigationRef = useRef(null);

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
  
  // Track last movement direction for off-screen animation
  const pendingFadeOut = useRef(false);
  
  // Track velocity for movement-based optimizations
  const isHighVelocityRef = useRef(false);

  const resize = useCallback(() => {
    // Cap DPR more aggressively for performance
    const DPR = Math.min(1.5, Math.max(1, window.devicePixelRatio || 1));
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

  // offscreen buffers - use SMALLER resolution for intermediate processing
  // Even more aggressive downsampling for better performance
  const blurScale = 0.35; // Render intermediate buffer at 35% resolution
    const drawCan = drawCanRef.current || (drawCanRef.current = document.createElement("canvas"));
    drawCan.width = Math.floor(c.width * blurScale);
    drawCan.height = Math.floor(c.height * blurScale);
    drawCtxRef.current = drawCan.getContext("2d", { willReadFrequently: true, alpha: true });

    if (BLUR_ENABLED) {
      const blurCan = blurCanRef.current || (blurCanRef.current = document.createElement("canvas"));
      blurCan.width = Math.floor(c.width * blurScale);
      blurCan.height = Math.floor(c.height * blurScale);
      blurCtxRef.current = blurCan.getContext("2d", { willReadFrequently: true, alpha: true });
    } else {
      blurCanRef.current = drawCanRef.current;
      blurCtxRef.current = drawCtxRef.current;
    }
  }, []);

  const disableBlob = useCallback(() => {
    if (isBlobDisabled.current) return;

    isBlobDisabled.current = true;
    temporarilyReenabled.current = false;
    gsap.killTweensOf(blobOpacity);
    gsap.killTweensOf(resolutionMultiplier);
    gsap.killTweensOf(autoResolutionMultiplier);
    gsap.killTweensOf(blurScaleRef);
    resolutionTween.current?.kill();
    resolutionTween.current = null;
    autoResolutionTween.current?.kill();
    autoResolutionTween.current = null;
    blurScaleTween.current?.kill();
    blurScaleTween.current = null;
    blobOpacity.current = 0;
    resolutionMultiplier.current = 1;
    autoResolutionMultiplier.current = 1;
    blurScaleRef.current = 1;
    slowFrameDebtRef.current = 0;
    fastFrameStreakRef.current = 0;
    isCursorFrozen.current = false;

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
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

  const onMove = useCallback((e) => {
    if (isBlobDisabled.current) return;

    const DPR = DPRRef.current;
    const padding = CANVAS_PADDING; // Must match padding in resize()
    let x = "clientX" in e ? e.clientX : e.touches?.[0]?.clientX || 0;
    let y = "clientY" in e ? e.clientY : e.touches?.[0]?.clientY || 0;

    // Keep track of the latest pointer position so we can snap to it after transitions
    const pointerScaledX = (x + padding) * DPR;
    const pointerScaledY = (y + padding) * DPR;
    latestPointerRef.current.x = pointerScaledX;
    latestPointerRef.current.y = pointerScaledY;

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

    if (magnetStatus.active && activeTarget) {
      const magnetRadius = activeTarget.radius ?? magnetStrength;
      const distanceRatio = Math.min(1, magnetRadius > 0 ? activeTarget.dist / magnetRadius : 1);

      let pullStrength = 0;
      if (activeTargetType === "logo") {
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
      quickX.current[i](scaledX);
      quickY.current[i](scaledY);
    }
  }, [sizes, fadeInBlobs]);

  const onLeave = useCallback(() => {
    if (isExpanding.current) {
      pendingFadeOut.current = true;
      return;
    }

    fadeOutBlobs();
  }, [fadeOutBlobs]);

  const onEnter = useCallback(() => {
    pendingFadeOut.current = false;

    // Kill any ongoing exit animations
    points.current.forEach((p) => {
      gsap.killTweensOf(p);
    });

    if (!isExpanding.current) {
      fadeInBlobs();
    }
  }, [fadeInBlobs]);

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
      blurScaleTween.current?.kill();
      blurScaleTween.current = null;
      gsap.killTweensOf(blurScaleRef);
      resolutionMultiplier.current = 1;
      autoResolutionMultiplier.current = 1;
      blurScaleRef.current = 1;
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
    
    // Get viewport dimensions and calculate size needed to cover entire screen
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const viewportDiagonal = Math.sqrt(viewportWidth ** 2 + viewportHeight ** 2);
    
    // The blob has a radial gradient where the center is solid and edges fade out
    // We need the SOLID CENTER (not blurred edges) to cover the viewport diagonal
    // The solid part is roughly 40-50% of the blob radius due to gradient + blur
    // So we need to make the blob ~2.5x larger than the viewport diagonal
    // Reference the smallest blob cursor size instead of the largest
    const smallestBlob = sizes.length > 0 ? Math.min(...sizes) : 200;
    const baseSize = smallestBlob;
    const baseRadius = baseSize * 0.5; // Radius is half the size
    
  // Account for blur radius only if blur is enabled
  const blurRadius = BLUR_ENABLED ? blurPx * 1.5 : 0;
    
    // Calculate how much of the blob is actually solid (before gradient falloff)
    // The radial gradient goes from solid at center to transparent at edge
    // We need the solid portion to cover the viewport diagonal
    const solidCoreFactor = 0.3; // Only ~30% of radius is fully solid before fade
    
    // Target: solid core radius = viewportDiagonal
    // If solidCore = blobRadius * solidCoreFactor
    // Then blobRadius = viewportDiagonal / solidCoreFactor
    const targetRadius = viewportDiagonal / solidCoreFactor;
    const targetSize = targetRadius * 2; // Convert radius to diameter
    
    // Add extra for blur that happens after
    const targetSizeWithBlur = targetSize + (blurRadius * 4);
    
    const finalMultiplier = targetSizeWithBlur / baseSize;
    
    // Pause the dither background rendering during expansion for better performance
    if (onExpansionStart) {
      onExpansionStart();
    }
    
    // Phase 1: Expand blob to fill screen (1.5 second - longer for smoother animation)
    gsap.to(expansionMultiplier, {
      current: finalMultiplier,
      duration: 2.0,
      ease: "power1.inOut",
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
            // Shrink back to original size (while still hidden)
            gsap.to(expansionMultiplier, {
              current: 1,
              duration: 0.4,
              ease: "power2.out",
              onUpdate: () => {
                currentSizeMultiplier.current = expansionMultiplier.current;
              },
              onComplete: () => {
                rgb.current = { ...hashColorRef.current };

                // Ease resolution back to normal while the blob is hidden
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

                // Phase 4: Resume cursor tracking and ensure rendering before fade-in
                isExpanding.current = false; // Allow cursor tracking to resume
                
                // Check if cursor left during expansion
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
                
                // Wait a brief moment for cursor position to update, then fade blobs back in
                setTimeout(() => {
                  if (temporarilyReenabled.current) {
                    disableBlob();
                    temporarilyReenabled.current = false;
                    executePendingNavigation(targetUrl);
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
              }
            });
          }
        });
      }
    });
  }, [sizes, onExpansionComplete, onExpansionStart, blurPx, zIndex, fadeOutBlobs, disableBlob, setMaskActive, forEachMaskTarget, normalizeHashValue, setActiveMaskGroup, resetBlobZIndex]);

  // Handle clicking on the logo to return to home (remove hash) with a mirrored transition
  const handleLogoClick = useCallback((e) => {
    if (isExpanding.current) return;

    // Only intercept when on a hash page
    const currentHash = window.location.hash;
    if (!currentHash || currentHash.length <= 1) return;

  e.preventDefault();

  pendingNavigationRef.current = null;
  const baseUrl = window.location.origin + window.location.pathname;

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
      blurScaleTween.current?.kill();
      blurScaleTween.current = null;
      gsap.killTweensOf(blurScaleRef);
      resolutionMultiplier.current = 1;
      autoResolutionMultiplier.current = 1;
      blurScaleRef.current = 1;
      slowFrameDebtRef.current = 0;
      fastFrameStreakRef.current = 0;
    } else {
      temporarilyReenabled.current = false;
    }

    isExpanding.current = true;

    if (onReturnStart) {
      onReturnStart();
    }

    if (activateMaskForTransition) {
      setActiveMaskGroup("home");
      setMaskActive(true);
      const targets = forEachMaskTarget(targetEl => {
        // Start mask visible so it can be "cleared" as we go back
        targetEl.style.opacity = "1";
        targetEl.style.visibility = "visible";
        targetEl.style.clipPath = "circle(0px at 50% 50%)";
        targetEl.style.webkitClipPath = "circle(0px at 50% 50%)";
      });
      if (targets.length) {
        clipPathCacheRef.current = "circle(0px at 50% 50%)";
      }
    }

  // Ensure the blob uses the hash color while the exit mask reveals home content
  rgb.current = { ...hashColorRef.current };

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

    // Raise blob to transition layer beneath mask
    if (wrapRef.current) {
      wrapRef.current.style.zIndex = String(maskZIndex);
    }

    // Ease hash layers out so the masked home copy can crossfade underneath
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

    // Expansion sizing same as link flow
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const viewportDiagonal = Math.sqrt(viewportWidth ** 2 + viewportHeight ** 2);
    const smallestBlob = sizes.length > 0 ? Math.min(...sizes) : 200;
    const baseSize = smallestBlob;
    const baseRadius = baseSize * 0.5;
    const blurRadius = BLUR_ENABLED ? blurPx * 1.5 : 0;
    const solidCoreFactor = 0.3;
    const targetRadius = viewportDiagonal / solidCoreFactor;
    const targetSize = targetRadius * 2;
    const targetSizeWithBlur = targetSize + (blurRadius * 4);
    const finalMultiplier = targetSizeWithBlur / baseSize;

    gsap.to(expansionMultiplier, {
      current: finalMultiplier,
      duration: 2.0,
      ease: "power1.inOut",
      onUpdate: () => {
        currentSizeMultiplier.current = expansionMultiplier.current;
      },
      onComplete: () => {
        const fadeTargets = [];
        if (hashContentNode) {
          hashContentNode.style.visibility = 'visible';
          fadeTargets.push(hashContentNode);
        }
        if (hashBackgroundNode) {
          hashBackgroundNode.style.visibility = 'visible';
          fadeTargets.push(hashBackgroundNode);
        }

        const proceedAfterContentHidden = () => {
          document.body.style.backgroundColor = '';

          if (activateMaskForTransition) {
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

          // Hide blobs to swap color/quality and shrink back
          gsap.to(blobOpacity, {
            current: 0,
            duration: 0.25,
            ease: "power2.out",
            onComplete: () => {
              // Shrink back to original size while hidden
              gsap.to(expansionMultiplier, {
                current: 1,
                duration: 0.4,
                ease: "power2.out",
                onUpdate: () => {
                  currentSizeMultiplier.current = expansionMultiplier.current;
                },
                onComplete: () => {
                  rgb.current = { ...baseColorRef.current };

                  // Restore resolution/blur quality
                  resolutionTween.current?.kill();
                  resolutionTween.current = gsap.to(resolutionMultiplier, {
                    current: 1,
                    duration: 0.6,
                    ease: "power2.inOut"
                  });

                  isExpanding.current = false;
                  isCursorFrozen.current = false;

                  // Prepare cursor tracking to resume smoothly
                  const { x: resumeX, y: resumeY } = latestPointerRef.current;
                  if (Number.isFinite(resumeX) && Number.isFinite(resumeY)) {
                    for (let i = 0; i < trailCount; i++) {
                      if (quickX.current[i]) quickX.current[i](resumeX);
                      if (quickY.current[i]) quickY.current[i](resumeY);
                    }
                  }

                  // Fade blobs back in
                  setTimeout(() => {
                    if (temporarilyReenabled.current) {
                      disableBlob();
                      temporarilyReenabled.current = false;
                    }

                    // Restore blob layer z-index before fading back in so the canvas
                    // returns to its normal stacking order while it fades into view.
                    resetBlobZIndex();

                    gsap.to(blobOpacity, {
                      current: 1,
                      duration: 0.8,
                      ease: "power2.inOut",
                      onComplete: () => {
                        // Restore home logos for the base state
                        document.querySelectorAll('#site-logo, #site-logo-solid').forEach(logo => {
                          logo.style.display = '';
                        });
                        document.querySelectorAll('.side-links:not([data-floating-links])').forEach(nav => {
                          if (nav.closest('.home-mask-content')) {
                            return;
                          }
                          nav.style.display = '';
                        });
                        // Reset blob layer z-index
                        resetBlobZIndex();

                        // Notify parent that we're done returning (so it can re-enable dither, etc.)
                        if (onReturnComplete) onReturnComplete();

                        // Navigate back to base URL (remove hash) after fade-in
                        try {
                          window.history.replaceState({}, '', baseUrl);
                        } catch (err) {
                          window.location.href = baseUrl;
                        }

                        resetBlobZIndex();

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
                      }
                    });
                  }, 50);
                }
              });
            }
          });
        };

        const fadeDuration = 0.35;
        if (fadeTargets.length === 0) {
          proceedAfterContentHidden();
        } else {
          let remaining = fadeTargets.length;
          fadeTargets.forEach(node => {
            gsap.to(node, {
              opacity: 0,
              duration: fadeDuration,
              ease: "power2.out",
              onComplete: () => {
                node.style.visibility = 'hidden';
                if (--remaining <= 0) {
                  proceedAfterContentHidden();
                }
              }
            });
          });
        }
      }
    });
  }, [sizes, blurPx, zIndex, disableBlob, isMaskMode, maskActivation, onReturnStart, onReturnComplete, setMaskActive, forEachMaskTarget, setActiveMaskGroup, resetBlobZIndex]);

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
    window.addEventListener("mouseleave", onLeave);
    window.addEventListener("mouseenter", onEnter);
    document.documentElement.addEventListener("mouseleave", onLeave);

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
    const outCtx = c.getContext("2d", { alpha: true, desynchronized: true });
    outCtx.imageSmoothingEnabled = false;

    const drawCtx = () => drawCtxRef.current;
    const blurCtx = () => blurCtxRef.current;
    const drawCan = () => drawCanRef.current;
    const blurCan = () => blurCanRef.current;

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
      const isIdle = timeSinceMove > IDLE_DITHER_SKIP_THRESHOLD && !isMoving && isSettled && !isExpanding.current && !isFading;
      const shouldSkipIdle = SKIP_DITHER_WHEN_IDLE && !maskActive;

      if (isIdle && shouldSkipIdle) {
        return; // Skip rendering entirely when blob is idle to save CPU
      }
      
      if (!maskActive && timeSinceMove > 100 && !isMoving && isSettled && !isExpanding.current && !isFading) {
        return; // Skip rendering when everything is settled and not exiting or expanding or fading
      }
      
      // Measure render time for adaptive performance
      const renderStartTime = performance.now();

      const DPR = DPRRef.current;
      const baseGrid = Math.max(1, Math.round(pixelSize * DPR));
      // When idle, use 4x larger pixels to massively reduce getImageData overhead
      // Also increase grid on high velocity movement for performance
      const idleGridMultiplier = (isIdle && AGGRESSIVE_GRID_REDUCTION) ? 4 : 1;
      const velocityGridMultiplier = (isHighVelocityRef.current && REDUCE_TRAILS_ON_HIGH_VELOCITY) ? 2 : 1;
      const grid = baseGrid * idleGridMultiplier * velocityGridMultiplier;
      const q = Math.max(2, colorNum - 1);
      const stepSize = 1 / q;

  const dctx = drawCtx();
  const dcan = drawCan();

  // Calculate scale factor (since draw canvas is smaller)
  const drawScale = dcan.width / c.width;

  dctx.clearRect(0, 0, dcan.width, dcan.height);

  const blurRadiusScale = BLUR_ENABLED ? 0.75 + 0.25 * blurScaleRef.current : 1;
      let activeTrailCount = trailCount;
      // Reduce trail count on high velocity to save gradient rendering overhead
      if (isHighVelocityRef.current && REDUCE_TRAILS_ON_HIGH_VELOCITY) {
        activeTrailCount = Math.max(1, Math.ceil(trailCount * 0.5)); // Use only ~50% of trails
      }
      if (autoResolutionMultiplier.current >= 4 && trailCount > 3) {
        activeTrailCount = Math.min(activeTrailCount, trailCount - 1);
      }
      if (autoResolutionMultiplier.current >= 6 && trailCount > 2) {
        activeTrailCount = Math.min(activeTrailCount, trailCount - 2);
      }
      const sizesForBounds = sizes.slice(0, activeTrailCount);
      const maxSizeForBounds = sizesForBounds.length ? Math.max(...sizesForBounds) : Math.max(...sizes);
      const maxR = maxSizeForBounds * DPR * currentSizeMultiplier.current * blurRadiusScale;

      // Performance optimization: when expanding to huge size, reduce quality temporarily
      // But keep it smoother during expansion animation by using less aggressive downsampling
      const rawMultiplier = currentSizeMultiplier.current;
      const isHugeExpansion = rawMultiplier > 10;
      const combinedResolutionMultiplier = Math.max(1, resolutionMultiplier.current, autoResolutionMultiplier.current);
      let renderGrid = grid * combinedResolutionMultiplier;

      if (isExpanding.current) {
        // Ensure we never go above our targeted degradation bands during the swell
        if (rawMultiplier < 2.5) {
          renderGrid = Math.max(renderGrid, grid * 4);
        } else if (rawMultiplier < 10) {
          renderGrid = Math.max(renderGrid, grid * 6);
        } else {
          renderGrid = Math.max(renderGrid, grid * 8);
        }
      } else if (isHugeExpansion) {
        renderGrid = Math.max(renderGrid, grid * 2);
      }
      
      // Optimize: batch drawing operations
      dctx.globalCompositeOperation = 'source-over';
      
      // When idle, only draw the lead blob to save gradient creation overhead
      const trailsToRender = (isIdle && AGGRESSIVE_GRID_REDUCTION) ? 1 : activeTrailCount;
      
      // Draw blobs on the smaller canvas
      for (let i = 0; i < trailCount; i++) {
        if (i >= trailsToRender) break;
        const p = points.current[i];
        if (!p || p.x < -9000) continue;
  const baseSize = sizes[i] || sizes[sizes.length - 1];
  const R = baseSize * DPR * drawScale * 0.5 * currentSizeMultiplier.current * blurRadiusScale;
  const scaledX = p.x * drawScale;
  const scaledY = p.y * drawScale;
        
        // Apply both the individual opacity and the transition opacity
        // On high velocity, reduce opacity of trailing blobs to blur the effect naturally
        const velocityOpacityMultiplier = isHighVelocityRef.current && i > 0 ? 0.5 : 1;
        dctx.globalAlpha = (opacities[i] ?? 1) * blobOpacity.current * velocityOpacityMultiplier;
        
        // Simplified gradient for better performance
        const grad = dctx.createRadialGradient(scaledX, scaledY, 0, scaledX, scaledY, R);
        grad.addColorStop(0, "rgba(0,0,0,1)");
        grad.addColorStop(1, "rgba(0,0,0,0)");
        dctx.fillStyle = grad;
        dctx.beginPath();
        dctx.arc(scaledX, scaledY, R, 0, Math.PI * 2);
        dctx.fill();
      }
      
      dctx.globalAlpha = 1;

      const dynamicBlurPx = BLUR_ENABLED ? blurPx * blurScaleRef.current : 0;
      const shouldBlur = BLUR_ENABLED && !isHugeExpansion && dynamicBlurPx >= 0.75;

      let sampleCtx = dctx;
      let sampleCan = dcan;
      let sampleScale = drawScale;

      if (shouldBlur) {
        const bctx = blurCtx();
        const bcan = blurCan();
        bctx.clearRect(0, 0, bcan.width, bcan.height);
        bctx.filter = `blur(${dynamicBlurPx * DPR * drawScale}px)`;
        bctx.drawImage(dcan, 0, 0);
        bctx.filter = "none";
        sampleCtx = bctx;
        sampleCan = bcan;
        sampleScale = bcan.width / c.width;
      }

      // 3) Calculate bounds for sampling (on full-res canvas)
  const relevantPoints = points.current.slice(0, activeTrailCount);
  const pointsForBounds = relevantPoints.length ? relevantPoints : points.current;
  
  // Optimize: avoid spread operator + map, use imperative loop instead
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < pointsForBounds.length; i++) {
    const p = pointsForBounds[i];
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  
  minX = Math.max(0, minX - maxR);
  maxX = Math.min(c.width, maxX + maxR);
  minY = Math.max(0, minY - maxR);
  maxY = Math.min(c.height, maxY + maxR);
      
      const startX = Math.floor(minX / renderGrid) * renderGrid;
      const endX = Math.ceil(maxX / renderGrid) * renderGrid;
      const startY = Math.floor(minY / renderGrid) * renderGrid;
      const endY = Math.ceil(maxY / renderGrid) * renderGrid;

      // Only get image data for the region we need (scaled to blur canvas size)
  const sampleX = Math.floor(startX * sampleScale);
  const sampleY = Math.floor(startY * sampleScale);
  const sampleW = Math.min(sampleCan.width - sampleX, Math.ceil((endX - startX) * sampleScale));
  const sampleH = Math.min(sampleCan.height - sampleY, Math.ceil((endY - startY) * sampleScale));
      
      if (sampleW <= 0 || sampleH <= 0) return;
      
  const img = sampleCtx.getImageData(sampleX, sampleY, sampleW, sampleH);
      const data = img.data;
      const { r, g, b } = rgb.current;

  const path = new Path2D();
  const cssScale = 1 / DPR;
  const primaryMaskTarget = getPrimaryMaskTarget();
  const shouldUpdateCircleClip = maskActive && primaryMaskTarget;
  const canvasRect = shouldUpdateCircleClip ? c.getBoundingClientRect() : null;
      
      // Process only the bounded region
      for (let y = startY; y < endY; y += renderGrid) {
        const gy = (Math.floor(y / renderGrid) & 7);
        const bayerRow = BAYER_8_NORM[gy];
        
        for (let x = startX; x < endX; x += renderGrid) {
          const gx = (Math.floor(x / renderGrid) & 7);
          
          // Map to the sampled region coordinates
          const localX = Math.floor((x - startX) * sampleScale);
          const localY = Math.floor((y - startY) * sampleScale);
          const i = (localY * sampleW + localX) * 4;

          const a = data[i + 3] / 255;
          const stepped = a >= threshold ? (a - threshold) / (1 - threshold) : 0;

          const bayer = bayerRow[gx];
          const localCut = Math.min(1, Math.max(0, whiteCutoff - (bayer + thresholdShift) * stepSize));
          if (stepped >= localCut) {
            path.rect(x, y, renderGrid, renderGrid);
          }
        }
      }
      
      // Draw all rects in one single fill operation
      outCtx.clearRect(startX, startY, endX - startX, endY - startY);
      outCtx.globalAlpha = 1;
      const shouldUseMaskColor = maskActive && activeMaskGroupRef.current !== "home";
      outCtx.fillStyle = shouldUseMaskColor ? maskColorRef.current : `rgb(${r},${g},${b})`;
      outCtx.fill(path);

      if (shouldUpdateCircleClip) {
        const lead = points.current[0];
        const sizeReference = (() => {
          if (!Array.isArray(sizes) || sizes.length === 0) return 0;
          if (sizes.length === 1) return sizes[0];
          const sorted = [...sizes].sort((a, b) => a - b);
          return sorted[1] ?? sorted[0];
        })();
        const hasPosition = lead && lead.x > -9000 && lead.y > -9000;
        const radius = hasPosition ? Math.max(0, (sizeReference * currentSizeMultiplier.current) / 2) : 0;

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
          const blurAtFloor = !BLUR_ENABLED || blurScaleRef.current <= BLUR_MIN_SCALE + 0.01;

          if (resolutionMaxed && blurAtFloor) {
            disableBlob();
            return;
          }

          if (!resolutionMaxed) {
            const nextMultiplier = Math.min(MAX_AUTO_RESOLUTION, autoResolutionMultiplier.current + AUTO_RESOLUTION_STEP);
            if (nextMultiplier > autoResolutionMultiplier.current + 0.001) {
              autoResolutionTween.current?.kill();
              autoResolutionTween.current = null;
              autoResolutionTween.current = gsap.to(autoResolutionMultiplier, {
                current: nextMultiplier,
                duration: 0.3,
                ease: "power2.out",
                onComplete: () => {
                  autoResolutionTween.current = null;
                }
              });
            }
          }

          if (BLUR_ENABLED && !blurAtFloor) {
            blurScaleTween.current?.kill();
            blurScaleTween.current = gsap.to(blurScaleRef, {
              current: Math.max(BLUR_MIN_SCALE, blurScaleRef.current - BLUR_STEP_DOWN),
              duration: 0.35,
              ease: "power2.out",
              onComplete: () => {
                blurScaleTween.current = null;
              }
            });
          }

          slowFrameDebtRef.current = 0;
          fastFrameStreakRef.current = 0;
        }

        if (fastFrameStreakRef.current >= frameRecoveryMax) {
          if (autoResolutionMultiplier.current > 1) {
            const nextMultiplier = Math.max(1, autoResolutionMultiplier.current - AUTO_RESOLUTION_STEP);
            if (nextMultiplier < autoResolutionMultiplier.current - 0.001) {
              autoResolutionTween.current?.kill();
              autoResolutionTween.current = null;
              autoResolutionTween.current = gsap.to(autoResolutionMultiplier, {
                current: nextMultiplier,
                duration: 0.4,
                ease: "power2.inOut",
                onComplete: () => {
                  autoResolutionTween.current = null;
                }
              });
            }
          }

          if (BLUR_ENABLED && blurScaleRef.current < 1 - 0.01) {
            blurScaleTween.current?.kill();
            blurScaleTween.current = gsap.to(blurScaleRef, {
              current: Math.min(1, blurScaleRef.current + BLUR_STEP_UP),
              duration: 0.45,
              ease: "power2.inOut",
              onComplete: () => {
                blurScaleTween.current = null;
              }
            });
          }

          fastFrameStreakRef.current = 0;
          slowFrameDebtRef.current = 0;
        }
      }

      // Disable the blob if render time becomes extreme when already maxed out and not expanding
      if (
        !isExpanding.current &&
        autoResolutionMultiplier.current >= MAX_AUTO_RESOLUTION - 0.001 &&
        (!BLUR_ENABLED || blurScaleRef.current <= BLUR_MIN_SCALE + 0.01) &&
        frameTime > frameDebtThreshold * 3
      ) {
        disableBlob();
        return;
      }
    };

    // Track mouse movement to conditionally render
    const originalOnMove = onMove;
    const wrappedOnMove = (e) => {
      if (isBlobDisabled.current) {
        return;
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
    
    window.addEventListener("pointermove", wrappedOnMove, { passive: true });
  window.addEventListener("touchstart", wrappedOnMove, { passive: true });
    window.addEventListener("touchmove", wrappedOnMove, { passive: true });
    window.addEventListener("mouseleave", wrappedOnLeave);
    document.documentElement.addEventListener("mouseleave", wrappedOnLeave);

    loop(performance.now());
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(idleTimer);
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
      window.removeEventListener("mouseleave", wrappedOnLeave);
      window.removeEventListener("mouseenter", onEnter);
      document.documentElement.removeEventListener("mouseleave", wrappedOnLeave);
      resolutionTween.current?.kill();
      autoResolutionTween.current?.kill();
      blurScaleTween.current?.kill();
    };
      }, [
    resize, onMove, onLeave, handleLinkClick, trailCount, sizes, opacities,
      blurPx, threshold, colorNum, pixelSize, whiteCutoff, thresholdShift, fadeInBlobs,
    fastDuration, slowDuration, fastEase, slowEase, disableBlob, isMaskMode, clipTargetRef, maskActivation, forEachMaskTarget
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
        overflow: "hidden" // Clip extended canvas at viewport edges
      }}
      aria-hidden
    >
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          mixBlendMode: isMaskMode ? "normal" : "multiply"
        }}
      />
    </div>
  );
}
