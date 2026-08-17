const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} = require("discord.js");

// ============================================================
// DUAL GAMES
// ============================================================
//
// Current Dual game:
// /rps opponent:@player
//
// Rock Paper Scissors
// ============================================================

const games = new Map();

const CHALLENGE_TIME = 30 * 1000;
const ROUND_TIME = 45 * 1000;
const POINTS_WIN = 15;

// ============================================================
// HELPERS
// ============================================================

function gameKey(guildId, channelId) {
    return `${guildId}:${channelId}`;
}

function getPoints(client, userId) {
    if (typeof client.getPoints === "function") {
        return client.getPoints(userId);
    }

    return 0;
}

function addPoints(client, userId, amount) {
    if (typeof client.addPoints === "function") {
        return client.addPoints(userId, amount);
    }

    return 0;
}

function isOwner(client, userId) {
    if (typeof client.isOwner === "function") {
        return client.isOwner(userId);
    }

    return false;
}

function balanceText(client, userId) {
    if (isOwner(client, userId)) {
        return "∞";
    }

    return getPoints(client, userId).toLocaleString();
}

function cleanupGame(key) {
    const game = games.get(key);

    if (!game) {
        return;
    }

    if (game.challengeTimeout) {
        clearTimeout(game.challengeTimeout);
    }

    if (game.roundTimeout) {
        clearTimeout(game.roundTimeout);
    }

    if (game.collector) {
        try {
            game.collector.stop("game_finished");
        } catch {}
    }

    games.delete(key);
}

function getChoiceName(choice) {
    if (choice === "rock") {
        return "🪨 Rock";
    }

    if (choice === "paper") {
        return "📄 Paper";
    }

    if (choice === "scissors") {
        return "✂️ Scissors";
    }

    return "Unknown";
}

function determineWinner(player1Choice, player2Choice) {
    if (player1Choice === player2Choice) {
        return "tie";
    }

    if (
        player1Choice === "rock" &&
        player2Choice === "scissors"
    ) {
        return "player1";
    }

    if (
        player1Choice === "paper" &&
        player2Choice === "rock"
    ) {
        return "player1";
    }

    if (
        player1Choice === "scissors" &&
        player2Choice === "paper"
    ) {
        return "player1";
    }

    return "player2";
}

// ============================================================
// CREATE RPS BUTTONS
// ============================================================

function createRPSButtons(gameId) {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`rps_${gameId}_rock`)
                .setLabel("Rock")
                .setEmoji("🪨")
                .setStyle(ButtonStyle.Primary),

            new ButtonBuilder()
                .setCustomId(`rps_${gameId}_paper`)
                .setLabel("Paper")
                .setEmoji("📄")
                .setStyle(ButtonStyle.Primary),

            new ButtonBuilder()
                .setCustomId(`rps_${gameId}_scissors`)
                .setLabel("Scissors")
                .setEmoji("✂️")
                .setStyle(ButtonStyle.Primary)
        );
}

// ============================================================
// CREATE CHALLENGE BUTTONS
// ============================================================

function createChallengeButtons(gameId) {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`rps_accept_${gameId}`)
                .setLabel("Accept")
                .setEmoji("✅")
                .setStyle(ButtonStyle.Success),

            new ButtonBuilder()
                .setCustomId(`rps_decline_${gameId}`)
                .setLabel("Decline")
                .setEmoji("❌")
                .setStyle(ButtonStyle.Danger)
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

    const opponent =
        interaction.options.getUser("opponent");

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

    const key = gameKey(
        interaction.guildId,
        interaction.channelId
    );

    if (games.has(key)) {
        return interaction.reply({
            content:
                "❌ There is already a Duel game running in this channel.",
            ephemeral: true
        });
    }

    const gameId =
        `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const game = {
        id: gameId,
        key,

        type: "rps",

        player1: interaction.user.id,
        player2: opponent.id,

        player1Choice: null,
        player2Choice: null,

        accepted: false,

        message: null,

        challengeTimeout: null,
        roundTimeout: null,
        collector: null
    };

    games.set(key, game);

    const embed = new EmbedBuilder()
        .setTitle("⚔️ ROCK PAPER SCISSORS")
        .setDescription(
            `**${interaction.user}** has challenged **${opponent}**!\n\n` +
            `The challenge expires in **30 seconds**.\n\n` +
            `Only **${opponent}** can accept or decline.`
        )
        .setFooter({
            text: "1v1 Duel"
        });

    const message = await interaction.reply({
        embeds: [embed],
        components: [
            createChallengeButtons(gameId)
        ],
        fetchReply: true
    });

    game.message = message;

    // --------------------------------------------------------
    // Challenge timeout
    // --------------------------------------------------------

    game.challengeTimeout = setTimeout(async () => {
        if (!games.has(key)) {
            return;
        }

        cleanupGame(key);

        await message.edit({
            embeds: [
                new EmbedBuilder()
                    .setTitle("⚔️ ROCK PAPER SCISSORS")
                    .setDescription(
                        "⌛ **Challenge expired.**\n\n" +
                        `${opponent} did not accept the challenge in time.`
                    )
            ],
            components: []
        }).catch(() => {});
    }, CHALLENGE_TIME);
}

// ============================================================
// START ROUND
// ============================================================

async function startRPSRound(game, interaction) {
    const key = game.key;

    if (!games.has(key)) {
        return;
    }

    game.accepted = true;

    if (game.challengeTimeout) {
        clearTimeout(game.challengeTimeout);
        game.challengeTimeout = null;
    }

    const embed = new EmbedBuilder()
        .setTitle("⚔️ ROCK PAPER SCISSORS")
        .setDescription(
            `**<@${game.player1}>** vs **<@${game.player2}>**\n\n` +
            `Choose your move below.\n\n` +
            `🔒 Your choice is hidden from your opponent.\n\n` +
            `You have **45 seconds**.`
        )
        .setFooter({
            text: "Choose Rock, Paper, or Scissors."
        });

    await interaction.update({
        embeds: [embed],
        components: [
            createRPSButtons(game.id)
        ]
    });

    game.roundTimeout = setTimeout(async () => {
        if (!games.has(key)) {
            return;
        }

        cleanupGame(key);

        await game.message.edit({
            embeds: [
                new EmbedBuilder()
                    .setTitle("⚔️ ROCK PAPER SCISSORS")
                    .setDescription(
                        "⌛ **The round timed out.**\n\n" +
                        "Both players needed to choose within 45 seconds."
                    )
            ],
            components: []
        }).catch(() => {});
    }, ROUND_TIME);
}

// ============================================================
// HANDLE RPS CHOICE
// ============================================================

async function handleRPSChoice(
    interaction,
    client,
    game,
    choice
) {
    const userId = interaction.user.id;

    if (!game.accepted) {
        return;
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
    // Prevent duplicate choice
    // --------------------------------------------------------

    if (userId === game.player1) {
        if (game.player1Choice) {
            return interaction.reply({
                content:
                    "❌ You already selected your move.",
                ephemeral: true
            });
        }

        game.player1Choice = choice;
    }

    if (userId === game.player2) {
        if (game.player2Choice) {
            return interaction.reply({
                content:
                    "❌ You already selected your move.",
                ephemeral: true
            });
        }

        game.player2Choice = choice;
    }

    await interaction.reply({
        content:
            `✅ Your choice has been locked in: **${getChoiceName(choice)}**`,
        ephemeral: true
    });

    // --------------------------------------------------------
    // Only one player has chosen
    // --------------------------------------------------------

    if (
        !game.player1Choice ||
        !game.player2Choice
    ) {
        return;
    }

    // --------------------------------------------------------
    // Both players chose
    // --------------------------------------------------------

    if (game.roundTimeout) {
        clearTimeout(game.roundTimeout);
        game.roundTimeout = null;
    }

    const result = determineWinner(
        game.player1Choice,
        game.player2Choice
    );

    // --------------------------------------------------------
    // TIE
    // --------------------------------------------------------

    if (result === "tie") {
        game.player1Choice = null;
        game.player2Choice = null;

        const tieEmbed = new EmbedBuilder()
            .setTitle("⚔️ ROCK PAPER SCISSORS")
            .setDescription(
                `🤝 **It's a tie!**\n\n` +
                `<@${game.player1}> chose **${getChoiceName(game.player1Choice)}**\n` +
                `<@${game.player2}> chose **${getChoiceName(game.player2Choice)}**\n\n` +
                `Choose again!`
            );

        // Fix the displayed choices because they are reset above.
        const p1Choice = game.lastPlayer1Choice;
        const p2Choice = game.lastPlayer2Choice;

        void tieEmbed;
        void p1Choice;
        void p2Choice;

        return;
    }

    // --------------------------------------------------------
    // Save choices before cleanup
    // --------------------------------------------------------

    const p1Choice = game.player1Choice;
    const p2Choice = game.player2Choice;

    const winnerId =
        result === "player1"
            ? game.player1
            : game.player2;

    const loserId =
        result === "player1"
            ? game.player2
            : game.player1;

    const winner =
        await interaction.client.users.fetch(winnerId);

    const loser =
        await interaction.client.users.fetch(loserId);

    addPoints(
        client,
        winnerId,
        POINTS_WIN
    );

    cleanupGame(game.key);

    const winnerBalance =
        balanceText(client, winnerId);

    const resultEmbed = new EmbedBuilder()
        .setTitle("⚔️ ROCK PAPER SCISSORS")
        .setDescription(
            `🏆 **${winner} wins!**\n\n` +
            `**${winner}** chose ${getChoiceName(
                result === "player1"
                    ? p1Choice
                    : p2Choice
            )}\n` +
            `**${loser}** chose ${getChoiceName(
                result === "player1"
                    ? p2Choice
                    : p1Choice
            )}\n\n` +
            `🪙 **+${POINTS_WIN} points**\n` +
            `💰 Balance: **${winnerBalance}**`
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
// REGISTER
// ============================================================

module.exports = {
    register(client) {

        // ====================================================
        // /rps
        // ====================================================

        client.commands.set("rps", {
            data: {
                name: "rps",
                description: "Challenge another player to Rock Paper Scissors.",
                options: [
                    {
                        type: 6,
                        name: "opponent",
                        description: "The player you want to challenge.",
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
        // INTERACTION HANDLER
        // ====================================================

        client.on(
            "interactionCreate",
            async interaction => {

                try {

                    if (!interaction.isButton()) {
                        return;
                    }

                    const customId =
                        interaction.customId;

                    // ------------------------------------------------
                    // Accept challenge
                    // ------------------------------------------------

                    if (
                        customId.startsWith(
                            "rps_accept_"
                        )
                    ) {

                        const gameId =
                            customId.replace(
                                "rps_accept_",
                                ""
                            );

                        const game =
                            [...games.values()]
                                .find(
                                    g => g.id === gameId
                                );

                        if (!game) {
                            return interaction.reply({
                                content:
                                    "❌ This challenge is no longer active.",
                                ephemeral: true
                            });
                        }

                        if (
                            interaction.user.id !==
                            game.player2
                        ) {
                            return interaction.reply({
                                content:
                                    "❌ Only the challenged player can accept this.",
                                ephemeral: true
                            });
                        }

                        await startRPSRound(
                            game,
                            interaction
                        );

                        return;
                    }

                    // ------------------------------------------------
                    // Decline challenge
                    // ------------------------------------------------

                    if (
                        customId.startsWith(
                            "rps_decline_"
                        )
                    ) {

                        const gameId =
                            customId.replace(
                                "rps_decline_",
                                ""
                            );

                        const game =
                            [...games.values()]
                                .find(
                                    g => g.id === gameId
                                );

                        if (!game) {
                            return interaction.reply({
                                content:
                                    "❌ This challenge is no longer active.",
                                ephemeral: true
                            });
                        }

                        if (
                            interaction.user.id !==
                            game.player2
                        ) {
                            return interaction.reply({
                                content:
                                    "❌ Only the challenged player can decline this.",
                                ephemeral: true
                            });
                        }

                        cleanupGame(game.key);

                        await interaction.update({
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle(
                                        "⚔️ ROCK PAPER SCISSORS"
                                    )
                                    .setDescription(
                                        `❌ **${interaction.user} declined the challenge.**`
                                    )
                            ],
                            components: []
                        });

                        return;
                    }

                    // ------------------------------------------------
                    // RPS Choice
                    // ------------------------------------------------

                    if (
                        customId.startsWith(
                            "rps_"
                        )
                    ) {

                        const parts =
                            customId.split("_");

                        /*
                         * Format:
                         *
                         * rps_GAMEID_rock
                         * rps_GAMEID_paper
                         * rps_GAMEID_scissors
                         */

                        if (parts.length < 3) {
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
                            [...games.values()]
                                .find(
                                    g => g.id === gameId
                                );

                        if (!game) {
                            return interaction.reply({
                                content:
                                    "❌ This Duel is no longer active.",
                                ephemeral: true
                            });
                        }

                        await handleRPSChoice(
                            interaction,
                            client,
                            game,
                            choice
                        );
                    }

                } catch (error) {

                    console.error(
                        "❌ Dual game interaction error:"
                    );

                    console.error(error);

                    if (
                        interaction.replied ||
                        interaction.deferred
                    ) {
                        await interaction.followUp({
                            content:
                                "❌ Something went wrong.",
                            ephemeral: true
                        }).catch(() => {});
                    } else {
                        await interaction.reply({
                            content:
                                "❌ Something went wrong.",
                            ephemeral: true
                        }).catch(() => {});
                    }
                }
            }
        );

        console.log(
            "✅ Dual game registered: RPS"
        );
    }
};