import { useEffect, useRef, useState } from "react";
import BlobCursorDither from "../BlobCursorDither";
import Dither from "../Dither";
import YuniverseLogoHeader from "../YuniverseLogoHeader";
import SplitText from "./SplitText";
import "./RemindYu.css";

/* Bayer 8×8 ordered-dither threshold map (values 0–63) */
const BAYER8 = [
  [ 0,32, 8,40, 2,34,10,42],
  [48,16,56,24,50,18,58,26],
  [12,44, 4,36,14,46, 6,38],
  [60,28,52,20,62,30,54,22],
  [ 3,35,11,43, 1,33, 9,41],
  [51,19,59,27,49,17,57,25],
  [15,47, 7,39,13,45, 5,37],
  [63,31,55,23,61,29,53,21],
];

const FEATURES = [
  {
    number: "01",
    name: "Dashboard.",
    desc: "Your reminders laid out across a full calendar. See what's due when, across the whole month, at a glance.",
    screenshot: "/images/remindyu/Dashboard.png",
  },
  {
    number: "02",
    name: "Reminders for the Day.",
    desc: "See what's lined up for the day, with its icon and status, so you always know exactly what's still to come.",
    screenshot: "/images/remindyu/RemindersForTheDay.png",
  },
  {
    number: "03",
    name: "Priority Presets.",
    desc: "Set presets for High, Medium and Low priority reminders: notification type, sound, vibration and nagging. You can pick a level for each reminder, and it inherits your presets. Override per reminder when you want.",
    screenshot: "/images/remindyu/PriorityPresetsNagging.png",
  },
  {
    number: "04",
    name: "High Granularity.",
    desc: "Your schedule isn't just clock times. Set reminders before, during or after meals, or at an exact time. remind.yu fits around how you actually live.",
    screenshot: "/images/remindyu/BeforeBreakfastReminder.png",
  },
  {
    number: "05",
    name: "Linked Reminders.",
    desc: "Link any reminder to another. Mark one done and the next fires automatically after a set delay. Build routines that flow on their own.",
    screenshot: "/images/remindyu/LinkedReminder.png",
  },
  {
    number: "06",
    name: "Set it Once.",
    desc: "Schedule reminders to fire once, daily, weekly, fortnightly, monthly or yearly. Set your bill payment, your trash collection, your habit. remind.yu handles the rest.",
    screenshot: "/images/remindyu/TimedReminder.png",
  },
  {
    number: "07",
    name: "Alarm or Notification.",
    desc: "A full-screen alarm that requires dismissal. No missing it. Or a quiet notification for reminders that don't need to interrupt. The right signal for every reminder.",
    screenshot: "/images/remindyu/AlarmReminder.png",
  },
  {
    number: "08",
    name: "Yours, Entirely.",
    desc: "Every reminder gets its own icon and colour. At a glance, your Morning Coffee gets a coffee icon and colour, your Evening Walk features your best friend. Your list, instantly readable.",
    screenshot: "/images/remindyu/ReminderList.png",
  },
];

export default function RemindYu() {
  const [isMobile, setIsMobile] = useState(
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  );
  const [blobScale, setBlobScale] = useState(1);
  const [showAppName, setShowAppName] = useState(false);

  /* ── Animation refs (imperative — avoid per-frame re-renders) ── */
  const ditherWaveColorRef = useRef([-80, -80, -80]);
  const innerBgRef = useRef(null);
  const logoWrapRef = useRef(null);
  const taglineRef = useRef(null);
  const badgeWrapRef = useRef(null);
  const scrollCueRef = useRef(null);

  /* ── Dither-fill canvas for store badge ── */
  const badgeCanvasRef = useRef(null);
  const ditherRef = useRef({ progress: 0, target: 0, raf: null });

  const drawBadgeDither = () => {
    const canvas = badgeCanvasRef.current;
    const s = ditherRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    s.progress += (s.target - s.progress) * 0.12;
    if (Math.abs(s.progress - s.target) < 0.01) s.progress = s.target;

    const dpr = window.devicePixelRatio || 1;
    const pxSize = Math.round(2 * dpr);
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (s.progress > 0.005) {
      const cols = Math.ceil(w / pxSize);
      const rows = Math.ceil(h / pxSize);
      const threshold = s.progress * 64;
      ctx.fillStyle = '#ffffff';
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (threshold > BAYER8[r % 8][c % 8]) {
            ctx.fillRect(c * pxSize, r * pxSize, pxSize, pxSize);
          }
        }
      }
    }

    if (Math.abs(s.progress - s.target) > 0.005) {
      s.raf = requestAnimationFrame(drawBadgeDither);
    } else {
      s.raf = null;
    }
  };

  const handleBadgeEnter = () => {
    const canvas = badgeCanvasRef.current;
    if (canvas) {
      const rect = canvas.parentElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    }
    ditherRef.current.target = 1;
    if (!ditherRef.current.raf) {
      ditherRef.current.raf = requestAnimationFrame(drawBadgeDither);
    }
  };

  const handleBadgeLeave = () => {
    ditherRef.current.target = 0;
    if (!ditherRef.current.raf) {
      ditherRef.current.raf = requestAnimationFrame(drawBadgeDither);
    }
  };

  useEffect(() => {
    return () => {
      if (ditherRef.current.raf) cancelAnimationFrame(ditherRef.current.raf);
    };
  }, []);

  useEffect(() => {
    const totalMs  = 9300;
    const riseMs   = 3000; // ease-in-out: -80 → 0.6
    const revealMs = 3300; // when circle/text appear (300ms pre-reveal hold at peak)
    const holdMs   = 1000; // hold at peak after reveal
    const fallMs   = 5000; // ease-out: 0.6 → -0.1
    const start = -80;
    const peak  =  0.6;
    const final = -0.1;
    const t0 = performance.now();
    let rafId;

    // showAppName triggers a single React render at the reveal milestone
    const revealTimer = setTimeout(() => setShowAppName(true), revealMs);

    const animate = (now) => {
      const elapsed = Math.min(now - t0, totalMs);

      let waveVal;
      if (elapsed <= riseMs) {
        // Ease-in-out cubic: -80 → 0.6
        const t = elapsed / riseMs;
        const eased = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;
        waveVal = start + (peak - start) * eased;
      } else if (elapsed <= revealMs + holdMs) {
        // Hold at peak (pre-reveal + post-reveal)
        waveVal = peak;
      } else {
        // Ease-out quintic: 0.6 → -0.1
        const t = (elapsed - revealMs - holdMs) / fallMs;
        waveVal = peak + (final - peak) * (1 - Math.pow(1 - t, 5));
      }

      // Update shader color via ref — no React re-render
      ditherWaveColorRef.current = [waveVal, waveVal, waveVal];

      // Imperatively update DOM opacities
      const innerOpacity = elapsed >= revealMs ? 1 : 0;
      if (innerBgRef.current) innerBgRef.current.style.opacity = innerOpacity;

      const heroFadeOpacity = Math.min(1, Math.max(0, (elapsed - revealMs) / 1000));
      if (logoWrapRef.current)  logoWrapRef.current.style.opacity  = heroFadeOpacity;
      if (taglineRef.current)   taglineRef.current.style.opacity   = heroFadeOpacity;
      if (badgeWrapRef.current) badgeWrapRef.current.style.opacity = heroFadeOpacity;
      if (scrollCueRef.current) scrollCueRef.current.style.opacity = heroFadeOpacity;

      if (elapsed < totalMs) rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(revealTimer);
    };
  }, []);

  useEffect(() => {
    const updateScale = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      setIsMobile(width <= 768);

      const minHeight = 600;
      const maxHeight = 2160;
      const minScale = 0.2;
      const maxScale = 1.0;

      if (height <= minHeight) {
        setBlobScale(minScale);
      } else if (height >= maxHeight) {
        setBlobScale(maxScale);
      } else {
        const scale =
          minScale +
          ((height - minHeight) / (maxHeight - minHeight)) * (maxScale - minScale);
        setBlobScale(scale);
      }
    };

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  useEffect(() => {
    document.title = "remind.yu";

    const favicon = document.querySelector("link[rel~='icon']");
    const originalHref = favicon?.getAttribute("href");
    if (favicon) favicon.href = "/images/remindyu/remindyu-icon.svg";

    window.scrollTo(0, 0);

    const root = document.getElementById("root");
    const body = document.body;
    const html = document.documentElement;

    if (root) root.style.overflow = "visible";
    if (body) body.style.overflow = "visible";
    if (html) html.style.overflow = "visible";
    if (body) body.style.background = "#121212";
    if (html) html.style.background = "#121212";

    return () => {
      document.title = "The Yuniverse.";
      if (favicon && originalHref) favicon.href = originalHref;
      if (root) root.style.overflow = "";
      if (body) body.style.overflow = "";
      if (html) html.style.overflow = "";
      if (body) body.style.background = "";
      if (html) html.style.background = "";
    };
  }, []);

  const baseSizes = isMobile
    ? [900, 675, 450, 270]
    : [800, 550, 400, 280, 120];
  const scaledSizes = baseSizes.map((size) => Math.round(size * blobScale));
  const scaledBlur = Math.round((isMobile ? 65 : 82) * blobScale);

  return (
    <div className="remindyu-container">
      {/* Cursor blob — same parameters as privacy page */}
      <BlobCursorDither
        trailCount={isMobile ? 4 : 5}
        sizes={scaledSizes}
        opacities={
          isMobile ? [1, 0.85, 0.5, 0.35] : [1, 0.9, 0.55, 0.4, 0.3]
        }
        blurPx={scaledBlur}
        threshold={0.28}
        color="#dddddd"
        hashColor="#dddddd"
        pixelSize={2}
        whiteCutoff={0.7}
        thresholdShift={-0.4}
        mode="normal"
        zIndex={50}
      />

      {/* ── Hero ── */}
      <section className="remindyu-hero">
        {/* Logo */}
        <div ref={logoWrapRef} style={{ opacity: 0 }}>
          <YuniverseLogoHeader />
        </div>

        {/* Circular dither animation */}
        <div className="remindyu-dither-circle" aria-hidden="true">
          <Dither
            waveColor={[-80, -80, -80]}
            waveColorRef={ditherWaveColorRef}
            colorNum={8}
            waveAmplitude={0.3}
            waveFrequency={0.8}
            waveSpeed={0.04}
            enableMouseInteraction={false}
            pixelSize={5}
            blackLevel={1.5 / 255}
            clearColor="#121212"
          />
          <div className="remindyu-dither-inner-circle">
            <div ref={innerBgRef} className="remindyu-dither-inner-bg" style={{ opacity: 0 }} />
            <svg className="remindyu-inner-logo" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 314.59 377.53" fill="#121212">
              <path d="M278.03,221.41l5.83-84.49-41.61-75.24-52.3-21.2V14.97l-14.97-14.97h-35.39l-14.97,14.97v25.52l-52.3,21.2-41.61,75.24,5.83,84.49L0,262.72l15.17,56.86h284.26l15.17-56.86-36.55-41.31ZM166.44,35.59h-18.29v-6.68l3.9-3.9h10.5l3.9,3.9v6.68Z"/>
              <polygon points="117.54 329.77 120.02 358.53 140.37 377.53 174.22 377.53 194.57 358.53 197.04 329.77 117.54 329.77"/>
            </svg>
          </div>
        </div>

        {/* App name + tagline */}
        <div className="remindyu-hero-text">
          {showAppName ? (
            <SplitText
              text="remind.yu"
              className="remindyu-app-name"
              tag="h1"
              splitType="chars"
              from={{ opacity: 0, y: 20 }}
              to={{ opacity: 1, y: 0 }}
              duration={1.25}
              delay={100}
              ease="power3.out"
              textAlign="center"
            />
          ) : (
            <h1 className="remindyu-app-name" style={{ visibility: "hidden" }}>remind.yu</h1>
          )}
          <p ref={taglineRef} className="remindyu-tagline" style={{ opacity: 0 }}>
            Private by default. Unignorable by design.
          </p>
          {/* Play Store badge — brutalist */}
          <a
            ref={badgeWrapRef}
            className="remindyu-store-badge"
            href="https://play.google.com/store/apps/details?id=com.yuniverse.remindyu&pcampaignid=yuniverse_website"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Get remind.yu on Google Play"
            style={{ opacity: 0 }}
            onMouseEnter={handleBadgeEnter}
            onMouseLeave={handleBadgeLeave}
          >
            <canvas className="remindyu-store-badge__fill" ref={badgeCanvasRef} aria-hidden="true" />
            <span className="remindyu-store-badge__label">
              <svg
                className="remindyu-store-badge__icon"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M3.18 23.76c.31.17.67.19 1 .07l12.55-7.25L13.9 13.7 3.18 23.76zM.54 2.03C.2 2.38 0 2.93 0 3.66v16.68c0 .73.2 1.28.54 1.63l.09.08 9.35-9.35v-.22L.63 1.95l-.09.08zM20.08 10.44l-2.64-1.53-2.93 2.93 2.93 2.93 2.66-1.54c.76-.44.76-1.35-.02-1.79zM3.18.24l13.26 7.67-2.54 2.54L3.18.24z"/>
              </svg>
              Google Play
            </span>
            <span className="remindyu-store-badge__arrow" aria-hidden="true">↗</span>
          </a>
          {/* Scroll cue — inside hero-text so it sits below badge without overlapping */}
          <div ref={scrollCueRef} className="remindyu-scroll-cue" aria-hidden="true" style={{ opacity: 0 }}>
            <div className="remindyu-scroll-cue__line" />
            <span className="remindyu-scroll-cue__label">scroll</span>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="remindyu-features" aria-label="Features">
        {FEATURES.map((f) => (
          <article className="remindyu-feature" key={f.number}>
            <div className="remindyu-feature__meta">
              <span className="remindyu-feature__number" aria-hidden="true">
                {f.number}
              </span>
              <h2 className="remindyu-feature__name">{f.name}</h2>
              <p className="remindyu-feature__desc">{f.desc}</p>
            </div>
            <div className="remindyu-feature__visual" aria-hidden="true">
              <img
                src={f.screenshot}
                alt=""
                className="remindyu-feature__screenshot"
              />
            </div>
          </article>
        ))}
      </section>

      {/* ── Privacy callout ── */}
      <section className="remindyu-privacy-callout">
        <p className="remindyu-privacy-callout__eyebrow">Revolves around you</p>
        <h2 className="remindyu-privacy-callout__heading">
          Your data stays yours.
        </h2>
        <p className="remindyu-privacy-callout__body">
          We don't collect, store, or transmit any information about your
          reminders by default. On-device only. No cloud. No tracking. No internet permission.
        </p>
        <a className="remindyu-privacy-callout__link" href="/remind.yu/privacy">
          Read the Privacy Policy
        </a>
      </section>

      {/* ── Footer ── */}
      <footer className="remindyu-footer">
        <p className="remindyu-footer__copy">
          © 2026 Yuniverse Australia. All rights reserved.
        </p>
        <nav className="remindyu-footer__links" aria-label="Footer">
          <a className="remindyu-footer__link" href="/remind.yu/privacy">
            Privacy Policy
          </a>
          <span className="remindyu-footer__sep" aria-hidden="true">|</span>
          <a className="remindyu-footer__link" href="/remind.yu/terms">
            Terms of Use
          </a>
        </nav>
      </footer>
    </div>
  );
}
