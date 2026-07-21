import React, { useEffect, useState, useRef } from 'react';
import '../App.css';

const ProgressBar = () => {
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const timerRef = useRef(null);
  const incrementRef = useRef(null);

  useEffect(() => {
    // Internal UI start: shows and increments the progress bar
    const internalStart = () => {
      if (timerRef.current) return; // already running
      // mark global flag so new PageTransition mounts can detect an in-progress navigation
      try { window.__routeChangeInProgress = true; } catch (e) {}
      setVisible(true);
      setWidth(6);

      // slowly increase width to simulate progress
      incrementRef.current = setInterval(() => {
        setWidth((w) => Math.min(90, w + Math.random() * 8));
      }, 400);

      // ensure we always have a fallback to hide
      timerRef.current = setTimeout(() => {
        clearInterval(incrementRef.current);
        timerRef.current = null;
      }, 20000);
    };

    const done = () => {
      // clear global flag
      try { window.__routeChangeInProgress = false; } catch (e) {}
      clearInterval(incrementRef.current);
      incrementRef.current = null;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setWidth(100);
      // hide after short delay to let the fill animate
      setTimeout(() => {
        setVisible(false);
        setWidth(0);
      }, 260);
    };

    const onClick = (e) => {
      // capture clicks on internal anchors
      const a = e.target.closest && e.target.closest('a');
      if (a && a.href && a.target !== '_blank' && a.href.indexOf(window.location.origin) === 0) {
        // internal link -> dispatch a global start event so PageTransition shows overlay
        window.dispatchEvent(new Event('route-change-start'));
      }
    };

    // patch history API to catch programmatic navigations and dispatch start
    const origPush = window.history.pushState;
    const origReplace = window.history.replaceState;
    window.history.pushState = function () {
      const result = origPush.apply(this, arguments);
      window.dispatchEvent(new Event('route-change-start'));
      return result;
    };
    window.history.replaceState = function () {
      const result = origReplace.apply(this, arguments);
      window.dispatchEvent(new Event('route-change-start'));
      return result;
    };

    // When global start/end events are dispatched, update the progress UI
    window.addEventListener('route-change-start', internalStart);
    window.addEventListener('route-change-end', done);
    document.addEventListener('click', onClick, true);
    // For popstate (back/forward), dispatch the start event so overlay shows
    const popstateHandler = () => window.dispatchEvent(new Event('route-change-start'));
    window.addEventListener('popstate', popstateHandler);

    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('route-change-start', internalStart);
      window.removeEventListener('route-change-end', done);
      window.removeEventListener('popstate', popstateHandler);
      window.history.pushState = origPush;
      window.history.replaceState = origReplace;
      if (incrementRef.current) clearInterval(incrementRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="progress-root" aria-hidden="true">
      <div className="progress-bar" style={{ width: `${width}%` }} />
    </div>
  );
};

export default ProgressBar;
