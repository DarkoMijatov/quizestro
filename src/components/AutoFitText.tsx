import { useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface AutoFitTextProps {
  text: string;
  className?: string;
  minFontSize?: number;
  maxFontSize?: number;
  onClick?: () => void;
}

/**
 * Renders text that auto-scales its font-size to fill the container width.
 */
export function AutoFitText({
  text,
  className,
  minFontSize = 8,
  maxFontSize = 32,
  onClick,
}: AutoFitTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [fontSize, setFontSize] = useState(maxFontSize);

  useEffect(() => {
    const container = containerRef.current;
    const textEl = textRef.current;
    if (!container || !textEl) return;

    // Binary search for best font size
    let lo = minFontSize;
    let hi = maxFontSize;
    let best = minFontSize;

    // Temporarily make text visible for measuring
    textEl.style.visibility = 'hidden';
    textEl.style.whiteSpace = 'nowrap';

    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      textEl.style.fontSize = `${mid}px`;
      if (textEl.scrollWidth <= container.clientWidth) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    textEl.style.visibility = 'visible';
    setFontSize(best);
  }, [text, minFontSize, maxFontSize]);

  // Re-fit on container resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      const textEl = textRef.current;
      if (!textEl) return;

      let lo = minFontSize;
      let hi = maxFontSize;
      let best = minFontSize;

      textEl.style.whiteSpace = 'nowrap';

      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        textEl.style.fontSize = `${mid}px`;
        if (textEl.scrollWidth <= container.clientWidth) {
          best = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }

      setFontSize(best);
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [text, minFontSize, maxFontSize]);

  return (
    <div ref={containerRef} className={cn("overflow-hidden w-full", className)} onClick={onClick}>
      <span
        ref={textRef}
        className="font-bold text-foreground whitespace-nowrap block leading-tight"
        style={{ fontSize: `${fontSize}px` }}
      >
        {text}
      </span>
    </div>
  );
}
