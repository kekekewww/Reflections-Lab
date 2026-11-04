# Hosted build with a visitor's own Meta key (2026-11-05)

This records the owner's decision, how the hosted build handles a key, how it was tested, and what's still open. The build has not been deployed.

## Decision

On 2026-11-05 the owner chose a key field on the page for a hosted static site. It's a narrow exception to the rule that a Meta key stays on the server, and it applies only to a visitor's own key in the hosted build.

- The local app is unchanged. Its bundle has no browser path to Meta, and the owner's key stays server-only.
- The owner's key is never used by the hosted build.
- A key in a URL was rejected, because URLs end up in browser history, logs and shared links.

## How it works

`npm run build:site` builds to `dist-site` with `vite.site.config.ts`. With no server behind the page, the visitor's tab runs the same planner code the local server uses, including the check on a copy of the scene and the correction rounds. Offline tools, physics, acoustics, audio, recording and replay work as they do locally.

The key field appears in the **Meta experiment agent** tab when **Meta Model API** is selected.

## What protects the key

| Risk | Rule | Where |
| --- | --- | --- |
| The key is saved | It's held in one variable, never in React state, storage, the URL or the scene | `src/ai/browser-key.ts`, `src/ui/BrowserKeyField.tsx` |
| The key outlives the page | Reload, closing the tab, **Forget key** and leaving the page all clear it, and **Forget key** also stops a running request | `src/ai/browser-agent.ts`, `src/ui/BrowserKeyField.tsx` |
| The key goes elsewhere | The page can only connect to itself and `https://api.meta.ai` | `connect-src` in `scripts/build-site.mjs` |
| Other scripts read it | Inline and third-party scripts are blocked | `script-src` in `scripts/build-site.mjs` |
| The page is framed | Other sites can't embed it | `frame-ancestors` in `scripts/build-site.mjs` |
| Cookies or the referrer leak | Requests to Meta send neither | `src/ai/browser-agent.ts` |
| Error messages repeat it | Replies containing the key are refused, and errors carry fixed text | `server/meta-provider.ts`, `src/ai/browser-agent.ts` |
| A browser saves it as a password | It's a password-style field outside a form, with autocomplete off | `src/ui/BrowserKeyField.tsx` |

## Spending limits

The visitor's Meta account pays. Each time a key is entered, the page stops at 40 requests or about US$3 of estimated cost, using list prices of US$1.25 per million input tokens and US$4.25 per million output tokens. It never retries on its own, so an unclear failure can't charge twice. These limits live in the tab and restart on a reload, so they prevent accidents rather than enforce a budget. Meta's own limits on the visitor's account still apply.

## Evidence

All results are in [artifacts/v1/browser-key-site-20261105](../../artifacts/v1/browser-key-site-20261105).

| Check | Result |
| --- | --- |
| Real browser call to Meta with a deliberately invalid token | Brave 156, Chromium 156, Firefox 157 and WebKit 27.2 all reached Meta and read its 401 reply |
| Key field against a mocked Meta API, with the real `_headers` rules applied | Brave 42 of 42, Firefox 41 of 41, WebKit 41 of 41 |
| Key absent from the page, URL, cookies, both storages, IndexedDB, caches, logs and the site server | Passed in all three |
| Sending data to any other site | Blocked by the network rules in all three |
| Local bundle | Contains no `v1/chat/completions` path. It only has the key field's help text |

Firefox and WebKit ran headless without the audio step. Brave ran the full flow with sound. The token and key used were fixtures, and none of this spent anything.

To repeat the checks:

```powershell
npm run test:browser:site
node tests/browser/site-key-field.mjs firefox --no-audio
node tests/browser/site-key-field.mjs webkit --no-audio
node tests/browser/meta-browser-access.mjs
```

## Still open

1. **A real key hasn't been tried in a browser.** Meta's refusal was readable, but a successful reply hasn't been seen. The owner needs to type a real key on the page and run one instruction. It will spend a few cents.
2. **Firefox warns this will stop working.** Meta answers with `Access-Control-Allow-Headers: *`, and Firefox 157 warns that this "soon" won't cover the `Authorization` header. If Firefox or another browser enforces that, the call will fail with a connection message until Meta names the header or a relay is added.
3. **The page allows `unsafe-eval`.** The validator library, Ajv, compiles its schemas at runtime, and the app only compiles schemas in its own bundle. Precompiling them would remove this, but it means changing code the local app shares.
4. **Visitors have to trust the host.** Whoever controls the deployed page could change it to read the key. The network rules protect against other scripts, not against the site's owner. A visitor should use a key they can revoke.
5. **Meta's terms for keys in a browser haven't been reviewed.** The owner should check them before deploying.
6. **Licence gaps remain.** Hosting a compiled bundle is distribution. `third-party-notices.txt` lists the 15 bundled packages, but the [third-party notices](../01-compliance/V1_THIRD_PARTY_NOTICES.md) still record six open gaps, including React Three Fiber's source lineage and Rapier's exact Rust and WASM dependencies.
7. **The check on a copy of the scene runs on the main thread.** A large proposal could briefly hold up the page.
8. **The network rules need a host that reads `_headers`,** such as Cloudflare Pages. On any other host, the key would have less protection.

## Deploying

The owner hasn't approved a deployment. Once they do:

```powershell
npm run build:site
npx wrangler pages deploy dist-site --project-name reflection-lab
```
