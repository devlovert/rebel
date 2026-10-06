# Command Layout

The command loader scans this folder recursively.

## admin/

Commands in this folder require a WhatsApp group admin or a configured bot owner. Group moderation commands also require a group chat.

- `menu.js`: command menu and owner information.
- `playaudio.js` and `playvideo.js`: YouTube audio/video downloads.
- `fb.js`, `insta.js`, and `tiktok.js`: downloads from supported social links.
- Other files provide group moderation, settings, and utility commands.

## owner/

- `kickall.js`: removes eligible non-admin members from a group.
- `setmode.js`: switches the bot between admin and owner-only mode.
- `reveal.js`: reveals quoted View Once media as normal media in chats and groups.

All commands in this folder are owner-only.

Access is also enforced centrally in `handler.js`; moving a command into `admin/` or `owner/` automatically applies the matching permission.

`config.js` has one `ownerNumber`. Only the WhatsApp account matching that number is authorized to use owner commands and pairing codes.
