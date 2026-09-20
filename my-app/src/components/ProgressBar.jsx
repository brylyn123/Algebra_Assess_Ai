import React, { useEffect, useState, useRef } from 'react';
import '../App.css';

const ProgressBar = () => {
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const timerRef = useRef(null);
  const incrementRef = useRef(null);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    // Skip on initial page load
    const initTimer = setTimeout(() => {
      isInitialLoad.current = false;
    }, 200);

    const internalStart = () => {
      if (isInitialLoad.current) return;
      if (timerRef.current) return;
      try { window.__routeChangeInProgress = true; } catch (e) { }
      setVisible(true);
      setWidth(6);

      incrementRef.current = setInterval(() => {
        setWidth((w) => Math.min(90, w + Math.random() * 8));
      }, 400);

      timerRef.current = setTimeout(() => {
        clearInterval(incrementRef.current);
        timerRef.current = null;
      }, 20000);
    };

    const done = () => {
      try { window.__routeChangeInProgress = false; } catch (e) { }
      clearInterval(incrementRef.current);
      incrementRef.current = null;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setWidth(100);
      setTimeout(() => {
        setVisible(false);
        setWidth(0);
      }, 260);
    };

    const onClick = (e) => {
      if (isInitialLoad.current) return;
      const a = e.target.closest && e.target.closest('a');
      if (a && a.href && a.target !== '_blank' && a.href.indexOf(window.location.origin) === 0) {
        window.dispatchEvent(new Event('route-change-start'));
      }
    };

    const origPush = window.history.pushState;
    const origReplace = window.history.replaceState;
    window.history.pushState = function () {
      const result = origPush.apply(this, arguments);
      if (!isInitialLoad.current) {
        window.dispatchEvent(new Event('route-change-start'));
      }
      return result;
    };
    window.history.replaceState = function () {
      const result = origReplace.apply(this, arguments);
      if (!isInitialLoad.current) {
        window.dispatchEvent(new Event('route-change-start'));
      }
      return result;
    };

    window.addEventListener('route-change-start', internalStart);
    window.addEventListener('route-change-end', done);
    document.addEventListener('click', onClick, true);
    const popstateHandler = () => {
      if (!isInitialLoad.current) {
        window.dispatchEvent(new Event('route-change-start'));
      }
    };
    window.addEventListener('popstate', popstateHandler);

    return () => {
      clearTimeout(initTimer);
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
