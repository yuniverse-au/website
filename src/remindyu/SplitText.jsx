import { useRef, useEffect, useState } from 'react';
import { gsap } from 'gsap';
import { SplitText as GSAPSplitText } from 'gsap/SplitText';

gsap.registerPlugin(GSAPSplitText);

const SplitText = ({
  text,
  className = '',
  delay = 50,
  duration = 1.25,
  ease = 'power3.out',
  splitType = 'chars',
  from = { opacity: 0, y: 40 },
  to = { opacity: 1, y: 0 },
  textAlign = 'center',
  tag = 'p',
  onLetterAnimationComplete,
}) => {
  const ref = useRef(null);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    if (document.fonts.status === 'loaded') {
      setFontsLoaded(true);
    } else {
      document.fonts.ready.then(() => setFontsLoaded(true));
    }
  }, []);

  useEffect(() => {
    if (!ref.current || !fontsLoaded) return;
    const el = ref.current;

    const split = new GSAPSplitText(el, { type: splitType });
    const targets =
      (splitType.includes('chars') && split.chars?.length && split.chars) ||
      (splitType.includes('words') && split.words?.length && split.words) ||
      (splitType.includes('lines') && split.lines?.length && split.lines) ||
      split.chars || split.words || split.lines;

    const tween = gsap.fromTo(targets, { ...from }, {
      ...to,
      duration,
      ease,
      stagger: delay / 1000,
      willChange: 'transform, opacity',
      force3D: true,
      onComplete: () => onLetterAnimationComplete?.(),
    });

    return () => {
      tween.kill();
      try { split.revert(); } catch (_) {}
    };
  }, [fontsLoaded]);

  const Tag = tag || 'p';
  return (
    <Tag
      ref={ref}
      className={`split-parent ${className}`}
      style={{
        textAlign,
        overflow: 'hidden',
        display: 'block',
        whiteSpace: 'normal',
        wordWrap: 'break-word',
        willChange: 'transform, opacity',
      }}
    >
      {text}
    </Tag>
  );
};

export default SplitText;
