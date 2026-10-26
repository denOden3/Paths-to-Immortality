## Character portraits / active chat avatars — Web v0.8.17, HUD v0.8.30

**User-facing flow:** Public character pages for Xiao Lan, Xu Yi, and Elder Shen display an **empty Illustrations section** until a character owner uploads art. Signed-in registered owners see **Choose image / drag and drop**, a title/appearance note, and an **Upload illustration** control. Uploads are PNG/JPEG/WebP only, at most 3 MiB per image. Each character's first upload becomes their chat avatar automatically; later pictures are kept in the gallery, and **Use as chat avatar** swaps the active picture. Older images remain available for re-selection, rather than being overwritten.

**Storage:** The images live in **Supabase Storage** public bucket `pti-character-art`, not GitHub or temporary Notion attachments. Public profile HTML never stores the image bytes. The private SQL gallery links the object path to a character, with one active avatar per character. Existing PC ownership from authenticated room membership was used to establish the initial published profile ownership for Xiao Lan and Xu Yi; Elder Shen is managed by the owner. The public image URLs are readable without sign-in; only the authenticated registered character owner may upload/register or select an avatar. Validated paths include that owner's user-id and the character's exact registered slug. Storage enforces JPEG/PNG/WebP and a 3 MiB bucket limit, and the private gallery is limited to 60 images per character. Do not upload unrevealed character traits or personal data unless they are intended to be publicly visible.

**Both chat interfaces:** Paths Web `index.html` and the ChatGPT Tampermonkey HUD fetch the active avatars and display the current character portrait beside that character's **player** chat messages. Narrator and OOC messages remain distinct. Refresh the chat page or wait for normal avatar polling (roughly every 20 seconds while the room is updating) after changing an avatar.

**Sign-in:** The public character pages are browsable anonymously. To upload, first sign in using Paths Web on the **same website origin and browser**, then return to the character's page and refresh. An unsigned or incorrectly signed-in viewer gets the empty/gallery view without editing controls. The website’s existing publishable Supabase key is used; no secret key was put into HTML.

**Verification:** Backend RLS policy and privilege checks were performed, including transactional upload-registration simulations, the default-avatar behavior, switching back to alternative pictures and rejecting a different user's writes. These tests were rolled back; **no real artwork was uploaded**. Frontend JavaScript passed static syntax and markup reference checks. Real-device uploads should be verified on the user's own account before relying on the feature.

- [Xiao Lan](https://denoden3.github.io/Paths-to-Immortality/codex/xiao-lan.html)
- [Xu Yi](https://denoden3.github.io/Paths-to-Immortality/codex/xu-yi.html)
- [Elder Shen](https://denoden3.github.io/Paths-to-Immortality/codex/examiner.html)

## Paths Web v0.8.16 — Rooms, one click from Home

- New **Rooms** collapsible section directly below **Home** in the left sidebar. While logged into Paths Web, expanding it fetches **only the active rooms authorized for that account** and displays their titles as direct chatroom shortcuts. Jade Emperor room names come from the owner-gated `portal_room_log` RPC; ordinary players use their room membership and existing room-level permission checks. Clicking a title goes **straight to the chatroom** without opening the Rooms tab or choosing the same room twice.
- When not signed in, the shelf shows a **Sign in as Jade Emperor** option, instead of exposing room data. The selection path returns to Home's open Rooms shelf after successful administrator OAuth. Supabase's normal saved-session behavior means an already-authenticated owner doesn't need to sign in again. If the session has expired, a fresh sign-in remains necessary for security.
- The shelf refreshes on opening and after returning to Home. On separate public Codex pages, the shelf links to **Home → Rooms**; those static pages do not copy private room titles. The regular Room Logs, invitations, and authorization rules remain unchanged.
- Changes were committed in `index.html`, `public-shell.js`, and `public-shell.css`. JavaScript syntax and navigation/auth-boundary source checks passed. **Live visual testing on desktop and mobile is still recommended.** If the site still displays an older web version, hard-refresh with Ctrl+Shift+R after GitHub Pages deploys (or open a new tab/private browser to bypass cached content).

[Open Paths Web](https://denoden3.github.io/Paths-to-Immortality/)

## Character clocks + concise GM prompt — HUD v0.8.29 / Paths Web v0.8.15

**Personal Time Checkpoints.** HUD: open a room, select **Personal Time** beside Scene and Inventory, choose a participating character, select **Year / Season / Stage / Day / Time of day**, and add a short verified-play/source note. Paths Web: players open their active room's **Personal Time** tab and can record time for their own selected character. Each current participant's latest in-world daypart appears in the timeline overview; other players' private source notes are withheld. Checkpoints are append-only, scoped by room/session generation, and cannot regress in time without reconciliation. A session's main date/time still exists as the shared *scene anchor*—these records do not force inactive PCs forward. If a secret realm has unknown time dilation, keep the **last confirmed world-time checkpoint**, describe uncertainty in the next note, and do not fabricate an external timestamp. These checkpoints are a manual, verified continuity aid, **not** an autonomous clock or automatic time advancement.

**GM instruction optimization.** Narrate preserves the authorized frozen action request and publishing/state verification but now sends a *compact relevant snapshot*: room/time/location/goal, current pending actions, current Scene and inventory for acting PCs, recent narration prose without redundant machine state, participant names, and any confirmed personal-time checkpoints. It still requires fresh authoritative Notion Rules A+C and relevant canon/Chronology reads; missing Rules must still block publication. Other benefits: less redundant prompt text and smaller model input; **actual ChatGPT thinking/generation and Notion connector latency are not under HUD control.** If another player changes a checkpoint while a GM reply is underway, the HUD refuses a stale publication and requests a fresh Narrate. No separate time actions are posted as player messages.

**Testing:** database rollback tests covered independent time slots, identity checks, backward-time rejection and outsider read-blocking. Source checks tested JavaScript syntax, compact prompt state-block removal, preserved request markers, and the new time fields. No live session or user inventory was mutated by tests. The UI still needs browser testing on both devices.

Install/update [Paths HUD v0.8.29](https://raw.githubusercontent.com/denOden3/Paths-to-Immortality/main/userscripts/Paths-Monkey-GM.user.js) and refresh [Paths Web](https://denoden3.github.io/Paths-to-Immortality/).

## HUD v0.8.28 — symmetric Heavenly Voice margins

- Retains the spacious `105ch` maximum-width narrator bubble from v0.8.26 but centers it within the chat message area with equal side margins on desktop. Keeps the message's internal padding and line spacing unchanged. On narrow/mobile displays the bubble expands to 100% of available message width.
- Does not modify game clocks, scenes, narration RPCs, state deltas or archiving. The current shared session date/time remains room-level; per-character scene descriptions can record individually verified time positions but there is not yet a separately enforced per-character fictional clock in the HUD/backend. The Narration Rules permit independent personal pacing and synchronized shared anchors, which must be managed narratively until a dedicated time tracker exists.
- Update [the Tampermonkey userscript](https://raw.githubusercontent.com/denOden3/Paths-to-Immortality/main/userscripts/Paths-Monkey-GM.user.js) then reload the same ChatGPT page.

## Chronicle Review & End Session — HUD v0.8.27 / Paths Web v0.8.14

**New safe End Session workflow:** Both End Session controls in the owner-paired HUD now open a **Chronicle Review** page instead of ending the room. Supabase constructs a full chronological, non-deleted message transcript directly from the database (not the HUD's 24-message viewport), including all visible player actions, OOC messages and Heavenly Voice turns. The complete source is placed in a persistent, editable draft per room/session generation. Its first version is a *faithful transcript*, **not** a magically generated novel chapter. The owner can edit it, export the full text as a TXT, or use **Prepare literary draft in ChatGPT** and then paste a reviewed literary adaptation back into the HUD. If a prompt is too large, the HUD exports the full source instead of silently truncating.

**Collaborative approval:** Paths Web now provides a **Review Chronicle** button in the active room. Players can read the exact saved revision, submit correction suggestions without modifying chat history, and approve that revision from their own signed-in accounts. HUD shows current participant approvals and suggestions. Saving a changed draft increments the revision and invalidates previous approvals; new/edited/deleted room messages require restarting review. Approval uses authorization checks for each member (the paired owner HUD votes on behalf of its actual owner). The owner can use **Approve & Conclude** *only after all current room members approve the latest revision*. The server also blocks legacy direct End Session calls without approved archive state. This prevents accidental closure and silent source loss; **Reset Session remains destructive and separate**.

**Concluded room handoff:** The approved revision persists in Supabase, and the full message history is kept. In the HUD's **Room Logs → Concluded**, a **Send approved Chronicle to ChatGPT** control prepares the Notion import prompt in ChatGPT's native composer (or copies it if composer insertion fails). For oversized approved drafts it downloads the complete UTF-8 TXT for attachment; it never silently sends just the latest 24 messages. Press **ChatGPT Send**, allow the connected Notion tools to update the correct Shared Chronicle and cross-references, verify the resulting page, then record the returned Notion page URL in Paths Web's existing **Concluded Scene → Notion archive** field. **Notion is not automatically written by the HUD or the End button**, and no direct Notion credential was added to PTI Web.

**Migration and checks:** The new private review/vote/suggestion tables and authenticated RPC facades were deployed to Supabase. Security checks verify owner/member isolation, each participant's vote, vote reset on revision, source-change protection and legacy end blocking. Full start→approve→end and suggestions tests were run only inside SQL rollback transactions; the real active scene was not ended or archived. The updated userscript and Web source were syntax-checked; a hands-on browser acceptance test is still recommended.

Install/update the [Paths HUD userscript](https://raw.githubusercontent.com/denOden3/Paths-to-Immortality/main/userscripts/Paths-Monkey-GM.user.js), reload ChatGPT, and refresh [Paths Web](https://denoden3.github.io/Paths-to-Immortality/) after GitHub Pages publishes the changes.

## Paths HUD v0.8.26 — wider narration and hold-to-jump scrollbar

- **Wider, left-anchored narration:** Heavenly Voice bubbles now use up to ~105 characters of text width rather than the old centered 72-character column. Character bubbles can grow to ~90 characters while keeping their own/right and other/left chat alignment; mobile narration uses the available content width.
- **Room title + Live:** These sit together near the left side of the chat content, rather than stretching the title to one side and live status to the far right. The header stays visible while scrolling.
- **Right-edge scrollbar:** A distinct high-contrast, draggable scrollbar follows the message viewport. Drag its thumb or use ordinary wheel/touch scrolling. **Long press for 520ms** on its track to reveal **↑ oldest loaded / ↓ newest** jump buttons. Right-click or keyboard Enter/Space on the track also opens them; Arrow/Page/Home/End keys work for accessibility. The jump buttons no longer clutter the header and stay attached to the scrollbar until selected or dismissed.
- **Keep your reading place:** The HUD refreshes recent room messages periodically. It now retains scroll position while viewing older messages and follows the newest only if you were already near the bottom or just opened the room.
- Existing message ownership, speaker choices, inventory and Scene records, narrator request verification and Supabase RPC behavior are untouched. Scroll up only through the **latest 24 loaded messages**, not yet a paginated archive.
- Install/update the [Paths HUD userscript](https://raw.githubusercontent.com/denOden3/Paths-to-Immortality/main/userscripts/Paths-Monkey-GM.user.js) in Tampermonkey and reload the ChatGPT conversation. The new styles and interactions were validated with source/syntax and mocked event tests; a live browser visual test is still recommended.

## Paths HUD v0.8.25 — auto-publish detection and manual recovery

- **Fix: No premature warning.** Immediately after pressing **Narrate**, while the newly prepared GM request is still in ChatGPT's composer, the HUD now says **Ready: press ChatGPT Send** instead of **Cannot find the original Narrate request**.
- **Fix: Completed replies can be recognized without a visible old prompt.** ChatGPT may re-render or virtualize previous messages. The HUD can now read the assistant's complete `[PATHS_NARRATION]` code block using the exact pending request ID even if the user-message DOM node is missing. It still waits until generation ends and the reply remains stable before publishing through the owner-authorized RPC, and still checks the state application receipt.
- **Fallback:** Under the pending narration status, expand **Manual recovery if auto-publish fails**, paste the **entire completed code block** from this same ChatGPT conversation and press **Validate & publish this reply**. It uses the *same* pending request ID, pairing and RPC validation; the backend rejects stale, already-processed or unauthorized requests. **Do not press Narrate again** merely to recover a completed reply.
- **Presence cleanup:** A verified publish now clears the room's `Narrator is writing` indicator, without treating a presence-cleanup failure as a narration failure.
- **Upgrade:** Install/update [Paths HUD](https://raw.githubusercontent.com/denOden3/Paths-to-Immortality/main/userscripts/Paths-Monkey-GM.user.js) and reload the **same** conversation. The prior pending request remains in script storage. Existing rooms, invites, and player records are untouched. Code was syntax-checked and the detection functions tested with mock DOM arrangements; live ChatGPT/Tampermonkey integration still requires browser verification.

## Paths HUD v0.8.24 — clearer narrator bridge and dismissible Delete notice

- A **×** beside the deleted-message **Undo** notice dismisses the banner immediately, without changing saved inventory/Scene state. Until dismissed, the original Undo offer remains available; it does not auto-expire.
- Pending narration requests now show why they are waiting: ChatGPT still generating, matching user prompt not visible, assistant reply not yet available, or missing/incomplete narration envelope. The **Check reply** button explicitly retries detection, but never bypasses the account/owner pairing, active request ID, same-chat checks or streaming guard.
- The reply watcher can also recognize assistant/user turns when ChatGPT changes the placement of role metadata. The same authorized Supabase publish RPC, exact request ID validation, state receipt verification and idempotent retry rules remain intact. **No direct Notion edits or narrator messages are sent by installing this version.**
- Update via the [existing Tampermonkey raw installer](https://raw.githubusercontent.com/denOden3/Paths-to-Immortality/main/userscripts/Paths-Monkey-GM.user.js), then **reload the same ChatGPT conversation**. A still-valid stored waiting request may be detected after reload; do not press Narrate again until checking its status. The in-room narrator message should be verified in the room. Source/syntax checks are complete; real-browser testing is still recommended.

## Paths HUD v0.8.23 + Web v0.8.13 — consistent shared chat

- **HUD (v0.8.23):** Message bubbles now follow Web's 17px / 1.65 reading typography and 70ch / 76% width, with small timestamps in each message header. Narration stays centered; ownership-specific left/right layout and the OOC treatment remain intact. ↑ / ↓ controls in the room header jump to the oldest **loaded** and newest visible message.
- **Web (v0.8.13):** Long-press the compose **speaker** button (or press Arrow Down when focused) for a full list of **your own available characters** and player chat (OOC). Tap still cycles speakers for quick switching. An ↑ / ↓ pair jumps within the loaded message history.
- **History correction:** Web's initial fetch now loads the **newest 300 messages**, then renders them in chronological order, rather than loading the first/oldest 300. Older-than-loaded paging is **not yet implemented**; a history jump button is not a substitute for server-side pagination.
- **Access:** Existing ownership and role checks still restrict the owner administration features. No database or live inventory migration was needed. Full live browser regression remains to be tested.

Install the [latest HUD userscript](https://raw.githubusercontent.com/denOden3/Paths-to-Immortality/main/userscripts/Paths-Monkey-GM.user.js) and reload ChatGPT. Web changes load after GitHub Pages publishes the main branch and the browser refreshes.

## HUD v0.8.21 — WhatsApp-style message bubbles

In the Paths **HUD** chatroom, the current authenticated participant's character and OOC messages align **right**, other participants' messages align **left**, and Heavenly Voice narration remains **centered**. The bubble remains labeled with its character/player and retains the existing edit/selection behavior. Your paired owner HUD determines your identity from the room member with **role=owner** rather than from the separate anonymous Monkey login, so Xiao Lan is right and Puuchan's Xu Yi is left. Unpaired players use their own guest login to identify the right-side messages. This is a display-only change; message senders, room membership and stored chat messages are unchanged.

Update the existing Paths HUD userscript from [the GitHub raw installer](https://raw.githubusercontent.com/denOden3/Paths-to-Immortality/main/userscripts/Paths-Monkey-GM.user.js), then reload ChatGPT; no re-pairing is needed.

## HUD v0.8.20 — unified message speaker picker

The selected-message toolbar now shows **Edit · Speaker ▾ · Delete · Cancel**; the separate **OOC** button is removed. **Speaker ▾** opens the existing authenticated picker for participating characters **or Player chat (OOC)**, so one action handles both speaker changes and character/OOC conversion. Multi-message selection remains supported; narrator messages cannot be reassigned, and edits never rewrite previous narration or saved state. The main compose speaker control is unchanged.

Update the installed Paths HUD through Tampermonkey and refresh ChatGPT. No room reset or owner re-pairing is required.

## HUD v0.8.19 / Web v0.8.9 — long-press message controls

Message bubbles no longer show inline Edit buttons. Hold a bubble for 480 ms to select it, then tap other bubbles for multi-select; scrolling and pointer cancellation do not select. Right-click and Enter/Space are desktop alternatives. The selection toolbar provides Edit (one bubble), Speaker, Character/OOC, Delete and Cancel. The speaker picker uses participating characters; ordinary players see only their own choices. Paired owners may manage character/OOC/narrator bubbles in their active rooms; narrator identity cannot be reclassified. Original sender attribution is retained.

Delete hides selected bubbles and offers Undo. It does not undo inventory or Scene effects. Hidden narrator records remain timeline anchors so earlier actions cannot be processed twice; hidden pending player actions are excluded, and old bridge requests become stale. Web also hides deleted bubbles and excludes deleted pending actions from its narrator request. Edits and speaker changes do not rewrite earlier played consequences.

Verified with rollback-only database tests for authorization, speaker validation, soft deletion/undo, state preservation, stale requests and narrator anchors; client tests cover long-press, scroll cancellation, multi-select, keyboard/context-menu access, speaker choices and verified Delete/Undo. Existing bridge, routing, workspace, speaker, contrast, typing and Web DOM tests pass. Live Android verification remains to be done. Update the userscript and reload ChatGPT; refresh the Web to receive its display update.

## HUD v0.8.18 — automatic narrator publishing and message editing

Narrate now obtains an authenticated, frozen scene snapshot, including pending character actions (OOC excluded), the saved introduction/goals and each acting character's inventory/Scene panel. After you send the prepared request in ChatGPT, the HUD watches only the matching completed assistant envelope in that conversation and publishes it through the existing delegated owner narrator RPC. It verifies the exact message and its state receipt before showing Published · State applied. Connection failures retain the request for an idempotent retry. Edited actions, changed character state, reset/ended rooms, expired requests and obsolete replies are rejected. This requires updating the installed userscript and starting a fresh Narrate request; older prepared prompts do not auto-publish.

Each bubble has an Edit control for authorized users. The paired owner may edit character, OOC and narrator text in their active rooms; ordinary players retain their own-message restrictions. Narrator edits preserve the original state block and never replay or rewrite inventory/Scene history. Concurrent edits are detected, and saved text is read back before reporting success. Editing past prose does not undo its recorded consequences.

Database permission/state tests run in a rollback transaction; DOM tests cover request matching, streaming, cross-conversation isolation, exact receipts, rejection reporting, retries and edit access. Existing HUD routing, workspaces, speaker and typing tests pass. An unrelated prepared-room CSS test also fails on the unchanged previous release in this JSDOM environment. Live Android/Tampermonkey verification remains to be done. No story test posts or Notion changes are retained.

## HUD v0.8.17 — tighter Admin and Current Session layout

Administration uses compact, indented gold links with the active-page highlight retained. Selected Session now has its own heading with a small manual refresh control beside it. Section dividers, character headings and participant rows use tighter spacing on mobile and desktop. Room selection and navigation behavior are unchanged.

## HUD v0.8.16 / Web v0.8.8 — shared typing and compact HUD controls

The HUD header keeps its title on one line with smaller logo/version/settings/minimize controls. The room heading scrolls horizontally, with Live, typing and narration status alongside it. The old room Refresh/Back controls are hidden; use the yin-yang navigation. The shorter action rail hides its scrollbar, adds a divider above the composer, and includes a leaf-green owner-only End session shortcut using the existing confirmation and server controls.

The speaker switch displays a person icon. Tap changes character/player-chat mode; hold, right-click or press Arrow Down opens a picker restricted to the player's participating characters. A validated owner-posting RPC preserves the selected character in the actual message; normal participants use the existing character-aware posting RPC. Draft text remains on-device. Typing pulses carry only server-validated names, are throttled to at most one every two seconds while typing, clear on send/blur/mode change/idle, and expire after seven seconds. Active chat views poll the combined narration/typing status every three seconds without refreshing Session Info or the sidebar. Narration takes priority over typing; Web connection errors take priority over both.

Verified with DOM/contrast checks, notifier/picker tests, rollback-only database tests for expiry, spoofing, access, character-aware posts and idempotent retries, plus a delegated HUD-to-owner-Web typing check. No test story or typing data was retained. Live mobile visual verification was not available. Update the installed HUD on each device and refresh the Web.

## HUD v0.8.15 / Web v0.8.3 — compact tools and shared narration preparation

Tools, settings, player registry and character workspaces use a consistent compact heading/spacing scale. Session Info is room-wide, hides the HUD character selector and refresh control, and no longer reloads on chat polling or character switching; reopening it loads current details saved through Session Tools. Scene and inventory retain their existing update behavior.

Pressing HUD Narrate first saves a verified owner-only preparation indicator, then prepares the ChatGPT request. Room participants see “The Jade Emperor is preparing narration…” on the next chat poll (up to 18 seconds on Web). This reports GM preparation, not observed model generation. It clears automatically with a published narrator message, expires after 10 minutes if abandoned, and can be canceled from the HUD. Room membership, active status and generation restrict access; ordinary players cannot change it. Backend checks run in a rollback transaction, including player denial, publication clearing and timeout. No test narration is retained.

Voice chat is not part of this release.

## HUD v0.8.14 — compact navigation and reading layout

All header controls and the version remain visible in a shorter header. The session toolbar is one horizontally scrollable row above a one-row expanding composer, neutral character switch and red Send button. Secondary controls use compact 14px labels with 44px touch targets; messages keep 16px text and a subtle narrator accent. Admin navigation becomes aligned rows with tighter section spacing. Current Session retains manual refresh. HUD page behavior, drafts, pairing and stored game data are unchanged. Update each device's installed userscript and reload ChatGPT.

## HUD v0.8.13 — manual Current Session refresh

Current Session has a small refresh button beside its heading on mobile and desktop. Sidebar rooms, participant lists and Heavenly Calendar no longer reload every 12 seconds. They still load at startup, after relevant room actions, when changing the session picker, and when Refresh is pressed. Only a visible, expanded chatroom continues polling messages; minimized HUDs pause that polling. Update the installed userscript and reload ChatGPT to replace older mobile HUD versions.

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

## HUD v0.8.2 — retained pages and editable Notion imports

Minimize and switching HUDs preserve the current Paths page, unsaved form fields, expanded panels and scroll positions within the loaded tab. Reloading ChatGPT still starts a fresh HUD UI.

Players Registry → Characters → Add Character now offers a Notion link and **Check Page**. It fills a draft name, brief description and optional explicitly labeled objective; nothing is registered until **Register Character**. Existing character forms can check another page too; review and Save applies the edited result. Notion source links are saved alongside the character. Removing a saved character still preserves past appearances and current participation.

The importer prefers an explicit HUD description/summary on the character page, otherwise the HUD-description quote immediately following that character’s child-page link in its Player Characters parent. A dedicated HUD Summary heading also works. It reads through the official Notion API, copies only selected fields into the HUD, does not summarize private dossiers with AI, and does not download illustrations. A missing summary is left blank with an explanation. Description is capped at 350 characters with a review notice.

### One-time Notion setup

Create a read-only Notion connection and grant it the character pages **and their Player Characters parent**, where the HUD quotes live. In the project’s Supabase Dashboard → Edge Functions → Secrets, save its private API token under **NOTION_TOKEN**. Do not put the token in chat, this repository, the userscript, or frontend storage. This repository contains no Notion secret. Changing Notion does not automatically overwrite a registered character: Check Page and Save are explicit actions.

The deployed `notion-character-preview` Edge Function requires a user JWT and calls the existing owner-scoped character RPC with the caller’s token before reading Notion. Only an actual owner or currently paired HUD can request a preview for their registered player. It uses no service-role key. `db/notion-character-import.sql` adds source links and a validated owner-scoped save RPC. Missing NOTION_TOKEN produces a setup message instead of clearing the draft.

HUD v0.8.1 adds a room shortcut directly below the active-session picker and removes its redundant visible label.

# Paths Monkey — GM HUD

Standalone **Paths of Immortality HUD** Tampermonkey userscript for the Paths world. The source lives in the Paths repository and does not modify Mizuhana's scripts or saves.

## HUD v0.8.0

Create Room prepares the date/time, Codex or custom location, starting spot, opening, goals and invited players. Select people only; players choose their saved characters on Web. Add a player’s characters in Registry first. Prepared private codes appear in Session tools for copying after creation. Session tools also edits the same setup and can issue new player codes. A solo room needs no invitees.

The location list is a checked snapshot of 21 established Notion places, with source links. It does not automatically sync later Notion edits. Custom locations stay with the session. Use Session tools to edit the setup after creation.

## Previous HUD v0.7.10

The visible main page highlights only its matching navigation button. Create Room and Settings now open separate views; setup/pairing is under the gear. Unconnected HUDs get an explicit Open Settings shortcut in Create Room. Desktop gear and minimize controls are larger.

## Previous HUD v0.7.9

Desktop Admin stays in a left sidebar while selected pages open to its right. ☯ hides/restores the sidebar and lets the main page use the extra width. Mobile layout is unchanged. The active-session dropdown explicitly selects the loaded room and refreshes Characters and Heavenly Calendar.

## Previous HUD v0.7.8

☯ opens/closes the information panel. Closing it reveals the page underneath with its state preserved. Back buttons still navigate through visited pages.

## Previous HUD v0.7.7

Each player card shows only the active Rename or Characters panel. The selected button is highlighted; tapping it again closes the panel.

## Previous HUD v0.7.6

Register Player opens its form; the red Register button submits it. Status appears beside each name. Rename opens the rename form; Characters opens saved character choices with Add, Save and Remove controls. Duplicate player names show a warning. Characters remain attached to the same player ID when the player is renamed; removal preserves past scenes.

## Previous HUD v0.7.5

☯ goes back to the previous HUD page. Current Session starts with one active-session picker that controls both Characters and Heavenly Calendar. Removed the duplicate room name, active-session button list and its refresh button; open chats through Room Logs. Player and character rows are larger and brighter.

## Previous HUD v0.7.4

Administration → Room Logs lists ongoing and concluded rooms. Open an ongoing room to enter chat; concluded rooms show Scene ended. Current Session now contains active-room chat buttons. Its Characters picker shows the players and all characters participating in the chosen active session without changing your chatroom. Removed the Trusted HUD linked-to-owner status line.

## Previous HUD v0.7.3

Administration and Current Session now collapse independently. Use ＋ Create a New Room, the small ↻ refresh button, or Players Registry under Administration. Registry can register/rename players and show their ongoing rooms and characters. It requires your paired HUD. Current Session groups character information and the saved scene date. Removed the Connected to room notice and old Monkey explanation.

## Previous HUD v0.7.2

HUD opens on Administration with no action composer. Create a New Room opens the creation form; collapsible Ongoing Sessions lists active rooms only. Selecting one opens its chatroom and composer. ☯ returns to Administration. Session tools in the chatroom retains scene introductions, invitations and lifecycle controls. Ended or unavailable scenes return to Administration.

## Previous HUD v0.7.1

The ☯ button toggles session information in the full-width HUD body on mobile and desktop. Information scrolls between the header and action composer; both composers remain available. Tap ☯ again to return to ChatGPT. The information view and shared-feed peek close each other. Header/composer sizing adapts to wrapped controls and expanding text.

## Install

Open this URL in Firefox for Android with Tampermonkey enabled:

https://raw.githubusercontent.com/denOden3/Paths-to-Immortality/main/userscripts/Paths-Monkey-GM.user.js

Approve installation (or **Check for userscript updates** if already installed) and reload https://chatgpt.com/. Verify the Tampermonkey entry name is **Paths of Immortality HUD** and the version is **0.8.0**. Because the display name changed, check that you don't have a second older Paths script enabled.

## Connect to an existing room

1. On the Paths website, sign in with Google as the room owner, open the room, then tap Invite and copy a new single-use code.
2. In the Paths HUD on ChatGPT, open Monkey's briefcase (gear icon).
3. Create a separate Monkey guest identity; enter the code and character name Xiao Lan; join the room.
4. Post Xiao Lan's action from the HUD composer. Your friend should see it on the Paths website.
5. Press Prepare Narrate to copy/prefill a short command in ChatGPT. Press ChatGPT's blue Send button yourself.

Important: The Monkey guest is a separate Supabase identity from your Google owner identity. It is not an additional in-world character. The room may list the name Xiao Lan twice.

Version 0.1.1 is a manually triggered experiment, not an automated AI model connection. The userscript never reads ChatGPT replies or scrapes output. Room messages are subject to Supabase Auth and row-level permissions. Do not share authentication tokens or secret keys. The guest identity depends on the script's stored data.

To hide or remove the new HUD without affecting Mizuhana, disable Paths Monkey in Tampermonkey. The initial mobile placement and messaging integration still need testing on your Android phone.

## v0.2.0 — HUD picker and full collapse

- The header's **▁** control and the Paths title collapse the entire Paths HUD into one **☯ Paths of Immortality** top-center capsule. The chat narration and native composer are uncovered.
- Tap the capsule to expand Paths. The capsule disappears while the full Paths HUD is expanded, so no launcher remains over the header or conversation.
- Long-press the capsule (or tap its ▾ arrow) for the picker. If the separate Mizuhana userscript has launched on this page, choosing **🌺 Mizuhana** yields control to it. Paths does not alter Mizuhana's source code or stored world state.
- When Mizuhana is selected, collapse Mizuhana using its own title and long-press its capsule to choose **☯ Paths of Immortality**. The Paths userscript adds that optional return entry to Mizuhana's existing DOM picker without rewriting the Mizuhana userscript.
- The Paths launcher hides the competing Mizuhana launcher **only while Paths is selected**. This temporary display coordination is removed when you switch to Mizuhana.
- Paths remembers expanded/collapsed state through reloads. Its Tampermonkey menu also offers **Open Paths of Immortality HUD** as a recovery action.
- Setup/settings no longer pop open automatically when entering a chat. Open ⚙ when you're ready to connect the Monkey guest.

**Important:** If you have two independent Mizuhana userscripts running (such as testing and production), they may each create a Mizuhana launcher; this release does not remove or modify either one. To use only one Mizuhana interface at a time, disable the unnecessary duplicate manually in Tampermonkey.

## v0.2.1 — Minimal HUD chrome

- Simplifies the collapsed launcher to one **☯ Paths of Immortality** button without a visible dropdown arrow. **Long-press** the capsule to open the HUD picker; ordinary tap still expands Paths.
- Removes the redundant subtitle under the Paths header, the Xiao Lan action composer heading, the Offline status badge, and the reminder that ChatGPT's native composer stays below.
- Keeps the action textarea, **Post to shared room**, **Prepare Narrate**, the room connection information inside ⚙ settings, and the native ChatGPT Send control.
- No changes to Mizuhana's repository or saved state.

## v0.2.2 — Compact mobile action bar

- **Post**, **Narrate**, and **Scene** now sit together beneath the action composer. The Scene peek no longer takes room in the title bar.
- The mobile information drawer (☰) moved beside Settings (⚙).
- The Xiao Lan action field starts at one text line (`rows=1`) and automatically grows only when its content needs more lines, to a maximum of roughly five lines before scrolling.
- **Post** is explicitly a player-action message. **Narrate** prepares a short ChatGPT GM instruction in the native composer but does not send it without the user's blue Send press; narration publication remains a separate, protected path. There is no narrator/player mode toggle in the action field.
- The Mizuhana repository and its settings remain untouched.

## v0.2.3 — Action-button spacing

The three Paths HUD controls (Post, Narrate, Scene) now have larger gaps on mobile and desktop. No changes to the existing room connection, narration mechanics, Mizuhana source or saved data. Message long-press editing is provided on the **shared GitHub Pages website**, not yet inside the Monkey Scene peek.

## v0.3.0 — Xiao Lan / OOC one-button mode

- In **Paths HUD** (the Tampermonkey interface), tap the **Xiao Lan** button beside the one-line action field. **Bright = Xiao Lan character action**; **dim = your OOC player chat**. The same button remains visible in both states, and your choice is kept in the userscript's own storage.
- OOC placeholder: **Hear ye, hear ye, the Jade Emperor has spoken!**
- **Post** sends the selected message type to Supabase; the Scene peek distinguishes OOC and Narrator bubbles. **Narrate** explicitly asks the GM to ignore OOC messages.
- The friend-facing GitHub Pages application is called **Paths Web**, never another HUD. Paths Web has a separate two-option Character / Player · OOC switch, and its long-press selection menu begins with **OOC** (or **Character** when switching already-OOC messages back).
- Existing Mizuhana scripts and saved states remain untouched. The one-time GM pairing ritual and automatic Notion scene compilation are not yet built.

## v0.3.2 — Desktop title and misclick-safe speaker control

- Desktop at 900 CSS px and wider: **Paths to Immortality** title scales to 20 px while mobile keeps its compact title.
- Composer top row remains **action textarea → Send**. Lower action row is **Narrate · Scene · Xiao Lan**, with Xiao Lan pushed to the right but offset inward from Send instead of directly beneath it. Narrow layouts reduce the offset before wrapping.
- The identity toggle still controls actual Supabase `player` versus `ooc` messages. Scene stays as the current read-only room-message peek for checking other players' actions; a future session panel could replace it after reliable narration integration.
- Mizuhana stable/testing scripts, settings and saves are unchanged.

## v0.3.3 — Authoritative Notion Narration Rules

The Paths HUD Narrate action now asks ChatGPT to **fetch and read** the latest [Narration Rules](https://app.notion.com/p/3fab0ac52efe810caecfdf5da0270caf) before resolving any shared in-character directives. The link in the sidebar points to the same page. The old Shared Narrator Protocol has become an archived regression test, not active instructions.

The narrator must state plainly if it cannot retrieve Notion; it cannot claim compliance, source verification or successful Supabase publication without actual access and confirmed writes. Player/OOC distinctions and the existing testing-only no-Notion-edits setting remain unchanged. No ChatGPT response is automatically delivered merely because the page exists; the user must still submit the native ChatGPT composer.

## Paths HUD v0.4.0 — trusted owner pairing

1. Update the Tampermonkey userscript on Firefox and open **Paths HUD → Settings / Connections**.
2. If the Monkey has no identity, tap **Create Monkey guest identity**. Under **One-time GM pairing**, tap **Request pairing code**. The private code expires after 10 minutes; request a new one if needed. Do not share it publicly.
3. Open **Paths Web** separately with the **Google-signed-in owner account**, enter a room that account owns, click ☯ **Tools**, and approve the code under **Trusted Paths HUD**. The Web asks for explicit approval of all rooms owned by the account.
4. Return to Paths HUD, tap **Refresh authorization**, and choose one of the owner's rooms (or create a new owner room). In pairing mode, **Send** posts as the owner's chosen character rather than a second Monkey character.
5. To revoke the grant, return to the Google owner's **Paths Web → ☯ Tools → Revoke access**. If you lose the anonymous Monkey identity or its browser storage, revoke the old pairing and authorize the replacement identity.

The old invite-based Monkey-as-separate-player option remains in Settings as a legacy fallback for testing; it is hidden after pairing. Only rooms belonging to the authorizing Google account become accessible. Existing rooms owned by unrelated anonymous accounts are **not** transferred by pairing. Access tokens remain inside Tampermonkey's private storage and are never copied to GitHub or Paths Web. This is an explicitly user-approved connection; it does not grant access to Notion and doesn't yet automate sending GPT narration.

## Paths HUD v0.4.2 — Rooms page and mobile navigation

- The **☯ symbol beside the title** toggles the HUD information sidebar on narrow/mobile screens, replacing the separate three-line panel-list button. The Desktop sidebar continues to appear normally.
- The sidebar now offers **📂 Rooms & sessions**. Open it to create an owner room, refresh the list, or choose an existing room. The previous room-creation/list inputs have been relocated from Monkey's briefcase to this dedicated page; they continue to use the same trusted owner pairing and existing Supabase identity.
- **⚙ Monkey's briefcase** now focuses on connection and pairing/recovery; its verbose top explanation and duplicated 'Trusted HUD paired' badge were removed. The remaining confirmation appears once under Pairing & recovery.
- The legacy option to join with an invitation (separate guest identity) remains with the room controls as a fallback for unpaired users. Owner authorization is still handled in Paths Web. The private pairing itself is not reset by these interface changes.
- Paths Web remains the **actual shared client for Puuchan and future players**; HUD is the owner's in-ChatGPT control interface. Invitation creation and most player flows still require Paths Web until further implementation.
- This is code-reviewed and JavaScript-syntax-checked; the Android Firefox layout and touch behavior require a real device check.

## HUD v0.5.1 — Scene introduction and invited character roles

In **☁ Rooms & Sessions**, select/create a paired owner room, then save **In-world date**, **Location** and **Opening situation**. Next enter a player nickname and select **Assigned** or **Temporary guest**:

- **Assigned:** put one approved character name per line, e.g. `Xu Yi`; multiple lines assign multiple characters to the same player. The invited player gets no character picker on the entrance page.
- **Temporary guest:** one role per line in the form `Applicant | Another hopeful attempting the second-day trial | Complete the examination`. The guest sees the role descriptions and objectives, chooses a role and names their temporary character upon entering.

Tap **Generate private invitation** and **Copy invitation link**. Send the link privately; it expires after 48 hours and can be redeemed once. Guest preview does not require email login; the website creates an anonymous identity when the player enters. The owner's existing pairing remains valid across future rooms. Notion's existing Guest Registry remains the editable planning record and is **not automatically synced** to the invitation generator yet.

## v0.6.0 — New player portal

Update this script to get **Copy invitation code** beside Copy invitation link. The updated website accepts either. Assigned invitations offer established character checkboxes; guest invitations offer ONE named pre-established temporary character or a character previously played by the same registered player. Guest entries now use `Character name | Description | Objective`, with no free-form name field on the website. Player aliases and invitation categories must agree with the Jade Emperor’s player registry. The trusted HUD pairing does not need to be repeated.

## v0.7.0 — Unified invitations and session controls

Update the existing script; the pairing remains valid. Rooms & sessions now has **Kick player from the room**, **End session**, and **Reset session** with confirmation. End preserves messages; Reset erases the ongoing chat and scene introduction and requires fresh invitation codes. Both return players to the starting page once their connected tab checks access. All players now use the same invitation flow and character checkboxes. Enter character options as `Name | Description | Objective` (description/objective optional); there is no invitation category selector.
