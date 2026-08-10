/* Copyright (c) 2026 QuarkX Sdn. Bhd. (202501056786 / 1658192-K). All rights reserved. */

/**
 * Page smoke tests.
 *
 * There is no application logic here to unit test, so these assert the things
 * that actually break a static site: a page that fails to load, a script error,
 * a missing canonical tag, and layout that overflows the viewport on a phone.
 */

const { test, expect } = require("@playwright/test");

/** Every indexable route, kept in step with sitemap.xml. */
const ROUTES = ["/", "/chiller/", "/records/", "/speaking/", "/brochure/"];

/**
 * Viewports chosen to bracket the layout: the narrowest phone we support, the
 * tablet breakpoint where the header stops stacking, and a desktop width.
 */
const VIEWPORTS = [
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1400, height: 900 },
];

/**
 * Horizontal overflow, in pixels, tolerated per route while a known defect is
 * outstanding. Entries are ceilings, not targets: lower them as they are fixed,
 * and delete the entry once the route is clean.
 */
const KNOWN_OVERFLOW = {
  "/": 118,
};

/** Console noise that is expected and not a defect. */
const IGNORED_CONSOLE = [
  /favicon/i,
  // The homepage loads Three.js, GSAP and Lenis from a CDN. A blocked CDN is an
  // environment problem, not a regression in this repository.
  /cdn\.jsdelivr\.net/i,
];

for (const route of ROUTES) {
  for (const viewport of VIEWPORTS) {
    test(`${route} renders cleanly on ${viewport.name}`, async ({ page }) => {
      const errors = [];
      page.on("console", (msg) => {
        if (msg.type() !== "error") return;
        const text = msg.text();
        if (IGNORED_CONSOLE.some((re) => re.test(text))) return;
        errors.push(text);
      });
      page.on("pageerror", (err) => errors.push(String(err)));

      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(response?.status(), `${route} should return 200`).toBe(200);

      await expect(page.locator("h1").first()).toBeVisible();
      await expect(page).toHaveTitle(/QuarkX/);

      const canonical = page.locator('link[rel="canonical"]');
      await expect(canonical).toHaveCount(1);
      await expect(canonical).toHaveAttribute("href", /^https:\/\/www\.quarkx\.tech\//);

      // A page may scroll down. It must never scroll sideways: that is the
      // signature of a fixed width escaping its container.
      //
      // The homepage carries a pre-existing 118px overflow, present on the live
      // site before this suite existed and originating inside the scroll-driven
      // WebGL narrative. Rather than relax the rule, its current value is pinned
      // as a ceiling so the defect stays visible and cannot grow.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      const allowed = KNOWN_OVERFLOW[route] ?? 1;
      expect(overflow, `${route} overflows horizontally by ${overflow}px`).toBeLessThanOrEqual(
        allowed,
      );

      expect(errors, `console errors on ${route}`).toEqual([]);
    });
  }
}

test("every route in the sitemap is reachable", async ({ page, baseURL }) => {
  const response = await page.goto("/sitemap.xml");
  expect(response?.status()).toBe(200);

  const xml = await response.text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  expect(locs.length).toBe(ROUTES.length);

  for (const loc of locs) {
    const route = new URL(loc).pathname;
    const res = await page.request.get(new URL(route, baseURL).toString());
    expect(res.status(), `${route} from sitemap.xml`).toBe(200);
  }
});

test("robots.txt points at the sitemap", async ({ page }) => {
  const response = await page.goto("/robots.txt");
  expect(response?.status()).toBe(200);
  expect(await response.text()).toContain("https://www.quarkx.tech/sitemap.xml");
});
