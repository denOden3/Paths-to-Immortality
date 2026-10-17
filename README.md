## HUD v0.8.14 — compact navigation and reading layout

All header controls and the version remain visible in a shorter header. The session toolbar is one horizontally scrollable row above a one-row expanding composer, neutral character switch and red Send button. Secondary controls use compact 14px labels with 44px touch targets; messages keep 16px text and a subtle narrator accent. Admin navigation becomes aligned rows with tighter section spacing. Current Session retains manual refresh. HUD page behavior, drafts, pairing and stored game data are unchanged. Update each device's installed userscript and reload ChatGPT.

## HUD v0.8.13 — manual Current Session refresh

Current Session has a small refresh button beside its heading on mobile and desktop. Sidebar rooms, participant lists and Heavenly Calendar no longer reload every 12 seconds. They still load at startup, after relevant room actions, when changing the session picker, and when Refresh is pressed. Only a visible, expanded chatroom continues polling messages; minimized HUDs pause that polling. Update the installed userscript and reload ChatGPT to replace older mobile HUD versions.

## Web v0.8.2 — chatroom reading comfort

Compact room and brand headers leave more height for the story. Narration uses a restrained gold accent, a readable line length and consistent typography. The two-line composer grows with typing; the neutral character switcher stays beside the red Send button and moves below the field on narrow screens. Session Info, Scene and Inventory open beside the conversation on wide desktops, or replace the message area on narrow screens, with exclusive active indicators and retained drafts. Message refreshes preserve the reading position when scrolled back. Keyboard focus, readable helper text and comfortable touch targets are retained. HUD unchanged.

## HUD v0.8.12 / Web v0.8.1 — automatic published state updates

The HUD speaker switch occupies its own grid cell beside Send, with a separate row on narrow screens. Session Info, Scene and Inventory sit beside Session Tools and toggle within the chat body while preserving the composer. Paired owner HUDs may inspect participating characters' panels and inventories; ordinary players remain restricted to their own participating characters. Owner characters now have persistent inventory identities too.

The Narrate instruction requests a version-1 PATHS_STATE block on authorized published narration. A server trigger validates and applies inventory deltas and current-scene checkpoints once per message, logs narrator provenance, and keeps discovered descriptions in the location ideas bank. Invalid records roll back all their state changes while retaining the narration and a rejected receipt; receipt status is visible in the owner HUD panels. Player/OOC text cannot apply state records. Structured blocks are hidden in the HUD and Web story display. Plain prose, unpublished ChatGPT replies and old messages are not automatically inferred or backfilled.

Also corrected the existing active-room guard to allow authorized owner narration with a null player sender while retaining membership checks for player posts. Tests cover published gains/use, owner and guest inventory, scene changes, spoof attempts, retries and atomic rejection.

## Web v0.8.0 / HUD v0.8.11 — player workspace

The speaker switch sits beside Send; Session Info, Scene and Inventory replace the message feed when selected, preserve the composer/draft, and return to chat on a second click. Session Info is read-only. Scene uses only owner-confirmed current-location checkpoints, never the starting location as a fallback. HUD Session Tools includes Current scene & location ideas bank: record a participating character's current location/description and browse the latest 50 saved discoveries across rooms. This bank is stored in Supabase; nothing is automatically published to Notion.

Player-owned inventory supports quantities, notes, add/remove and a retained change log. Established characters use stable saved-character IDs; temporary characters use their scene appearance IDs. Inventory entries are player-reported, not automatic canon confirmation. New RPCs enforce active membership, the caller's participating character and owner-only scene recording. Automatic narrator-driven inventory or scene extraction, maps and full character-sheet fields are not part of this release.

## Web v0.7.10 / HUD v0.8.10 — quieter selection and location hierarchy

Removed redundant character reminder buttons and duplicate description panels. Selecting a temporary character changes Suggest Temporary Characters to Cancel; Cancel clears and hides the temporary choices. Clicking a selected role keeps it selected. The HUD location picker renders a single indented ancestry tree, including Cloudveil Sect → Mountain Gate → Mountain Path, with accessible full-path labels. Catalog ancestry and access context now guide suggestions: Cloudveil paths use disciples on routine sect duties, while explicitly marked wilderness can offer mundane hunters, gatherers and petty bandits. No new world locations or permanent NPC records were added. The recruitment forecourt's canonical visitor permissions are unchanged.

## Web v0.7.9 / HUD v0.8.9 — established and temporary characters

Established choices scroll horizontally with touch, keyboard focus and arrow controls. A separate Suggest Temporary Characters action offers three named, minor supporting roles from location-specific templates; custom locations use neutral helper/courier/visitor roles. The same invitation/location gives stable suggestions. Players can select established characters plus at most one temporary role. Players with no saved characters see the Jade Emperor greeting and can join with a suggested role. The HUD now allows inviting those registered players. The server validates offered choices, invitation ownership, expiry and active room membership; temporary appearances remain history without automatically becoming established characters. Suggestions are lightweight templates, not AI calls or automatic Notion NPC creation.

## Web v0.7.8 — recover joined sessions

The player entrance lists ongoing rooms from the signed-in browser user's actual membership, alongside Check invitation. Returning to the start preserves the last-room shortcut; recovery no longer depends on it. Each room is revalidated when opened, and sign-out clears the shortcut. No invitation is needed to return to an accessible ongoing room in the same browser.

## HUD v0.8.8 — visible typing cursor

All HUD inputs, textareas and editable text areas use an explicit bright gold caret, overriding inherited host-page caret colors. The browser retains its native cursor placement and blinking behavior.

## HUD v0.8.7 — room names and date/time controls

Edit session details now includes Room name; name and setup save atomically through the owner-authorized save_room_details API. Create Room and Edit use Year, Early/Mid/End, Season and Day controls. Existing nonstandard dates are kept until replaced. Time uses a preset picker plus an optional custom field; custom text takes precedence and survives reload. Backend custom times are limited to 90 characters.

## HUD v0.8.6 — current-chat Session Tools

Session Tools shows the current chatroom’s information: title, status, in-world date/time, location, opening, goals and participants. My rooms and Refresh room list are removed. Opening these tools refreshes the selected chat only; room browsing remains in Room Logs and the sidebar picker. Closing with Close, Done, the backdrop or Escape returns to the active chatroom. Existing setup fields live in a collapsed Edit session details section for corrections and reset recovery; room creation still collects the initial setup. Legacy invitation joining stays in Settings.

## HUD v0.8.5 — character card columns

An expanded saved-character card has a full-width bordered name header, a description column and a separated right-hand Notion/Edit action column. The editor spans both columns; narrow screens stack the action area below the description.

## HUD v0.8.4 — readability and visual comfort

A shared 16px body/control size, 14px helper text, 18px section labels and 24px page headings replace the previous scattered 10–16px sizes. Cards and actions use consistent spacing, 44px minimum button targets, scoped text styling, narrower reading widths, visible form labels, and keyboard focus outlines. The burgundy/gold palette remains; primary red and narration blue are darkened for text contrast. Desktop forms are width-limited, and mobile input rows wrap. Page routing, Notion imports and minimize retention are unchanged.

Design basis: W3C WCAG 2.2 contrast, keyboard focus and target-size guidance. This is an implementation improvement, not a claim of full WCAG certification. Automated DOM, CSS and color checks are run; no live browser visual inspection is available in this environment.

## HUD v0.8.3 — compact character cards

Saved characters now appear as collapsed bordered names. Expand a name to read its description and use Notion or Edit. Edit reveals the Notion importer, name, description and Save/Cancel/Remove controls. The Objective input is removed from new and existing character forms; older stored objectives are preserved when editing. Characters without a saved Notion link show the Notion control disabled until a link is checked in Edit.

## HUD v0.8.2

The HUD now keeps its current page and draft forms while minimized. Players Registry adds read-only Notion character previews with editable fields and saved source links. The server importer is deployed; its Notion connection token must be configured as `NOTION_TOKEN` in Supabase Edge Function Secrets before live imports work. See `userscripts/README.md` for setup and supported summary placement.

# Paths HUD v0.8.0 / Web v0.7.7 — Prepared rooms and Codex location picker

Create Room now collects title, owner character, in-world date, optional time of day, beginning location, optional starting spot, opening situation, optional session goals and registered players. The location dropdown groups 21 established places by region and parent, with Notion source links and a Custom location option. Custom entries are session-specific and never added to the catalog. The checked 16 October 2026 catalog snapshot is documented in db/location-catalog.json; it is not a live Notion integration. Future Codex changes require a catalog update. The HUD refresh button reloads the saved lists, not Notion itself.

Selected players receive individual invitation codes generated during preparation. The owner selects people, while players choose their own saved characters on Web. Players with no saved characters are shown but disabled until their Registry has character entries. Room creation can be solo. Session tools uses the same location picker and scene fields for subsequent edits and offers a registered-player dropdown for additional invitations. Generated codes are shown privately for copying; the application does not send invitations to anyone.

The new owner/paired-HUD APIs atomically create a room, its introduction and invitations. Invalid data or a failed invitation rolls back the entire creation. A private request ID/fingerprint deduplicates retries; raw invitation tokens are not stored in that request table. The HUD retains returned codes in private userscript storage. If the original response was completely lost, recover the room and generate fresh invitations in Session tools. End/Reset invalidates codes as before; reset clears setup metadata. Historical scenes remain intact. Existing free-text locations can be retained when editing older rooms.

Web Intro and concluded-scene pages now show time of day and session goals. Narrate instructions reference the saved setup and treat goals as directions, not predetermined outcomes. Manual character selection fields were removed from the HUD invitation workflow.

Applied database definition: db/prepared-rooms.sql. New transactional tests cover source/custom location behavior, metadata, atomic rollback, deduplication, player-selected characters, ended-scene metadata, owner-only operations and reset. DOM tests cover preparation fields, native location grouping, private codes, retry recovery, required fields and Web display. Existing lifecycle and navigation tests pass. Browser visual QA was unavailable.

---

# Paths Web v0.7.6 — Inline HUD pairing on Administration

Administration now displays pairing status, code input, Approve Paths HUD, Refresh status and Revoke access directly. Removed the extra Open HUD pairing & tools button and moved the existing controls out of the tools view. Pairing status loads on entry. Approval resolves an owned room for the existing server ownership check without opening a room or leaving Administration. Owner authorization remains enforced; no database or HUD update required.

DOM checks cover inline placement, removed intermediary button, status loading and approving with no current room while staying on Administration. Web module syntax check passes. HUD remains v0.7.10.

---

# Paths HUD v0.7.10 — Active navigation and separate Settings/Create pages

Only the navigation button for the visible main page is highlighted, with aria-current=page. Create Room, Room Logs, Players Registry, Settings and Session tools update this state on entry/exit. Main-page navigation closes other tool/settings views so an old panel cannot mask the selected page.

Create Room no longer automatically opens setup when unconnected: it remains a creation page with a setup explanation and an explicit Open Settings shortcut. Connection, pairing and recovery remain under the gear, now titled Settings. Desktop gear and minimize buttons are 44px controls with 24px symbols.

DOM tests cover Create/Settings separation for unconnected HUDs, route exclusivity, exactly one active navigation indicator and indicator clearing. Existing picker, desktop/sidebar/mobile and Web checks pass. No database changes; Web remains v0.7.5.

---

# Paths HUD v0.7.9 — Desktop sidebar and explicit active-session selection

Desktop widths above 790px keep Admin in a left sidebar, with Room Logs, Players Registry, chatrooms and tool/settings pages in the main area to its right. ☯ hides/restores the sidebar without changing the main page. Content reclaims the width while it is hidden. Desktop tool panels are nonmodal regions; mobile keeps the existing full-width information toggle and dialogs.

The session picker now assigns its value explicitly after appending every option, then loads the selected room’s participants and calendar using that exact ID. Loading and unavailable states are distinct. Native select tests use jsdom rather than linkedom and cover first load and periodic option rebuilds. Tests also cover desktop sidebar/main-page retention and mobile region/dialog semantics. Supabase read-only verification confirms New Jianghu Session is active. No database changes; Web stays v0.7.5. Browser visual QA was unavailable.

---

# Paths HUD v0.7.8 — Information symbol toggle

The ☯ symbol opens and closes the information/Admin panel while leaving the underlying HUD page mounted. Closing it restores the same chat, Registry, Room Logs or settings page. On the Admin home itself it can close the information body to reveal ChatGPT and reopen it on the next tap. Explicit Back buttons keep previous-page navigation. No database changes; Web remains v0.7.5. Notion summary/link import remains planned, not implemented.

---

# Paths HUD v0.7.7 — Exclusive player card panels

Rename and Characters are mutually exclusive inside each player card. Selecting one hides the other panel and highlights the selected button; tapping the active button closes its panel. Existing rename drafts are retained when switching. No database changes. Notion URL import has not been implemented. Web stays v0.7.5.

---

# Paths HUD v0.7.6 — Expandable player forms and managed characters

Register Player is a transparent toggle revealing a new-name field and adjacent red Register button. Player status appears next to their name. Rename reveals a hidden field and Save button; Characters opens a player-specific character editor with Add, Save and Remove actions. Character fields cover name, description and objective. Duplicate player registration now raises an explicit warning, including capitalization and outer-space variations.

The new private.player_characters list is keyed to each stable player ID and seeded from prior appearances. Editing/removing saved choices preserves historical appearances and current room membership. Valid invitation previews include saved choices; redemption checks the same list. Explicit invitation options remain available, and actually playing one records it again. Renaming a character retains historical names for reminder lookup. CRUD requires the owner or an actively paired HUD; players, foreign records and revoked HUDs are denied. Gmail is not required; invitation redemption binds an anonymous browser account to the stable player ID. Web remains v0.7.5.

Applied definition: db/hud-player-characters.sql. UI checks cover hidden forms, status/action placement and editor controls. Transactional integration checks cover duplicate registration warnings, CRUD, saved choices in preview/redemption, preserved history, and owner/player/foreign/revoked permissions. Existing full session lifecycle tests also pass.

---

# Paths HUD v0.7.5 — Previous-page navigation and unified session details

The ☯ button navigates back through visited HUD pages, including Room Logs, chatrooms, registry, room tools and settings. Invalid/ended chat destinations fall back to Admin. Removed the duplicate selected-room title, active-room button list and refresh button from Current Session; Room Logs remains the route into chatrooms. The active-session selector sits directly below Current Session and refreshes both player/character participation and the saved Heavenly Calendar date. Its selection remains independent of the active chatroom. Participant rows now use larger, high-contrast 16px text with extra spacing.

DOM checks exercise previous-page navigation, removed controls, selector position and participants/calendar loading. Existing API permissions are unchanged; no database changes. Web stays v0.7.5.

---

# Paths HUD v0.7.4 — Room Logs and session participant picker

Administration now links to Room Logs, a HUD body page grouped by Ongoing and Concluded. Opening ongoing entries joins their chat; concluded entries show Scene ended and the recorded end time. Status is refreshed before opening an entry. Current Session holds active-room chat buttons and a separate Characters session selector, showing player aliases and all allowed characters per participant. Inspecting participants does not change the selected chatroom, drafts or speaker. Polling refreshes the active list and participant picker; outdated participant responses are discarded. Removed the Trusted HUD linked-to-owner line.

Existing room/member APIs supply these views; no database changes. DOM checks cover grouping, active-only choices, player/multiple-character display and Admin navigation. Web stays v0.7.5.

---

# Paths HUD v0.7.3 — Collapsible administration and Players Registry

Administration and Current Session are sibling collapsible sections. Administration contains ＋ Create a New Room, Ongoing Sessions with a compact accessible ↻ button, and Players Registry. Current Session contains Characters and Heavenly Calendar. The transient Connected to room message and old Monkey explanation are removed.

Players Registry is a full HUD page for registering player names, renaming existing records and viewing ongoing-room membership and characters. Names remain linked to the same player ID and character history. The new hud_player_registry RPC authorizes the actual owner or an actively paired HUD, denies unpaired/player/anonymous access, and limits reads/writes to that owner. Web Players remains read-only. No player categories or delete action are added.

Applied database definition: db/hud-player-registry.sql. Transactional checks cover renames, existing membership/history, duplicate names, validation, foreign records and revoked HUD denial. HUD DOM checks cover section structure, icons, Registry cards, safe text and navigation. Web stays v0.7.5.

---

# Paths HUD v0.7.2 — Admin home and ongoing chatrooms

Administration is the default HUD page with no action composer. It offers Create a New Room and a collapsible Ongoing Sessions list. Active-room buttons open a full-width chatroom and its composer; ☯ returns to Admin. Session tools opens the existing introduction, invitations and lifecycle controls. Creation uses a dedicated form view. Ended/unavailable scenes hide the composer. The Admin list refreshes on return, manually, and every 12 seconds while visible. Web stays v0.7.5; no database changes.

---

# Paths HUD v0.7.1 — Session information in the HUD body

The ☯ button now opens a full-width, scrollable information view between the HUD header and its action composer on all screen sizes. The floating narrow sidebar and desktop composer offset are removed. Tap ☯ again to return to ChatGPT; opening Scene closes information and vice versa. ResizeObserver tracks header and composer height so longer drafts and wrapped controls do not cover the bottom of the information view. Web stays v0.7.5.

---

# Paths Web v0.7.5 — Focused administration

Administration keeps the HUD pairing/tools entry and removes the Web scene introduction editor. Date, location and opening situation are edited through HUD v0.7.0. Rooms now contains only its room log: the Owner recovery creator, unused legacy join form and outdated test footer are removed.

Opening Administration no longer loads rooms for the removed editor. The pairing/tools entry opens the latest owned room when none is selected, so it no longer sends the owner back and forth between Administration and Rooms. Existing server pairing authorization is unchanged. No database or HUD update is required. DOM and syntax checks cover the cleanup and retained navigation.

---

## Previous implementation notes (historical)

# Paths Web v0.7.4 — Rooms and concluded-scene archive links

**Rooms** replaces Rooms & sessions in Web navigation. Ongoing rooms open their chat; concluded rooms open a **Scene ended** page. Rooms are grouped by Ongoing / Concluded. Owner access and existing player revocation rules remain in place.

The ended-scene page can record a Notion page URL. Status is deliberately **No Notion link recorded** / **Notion link saved**: the application does not upload to Notion, inspect that page, or claim an upload succeeded. The owner manually pastes the page link after archiving the scene. Links are private, owner-readable, restricted to HTTPS Notion domains, and associated with that room's specific session generation. Resetting the room cannot carry a previous scene's link into a new session. A stale concluded-scene page cannot save a link against a different session.

This is a Web-only change; HUD v0.7.0 remains current. DOM checks cover grouped room labels, concluded routing and honest archive status. Database checks cover owner-only access, URL validation and session-generation isolation.

---

## Previous implementation notes (historical)

# Paths Web v0.7.3 — Read-only player roster

**Players** now lists registered names with **In a session** / **Not in a session**, active room titles and their selected characters. The total and session counts appear above the roster. Registration fields have been removed from Web; generating a HUD invitation still registers new player names automatically.

Status is based on membership in an ongoing room, not whether the browser is online. Invited players who have not joined appear as Not in a session. Kick, End and Reset remove membership and update the roster accordingly. Multiple active rooms are listed separately. Refresh happens when the tab opens, with the Refresh players button, and every 15 seconds while the roster is visible. The owner-only roster API returns no emails, login tokens or invitation codes.

DOM checks cover status cards, room/character display, empty state, safe text rendering and removed registration fields. Database integration checks cover the status transitions and denial to player accounts. This is a Web update; HUD v0.7.0 remains current.

---

## Previous implementation notes (historical)

# Paths Web v0.7.2 — Administration tabs

The Jade Emperor welcome now appears above a single horizontal tab row: **Administration → Rooms & sessions → Players**. Swipe the row sideways on narrow screens; tabs stay on one line and can be extended. Each tab changes the panel below it. The former Player Registry is now the **Players** panel. Arrow keys, Home and End also navigate the tabs. The ☯ Back / Sign out popup stays available.

This is Web-only; HUD v0.7.0 remains current. Existing DOM checks cover welcome/tab order, active-tab state and panel isolation, plus prior entrance/navigation behavior. No database changes were required.

---

## Previous implementation notes (historical)

# Paths Web v0.7.1 — Simpler administration and ☯ menu

**Website:** https://denoden3.github.io/Paths-to-Immortality/

The administration page no longer has page-editing tabs, preview panels, or presentation-save buttons. It retains the player registry and actual room/session tools. Existing presentation settings still load; further layout changes are made in code.

Tap **☯** beside the title for a compact popup with **← Back** and **Sign out**. Sign out is available only with a signed-in browser identity, and is no longer displayed in the page navigation or room lobby. Back follows the page context; leaving a player's ongoing room through this arrow preserves its browser re-entry record. The popup closes by tapping outside it, tapping ☯ again, pressing Escape, or choosing an action.

This is a Web-only update. HUD v0.7.0 remains current and does not need updating for this change. Database permissions and session controls are unchanged. Existing DOM checks cover removed editors/inline signout, popup opening/closing and preserved ongoing-room re-entry; syntax checks also pass. Android visual/touch behavior still needs a real-device check.

---

## Previous implementation notes (historical)

# Paths Web / HUD v0.7.0 — Invitation gate and session controls

**Website:** https://denoden3.github.io/Paths-to-Immortality/

Starting page → **Step forth** → two equal identity buttons:

- **The Jade Emperor (The Administrator):** Google authentication. Only the existing, server-authorised administrator account enters Administration. Other accounts are signed out locally and silently returned to the starting page. The header has the ☯ symbol beside the title and no Sign in button.
- **A Wandering Cultivator (A Player):** invitation-code popup. Code or private URL → **Generate scene** → Intro only if valid, unused, and unexpired. Invalid/expired/used codes silently return to the starting page. Previewing does not consume a code; beginning the journey consumes it.

All players use the same greeting and multi-character checkboxes. The established/temporary distinction and standalone Characters Log are removed from the UI and selection rules. Server records remain private. Available choices combine this invitation's offered characters and the player's earlier characters. Selected names have reminder buttons below the scene information: description, objective, and previous scene when recorded. No Notion history has been imported.

An authenticated browser can resume only its still-accessible ongoing room. Ended/kicked/reset membership is checked on return, before posting, and about every four seconds while the tab is visible. Offline or suspended browsers return to the start when they reconnect/resume and the check completes; previously downloaded text cannot be remotely erased while a device is offline.

## HUD → Rooms & sessions → Session control

| Control | Result |
| --- | --- |
| Kick player from the room | Remove that player's room membership and invalidate their pending invitations for this room; messages stay. |
| End session | Close entry/posting, remove player memberships and invalidate every room invitation; keep the messages for the owner. |
| Reset session | Confirm deletion of the ongoing chat and scene introduction, remove player memberships and invalidate all room invitations; keep the room shell and private character reminder history. Save a new introduction and issue fresh codes. |

Invitations now use `Character name | Description | Objective` per line; description/objective are optional. All invitation generation and lifecycle operations are server-authorised for the permanent owner or their paired HUD. Ending/resetting does not affect the trusted pairing. Ending does not automatically archive to Notion.

## Verification

`tests/portal-permissions.sql`: integration tests within a rolled-back transaction, covering unified multi-character entry, invitation validity/privacy, owner-only controls, denial of reads/writes after kick/end, retained end transcripts, complete reset, fresh invitations, and retained character reminders. Test fixtures require the existing administrator, its active HUD delegation, and at least two unused anonymous test identities.

DOM/structure checks: install `linkedom` in a temporary directory and run `PORTAL_DOM_MODULE=/absolute/path/to/node_modules/linkedom node tests/portal-dom.cjs` and `node tests/hud-structure.cjs` with the same environment variable. Checks cover identity gating, silent code rejection, wrong-account signout, previews, unified controls, reminder text, access loss and HUD event targets. JavaScript syntax checks also pass. Android Firefox rendering/touch behavior still needs a device check.

SQL files in `db/` document the additive production changes; do not rerun them on an upgraded database. Legacy category columns remain solely for storage/backward compatibility and no longer determine access, greetings or selection limits.

---

## Previous implementation notes (historical)

# Paths Web v0.6.0 — Player entrances and Jade Emperor administration

**Live website:** https://denoden3.github.io/Paths-to-Immortality/

- The starting page ends at **Step forth to the Jianghu!** Everyone sees the starting page first; a remembered administrator login enters Administration after clicking it. Use **Sign in → Google** for the existing Jade Emperor account if needed. Signing in with another Google account does not grant administration.
- Administration includes **Starting page**, **Intro page**, and **Chatroom layout** editor tabs. Previews use sample player/scene content, selectable established/temporary perspectives, and actual shared presentation settings. Save changes to publish the text/layout settings for all player entrances. Session introductions are edited separately for a selected real room. The editor controls text, message spacing/alignment, and desktop chat width; it is not a free-form HTML/CSS editor.
- Owner-only player registry: enter the same player alias used when generating HUD invitations. Categories are **Established** and **Temporary**. Invitations also register new aliases automatically; an existing alias/category must match the invitation type.
- Established players see the centered **Welcome back, {player}!** greeting and can check one or more characters offered by their assigned invitation. Temporary players see the centered **Welcome, {player}!** greeting and select exactly one pre-established offered character or one of their previously played temporary characters. Free-form temporary character naming has been removed.
- Players paste an invitation code **or the private URL** and click **Generate scene** to load the session introduction, then select characters and click **Begin your journey!** Codes remain private, one-use, and valid for 48 hours. Editing the code invalidates its loaded preview.
- First-time visitors are addressed as “wanderer” until their private invitation identifies them. Returning players are recognized through their current authenticated browser session. Anonymous browser identity remains dependent on browser storage. A later personal invitation can reconnect a player record on another identity; aliases alone do not authenticate anyone.
- **Characters Log** groups each player's chosen characters with their related scene titles, dates, and locations. It is stored server-side and isolated per player. Scene links open only when the current account has room membership. Deleted-room scene summaries remain in the log. No Notion history has been imported; this records joined sessions from this upgrade onward.
- **HUD v0.6.0** adds **Copy invitation code** alongside the existing link and updates the character selection labels. Update the existing Tampermonkey script from the repository's raw URL; the existing trusted pairing remains valid.

## Verification

Database integration checks in `tests/portal-permissions.sql` run inside a rolled-back transaction: administrator-only access, presentation RLS, private histories, assigned-character subsets, single temporary selection, one-use tokens, legacy redemption checks, forged-speaker rejection, and returning temporary characters. The test expects the existing administrator and at least three unused anonymous test identities.

DOM checks: install `linkedom` into a temporary directory, then run `PORTAL_DOM_MODULE=/absolute/path/to/node_modules/linkedom node tests/portal-dom.cjs` from the checkout. Checks cover greetings, selection controls, preview tabs, text injection, and Characters Log grouping. JavaScript syntax is also checked. Real Android Firefox rendering and touch behavior still need a device check.

The SQL files in `db/` document the additive production migrations for this upgrade; do not rerun them on an already upgraded database.

---

## Earlier development notes (historical)

# Paths-to-Immortality

A mobile-first, two-player xianxia roleplaying HUD for Cloudveil Sect.

## Status: Test 2A — Shared chat + manual ChatGPT narrator

- **Website:** https://denOden3.github.io/Paths-to-Immortality/ (available after GitHub Pages is enabled)
- **Backend:** Supabase project `Paths to Immortality` in Singapore
- **Included:** Google and guest sign-in, secure room creation, single-use invitations, participant-only messages, realtime updates, local drafts
- **New — The Heavenly Voice:** The room owner can tap **Narrate** to assemble pending player actions into a prompt, open ChatGPT, and paste the generated scene back for both players. Server-side access checks restrict Narrator publishing to the room owner and reject stale/double publishing.
- **Coming later:** Fully automatic supported narrator connection, Notion/chronology sync, character panels, canonical scene archives

## Publish the site (one-time GitHub owner action)

1. Open the repository's **Settings → Pages**.
2. Under **Build and deployment**, select **Deploy from a branch**.
3. Choose **main** and **/(root)**, then click **Save**.
4. Wait until GitHub Pages shows the published address above.

The website is public static code, but the chat data is protected using Supabase Authentication, row-level security, and room membership.

## First shared-room test

1. Visit the GitHub Pages address on each phone.
2. **Sign in** using email, or the temporary guest option if **Anonymous Sign-Ins** has been enabled under Supabase → Authentication → Providers. Guest sessions may be lost when clearing site data, changing browsers or signing out.
3. Xiao Lan creates a room and obtains a one-use invite code. Send it privately to Xu Yi.
4. Xu Yi logs in on their own browser and redeems the invitation.
5. Post an action on either phone. The other phone should show it automatically.

**Security:** Only a public Supabase publishable client key belongs in `index.html`. Do not commit project secret keys or service-role keys. Room-invite codes should remain private.

**Testing only:** The narrator is a **manual human-in-the-loop bridge** to ChatGPT. There are no automatic API calls, no separately billed OpenAI API usage, and no automatic changes to Notion canon. Back up important content independently; the Free backend can pause with inactivity.

## Test 2A — Narrate a combined scene

1. Use a room owned by your current signed-in account (the room creator). Both players post their actions.
2. The owner clicks **✦ Narrate**, then **Copy scene prompt**, then **Open ChatGPT**.
3. Paste the prompt in a ChatGPT conversation with Notion access, ask it to narrate, and copy just the story portion.
4. Return to the room's Narrate panel, paste the story, and choose **Publish narration to room**.
5. Both players should receive a distinct Narrator bubble in realtime.

The copied prompt contains the authoritative Shared Narrator Protocol Notion page link and compact fallback rules. ChatGPT must still actually retrieve the Notion page if available; a link does not automatically sync Notion. If any new player actions or Narrator posts arrive during handoff, publishing is rejected and the prompt must be refreshed. A draft of the pasted narration remains in the current browser if an error occurs.

## Player-owned message editing (website)

- On the shared-room website, **long-press one of your own player messages** to enter selection mode; then tap other messages of yours to select several.
- **Edit** becomes available when exactly one of your messages is selected. **Delete** permanently removes all selected messages after confirmation. **Cancel** exits selection mode.
- Other players' messages and Narrator messages cannot be edited or deleted using these controls.
- To protect story continuity, any player action followed by a Narrator message is locked from changes. Edits show an “edited” indicator to the other player; deletions may take up to one polling interval (~18 seconds) to disappear on other phones if DELETE realtime notifications aren't delivered.
- Deletion is permanent. This Test Room is noncanonical. We have not yet added a recycle bin, undo or scene archiving. The player's identity is checked in database-side RPCs; ordinary clients cannot directly update/delete the table.

## Character actions versus OOC chat

The browser application is called **Paths Web** (not the Paths HUD). Choose Character or Player · OOC before posting. OOC messages remain visible in chat, are marked with a distinct style, and are excluded from pending actions supplied to the narrator. Existing messages retain their original `player` kind and are treated as character actions.

Long-press your own bubble to select messages. The first selection action is **OOC**: it changes selected character messages to OOC. When all selected bubbles already are OOC, that control changes to **Character**, allowing correction back to story mode. This type switch is limited to messages that have not been followed by a Narrator turn; the server verifies ownership. Edits and deletion of OOC chat remain possible afterward, while narrated character actions stay locked.

This is an early prototype: verify the character/OOC switch from both phones before using it for canonical scenes. End Scene and Notion novel compilation are **not** implemented yet.

## Paths Web v0.3.2 — Xu Yi's entrance controls

- The web player's Character/OOC composer selector is labeled **Xu Yi** / **Puuchan** (the underlying message types remain `player` / `ooc`). Character placeholder is `What does Xu Yi do?`; OOC placeholder is `Let your voice be heard`.
- The **Narrate** and **Invite** buttons are no longer in the chat header. The owner-only invitation generator is preserved in a collapsed **Room tools** section, until the planned invitation-link and GM-pairing workflows replace it. The Web narration button is hidden; the experimental ChatGPT narration workflow runs on Paths HUD instead.
- Message selection, OOC reclassification, realtime chat, Google/guest accounts and all existing rooms remain unchanged.

## Paths Web v0.4.0 — Tools page and character/player identity

- Tap the **☯ yin-yang icon** beside Paths to Immortality to open a separate **Paths Web Tools** page. Use **← Back** or tap ☯ again to return without leaving the room or interrupting the active message subscription.
- The room owner sees **Room administration**, where invitations and the experimental manual Narrator bridge have moved. Ordinary members do not see these controls. The main chat header contains only room navigation and title.
- Paths Web has a single speaker-toggle button. For Xu Yi's membership it switches between **🎭 Xu Yi** (character action) and **💬 Puuchan** (out-of-character player chat). Other room members display their actual character name and a generic Player label for OOC messages.
- New chat bubbles use **Xu Yi** or **Puuchan** according to their stored message type. Underlying Supabase author identity never changes. Previously written OOC messages by Xu Yi display as Puuchan too.
- These changes do not affect Paths HUD or Mizuhana. Invitation links and automatic novel compilation remain future features.

## Trusted Paths HUD — one-time owner pairing (Web v0.4.1)

Paths Web's owner-only ☯ Tools page provides **Approve Paths HUD**, **Refresh status** and **Revoke access**. Sign in with the permanent Google owner account, open a room actually owned by that account, then enter the 48-character pairing code displayed in the Paths HUD. Codes are stored as SHA-256 hashes, expire after 10 minutes, and are consumed once. Approval requires explicit confirmation and links one anonymous HUD identity to one room owner; it does **not** invite the Monkey as a visible participant.

The pairing authorizes access to **all private rooms owned by that account**, not merely the currently selected room. It does not give Supabase project administration or Notion privileges. It can be revoked on Paths Web. Owner-only access cannot be granted from an anonymous-owned room using this ritual. The existing room invitation mechanism remains available for guest players.

The database provides delegated owner-room read access, creation, character/OOC posting, invitation creation and guarded narration publication. The owner still controls final narration requests; pairing itself does not call the ChatGPT API or automate the ChatGPT Send button. Live owner-device pairing has not yet been completed or verified.

## Personal invitation flow — Paths Web v0.5.1 and HUD v0.5.1

**One room = one shared session.** The owner uses the paired Paths HUD's **☁ Rooms & Sessions** page to create the private room, set the scene's fictional date, location and opening description, and save it. The owner then enters an approved player alias, selects either **Assigned** (one or more existing characters) or **Temporary guest** (one or more permitted NPC role templates with description and objective), and generates a 48-hour, one-use personal invitation URL. These details are secured in Supabase, with hashed invitation tokens and server-checked owner rights. All players must be entered by the owner before receiving a link; aliases currently must be typed rather than being automatically loaded from Notion's guest registry.

Paths Web uses **the same generic welcome screen and scene-introduction page for everyone**. Assigned players see their allotted character(s) and one entry button. Temporary guests see only the roles permitted by their invitation and can choose a temporary character name. Redeeming the code creates/uses a Supabase anonymous login behind the scenes without an email form. After joining, all assigned characters can be selected using the speaker button underneath the composer, cycling through character names and the player OOC alias. Character attribution is authorized on the database side and recorded with each action; the shared narrator draft also uses the chosen action speaker. Codes must be treated as private bearer credentials: whoever first redeems a valid unused link can claim it.

Paths Web retains Google owner sign-in, owner room recovery/Tools, and the private shared-room chat. Old anonymous trial-room creation and generic guest sign-in are no longer part of the normal entry path. **The new invitation route has not yet been end-to-end tested on the users' devices**; syntax/DB permissions were checked. Narration publication and Notion archiving remain separate unfinished integrations.
