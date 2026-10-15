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
