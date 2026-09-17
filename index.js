const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType
} = require("discord.js");

const config = require("./config");
const { vehicles } = require("./vehicles");
const {
  dbPath,
  getUser,
  addMessage,
  addVcSeconds,
  setVcJoin,
  clearVcJoin,
  setVehicleIndex,
  topUsers
} = require("./db");
const { profileEmbed, garageEmbed, topGaragesEmbed } = require("./cards");

if (!config.token) {
  console.error("[CONFIG] Missing DISCORD_TOKEN environment variable.");
  process.exit(1);
}

if (!config.clientId) {
  console.error("[CONFIG] Missing CLIENT_ID environment variable.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Channel]
});

const commands = [
  new SlashCommandBuilder()
    .setName("profile")
    .setDescription("View your Vehicle Life profile"),
  new SlashCommandBuilder()
    .setName("garage")
    .setDescription("View your complete vehicle collection"),
  new SlashCommandBuilder()
    .setName("topgarages")
    .setDescription("Refresh the Top Garages leaderboard"),
  new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Set the current channel as the Top Garages channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
].map(c => c.toJSON());

async function deployCommands() {
  console.log(`[DISCORD] Registering slash commands${config.guildId ? ` for guild ${config.guildId}` : " globally"}...`);
  const rest = new REST({ version: "10" }).setToken(config.token);
  if (config.guildId) {
    await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: commands });
    console.log("Guild slash commands registered.");
  } else {
    await rest.put(Routes.applicationCommands(config.clientId), { body: commands });
    console.log("Global slash commands registered.");
  }
}

async function checkUnlocks(guild, userId) {
  const user = getUser(userId, guild.id);
  let unlocked = [];
  let index = user.vehicle_index;

  while (index < vehicles.length) {
    const next = vehicles[index];
    const hours = user.vc_seconds / 3600;
    if (hours >= next.vcHours && user.messages >= next.messages) {
      index++;
      unlocked.push(next);
    } else break;
  }

  if (!unlocked.length) return;

  setVehicleIndex(userId, guild.id, index);

  const member = await guild.members.fetch(userId).catch(() => null);
  if (member) {
    const last = unlocked[unlocked.length - 1];
    const channel = guild.systemChannel;
    if (channel) {
      await channel.send(
        `🎉 **NEW VEHICLE UNLOCKED!**\n` +
        `${member} has unlocked **${last.emoji} ${last.name}**!\n` +
        `🏁 Collection: **${index}/${vehicles.length}**`
      ).catch(() => {});
    }
  }
}

async function refreshTopGarages(guild, channel) {
  const rows = topUsers(guild.id, 10);
  await channel.send({ embeds: [topGaragesEmbed(rows, guild)] });
}

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`[DB] Data file: ${dbPath}`);
  try {
    await deployCommands();
    console.log("[READY] Vehicle Life is online and commands are registered.");
  } catch (error) {
    console.error("[COMMANDS] Slash-command registration failed:", error);
    // Do not kill the gateway connection: the bot can still run existing commands.
  }
});

client.on("error", error => console.error("[DISCORD] Client error:", error));
client.on("warn", warning => console.warn("[DISCORD] Warning:", warning));
process.on("unhandledRejection", error => console.error("[PROCESS] Unhandled rejection:", error));
process.on("uncaughtException", error => {
  console.error("[PROCESS] Uncaught exception:", error);
  process.exit(1);
});

client.on("messageCreate", async message => {
  if (!message.guild || message.author.bot) return;
  addMessage(message.author.id, message.guild.id, 1);
  await checkUnlocks(message.guild, message.author.id);
});

client.on("voiceStateUpdate", async (oldState, newState) => {
  if (!newState.guild) return;
  const userId = newState.id;
  const guildId = newState.guild.id;

  const joined = !oldState.channelId && newState.channelId;
  const left = oldState.channelId && !newState.channelId;

  // Ignore bots.
  const member = newState.member || oldState.member;
  if (member?.user?.bot) return;

  if (joined) {
    setVcJoin(userId, guildId, Date.now());
  } else if (left) {
    const user = getUser(userId, guildId);
    if (user.last_vc_join) {
      addVcSeconds(userId, guildId, Math.floor((Date.now() - user.last_vc_join) / 1000));
    }
    clearVcJoin(userId, guildId);
    await checkUnlocks(newState.guild, userId);
  }
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (!interaction.guild) return interaction.reply({ content: "❌ This command can only be used inside a server.", ephemeral: true });

  const user = getUser(interaction.user.id, interaction.guild.id);

  if (interaction.commandName === "profile") {
    return interaction.reply({ embeds: [profileEmbed(interaction.member, user)] });
  }

  if (interaction.commandName === "garage") {
    return interaction.reply({ embeds: [garageEmbed(interaction.member, user)] });
  }

  if (interaction.commandName === "topgarages") {
    return interaction.reply({ embeds: [topGaragesEmbed(topUsers(interaction.guild.id, 10), interaction.guild)] });
  }

  if (interaction.commandName === "setup") {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: "❌ You need Manage Server permission.", ephemeral: true });
    }
    if (interaction.channel.type !== ChannelType.GuildText) {
      return interaction.reply({ content: "❌ Run this command inside a text channel.", ephemeral: true });
    }
    return interaction.reply({
      content:
        `✅ **Top Garages channel configured!**\n` +
        `Use \`/topgarages\` here to publish the leaderboard.\n\n` +
        `For automatic updates, put this channel ID in \`TOP_GARAGES_CHANNEL_ID\` in your .env.`
    });
  }
});

client.login(config.token).catch(error => {
  console.error("[DISCORD] Login failed:", error);
  process.exit(1);
});