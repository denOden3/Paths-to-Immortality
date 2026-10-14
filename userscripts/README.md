# Paths Monkey — GM HUD

Standalone Tampermonkey userscript for Paths to Immortality. It does not modify Mizuhana's scripts or saves.

## Install

Open this URL in Firefox for Android with Tampermonkey enabled:

https://raw.githubusercontent.com/denOden3/Paths-to-Immortality/main/userscripts/Paths-Monkey-GM.user.js

Approve installation and reload https://chatgpt.com/.

## Connect to an existing room

1. On the Paths website, sign in with Google as the room owner, open the room, then tap Invite and copy a new single-use code.
2. In the Paths HUD on ChatGPT, open Monkey's briefcase (gear icon).
3. Create a separate Monkey guest identity; enter the code and character name Xiao Lan; join the room.
4. Post Xiao Lan's action from the HUD composer. Your friend should see it on the Paths website.
5. Press Prepare Narrate to copy/prefill a short command in ChatGPT. Press ChatGPT's blue Send button yourself.

Important: The Monkey guest is a separate Supabase identity from your Google owner identity. It is not an additional in-world character. The room may list the name Xiao Lan twice.

Version 0.1.1 is a manually triggered experiment, not an automated AI model connection. The userscript never reads ChatGPT replies or scrapes output. Room messages are subject to Supabase Auth and row-level permissions. Do not share authentication tokens or secret keys. The guest identity depends on the script's stored data.

To hide or remove the new HUD without affecting Mizuhana, disable Paths Monkey in Tampermonkey. The initial mobile placement and messaging integration still need testing on your Android phone.
