import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import Dither from "./Dither";
import BlobCursorDither from "./BlobCursorDither";
import RemindYu from "./remindyu";
import Privacy from "./remindyu/privacy";
import Terms from "./remindyu/terms";
import LogoSvg from "./LogoSvg";
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
  const [logoSize, setLogoSize] = useState(isMobile ? "60vw" : "30vw");
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
      setLogoSize(newIsMobile ? "60vw" : "30vw");

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
    <div className={`app ${isHashPage ? "app--hash" : ""} ${isHashTransitioning ? "app--hash-transition" : ""}`}>
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
            colorNum={colorSteps}
            waveAmplitude={0.3}
            waveFrequency={0.8}
            waveSpeed={0.04}
          />
        </div>
      )}

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
      
      <h3
        className={`small-message small-message--base ${isHashPage || isHashTransitioning ? "small-message--base-hidden" : ""}`}
        aria-hidden={isHashPage || isHashTransitioning}
      >
        revolves around you.
      </h3>
    </div>
  );
}