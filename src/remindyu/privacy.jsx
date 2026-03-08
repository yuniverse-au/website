import { useEffect, useState } from "react";
import BlobCursorDither from "../BlobCursorDither";
import YuniverseLogoHeader from "../YuniverseLogoHeader";
import "./Privacy.css";

export default function Privacy() {
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
    document.title = 'Privacy Policy - remind.yu';

    const favicon = document.querySelector("link[rel~='icon']");
    const originalHref = favicon?.getAttribute("href");
    if (favicon) favicon.href = "/images/remindyu/remindyu-icon.svg";

    window.scrollTo(0, 0);

    // Enable scrolling on the root and body
    const root = document.getElementById('root');
    const body = document.body;
    const html = document.documentElement;

    if (root) root.style.overflow = 'visible';
    if (body) body.style.overflow = 'visible';
    if (html) html.style.overflow = 'visible';

    return () => {
      document.title = 'The Yuniverse';
      if (favicon && originalHref) favicon.href = originalHref;
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
        <h1 className="privacy-title">Privacy Policy for remind.yu (Android)</h1>
        <div className="privacy-section">
            <div className="privacy-permission-block" style={{marginBottom: '1.2em'}}>
              <div className="privacy-permission-title"><strong>Effective date</strong></div>
              <div className="privacy-permission-desc">8th February 2026</div>
            </div>
            <div className="privacy-permission-block" style={{marginBottom: '1.2em'}}>
              <div className="privacy-permission-title"><strong>Developer / publisher</strong></div>
              <div className="privacy-permission-desc">Yuniverse Australia ("we", "us", "our")</div>
            </div>
            <div className="privacy-permission-block">
              <div className="privacy-permission-title"><strong>Contact</strong></div>
              <div className="privacy-permission-desc"><a href="mailto:privacy@yuniverse.au">privacy@yuniverse.au</a></div>
            </div>
          <p>Yuniverse Australia does not collect your information. remind.yu (the "App") stores reminders and settings on your device and does not request Internet permission. If you choose to contact us or share a crash report, we receive only what you decide to send.</p>
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
            <li>App customisations (icons, labels, "nagging" settings, timing rules)</li>
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
          <p>When you move to a new phone, remind.yu data may be transferred using Android or manufacturer-provided transfer methods (for example, Pixel's device transfer). This transfer occurs through those first-party tools.</p>
          <p>remind.yu does not receive, process, or store your transferred data.</p>
          <p><strong>Note:</strong> The transfer feature you use may be provided by Google or your device manufacturer and may be governed by their own privacy policies. remind.yu does not control those services.</p>
        </div>
        <div className="privacy-section">
          <h2>Permissions</h2>
          <p>remind.yu requests only the permissions needed to function:</p>
          <div className="privacy-permission-block" style={{marginBottom: '1.2em'}}>
            <div className="privacy-permission-title"><strong>Notifications</strong></div>
            <div className="privacy-permission-desc">Used to show reminders and repeated notifications ("nagging") so you do not miss them.</div>
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
          <p><strong>Delete all remind.yu data (recommended for a full reset)</strong><br/>You can remove all reminders and settings by using Android's built-in "Clear storage" / "Clear data" option for the app. This resets remind.yu as if it were freshly installed. Steps vary by device manufacturer and Android version.</p>
          <p><strong>Uninstalling the app</strong><br/>Uninstalling remind.yu typically removes the app and its on-device app data. However, depending on your device settings, some information may be restored if you reinstall (for example, if your device backups/restore are enabled). Data restore can occur as part of Android's backup/restore process when an app is installed.</p>
          <p><strong>Archiving (if your device offers it)</strong><br/>Some Android devices/Play Store setups support "archiving" apps, which is different from uninstalling and may keep personal app data available for restoration. If you want everything removed, use Clear storage rather than archive.</p>
        </div>
        <div className="privacy-section">
          <h2>Children's privacy</h2>
          <p>remind.yu does not collect personal information from anyone, including children.</p>
        </div>
        <div className="privacy-section">
          <h2>Links to our website (yuniverse.au)</h2>
          <p>The app includes links that open our website in your browser. When you visit our website, technical information (such as your IP address and request information) may be processed to deliver and protect the site. Our website is hosted and secured using Cloudflare services, which may process this information as part of providing content delivery and security. Cloudflare's privacy practices are described in its privacy policy.</p>
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
