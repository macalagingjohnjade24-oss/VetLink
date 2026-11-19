/** Paw mark + wordmark, matching the Figma brand lockup (164×44). */
export function Logo({ className = 'auth__brand' }: { className?: string }) {
  return (
    <div className={className} aria-label="VetLink">
      <svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <g fill="#FF6B00">
          <ellipse cx="12" cy="16.4" rx="4.5" ry="3.7" />
          <circle cx="6.3" cy="10.3" r="1.95" />
          <circle cx="9.8" cy="6.7" r="1.95" />
          <circle cx="14.2" cy="6.7" r="1.95" />
          <circle cx="17.7" cy="10.3" r="1.95" />
        </g>
      </svg>
      <span>VetLink</span>
    </div>
  );
}
