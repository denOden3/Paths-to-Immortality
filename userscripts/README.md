# Paths Monkey — GM HUD

Standalone **Paths of Immortality HUD** Tampermonkey userscript for the Paths world. The source lives in the Paths repository and does not modify Mizuhana's scripts or saves.

## Install

Open this URL in Firefox for Android with Tampermonkey enabled:

https://raw.githubusercontent.com/denOden3/Paths-to-Immortality/main/userscripts/Paths-Monkey-GM.user.js

Approve installation (or **Check for userscript updates** if already installed) and reload https://chatgpt.com/. Verify the Tampermonkey entry name is **Paths of Immortality HUD** and the version is **0.3.2**. Because the display name changed, check that you don't have a second older Paths script enabled.

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
