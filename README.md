# 🚗 Vehicle Life Discord Bot

A Discord activity-to-vehicle collection bot using Discord.js and JSON.

## Render deployment

This repository is configured for a Render **Background Worker**.

### 1. Create the service

Upload/push this project to a Git repository and create a Render Background Worker from it, or use the included `render.yaml` with a Blueprint deployment.

Render commands:

- Build: `npm install`
- Start: `npm start`
- Node: controlled by `package.json` (`>=20 <23`)

### 2. Environment variables

Set these in Render:

```env
DISCORD_TOKEN=YOUR_BOT_TOKEN
CLIENT_ID=YOUR_DISCORD_APPLICATION_ID
GUILD_ID=YOUR_TEST_SERVER_ID
TOP_GARAGES_CHANNEL_ID=
DB_PATH=vehicle-life.json
```

`GUILD_ID` is optional. Keeping it set while testing registers slash commands to that server immediately. Without it, commands are registered globally and Discord can take longer to propagate them.

**Never put your Discord token in the source code or commit it to Git.**

### 3. Discord Developer Portal

Enable these privileged intents for the bot:

- Server Members Intent
- Message Content Intent

Voice tracking also requires the bot to be able to see the relevant voice channels.

### 4. Persistent JSON data on Render

Render worker filesystems are not persistent by default. If you want vehicle/message/VC progress to survive a service replacement or redeploy, attach a Render Persistent Disk and set:

```env
DB_PATH=/var/data/vehicle-life.json
```

Use the mount path you configure for the disk.

### 5. Commands

- `/profile` — current vehicle, VC time, messages and next unlock
- `/garage` — complete collection
- `/topgarages` — leaderboard
- `/setup` — admin helper for the Top Garages channel

## Progression

All vehicle requirements are in `src/vehicles.js`. A vehicle unlocks only when both its cumulative VC-hour requirement and message requirement are reached.
