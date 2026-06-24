import { useEffect, useRef } from 'react';

/**
 * Looping background video with a custom JS (rAF) crossfade — no CSS transitions.
 * Looping is implemented manually (loop attribute off) so we can fade out just
 * before the end and fade back in on restart.
 */
const FADE_MS = 500;
const FADE_OUT_LEAD = 0.55; // seconds before the end to start fading out

interface Props {
  src: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function FadingVideo({ src, className, style }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number | null>(null);
  const fadingOutRef = useRef(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    const fadeTo = (target: number, duration = FADE_MS) => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      const start = parseFloat(video.style.opacity || '0');
      const t0 = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / duration);
        video.style.opacity = String(start + (target - start) * p);
        if (p < 1) rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    const onLoaded = () => {
      video.style.opacity = '0';
      video.play().catch(() => {});
      fadeTo(1);
    };
    const onTimeUpdate = () => {
      const remaining = video.duration - video.currentTime;
      if (!fadingOutRef.current && remaining <= FADE_OUT_LEAD && remaining > 0) {
        fadingOutRef.current = true;
        fadeTo(0);
      }
    };
    const onEnded = () => {
      video.style.opacity = '0';
      setTimeout(() => {
        video.currentTime = 0;
        video.play().catch(() => {});
        fadingOutRef.current = false;
        fadeTo(1);
      }, 100);
    };

    video.addEventListener('loadeddata', onLoaded);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('ended', onEnded);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      video.removeEventListener('loadeddata', onLoaded);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('ended', onEnded);
    };
  }, [src]);

  return (
    <video
      ref={ref}
      src={src}
      autoPlay
      muted
      playsInline
      preload="auto"
      className={className}
      style={{ opacity: 0, ...style }}
    />
  );
}
