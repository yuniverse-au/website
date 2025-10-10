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
  const DPRRef = useRef(Math.max(1, window.devicePixelRatio || 1));

  // points animated by GSAP
  const points = useRef(
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
    const DPR = Math.max(1, window.devicePixelRatio || 1);
    DPRRef.current = DPR;

    const c = canvasRef.current;
    if (!c) return;
    c.width = Math.floor(window.innerWidth * DPR);
    c.height = Math.floor(window.innerHeight * DPR);
    c.style.width = "100vw";
    c.style.height = "100vh";

    // offscreen buffers
    const drawCan = drawCanRef.current || (drawCanRef.current = document.createElement("canvas"));
    const blurCan = blurCanRef.current || (blurCanRef.current = document.createElement("canvas"));
    drawCan.width = c.width;
    drawCan.height = c.height;
    blurCan.width = c.width;
    blurCan.height = c.height;

    drawCtxRef.current = drawCan.getContext("2d", { willReadFrequently: true });
    blurCtxRef.current = blurCan.getContext("2d", { willReadFrequently: true });
  }, []);

  const onMove = useCallback((e) => {
    const DPR = DPRRef.current;
    const x = "clientX" in e ? e.clientX : e.touches?.[0]?.clientX || 0;
    const y = "clientY" in e ? e.clientY : e.touches?.[0]?.clientY || 0;

    points.current.forEach((p, i) => {
      const isLead = i === 0;
      quickX.current[i](x * DPR);
      quickY.current[i](y * DPR);
      // The tween timing is encoded in quickTo; this just updates the end value.
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
    const outCtx = c.getContext("2d");
    outCtx.imageSmoothingEnabled = false;

    const drawCtx = () => drawCtxRef.current;
    const blurCtx = () => blurCtxRef.current;
    const drawCan = () => drawCanRef.current;
    const blurCan = () => blurCanRef.current;

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);

      const DPR = DPRRef.current;
      const grid = Math.max(1, Math.round(pixelSize * DPR));
      const q = Math.max(2, colorNum - 1);
      const stepSize = 1 / q;

      const dctx = drawCtx();
      const bctx = blurCtx();
      const dcan = drawCan();
      const bcan = blurCan();

      dctx.clearRect(0, 0, dcan.width, dcan.height);

      const maxR = Math.max(...sizes) * DPR;
      for (let i = 0; i < trailCount; i++) {
        const p = points.current[i];
        if (p.x < -9000) continue;
        const R = (sizes[i] || sizes[sizes.length - 1]) * DPR * 0.5;
        dctx.globalAlpha = opacities[i] ?? 1;
        const grad = dctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, R);
        grad.addColorStop(0, "rgba(0,0,0,1)");
        grad.addColorStop(1, "rgba(0,0,0,0)");
        dctx.fillStyle = grad;
        dctx.beginPath();
        dctx.arc(p.x, p.y, R, 0, Math.PI * 2);
        dctx.fill();
      }

      // 2) blur by drawing drawCan → blurCan with filter ON (this actually blurs)
      bctx.clearRect(0, 0, bcan.width, bcan.height);
      bctx.filter = `blur(${blurPx * DPR}px)`; // scale blur by DPR for parity
      bctx.drawImage(dcan, 0, 0);
      bctx.filter = "none";

      // 3) sample blurred alpha and paint blocks on the OUT canvas
      outCtx.clearRect(0, 0, c.width, c.height);
      const img = bctx.getImageData(0, 0, bcan.width, bcan.height);
      const data = img.data;
      const { r, g, b } = rgb.current;

      outCtx.globalAlpha = 1;
      outCtx.fillStyle = `rgb(${r},${g},${b})`;

      // Walk the grid (far fewer iterations than per-pixel)
      for (let y = 0; y < c.height; y += grid) {
        const gy = (Math.floor(y / grid) & 7);
        for (let x = 0; x < c.width; x += grid) {
          const gx = (Math.floor(x / grid) & 7);
          const i = ((y * c.width) + x) * 4;

          const a = data[i + 3] / 255;
          const stepped = a >= threshold ? (a - threshold) / (1 - threshold) : 0;

          const bayer = BAYER_8_NORM[gy][gx];
          const localCut = Math.min(1, Math.max(0, whiteCutoff - (bayer + thresholdShift) * stepSize));
          if (stepped >= localCut) {
            outCtx.fillRect(x, y, grid, grid);
          }
        }
      }
    };

    loop();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("touchmove", onMove);
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
