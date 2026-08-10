/* Copyright (c) 2026 QuarkX Sdn. Bhd. (202501056786 / 1658192-K). All rights reserved. */

/**
 * Scroll reveals for the static sub-pages.
 *
 * The homepage animates content in as it enters the viewport; these pages do
 * the same without importing its animation stack. Elements are hidden only
 * after this script runs and only when motion is allowed, so a visitor with
 * JavaScript disabled, an unreachable CDN, or reduced motion set simply sees
 * the page.
 */
(function () {
  "use strict";

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!("IntersectionObserver" in window)) return;

  var elements = Array.prototype.slice.call(
    document.querySelectorAll("[data-reveal]"),
  );
  if (!elements.length) return;

  elements.forEach(function (el) {
    el.classList.add("reveal-pending");
  });

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("reveal-in");
        observer.unobserve(entry.target);
      });
    },
    // Fire slightly before the element clears the fold, matching the
    // homepage's "top 88%" trigger.
    { rootMargin: "0px 0px -12% 0px" },
  );

  elements.forEach(function (el) {
    observer.observe(el);
  });
})();
