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
