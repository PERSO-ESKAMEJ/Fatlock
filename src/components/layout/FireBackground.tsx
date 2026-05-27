import { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

export default function FireBackground() {
  const targetRef = useRef({ x: 0.5, y: 0.5 });
  const currentRef = useRef({ x: 0.5, y: 0.5 });
  const rafRef = useRef<number>(0);
  const spotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      targetRef.current = {
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      };
    };

    window.addEventListener('mousemove', onMove, { passive: true });

    const tick = () => {
      const t = currentRef.current;
      const m = targetRef.current;
      // Smooth lerp toward mouse position
      t.x += (m.x - t.x) * 0.04;
      t.y += (m.y - t.y) * 0.04;

      if (spotRef.current) {
        const px = t.x * window.innerWidth;
        const py = t.y * window.innerHeight;
        spotRef.current.style.transform = `translate(${px}px, ${py}px) translate(-50%, -50%)`;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return ReactDOM.createPortal(
    <div
      aria-hidden="true"
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}
    >
      {/* Bottom-left ember core — brand red */}
      <div className="fire-blob fire-blob-1" />
      {/* Bottom-right ember — gold */}
      <div className="fire-blob fire-blob-2" />
      {/* Center floating heat shimmer */}
      <div className="fire-blob fire-blob-3" />
      {/* Mouse-following warm spotlight */}
      <div ref={spotRef} className="fire-mouse-spot" />
    </div>,
    document.body
  );
}
