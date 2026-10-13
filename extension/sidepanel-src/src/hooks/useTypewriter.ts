import { useState, useEffect, useRef } from 'react';

interface UseTypewriterOptions {
  /** Whether the source is currently active/streaming */
  isStreaming?: boolean;
  /** Whether this message is historical and should display immediately without typing */
  immediate?: boolean;
}

export function useTypewriter(
  targetText: string = '',
  options: UseTypewriterOptions = {}
) {
  const { isStreaming = false, immediate = false } = options;

  // If immediate is true or text is empty, start with the full text displayed
  const [displayedLength, setDisplayedLength] = useState<number>(() => {
    if (immediate || !isStreaming) {
      return targetText.length;
    }
    return 0;
  });

  const timerRef = useRef<number | null>(null);
  const targetTextRef = useRef(targetText);
  targetTextRef.current = targetText;

  useEffect(() => {
    // If historical/not streaming on mount or target is empty, sync immediately
    if (immediate || (!isStreaming && displayedLength === 0 && targetText.length > 0 && targetText.length === targetTextRef.current.length)) {
      // If we just loaded an old message, show it in full
      if (!isStreaming) {
        setDisplayedLength(targetText.length);
        return;
      }
    }

    // Cleanup any pending tick
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const tick = () => {
      setDisplayedLength((current) => {
        const fullLength = targetTextRef.current.length;
        if (current >= fullLength) {
          return fullLength;
        }

        const backlog = fullLength - current;

        // Semakin banyak teksnya (backlog), semakin cepat kecepatan mengetiknya!
        let step = 1;
        let delay = 24;

        if (backlog > 600) {
          step = Math.max(35, Math.floor(backlog / 8));
          delay = 8;
        } else if (backlog > 300) {
          step = Math.max(18, Math.floor(backlog / 10));
          delay = 10;
        } else if (backlog > 120) {
          step = Math.max(10, Math.floor(backlog / 12));
          delay = 14;
        } else if (backlog > 50) {
          step = Math.max(5, Math.floor(backlog / 14));
          delay = 18;
        } else if (backlog > 20) {
          step = Math.max(3, Math.floor(backlog / 16));
          delay = 20;
        } else if (backlog > 8) {
          step = 2;
          delay = 22;
        } else {
          step = 1;
          delay = 24;
        }

        // If streaming has stopped but we have leftover text, accelerate even faster to finish
        if (!isStreaming && backlog > 0) {
          step = Math.max(step, Math.max(15, Math.floor(backlog / 4)));
          delay = 8;
        }

        const next = Math.min(fullLength, current + step);

        if (next < fullLength) {
          timerRef.current = window.setTimeout(tick, delay);
        }

        return next;
      });
    };

    if (displayedLength < targetText.length) {
      timerRef.current = window.setTimeout(tick, 16);
    }

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [targetText, isStreaming, immediate, displayedLength]);

  // If targetText shrank (e.g. reset or cleared), adjust length
  useEffect(() => {
    if (displayedLength > targetText.length) {
      setDisplayedLength(targetText.length);
    }
  }, [targetText.length, displayedLength]);

  const isTyping = displayedLength < targetText.length;
  const displayedText = targetText.slice(0, displayedLength);

  return {
    displayedText,
    isTyping,
    progress: targetText.length > 0 ? displayedLength / targetText.length : 1,
  };
}
