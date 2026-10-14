# Paths-to-Immortality

A mobile-first, two-player xianxia roleplaying HUD for Cloudveil Sect.

## Status: Test 1 — Private shared chat

- **Website:** https://denOden3.github.io/Paths-to-Immortality/ (available after GitHub Pages is enabled)
- **Backend:** Supabase project `Paths to Immortality` in Singapore
- **Included:** Secure room creation, single-use invitations, participant-only messages, realtime updates, browser-local unsent drafts
- **Coming later:** GPT Narrate, chronology/Notion sync, character panels, canonical scene archives

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

**Testing only:** This prototype does not contain a functioning AI narrator, nor does it update any Notion story canon. Back up important content independently; the Free backend can pause with inactivity.
