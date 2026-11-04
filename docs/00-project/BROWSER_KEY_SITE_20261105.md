# Hosted build with a visitor's own Meta key (2026-11-05)

This records the owner's decision, how the hosted build handles a key, how it was tested, and what's still open. The build has not been deployed.

## Decision

On 2026-11-05 the owner chose a key field on the page for a hosted static site. It's a narrow exception to the rule that a Meta key stays on the server, and it applies only to a visitor's own key in the hosted build.

- The local app is unchanged. Its bundle has no browser path to Meta, and `npm run build` now fails if it ever gains one. The owner's key stays server-only.
- The owner's key is never used by the hosted build.
- A key in a URL was rejected, because URLs end up in browser history, logs and shared links.

## How it works

`npm run build:site` builds to `dist-site` with `vite.site.config.ts`. With no server behind the page, the visitor's tab runs the same planner code the local server uses, including the check on a copy of the scene and the correction rounds.

The key field appears in the **Meta experiment agent** tab when **Meta Model API** is selected.

## What protects the key

| Risk | Rule | Where |
| --- | --- | --- |
| The key is saved | It's held in one variable, never in React state, storage, the URL or the scene | `src/ai/browser-key.ts`, `src/ui/BrowserKeyField.tsx` |
| The key outlives the page | Reload, closing the tab, **Forget key** and leaving the page all clear it, and **Forget key** also stops a running request | `src/ai/browser-agent.ts`, `src/ui/BrowserKeyField.tsx` |
| The app sends it elsewhere | Requests go only to `https://api.meta.ai`, and the page's fetch-style requests can only reach itself and Meta | `src/ai/browser-agent.ts`, `connect-src` in `scripts/build-site.mjs` |
| Other scripts read it | Inline and third-party scripts are blocked. The bundled dependencies are still trusted | `script-src` in `scripts/build-site.mjs` |
| The page is framed | Other sites can't embed it | `frame-ancestors` in `scripts/build-site.mjs` |
| Cookies or the referrer leak | Requests to Meta send neither | `src/ai/browser-agent.ts` |
| Error messages repeat it | Replies containing the key are refused, and request errors don't include it | `server/meta-provider.ts`, `src/ai/browser-agent.ts` |
| A browser saves it as a password | It's a password-style field outside a form, with autocomplete off. A password manager may still offer to save it | `src/ui/BrowserKeyField.tsx` |

## Spending limits

The visitor's Meta account pays. Each time a key is entered, the page stops at 40 requests or about US$3 of estimated cost, using list prices of US$1.25 per million input tokens and US$4.25 per million output tokens. It never retries on its own, so an unclear failure can't charge twice. These limits live in the tab and restart on a reload, so they prevent accidents rather than enforce a budget. Meta's own limits on the visitor's account still apply.

The owner's test spent from their Meta account outside the project's budget ledger, because this build has no server. The amount wasn't measured. Similar small instructions cost a few cents.

## Evidence

All results are in [artifacts/v1/browser-key-site-20261105](../../artifacts/v1/browser-key-site-20261105).

| Check | Result |
| --- | --- |
| Real browser call to Meta with a deliberately invalid token | Brave 156, Chromium 156, Firefox 157 and WebKit 27.2 all reached Meta and read its 401 reply |
| Key field against a mocked Meta API, with the real `_headers` rules applied | Brave 48 of 48, Firefox 43 of 43, WebKit 43 of 43 |
| Key absent from the page, URL, cookies, both storages, IndexedDB, caches, logs and the site server | Passed in all three |
| A fetch to another site | Blocked by the network rules in all three |
| One small instruction with the owner's real key, in their usual browser, with this build served locally under its real `_headers` rules (2026-11-05) | The owner reported that it worked. It wasn't independently observed, and no log was kept |
| Sound, offline tools, recording, replay and first person under the same rules | Passed in Brave. Not run in Firefox or WebKit |
| Local bundle | `npm run build` scans it and fails if it contains Meta's request path |

Firefox and WebKit ran headless without the sound, recording, replay and first-person steps. Apart from the owner's test, the tokens and keys were fixtures and spent nothing. Leaving the page was simulated with a page-cache event, not a real Back navigation.

To repeat the checks:

```powershell
npm run test:browser:site
node tests/browser/site-key-field.mjs firefox --no-audio
node tests/browser/site-key-field.mjs webkit --no-audio
node tests/browser/meta-browser-access.mjs
```

## Still open

1. **A real key has only been tried once.** It hasn't been tried in every browser, on a deployed site, with a large scene or with a sound instruction.
2. **Firefox warns this will stop working.** Meta answers with `Access-Control-Allow-Headers: *`, and Firefox 157 warns that this "soon" won't cover the `Authorization` header. If Firefox or another browser enforces that, the call will fail with a connection message until Meta names the header or a relay is added.
3. **The network rules have limits.** They stop fetch-style requests to other sites, but not a script navigating the page away, and no current browser rule can. They protect against third-party scripts, not against code already running in the page.
4. **Visitors have to trust the host and the bundled dependencies.** Whoever controls the deployed page could change it to read the key. A visitor should use a key they can revoke.
5. **The page allows `unsafe-eval`.** The validator library, Ajv, compiles its schemas at runtime, and the app only compiles schemas in its own bundle. Precompiling them would remove this, but it means changing code the local app shares.
6. **Meta's guidance points the other way.** Its [authentication docs](https://dev.meta.ai/docs/authentication) say to keep keys out of browser code, to proxy requests through a server you control, and to use a separate key for each app. They warn that a leaked key can use up rate limits, access uploaded files and send requests. A visitor typing their own key isn't the same as shipping a key in page code, but the key is still in the browser. A proxy would follow the guidance, but the proxy's owner could then see visitors' keys. The field's help text tells visitors to use a separate key they can delete. Meta's terms themselves weren't read, because `dev.meta.ai/terms` doesn't exist and no other terms page was found, so the owner should check them before deploying.
7. **Licence gaps remain.** Hosting a compiled bundle is distribution. `third-party-notices.txt` lists the 15 bundled packages, but the [third-party notices](../01-compliance/V1_THIRD_PARTY_NOTICES.md) still record six open gaps, including React Three Fiber's source lineage and Rapier's exact Rust and WASM dependencies.
8. **The check on a copy of the scene runs on the main thread.** A large proposal could briefly hold up the page.
9. **The network rules need a host that reads `_headers`,** such as Cloudflare Pages. On any other host, the key would have less protection.

## Deploying

The owner hasn't approved a deployment. Once they do:

```powershell
npm run build:site
npx wrangler pages deploy dist-site --project-name reflection-lab
```
