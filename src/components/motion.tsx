import { useEffect, useState, type RefObject } from "react";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Elements that fade/slide in when scrolled into view (content above the fold uses the page-enter animation instead). */
const TARGETS = ".card, .result, .home-section, .step-item, .tier, .pillar, .fact";

/**
 * Scroll reveal for everything inside `root`. Only elements that start below the fold are hidden,
 * and new elements (Convex data arriving later) are picked up via MutationObserver.
 */
export function useReveal(root: RefObject<HTMLElement | null>, resetKey: string) {
  useEffect(() => {
    const el = root.current;
    if (!el || reduced() || !("IntersectionObserver" in window)) return;
    const seen = new WeakSet<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const t = e.target as HTMLElement;
          t.classList.add("reveal-in");
          t.classList.remove("reveal-pending");
          io.unobserve(t);
          window.setTimeout(() => t.classList.remove("reveal-in"), 900);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.01 },
    );
    const scan = () => {
      el.querySelectorAll(TARGETS).forEach((t) => {
        if (seen.has(t)) return;
        seen.add(t);
        // Nested targets reveal with their parent.
        if (t.parentElement?.closest(".reveal-pending")) return;
        const r = t.getBoundingClientRect();
        if (r.top < window.innerHeight * 0.95) return;
        t.classList.add("reveal-pending");
        io.observe(t);
      });
    };
    scan();
    const mo = new MutationObserver(() => scan());
    mo.observe(el, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      io.disconnect();
      el.querySelectorAll(".reveal-pending").forEach((t) => t.classList.remove("reveal-pending"));
    };
  }, [root, resetKey]);
}

/** Count up to a number once (respects reduced motion). */
export function CountUp({ to, duration = 1100 }: { to: number; duration?: number }) {
  const [n, setN] = useState(() => (reduced() ? to : 0));
  useEffect(() => {
    if (reduced()) {
      setN(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      setN(Math.round(from + (to - from) * (1 - Math.pow(1 - p, 4))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration]);
  return <span className="stat-num">{n}</span>;
}
