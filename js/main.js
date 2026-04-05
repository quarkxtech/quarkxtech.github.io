/* ============================================================
   QuarkX — Clean JS
   Combined scroll handler, active nav, reveal, hamburger with focus trap,
   back-to-top, keyboard shortcuts
   ============================================================ */

(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    setupScroll();
    setupActiveNav();
    setupHamburger();
    setupSmoothScroll();
    setupBackToTop();
    setupFAQExpanded();
  }

  // ========== Combined scroll handler ==========
  function setupScroll() {
    const header = document.getElementById("site-header");
    const bar = document.getElementById("scroll-progress");
    const backToTop = document.getElementById("back-to-top");
    if (!header && !bar && !backToTop) return;

    let ticking = false;
    function onScroll() {
      if (!ticking) {
        requestAnimationFrame(() => {
          const scrollY = window.scrollY;
          if (header) header.classList.toggle("scrolled", scrollY > 40);
          if (bar) {
            const docHeight =
              document.documentElement.scrollHeight - window.innerHeight;
            const progress = docHeight > 0 ? scrollY / docHeight : 0;
            bar.style.transform = "scaleX(" + progress + ")";
            bar.setAttribute("aria-valuenow", Math.round(progress * 100));
          }
          if (backToTop) {
            backToTop.hidden = scrollY < 600;
          }
          ticking = false;
        });
        ticking = true;
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  // ========== Active Nav Highlighting ==========
  function setupActiveNav() {
    const navLinks = document.querySelectorAll(".header-nav a");
    const sections = [];

    navLinks.forEach((link) => {
      const href = link.getAttribute("href");
      if (href && href.startsWith("#")) {
        const section = document.querySelector(href);
        if (section) sections.push({ el: section, link });
      }
    });

    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const match = sections.find((s) => s.el === entry.target);
          if (match) {
            match.link.classList.toggle("active", entry.isIntersecting);
          }
        });
      },
      { threshold: 0.3, rootMargin: "-80px 0px -40% 0px" },
    );

    sections.forEach((s) => observer.observe(s.el));
  }

  // ========== Hamburger with Focus Trap + iOS scroll fix ==========
  function setupHamburger() {
    const toggle = document.getElementById("menu-toggle");
    const menu = document.getElementById("mobile-menu");
    const links = menu ? Array.from(menu.querySelectorAll(".mobile-link")) : [];
    if (!toggle || !menu) return;

    let lastFocused = null;
    let scrollY = 0;

    function openMenu() {
      lastFocused = document.activeElement;
      scrollY = window.scrollY;

      menu.classList.add("open");
      menu.setAttribute("aria-hidden", "false");
      toggle.setAttribute("aria-expanded", "true");
      toggle.setAttribute("aria-label", "Close menu");

      document.documentElement.classList.add("menu-open");
      document.body.classList.add("menu-open");

      // Hide background content from screen readers
      const main = document.getElementById("main");
      const header = document.getElementById("site-header");
      if (main) main.setAttribute("aria-hidden", "true");
      if (header) header.setAttribute("aria-hidden", "true");

      links.forEach((link) => link.setAttribute("tabindex", "0"));

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (links.length) links[0].focus();
        });
      });
    }

    function closeMenu() {
      menu.classList.remove("open");
      menu.setAttribute("aria-hidden", "true");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open menu");

      document.documentElement.classList.remove("menu-open");
      document.body.classList.remove("menu-open");
      window.scrollTo(0, scrollY);

      // Restore background content for screen readers
      const main = document.getElementById("main");
      const header = document.getElementById("site-header");
      if (main) main.removeAttribute("aria-hidden");
      if (header) header.removeAttribute("aria-hidden");

      links.forEach((link) => link.setAttribute("tabindex", "-1"));

      if (lastFocused) lastFocused.focus();
    }

    toggle.addEventListener("click", () => {
      menu.classList.contains("open") ? closeMenu() : openMenu();
    });

    links.forEach((link) => link.addEventListener("click", closeMenu));

    // Focus trap
    menu.addEventListener("keydown", (e) => {
      if (e.key !== "Tab") return;
      const focusable = links.filter(
        (l) => l.getAttribute("tabindex") !== "-1",
      );
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && menu.classList.contains("open")) closeMenu();
    });
  }

  // ========== Smooth Scroll (no pushState) ==========
  function setupSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener("click", (e) => {
        const href = link.getAttribute("href");
        if (href === "#") return;

        const target = document.querySelector(href);
        if (!target) return;

        e.preventDefault();
        const headerH =
          document.getElementById("site-header")?.offsetHeight || 0;
        const pos =
          target.getBoundingClientRect().top + window.scrollY - headerH - 20;

        window.scrollTo({ top: pos, behavior: "smooth" });
      });
    });
  }

  // ========== Back to Top ==========
  function setupBackToTop() {
    const btn = document.getElementById("back-to-top");
    if (!btn) return;

    btn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // ========== FAQ aria-expanded Sync ==========
  function setupFAQExpanded() {
    const details = document.querySelectorAll(".faq-item");
    details.forEach((detail) => {
      const summary = detail.querySelector(".faq-question");
      if (!summary) return;
      summary.setAttribute("aria-expanded", detail.open ? "true" : "false");
      detail.addEventListener("toggle", () => {
        summary.setAttribute("aria-expanded", detail.open ? "true" : "false");
      });
    });
  }
})();
