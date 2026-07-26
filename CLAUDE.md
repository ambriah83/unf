# WOS Alliance HQ — project context

Multi-alliance management app for Whiteout Survival. Built for Ambria (in-game: **Strata**, UNF United Front, State 3400 — alliance code `unf`). Anyone can create an alliance; each is isolated.

**Live:** https://ambriah83.github.io/wos-hq/ · repo `ambriah83/wos-hq` · **deploy = push to main** (GitHub Pages, ~1 min build + up to 10-min CDN cache; the in-app ⟳ button cache-busts).

## Stack
- Single-file app: `index.html` (vanilla JS, frost theme, snow overlay) + `i18n.js` (11 languages, `t()`/`tCat()`/`LANGS`/`LOCALE()`) + `sw.js` (web push) + `manifest.json` (PWA).
- Backend: Supabase project **pxzkbrgmosykxmkevgek** (free tier). All secrets (alliance passcodes, Anthropic API key, VAPID keys) live in the RLS-locked `app_secret` table — **never in this repo (it's public)**.
- Scraper: `.github/workflows/codes.yml` every 6h runs `scripts/scrape-codes.mjs` → WSCO gift codes → `community_codes` (repo secret `SCRAPER_PASS` gates the write RPC).

## Data model (Postgres, all access via security-definer RPCs, anon key only)
- `alliance_state(id=slug, data jsonb, updated_at)` — whole alliance state as one blob: `{meta{name,state}, team[{id,name,role,wosId}], duties[], links[], codes[], teamOrdered}`. Duty: `{id,cat,name,freq,primary[],backup[],notes,days,next,time,rsvp,going[],legions[{id,name,leader[],time,going[]}],msgs[{id,title,body}]}`.
- `app_secret(id,pass)` — alliance passcodes + `anthropic`, `vapid_pub`, `vapid_priv`, `scraper`.
- `app_user` (bcrypt via pgcrypto — functions need `search_path = public, extensions`), `app_session` (tokens, 180d), `chat_log`, `community_codes`, `push_sub`, `notify_log`.
- Roles: first registrant per alliance = **ADMIN**; then R5/R4/R3. R3 = read-only (server-enforced in `put_state2`). Standard chain: ADMIN=everything+accounts; R5=everything else; R4=tasks/codes/messages; R3=view+copy+RSVP/bear-claim.
- Key RPCs: register/login/me/logout/change_pass/self_reset(passcode-verified, ADMIN excluded), get_state2/put_state2(tok), rsvp, claim_bear (exclusive across `Bear Trap %`), join_legion (exclusive within duty), update_profile(tz,bday MM-DD,loc,lang), list_profiles, list_users/set_role/remove_user/admin_reset_pass/admin_set_name (ADMIN), get/set_alliance_pass (ADMIN), chat_feedback/my_chat_log/admin_chat_log, save/remove_push_sub, set_community_codes, create_alliance2.

## Sync model (learned the hard way)
Last-write-wins blob + safety rails: **never push before first successful pull** (`lastSynced===0` guard), push does merge-check first and **aborts if it fails**, `mergeState()` unions teams/msgs/codes and fills empty fields. Poll 20s, push debounce 800ms. A 7/26 incident wiped state when these were missing — do not weaken them. 🛟 restore card offers `BOOT_CACHE` when remote looks blank.

## Edge functions (Deno; MCP deploy)
- `ai-chat` ("Frosty"): claude-sonnet-5, key from app_secret; alliance-state context; vision (gear screenshots); update_settings tool; **UNF-only gate** (u.aid!=='unf' → friendly no). max_tokens 4000 (900 caused empty replies). Logs to chat_log.
- `notify`: npm:web-push (works on Supabase Deno). Modes: `test` (self-ping) + `cron`. pg_cron job `wos-notify` every 10 min via pg_net. Alerts: ~30 min before timed events & legion times; 12:00 UTC digest for untimed same-day; new gift codes. `notify_log` dedupes (scraper bumps updated_at each run, so dedup is the only spam guard).

## Conventions & gotchas
- All event math in **UTC server days** (`utcDay`); `next` = date-only meaning, `time`/legion times = "HH:MM" UTC, displayed via viewer TZ (per-device + per-account). `effTime()` = duty time else earliest legion time (drives sort/badge/dueDD).
- Countdown labels: TODAY / weekday (<7d, viewer-local for timed) / date; bear traps show times, legion events show date only (legion rows carry times).
- No native `confirm()`/`alert()` — tap-twice `armed(btn)` pattern (blocked in some webviews).
- Name matching roster↔accounts: `normName()` NFKD fuzzy. Users must register with exact in-game username; ADMIN can rename via ✎.
- Login loss ≠ server: in-app browsers (Discord) drop localStorage — users must use real browser / home-screen PWA (also required for iOS push).
- New-alliance form auto-generates code `firstword+state` (e.g. cia3446) + passcode `FrostWord##`, then shows a save-this recap.
- Client storage keys: `wos-tok`, `wos-aid`, `wos-tz`, `wos-lang`, `wos-push`, `wos-coll`, cache `wos-hq-<aid>`.
- Testing style: localhost preview via `.claude/launch.json` (`wos-app`, port 8377, in Earth Website cwd), fake `TOK='x'` for UI-only checks (server rejects), always clean up test rows (`ztest-*` alliances).

## Pending / ideas
Custom domain (she buys, then configure Pages + DNS); Frosty for other alliances (per-alliance API keys); attendance tracker; "on duty today" strip; deeper i18n (modals partially English); verify Discord invite discord.gg/9TpHttPBP works.
