import { useRef } from "react";
import BezierEasing from "bezier-easing"

export function formatVideoTime(time) {
  time = Math.floor(time)
  return [Math.floor(time / 3600), Math.floor(time / 60) % 60, time % 60].map((i) => i.toString().padStart(2, "0")).join(":");
}

export function waitFor<T = Element>(selector: string): Promise<T> {
  return new Promise((resolve) => {
    const observer = new MutationObserver((mutations) => {
      const node = document.querySelector(selector);
      if (node) {
        observer.disconnect();
        resolve(node as any);
      }
    });

    observer.observe(document.body, {
      childList: true
      , subtree: true
      , attributes: false
      , characterData: false
    })
  });
}

const bezier = BezierEasing(0, 0, 1, 0.5);

export const useSmoothScroll = (element?: HTMLElement) => {
  const toRef = useRef<number>();
  return (to: number, offset?: (height: number) => number) => {
    if (!element || toRef.current === to) {
      return;
    }
    const from = element.scrollTop;

    const startAt = Date.now();
    const during = 100;
    const $ = () => requestAnimationFrame(() => {
      const now = Date.now() + (1000 / 60);

      element.scrollTop = from + (to - from - (offset ? offset(element.clientHeight) : 0)) * bezier(Math.max(1, now - startAt) / during)

      if (now - startAt < during) {
        $();
      }
    })
    $();
  }
}