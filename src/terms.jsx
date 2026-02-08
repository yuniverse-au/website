
import { useEffect, useState } from "react";
import BlobCursorDither from "./BlobCursorDither";
import "./Privacy.css";

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

export default function Terms() {
  const [isMobile] = useState(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
  const [logoSize] = useState(isMobile ? "70vw" : "40vw");
  const [blobScale, setBlobScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      const height = window.innerHeight;
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

  useEffect(() => {
    document.title = 'Terms of Use - remind.yu';
    window.scrollTo(0, 0);
    const root = document.getElementById('root');
    const body = document.body;
    const html = document.documentElement;
    if (root) root.style.overflow = 'visible';
    if (body) body.style.overflow = 'visible';
    if (html) html.style.overflow = 'visible';
    return () => {
      document.title = 'The Yuniverse';
      if (root) root.style.overflow = '';
      if (body) body.style.overflow = '';
      if (html) html.style.overflow = '';
    };
  }, []);

  return (
    <div className="privacy-container">
      <BlobCursorDither
        trailCount={isMobile ? 4 : 5}
        sizes={scaledSizes}
        opacities={isMobile ? [1, 0.85, 0.5, 0.35] : [1, 0.9, 0.55, 0.4, 0.3]}
        blurPx={scaledBlur}
        threshold={0.28}
        color="#000000"
        logoMagnetism={true}
        logoMagnetismSelector=".privacy-logo"
        hashColor="#000000"
        pixelSize={2}
        whiteCutoff={0.7}
        thresholdShift={-0.4}
        mode="normal"
        zIndex={1}
      />

      <a href="/" className="privacy-logo-link">
        <LogoSvg
          id="privacy-logo"
          className="privacy-logo"
          style={{ width: logoSize }}
          ariaLabel="The Yuniverse"
        />
      </a>

      <div className="privacy-content">
        <h1 className="privacy-title">Terms of Use - remind.yu (Android)</h1>
        <div className="privacy-section">
          <div className="privacy-permission-block" style={{marginBottom: '1.2em'}}>
            <div className="privacy-permission-title"><strong>Effective date</strong></div>
            <div className="privacy-permission-desc">8th February 2026</div>
          </div>
          <div className="privacy-permission-block" style={{marginBottom: '1.2em'}}>
            <div className="privacy-permission-title"><strong>Developer</strong></div>
            <div className="privacy-permission-desc">Yuniverse Australia (“we”, “us”, “our”)</div>
          </div>
          <div className="privacy-permission-block">
            <div className="privacy-permission-title"><strong>Contact</strong></div>
            <div className="privacy-permission-desc"><a href="mailto:support@yuniverse.au">support@yuniverse.au</a></div>
          </div>
        </div>
        <div className="privacy-section">
          <p>By downloading, installing, accessing, or using remind.yu (the “App”), you agree to these Terms of Use (the “Terms”). If you do not agree, do not use the App.</p>
        </div>
        <div className="privacy-section">
          <h2>About these Terms</h2>
          <p>These Terms apply to your use of the App on Android devices. If you use the App through an app store or platform (e.g., Google Play), that platform’s terms also apply to your relationship with the platform.</p>
        </div>
        <div className="privacy-section">
          <h2>Licence to use the App</h2>
          <p>We grant you a personal, non-exclusive, non-transferable, revocable licence to install and use the App for lawful purposes, in accordance with these Terms.<br/>
          This licence does not transfer ownership of the App or any intellectual property rights.</p>
        </div>
        <div className="privacy-section">
          <h2>Prohibited use</h2>
          <ul>
            <li>copy, modify, distribute, sell, rent, lease, sublicense, or otherwise commercially exploit the App</li>
            <li>reverse engineer, decompile, or attempt to extract source code from the App</li>
            <li>bypass or interfere with security or integrity features</li>
            <li>use the App in a way that is unlawful, harmful, abusive, or infringes another person’s rights</li>
          </ul>
        </div>
        <div className="privacy-section">
          <h2>Your reminders and content</h2>
          <p>You control what reminders you create. Your reminder content and settings are stored on your device.</p>
          <p>You are responsible for:</p>
          <ul>
            <li>what you enter into the App (including any sensitive information)</li>
            <li>keeping your device secure (screen lock, OS updates, etc.)</li>
            <li>your device’s notification and battery settings</li>
          </ul>
        </div>
        <div className="privacy-section">
          <h2>Device permissions</h2>
          <p>The App may request:</p>
          <ul>
            <li>Notifications - to display reminders and repeated notifications.</li>
            <li>Disable battery optimisation (optional) - to improve reliability on devices that restrict background activity.</li>
          </ul>
          <p>You can change permissions in Android settings at any time. Some features may not work correctly if required permissions are denied.</p>
        </div>
        <div className="privacy-section">
          <h2>Notifications and reliability</h2>
          <p>The App relies on Android and device manufacturer systems (notifications, scheduling, battery management). Reminder delivery and timing can be affected by:</p>
          <ul>
            <li>battery optimisation / background restrictions</li>
            <li>Do Not Disturb / Focus modes</li>
            <li>notification permission settings</li>
            <li>OS updates, manufacturer customisations, and device state (e.g. low power mode)</li>
          </ul>
          <p>We design the App to be reliable, but we do not guarantee that reminders will always be delivered, or delivered at the exact scheduled time, in every situation.</p>
        </div>
        <div className="privacy-section">
          <h2>Safety-critical restriction</h2>
          <p>You must not use remind.yu for medical, emergency, or other safety-critical purposes, or for anything where failure or delay could lead to injury, harm, or significant loss.</p>
        </div>
        <div className="privacy-section">
          <h2>Optional on-device crash reports</h2>
          <p>The App may generate crash reports on your device to help diagnose issues.</p>
          <ul>
            <li>Crash reports are stored locally.</li>
            <li>The App does not automatically transmit crash data (it does not request Internet permission).</li>
            <li>You may choose to export/share a crash report. If you do, you consent to us using it to troubleshoot and improve stability.</li>
            <li>If you send a crash report to us, we will keep it only as long as reasonably necessary to address the issue (or as required by law) and then delete it.</li>
          </ul>
          <p><strong>Important:</strong> If you share a report via email or another sharing method, that third-party service may process the data under its own terms and privacy policies.</p>
        </div>
        <div className="privacy-section">
          <h2>Support</h2>
          <p>We may provide support at our discretion. We do not guarantee response times or that we can resolve every issue.</p>
        </div>
        <div className="privacy-section">
          <h2>Updates and changes</h2>
          <p>We may update the App (including adding, modifying, or removing features).<br/>
          We may also update these Terms. If we do, the App will prompt you to review and agree to the updated Terms before continuing to use the App. If you do not agree, you must stop using the App.</p>
        </div>
        <div className="privacy-section">
          <h2>Fees and purchases</h2>
          <p>The App is currently provided free of charge unless stated otherwise.<br/>
          If we introduce paid features, subscriptions, or in-app purchases in the future, pricing and purchase terms will be shown at the point of purchase and may be governed by the app store’s billing terms in addition to these Terms.</p>
        </div>
        <div className="privacy-section">
          <h2>Intellectual property</h2>
          <p>The App (including code, UI/design, trademarks, and branding, including “remind.yu”) is owned by Yuniverse Australia and/or its licensors and is protected by intellectual property laws.</p>
        </div>
        <div className="privacy-section">
          <h2>Third-party materials and open-source</h2>
          <p>The App may include third-party or open-source components. Those components may be subject to their own licence terms. Where required, notices and licences will be made available in the App or in accompanying materials.</p>
        </div>
        <div className="privacy-section">
          <h2>Privacy</h2>
          <p>Our Privacy Policy explains how the App handles information. The Privacy Policy is separate from these Terms but forms part of your overall understanding of how the App works.</p>
        </div>
        <div className="privacy-section">
          <h2>Disclaimer</h2>
          <p>To the maximum extent permitted by law, the App is provided “as is” and “as available.” We do not make warranties that the App will be uninterrupted, error-free, or meet your specific requirements.</p>
        </div>
        <div className="privacy-section">
          <h2>Limitation of liability</h2>
          <ul>
            <li>We are not liable for delays or failures in reminder delivery caused by device settings, OS behaviour, manufacturer restrictions, third-party platforms, or factors outside our reasonable control.</li>
            <li>We are not liable for loss of data on your device (including reminders) due to device failure, OS updates, uninstall/restore processes, or user actions.</li>
            <li>We are not liable for indirect or consequential loss (such as missed appointments, lost profits, or lost opportunities).</li>
          </ul>
        </div>
        <div className="privacy-section">
          <h2>Australian Consumer Law</h2>
          <p>Nothing in these Terms excludes, restricts, or modifies any rights or remedies you may have under the Australian Consumer Law or other laws that cannot be excluded.</p>
        </div>
        <div className="privacy-section">
          <h2>Entire agreement</h2>
          <p>These Terms, together with any documents expressly incorporated by reference (such as the Privacy Policy), form the entire agreement between you and us regarding the App.</p>
        </div>
        <div className="privacy-section">
          <h2>Contact</h2>
          <div className="privacy-permission-block" style={{marginBottom: '1.2em'}}>
            <div className="privacy-permission-title"><strong>Email</strong></div>
            <div className="privacy-permission-desc"><a href="mailto:support@yuniverse.au">support@yuniverse.au</a></div>
          </div>
          <div className="privacy-permission-block">
            <div className="privacy-permission-title"><strong>Developer</strong></div>
            <div className="privacy-permission-desc">Yuniverse Australia</div>
          </div>
        </div>
        <footer className="privacy-footer">
          <p>© 2026 Yuniverse Australia. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
