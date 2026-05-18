import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Top-of-page progress bar that animates on every route change.
 * Provides visual continuity so users see *something* happen instead
 * of a blank/flicker between pages.
 */
export function RouteProgressBar() {
  const location = useLocation();
  // useNavigation is data-router aware; fall back to a timed bar when not present.
  let navState: 'idle' | 'loading' | 'submitting' = 'idle';
  try {
    navState = useNavigation().state as 'idle' | 'loading' | 'submitting';
  } catch {
    /* not in a data router */
  }

  const [visible, setVisible] = useState(false);
  const firstRender = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Skip animating the very first paint.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setVisible(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), 380);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [location.pathname]);

  // Keep bar visible while React Router is in a loading state.
  const active = visible || navState !== 'idle';

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="route-progress"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="pointer-events-none absolute inset-x-0 top-0 z-50 h-0.5 overflow-hidden"
        >
          <motion.div
            key={`bar-${location.pathname}`}
            initial={{ scaleX: 0, transformOrigin: '0% 50%' }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.35, ease: [0.4, 0.0, 0.2, 1] }}
            className="h-full w-full bg-accent shadow-[0_0_8px_hsl(var(--accent))]"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
