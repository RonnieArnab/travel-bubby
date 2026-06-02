// Tiny line-art SVG illustrations for empty states. Stroke uses currentColor
// so they pick up the active text colour and work in both light and dark.

export function MapEmpty() {
  return (
    <svg className="empty-illu" viewBox="0 0 200 130" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M30 30 L70 18 L130 38 L170 22 L170 100 L130 116 L70 96 L30 110 Z" opacity="0.35" />
      <path d="M70 18 L70 96" opacity="0.35" />
      <path d="M130 38 L130 116" opacity="0.35" />
      <path d="M100 50 C92 50 86 56 86 64 C86 76 100 92 100 92 C100 92 114 76 114 64 C114 56 108 50 100 50 Z" />
      <circle cx="100" cy="64" r="4" />
    </svg>
  );
}

export function GroupsEmpty() {
  return (
    <svg className="empty-illu" viewBox="0 0 200 130" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="70" cy="58" r="14" />
      <circle cx="130" cy="58" r="14" />
      <circle cx="100" cy="80" r="16" />
      <path d="M44 110 C50 96 60 88 70 88 M156 110 C150 96 140 88 130 88 M76 116 C80 104 90 98 100 98 C110 98 120 104 124 116" />
    </svg>
  );
}

export function WalksEmpty() {
  return (
    <svg className="empty-illu" viewBox="0 0 200 130" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M30 100 C50 88 60 70 80 70 C100 70 110 90 130 90 C150 90 160 60 180 60" strokeDasharray="4 6" />
      <circle cx="30" cy="100" r="4" fill="currentColor" />
      <circle cx="180" cy="60" r="4" fill="currentColor" />
      <path d="M70 30 L80 50 L70 70 M70 30 C66 30 64 32 64 35 C64 38 66 40 70 40 M82 24 L78 30" />
    </svg>
  );
}

export function PlacesEmpty() {
  return (
    <svg className="empty-illu" viewBox="0 0 200 130" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="40" y="36" width="50" height="58" rx="4" opacity="0.5" />
      <rect x="100" y="44" width="50" height="50" rx="4" opacity="0.5" />
      <path d="M52 52 L78 52 M52 64 L72 64 M52 76 L78 76" />
      <path d="M112 56 L138 56 M112 68 L132 68 M112 80 L138 80" />
      <circle cx="160" cy="34" r="6" />
    </svg>
  );
}
