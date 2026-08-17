const {
    Client,
    GatewayIntentBits,
    Partials,
    Collection,
    EmbedBuilder,
    REST,
    Routes,
    PermissionFlagsBits
} = require("discord.js");

const fs = require("fs");
const path = require("path");

// ============================================================
// CONFIG
// ============================================================

const TOKEN = process.env.DISCORD_TOKEN;

// Your Discord User ID
const OWNER_ID = "1193602200644091957";

// ============================================================
// SAFETY CHECK
// ============================================================

if (!TOKEN) {
    console.error("❌ DISCORD_TOKEN is missing.");
    console.error("Add DISCORD_TOKEN to Railway Variables.");
    process.exit(1);
}

// ============================================================
// CLIENT
// ============================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [
        Partials.Channel,
        Partials.Message
    ]
});

// ============================================================
// COLLECTIONS
// ============================================================

client.commands = new Collection();

// Stores active games
client.activeGames = new Map();

// Stores player points
client.playerPoints = new Map();

// Owner
client.ownerId = OWNER_ID;

// ============================================================
// GAME FILES
// ============================================================

const gameFiles = [
    {
        file: "./sgames.js",
        type: "single"
    },
    {
        file: "./dualgames.js",
        type: "dual"
    },
    {
        file: "./mgames.js",
        type: "multi"
    }
];

// ============================================================
// LOAD GAME MODULES
// ============================================================

for (const game of gameFiles) {
    const fullPath = path.join(__dirname, game.file);

    if (!fs.existsSync(fullPath)) {
        console.warn(`⚠️ Game file not found: ${game.file}`);
        continue;
    }

    try {
        const module = require(fullPath);

        if (typeof module.register === "function") {
            module.register(client);
            console.log(`✅ Loaded ${game.type}: ${game.file}`);
        } else {
            console.warn(
                `⚠️ ${game.file} does not export a register(client) function.`
            );
        }
    } catch (error) {
        console.error(`❌ Failed to load ${game.file}`);
        console.error(error);
    }
}

// ============================================================
// /games
// ============================================================

client.commands.set("games", {
    data: {
        name: "games",
        description: "Show all available games."
    },

    async execute(interaction) {
        const guildName = interaction.guild
            ? interaction.guild.name
            : "Server";

        const embed = new EmbedBuilder()
            .setTitle(`${guildName} Games`)
            .setDescription(
                [
                    "## 🧍 Single Player",
                    "",
                    "⚡ **Fast**",
                    "🧮 **Math Race**",
                    "🃏 **Higher or Lower**",
                    "🔀 **Unscramble**",
                    "🧠 **Memory**",
                    "🔢 **Guess the Number**",
                    "🎯 **Reaction**",
                    "🧠 **Trivia**",
                    "",
                    "## ⚔️ 1v1 / Duel",
                    "",
                    "✊ **Rock Paper Scissors**",
                    "🎲 **Dice Duel**",
                    "",
                    "## 👥 Multiplayer",
                    "",
                    "🔒 Requires **Create Events** permission",
                    "",
                    "🪑 **Chairs**",
                    "🔫 **Mafia**",
                    "💣 **Bomb**",
                    "🔤 **Word Chain**",
                    "🎰 **Roulette**"
                ].join("\n")
            )
            .setFooter({
                text: "Use the game's slash command to play."
            })
            .setTimestamp();

        // The image uploaded for the games menu should be placed
        // in the same message as the Embed.
        //
        // The actual attachment is handled here if the file exists.
        const imagePath = path.join(
            __dirname,
            "assets",
            "games-banner.jpeg"
        );

        if (fs.existsSync(imagePath)) {
            embed.setImage("attachment://games-banner.jpeg");

            await interaction.reply({
                embeds: [embed],
                files: [
                    {
                        attachment: imagePath,
                        name: "games-banner.jpeg"
                    }
                ]
            });

            return;
        }

        await interaction.reply({
            embeds: [embed]
        });
    }
});

// ============================================================
// OWNER COMMANDS
// ============================================================

client.commands.set("addpoints", {
    data: {
        name: "addpoints",
        description: "Add points to a player.",
        options: [
            {
                type: 6,
                name: "player",
                description: "The player receiving the points.",
                required: true
            },
            {
                type: 10,
                name: "amount",
                description: "Amount of points.",
                required: true
            }
        ]
    },

    async execute(interaction) {
        if (interaction.user.id !== OWNER_ID) {
            return interaction.reply({
                content: "❌ You do not have permission to use this command.",
                ephemeral: true
            });
        }

        const user = interaction.options.getUser("player");
        const amount = interaction.options.getNumber("amount");

        if (!Number.isFinite(amount) || amount <= 0) {
            return interaction.reply({
                content: "❌ The amount must be greater than 0.",
                ephemeral: true
            });
        }

        const current = client.playerPoints.get(user.id) || 0;

        client.playerPoints.set(
            user.id,
            current + Math.floor(amount)
        );

        await interaction.reply({
            content:
                `✅ Added **${Math.floor(amount).toLocaleString()}** points to ${user}.\n` +
                `New balance: **${(current + Math.floor(amount)).toLocaleString()}**`
        });
    }
});

// ============================================================
// /setpoints
// ============================================================

client.commands.set("setpoints", {
    data: {
        name: "setpoints",
        description: "Set a player's points.",
        options: [
            {
                type: 6,
                name: "player",
                description: "The player.",
                required: true
            },
            {
                type: 10,
                name: "amount",
                description: "New point balance.",
                required: true
            }
        ]
    },

    async execute(interaction) {
        if (interaction.user.id !== OWNER_ID) {
            return interaction.reply({
                content: "❌ You do not have permission to use this command.",
                ephemeral: true
            });
        }

        const user = interaction.options.getUser("player");
        const amount = interaction.options.getNumber("amount");

        if (!Number.isFinite(amount) || amount < 0) {
            return interaction.reply({
                content: "❌ The amount cannot be negative.",
                ephemeral: true
            });
        }

        const value = Math.floor(amount);

        client.playerPoints.set(user.id, value);

        await interaction.reply({
            content:
                `✅ ${user}'s points have been set to **${value.toLocaleString()}**.`
        });
    }
});

// ============================================================
// /points
// ============================================================

client.commands.set("points", {
    data: {
        name: "points",
        description: "Check your points."
    },

    async execute(interaction) {
        const userId = interaction.user.id;

        // Owner has unlimited points.
        if (userId === OWNER_ID) {
            return interaction.reply({
                content: "👑 Your balance: **∞ points**"
            });
        }

        const points = client.playerPoints.get(userId) || 0;

        await interaction.reply({
            content:
                `🪙 **${interaction.user.username}**\n` +
                `Points: **${points.toLocaleString()}**`
        });
    }
});

// ============================================================
// OWNER CHECK
// ============================================================

client.isOwner = function (userId) {
    return userId === OWNER_ID;
};

// ============================================================
// POINT FUNCTIONS
// ============================================================

client.getPoints = function (userId) {
    if (userId === OWNER_ID) {
        return Infinity;
    }

    return client.playerPoints.get(userId) || 0;
};

client.addPoints = function (userId, amount) {
    if (userId === OWNER_ID) {
        return Infinity;
    }

    const current = client.playerPoints.get(userId) || 0;

    const newAmount = Math.max(
        0,
        current + Math.floor(amount)
    );

    client.playerPoints.set(userId, newAmount);

    return newAmount;
};

client.removePoints = function (userId, amount) {
    if (userId === OWNER_ID) {
        return Infinity;
    }

    const current = client.playerPoints.get(userId) || 0;

    const newAmount = Math.max(
        0,
        current - Math.floor(amount)
    );

    client.playerPoints.set(userId, newAmount);

    return newAmount;
};

client.hasEnoughPoints = function (userId, amount) {
    if (userId === OWNER_ID) {
        return true;
    }

    return client.getPoints(userId) >= amount;
};

// ============================================================
// CREATE EVENTS PERMISSION
// ============================================================

client.canUseMultiplayer = function (member) {
    if (!member) {
        return false;
    }

    // Owner always has access.
    if (member.id === OWNER_ID) {
        return true;
    }

    return member.permissions.has(
        PermissionFlagsBits.CreateEvents
    );
};

// ============================================================
// GAME HELPERS
// ============================================================

client.getGameKey = function (guildId, channelId) {
    return `${guildId}:${channelId}`;
};

client.isGameRunning = function (guildId, channelId) {
    const key = client.getGameKey(guildId, channelId);

    return client.activeGames.has(key);
};

client.getActiveGame = function (guildId, channelId) {
    const key = client.getGameKey(guildId, channelId);

    return client.activeGames.get(key);
};

client.setActiveGame = function (
    guildId,
    channelId,
    game
) {
    const key = client.getGameKey(guildId, channelId);

    client.activeGames.set(key, game);
};

client.removeActiveGame = function (
    guildId,
    channelId
) {
    const key = client.getGameKey(guildId, channelId);

    client.activeGames.delete(key);
};

// ============================================================
// INTERACTION HANDLER
// ============================================================

client.on("interactionCreate", async (interaction) => {
    try {
        // Slash Commands
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(
                interaction.commandName
            );

            if (!command) {
                return;
            }

            if (typeof command.execute !== "function") {
                return interaction.reply({
                    content: "❌ This command is not configured correctly.",
                    ephemeral: true
                });
            }

            await command.execute(interaction);
            return;
        }

        // Buttons, select menus and other interactions
        //
        // Individual game files can listen for these directly.
        // We intentionally don't process them here.
        if (
            interaction.isButton() ||
            interaction.isStringSelectMenu() ||
            interaction.isUserSelectMenu()
        ) {
            return;
        }

    } catch (error) {
        console.error("❌ Interaction error:");
        console.error(error);

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
                content: "❌ Something went wrong.",
                ephemeral: true
            }).catch(() => {});
        } else {
            await interaction.reply({
                content: "❌ Something went wrong.",
                ephemeral: true
            }).catch(() => {});
        }
    }
});

// ============================================================
// READY
// ============================================================

client.once("ready", async () => {
    console.log("======================================");
    console.log("🎮 GAME BOT ONLINE");
    console.log("======================================");

    console.log(`🤖 Logged in as: ${client.user.tag}`);
    console.log(`🆔 Bot ID: ${client.user.id}`);
    console.log(`👑 Owner ID: ${OWNER_ID}`);
    console.log(`🌐 Servers: ${client.guilds.cache.size}`);

    console.log("======================================");
});

// ============================================================
// REGISTER SLASH COMMANDS
// ============================================================

async function registerCommands() {
    const commands = [];

    for (const command of client.commands.values()) {
        if (!command.data) {
            continue;
        }

        commands.push(command.data);
    }

    // Game files may add commands to client.commands.
    console.log(
        `📦 Registering ${commands.length} slash commands...`
    );

    const rest = new REST({
        version: "10"
    }).setToken(TOKEN);

    try {
        /*
         * Global command registration.
         *
         * Global commands can take some time to appear after
         * changes. For development, you can later switch this
         * to guild-specific registration.
         */

        await rest.put(
            Routes.applicationCommands(
                process.env.CLIENT_ID
            ),
            {
                body: commands
            }
        );

        console.log("✅ Slash commands registered.");
    } catch (error) {
        console.error("❌ Failed to register slash commands.");
        console.error(error);
    }
}

// ============================================================
// LOGIN
// ============================================================

async function startBot() {
    try {
        await client.login(TOKEN);

        /*
         * Register commands after login.
         *
         * CLIENT_ID must be set in Railway as well.
         */
        await registerCommands();

    } catch (error) {
        console.error("❌ Failed to start the bot.");
        console.error(error);

        process.exit(1);
    }
}

// ============================================================
// PROCESS ERROR HANDLING
// ============================================================

process.on("unhandledRejection", (error) => {
    console.error("❌ Unhandled Promise Rejection:");
    console.error(error);
});

process.on("uncaughtException", (error) => {
    console.error("❌ Uncaught Exception:");
    console.error(error);
});

// ============================================================
// START
// ============================================================

startBot();