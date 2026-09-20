import React from 'react';

/**
 * Shared decorative background for public pages (landing, auth, reset-password).
 * Rendered OUTSIDE AnimatePresence so it persists across route transitions,
 * preventing the visual "glitch" of background elements disappearing/reappearing.
 */
const PublicBackground = () => (
  <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
    {/* Gradient overlay matching the original landing page */}
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(96,165,250,0.26),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(129,140,248,0.22),_transparent_30%),linear-gradient(180deg,_#d7e9ff_0%,_#dcebff_38%,_#eef5ff_72%,_#f8fbff_100%)]" />
    {/* Grid pattern */}
    <div className="absolute inset-0 bg-[linear-gradient(rgba(147,197,253,0.22)_1px,transparent_1px),linear-gradient(90deg,rgba(147,197,253,0.22)_1px,transparent_1px)] bg-[size:42px_42px]" />
    {/* Glow blobs */}
    <div className="absolute left-[8%] top-24 h-56 w-56 rounded-full bg-sky-300/30 blur-3xl" />
    <div className="absolute right-[10%] top-32 h-80 w-80 rounded-full bg-indigo-300/25 blur-3xl" />
    <div className="absolute bottom-[10%] left-1/3 h-64 w-64 rounded-full bg-blue-200/20 blur-3xl" />
  </div>
);

export default PublicBackground;
