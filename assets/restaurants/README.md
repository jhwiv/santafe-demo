# Bundled trip-restaurants module

These three files are a snapshot of the picker module that powers the Dining tab:

| File              | Source                                                                                       |
| ----------------- | -------------------------------------------------------------------------------------------- |
| `restaurants.js`  | https://github.com/jhwiv/trip-restaurants — `src/restaurants.js`                              |
| `restaurants.css` | https://github.com/jhwiv/trip-restaurants — `src/restaurants.css`                             |
| `santa-fe.json`   | https://github.com/jhwiv/trip-restaurants — `templates/santa-fe.json`                         |

## To refresh
```bash
cd /path/to/trip-restaurants
cp src/restaurants.js   ../santafe-itinerary/assets/restaurants/restaurants.js
cp src/restaurants.css  ../santafe-itinerary/assets/restaurants/restaurants.css
cp templates/santa-fe.json ../santafe-itinerary/assets/restaurants/santa-fe.json
```

Then commit and push santafe-itinerary. The `auto-cache-bust` workflow will
re-stamp the `?v=` query strings in `index.html` so the new versions go live
immediately (no 10-minute stale-cache window).

## Why bundle instead of CDN-load?
- No third-party dependency for production. The trip is in production-critical
  mode (June 3–10, 2026) so we don't want jsDelivr/raw.githack hiccups breaking
  restaurant booking flows on a phone in Santa Fe.
- Files travel with the deploy. Cloudflare Pages serves them and the PWA
  manifest can include them in the offline cache later if we want.

Last refreshed: 2026-05-27 (commit cb7356d on jhwiv/trip-restaurants)
