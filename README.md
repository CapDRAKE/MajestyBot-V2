# Majesty Discord Bot (V1)

Prefix: `+`

## Features
- Welcome message in a configured channel
- Grade role give/remove
- Moderation: warn / mute (timeout) / unmute / ban
- Persistent history in `data/modlog.json`
- Anti-spam (flood + repetition) with auto-timeout
- Help command

## Setup
1. Upload files to FTP
2. `npm install`
3. Set token:
   - env var: DISCORD_TOKEN (recommended)
   - or config/config.js `token`
4. Enable intents in Discord Dev Portal:
   - Server Members Intent
   - Message Content Intent
5. Start:
   - `npm start`

## Commands
- `+help`
- `+grade add @user`
- `+grade remove @user`
- `+warn @user [reason]`
- `+history @user [N]`
- `+mute @user 10m [reason]`
- `+unmute @user [reason]`
- `+ban @user [reason]`