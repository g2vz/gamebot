const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const activeDuels = new Map();

const OWNER_ID = "1193602200644091957";
const WIN_POINTS = 15;

const CHALLENGE_TIMEOUT = 30_000;
const ROUND_TIMEOUT = 45_000;

// ============================================================
// HELPERS
// ============================================================

function getGameKey(guildId, channelId) {
    return `${guildId}:${channelId}`;
}

function isOwner(userId) {
    return userId === OWNER_ID;
}

function getChoiceName(choice) {
    const choices = {
        rock: "🪨 Rock",
        paper: "📄 Paper",
        scissors: "✂️ Scissors"
    };

    return choices[choice] || choice;
}

function getWinner(choice1, choice2) {
    if (choice1 === choice2) {
        return "tie";
    }

    if (
        (choice1 === "rock" && choice2 === "scissors") ||
        (choice1 === "paper" && choice2 === "rock") ||
        (choice1 === "scissors" && choice2 === "paper")
    ) {
        return "player1";
    }

    return "player2";
}

function addPoints(client, userId, amount) {
    // Owner has unlimited money/points.
    if (isOwner(userId)) {
        return;
    }

    // Supports the points system from gamebot.js if available.
    if (typeof client.addPoints === "function") {
        client.addPoints(userId, amount);
    }
}

function getBalance(client, userId) {
    if (isOwner(userId)) {
        return "∞";
    }

    if (typeof client.getPoints === "function") {
        return client.getPoints(userId).toLocaleString();
    }

    return "0";
}

function clearGame(gameKey) {
    const game = activeDuels.get(gameKey);

    if (!game) {
        return;
    }

    if (game.challengeTimer) {
        clearTimeout(game.challengeTimer);
    }

    if (game.roundTimer) {
        clearTimeout(game.roundTimer);
    }

    activeDuels.delete(gameKey);
}

// ============================================================
// CHALLENGE BUTTONS
// ============================================================

function challengeButtons(gameId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`rpsaccept:${gameId}`)
            .setLabel("Accept")
            .setEmoji("✅")
            .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
            .setCustomId(`rpsdecline:${gameId}`)
            .setLabel("Decline")
            .setEmoji("❌")
            .setStyle(ButtonStyle.Danger)
    );
}

// ============================================================
// RPS BUTTONS
// ============================================================

function rpsButtons(gameId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`rpschoice:${gameId}:rock`)
            .setLabel("Rock")
            .setEmoji("🪨")
            .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
            .setCustomId(`rpschoice:${gameId}:paper`)
            .setLabel("Paper")
            .setEmoji("📄")
            .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
            .setCustomId(`rpschoice:${gameId}:scissors`)
            .setLabel("Scissors")
            .setEmoji("✂️")
            .setStyle(ButtonStyle.Primary)
    );
}

// ============================================================
// START RPS
// ============================================================

async function startRPS(interaction, client) {
    if (!interaction.guild) {
        return interaction.reply({
            content: "❌ This game can only be played inside a server.",
            ephemeral: true
        });
    }

    const opponent = interaction.options.getUser("opponent");

    if (!opponent) {
        return interaction.reply({
            content: "❌ You need to choose an opponent.",
            ephemeral: true
        });
    }

    if (opponent.bot) {
        return interaction.reply({
            content: "❌ You cannot challenge a bot.",
            ephemeral: true
        });
    }

    if (opponent.id === interaction.user.id) {
        return interaction.reply({
            content: "❌ You cannot challenge yourself.",
            ephemeral: true
        });
    }

    const key = getGameKey(
        interaction.guildId,
        interaction.channelId
    );

    if (activeDuels.has(key)) {
        return interaction.reply({
            content:
                "❌ There is already a Duel running in this channel.",
            ephemeral: true
        });
    }

    // Unique ID with NO underscores.
    const gameId =
        `${Date.now()}${Math.random().toString(36).slice(2, 8)}`;

    const game = {
        id: gameId,
        key,

        player1: interaction.user.id,
        player2: opponent.id,

        player1Choice: null,
        player2Choice: null,

        accepted: false,

        message: null,

        challengeTimer: null,
        roundTimer: null
    };

    activeDuels.set(key, game);

    const embed = new EmbedBuilder()
        .setTitle("⚔️ ROCK PAPER SCISSORS")
        .setDescription(
            `**${interaction.user}** challenged **${opponent}**!\n\n` +
            `🎮 **${interaction.user.username}** vs **${opponent.username}**\n\n` +
            `Only ${opponent} can accept this challenge.\n\n` +
            `⏱️ Challenge expires in **30 seconds**.`
        )
        .setFooter({
            text: "1v1 Duel"
        });

    const message = await interaction.reply({
        embeds: [embed],
        components: [
            challengeButtons(gameId)
        ],
        fetchReply: true
    });

    game.message = message;

    // --------------------------------------------------------
    // Challenge timeout
    // --------------------------------------------------------

    game.challengeTimer = setTimeout(async () => {
        if (!activeDuels.has(key)) {
            return;
        }

        clearGame(key);

        const expiredEmbed = new EmbedBuilder()
            .setTitle("⚔️ ROCK PAPER SCISSORS")
            .setDescription(
                `⌛ The challenge from **${interaction.user.username}** expired.\n\n` +
                `${opponent} did not accept in time.`
            );

        await message.edit({
            embeds: [expiredEmbed],
            components: []
        }).catch(() => {});
    }, CHALLENGE_TIMEOUT);
}

// ============================================================
// ACCEPT RPS
// ============================================================

async function acceptRPS(interaction, game) {
    if (interaction.user.id !== game.player2) {
        return interaction.reply({
            content:
                "❌ Only the challenged player can accept this game.",
            ephemeral: true
        });
    }

    if (game.challengeTimer) {
        clearTimeout(game.challengeTimer);
        game.challengeTimer = null;
    }

    game.accepted = true;

    const embed = new EmbedBuilder()
        .setTitle("⚔️ ROCK PAPER SCISSORS")
        .setDescription(
            `**<@${game.player1}>** vs **<@${game.player2}>**\n\n` +
            `Choose your move below.\n\n` +
            `🔒 Your choice will remain hidden from your opponent.\n\n` +
            `⏱️ You have **45 seconds**.`
        )
        .setFooter({
            text: "Choose your weapon."
        });

    await interaction.update({
        embeds: [embed],
        components: [
            rpsButtons(game.id)
        ]
    });

    game.roundTimer = setTimeout(async () => {
        if (!activeDuels.has(game.key)) {
            return;
        }

        clearGame(game.key);

        const timeoutEmbed = new EmbedBuilder()
            .setTitle("⚔️ ROCK PAPER SCISSORS")
            .setDescription(
                "⌛ **Round expired.**\n\n" +
                "One or both players did not choose in time."
            );

        await game.message.edit({
            embeds: [timeoutEmbed],
            components: []
        }).catch(() => {});
    }, ROUND_TIMEOUT);
}

// ============================================================
// DECLINE RPS
// ============================================================

async function declineRPS(interaction, game) {
    if (interaction.user.id !== game.player2) {
        return interaction.reply({
            content:
                "❌ Only the challenged player can decline this game.",
            ephemeral: true
        });
    }

    clearGame(game.key);

    const embed = new EmbedBuilder()
        .setTitle("⚔️ ROCK PAPER SCISSORS")
        .setDescription(
            `❌ **${interaction.user.username}** declined the challenge.`
        );

    await interaction.update({
        embeds: [embed],
        components: []
    });
}

// ============================================================
// HANDLE PLAYER CHOICE
// ============================================================

async function handleChoice(
    interaction,
    client,
    game,
    choice
) {
    const userId = interaction.user.id;

    if (!game.accepted) {
        return interaction.reply({
            content: "❌ This game has not started yet.",
            ephemeral: true
        });
    }

    if (
        userId !== game.player1 &&
        userId !== game.player2
    ) {
        return interaction.reply({
            content:
                "❌ You are not a player in this Duel.",
            ephemeral: true
        });
    }

    // --------------------------------------------------------
    // Player 1
    // --------------------------------------------------------

    if (userId === game.player1) {
        if (game.player1Choice) {
            return interaction.reply({
                content:
                    "❌ You already chose your move.",
                ephemeral: true
            });
        }

        game.player1Choice = choice;
    }

    // --------------------------------------------------------
    // Player 2
    // --------------------------------------------------------

    if (userId === game.player2) {
        if (game.player2Choice) {
            return interaction.reply({
                content:
                    "❌ You already chose your move.",
                ephemeral: true
            });
        }

        game.player2Choice = choice;
    }

    await interaction.reply({
        content:
            `✅ Your choice is locked: **${getChoiceName(choice)}**`,
        ephemeral: true
    });

    // --------------------------------------------------------
    // Wait for second player
    // --------------------------------------------------------

    if (
        !game.player1Choice ||
        !game.player2Choice
    ) {
        return;
    }

    if (game.roundTimer) {
        clearTimeout(game.roundTimer);
        game.roundTimer = null;
    }

    const player1Choice = game.player1Choice;
    const player2Choice = game.player2Choice;

    const result = getWinner(
        player1Choice,
        player2Choice
    );

    // ========================================================
    // TIE
    // ========================================================

    if (result === "tie") {
        game.player1Choice = null;
        game.player2Choice = null;

        const tieEmbed = new EmbedBuilder()
            .setTitle("⚔️ ROCK PAPER SCISSORS")
            .setDescription(
                `🤝 **It's a tie!**\n\n` +
                `<@${game.player1}> chose **${getChoiceName(player1Choice)}**\n` +
                `<@${game.player2}> chose **${getChoiceName(player2Choice)}**\n\n` +
                `🔄 **Round restarted!**\n\n` +
                `Choose again.`
            );

        await game.message.edit({
            embeds: [tieEmbed],
            components: [
                rpsButtons(game.id)
            ]
        }).catch(() => {});

        game.roundTimer = setTimeout(async () => {
            if (!activeDuels.has(game.key)) {
                return;
            }

            clearGame(game.key);

            await game.message.edit({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("⚔️ ROCK PAPER SCISSORS")
                        .setDescription(
                            "⌛ **Round expired.**"
                        )
                ],
                components: []
            }).catch(() => {});
        }, ROUND_TIMEOUT);

        return;
    }

    // ========================================================
    // WINNER
    // ========================================================

    const winnerId =
        result === "player1"
            ? game.player1
            : game.player2;

    const loserId =
        result === "player1"
            ? game.player2
            : game.player1;

    const winner = await client.users
        .fetch(winnerId)
        .catch(() => null);

    const loser = await client.users
        .fetch(loserId)
        .catch(() => null);

    addPoints(
        client,
        winnerId,
        WIN_POINTS
    );

    const winnerChoice =
        result === "player1"
            ? player1Choice
            : player2Choice;

    const loserChoice =
        result === "player1"
            ? player2Choice
            : player1Choice;

    const balance =
        getBalance(client, winnerId);

    clearGame(game.key);

    const resultEmbed = new EmbedBuilder()
        .setTitle("🏆 ROCK PAPER SCISSORS")
        .setDescription(
            `## 🏆 ${winner || `<@${winnerId}>`} wins!\n\n` +

            `**${winner || `<@${winnerId}>`}**\n` +
            `${getChoiceName(winnerChoice)}\n\n` +

            `**${loser || `<@${loserId}>`}**\n` +
            `${getChoiceName(loserChoice)}\n\n` +

            `🪙 **+${WIN_POINTS} points**\n` +
            `💰 Balance: **${balance}**`
        )
        .setFooter({
            text: "Duel complete."
        });

    await game.message.edit({
        embeds: [resultEmbed],
        components: []
    }).catch(() => {});
}

// ============================================================
// REGISTER COMMAND
// ============================================================

module.exports = {
    register(client) {

        if (!client.commands) {
            client.commands = new Map();
        }

        client.commands.set("rps", {
            data: {
                name: "rps",
                description:
                    "Challenge another player to Rock Paper Scissors.",

                options: [
                    {
                        type: 6,
                        name: "opponent",
                        description:
                            "The player you want to challenge.",
                        required: true
                    }
                ]
            },

            async execute(interaction) {
                await startRPS(
                    interaction,
                    client
                );
            }
        });

        // ====================================================
        // BUTTON HANDLER
        // ====================================================

        client.on(
            "interactionCreate",
            async interaction => {

                if (!interaction.isButton()) {
                    return;
                }

                const id = interaction.customId;

                try {

                    // ============================================
                    // ACCEPT
                    // ============================================

                    if (id.startsWith("rpsaccept:")) {

                        const gameId =
                            id.slice("rpsaccept:".length);

                        const game =
                            [...activeDuels.values()]
                                .find(
                                    game =>
                                        game.id === gameId
                                );

                        if (!game) {
                            return interaction.reply({
                                content:
                                    "❌ This challenge has expired.",
                                ephemeral: true
                            });
                        }

                        await acceptRPS(
                            interaction,
                            game
                        );

                        return;
                    }

                    // ============================================
                    // DECLINE
                    // ============================================

                    if (id.startsWith("rpsdecline:")) {

                        const gameId =
                            id.slice("rpsdecline:".length);

                        const game =
                            [...activeDuels.values()]
                                .find(
                                    game =>
                                        game.id === gameId
                                );

                        if (!game) {
                            return interaction.reply({
                                content:
                                    "❌ This challenge has expired.",
                                ephemeral: true
                            });
                        }

                        await declineRPS(
                            interaction,
                            game
                        );

                        return;
                    }

                    // ============================================
                    // CHOICE
                    // ============================================

                    if (id.startsWith("rpschoice:")) {

                        const parts =
                            id.split(":");

                        if (parts.length !== 3) {
                            return;
                        }

                        const gameId = parts[1];
                        const choice = parts[2];

                        if (
                            ![
                                "rock",
                                "paper",
                                "scissors"
                            ].includes(choice)
                        ) {
                            return;
                        }

                        const game =
                            [...activeDuels.values()]
                                .find(
                                    game =>
                                        game.id === gameId
                                );

                        if (!game) {
                            return interaction.reply({
                                content:
                                    "❌ This game has expired.",
                                ephemeral: true
                            });
                        }

                        await handleChoice(
                            interaction,
                            client,
                            game,
                            choice
                        );

                        return;
                    }

                } catch (error) {

                    console.error(
                        "❌ Dual Games Error:",
                        error
                    );

                    if (
                        interaction.replied ||
                        interaction.deferred
                    ) {
                        await interaction.followUp({
                            content:
                                "❌ Something went wrong while processing the game.",
                            ephemeral: true
                        }).catch(() => {});
                    } else {
                        await interaction.reply({
                            content:
                                "❌ Something went wrong while processing the game.",
                            ephemeral: true
                        }).catch(() => {});
                    }
                }
            }
        );

        console.log(
            "✅ Dual Games loaded: RPS"
        );
    }
};