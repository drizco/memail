# Chrome authentication repair and verification

This is a **draft implementation**, not a verified production OAuth deployment.
The remaining release gate is validation of the Chrome OAuth client with an
isolated Google test account. Do not merge/release solely on mocked test results.

## Investigation

Baseline: `main` at `5fb6dca8f9902806f20b13d77713cba282fc2719`.
The public Web Store listing was version 5.0.2 on 2026-10-25. A separate download
of that package had SHA-256
`34407eeadef738215731ee3acab59843d6373250534b52a1023cbfeeb4de3140`.
Its `popup.js` and `utils.js` match the baseline (ignoring trailing whitespace).
The same isolated baseline reproduction also passed against that extracted package.
No installed extension or personal browser profile was accessed or changed.

The source-level cause is loss of reusable authentication on popup destruction:

- Baseline `extension/src/utils.js:getGoogleToken` uses
  `launchWebAuthFlow`, not `getAuthToken`. Every call starts a new implicit OAuth
  flow using the web client ending `nf6lc5mn3fiu3t8t9jhatfflj7gt3b0l`.
- Baseline `popup.js:EmailController` keeps its Firebase ID token only in a
  popup instance. Every `DOMContentLoaded` constructs another instance and
  repeats Google authentication and the Firebase REST exchange. There is no
  service worker or persisted Firebase Auth SDK session.
- `authenticate(false)` already tries silent web auth. However, a web flow has
  no Chrome-managed access-token cache. Chrome's default non-interactive web
  flow ends if initial navigation doesn't complete authentication. Consent,
  account selection, or a page requiring further navigation can therefore
  make every popup repeat the sign-in path. The catch also misclassifies
  Firebase outages and tab failures as reasons to sign in.
- The original flow captures the active page *after* authentication changes
  browser focus, and has no concurrency guard.
- `functions/index.js:sendMeMailV2` expects a **Firebase ID token**, verifies it
  with Firebase Admin, and derives the recipient from its email claim. Google
  access tokens must not be sent directly to `/send`. Verification errors
  currently become HTTP 500, as do SMTP failures. Retrying those responses
  could duplicate mail; this patch does not retry delivery or change the API.

The repeated-login path was reproduced with an intentionally non-silent mock
identity provider in both the original DOM and a real Chromium extension page:
`false, true, false, true` over two popup openings. This proves the code path,
**not the precise Google-side reason the user's silent authorization failed**.
No signed-in Google session was available/used to establish that last fact.

The manifest public key derives ID `fflpcmbjflhfimhfhgcdmgjinglgflhk`, matching
the store listing. There is no demonstrated unpacked-versus-store ID mismatch.

## Implementation

- `utils.getGoogleToken` defaults to `chrome.identity.getAuthToken` with
  `interactive: false`. Only the existing user-initiated sign-in button requests
  `interactive: true`. Missing grants/signed-out Chrome offer that button;
  cancellation, configuration, network, and backend errors stay error states.
- Chrome owns token caching and expiration. Each send exchanges the current
  Google token for a fresh Firebase ID token. Firebase credentials and refresh
  tokens are not persisted; no tokens or response bodies are logged.
- A rejected provider credential at the Firebase exchange evicts only that
  Google token and retries the exchange once, using silent authentication.
  Repeated rejection stops. There is no automatic retry after delivery starts.
- `background.js` owns the operation so closing the popup does not cancel it.
  Overlapping popup requests join the same pending operation. No auth or page
  information is written to storage. A restarted idle worker starts clean and
  consults Chrome again.
- The popup captures metadata before authentication, reports errors without
  auto-closing, and accepts success only after HTTP success plus `success` body.
- Fetches time out at 20 seconds, below Chrome's 30-second fetch-response limit.
  Minimum Chrome 110 declares the extension-API worker timer behavior relied on.
  Permissions, scopes (`openid email profile`), Firebase endpoint and email
  payload are unchanged. The sending view retains the page title but no longer
  displays the recipient while waiting; credentials stay inside the worker.

### OAuth configuration gate (required before merge)

PR [#27](https://github.com/drizco/memail/pull/27) replaced `getAuthToken` as a
production sign-in fix. Its brief description does **not** establish why that
client failed. This patch restores the historical Chrome client
`294672396739-f3ren28g147gkd0hj3pnl7eb4sspn0vd.apps.googleusercontent.com`
from that PR's parent, rather than inventing a client or incorrectly using the
web-flow client with `getAuthToken`.

The owner must verify in Google Cloud that this is an enabled Chrome Extension
OAuth client registered for `fflpcmbjflhfimhfhgcdmgjinglgflhk`, with the expected
consent/test-user configuration, and verify the Firebase exchange in an isolated
test environment. A fresh unsigned browser reaching the sign-in button does
**not** validate server-side client configuration. If the historical client is
misconfigured, fix/provide its configuration before release. This work made no
Google Cloud or Firebase configuration changes.

Chrome Identity chooses from Chrome profile accounts and manages its account
preferences. This differs from a website-only Google cookie session. Existing
web-flow consent may require one authorization of the Chrome client. Validate
multi-account selection, signed-out/browser-sign-in-disabled profiles and
account switching manually; no parity with all web-only account flows is claimed.

## Repeatable checks

Node 22 is the backend's declared runtime. From the repository root:

```sh
npm --prefix extension ci
npm --prefix functions ci
npm --prefix extension test -- --runInBand
npm --prefix functions test -- --runInBand
npm --prefix functions run lint
node --check extension/src/utils.js
node --check extension/src/popup.js
node --check extension/src/background.js
npm --prefix extension run build
unzip -t extension/dist/memail-extension.zip
```

Install the pinned browser and run E2E:

```sh
cd extension
npx playwright install chromium
npm run test:e2e
```

If needed, use `PLAYWRIGHT_BROWSERS_PATH=/path/to/browser-cache` for **both**
installation and execution. A fresh checkout needs the baseline commit object
for the before-fix test (`git fetch origin main` for a shallow clone).

The E2E suite creates a temporary profile and temporary copy of the extension.
Only the test copy gets loopback host access, an identity shim and redirected
Firebase/delivery requests. No test shim, extra host permission or dependency
enters the production ZIP. Google identity grants live in the local mock server,
outside worker/browser contexts; their persistence is **simulated**. Real
Chromium page teardown, worker termination and browser restart are exercised.
A worker instance identifier verifies that worker state was actually recreated.
One fresh-profile case uses the unmocked Chrome Identity API, stops at the sign-in
button, and never authorizes or sends mail.

Playwright cannot expose the native toolbar popup as a Page in this setup
(`action.openPopup` was attempted and no Page event arrived). Tests therefore
open the same `popup.html` in an inactive extension tab, leaving a local article
as the active tab for the **real** `chrome.tabs.query`. Runtime messages,
extension worker execution, DOM feedback, HTTP payload and response handling
are real. The toolbar click/`activeTab` grant and Google consent dialog remain
manual release checks; this is not live Google/email E2E.

Each test attaches `sanitized-flow.json` containing only interaction flags,
exchange counts, test page payloads, authorization booleans and random worker
instance IDs. The repeated-click case also writes `first-use.png` and
`success.png`. No tokens are included in evidence. Default artifacts are under
`extension/test-results/` (ignored).

To run the baseline case against a separately extracted public store package:

```sh
MEMAIL_BASELINE_DIR=/absolute/path/to/extracted-package npm run test:e2e -- --grep baseline
```

## Coverage and observed results

- Original extension tests: 8 passed, 1 failed (stale Cloud Function URL).
- Original backend tests: 5 passed, 3 failed (missing `req.query`, stale email
  format/subject expectations, unmocked page fetching).
- Fixed extension suite: 42 passing tests covering first use, explicit login,
  ten subsequent sends, isolated worker contexts, account changes/revocation,
  cancellation, invalid credentials, bounded renewal, malformed Firebase data,
  network/server errors, popup feedback, metadata capture and concurrency.
- Backend suite: 8 passing tests after correcting only test fixtures and stale
  expectations; page fetches are now mocked. Production backend is unchanged.
- Chromium 145.0.7632.6 suite on Node 22.16.0: 10 passing scenarios, including the before-fix reproduction,
  unmocked unsigned first use, repeated popup reopening, browser restart,
  actual worker restart, popup closure during delivery, overlapping sends,
  explicit cancellation, auth outage, delivery outage, lost response and renewal
  (some scenarios combine multiple checks).
- Backend lint, JavaScript syntax checks, extension ZIP build/integrity pass.
  The extension has no existing lint/type-check script and uses JavaScript.

## Limits and manual release checks

1. Use a dedicated test Google account and isolated Firebase/mail backend to
   validate the restored OAuth client, one initial consent, ten sends, expiry,
   profile/browser restart, account switching and revocation. Inspect sanitized
   flags/statuses only. Do not use personal accounts or production delivery.
2. Verify the native toolbar popup and `activeTab` grant on supported Chrome,
   including the declared oldest version. Chromium 145 is the automated browser;
   Chrome 110 itself was not run.
3. No end-to-end email was sent. Local HTTP delivery success and mocked backend
   SMTP tests do not prove actual mailbox receipt.
4. The existing backend lacks idempotency. The worker prevents concurrent
   application sends and never replays an ambiguous request, but cannot promise
   exactly-once delivery across browser crashes, manual retries, or HTTP-layer
   retries. A test that destroyed a reused TCP connection before response
   headers observed Chromium replay the POST despite a single JS fetch call.
   The lost-response test instead disconnects after headers and verifies the
   honest error UI and absence of an application retry. Durable deduplication
   would need a separate backend/privacy design; none is silently introduced.
5. A forced worker/browser termination during a send has an unknown outcome.
   After restarting, check the inbox before requesting the same page again.
6. No LICENSE file or CONTRIBUTING/AGENTS instructions were found. The extension
   package says ISC, but no repository-wide license grant was assumed or added.
   No overlapping open auth PR/issues were found; open PRs were dependency bumps.
7. Dependency installation reported existing dependency advisories. No broad
   dependency remediation, production deployment or store publishing is included.

## Official references

- [Chrome Identity](https://developer.chrome.com/docs/extensions/reference/api/identity):
  token cache/expiry, silent versus interactive requests, and token invalidation.
- [Chrome OAuth setup](https://developer.chrome.com/docs/extensions/how-to/integrate/oauth):
  stable extension ID and Chrome OAuth client registration.
- [Firebase extensions guide](https://firebase.google.com/docs/auth/web/chrome-extension):
  MV3 authentication and handling provider credentials independently. No Firebase
  popup SDK/offscreen document is introduced by this REST-based implementation.
- [Firebase REST authentication](https://firebase.google.com/docs/reference/rest/auth#section-sign-in-with-oauth-credential):
  provider-token exchange and invalid provider credential errors.
- [Worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle):
  restarts, timer behavior and fetch limits.
- [Chromium identity constants](https://github.com/chromium/chromium/blob/main/chrome/browser/extensions/api/identity/identity_constants.h):
  precise authorization-required errors, distinct from connection/config errors.
- [Playwright extension testing](https://playwright.dev/docs/chrome-extensions):
  isolated persistent Chromium contexts and extension-page testing.
