const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} = require("discord.js");

// ============================================================
// SINGLE PLAYER / OPEN GAMES
// ============================================================
//
// Games:
// /fast
// /mathrace
// /higherlower
// /unscramble
// /memory
// /guessnumber
// /reaction
// /trivia
//
// Anyone in the channel can answer.
// The person who starts the game does NOT get priority.
// ============================================================

const SINGLE_GAME_TIME = 30 * 1000;
const REACTION_TIMEOUT = 30 * 1000;

const games = new Map();

const WORDS = [
    "apple",
    "banana",
    "computer",
    "discord",
    "airplane",
    "football",
    "keyboard",
    "elephant",
    "mountain",
    "ocean",
    "chocolate",
    "pizza",
    "rocket",
    "internet",
    "galaxy",
    "thunder",
    "diamond",
    "rainbow",
    "fire",
    "dragon",
    "castle",
    "camera",
    "telephone",
    "universe",
    "sandwich",
    "hamburger",
    "school",
    "airport",
    "library",
    "restaurant",
    "hospital",
    "basketball",
    "baseball",
    "developer",
    "javascript",
    "programming",
    "controller",
    "headphones",
    "keyboard",
    "microphone",
    "television",
    "adventure",
    "mystery",
    "treasure",
    "pirate",
    "warrior",
    "princess",
    "monster",
    "volcano",
    "island"
];

const TRIVIA = [
    {
        question: "What is the capital of France?",
        answers: [
            "London",
            "Paris",
            "Berlin",
            "Madrid"
        ],
        correct: 1
    },
    {
        question: "Which planet is known as the Red Planet?",
        answers: [
            "Venus",
            "Mars",
            "Jupiter",
            "Mercury"
        ],
        correct: 1
    },
    {
        question: "How many continents are there?",
        answers: [
            "5",
            "6",
            "7",
            "8"
        ],
        correct: 2
    },
    {
        question: "What is the largest ocean on Earth?",
        answers: [
            "Atlantic Ocean",
            "Indian Ocean",
            "Arctic Ocean",
            "Pacific Ocean"
        ],
        correct: 3
    },
    {
        question: "Which language is primarily used to style web pages?",
        answers: [
            "HTML",
            "CSS",
            "Python",
            "SQL"
        ],
        correct: 1
    },
    {
        question: "Which animal is known as the King of the Jungle?",
        answers: [
            "Tiger",
            "Lion",
            "Elephant",
            "Wolf"
        ],
        correct: 1
    },
    {
        question: "What is 10 × 10?",
        answers: [
            "10",
            "50",
            "100",
            "1000"
        ],
        correct: 2
    },
    {
        question: "Which company created the PlayStation?",
        answers: [
            "Microsoft",
            "Nintendo",
            "Sony",
            "Sega"
        ],
        correct: 2
    },
    {
        question: "How many sides does a hexagon have?",
        answers: [
            "5",
            "6",
            "7",
            "8"
        ],
        correct: 1
    },
    {
        question: "Which planet is the largest in our Solar System?",
        answers: [
            "Earth",
            "Saturn",
            "Jupiter",
            "Neptune"
        ],
        correct: 2
    },
    {
        question: "What gas do humans need to breathe?",
        answers: [
            "Oxygen",
            "Carbon Dioxide",
            "Hydrogen",
            "Helium"
        ],
        correct: 0
    },
    {
        question: "What is the fastest land animal?",
        answers: [
            "Lion",
            "Cheetah",
            "Horse",
            "Tiger"
        ],
        correct: 1
    },
    {
        question: "Which country is famous for the pyramids of Giza?",
        answers: [
            "Greece",
            "Egypt",
            "Mexico",
            "Italy"
        ],
        correct: 1
    },
    {
        question: "How many players are on a football team on the field?",
        answers: [
            "9",
            "10",
            "11",
            "12"
        ],
        correct: 2
    },
    {
        question: "Which instrument has black and white keys?",
        answers: [
            "Guitar",
            "Piano",
            "Drum",
            "Violin"
        ],
        correct: 1
    }
];

// ============================================================
// HELPERS
// ============================================================

function randomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function shuffle(array) {
    const copy = [...array];

    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));

        [copy[i], copy[j]] = [copy[j], copy[i]];
    }

    return copy;
}

function shuffleWord(word) {
    if (word.length < 2) {
        return word;
    }

    let result = word;
    let attempts = 0;

    while (result === word && attempts < 20) {
        result = shuffle(word.split("")).join("");
        attempts++;
    }

    return result;
}

function normalizeText(text) {
    return String(text)
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
}

function cleanupGame(channelId) {
    const game = games.get(channelId);

    if (!game) {
        return;
    }

    if (game.timeout) {
        clearTimeout(game.timeout);
    }

    if (game.collector) {
        try {
            game.collector.stop("game_finished");
        } catch {}
    }

    if (game.messageCollector) {
        try {
            game.messageCollector.stop("game_finished");
        } catch {}
    }

    games.delete(channelId);
}

function isGameRunning(channelId) {
    return games.has(channelId);
}

function createGame(channelId, type) {
    const game = {
        type,
        channelId,
        startedAt: Date.now(),
        timeout: null,
        collector: null,
        messageCollector: null
    };

    games.set(channelId, game);

    return game;
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

    return amount;
}

function ownerText(client, userId) {
    if (typeof client.isOwner === "function" && client.isOwner(userId)) {
        return "∞";
    }

    return getPoints(client, userId).toLocaleString();
}

async function awardWinner(client, channel, user, amount) {
    addPoints(client, user.id, amount);

    const balance = ownerText(client, user.id);

    await channel.send(
        `🏆 **${user} wins!**\n` +
        `🪙 **+${amount} points**\n` +
        `💰 Balance: **${balance}**`
    );
}

function gameAlreadyRunning(interaction) {
    if (!isGameRunning(interaction.channelId)) {
        return false;
    }

    interaction.reply({
        content:
            "❌ There is already a Single Player game running in this channel.",
        ephemeral: true
    });

    return true;
}

function createTimeout(game, callback, time) {
    game.timeout = setTimeout(() => {
        if (!games.has(game.channelId)) {
            return;
        }

        callback();
    }, time);
}

// ============================================================
// FAST
// ============================================================

async function startFast(interaction, client) {
    if (gameAlreadyRunning(interaction)) {
        return;
    }

    const word = randomItem(WORDS).toUpperCase();

    const game = createGame(
        interaction.channelId,
        "fast"
    );

    await interaction.reply({
        embeds: [
            new EmbedBuilder()
                .setTitle("⚡ FAST")
                .setDescription(
                    `Type the following word as fast as you can:\n\n` +
                    `# \`${word}\`\n\n` +
                    `Anyone in this channel can answer!`
                )
                .setFooter({
                    text: "First correct answer wins."
                })
        ]
    });

    const collector =
        interaction.channel.createMessageCollector({
            time: SINGLE_GAME_TIME,
            filter: message => !message.author.bot
        });

    game.messageCollector = collector;

    collector.on("collect", async message => {
        if (
            normalizeText(message.content) ===
            normalizeText(word)
        ) {
            cleanupGame(interaction.channelId);

            await awardWinner(
                client,
                interaction.channel,
                message.author,
                10
            );
        }
    });

    collector.on("end", async (_, reason) => {
        if (reason === "game_finished") {
            return;
        }

        if (!games.has(interaction.channelId)) {
            return;
        }

        cleanupGame(interaction.channelId);

        await interaction.channel.send(
            `⏰ **Time's up!**\nThe word was **${word}**.`
        );
    });
}

// ============================================================
// MATH RACE
// ============================================================

function generateMathQuestion() {
    const operations = ["+", "-", "*"];

    const operation = randomItem(operations);

    let a;
    let b;
    let answer;

    if (operation === "+") {
        a = Math.floor(Math.random() * 50) + 1;
        b = Math.floor(Math.random() * 50) + 1;

        answer = a + b;
    }

    if (operation === "-") {
        a = Math.floor(Math.random() * 50) + 1;
        b = Math.floor(Math.random() * 50) + 1;

        if (b > a) {
            [a, b] = [b, a];
        }

        answer = a - b;
    }

    if (operation === "*") {
        a = Math.floor(Math.random() * 12) + 1;
        b = Math.floor(Math.random() * 12) + 1;

        answer = a * b;
    }

    return {
        text: `${a} ${operation} ${b}`,
        answer
    };
}

async function startMathRace(interaction, client) {
    if (gameAlreadyRunning(interaction)) {
        return;
    }

    const question = generateMathQuestion();

    const game = createGame(
        interaction.channelId,
        "mathrace"
    );

    await interaction.reply({
        embeds: [
            new EmbedBuilder()
                .setTitle("🧮 MATH RACE")
                .setDescription(
                    `# \`${question.text} = ?\`\n\n` +
                    `First person to send the correct answer wins!`
                )
        ]
    });

    const collector =
        interaction.channel.createMessageCollector({
            time: SINGLE_GAME_TIME,
            filter: message => !message.author.bot
        });

    game.messageCollector = collector;

    collector.on("collect", async message => {
        const answer = Number(
            message.content.trim()
        );

        if (
            Number.isFinite(answer) &&
            answer === question.answer
        ) {
            cleanupGame(interaction.channelId);

            await awardWinner(
                client,
                interaction.channel,
                message.author,
                10
            );
        }
    });

    collector.on("end", async (_, reason) => {
        if (reason === "game_finished") {
            return;
        }

        if (!games.has(interaction.channelId)) {
            return;
        }

        cleanupGame(interaction.channelId);

        await interaction.channel.send(
            `⏰ **Time's up!**\n` +
            `The answer was **${question.answer}**.`
        );
    });
}

// ============================================================
// UNSCRAMBLE
// ============================================================

async function startUnscramble(interaction, client) {
    if (gameAlreadyRunning(interaction)) {
        return;
    }

    const original = randomItem(WORDS);
    const scrambled = shuffleWord(original);

    const game = createGame(
        interaction.channelId,
        "unscramble"
    );

    await interaction.reply({
        embeds: [
            new EmbedBuilder()
                .setTitle("🔀 UNSCRAMBLE")
                .setDescription(
                    `Unscramble this word:\n\n` +
                    `# \`${scrambled.toUpperCase()}\`\n\n` +
                    `First correct answer wins!`
                )
        ]
    });

    const collector =
        interaction.channel.createMessageCollector({
            time: SINGLE_GAME_TIME,
            filter: message => !message.author.bot
        });

    game.messageCollector = collector;

    collector.on("collect", async message => {
        if (
            normalizeText(message.content) ===
            normalizeText(original)
        ) {
            cleanupGame(interaction.channelId);

            await awardWinner(
                client,
                interaction.channel,
                message.author,
                10
            );
        }
    });

    collector.on("end", async (_, reason) => {
        if (reason === "game_finished") {
            return;
        }

        if (!games.has(interaction.channelId)) {
            return;
        }

        cleanupGame(interaction.channelId);

        await interaction.channel.send(
            `⏰ **Time's up!**\n` +
            `The word was **${original.toUpperCase()}**.`
        );
    });
}

// ============================================================
// MEMORY
// ============================================================

async function startMemory(interaction, client) {
    if (gameAlreadyRunning(interaction)) {
        return;
    }

    const items = [
        "🍎",
        "🐶",
        "🚗",
        "⭐",
        "🍕",
        "🎮",
        "🔥",
        "🌙"
    ];

    const sequence = shuffle(items).slice(
        0,
        Math.floor(Math.random() * 2) + 5
    );

    const game = createGame(
        interaction.channelId,
        "memory"
    );

    await interaction.reply({
        embeds: [
            new EmbedBuilder()
                .setTitle("🧠 MEMORY")
                .setDescription(
                    `Memorize this sequence:\n\n` +
                    `# ${sequence.join(" ")}\n\n` +
                    `You have **5 seconds**...`
                )
        ]
    });

    setTimeout(async () => {
        if (!games.has(interaction.channelId)) {
            return;
        }

        await interaction.channel.send(
            "👀 **The sequence is hidden!**\n" +
            "Type the emojis in the exact same order."
        );

        const collector =
            interaction.channel.createMessageCollector({
                time: SINGLE_GAME_TIME,
                filter: message => !message.author.bot
            });

        game.messageCollector = collector;

        collector.on("collect", async message => {
            const answer = message.content
                .trim()
                .replace(/\s+/g, " ");

            const correct = sequence.join(" ");

            if (answer === correct) {
                cleanupGame(interaction.channelId);

                await awardWinner(
                    client,
                    interaction.channel,
                    message.author,
                    15
                );
            }
        });

        collector.on("end", async (_, reason) => {
            if (reason === "game_finished") {
                return;
            }

            if (!games.has(interaction.channelId)) {
                return;
            }

            cleanupGame(interaction.channelId);

            await interaction.channel.send(
                `⏰ **Time's up!**\n` +
                `The sequence was:\n${sequence.join(" ")}`
            );
        });
    }, 5000);
}

// ============================================================
// GUESS THE NUMBER
// ============================================================

async function startGuessNumber(interaction, client) {
    if (gameAlreadyRunning(interaction)) {
        return;
    }

    const number =
        Math.floor(Math.random() * 100) + 1;

    const game = createGame(
        interaction.channelId,
        "guessnumber"
    );

    await interaction.reply({
        embeds: [
            new EmbedBuilder()
                .setTitle("🔢 GUESS THE NUMBER")
                .setDescription(
                    `I'm thinking of a number between **1 and 100**.\n\n` +
                    `Anyone can guess!\n` +
                    `You have **30 seconds**.`
                )
        ]
    });

    const collector =
        interaction.channel.createMessageCollector({
            time: SINGLE_GAME_TIME,
            filter: message => !message.author.bot
        });

    game.messageCollector = collector;

    collector.on("collect", async message => {
        const guess = Number(
            message.content.trim()
        );

        if (
            !Number.isInteger(guess) ||
            guess < 1 ||
            guess > 100
        ) {
            return;
        }

        if (guess === number) {
            cleanupGame(interaction.channelId);

            await awardWinner(
                client,
                interaction.channel,
                message.author,
                15
            );

            return;
        }

        if (guess < number) {
            await message.reply({
                content: "📈 **Too low!**",
                allowedMentions: {
                    repliedUser: false
                }
            });
        } else {
            await message.reply({
                content: "📉 **Too high!**",
                allowedMentions: {
                    repliedUser: false
                }
            });
        }
    });

    collector.on("end", async (_, reason) => {
        if (reason === "game_finished") {
            return;
        }

        if (!games.has(interaction.channelId)) {
            return;
        }

        cleanupGame(interaction.channelId);

        await interaction.channel.send(
            `⏰ **Time's up!**\nThe number was **${number}**.`
        );
    });
}

// ============================================================
// REACTION
// ============================================================

async function startReaction(interaction, client) {
    if (gameAlreadyRunning(interaction)) {
        return;
    }

    const game = createGame(
        interaction.channelId,
        "reaction"
    );

    await interaction.reply({
        embeds: [
            new EmbedBuilder()
                .setTitle("🎯 REACTION")
                .setDescription(
                    "Get ready...\n\n" +
                    "# 🔴\n\n" +
                    "Wait for the green button!"
                )
        ]
    });

    const delay =
        Math.floor(Math.random() * 5000) + 2000;

    const startTime = Date.now();

    game.timeout = setTimeout(async () => {
        if (!games.has(interaction.channelId)) {
            return;
        }

        const button = new ButtonBuilder()
            .setCustomId(
                `reaction_${interaction.channelId}_${Date.now()}`
            )
            .setLabel("🟢 GO!")
            .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder()
            .addComponents(button);

        await interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setTitle("🎯 REACTION")
                    .setDescription(
                        "# 🟢 GO!\n\n" +
                        "**CLICK THE BUTTON!**"
                    )
            ],
            components: [row]
        });

        game.reactionStart = Date.now();

        const collector =
            interaction.message?.createMessageComponentCollector;

        const buttonCollector =
            interaction.channel.createMessageComponentCollector({
                time: REACTION_TIMEOUT,
                filter: component =>
                    component.customId === button.data.custom_id &&
                    !component.user.bot
            });

        game.collector = buttonCollector;

        buttonCollector.on(
            "collect",
            async component => {
                if (!games.has(interaction.channelId)) {
                    return;
                }

                const reactionTime =
                    Date.now() - game.reactionStart;

                cleanupGame(interaction.channelId);

                await component.deferUpdate();

                await interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle("🎯 REACTION")
                            .setDescription(
                                `🏆 **${component.user} wins!**\n\n` +
                                `⚡ Reaction time: **${reactionTime}ms**`
                            )
                    ],
                    components: []
                });

                addPoints(
                    client,
                    component.user.id,
                    10
                );
            }
        );

        buttonCollector.on("end", async (_, reason) => {
            if (reason === "game_finished") {
                return;
            }

            if (!games.has(interaction.channelId)) {
                return;
            }

            cleanupGame(interaction.channelId);

            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("🎯 REACTION")
                        .setDescription(
                            "⏰ Nobody reacted in time!"
                        )
                ],
                components: []
            });
        });
    }, delay);

    // Prevent unused variable warning in some environments.
    void startTime;
}

// ============================================================
// HIGHER OR LOWER
// ============================================================

function cardName(value, suit) {
    const values = {
        1: "A",
        2: "2",
        3: "3",
        4: "4",
        5: "5",
        6: "6",
        7: "7",
        8: "8",
        9: "9",
        10: "10",
        11: "J",
        12: "Q",
        13: "K"
    };

    return `${values[value]}${suit}`;
}

function createRandomCard() {
    const suits = ["♠️", "♥️", "♦️", "♣️"];

    const value =
        Math.floor(Math.random() * 13) + 1;

    const suit = randomItem(suits);

    return {
        value,
        suit,
        display: cardName(value, suit)
    };
}

async function startHigherLower(interaction, client) {
    if (gameAlreadyRunning(interaction)) {
        return;
    }

    const firstCard = createRandomCard();

    const game = createGame(
        interaction.channelId,
        "higherlower"
    );

    const higherButton = new ButtonBuilder()
        .setCustomId(
            `higher_${interaction.channelId}_${Date.now()}`
        )
        .setLabel("Higher")
        .setEmoji("⬆️")
        .setStyle(ButtonStyle.Primary);

    const lowerButton = new ButtonBuilder()
        .setCustomId(
            `lower_${interaction.channelId}_${Date.now()}`
        )
        .setLabel("Lower")
        .setEmoji("⬇️")
        .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder()
        .addComponents(
            higherButton,
            lowerButton
        );

    await interaction.reply({
        embeds: [
            new EmbedBuilder()
                .setTitle("🃏 HIGHER OR LOWER")
                .setDescription(
                    `Current card:\n\n` +
                    `# ${firstCard.display}\n\n` +
                    `Will the next card be **higher** or **lower**?\n\n` +
                    `Anyone can play.`
                )
        ],
        components: [row]
    });

    game.currentCard = firstCard;

    const collector =
        interaction.channel.createMessageComponentCollector({
            time: SINGLE_GAME_TIME,
            filter: component =>
                component.customId === higherButton.data.custom_id ||
                component.customId === lowerButton.data.custom_id
        });

    game.collector = collector;

    collector.on("collect", async component => {
        if (!games.has(interaction.channelId)) {
            return;
        }

        const nextCard = createRandomCard();

        const choice =
            component.customId.startsWith("higher")
                ? "higher"
                : "lower";

        let correct = false;

        if (
            choice === "higher" &&
            nextCard.value > game.currentCard.value
        ) {
            correct = true;
        }

        if (
            choice === "lower" &&
            nextCard.value < game.currentCard.value
        ) {
            correct = true;
        }

        if (
            nextCard.value === game.currentCard.value
        ) {
            correct = true;
        }

        if (!correct) {
            cleanupGame(interaction.channelId);

            await component.update({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("🃏 HIGHER OR LOWER")
                        .setDescription(
                            `❌ **${component.user} guessed incorrectly.**\n\n` +
                            `Previous card: **${game.currentCard.display}**\n` +
                            `Next card: **${nextCard.display}**`
                        )
                ],
                components: []
            });

            return;
        }

        game.currentCard = nextCard;

        await component.update({
            embeds: [
                new EmbedBuilder()
                    .setTitle("🃏 HIGHER OR LOWER")
                    .setDescription(
                        `🎯 **${component.user} guessed correctly!**\n\n` +
                        `New card:\n\n` +
                        `# ${nextCard.display}\n\n` +
                        `Higher or Lower?`
                    )
            ],
            components: [row]
        });

        // Keep the same game alive.
        // Correct answer = +5 points.
        addPoints(
            client,
            component.user.id,
            5
        );
    });

    collector.on("end", async (_, reason) => {
        if (reason === "game_finished") {
            return;
        }

        if (!games.has(interaction.channelId)) {
            return;
        }

        cleanupGame(interaction.channelId);

        await interaction.editReply({
            content: "⏰ Game over.",
            components: []
        });
    });
}

// ============================================================
// TRIVIA
// ============================================================

function createTriviaButtons(question) {
    const row = new ActionRowBuilder();

    question.answers.forEach((answer, index) => {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(
                    `trivia_${index}_${Date.now()}`
                )
                .setLabel(answer)
                .setStyle(ButtonStyle.Primary)
        );
    });

    return row;
}

async function startTrivia(interaction, client) {
    if (gameAlreadyRunning(interaction)) {
        return;
    }

    const question = randomItem(TRIVIA);

    const game = createGame(
        interaction.channelId,
        "trivia"
    );

    const row = createTriviaButtons(question);

    await interaction.reply({
        embeds: [
            new EmbedBuilder()
                .setTitle("🧠 TRIVIA")
                .setDescription(
                    `# ${question.question}\n\n` +
                    `Choose the correct answer!`
                )
        ],
        components: [row]
    });

    const collector =
        interaction.channel.createMessageComponentCollector({
            time: SINGLE_GAME_TIME,
            filter: component =>
                component.customId.startsWith("trivia_")
        });

    game.collector = collector;

    collector.on("collect", async component => {
        if (!games.has(interaction.channelId)) {
            return;
        }

        const parts =
            component.customId.split("_");

        const selectedIndex =
            Number(parts[1]);

        if (selectedIndex === question.correct) {
            cleanupGame(interaction.channelId);

            await component.update({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("🧠 TRIVIA")
                        .setDescription(
                            `🏆 **${component.user} got it right!**\n\n` +
                            `Correct answer: **${question.answers[question.correct]}**`
                        )
                ],
                components: []
            });

            addPoints(
                client,
                component.user.id,
                10
            );

            return;
        }

        cleanupGame(interaction.channelId);

        await component.update({
            embeds: [
                new EmbedBuilder()
                    .setTitle("🧠 TRIVIA")
                    .setDescription(
                        `❌ **${component.user} got it wrong!**\n\n` +
                        `Correct answer: **${question.answers[question.correct]}**`
                    )
            ],
            components: []
        });
    });

    collector.on("end", async (_, reason) => {
        if (reason === "game_finished") {
            return;
        }

        if (!games.has(interaction.channelId)) {
            return;
        }

        cleanupGame(interaction.channelId);

        await interaction.editReply({
            content: "⏰ Time's up!",
            components: []
        });
    });
}

// ============================================================
// REGISTER COMMANDS
// ============================================================

module.exports = {
    register(client) {

        // ----------------------------------------------------
        // /fast
        // ----------------------------------------------------

        client.commands.set("fast", {
            data: {
                name: "fast",
                description: "Be the fastest person to type the word."
            },

            async execute(interaction) {
                await startFast(interaction, client);
            }
        });

        // ----------------------------------------------------
        // /mathrace
        // ----------------------------------------------------

        client.commands.set("mathrace", {
            data: {
                name: "mathrace",
                description: "Solve a math problem as fast as possible."
            },

            async execute(interaction) {
                await startMathRace(interaction, client);
            }
        });

        // ----------------------------------------------------
        // /higherlower
        // ----------------------------------------------------

        client.commands.set("higherlower", {
            data: {
                name: "higherlower",
                description: "Guess whether the next card is higher or lower."
            },

            async execute(interaction) {
                await startHigherLower(
                    interaction,
                    client
                );
            }
        });

        // ----------------------------------------------------
        // /unscramble
        // ----------------------------------------------------

        client.commands.set("unscramble", {
            data: {
                name: "unscramble",
                description: "Unscramble the word before anyone else."
            },

            async execute(interaction) {
                await startUnscramble(
                    interaction,
                    client
                );
            }
        });

        // ----------------------------------------------------
        // /memory
        // ----------------------------------------------------

        client.commands.set("memory", {
            data: {
                name: "memory",
                description: "Memorize and repeat the sequence."
            },

            async execute(interaction) {
                await startMemory(
                    interaction,
                    client
                );
            }
        });

        // ----------------------------------------------------
        // /guessnumber
        // ----------------------------------------------------

        client.commands.set("guessnumber", {
            data: {
                name: "guessnumber",
                description: "Guess the hidden number between 1 and 100."
            },

            async execute(interaction) {
                await startGuessNumber(
                    interaction,
                    client
                );
            }
        });

        // ----------------------------------------------------
        // /reaction
        // ----------------------------------------------------

        client.commands.set("reaction", {
            data: {
                name: "reaction",
                description: "Be the fastest person to react."
            },

            async execute(interaction) {
                await startReaction(
                    interaction,
                    client
                );
            }
        });

        // ----------------------------------------------------
        // /trivia
        // ----------------------------------------------------

        client.commands.set("trivia", {
            data: {
                name: "trivia",
                description: "Answer a trivia question."
            },

            async execute(interaction) {
                await startTrivia(
                    interaction,
                    client
                );
            }
        });

        console.log("✅ Single Player games registered.");
    }
};