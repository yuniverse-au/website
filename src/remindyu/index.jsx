import { useEffect, useRef, useState } from "react";
import Dither from "../Dither";
import YuniverseLogoHeader from "../YuniverseLogoHeader";
import SplitText from "./SplitText";
import "./RemindYu.css";

const PLAY_URL =
  "https://play.google.com/store/apps/details?id=au.yuniverse.remindyu&pcampaignid=yuniverse_website";

/* Floating "nag" bubbles — phrased to match the actual behaviour:
   the same reminder repeats at a set interval, and unfinished ones
   from previous days stack onto today until cleared. */
const NAGS = [
  { text: "the same reminder. again.",         x: "6%",  y: "10%", rot: -3 },
  { text: "and again, in 5 minutes.",          x: "74%", y: "16%", rot: 3  },
  { text: "unfinished from yesterday.",        x: "2%",  y: "60%", rot: 2  },
  { text: "missed it 5 days in a row.",         x: "76%", y: "66%", rot: -2 },
  { text: "tap done to stop the loop.",        x: "58%", y: "92%", rot: 2  },
];

const WHY = [
  ["a reminder app", "fires once and forgets."],
  ["remind.yu",      "repeats until you mark it done."],
  ["a reminder app", "drops what you ignored yesterday."],
  ["remind.yu",      "stacks it onto today."],
  ["a reminder app", "knows clock times."],
  ["remind.yu",      "knows before breakfast, after dinner, and 30-minutes after you've done your ."],
];

const SHOTS = [
  { src: "/images/remindyu/Dashboard.png",              caption: "your month, at a glance." },
  { src: "/images/remindyu/RemindersForTheDay.png",     caption: "the day, all in order." },
  { src: "/images/remindyu/ReminderList.png",           caption: "every reminder, your icon, your colour." },
  { src: "/images/remindyu/PriorityPresetsNagging.png", caption: "high, medium, low. you decide how it'll nag you." },
  { src: "/images/remindyu/BeforeBreakfastReminder.png", caption: "before breakfast."},
  { src: "/images/remindyu/LinkedReminder.png",         caption: "one done. the next fires." },
  { src: "/images/remindyu/TimedReminder.png",          caption: "once. daily. weekly. fortnightly. monthly. yearly. set once and repeat." },
  { src: "/images/remindyu/AlarmReminder.png",          caption: "full screen alarms." },
];

function PhoneMockup({ src, alt = "" }) {
  return (
    <div className="rmy-phone" aria-hidden={alt ? undefined : true}>
      <img className="rmy-phone__screen" src={src} alt={alt} />
    </div>
  );
}

export default function RemindYu() {
  const [showWordmark, setShowWordmark] = useState(false);
  const [ditherMounted, setDitherMounted] = useState(false);
  const [ditherCovered, setDitherCovered] = useState(true);

  /* Dither animation values — driven from rAF by the intro timeline.
     Match the home page's resting "dark theme" dither pattern at rest. */
  const REST_COLOR_NUM       = 6;
  const REST_CONTRAST        = 1;
  const REST_BLACK_LEVEL     = 0.554;     // linear value that sRGB-encodes to #c4c4c4 — matches --rmy-bg on screen
  const REST_WHITE_LEVEL     = 0.0097;
  const HIGH_COLOR_NUM       = 16;        // colorNum target for the shrink phase — drives the shader's highEndWash so localCut saturates to 0 and all pixels resolve to whiteLevel
  const [animatedColorNum, setAnimatedColorNum] = useState(0);
  const [animatedContrast, setAnimatedContrast] = useState(0);
  const [animatedBlackLevel] = useState(REST_BLACK_LEVEL);
  const [animatedWhiteLevel] = useState(REST_WHITE_LEVEL);
  const introSettledRef = useRef(false);

  const innerBgRef         = useRef(null);
  const captionRef         = useRef(null);
  const ledeRef            = useRef(null);
  const subRef             = useRef(null);
  const ctaRef             = useRef(null);
  const stageRef           = useRef(null);

  useEffect(() => {
    /* ── Timeline (ms from page load) ──
       Validation pass — only the dither reveal runs, then holds at rest:
       0 ─ 1000   Dither "blooms in" — time-reversal of the old Phase B
                              (ease-out quadratic).
                              colorNum    0  → 6
                              contrast    0  → 1
                              blackLevel 0.07 → 0.554
                              whiteLevel held at rest
                  Inner circle stays hidden for this pass.
       300  ─ 2000 caption fades in
       4500 ─ 5300 caption fades out
       5300        wordmark splits in
       5800 ─ 6800 lede / sub / cta fade in
       6800 ─ 8800 stage (phone + nags) fade in
    */
    const totalMs    = 12000;
    const introStartMs    = 1000;     // 1 s hold on the initial c4c4c4 disc before the ramp begins
    const introDurationMs = 3000;     // Phase A+B — 3 s linear ramp
    const introEndMs      = introStartMs + introDurationMs;     // 4000 ms — colorNum 0 → HIGH, contrast 0 → rest
    const bloomBackEndMs  = 6000;     // Phase C — 2 s, colorNum HIGH → rest, "light" patches grow back
    const innerOnMs       = introEndMs;     // inner dark anchor circle appears when the shrink finishes
    const captionInStartMs  = 300;
    const captionInEndMs    = 1500;
    const captionOutStartMs = 2200;
    const captionOutEndMs   = 3000;
    const wordmarkAtMs      = 3000;
    const bodyInStartMs     = 3500;
    const bodyInEndMs       = 4500;
    const stageInStartMs    = 4500;
    const stageInEndMs      = 6500;

    const t0 = performance.now();
    let rafId;

    const wordmarkTimer = setTimeout(() => setShowWordmark(true), wordmarkAtMs);

    const lerp = (a, b, t) => a + (b - a) * t;
    const clamp01 = (t) => Math.max(0, Math.min(1, t));

    const animate = (now) => {
      const elapsed = Math.min(now - t0, totalMs);

      /* Phase A+B — 1.5 s idle hold, then a single linear ramp 1500 → 5000 ms.
                     colorNum 0 → HIGH, contrast 0 → rest.
         Phase C  — reverse the shrink linearly over 5000 → 7000 ms.
                     colorNum HIGH → rest, contrast pinned at rest. */
      if (elapsed <= introStartMs) {
        // hold initial state — nothing to write
      } else if (elapsed <= introEndMs) {
        const t = (elapsed - introStartMs) / introDurationMs;
        setAnimatedColorNum(lerp(0, HIGH_COLOR_NUM, t));
        setAnimatedContrast(lerp(0, REST_CONTRAST, t));
      } else if (elapsed <= bloomBackEndMs) {
        const t = (elapsed - introEndMs) / (bloomBackEndMs - introEndMs);
        setAnimatedColorNum(lerp(HIGH_COLOR_NUM, REST_COLOR_NUM, t));
        setAnimatedContrast(REST_CONTRAST);
      } else if (!introSettledRef.current) {
        introSettledRef.current = true;
        setAnimatedColorNum(REST_COLOR_NUM);
        setAnimatedContrast(REST_CONTRAST);
      }

      /* inner dark anchor circle fades in over ~300 ms once the shrink completes */
      if (innerBgRef.current) {
        const innerFadeMs = 300;
        innerBgRef.current.style.opacity = clamp01((elapsed - innerOnMs) / innerFadeMs);
      }

      /* caption: fade in, hold, fade out */
      if (captionRef.current) {
        let op;
        if (elapsed < captionInStartMs) {
          op = 0;
        } else if (elapsed < captionInEndMs) {
          op = clamp01((elapsed - captionInStartMs) / (captionInEndMs - captionInStartMs));
        } else if (elapsed < captionOutStartMs) {
          op = 1;
        } else if (elapsed < captionOutEndMs) {
          op = 1 - clamp01((elapsed - captionOutStartMs) / (captionOutEndMs - captionOutStartMs));
        } else {
          op = 0;
        }
        captionRef.current.style.opacity = op;
      }

      /* lede / sub / cta */
      const bodyOp = clamp01((elapsed - bodyInStartMs) / (bodyInEndMs - bodyInStartMs));
      if (ledeRef.current) ledeRef.current.style.opacity = bodyOp;
      if (subRef.current)  subRef.current.style.opacity  = bodyOp;
      if (ctaRef.current)  ctaRef.current.style.opacity  = bodyOp;

      /* stage (phone + nags) — slowest */
      const stageOp = clamp01((elapsed - stageInStartMs) / (stageInEndMs - stageInStartMs));
      if (stageRef.current) stageRef.current.style.opacity = stageOp;

      if (elapsed < totalMs) rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);

    /* Defer Dither mount by two frames so the page bg (#c4c4c4) paints
       before the WebGL canvas appears, then hold an overlay over the
       canvas for ~400ms so any pre-first-frame flash is hidden. */
    let mountFrame1, mountFrame2;
    mountFrame1 = requestAnimationFrame(() => {
      mountFrame2 = requestAnimationFrame(() => setDitherMounted(true));
    });
    const uncoverTimer = setTimeout(() => setDitherCovered(false), 400);

    return () => {
      cancelAnimationFrame(rafId);
      cancelAnimationFrame(mountFrame1);
      cancelAnimationFrame(mountFrame2);
      clearTimeout(wordmarkTimer);
      clearTimeout(uncoverTimer);
    };
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
    if (body) body.style.background = "#c4c4c4";
    if (html) html.style.background = "#c4c4c4";

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

  return (
    <div className="rmy">
      <YuniverseLogoHeader />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="rmy-hero">
        {/* Caption — leads into the wordmark */}
        <p
          ref={captionRef}
          className="rmy-caption"
          style={{ opacity: 0 }}
        >
          an app that's designed to&hellip;<br />
        </p>

        {/* Dither circle — small, above the wordmark */}
        <div className="rmy-dither" aria-hidden="true">
          {/* Cover that hides the WebGL canvas's pre-first-frame flash */}
          <div
            className="rmy-dither__cover"
            style={{ opacity: ditherCovered ? 1 : 0 }}
          />
          {ditherMounted && (
            <Dither
              waveColor={[0.554, 0.554, 0.554]}
              colorNum={animatedColorNum}
              waveAmplitude={0.3}
              waveFrequency={0.8}
              waveSpeed={0.04}
              enableMouseInteraction={false}
              pixelSize={2}
              blackLevel={animatedBlackLevel}
              whiteLevel={animatedWhiteLevel}
              whiteCutoff={0.2}
              contrastAmount={animatedContrast}
              clearColor="#c4c4c4"
            />
          )}
          <div className="rmy-dither__inner">
            <div ref={innerBgRef} className="rmy-dither__bg" style={{ opacity: 0 }} />
            <svg
              className="rmy-dither__logo"
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 314.59 377.53"
            >
              <path d="M278.03,221.41l5.83-84.49-41.61-75.24-52.3-21.2V14.97l-14.97-14.97h-35.39l-14.97,14.97v25.52l-52.3,21.2-41.61,75.24,5.83,84.49L0,262.72l15.17,56.86h284.26l15.17-56.86-36.55-41.31ZM166.44,35.59h-18.29v-6.68l3.9-3.9h10.5l3.9,3.9v6.68Z"/>
              <polygon points="117.54 329.77 120.02 358.53 140.37 377.53 174.22 377.53 194.57 358.53 197.04 329.77 117.54 329.77"/>
            </svg>
          </div>
        </div>

        {/* Wordmark */}
        <div className="rmy-wordmark-wrap">
          {showWordmark ? (
            <SplitText
              text="remind.yu"
              className="rmy-wordmark"
              tag="h1"
              splitType="chars"
              from={{ opacity: 0, y: 20 }}
              to={{ opacity: 1, y: 0 }}
              duration={1.1}
              delay={70}
              ease="power3.out"
              textAlign="center"
            />
          ) : (
            <h1 className="rmy-wordmark" style={{ visibility: "hidden" }}>
              remind.yu
            </h1>
          )}
        </div>

        <p ref={ledeRef} className="rmy-lede" style={{ opacity: 0 }}>
          it nags you. so you never forget.
        </p>
        <p ref={subRef} className="rmy-sub" style={{ opacity: 0 }}>
          free. private. designed to repeat itself
          until the things you said you'd do, get done.
        </p>
        <a
          ref={ctaRef}
          className="rmy-cta"
          href={PLAY_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{ opacity: 0 }}
        >
          <span>get it on google play</span>
          <span className="rmy-cta__arrow" aria-hidden="true">→</span>
        </a>
      </section>

      {/* ── What it does — phone + nags ───────────────────────── */}
      <section className="rmy-section rmy-what">
        <div className="rmy-what__copy">
          <span className="rmy-section__num">01 / what it does</span>
          <h2 className="rmy-h2">
            sets the same reminder off, again and again, until you mark it done.
          </h2>
          <p className="rmy-body">
            pick a thing to-do. pick how loud it should be. set a time, or set
            it for before breakfast. it fires. it fires again at the
            interval you chose. it doesn't stop until you tap done.
          </p>
          <p className="rmy-body rmy-body">
            skip it today, it comes back tomorrow. unfinished reminders
            from yesterday stack onto today until you clear them. nothing
            quietly disappears.
          </p>
        </div>

        <div ref={stageRef} className="rmy-what__stage" style={{ opacity: 0 }}>
          {NAGS.map((n) => (
            <span
              key={n.text}
              className="rmy-nag"
              style={{
                left: n.x,
                top:  n.y,
                transform: `rotate(${n.rot}deg)`,
              }}
            >
              <span className="rmy-nag__dot" aria-hidden="true" />
              {n.text}
            </span>
          ))}
          <PhoneMockup src="/images/remindyu/Dashboard.png" />
        </div>
      </section>

      {/* ── Why it's different ───────────────────────────────── */}
      <section className="rmy-section rmy-why">
        <span className="rmy-section__num">02 / why it's different</span>
        <h2 className="rmy-h2">most reminder apps are polite. this one isn't.</h2>
        <ul className="rmy-why__grid">
          {WHY.map(([who, what], i) => (
            <li key={i} className={`rmy-why__row${who === "remind.yu" ? " is-us" : ""}`}>
              <span className="rmy-why__who">{who}</span>
              <span className="rmy-why__line" aria-hidden="true" />
              <span className="rmy-why__what">{what}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Screenshots ──────────────────────────────────────── */}
      <section className="rmy-section rmy-shots">
        <span className="rmy-section__num">03 / what it looks like</span>
        <h2 className="rmy-h2">eight ways of saying — do the thing.</h2>
        <div className="rmy-shots__grid">
          {SHOTS.map((s) => (
            <figure className="rmy-shot" key={s.src}>
              <PhoneMockup src={s.src} />
              <figcaption className="rmy-shot__caption">{s.caption}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ── Privacy / free claim ─────────────────────────────── */}
      <section className="rmy-section rmy-privacy">
        <span className="rmy-section__num">04 / the small print, large</span>
        <h2 className="rmy-h2 rmy-privacy__h">
          free. forever. no ads. no accounts. no internet.
        </h2>
        <p className="rmy-body">
          the app does not request the internet permission, so it's
          pretty impossible for it to send out any data.
          nothing about your reminders, or data leaves the device.
        </p>
        <a className="rmy-link" href="/remind.yu/privacy">
          read the privacy policy →
        </a>
      </section>

      {/* ── Final CTA ────────────────────────────────────────── */}
      <section className="rmy-section rmy-final">
        <h2 className="rmy-final__h">
          here's your last reminder to get the app
        </h2>
        <a className="rmy-cta rmy-cta--big" href={PLAY_URL} target="_blank" rel="noopener noreferrer">
          <span>get it on google play</span>
          <span className="rmy-cta__arrow" aria-hidden="true">→</span>
        </a>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="rmy-footer">
        <p>© 2026 yuniverse australia.</p>
        <nav aria-label="Footer">
          <a href="/remind.yu/privacy">privacy</a>
          <span aria-hidden="true"> / </span>
          <a href="/remind.yu/terms">terms</a>
        </nav>
      </footer>
    </div>
  );
}
