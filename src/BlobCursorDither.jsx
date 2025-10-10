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

export default function BlobCursorDither({
  trailCount = 4,
  sizes = [200, 125, 75, 50],
  opacities = [0.6, 0.6, 0.6, 0.6],
  fastDuration = 0.1,
  slowDuration = 0.5,
  fastEase = "power3.out",
  slowEase = "power1.out",
  blurPx = 30,
  threshold = 0.35,
  color = "#000000",
  zIndex = 1,
  colorNum = 4,
  pixelSize = 2,
  whiteCutoff = 0.7,
  thresholdShift = -0.4
}) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const drawCanRef = useRef(null);
  const blurCanRef = useRef(null);
  const drawCtxRef = useRef(null);
  const blurCtxRef = useRef(null);
  // Reduce DPR further for better performance - cap at 1.5x
  const DPRRef = useRef(Math.min(1.5, Math.max(1, window.devicePixelRatio || 1)));

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

  // Quick tweens to avoid re-creating on every move
  const quickX = useRef([]);
  const quickY = useRef([]);

  const resize = useCallback(() => {
    // Cap DPR more aggressively for performance
    const DPR = Math.min(1.5, Math.max(1, window.devicePixelRatio || 1));
    DPRRef.current = DPR;

    const c = canvasRef.current;
    if (!c) return;
    c.width = Math.floor(window.innerWidth * DPR);
    c.height = Math.floor(window.innerHeight * DPR);
    c.style.width = "100vw";
    c.style.height = "100vh";

    // offscreen buffers - use SMALLER resolution for blur processing
    // Even more aggressive downsampling for better performance
    const blurScale = 0.35; // Process blur at 35% resolution (was 50%)
    const drawCan = drawCanRef.current || (drawCanRef.current = document.createElement("canvas"));
    const blurCan = blurCanRef.current || (blurCanRef.current = document.createElement("canvas"));
    drawCan.width = Math.floor(c.width * blurScale);
    drawCan.height = Math.floor(c.height * blurScale);
    blurCan.width = Math.floor(c.width * blurScale);
    blurCan.height = Math.floor(c.height * blurScale);

    drawCtxRef.current = drawCan.getContext("2d", { willReadFrequently: true, alpha: true });
    blurCtxRef.current = blurCan.getContext("2d", { willReadFrequently: true, alpha: true });
  }, []);

  const onMove = useCallback((e) => {
    const DPR = DPRRef.current;
    const x = "clientX" in e ? e.clientX : e.touches?.[0]?.clientX || 0;
    const y = "clientY" in e ? e.clientY : e.touches?.[0]?.clientY || 0;

    // Skip if movement is too small (< 2px) - reduces unnecessary updates
    const threshold = 2;
    const scaledX = x * DPR;
    const scaledY = y * DPR;
    const lead = points.current[0];
    
    if (Math.abs(lead.x - scaledX) < threshold && Math.abs(lead.y - scaledY) < threshold) {
      return;
    }

    points.current.forEach((p, i) => {
      quickX.current[i](scaledX);
      quickY.current[i](scaledY);
    });
  }, []);

  useEffect(() => {
    resize();
    let resizeRaf = 0;
    const onResize = () => {
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(resize);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });

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
    
    // Adaptive performance: track frame times and skip frames if needed
    let lastRenderTime = 0;
    let targetFrameTime = 1000 / 30; // Start at 30fps
    const minFrameTime = 1000 / 30; // 30fps
    const maxFrameTime = 1000 / 20; // 20fps fallback
    let frameTimeBuffer = []; // Track last few frame times
    const bufferSize = 5;
    
    // Track if animations are still settling
    const settlementThreshold = 0.5; // pixels - if all blobs move less than this, consider settled
    let isSettled = false;
    let settledFrameCount = 0;
    const requiredSettledFrames = 3; // Need 3 consecutive frames of minimal movement to confirm settled
    
    const loop = (currentTime) => {
      raf = requestAnimationFrame(loop);
      
      // Adaptive throttling based on actual render performance
      const timeSinceLastRender = currentTime - lastRenderTime;
      if (timeSinceLastRender < targetFrameTime) {
        return;
      }
      
      // Check if blobs are still animating by comparing current vs previous positions
      let maxMovement = 0;
      for (let i = 0; i < trailCount; i++) {
        const curr = points.current[i];
        const prev = prevPoints.current[i];
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
      
      // Only render if cursor moved recently OR animations are still settling
      const timeSinceMove = currentTime - lastMoveTime;
      if (timeSinceMove > 100 && !isMoving && isSettled) {
        return; // Skip rendering when everything is settled
      }
      
      // Measure render time for adaptive performance
      const renderStartTime = performance.now();

      const DPR = DPRRef.current;
      const grid = Math.max(1, Math.round(pixelSize * DPR));
      const q = Math.max(2, colorNum - 1);
      const stepSize = 1 / q;

      const dctx = drawCtx();
      const bctx = blurCtx();
      const dcan = drawCan();
      const bcan = blurCan();
      
      // Calculate scale factor (since blur canvas is smaller)
      const blurScale = dcan.width / c.width;

      dctx.clearRect(0, 0, dcan.width, dcan.height);

      const maxR = Math.max(...sizes) * DPR;
      
      // Optimize: batch drawing operations
      dctx.globalCompositeOperation = 'source-over';
      
      // Draw blobs on the smaller canvas
      for (let i = 0; i < trailCount; i++) {
        const p = points.current[i];
        if (p.x < -9000) continue;
        const R = (sizes[i] || sizes[sizes.length - 1]) * DPR * blurScale * 0.5;
        const scaledX = p.x * blurScale;
        const scaledY = p.y * blurScale;
        
        dctx.globalAlpha = opacities[i] ?? 1;
        
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

      // 2) blur by drawing drawCan → blurCan with filter ON
      bctx.clearRect(0, 0, bcan.width, bcan.height);
      bctx.filter = `blur(${blurPx * DPR * blurScale}px)`;
      bctx.drawImage(dcan, 0, 0);
      bctx.filter = "none";

      // 3) Calculate bounds for sampling (on full-res canvas)
      const minX = Math.max(0, Math.min(...points.current.map(p => p.x)) - maxR);
      const maxX = Math.min(c.width, Math.max(...points.current.map(p => p.x)) + maxR);
      const minY = Math.max(0, Math.min(...points.current.map(p => p.y)) - maxR);
      const maxY = Math.min(c.height, Math.max(...points.current.map(p => p.y)) + maxR);
      
      const startX = Math.floor(minX / grid) * grid;
      const endX = Math.ceil(maxX / grid) * grid;
      const startY = Math.floor(minY / grid) * grid;
      const endY = Math.ceil(maxY / grid) * grid;

      // Only get image data for the region we need (scaled to blur canvas size)
      const sampleX = Math.floor(startX * blurScale);
      const sampleY = Math.floor(startY * blurScale);
      const sampleW = Math.min(bcan.width - sampleX, Math.ceil((endX - startX) * blurScale));
      const sampleH = Math.min(bcan.height - sampleY, Math.ceil((endY - startY) * blurScale));
      
      if (sampleW <= 0 || sampleH <= 0) return;
      
      const img = bctx.getImageData(sampleX, sampleY, sampleW, sampleH);
      const data = img.data;
      const { r, g, b } = rgb.current;

      outCtx.clearRect(startX, startY, endX - startX, endY - startY);
      outCtx.globalAlpha = 1;
      outCtx.fillStyle = `rgb(${r},${g},${b})`;

      // Process only the bounded region
      for (let y = startY; y < endY; y += grid) {
        const gy = (Math.floor(y / grid) & 7);
        const bayerRow = BAYER_8_NORM[gy];
        
        for (let x = startX; x < endX; x += grid) {
          const gx = (Math.floor(x / grid) & 7);
          
          // Map to the sampled region coordinates
          const localX = Math.floor((x - startX) * blurScale);
          const localY = Math.floor((y - startY) * blurScale);
          const i = (localY * sampleW + localX) * 4;

          const a = data[i + 3] / 255;
          const stepped = a >= threshold ? (a - threshold) / (1 - threshold) : 0;

          const bayer = bayerRow[gx];
          const localCut = Math.min(1, Math.max(0, whiteCutoff - (bayer + thresholdShift) * stepSize));
          if (stepped >= localCut) {
            outCtx.fillRect(x, y, grid, grid);
          }
        }
      }
      
      // Adaptive performance: measure frame time and adjust target FPS
      const renderEndTime = performance.now();
      const frameTime = renderEndTime - renderStartTime;
      
      frameTimeBuffer.push(frameTime);
      if (frameTimeBuffer.length > bufferSize) {
        frameTimeBuffer.shift();
      }
      
      // Calculate average frame time
      if (frameTimeBuffer.length === bufferSize) {
        const avgFrameTime = frameTimeBuffer.reduce((a, b) => a + b, 0) / bufferSize;
        
        // If we're consistently taking too long, reduce target FPS
        if (avgFrameTime > targetFrameTime * 1.2) {
          targetFrameTime = Math.min(maxFrameTime, targetFrameTime * 1.1);
        } 
        // If we have headroom, increase target FPS back towards 30fps
        else if (avgFrameTime < targetFrameTime * 0.8) {
          targetFrameTime = Math.max(minFrameTime, targetFrameTime * 0.95);
        }
      }
      
      lastRenderTime = currentTime;
    };

    // Track mouse movement to conditionally render
    const originalOnMove = onMove;
    const wrappedOnMove = (e) => {
      lastMoveTime = performance.now();
      isMoving = true;
      isSettled = false; // Reset settlement when mouse moves
      settledFrameCount = 0;
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        isMoving = false;
      }, 100);
      originalOnMove(e);
    };
    
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("touchmove", onMove);
    window.addEventListener("pointermove", wrappedOnMove, { passive: true });
    window.addEventListener("touchmove", wrappedOnMove, { passive: true });

    loop(performance.now());
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(idleTimer);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", wrappedOnMove);
      window.removeEventListener("touchmove", wrappedOnMove);
    };
  }, [
    resize, onMove, trailCount, sizes, opacities,
    blurPx, threshold, colorNum, pixelSize, whiteCutoff, thresholdShift,
    fastDuration, slowDuration, fastEase, slowEase
  ]);

  return (
    <div
      ref={wrapRef}
      style={{ position: "fixed", inset: 0, zIndex, pointerEvents: "none" }}
      aria-hidden
    >
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100vw",
          height: "100vh",
          mixBlendMode: "multiply"
        }}
      />
    </div>
  );
}
