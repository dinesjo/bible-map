# UI release code review

Reviewed the pending atlas redesign against `ed24963`, including map and journey layers, search and filters, URL/history restoration, modal focus, reader state, data provenance, renderer loading and recovery, responsive CSS, and container serving.

## Findings addressed

- **Detached panels retained by the shared resize observer.** Searches and place changes replace several observed DOM elements without unobserving the previous elements. A six-step browser search sequence grew registrations from 8 to 26, including 18 detached elements. Binding now releases disconnected targets and observes reconnected elements independently of their event-listener binding. Repeating twelve search changes after the fix left 8 registrations and 0 detached elements. The development map report exposes these counts for repeat verification.
- **Validation ran only after merging.** The existing workflow publishes on `main` and provided no pull-request checks. Added a read-only PR workflow that runs the 38 tests, validates the pinned data, builds the app and production image, validates Nginx configuration, starts the container, and checks its HTTP responses. The HTTP smoke check compares ten served assets with the build and checks MIME types, gzip, cache policy, ETags, conditional requests, and missing-file 404s.

## Local validation

- `npm run check`: 38 tests passed, 1,309 place records and 10 journeys validated, production build passed.
- `npm run check:server -- http://127.0.0.1:5174`: ten asset checks and both missing-file checks passed against the compiled Nginx preview.
- `npm audit --omit=dev --audit-level=high`: no known production dependency vulnerabilities reported.
- Browser regression: repeated search rerenders leave no detached scroll-observer targets. The preceding [UI audit](./ui-polish-2026-10-20.md) records desktop, phone, keyboard, history, provider-failure, map-layout, and accessibility checks.
- The post-fix accessibility scan reported 0 violations. Its one automatic review item concerns the hidden journey dialog referenced by `aria-controls`; the target exists and the relationship was checked during the UI audit.

The generated OpenBible snapshot is unchanged. No further blocking issue was found in this review. Physical devices, external screen readers, and the deployed URL remain unverified by the local audit; CI verifies the actual production container separately.
