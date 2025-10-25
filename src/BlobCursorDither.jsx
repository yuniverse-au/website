import React, { useEffect, useRef, useCallback } from "react";
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
const SKIP_DITHER_WHEN_IDLE = true; // Skip dithering entirely when blob is settled and no input
const IDLE_DITHER_SKIP_THRESHOLD = 200; // ms of no movement before skipping dither
const AGGRESSIVE_GRID_REDUCTION = true; // Use 4x larger pixels when idle to reduce getImageData overhead
const SKIP_MAGNETISM_ON_HIGH_VELOCITY = true; // Skip link detection on fast movement
const HIGH_VELOCITY_THRESHOLD = 150; // pixels/frame - above this, skip magnetism checks
const REDUCE_TRAILS_ON_HIGH_VELOCITY = true; // Skip rendering trail blobs when moving fast
const FRAME_SKIP_ON_HIGH_VELOCITY = false; // Skip every other frame when very fast (aggressive)

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
  zIndex = 1,
  colorNum = 4,
  pixelSize = 2,
  whiteCutoff = 0.7,
  thresholdShift = -0.4,
  onExpansionComplete = null,
  onExpansionStart = null,
  mode = "ink",
  maskColor = "#000000",
  clipTargetRef = null,
  maskActivation = "always"
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
  const maskVisibleTargetRef = useRef(clipTargetRef?.current || null);

  useEffect(() => {
    maskColorRef.current = maskColor;
  }, [maskColor]);

  // points animated by GSAP
  const points = useRef(
    Array.from({ length: trailCount }, () => ({ x: -9999, y: -9999 }))
  );
  
  // Track previous positions to detect when animation has settled
  const prevPoints = useRef(
    Array.from({ length: trailCount }, () => ({ x: -9999, y: -9999 }))
  );

  const rgb = useRef({
    r: parseInt(color.slice(1, 3), 16) || 0,
    g: parseInt(color.slice(3, 5), 16) || 0,
    b: parseInt(color.slice(5, 7), 16) || 0,
  });

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

  useEffect(() => {
    maskVisibleTargetRef.current = clipTargetRef?.current || null;
    if (!isMaskMode || maskActivation !== "transition") {
      maskActiveRef.current = isMaskMode && maskActivation === "always";
    } else {
      maskActiveRef.current = false;
    }

    const targetEl = clipTargetRef?.current;
    if (!targetEl) return;

    if (!isMaskMode || !maskActiveRef.current) {
      targetEl.style.clipPath = "none";
      targetEl.style.webkitClipPath = "none";
      targetEl.style.opacity = "0";
      clipPathCacheRef.current = "none";
    }
  }, [isMaskMode, maskActivation, clipTargetRef]);

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

    const wasBlobDisabled = isBlobDisabled.current;
    const activateMaskForTransition = isMaskMode && maskActivation === "transition";

  // e.preventDefault();

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
      maskActiveRef.current = true;
      const targetEl = clipTargetRef?.current;
      if (targetEl) {
        targetEl.style.opacity = "1";
        targetEl.style.clipPath = "circle(0px at 50% 50%)";
        targetEl.style.webkitClipPath = "circle(0px at 50% 50%)";
        clipPathCacheRef.current = "circle(0px at 50% 50%)";
      }
    }
    const targetUrl = e.currentTarget.href;
    
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
    
    // Remove any previous floating overlays
    document.querySelectorAll('[data-floating-link="true"],[data-floating-links="true"]').forEach(node => {
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
      navClone.style.color = computedNav.color;
      navClone.style.zIndex = nav.classList.contains('side-links--diff') ? '12' : '13';

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
        span.style.color = anchorStyles.color;
        span.style.textDecoration = 'none';

  // Only the clicked link stays visible; others reserve space but stay hidden
  const isTarget = anchor.href === targetUrl;
  span.style.opacity = isTarget ? '1' : '0';
  span.style.visibility = isTarget ? 'visible' : 'hidden';

        anchor.replaceWith(span);
      });

      document.body.appendChild(navClone);
    });
    
    // Increase blob z-index to cover other links (but not the clicked one)
    if (wrapRef.current) {
      wrapRef.current.style.zIndex = '10';
    }
    
    // Initialize color transition to current color (black)
    colorTransition.current = { r: 0, g: 0, b: 0 };
    
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
        if (activateMaskForTransition && clipTargetRef?.current) {
          maskActiveRef.current = false;
          clipTargetRef.current.style.clipPath = "none";
          clipTargetRef.current.style.webkitClipPath = "none";
          clipTargetRef.current.style.opacity = "1";
          clipPathCacheRef.current = "none";
        }
        // Phase 2: Swap background to black and disable dither
        document.body.style.backgroundColor = '#000000';
        if (onExpansionComplete) {
          onExpansionComplete();
        }
        
        // Hide original side links now that the blob has fully expanded
        // but keep the floating replicas visible
        document.querySelectorAll('.side-links:not([data-floating-links])').forEach(nav => {
          nav.style.display = 'none';
        });
        
        // Phase 3: Hide blobs and shrink back to original size
        gsap.to(blobOpacity, {
          current: 0,
          duration: 0.3,
          ease: "power2.out",
          onComplete: () => {
            // While hidden, change color to #cbcbcb
            rgb.current = { r: 203, g: 203, b: 203 };
            
            // Shrink back to original size (while still hidden)
            gsap.to(expansionMultiplier, {
              current: 1,
              duration: 0.4,
              ease: "power2.out",
              onUpdate: () => {
                currentSizeMultiplier.current = expansionMultiplier.current;
              },
              onComplete: () => {
                // Ease resolution back to normal while the blob is hidden
                resolutionTween.current?.kill();
                resolutionTween.current = gsap.to(resolutionMultiplier, {
                  current: 1,
                  duration: 0.6,
                  ease: "power2.inOut"
                });

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
                    if (targetUrl.includes('#')) {
                      window.location.hash = targetUrl.split('#')[1];
                    } else {
                      window.location.href = targetUrl;
                    }
                  }, 1000);
                  return;
                }
                
                // Wait a brief moment for cursor position to update, then fade blobs back in
                setTimeout(() => {
                  if (temporarilyReenabled.current) {
                    disableBlob();
                    temporarilyReenabled.current = false;
                    if (targetUrl.includes('#')) {
                      window.location.hash = targetUrl.split('#')[1];
                    } else {
                      window.location.href = targetUrl;
                    }
                    requestAnimationFrame(() => {
                      if (wrapRef.current) {
                        wrapRef.current.style.zIndex = String(zIndex);
                      }
                      document.querySelectorAll('[data-floating-link="true"]').forEach(node => node.remove());
                    });
                    return;
                  }

                  gsap.to(blobOpacity, {
                    current: 1,
                    duration: 0.8,
                    ease: "power2.inOut",
                    onComplete: () => {
                      // Navigate to the target URL
                      if (targetUrl.includes('#')) {
                        window.location.hash = targetUrl.split('#')[1];
                      } else {
                        window.location.href = targetUrl;
                      }
                      // Clean up floating link overlays if navigation stays on the same page
                      requestAnimationFrame(() => {
                        if (wrapRef.current) {
                          wrapRef.current.style.zIndex = String(zIndex);
                        }
                        document.querySelectorAll('[data-floating-link="true"]').forEach(node => node.remove());
                      });
                    }
                  });
                }, 50); // Small delay to let cursor tracking resume
              }
            });
          }
        });
      }
    });
  }, [sizes, onExpansionComplete, blurPx, zIndex, fadeOutBlobs, disableBlob]);

  useEffect(() => {
    resize();
    
    // Cache link element references and attach click handlers
    const updateInteractiveElements = () => {
      // Remove existing handlers to avoid duplicates when refreshing references
      linkElements.current.forEach(link => {
        link.removeEventListener('click', handleLinkClick);
      });

      linkElements.current = Array.from(document.querySelectorAll('.side-links__a'));
      logoElements.current = Array.from(document.querySelectorAll('#site-logo, #site-logo-solid'));

      // Attach click handlers to all links
      linkElements.current.forEach(link => {
        link.addEventListener('click', handleLinkClick);
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
  const shouldUpdateCircleClip = maskActive && clipTargetRef?.current;
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
      if (maskActive) {
        outCtx.fillStyle = maskColorRef.current;
      } else {
        outCtx.fillStyle = `rgb(${r},${g},${b})`;
      }
      outCtx.fill(path);

      if (shouldUpdateCircleClip) {
        const targetEl = clipTargetRef.current;
        const lead = points.current[0];
        const sizeReference = (() => {
          if (!Array.isArray(sizes) || sizes.length === 0) return 0;
          if (sizes.length === 1) return sizes[0];
          const sorted = [...sizes].sort((a, b) => a - b);
          return sorted[1] ?? sorted[0];
        })();
        const hasPosition = lead && lead.x > -9000 && lead.y > -9000;
        const radius = hasPosition ? Math.max(0, (sizeReference * currentSizeMultiplier.current) / 2) : 0;

        if (targetEl && radius > 0 && canvasRect) {
          const centerX = lead.x * cssScale + canvasRect.left;
          const centerY = lead.y * cssScale + canvasRect.top;
          const formatPx = (value) => `${Math.round(value * 100) / 100}px`;
          const clipValue = `circle(${formatPx(radius)} at ${formatPx(centerX)} ${formatPx(centerY)})`;

          if (clipPathCacheRef.current !== clipValue) {
            clipPathCacheRef.current = clipValue;
            targetEl.style.clipPath = clipValue;
            targetEl.style.webkitClipPath = clipValue;
          }
        } else if (clipPathCacheRef.current !== "none" && clipTargetRef?.current) {
          clipPathCacheRef.current = "none";
          clipTargetRef.current.style.clipPath = "none";
          clipTargetRef.current.style.webkitClipPath = "none";
        }
      } else if (clipPathCacheRef.current !== "none" && clipTargetRef?.current) {
        clipPathCacheRef.current = "none";
        clipTargetRef.current.style.clipPath = "none";
        clipTargetRef.current.style.webkitClipPath = "none";
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
      if (clipTargetRef?.current) {
        clipTargetRef.current.style.clipPath = "";
        clipTargetRef.current.style.webkitClipPath = "";
        clipPathCacheRef.current = "";
      }
      
      // Remove click handlers from links
      linkElements.current.forEach(link => {
        link.removeEventListener('click', handleLinkClick);
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
    fastDuration, slowDuration, fastEase, slowEase, disableBlob, isMaskMode, clipTargetRef, maskActivation
  ]);

  return (
    <div
      ref={wrapRef}
      style={{ 
        position: "fixed", 
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex, 
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
