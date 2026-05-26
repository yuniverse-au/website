import { useEffect, useRef, useState } from "react";
import "./SocialLinks.css";

// The handle is always "yuniverse" + separator + "au". Only the separator
// differs between platforms — twitter uses an underscore, the rest a period —
// so we morph that single glyph rather than retyping the whole handle.
const SOCIALS = [
  { id: "twitter",   label: "Twitter / X", url: "https://x.com/yuniverse_au",            sep: "underscore" },
  { id: "instagram", label: "Instagram",   url: "https://instagram.com/yuniverse.au",    sep: "period" },
  { id: "bluesky",   label: "Bluesky",     url: "https://bsky.app/profile/yuniverse.au", sep: "period" },
];

const ROTATE_MS = 3800;
const WHEEL_LOCK_MS = 380;

// Each glyph fills its 24x24 viewBox differently, so `scale` optically
// normalises them to a matching footprint. Tweak these if one looks off.
const ICONS = {
  twitter: {
    scale: 1.0,
    path: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
  },
  instagram: {
    scale: 0.8,
    path: "M12 2.16c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.66 4.77-4.92 4.92-1.27.06-1.64.07-4.85.07s-3.58-.01-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85C2.38 3.92 3.9 2.38 7.15 2.23 8.42 2.17 8.8 2.16 12 2.16zM12 0C8.74 0 8.33.01 7.05.07 2.7.27.27 2.69.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.2 4.36 2.62 6.78 6.98 6.98C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c4.35-.2 6.78-2.62 6.98-6.98.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.2-4.35-2.62-6.78-6.98-6.98C15.67.01 15.26 0 12 0zm0 5.84a6.16 6.16 0 100 12.32 6.16 6.16 0 000-12.32zM12 16a4 4 0 110-8 4 4 0 010 8zm6.41-10.85a1.44 1.44 0 100 2.88 1.44 1.44 0 000-2.88z",
  },
  bluesky: {
    scale: 1.02,
    path: "M5.77 3.13c2.78 2.09 5.77 6.32 6.87 8.59 1.1-2.27 4.09-6.5 6.87-8.59 2.01-1.51 5.27-2.68 5.27 1.04 0 .74-.43 6.24-.68 7.13-.86 3.1-4.02 3.9-6.83 3.42 4.91.84 6.16 3.6 3.47 6.37-5.12 5.25-7.35-1.32-7.92-3.01-.1-.31-.15-.45-.15-.32 0-.13-.05.01-.15.32-.57 1.69-2.8 8.26-7.92 3.01-2.69-2.76-1.44-5.53 3.47-6.37-2.81.48-5.97-.32-6.83-3.42C.76 10.4.33 4.9.33 4.16c0-3.72 3.26-2.55 5.27-1.04z",
  },
};

function Icon({ id }) {
  const { path, scale } = ICONS[id];
  return (
    <svg
      className="social-links__icon"
      style={{ "--icon-scale": scale }}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

const N = SOCIALS.length;
// Render three copies stacked end-to-end so the track can scroll in either
// direction without ever exposing an edge — we ride the middle copy and snap
// back into it (sans-animation) whenever the step counter drifts off.
const COPIES = 3;
const TRACK = Array.from({ length: COPIES * N }, (_, i) => SOCIALS[i % N]);

export default function SocialLinks() {
  // `step` is a free-running counter; the visible social is step mod N. We
  // start in the middle copy so step can grow or shrink before we need to snap.
  const [step, setStep] = useState(N);
  const [animate, setAnimate] = useState(true);
  const linkRef = useRef(null);
  const wheelLockRef = useRef(false);

  // Auto-rotate, but skip ticks while the cursor is actually over the handle
  // box itself (not the whole row's bounding area). We check `:hover` directly
  // each tick rather than tracking a paused flag, because mouseenter/leave can
  // desync (e.g. when visibility flips mid-hover) and strand it.
  useEffect(() => {
    const id = setInterval(() => {
      if (linkRef.current?.matches(":hover")) return;
      setStep((s) => s + 1);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, []);

  // Wheel-to-nav, bound to the handle box itself via a native non-passive
  // listener so preventDefault actually sticks.
  useEffect(() => {
    const node = linkRef.current;
    if (!node) return;
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) < 2 && Math.abs(e.deltaX) < 2) return;
      e.preventDefault();
      if (wheelLockRef.current) return;
      const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      wheelLockRef.current = true;
      setStep((s) => s + (delta > 0 ? 1 : -1));
      window.setTimeout(() => { wheelLockRef.current = false; }, WHEEL_LOCK_MS);
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, []);

  // After each slide settles, if we've drifted out of the middle copy, snap
  // back into it with the transition disabled so the jump is invisible.
  const handleTransitionEnd = () => {
    if (step >= 2 * N || step < N) {
      const wrapped = ((step % N) + N) % N + N;
      setAnimate(false);
      setStep(wrapped);
    }
  };

  // Re-enable the transition on the next frame after a snap.
  useEffect(() => {
    if (animate) return;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setAnimate(true));
    });
    return () => cancelAnimationFrame(id);
  }, [animate]);

  const activeIndex = ((step % N) + N) % N;
  const social = SOCIALS[activeIndex];

  return (
    <div className="social-links">
      <a
        ref={linkRef}
        className={`social-links__a social-links__a--${social.sep}`}
        href={social.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${social.label}: yuniverse${social.sep === "underscore" ? "_" : "."}au`}
      >
        <span className="social-links__icons">
          <span
            className="social-links__icons-track"
            style={{
              transform: `translateY(${-step * 1.05}em)`,
              transition: animate ? undefined : "none",
            }}
            onTransitionEnd={handleTransitionEnd}
          >
            {TRACK.map((s, i) => (
              <span className="social-links__icons-cell" key={i}>
                <Icon id={s.id} />
              </span>
            ))}
          </span>
        </span>
        <span className="social-links__handle">
          yuniverse
          <span className="social-links__sep" aria-hidden="true" />
          <span className="social-links__tail">au</span>
        </span>
      </a>
    </div>
  );
}
