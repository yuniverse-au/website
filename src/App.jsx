import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import Dither from "./Dither";
import BlobCursorDither from "./BlobCursorDither";
import "./App.css";

function LogoSvg({ id, className, style, ariaLabel, ariaHidden }) {
  return (
    <svg
      id={id}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 631.7 145.6"
      fill="currentColor"
      className={className}
      style={style}
      aria-label={ariaLabel}
      aria-hidden={ariaHidden}
      // Logo Designer: ??
    >
      <path d="M627.2 145.6H457.4c-2.4 0-4.4-2-4.4-4.4v-37.3c0-1.6.9-3.1 2.3-3.9s3.2-.7 4.5.2l16.4 10.8 35.3-23.3c.7-.5 1.6-.7 2.4-.7h23l-25.4-16.7c-1.2-.8-2-2.2-2-3.7V4.4c0-2.4 2-4.4 4.4-4.4h37.7c1.2 0 2.3.5 3.1 1.3s1.3 2 1.3 3.1v37.3c0 2.4-2 4.4-4.4 4.4s-4.4-2-4.4-4.4V8.8h-28.9v55.3l35.8 23.5c1.6 1.1 2.4 3.1 1.8 5s-2.3 3.2-4.2 3.2h-36.4L478.7 120c-1.5 1-3.4 1-4.9 0l-12-7.9v24.7h150.7L587.1 120c-2-1.3-2.6-4.1-1.3-6.1s4.1-2.6 6.1-1.3l37.7 24.9c1.6 1.1 2.4 3.1 1.8 5-.5 1.8-2.2 3.1-4.2 3.1m-452.9 0h-37.7c-2.4 0-4.4-2-4.4-4.4s2-4.4 4.4-4.4h23L96.4 95.1c-1.2-.8-2-2.2-2-3.7s.7-2.9 2-3.7L216.2 8.8h-21.7l-131 86.3c-1.5 1-3.4 1-4.9 0L2 57.8c-1.2-.8-2-2.2-2-3.7s.7-2.9 2-3.7L20.9 38c2-1.3 4.8-.8 6.1 1.3 1.3 2 .8 4.8-1.3 6.1l-13.3 8.7 48.6 32L190.7.7c.7-.5 1.6-.7 2.4-.7h37.7c2 0 3.7 1.3 4.2 3.2.6 1.9-.2 3.9-1.8 5L106.8 91.4l69.9 46c1.6 1.1 2.4 3.1 1.8 5-.5 1.9-2.3 3.2-4.2 3.2" />
      <path d="M212 145.6c-.8 0-1.7-.2-2.4-.7l-75.5-49.7c-1.2-.8-2-2.2-2-3.7s.7-2.9 2-3.7l56.6-37.3c2-1.3 4.8-.8 6.1 1.3 1.3 2 .8 4.8-1.3 6.1l-51 33.6 67.5 44.4 14.5-9.5V54.1c0-2.4 2-4.4 4.4-4.4s4.4 2 4.4 4.4v74.6c0 1.5-.7 2.9-2 3.7l-18.9 12.4c-.7.5-1.5.8-2.4.8" />
      <path d="M268.6 145.6h-18.9c-2.4 0-4.4-2-4.4-4.4V41.7c0-1.5.7-2.9 2-3.7l16.9-11.1V8.8h-10v8c0 1.5-.7 2.9-2 3.7L216.4 44v72.2c0 1.6-.9 3.1-2.3 3.9s-3.2.7-4.5-.2L171.9 95c-1.2-.8-2-2.2-2-3.7s.7-2.9 2-3.7l18.9-12.4c2-1.3 4.8-.8 6.1 1.3 1.3 2 .8 4.8-1.3 6.1l-13.3 8.7 25.3 16.7V41.7c0-1.5.7-2.9 2-3.7l35.8-23.5v-10c0-2.4 2-4.4 4.4-4.4h18.9c2.4 0 4.4 2 4.4 4.4v24.9c0 1.5-.7 2.9-2 3.7l-16.9 11.1v92.6h10V54.1c0-1.5.7-2.9 2-3.7l16.9-11.1V4.4c0-2.4 2-4.4 4.4-4.4s4.4 2 4.4 4.4v37.3c0 1.5-.7 2.9-2 3.7L273 56.5v84.6c.1 2.5-1.9 4.5-4.4 4.5m56.7 0h-37.7c-2 0-3.7-1.3-4.2-3.2-.6-1.9.2-3.9 1.8-5l16.9-11.1V4.4c0-2.4 2-4.4 4.4-4.4s4.4 2 4.4 4.4v124.3c0 1.5-.7 2.9-2 3.7l-6.6 4.3H324l34.7-22.8V41.7c0-2.4 2-4.4 4.4-4.4s4.4 2 4.4 4.4v74.6c0 1.5-.7 2.9-2 3.7l-37.7 24.9c-.8.4-1.7.7-2.5.7" />
      <path d="M287.5 120.7c-2.4 0-4.4-2-4.4-4.4V79.1c0-2.4 2-4.4 4.4-4.4s4.4 2 4.4 4.4v37.2c0 2.4-1.9 4.4-4.4 4.4m37.8 0c-.7 0-1.4-.2-2.1-.5-1.4-.8-2.3-2.3-2.3-3.9V66.6c0-1.5.7-2.9 2-3.7l13.3-8.7-13.3-8.7c-1.2-.8-2-2.2-2-3.7V4.4c0-2.4 2-4.4 4.4-4.4H363c2.4 0 4.4 2 4.4 4.4v12.4c0 1.5-.7 2.9-2 3.7L346.6 33c-2 1.3-4.8.8-6.1-1.3-1.3-2-.8-4.8 1.3-6.1l16.9-11.1V8.8h-28.9v30.5l16.9 11.1c1.2.8 2 2.2 2 3.7s-.7 2.9-2 3.7l-16.9 11.1V108l10-6.6V78.9c0-2.4 2-4.4 4.4-4.4s4.4 2 4.4 4.4v24.9c0 1.5-.7 2.9-2 3.7L327.7 120c-.7.5-1.6.7-2.4.7m113.2 24.9c-.8 0-1.7-.2-2.4-.7l-18.9-12.4c-1.2-.8-2-2.2-2-3.7V81.4l-16.9-11.1c-1.2-.8-2-2.2-2-3.7V41.7c0-1.5.7-2.9 2-3.7l35.8-23.5V8.8h-47.8v119.9c0 1.5-.7 2.9-2 3.7l-6.6 4.3h4.1c2.4 0 4.4 2 4.4 4.4s-2 4.4-4.4 4.4H363c-2 0-3.7-1.3-4.2-3.2-.6-1.9.2-3.9 1.8-5l16.9-11.1V4.4c0-2.4 2-4.4 4.4-4.4h56.6c2.4 0 4.4 2 4.4 4.4v12.4c0 1.5-.7 2.9-2 3.7L405.1 44v20.1L422 75.2c1.2.8 2 2.2 2 3.7v47.3l16.9 11.1c2 1.3 2.6 4.1 1.3 6.1-.9 1.5-2.3 2.2-3.7 2.2" />
      <path d="M438.5 120.7c-2.4 0-4.4-2-4.4-4.4V91.4c0-1.5.7-2.9 2-3.7L455 75.3c1.5-1 3.4-1 4.9 0l16.4 10.8 14.5-9.5V37.5L441 70.3c-1.5 1-3.4 1-4.9 0l-18.9-12.4c-1.2-.8-2-2.2-2-3.7s.7-2.9 2-3.7L453 26.9V4.4c0-2.4 2-4.4 4.4-4.4h37.7c2.4 0 4.4 2 4.4 4.4s-2 4.4-4.4 4.4h-33.3v20.4c0 1.5-.7 2.9-2 3.7l-32.1 21.2 10.8 7.1 54.2-35.7c1.4-.9 3.1-1 4.5-.2s2.3 2.3 2.3 3.9V79c0 1.5-.7 2.9-2 3.7l-18.9 12.4c-1.5 1-3.4 1-4.9 0l-16.4-10.8-14.5 9.5v22.4c.1 2.5-1.9 4.5-4.3 4.5m-151-52.8c2.4 0 4.6-2.1 4.5-4.5s-2-4.5-4.5-4.5c-2.4 0-4.6 2.1-4.5 4.5s2 4.5 4.5 4.5" />
      <path d="M476 71.5c2.4 0 4.6-2.1 4.5-4.5s-2-4.5-4.5-4.5c-2.4 0-4.6 2.1-4.5 4.5.1 2.5 2 4.5 4.5 4.5m0-44.8c2.4 0 4.6-2.1 4.5-4.5s-2-4.5-4.5-4.5c-2.4 0-4.6 2.1-4.5 4.5s2 4.5 4.5 4.5m-75.1 0c2.4 0 4.6-2.1 4.5-4.5s-2-4.5-4.5-4.5c-2.4 0-4.6 2.1-4.5 4.5s2 4.5 4.5 4.5m-.1 69.2c2.4 0 4.6-2.1 4.5-4.5s-2-4.5-4.5-4.5c-2.4 0-4.6 2.1-4.5 4.5s1.9 4.5 4.5 4.5m.1 17.5c2.4 0 4.6-2.1 4.5-4.5s-2-4.5-4.5-4.5c-2.4 0-4.6 2.1-4.5 4.5.1 2.5 2 4.5 4.5 4.5m0 16.7c2.4 0 4.6-2.1 4.5-4.5s-2-4.5-4.5-4.5c-2.4 0-4.6 2.1-4.5 4.5s2 4.5 4.5 4.5m-.1 15.5c2.4 0 4.6-2.1 4.5-4.5s-2-4.5-4.5-4.5c-2.4 0-4.6 2.1-4.5 4.5s1.9 4.5 4.5 4.5M532.9 26.7c2.4 0 4.6-2.1 4.5-4.5s-2-4.5-4.5-4.5c-2.4 0-4.6 2.1-4.5 4.5s2 4.5 4.5 4.5m0 15.8c2.4 0 4.6-2.1 4.5-4.5s-2-4.5-4.5-4.5c-2.4 0-4.6 2.1-4.5 4.5s2 4.5 4.5 4.5m0 16.1c2.4 0 4.6-2.1 4.5-4.5s-2-4.5-4.5-4.5c-2.4 0-4.6 2.1-4.5 4.5.1 2.5 2 4.5 4.5 4.5" />
    </svg>
  );
}

export default function App() {
  const [isMobile, setIsMobile] = useState(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
  const [logoSize, setLogoSize] = useState(isMobile ? "70vw" : "40vw");
  const [ditherEnabled, setDitherEnabled] = useState(true);
  const [ditherPaused, setDitherPaused] = useState(false);
  const [isReturnTransition, setIsReturnTransition] = useState(false);
  const [ditherReady, setDitherReady] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  const [isHashPage, setIsHashPage] = useState(false);
  const [isHashTransitioning, setIsHashTransitioning] = useState(false);
  const [blobScale, setBlobScale] = useState(1);

  const colorSteps = isMobile ? 8 : 8;
  const waveColor = isMobile ? [0.3, 0.3, 0.3] : [0.2, 0.2, 0.2];
  const blobPixelSize = 2;
  const blobBaseZIndex = 55;
  const blobHomeZIndex = 8; // Keep blob beneath home logo + side links
  const blobMaskZIndex = 30; // Ensure mask layers sit above the blob during transitions
  const homeBlobColor = "#000000";
  const hashBlobColor = "#cbcbcb";

  useEffect(() => {
    if (window.location.hash) {
      const baseUrl = window.location.origin + window.location.pathname;
      window.location.replace(baseUrl);
    }
  }, []);

  useEffect(() => {
    const checkHash = () => {
      const hasHash = window.location.hash && window.location.hash.length > 1;
      setIsHashPage(hasHash);
    };

    checkHash();
    window.addEventListener("hashchange", checkHash);
    return () => window.removeEventListener("hashchange", checkHash);
  }, []);

  useEffect(() => {
    if (!isHashPage) {
      const logos = document.querySelectorAll("#site-logo, #site-logo-solid");
      logos.forEach(logo => {
        logo.style.display = "";
      });
    }
  }, [isHashPage]);

  useEffect(() => {
    if (isHashPage) {
      setIsHashTransitioning(false);
    }
  }, [isHashPage]);

  useEffect(() => {
    const updateScale = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      const newIsMobile = width <= 768;
      setIsMobile(newIsMobile);
      setLogoSize(newIsMobile ? "70vw" : "40vw");

      const minHeight = 600;
      const maxHeight = 2160;
      const minScale = 0.2;
      const maxScale = 1.0;

      if (height <= minHeight) {
        setBlobScale(minScale);
      } else if (height >= maxHeight) {
        setBlobScale(maxScale);
      } else {
        const scale = minScale + ((height - minHeight) / (maxHeight - minHeight)) * (maxScale - minScale);
        setBlobScale(scale);
      }
    };

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  const baseSizes = isMobile ? [900, 675, 450, 270] : [800, 550, 400, 280, 120];
  const scaledSizes = baseSizes.map(size => Math.round(size * blobScale));
  const scaledBlur = Math.round((isMobile ? 65 : 82) * blobScale);
  const hashPageContentRef = useRef(null);
  const hashPageBackgroundRef = useRef(null);
  const homeMaskContentRef = useRef(null);
  const additionalMaskRefs = useMemo(() => [hashPageBackgroundRef], [hashPageBackgroundRef]);
  const homeMaskRefs = useMemo(() => [homeMaskContentRef], [homeMaskContentRef]);
  const backgroundDitherRef = useRef(null);
  const backgroundDitherFadeTween = useRef(null);
  const lastSideLinksTopRef = useRef(null);
  useEffect(() => () => {
    const node = backgroundDitherRef.current;
    if (!node) return;
    node.classList.remove("home-mask-content");
    node.classList.remove("home-mask-target");
    delete node.dataset.maskLayer;
    node.style.clipPath = "none";
    node.style.webkitClipPath = "none";
    node.style.opacity = "";
    node.style.visibility = "";
    node.style.zIndex = "0";
  }, []);

  useEffect(() => {
    const node = backgroundDitherRef.current;
    backgroundDitherFadeTween.current?.kill();
    backgroundDitherFadeTween.current = null;

    if (!node || !ditherReady) {
      return () => {
        backgroundDitherFadeTween.current?.kill();
        backgroundDitherFadeTween.current = null;
      };
    }

    if (!ditherEnabled) {
      backgroundDitherFadeTween.current = gsap.to(node, {
        opacity: 0,
        duration: 0.35,
        ease: "power2.inOut"
      });
    } else {
      backgroundDitherFadeTween.current = gsap.to(node, {
        opacity: 1,
        duration: isHashTransitioning ? 1.6 : 0.8,
        ease: "power2.inOut"
      });
    }

    return () => {
      backgroundDitherFadeTween.current?.kill();
      backgroundDitherFadeTween.current = null;
    };
  }, [isHashTransitioning, ditherReady, ditherEnabled]);

  useEffect(() => {
    if (ditherReady) return;

    const reduceMotionQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    if (reduceMotionQuery?.matches) {
      setDitherReady(true);
      return;
    }

    const overlay = document.querySelector(".preload-reveal");
    if (!overlay) {
      setDitherReady(true);
      return;
    }

    let fallbackId = window.setTimeout(() => setDitherReady(true), 4500);

    const handleAnimationEnd = event => {
      if (event.animationName === "colorShift") {
        window.clearTimeout(fallbackId);
        setDitherReady(true);
      }
    };

    overlay.addEventListener("animationend", handleAnimationEnd);
    return () => {
      overlay.removeEventListener("animationend", handleAnimationEnd);
      window.clearTimeout(fallbackId);
    };
  }, [ditherReady]);

  useEffect(() => {
    const real = document.getElementById("site-logo");
    const ghostHost = document.querySelector(".preload-ghost");
    if (!real || !ghostHost) return;

    const ghost = real.cloneNode(true);
    ghost.removeAttribute("id");
    ghost.setAttribute("class", "preload-logo-svg");
    ghost.style.color = "#000";
    ghost.style.filter = "none";
    ghost.style.mixBlendMode = "normal";
    ghostHost.innerHTML = "";
    ghostHost.appendChild(ghost);

    const place = () => {
      const r = real.getBoundingClientRect();
      ghostHost.style.position = "fixed";
      ghostHost.style.transform = `translate(${r.left}px, ${r.top}px)`;
      ghostHost.style.width = `${r.width}px`;
      ghostHost.style.height = `${r.height}px`;
    };

    place();
    const ro = new ResizeObserver(place);
    ro.observe(document.body);
    window.addEventListener("resize", place, { passive: true });
    window.addEventListener("orientationchange", place, { passive: true });
    window.addEventListener("scroll", place, { passive: true });
    const t = setTimeout(place, 0);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("orientationchange", place);
      window.removeEventListener("scroll", place);
      clearTimeout(t);
    };
  }, []);

  // Position left links between logo bottom and viewport bottom
  useEffect(() => {
    const logo = document.getElementById("site-logo");
    if (!logo) return;

    const setTop = () => {
      const r = logo.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) {
        if (lastSideLinksTopRef.current != null) {
          document.documentElement.style.setProperty("--side-links-top", `${lastSideLinksTopRef.current}px`);
        }
        return;
      }
      // a little breathing room below the logo
      const top = Math.max(0, Math.round(r.bottom + 12));
      lastSideLinksTopRef.current = top;
      document.documentElement.style.setProperty("--side-links-top", `${top}px`);
    };

    setTop();
    const ro = new ResizeObserver(setTop);
    ro.observe(document.body);
    window.addEventListener("resize", setTop, { passive: true });
    window.addEventListener("scroll", setTop, { passive: true });
    const t = setTimeout(setTop, 0);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", setTop);
      window.removeEventListener("scroll", setTop);
      clearTimeout(t);
    };
  }, []);

  return (
    <div className={`app ${isHashPage ? "app--hash" : ""} ${isHashTransitioning ? "app--hash-transition" : ""}`}>
      <div className="preload-reveal" aria-hidden="true">
        <div className="preload-ghost" />
        <h3 className="legal">© 2025 Yuniverse Australia. All rights reserved.</h3>
      </div>

      {ditherReady && (
        <div
          className="layer app-background-dither"
          ref={backgroundDitherRef}
          aria-hidden={!ditherEnabled && !isHashTransitioning}
          style={{ visibility: ditherEnabled || isHashTransitioning ? "visible" : "hidden" }}
        >
          <Dither
            waveColor={waveColor}
            disableAnimation={ditherPaused}
            enableMouseInteraction={false}
            mouseRadius={0.3}
            colorNum={colorSteps}
            waveAmplitude={0.3}
            waveFrequency={0.8}
            waveSpeed={0.04}
          />
        </div>
      )}

      <div className="home-mask-content" ref={homeMaskContentRef}>
        <nav className="side-links side-links--solid home-mask-target" aria-label="Section links">
          <ul className="side-links__list">
            <li><a className="side-links__a" href="#about">About</a></li>
            <li><a className="side-links__a" href="#linkone">LinkOne</a></li>
            <li><a className="side-links__a" href="#linktwo">LinkTwo</a></li>
          </ul>
        </nav>

        <h3 className="small-message home-mask-target">first to use discord link:?yannblu?</h3>
      </div>

      {/* Hash page layers: background on a lower plane, content masked above */}
      <div
        className={`hash-page-background ${isHashPage ? "hash-page-background--visible" : ""}`}
        ref={hashPageBackgroundRef}
        aria-hidden="true"
      />

      <div
        className={`hash-page-content ${isHashPage ? "hash-page-content--visible" : ""}`}
        ref={hashPageContentRef}
      >
        <LogoSvg
          className="logo logo-diff logo--hash logo--interactive"
          style={{ width: logoSize }}
          ariaHidden
        />
        <div className="mask-preview" aria-hidden={!ditherReady}>
          <div className="mask-preview__inner">
            <p>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam id dolor at augue porta faucibus.
              Suspendisse potenti. Fusce euismod erat vel tempor ultrices.
            </p>
          </div>
        </div>
      </div>

      {ditherReady && (
        <BlobCursorDither
          trailCount={isMobile ? 4 : 5}
          sizes={scaledSizes}
          opacities={isMobile ? [1, 0.85, 0.5, 0.35] : [1, 0.9, 0.55, 0.4, 0.3]}
          blurPx={scaledBlur}
          threshold={0.28}
          color={homeBlobColor}
          hashColor={hashBlobColor}
          pixelSize={blobPixelSize}
          whiteCutoff={0.7}
          thresholdShift={-0.4}
          onExpansionComplete={() => {
            setDitherEnabled(false);
            if (isHashPage) {
              setIsHashTransitioning(false);
            }
          }}
          onExpansionStart={() => {
            setDitherPaused(true);
            setIsHashTransitioning(true);
          }}
          onReturnStart={() => {
            const backgroundNode = backgroundDitherRef.current;
            if (backgroundNode) {
              backgroundNode.classList.add("home-mask-content");
              backgroundNode.classList.add("home-mask-target");
              backgroundNode.dataset.maskLayer = "dither";
              backgroundNode.style.zIndex = "0";
              backgroundNode.style.opacity = "1";
              backgroundNode.style.visibility = "visible";
            }
            setIsReturnTransition(true);
            setDitherEnabled(true);
            setDitherPaused(false);
            setIsHashTransitioning(true);
          }}
          onReturnComplete={() => {
            const backgroundNode = backgroundDitherRef.current;
            if (backgroundNode) {
              backgroundNode.classList.remove("home-mask-content");
              backgroundNode.classList.remove("home-mask-target");
              delete backgroundNode.dataset.maskLayer;
              const restoreStyles = () => {
                const node = backgroundDitherRef.current;
                if (!node) return;
                node.style.clipPath = "none";
                node.style.webkitClipPath = "none";
                node.style.opacity = "1";
                node.style.visibility = "visible";
                node.style.zIndex = "0";
              };
              if (typeof requestAnimationFrame === "function") {
                requestAnimationFrame(restoreStyles);
              } else {
                setTimeout(restoreStyles, 0);
              }
            }
            setIsReturnTransition(false);
            setDitherEnabled(true);
            setDitherPaused(false);
            setIsHashTransitioning(false);
            setIsHashPage(false);
          }}
          mode="mask"
          maskColor="#000000"
          clipTargetRef={hashPageContentRef}
          additionalClipRefs={additionalMaskRefs}
          homeClipRefs={homeMaskRefs}
          maskActivation="transition"
          hashOverlayActive={isHashPage}
          zIndex={blobBaseZIndex}
          homeZIndex={blobHomeZIndex}
          maskZIndex={blobMaskZIndex}
          homeMaskSelector=".home-mask-target"
        />
      )}

      <LogoSvg
        id="site-logo"
        className={`logo logo-diff ${isHashPage ? "logo--hash-home logo--clickable" : "logo--home"}`}
        style={{ width: logoSize }}
        ariaHidden
      />

      <LogoSvg
        id="site-logo-solid"
        className={`logo logo--solid ${isHashPage ? "logo--hash-home logo--clickable" : "logo--home"}`}
        style={{ width: logoSize }}
        ariaLabel="The Yuniverse"
      />

      <nav className="side-links side-links--diff" aria-label="Section links">
        <ul className="side-links__list">
          <li><a className="side-links__a" href="#about">About</a></li>
          <li><a className="side-links__a" href="#linkone">LinkOne</a></li>
          <li><a className="side-links__a" href="#linktwo">LinkTwo</a></li>
        </ul>
      </nav>

      <h3
        className={`small-message small-message--base ${isHashPage || isHashTransitioning ? "small-message--base-hidden" : ""}`}
        aria-hidden={isHashPage || isHashTransitioning}
      >
        first to use discord link:「yannblu」
      </h3>
    </div>
  );
}