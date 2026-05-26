import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import Dither from "./Dither";
import BlobCursorDither from "./BlobCursorDither";
import RemindYu from "./remindyu";
import Privacy from "./remindyu/privacy";
import Terms from "./remindyu/terms";
import LogoSvg from "./LogoSvg";
import SocialLinks from "./SocialLinks";
import "./App.css";

export default function App() {
  const [currentPath, setCurrentPath] = useState(() => {
    const redirectPath = sessionStorage.getItem('redirectPath');
    if (redirectPath) {
      sessionStorage.removeItem('redirectPath');
      return redirectPath;
    }
    return window.location.pathname;
  });

  const [isMobile, setIsMobile] = useState(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
  const [logoSize, setLogoSize] = useState(
    isMobile ? "clamp(120px, 32vw, 200px)" : "clamp(160px, 18vw, 280px)"
  );
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

  const [theme, setTheme] = useState("ink");
  const themeAnimatingRef = useRef(false);
  const themeRef = useRef("ink");
  themeRef.current = theme;

  // Keys describe the dither ink color, not the background:
  //   ink   — light dither dots on a dark background
  //   paper — dark dither dots on a light background
  const themeConfig = {
    ink:   { clearColor: "#191919", waveColor: [0.554,  0.554,  0.554 ], blackLevel: 0.0097, whiteLevel: 0.554,  colorSteps: 8, whiteCutoff: 0.35 },
    paper: { clearColor: "#c4c4c4", waveColor: [0.554,  0.554,  0.554 ], blackLevel: 0.554,  whiteLevel: 0.0097, colorSteps: 6, whiteCutoff: 0.2 },
  };
  const [animatedColorNum, setAnimatedColorNum] = useState(themeConfig.ink.colorSteps);
  const [themeContrast, setThemeContrast] = useState(1);
  const [blobThemeScale, setBlobThemeScale] = useState(1); // 1 at rest, dips to 0 mid-theme-swap
  const activeTheme = themeConfig[theme];
  const waveColor = activeTheme.waveColor;
  // Match the Dither background's default pixelSize so both grids align.
  const blobPixelSize = 2;
  const blobBaseZIndex = 55;
  const blobHomeZIndex = 8; // Keep blob beneath home logo + side links
  const blobMaskZIndex = 30; // Ensure mask layers sit above the blob during transitions
  const homeBlobColor = theme === "paper" ? "#c4c4c4" : "#191919";
  const hashBlobColor = "#c4c4c4";

  const startThemeChange = () => {
    if (themeAnimatingRef.current) return;
    themeAnimatingRef.current = true;

    const fromTheme = themeRef.current;
    const toTheme   = fromTheme === "paper" ? "ink" : "paper";
    const fromSteps = themeConfig[fromTheme].colorSteps;
    const toSteps   = themeConfig[toTheme].colorSteps;

    const t0 = performance.now();
    const totalMs    = 2000;
    const swapAtMs   = 1000;  // theme flip + colorNum jump (0 → HIGH_START)
    const HIGH_START = 16;
    let swapped = false;

    const tick = (now) => {
      const e = now - t0;
      let cn;
      let blobScaleVal;
      let contrastVal;
      if (e < swapAtMs) {
        // first half: fromSteps → 0, ease-in (slow leave from resting, zip through 0)
        const t = e / swapAtMs;
        cn = fromSteps - fromSteps * (t * t);
        // blobs shrink 1 → 0 with same ease-in shape so they vanish into the swap moment
        blobScaleVal = 1 - t * t;
        // contrast fades 1 → 0 alongside the blob shrink so mid-tones return for the colorNum sweep
        contrastVal = 1 - t * t;
      } else if (e < totalMs) {
        // second half: HIGH_START → toSteps, strong ease-out (zip through 16, lingering settle into rest)
        const t = (e - swapAtMs) / (totalMs - swapAtMs);
        const oneMinusT = 1 - t;
        cn = HIGH_START + (toSteps - HIGH_START) * (1 - oneMinusT * oneMinusT * oneMinusT * oneMinusT);
        // blobs grow 0 → 1 with the same quartic ease-out
        blobScaleVal = 1 - oneMinusT * oneMinusT * oneMinusT * oneMinusT;
        contrastVal = 1 - oneMinusT * oneMinusT * oneMinusT * oneMinusT;
      } else {
        cn = toSteps;
        blobScaleVal = 1;
        contrastVal = 1;
      }
      setAnimatedColorNum(cn);
      setBlobThemeScale(blobScaleVal);
      setThemeContrast(contrastVal);

      if (!swapped && e >= swapAtMs) {
        swapped = true;
        setTheme(toTheme);
      }

      if (e < totalMs) {
        requestAnimationFrame(tick);
      } else {
        setAnimatedColorNum(toSteps);
        setBlobThemeScale(1);
        setThemeContrast(1);
        themeAnimatingRef.current = false;
      }
    };
    requestAnimationFrame(tick);
  };

  const isRemindYuRoute = currentPath.startsWith("/remind.yu");

  useEffect(() => {
    if (isRemindYuRoute) return;
    const onKey = (e) => {
      if (e.key !== "t" && e.key !== "T") return;
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable) return;
      startThemeChange();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isRemindYuRoute]);

  useEffect(() => {
    if (isRemindYuRoute) return;
    document.body.style.background = theme === "ink" ? "#191919" : "#c4c4c4";
  }, [theme, isRemindYuRoute]);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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
      setLogoSize(newIsMobile ? "clamp(120px, 32vw, 200px)" : "clamp(160px, 18vw, 280px)");

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
  const scaledSizes = baseSizes.map(size => Math.round(size * blobScale * blobThemeScale));
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
    // Strip cloned inline sizing so the ghost fills its host (which is itself sized to
    // the real logo's bounding rect via place()). Without this, the inline width from
    // the cloned style attr would override .preload-logo-svg's width:100% and the ghost
    // would size independently of the host.
    ghost.style.removeProperty("width");
    ghost.style.removeProperty("height");
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

  // Route to remind.yu landing and sub-pages
  if (currentPath === "/remind.yu" || currentPath === "/remind.yu/") {
    return <RemindYu />;
  }
  if (currentPath === "/remind.yu/privacy" || currentPath === "/remind.yu/privacy/") {
    return <Privacy />;
  }
  if (currentPath === "/remind.yu/terms" || currentPath === "/remind.yu/terms/") {
    return <Terms />;
  }

  return (
    <div className={`app ${isHashPage ? "app--hash" : ""} ${isHashTransitioning ? "app--hash-transition" : ""}`} data-theme={theme}>
      <div className="preload-reveal" aria-hidden="true">
        <div className="preload-ghost" />
        <h3 className="legal">© 2026 Yuniverse Australia. All rights reserved.</h3>
      </div>

      <h3 className="legal legal--link">
        © 2026 Yuniverse Australia. All rights reserved.
        <a className="legal__anchor" href="/remind.yu/privacy">
          Privacy Policy
        </a>
        <span style={{ margin: '0 0.7em' }}>|</span>
        <a className="legal__anchor" href="/remind.yu/terms">
          Terms of Use
        </a>
      </h3>

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
            colorNum={animatedColorNum}
            waveAmplitude={0.3}
            waveFrequency={0.8}
            waveSpeed={0.04}
            blackLevel={activeTheme.blackLevel}
            whiteLevel={activeTheme.whiteLevel}
            whiteCutoff={activeTheme.whiteCutoff}
            clearColor={activeTheme.clearColor}
            contrastAmount={themeContrast}
          />
        </div>
      )}

      {ditherReady && (
        <BlobCursorDither
          trailCount={isMobile ? 4 : 5}
          sizes={scaledSizes}
          opacities={isMobile ? [1, 0.85, 0.5, 0.35] : [1, 0.9, 0.55, 0.4, 0.3]}
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
          maskColor="#191919"
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
      
      <h3
        className={`small-message small-message--base ${isHashPage || isHashTransitioning ? "small-message--base-hidden" : ""}`}
        aria-hidden={isHashPage || isHashTransitioning}
      >
        revolves around you.
      </h3>

      <button
        type="button"
        className={`theme-toggle theme-toggle--${theme}`}
        onClick={startThemeChange}
        aria-label="Toggle theme"
      >
        <span className="theme-toggle__hint" aria-hidden="true">t</span>
        <span className="theme-toggle__circle" aria-hidden="true" />
      </button>

      <SocialLinks />
    </div>
  );
}