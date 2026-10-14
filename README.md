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
