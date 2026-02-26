
import { useEffect, useState } from "react";
import BlobCursorDither from "./BlobCursorDither";
import YuniverseLogoHeader from "./YuniverseLogoHeader";
import "./Privacy.css";

export default function Terms() {
  const [isMobile] = useState(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
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
        logoMagnetismSelector=".yuniverse-logo-header"
        hashColor="#000000"
        pixelSize={2}
        whiteCutoff={0.7}
        thresholdShift={-0.4}
        mode="normal"
        zIndex={1}
      />

      <YuniverseLogoHeader />

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
