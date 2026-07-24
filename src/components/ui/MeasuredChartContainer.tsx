import React, { useEffect, useRef, useState } from 'react';
import { ResponsiveContainer } from 'recharts';

/** Mounts Recharts only after its parent has a measurable box. This avoids the
 * transient width/height -1 warning while tabs and motion transitions mount. */
export const MeasuredChartContainer = ({ children, debounce = 80 }: { children: React.ReactElement; debounce?: number }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const update = () => setReady(host.clientWidth > 0 && host.clientHeight > 0);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={hostRef} className="h-full min-h-0 w-full min-w-0">
      {ready ? <ResponsiveContainer width="100%" height="100%" debounce={debounce}>{children}</ResponsiveContainer> : null}
    </div>
  );
};
