type BrandLogoProps = {
  dark?: boolean;
  compact?: boolean;
  className?: string;
};

/** One code-native FLYERO wordmark shared by every application surface. */
export function BrandLogo({ dark = false, compact = false, className = "" }: BrandLogoProps) {
  const classes = ["flyeroLogo", "flyeroBrand", "mkLogo", dark ? "dark isDark" : "", compact ? "isCompact" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} role="img" aria-label="FLYERO. Lokal. Effektiv. Messbar.">
      <strong className="flyeroBrandWord" aria-hidden="true">
        <span>FLY</span>
        <span className="flyeroBrandBars" aria-hidden="true"><i /><i /><i /></span>
        <span>RO</span>
      </strong>
      <span className="flyeroBrandTagline" aria-hidden="true">LOKAL. EFFEKTIV. MESSBAR.</span>
    </span>
  );
}
