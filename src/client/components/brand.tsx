/* The only two pieces of brand drawing in the app. Both are pure SVG with no
   state and no client boundary. Utility glyphs come from react-icons/fi — don't
   grow this file into an icon set. */

/** Shepherd's-crook hook: eye, shank, bend, point, barb. Replaces tackle_box.png. */
export function HookMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {/* The drawing spans y 1.7-14.9, so it is nudged down to sit on the
          viewBox's optical centre; without this every centred instance rides high. */}
      <g transform="translate(0 1.6)">
        {/* eye */}
        <circle cx="6.6" cy="3.2" r="1.5" strokeWidth={1.2} />
        {/* shank, bend and point */}
        <path d="M6.6 4.7v6.6a3.6 3.6 0 0 0 7.2 0V8.9" />
        {/* barb, cutting back toward the bend */}
        <path d="M13.8 9 11.7 11.3" strokeWidth={1.2} />
      </g>
    </svg>
  );
}

/** Bathymetric contour field: one authored path, six offset copies. Sits behind
    the home hero and the 404. Decorative — well below the /70 alpha floor. */
export function ContourField() {
  return (
    <svg viewBox="0 0 1440 320" preserveAspectRatio="none" className="absolute inset-0 h-full w-full text-accent" aria-hidden="true" focusable="false">
      {[0, 1, 2, 3, 4, 5].map((n) => (
        <path
          key={n}
          d="M0 96C240 60 400 132 640 108S1040 48 1440 84"
          transform={`translate(0 ${28 * n}) scale(1 ${1 + 0.06 * n})`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
          opacity={0.14 - n * 0.016}
        />
      ))}
    </svg>
  );
}
