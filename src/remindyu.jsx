import { useEffect, useState } from "react";
import BlobCursorDither from "./BlobCursorDither";
import Dither from "./Dither";
import LogoSvg from "./LogoSvg";
import "./RemindYu.css";

const FEATURES = [
  {
    number: "01",
    name: "Nagging.",
    desc: "Set a repeat interval on any reminder. If you haven't marked it done, remind.yu will keep notifying you at that interval. No snooze, no excuses. You decide when it stops.",
  },
  {
    number: "02",
    name: "High Granularity.",
    desc: "Your schedule isn't just clock times. Anchor reminders to meals: before, during or after, or set them by an exact time of day. Every reminder is as precise as your life actually is.",
  },
  {
    number: "03",
    name: "Linked Reminders.",
    desc: "Chain reminders into full routines. Finish one task and automatically trigger the next, like a 30-minute cooldown before your next reminder fires. Build sequences that match how you actually work.",
  },
  {
    number: "04",
    name: "Alarm or Notification.",
    desc: "Choose per reminder: a hard alarm that demands attention, or a quiet notification that stays out of your way. The right interruption level for every moment.",
  },
  {
    number: "05",
    name: "Yours, Entirely.",
    desc: "Assign your own icons and colour palettes to every reminder. Your dashboard, your visual language, making it faster to recognise what matters at a glance.",
  },
  {
    number: "06",
    name: "Dashboard.",
    desc: "A calendar view that shows all your upcoming, active and past reminders in one place. With everything laid out clearly, always.",
  },
];

export default function RemindYu() {
  const [isMobile, setIsMobile] = useState(
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  );
  const [blobScale, setBlobScale] = useState(1);

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
    document.title = "remind.yu: never forget again.";

    window.scrollTo(0, 0);

    const root = document.getElementById("root");
    const body = document.body;
    const html = document.documentElement;

    if (root) root.style.overflow = "visible";
    if (body) body.style.overflow = "visible";
    if (html) html.style.overflow = "visible";

    return () => {
      document.title = "The Yuniverse.";
      if (root) root.style.overflow = "";
      if (body) body.style.overflow = "";
      if (html) html.style.overflow = "";
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
        color="#cbcbcb"
        hashColor="#cbcbcb"
        pixelSize={2}
        whiteCutoff={0.7}
        thresholdShift={-0.4}
        mode="normal"
        zIndex={2}
      />

      {/* ── Hero ── */}
      <section className="remindyu-hero">
        {/* Logo — dual-layer treatment identical to home page */}
        <a href="/" className="remindyu-logo-link" aria-label="The Yuniverse - home">
          <LogoSvg
            className="remindyu-logo-diff"
            ariaHidden
          />
          <LogoSvg
            className="remindyu-logo-solid"
            ariaHidden
          />
        </a>

        {/* Circular dither animation */}
        <div className="remindyu-dither-circle" aria-hidden="true">
          <Dither
            waveColor={isMobile ? [0.3, 0.3, 0.3] : [0.2, 0.2, 0.2]}
            colorNum={8}
            waveAmplitude={0.3}
            waveFrequency={0.8}
            waveSpeed={0.04}
            enableMouseInteraction={false}
          />
        </div>

        {/* App name + tagline */}
        <div className="remindyu-hero-text">
          <h1 className="remindyu-app-name">remind.yu</h1>
          <p className="remindyu-tagline">
            the reminder app that actually reminds you.
          </p>
          {/* Play Store badge placeholder */}
          <div className="remindyu-store-badge" aria-label="Available on Google Play - coming soon">
            <svg
              className="remindyu-store-badge__icon"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M3.18 23.76c.31.17.67.19 1 .07l12.55-7.25L13.9 13.7 3.18 23.76zM.54 2.03C.2 2.38 0 2.93 0 3.66v16.68c0 .73.2 1.28.54 1.63l.09.08 9.35-9.35v-.22L.63 1.95l-.09.08zM20.08 10.44l-2.64-1.53-2.93 2.93 2.93 2.93 2.66-1.54c.76-.44.76-1.35-.02-1.79zM3.18.24l13.26 7.67-2.54 2.54L3.18.24z"/>
            </svg>
            Google Play - coming soon
          </div>
          {/* Scroll cue — inside hero-text so it sits below badge without overlapping */}
          <div className="remindyu-scroll-cue" aria-hidden="true">
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
              <div className="remindyu-screenshot-placeholder">
                {/* Screenshot icon */}
                <svg
                  className="remindyu-screenshot-placeholder__icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="5" y="2" width="14" height="20" rx="2" />
                  <circle cx="12" cy="19" r="0.5" fill="currentColor" />
                </svg>
                screenshot coming soon
              </div>
            </div>
          </article>
        ))}
      </section>

      {/* ── Privacy callout ── */}
      <section className="remindyu-privacy-callout">
        <p className="remindyu-privacy-callout__eyebrow">Revolves around you</p>
        <h2 className="remindyu-privacy-callout__heading">
          private by default.
        </h2>
        <p className="remindyu-privacy-callout__body">
          We don't collect, store, or transmit any information about your
          reminders. Your data lives on your device. Only your device.
          remind.yu doesn't even request Internet permission.
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
