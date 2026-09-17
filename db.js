const fs = require("fs");
const path = require("path");
const config = require("./config");

// JSON storage avoids native database builds, which makes the bot much easier
// to deploy on Render. The data format is intentionally small and simple.
const dbPath = path.resolve(config.dbPath || "vehicle-life.json");
const parent = path.dirname(dbPath);
if (parent !== ".") fs.mkdirSync(parent, { recursive: true });

let state = { users: {} };
try {
  if (fs.existsSync(dbPath)) {
    const parsed = JSON.parse(fs.readFileSync(dbPath, "utf8"));
    if (parsed && typeof parsed === "object" && parsed.users) state = parsed;
  }
} catch (error) {
  console.error(`[DB] Could not read ${dbPath}; starting with empty data:`, error.message);
}

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const tmp = `${dbPath}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(state, null, 2), "utf8");
      fs.renameSync(tmp, dbPath);
    } catch (error) {
      console.error("[DB] Failed to save data:", error);
    }
  }, 100);
}

function key(userId, guildId) {
  return `${guildId}:${userId}`;
}

function ensureUser(userId, guildId) {
  const k = key(userId, guildId);
  if (!state.users[k]) {
    state.users[k] = {
      user_id: userId,
      guild_id: guildId,
      messages: 0,
      vc_seconds: 0,
      vehicle_index: 0,
      last_vc_join: null,
      updated_at: Math.floor(Date.now() / 1000)
    };
    save();
  }
  return state.users[k];
}

function getUser(userId, guildId) {
  return ensureUser(userId, guildId);
}

function touch(user) {
  user.updated_at = Math.floor(Date.now() / 1000);
  save();
}

function addMessage(userId, guildId, count = 1) {
  const user = ensureUser(userId, guildId);
  user.messages += Math.max(0, Math.floor(Number(count) || 0));
  touch(user);
}

function addVcSeconds(userId, guildId, seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  const user = ensureUser(userId, guildId);
  user.vc_seconds += Math.floor(seconds);
  touch(user);
}

function setVcJoin(userId, guildId, timestamp) {
  const user = ensureUser(userId, guildId);
  user.last_vc_join = timestamp;
  touch(user);
}

function clearVcJoin(userId, guildId) {
  const user = ensureUser(userId, guildId);
  user.last_vc_join = null;
  touch(user);
}

function setVehicleIndex(userId, guildId, index) {
  const user = ensureUser(userId, guildId);
  user.vehicle_index = Math.max(0, Math.floor(index));
  touch(user);
}

function topUsers(guildId, limit = 10) {
  return Object.values(state.users)
    .filter(user => user.guild_id === guildId)
    .sort((a, b) =>
      b.vehicle_index - a.vehicle_index ||
      b.vc_seconds - a.vc_seconds ||
      b.messages - a.messages
    )
    .slice(0, limit);
}

// Flush pending writes during normal shutdown.
function flush() {
  clearTimeout(saveTimer);
  try {
    fs.writeFileSync(dbPath, JSON.stringify(state, null, 2), "utf8");
  } catch (error) {
    console.error("[DB] Final save failed:", error);
  }
}

process.once("SIGINT", () => { flush(); process.exit(0); });
process.once("SIGTERM", () => { flush(); process.exit(0); });

module.exports = {
  dbPath,
  ensureUser,
  getUser,
  addMessage,
  addVcSeconds,
  setVcJoin,
  clearVcJoin,
  setVehicleIndex,
  topUsers,
  flush
};
