"use client";

import { useEffect, useState } from "react";
import type { RefObject } from "react";

const HLS_MIME = "application/vnd.apple.mpegurl";

/**
 * Attaches an HLS stream to a `<video>`: natively where the browser plays HLS
 * (Safari, iOS), else with hls.js, loaded on demand so pages without video
 * never download it (spec 08, "Performance").
 */
export function useHlsSource(videoRef: RefObject<HTMLVideoElement | null>, url: string | null) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (video === null || url === null) return;
    if (video.canPlayType(HLS_MIME) !== "") {
      video.src = url;
      return () => {
        video.removeAttribute("src");
      };
    }
    let destroy: (() => void) | null = null;
    let cancelled = false;
    void import("hls.js").then(({ default: Hls }) => {
      if (cancelled) return;
      if (!Hls.isSupported()) {
        setFailed(true);
        return;
      }
      const hls = new Hls();
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) setFailed(true);
      });
      hls.loadSource(url);
      hls.attachMedia(video);
      destroy = () => {
        hls.destroy();
      };
    });
    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [videoRef, url]);

  return { failed };
}
