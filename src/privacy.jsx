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

export default function Privacy() {
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
    // Set page title
    document.title = 'Privacy Policy - Yuniverse';
    
    // Scroll to top when component mounts
    window.scrollTo(0, 0);
    
    // Enable scrolling on the root and body
    const root = document.getElementById('root');
    const body = document.body;
    const html = document.documentElement;
    
    if (root) root.style.overflow = 'visible';
    if (body) body.style.overflow = 'visible';
    if (html) html.style.overflow = 'visible';
    
    // Cleanup: restore overflow hidden when component unmounts
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
        <h1 className="privacy-title">Privacy Policy for remind.yu (Android)</h1>
        <div className="privacy-section">
            <div className="privacy-permission-block" style={{marginBottom: '1.2em'}}>
              <div className="privacy-permission-title"><strong>Effective date</strong></div>
              <div className="privacy-permission-desc">8th February 2026</div>
            </div>
            <div className="privacy-permission-block" style={{marginBottom: '1.2em'}}>
              <div className="privacy-permission-title"><strong>Developer / publisher</strong></div>
              <div className="privacy-permission-desc">Yuniverse Australia</div>
            </div>
            <div className="privacy-permission-block">
              <div className="privacy-permission-title"><strong>Contact</strong></div>
              <div className="privacy-permission-desc"><a href="mailto:privacy@yuniverse.au">privacy@yuniverse.au</a></div>
            </div>
          <p>Yuniverse Australia does not collect your information. remind.yu stores reminders and settings on your device and does not request Internet permission. If you choose to contact us or share a crash report, we receive only what you decide to send.</p>
        </div>
        <div className="privacy-section">
          <h2>Summary</h2>
          <ul>
            <li>remind.yu does not collect, store, sell, or transmit your personal data.</li>
            <li>Your reminders and settings are stored only on your device.</li>
            <li>The app does not request Internet permission.</li>
            <li>Data transfer to a new phone happens via first-party device transfer tools (e.g., Android/Pixel transfer), not through us.</li>
            <li>Crash reporting (optional) is on device only, and you can choose to share a report manually.</li>
          </ul>
        </div>
        <div className="privacy-section">
          <h2>Information we collect</h2>
          <p><strong>We collect nothing by default.</strong></p>
          <p>remind.yu does not automatically collect or transmit:</p>
          <ul>
            <li>Reminder content (titles, schedules, repeat rules, linked reminders, completion history)</li>
            <li>App customisations (icons, labels, “nagging” settings, timing rules)</li>
            <li>Personal identifiers (name, email, phone number)</li>
            <li>Device identifiers (including advertising ID)</li>
            <li>Location data</li>
            <li>Analytics or tracking data</li>
            <li>Network data (the app does not have Internet permission)</li>
          </ul>
        </div>
        <div className="privacy-section">
          <h2>Where your data is stored</h2>
          <p>All reminders and app settings are stored locally on your Android device. remind.yu does not operate servers that store your reminders.</p>
        </div>
        <div className="privacy-section">
          <h2>Device-to-device transfer</h2>
          <p>When you move to a new phone, remind.yu data may be transferred using Android or manufacturer-provided transfer methods (for example, Pixel’s device transfer). This transfer occurs through those first-party tools.</p>
          <p>remind.yu does not receive, process, or store your transferred data.</p>
          <p><strong>Note:</strong> The transfer feature you use may be provided by Google or your device manufacturer and may be governed by their own privacy policies. remind.yu does not control those services.</p>
        </div>
        <div className="privacy-section">
          <h2>Permissions</h2>
          <p>remind.yu requests only the permissions needed to function:</p>
          <div className="privacy-permission-block" style={{marginBottom: '1.2em'}}>
            <div className="privacy-permission-title"><strong>Notifications</strong></div>
            <div className="privacy-permission-desc">Used to show reminders and repeated notifications (“nagging”) so you do not miss them.</div>
          </div>
          <div className="privacy-permission-block">
            <div className="privacy-permission-title"><strong>Disable battery optimisation (optional)</strong></div>
            <div className="privacy-permission-desc">Some devices delay background tasks. If you choose to disable battery optimisation for remind.yu, reminders may be more reliable.</div>
          </div>
          <p>These permissions are used only on your device and are not used to collect or transmit personal data.</p>
        </div>
        <div className="privacy-section">
          <h2>On-device crash reporting (optional)</h2>
          <p>remind.yu may include an on-device crash report feature to help diagnose issues.</p>
          <ul>
            <li>Crash reports are stored locally on your device.</li>
            <li>The app does not automatically send crash data anywhere (and cannot, because it has no Internet permission).</li>
            <li>You may choose to export/share a crash report (for example, to email it to support@yuniverse.au). This is entirely optional and user initiated.</li>
          </ul>
          <p>If you choose to send us a crash report:<br/>We will receive whatever information you choose to share. We will use it only to troubleshoot and improve app stability, and we will not sell it or use it for advertising. We will keep it only as long as needed to resolve the issue (or comply with legal obligations), then delete it.</p>
        </div>
        <div className="privacy-section">
          <h2>Sharing of information</h2>
          <p>Because we do not collect your data by default, we do not share personal information with third parties.</p>
          <p>If you voluntarily contact us (for example, by emailing support@yuniverse.au), we will only use the information you provide to respond to you.</p>
        </div>
        <div className="privacy-section">
          <h2>Third-party services</h2>
          <p>remind.yu does not include third-party SDKs for analytics, ads, or tracking.</p>
          <p>If you download remind.yu from an app store (such as Google Play), the store may collect information under its own policies. That data collection is separate from remind.yu.</p>
        </div>
        <div className="privacy-section">
          <h2>Data security</h2>
          <p>Your reminder data stays on your device. We recommend enabling device security features such as a screen lock and keeping Android updated.</p>
        </div>
        <div className="privacy-section">
          <h2>Deleting reminders and app data</h2>
          <p><strong>Delete individual reminders (stop future notifications)</strong><br/>You can remove any scheduled reminder at any time by deleting it from the reminder list in the app. This removes that reminder from your device and stops future notifications for it.</p>
          <p><strong>Delete all remind.yu data (recommended for a full reset)</strong><br/>You can remove all reminders and settings by using Android’s built-in “Clear storage” / “Clear data” option for the app. This resets remind.yu as if it were freshly installed. Steps vary by device manufacturer and Android version.</p>
          <p><strong>Uninstalling the app</strong><br/>Uninstalling remind.yu typically removes the app and its on-device app data. However, depending on your device settings, some information may be restored if you reinstall (for example, if your device backups/restore are enabled). Data restore can occur as part of Android’s backup/restore process when an app is installed.</p>
          <p><strong>Archiving (if your device offers it)</strong><br/>Some Android devices/Play Store setups support “archiving” apps, which is different from uninstalling and may keep personal app data available for restoration. If you want everything removed, use Clear storage rather than archive.</p>
        </div>
        <div className="privacy-section">
          <h2>Children’s privacy</h2>
          <p>remind.yu does not collect personal information from anyone, including children.</p>
        </div>
        <div className="privacy-section">
          <h2>Changes to this policy</h2>
          <p>If this Privacy Policy changes, we will update the Effective date and publish the updated policy wherever it is made available.</p>
        </div>
        <div className="privacy-section">
          <h2>Contact</h2>
          <div className="privacy-permission-block" style={{marginBottom: '1.2em'}}>
            <div className="privacy-permission-title"><strong>Email</strong></div>
            <div className="privacy-permission-desc"><a href="mailto:privacy@yuniverse.au">privacy@yuniverse.au</a></div>
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
