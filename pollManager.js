const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const Logger = require('./logger');
const { POLL_QUESTION, POLL_THUMBNAIL, ALLOWED_GUILD_IDS } = require('./config');
const SettingsManager = require('./settingsManager');

let pollStates = {};

class PollManager {
    constructor(client) {
        this.client = client;
    }

    createPollEmbed() {
        return new EmbedBuilder()
            .setColor(0x2B2D31)
            .setTitle('Собрание с кураторами')
            .setDescription('> **Нужно ли вам собрание с кураторами фракций на этой неделе?**')
            .setFooter({ text: 'Чтобы проголосовать, нажмите на кнопку ниже' })
            .setThumbnail(POLL_THUMBNAIL);
    }

    createPollButtons(disabled = false) {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('poll_yes').setLabel('Нужно').setStyle(ButtonStyle.Success).setDisabled(disabled),
            new ButtonBuilder().setCustomId('poll_no').setLabel('Нет, не нужно').setStyle(ButtonStyle.Danger).setDisabled(disabled)
        );
    }

    async checkLeaderExists(guildId) {
        const guild = this.client.guilds.cache.get(guildId);
        const config = SettingsManager.getConfig(guildId);
        if (!guild || !config?.leaderRoleId) return false;

        await guild.members.fetch().catch(err => Logger.error(`Не удалось загрузить участников ${guild.name}`, err));
        const hasLeader = guild.members.cache.some(member => member.roles.cache.has(config.leaderRoleId));

        if (!hasLeader) {
            Logger.info(`На сервере ${guild.name} отсутствует участник с ролью лидера (${config.leaderRoleId})`);
            return false;
        }

        Logger.info(`На сервере ${guild.name} есть участник с ролью лидера. Продолжаем.`);
        return true;
    }

    async startPoll(guildId, isManual = false, testDurationSeconds = null) {
        if (!ALLOWED_GUILD_IDS.includes(guildId)) {
            return { success: false, message: 'Опрос запрещён для этого сервера.' };
        }

        const config = SettingsManager.getConfig(guildId);
        if (!config) return { success: false, message: 'Сервер не настроен.' };
        if (!isManual && !config.enabled) return { success: false, message: 'Автоопрос отключен для этого сервера.' };

        const guild = this.client.guilds.cache.get(guildId);
        if (!guild) return { success: false, message: 'Сервер не найден.' };

        const channel = guild.channels.cache.get(config.channelId);
        if (!channel?.isTextBased()) return { success: false, message: 'Канал не найден или не является текстовым.' };

        const botMember = guild.members.me ?? await guild.members.fetchMe();
        const perms = channel.permissionsFor(botMember);
        if (!perms.has(PermissionsBitField.Flags.SendMessages) || !perms.has(PermissionsBitField.Flags.EmbedLinks)) {
            return { success: false, message: 'Недостаточно прав в канале.' };
        }

        const hasLeader = await this.checkLeaderExists(guildId);
        if (!hasLeader) return { success: false, message: 'Нет участника с ролью лидера на сервере.' };

        if (pollStates[guildId]) return { success: false, message: 'Опрос уже активен.' };

        const embed = this.createPollEmbed();
        const buttons = this.createPollButtons();
        const mention = config.voterRoleId ? `<@&${config.voterRoleId}>` : '';

        const message = await channel.send({ content: mention, embeds: [embed], components: [buttons] });
        pollStates[guildId] = {
            messageId: message.id,
            channelId: config.channelId,
            votes: { yes: new Set(), no: new Set() },
            ended: false
        };

        this.scheduleEndPoll(guildId, isManual, testDurationSeconds);
        Logger.poll(`Опрос запущен на сервере ${guild.name}`);
        return { success: true, message: 'Опрос запущен!', replyMessage: message };
    }

    scheduleEndPoll(guildId, isManual = false, testDurationSeconds = null, customEndCron = null) {
        let endTime;

        if (testDurationSeconds) {
            endTime = Date.now() + testDurationSeconds * 1000;
        } else if (isManual) {
            endTime = Date.now() + 1000 * 60 * 60 * 48; // 48 часов
        } else if (customEndCron) {
            try {
                const [min, hour, , , dayOfWeek] = customEndCron.split(' ').map(Number);
                const now = new Date();
                const moscowNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
                const target = new Date(moscowNow);
                let diff = (dayOfWeek - moscowNow.getDay() + 7) % 7;

                if (diff === 0 && (moscowNow.getHours() > hour || (moscowNow.getHours() === hour && moscowNow.getMinutes() >= min))) {
                    diff = 7;
                }

                target.setDate(moscowNow.getDate() + diff);
                target.setHours(hour, min, 0, 0);
                endTime = target.getTime();
            } catch (err) {
                Logger.error(`Ошибка при разборе customEndCron: ${customEndCron}`, err);
                endTime = PollManager.getNextTuesdayEnd().getTime();
            }
        } else {
            endTime = PollManager.getNextTuesdayEnd().getTime();
        }

        const timeUntilEnd = endTime - Date.now();

        Logger.info(`Опрос ${guildId} завершится через ${Math.round(timeUntilEnd / 1000)} секунд.`);

        setTimeout(() => {
            this.endPoll(guildId, false).catch(err =>
                Logger.error(`Ошибка при авто-завершении опроса ${guildId}:`, err)
            );
        }, timeUntilEnd);
    }


    createResultEmbed(needsMeeting, yes, no) {
        const description = needsMeeting
            ? '> По результатам голосования было приятно решение, что **собрания будет**'
            : '> По результатам голосования было приятно решение, что **собрания не будет**';

        const footer = `За: ${yes} | Против: ${no}`;

        return new EmbedBuilder()
            .setColor(0x2B2D31)
            .setTitle('Собрание с кураторами')
            .setDescription(description)
            .setThumbnail(POLL_THUMBNAIL)
            .setFooter({ text: footer });
    }

    static getNextTuesdayEnd() {
        const now = new Date();
        const moscowNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
        const nextTuesday = new Date(moscowNow);
        const currentDay = moscowNow.getDay();

        let daysUntilTuesday = (2 - currentDay + 7) % 7;
        if (daysUntilTuesday === 0 && (moscowNow.getHours() > 23 || (moscowNow.getHours() === 23 && moscowNow.getMinutes() >= 55))) {
            daysUntilTuesday = 7;
        }

        nextTuesday.setDate(moscowNow.getDate() + daysUntilTuesday);
        nextTuesday.setHours(23, 55, 0, 0);
        return nextTuesday;
    }

    async endPoll(guildId, isManual = false) {
        try {
            const pollState = pollStates[guildId];
            if (!pollState || pollState.ended) {
                Logger.info(`Опрос для ${guildId} уже завершён или отсутствует.`);
                return;
            }

            pollState.ended = true;

            const config = SettingsManager.getConfig(guildId);
            const guild = this.client.guilds.cache.get(guildId);
            const channel = guild?.channels.cache.get(pollState.channelId);

            if (!guild || !channel || !config) {
                Logger.warn(`Данные для завершения опроса на ${guildId} не найдены.`);
                delete pollStates[guildId];
                return;
            }

            const yes = pollState.votes.yes.size;
            const no = pollState.votes.no.size;
            const needsMeeting = yes > no;

            const resultText = needsMeeting
                ? '> По результатам голосования было принято решение, что **собрание будет**'
                : '> По результатам голосования было принято решение, что **собрания не будет**';

            const statsLine = `За: ${yes} | Против: ${no}`;

            const resultEmbed = new EmbedBuilder()
                .setColor('#2F3136')
                .setTitle('Собрание с кураторами')
                .setDescription(`${resultText}\n\n${statsLine}`)
                .setThumbnail(POLL_THUMBNAIL); 

            try {
                const originalMsg = await channel.messages.fetch(pollState.messageId).catch(() => null);

            if (originalMsg) {
                await originalMsg.edit({
                    embeds: [resultEmbed],
                    components: []
                });

                if (config.curatorRoleId) {
                    await originalMsg.reply({
                        content: `<@&${config.curatorRoleId}>`,
                        allowedMentions: { roles: [config.curatorRoleId] }
                    });
                }
            } else {
                const fallbackMsg = await channel.send({
                    content: `<@&${config.curatorRoleId}>`,
                    embeds: [resultEmbed],
                    allowedMentions: { roles: [config.curatorRoleId] }
                });
            }

                Logger.poll(`Опрос завершён на ${guild.name}: ${needsMeeting ? 'будет собрание' : 'не будет собрания'}`);
            } catch (error) {
                Logger.error(`Ошибка при публикации результатов опроса ${guildId}:`, error);
            }

            delete pollStates[guildId];
        } catch (err) {
            Logger.error(`Критическая ошибка завершения опроса ${guildId}:`, err);
            delete pollStates[guildId];
        }
    }

    async handleVote(interaction) {
        const { customId, guildId, user } = interaction;
        const poll = pollStates[guildId];
        if (!poll || poll.ended) return interaction.reply({ content: '⛔ Опрос завершён.', ephemeral: true });

        poll.votes.yes.delete(user.id);
        poll.votes.no.delete(user.id);

        let reply = '';
        if (customId === 'poll_yes') {
            poll.votes.yes.add(user.id);
            reply = '✅ Вы проголосовали: "Нужно собрание"';
        } else if (customId === 'poll_no') {
            poll.votes.no.add(user.id);
            reply = '❌ Вы проголосовали: "Не нужно собрание"';
        }

        await interaction.reply({ content: reply, ephemeral: true });
    }

    getPollStates() {
        return pollStates;
    }
}

module.exports = PollManager;
