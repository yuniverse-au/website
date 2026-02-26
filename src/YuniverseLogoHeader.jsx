import LogoSvg from "./LogoSvg";
import "./YuniverseLogoHeader.css";

export default function YuniverseLogoHeader({ svgClassName }) {
  return (
    <a href="/" className="yuniverse-logo-header" aria-label="The Yuniverse - home">
      <LogoSvg
        className={`yuniverse-logo-header__svg${svgClassName ? ` ${svgClassName}` : ""}`}
        ariaHidden
      />
    </a>
  );
}
