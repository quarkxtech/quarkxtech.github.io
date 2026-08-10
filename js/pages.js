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

/**
 * Brochure request form.
 *
 * The form posts natively to Formspree, so it delivers even without
 * JavaScript; the visitor just lands on Formspree's confirmation page. With
 * JavaScript, the submission goes over fetch and the visitor stays here, with
 * the outcome shown inline in the page's own voice.
 */
(function () {
  "use strict";

  var form = document.querySelector("form[data-enhance]");
  if (!form || !window.fetch) return;

  var success = document.getElementById("form-success");
  var failure = document.getElementById("form-failure");
  var button = form.querySelector('button[type="submit"]');
  var restingLabel = button ? button.textContent : "";

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (button) {
      button.disabled = true;
      button.textContent = "Sending";
    }
    if (failure) failure.hidden = true;

    fetch(form.action, {
      method: "POST",
      body: new FormData(form),
      headers: { Accept: "application/json" },
    })
      .then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        form.hidden = true;
        if (success) success.hidden = false;
      })
      .catch(function () {
        // Recoverable: the visitor keeps their filled-in form and a way out.
        if (failure) failure.hidden = false;
        if (button) {
          button.disabled = false;
          button.textContent = restingLabel;
        }
      });
  });
})();

/**
 * Preselect the enquiry subject from the URL, so a card that says "Become the
 * founding partner" lands on a form already set to that conversation.
 */
(function () {
  "use strict";

  var select = document.getElementById("interest");
  if (!select) return;

  var wanted = new URLSearchParams(window.location.search).get("interest");
  if (wanted && select.querySelector('option[value="' + wanted + '"]')) {
    select.value = wanted;
  }
})();
