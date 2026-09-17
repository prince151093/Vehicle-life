require("dotenv").config();

module.exports = {
  token: process.env.DISCORD_TOKEN?.trim(),
  clientId: process.env.CLIENT_ID?.trim(),
  guildId: process.env.GUILD_ID?.trim() || null,
  topGaragesChannelId: process.env.TOP_GARAGES_CHANNEL_ID?.trim() || null,
  // Render's filesystem is ephemeral unless you attach a persistent disk.
  // Set DB_PATH to the mounted disk path when using one (for example /var/data/vehicle-life.json).
  dbPath: process.env.DB_PATH?.trim() || "vehicle-life.json"
};
