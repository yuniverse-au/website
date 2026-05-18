import { Fragment, useEffect, useRef, useState } from "react";
import Dither from "../Dither";
import LogoSvg from "../LogoSvg";
import SplitText from "./SplitText";
import "./RemindYu.css";

const PLAY_URL =
  "https://play.google.com/store/apps/details?id=au.yuniverse.remindyu&pcampaignid=yuniverse_website";

const SHOTS = [
  { src: "/images/remindyu/Dashboard.png",             num: "01/08", cap: "your month, at a glance." },
  { src: "/images/remindyu/RemindersForTheDay.png",    num: "02/08", cap: "the day, in order." },
  { src: "/images/remindyu/ReminderList.png",          num: "03/08", cap: "your icon, your colour." },
  { src: "/images/remindyu/PriorityPresetsNagging.png", num: "04/08", cap: "high, medium, low. configure the nag." },
  { src: "/images/remindyu/BeforeBreakfastReminder.png", num: "05/08", cap: "before breakfast. after dinner. anchored to a meal." },
  { src: "/images/remindyu/LinkedReminder.png",        num: "06/08", cap: "one done. the next fires." },
  { src: "/images/remindyu/TimedReminder.png",         num: "07/08", cap: "once. daily. yearly. you choose." },
  { src: "/images/remindyu/AlarmReminder.png",         num: "08/08", cap: "full-screen alarms." },
];

const CHAIN_NODES = [
  { id: "r1", name: "wake up.",            when: "7:00 am" },
  { id: "r2", name: "morning coffee.",     when: "+ 10 min" },
  { id: "r3", name: "drink water.",        when: "+ 10 min" },
  { id: "r4", name: "check the calendar.", when: "+ 5 min" },
  { id: "r5", name: "leave for work.",     when: "+ 20 min" },
];

const PRIVACY_ROWS = [
  { label: "data uploaded",    sub: "when you knew about us",   val: "0 b" },
  { label: "servers contacted", sub: "since install",  val: "0" },
  { label: "accounts created", sub: "ever",            val: "0" },
  { label: "ads served",       sub: "per session",     val: "0" },
  { label: "cost",             sub: "forever",         val: "$0" },
];

/* ── 01: reminders pile up faster than the user can swipe.
   each fire pushes a new card onto the top of the stack; older
   cards shift down and dim. periodically the "user" rage-swipes
   the top one — but more keep coming, and the unread counter
   climbs visibly. eventually the frame is choked with cards and
   the demo holds that moment before resetting. */
function LiveNagDemo() {
  const FIRE_GAP_MS     = 850;
  const SWIPE_DURATION  = 340;
  const MAX_VISIBLE     = 4;
  const TOTAL_FIRES     = 12;
  const PRE_PRESS_MS    = 1000;   // hold the full pile, then press done
  const PRESS_HOLD_MS   = 2000;   // hold the pressed/black state before clearing
  const CLEAR_DURATION  = 520;
  const RESET_PAUSE_MS  = 1100;
  const ENTER_DELAY     = 800;

  const [list, setList]   = useState([]);    // [{ id, state }]
  const [phase, setPhase] = useState("idle"); // idle | piling | piled | prompt | pressed | clearing
  const [armed, setArmed] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!wrapRef.current) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) setArmed(true); }),
      { threshold: 0.4 }
    );
    io.observe(wrapRef.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!armed) return;
    let cancelled = false;
    let nextId = 0;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    (async () => {
      while (!cancelled) {
        setList([]);
        setPhase("idle");
        await sleep(ENTER_DELAY);
        setPhase("piling");

        for (let i = 0; i < TOTAL_FIRES; i++) {
          if (cancelled) return;
          const id = ++nextId;
          setList((prev) => [{ id, state: "in" }, ...prev].slice(0, MAX_VISIBLE));

          /* every third firing, simulate a rage-swipe — but the next
             fire arrives faster than the user can keep up. */
          if (i > 0 && i % 3 === 0) {
            await sleep(200);
            if (cancelled) return;
            setList((prev) =>
              prev.map((c, idx) => (idx === 0 ? { ...c, state: "out" } : c))
            );
            await sleep(SWIPE_DURATION);
            if (cancelled) return;
            setList((prev) => prev.filter((c) => c.state !== "out"));
          }

          await sleep(FIRE_GAP_MS);
        }

        /* finale: hold the full pile, "press" the done button (it
           inverts to black/shaded), hold the pressed state for ~2s,
           then clear every card down to empty before looping. */
        setPhase("piled");
        await sleep(PRE_PRESS_MS);
        if (cancelled) return;

        setPhase("pressed");
        await sleep(PRESS_HOLD_MS);
        if (cancelled) return;

        setPhase("clearing");
        setList((prev) => prev.map((c) => ({ ...c, state: "cleared" })));
        await sleep(CLEAR_DURATION);
        if (cancelled) return;

        setList([]);
        setPhase("idle");
        await sleep(RESET_PAUSE_MS);
      }
    })();

    return () => { cancelled = true; };
  }, [armed]);

  return (
    <div className="rmy-stack" ref={wrapRef}>
      <div className="rmy-stack__label">
        <span>notifications</span>
        <span className="now">every 1 min · set by you</span>
      </div>
      <div className="rmy-stack__list">
        {list.map((c, idx) => (
          <div
            key={c.id}
            className={`rmy-noti is-${c.state}`}
            style={
              c.state === "in"
                ? { opacity: Math.max(0.32, 1 - idx * 0.16) }
                : undefined
            }
          >
            <div className="rmy-noti__icon">rmy</div>
            <div className="rmy-noti__body">
              <p className="rmy-noti__title">water the plants.</p>
              <p className="rmy-noti__sub">medium · re-fires until done.</p>
              <p className="rmy-noti__time">
                {idx === 0 ? "now" : `${idx} min ago`}
              </p>
            </div>
            <span
              className={`rmy-noti__done${idx === 0 && phase === "pressed" ? " is-pressed" : ""}`}
              aria-hidden="true"
            >
              done
            </span>
          </div>
        ))}
      </div>
      <p className="rmy-stack__caption">
        swipes pile up. <span>only "done" stops it.</span>
      </p>
    </div>
  );
}

/* ── 02: a linked-reminder chain. each node cycles through
   waiting (pie countdown in the check circle) → firing (dark,
   vibrating) → done (checked, faded). loops on hold. */
function LinkedChainDemo() {
  const FIRING_MS    = 1500;
  const WAITING_MS   = 3000;
  const ENTER_DELAY  = 800;
  const END_HOLD_MS  = 4000;
  const RESET_GAP_MS = 900;

  const [doneIdx, setDoneIdx]       = useState(-1);
  const [firingIdx, setFiringIdx]   = useState(-1);
  const [waitingIdx, setWaitingIdx] = useState(-1);
  const [armed, setArmed]           = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!wrapRef.current) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) setArmed(true); }),
      { threshold: 0.35 }
    );
    io.observe(wrapRef.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!armed) return;
    let cancelled = false;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    (async () => {
      await sleep(ENTER_DELAY);
      while (!cancelled) {
        setDoneIdx(-1);
        setFiringIdx(-1);
        setWaitingIdx(-1);
        await sleep(400);

        for (let i = 0; i < CHAIN_NODES.length; i++) {
          if (cancelled) return;
          /* node fires — dark inverted + vibrating */
          setWaitingIdx(-1);
          setFiringIdx(i);
          await sleep(FIRING_MS);
          if (cancelled) return;
          /* mark done; the next node's pie starts counting down */
          setFiringIdx(-1);
          setDoneIdx(i);
          if (i < CHAIN_NODES.length - 1) {
            setWaitingIdx(i + 1);
            await sleep(WAITING_MS);
          }
        }

        if (cancelled) return;
        setWaitingIdx(-1);
        await sleep(END_HOLD_MS);
        if (cancelled) return;
        await sleep(RESET_GAP_MS);
      }
    })();

    return () => { cancelled = true; };
  }, [armed]);

  return (
    <div className="rmy-chain__board" ref={wrapRef}>
      {CHAIN_NODES.map((n, i) => {
        const isDone    = i <= doneIdx;
        const isFiring  = i === firingIdx;
        const isWaiting = i === waitingIdx;
        return (
          <Fragment key={n.id}>
            <div
              className={`rmy-chain__node${isDone ? " is-done" : ""}${isFiring ? " is-firing" : ""}`}
            >
              <span className="rmy-chain__handle">R{String(i + 1).padStart(2, "0")}</span>
              <span className="rmy-chain__name">{n.name}</span>
              <span className="rmy-chain__when">{n.when}</span>
              {/* key change forces a remount when waiting starts so the
                  conic-gradient pie animation restarts each cycle. */}
              <span
                key={`chk-${i}-${isWaiting ? `w-${doneIdx}` : isDone ? "d" : isFiring ? "f" : "n"}`}
                className={`rmy-chain__check${isWaiting ? " is-counting" : ""}`}
                aria-hidden="true"
              >
                {isDone && !isFiring ? "✓" : !isWaiting && !isFiring ? "·" : ""}
              </span>
            </div>
            {i < CHAIN_NODES.length - 1 && (
              <div
                className={`rmy-chain__edge${i <= doneIdx ? " is-traversed" : ""}`}
                aria-hidden="true"
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

export default function RemindYu() {
  const [showWordmark, setShowWordmark]   = useState(false);
  const [ditherMounted, setDitherMounted] = useState(false);
  const [ditherCovered, setDitherCovered] = useState(true);

  /* Dither intro animation — preserved from the prior page. Same
     resting "paper" pattern, same bloom timing. */
  const REST_COLOR_NUM   = 6;
  const REST_CONTRAST    = 1;
  const REST_BLACK_LEVEL = 0.554;
  const REST_WHITE_LEVEL = 0.0097;
  const HIGH_COLOR_NUM   = 16;

  const [animatedColorNum, setAnimatedColorNum] = useState(0);
  const [animatedContrast, setAnimatedContrast] = useState(0);
  const introSettledRef = useRef(false);

  const innerBgRef = useRef(null);
  const captionRef = useRef(null);
  const ledeRef    = useRef(null);
  const subRef     = useRef(null);
  const ctaRef     = useRef(null);
  const topbarRef  = useRef(null);
  const stageRef   = useRef(null);

  useEffect(() => {
    /* Timeline (ms from page load) — intro caption + dither bloom +
       wordmark split-in + body fade, then the rest of the page
       fades in beneath. */
    const totalMs        = 8000;
    const introStartMs   = 1000;
    const introDurationMs = 3000;
    const introEndMs     = introStartMs + introDurationMs;   // 4000
    const bloomBackEndMs = 6000;
    const innerOnMs      = introEndMs;
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

      if (elapsed <= introStartMs) {
        // hold initial state
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

      if (innerBgRef.current) {
        const innerFadeMs = 300;
        innerBgRef.current.style.opacity = clamp01((elapsed - innerOnMs) / innerFadeMs);
      }

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

      const bodyOp = clamp01((elapsed - bodyInStartMs) / (bodyInEndMs - bodyInStartMs));
      if (ledeRef.current) ledeRef.current.style.opacity = bodyOp;
      if (subRef.current)  subRef.current.style.opacity  = bodyOp;
      if (ctaRef.current)  ctaRef.current.style.opacity  = bodyOp;

      const stageOp = clamp01((elapsed - stageInStartMs) / (stageInEndMs - stageInStartMs));
      if (stageRef.current) stageRef.current.style.opacity = stageOp;
      if (topbarRef.current) {
        topbarRef.current.classList.toggle("is-in", bodyOp > 0);
      }

      if (elapsed < totalMs) rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);

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
      {/* ── Top bar ───────────────────────────────────────────── */}
      <header ref={topbarRef} className="rmy-topbar">
        <div className="rmy-topbar__mark">
          <a className="rmy-topbar__home" href="/" aria-label="yuniverse — home">
            <LogoSvg className="rmy-topbar__yuni" ariaHidden />
          </a>
          <span className="rmy-topbar__divider" aria-hidden="true">/</span>
          <a className="rmy-topbar__wordmark" href="#top">remind.yu</a>
        </div>
        <div className="rmy-topbar__right">
          <span className="rmy-topbar__live">v1.4 · live on play store</span>
          <a href="/remind.yu/privacy">privacy</a>
          <a href={PLAY_URL} target="_blank" rel="noopener noreferrer">get the app</a>
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="rmy-hero" id="top">
        <p ref={captionRef} className="rmy-caption" style={{ opacity: 0 }}>
          an app that's designed to&hellip;
        </p>

        <div className="rmy-dither" aria-hidden="true">
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
              blackLevel={REST_BLACK_LEVEL}
              whiteLevel={REST_WHITE_LEVEL}
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
              <path d="M278.03,221.41l5.83-84.49-41.61-75.24-52.3-21.2V14.97l-14.97-14.97h-35.39l-14.97,14.97v25.52l-52.3,21.2-41.61,75.24,5.83,84.49L0,262.72l15.17,56.86h284.26l15.17-56.86-36.55-41.31ZM166.44,35.59h-18.29v-6.68l3.9-3.9h10.5l3.9,3.9v6.68Z" />
              <polygon points="117.54 329.77 120.02 358.53 140.37 377.53 174.22 377.53 194.57 358.53 197.04 329.77 117.54 329.77" />
            </svg>
          </div>
        </div>

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
          free, private, on-device. designed to repeat itself
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
          <span className="rmy-cta__label">get it on google play</span>
          <span className="rmy-cta__arrow" aria-hidden="true">→</span>
        </a>
      </section>

      {/* ── Everything below the hero fades in once the intro settles ── */}
      <div ref={stageRef} style={{ opacity: 0 }}>

        {/* 01 · the nag */}
        <section className="rmy-section">
          <div className="rmy-head">
            <span className="rmy-head__title">01 · the nag</span>
            <span className="rmy-head__status is-live">live preview</span>
          </div>
          <div className="rmy-demo">
            <div className="rmy-demo__copy">
              <h2>
                fires on schedule. <em>swipes don't matter.</em>
              </h2>
              <p className="rmy-body">
                you pick the interval — every minute, every hour, every day.
                it fires on that schedule, full stop. swipe it away and you'll
                get the same notification at the next tick. snooze doesn't
                exist here.
              </p>
              <p className="rmy-body">
                the only way out is to tap done. until then,
                it keeps coming back at exactly the rate you asked for.
              </p>
            </div>
            <LiveNagDemo />
          </div>
        </section>

        {/* 02 · linked reminders */}
        <section className="rmy-section">
          <div className="rmy-head">
            <span className="rmy-head__title">02 · linked reminders</span>
            <span className="rmy-head__status is-live">live preview</span>
          </div>
          <div className="rmy-chain">
            <div className="rmy-chain__copy">
              <h2>one done. the next fires.</h2>
              <p className="rmy-body">
                a reminder can be linked to another — firing a
                set number of minutes before, during, or after the first is
                marked done. routines, without the spreadsheet.
              </p>
              <p className="rmy-body">
                wake up. coffee. water. calendar. leave. each one nudges the
                next into the queue.
              </p>
            </div>
            <LinkedChainDemo />
          </div>
        </section>

        {/* 03 · privacy meter */}
        <section className="rmy-section" id="privacy">
          <div className="rmy-head">
            <span className="rmy-head__title">03 · privacy, by metric</span>
            <span>tx · 0 bytes</span>
          </div>
          <div className="rmy-priv">
            <div className="rmy-priv__copy">
              <h2>the data your phone sends about your reminders. all of it.</h2>
              <p className="rmy-body">
                remind.yu does not request the internet permission. it is
                technically incapable of sending data anywhere — no analytics,
                no telemetry, no ad ids.
              </p>
              <a className="rmy-cta" href="/remind.yu/privacy" style={{ marginTop: "1rem" }}>
                <span className="rmy-cta__label">read the privacy policy</span>
                <span className="rmy-cta__arrow" aria-hidden="true">→</span>
              </a>
            </div>
            <div className="rmy-meters">
              {PRIVACY_ROWS.map((row) => (
                <div key={row.label} className="rmy-mrow">
                  <span className="rmy-mrow__name">
                    <strong>{row.label}</strong>{row.sub}
                  </span>
                  <span className="rmy-mrow__val">{row.val}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 04 · screenshots, horizontal scroll */}
        <section className="rmy-section">
          <div className="rmy-head">
            <span className="rmy-head__title">04 · the app · scroll →</span>
            <span>{SHOTS.length} frames</span>
          </div>
          <h2 className="rmy-h2" style={{ maxWidth: "22ch" }}>
            eight ways of saying — do the thing.
          </h2>
          <div className="rmy-shots">
            {SHOTS.map((s) => (
              <figure className="rmy-shots__cell" key={s.num}>
                <div className="rmy-phone">
                  <img className="rmy-phone__screen" src={s.src} alt="" />
                </div>
                <div className="rmy-shots__meta">
                  <span>{s.num}</span>
                  <span>· · ·</span>
                </div>
                <p className="rmy-shots__cap">{s.cap}</p>
              </figure>
            ))}
          </div>
        </section>

        {/* 05 · final CTA */}
        <section className="rmy-section" id="get">
          <div className="rmy-head">
            <span className="rmy-head__title">05 · get the app</span>
            <span>android 9+ · ~5 mb</span>
          </div>
          <div className="rmy-final">
            <h2 className="rmy-final__h">
              here's your last reminder to get the app.
            </h2>
            <div>
              <a
                className="rmy-cta rmy-cta--big"
                href={PLAY_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="rmy-cta__label">get it on google play</span>
                <span className="rmy-cta__arrow" aria-hidden="true">→</span>
              </a>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="rmy-footer">
          <span>© 2026 yuniverse australia</span>
          <span>revolves around you.</span>
          <span>
            <a href="/remind.yu/privacy">privacy</a>
            &nbsp;/&nbsp;
            <a href="/remind.yu/terms">terms</a>
          </span>
        </footer>

      </div>
    </div>
  );
}
