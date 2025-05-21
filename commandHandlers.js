const Logger = require('../logger');
const SettingsManager = require('../settingsManager');
const { EmbedBuilder } = require('discord.js');
const cron = require('node-cron');
const scheduleManager = require('../scheduleManager');

module.exports = (pollManager, commandManager, client, scheduleManager) => ({
    async startpoll(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const result = await pollManager.startPoll(interaction.guildId, true);
        await interaction.editReply(result.message);
    },

    async testall(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const configs = SettingsManager.getAllConfigs();
        const guildIds = Object.keys(configs).filter(id => configs[id].enabled);
        const results = [];

        for (const guildId of guildIds) {
            const result = await pollManager.startPoll(guildId, true, 60);
            results.push(`• ${guildId}: ${result.success ? '🟢 Успех' : '🔴 ' + result.message}`);
            await new Promise(res => setTimeout(res, 1000))
        }

        await interaction.editReply(`🧪 Тестовый запуск завершён:\n` + results.join('\n'));
    },
    async setautotime(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const startInput = interaction.options.getString('start');
    const endInput = interaction.options.getString('end');

    const parseTime = (input) => {
        const days = {
        'понедельник': 1, 'вторник': 2, 'среда': 3, 'четверг': 4,
        'пятница': 5, 'суббота': 6, 'воскресенье': 0,
        'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4,
        'fri': 5, 'sat': 6, 'sun': 0
        };

        const [dayRaw, timeRaw] = input.trim().toLowerCase().split(/\s+/);
        const day = days[dayRaw];
        if (day === undefined || !/^\d{2}:\d{2}$/.test(timeRaw)) return null;

        const [hour, minute] = timeRaw.split(':').map(Number);
        return { minute, hour, day };
    };

    const start = parseTime(startInput);
    const end = parseTime(endInput);

    if (!start || !end) {
        await interaction.editReply('❌ Неверный формат. Пример: `/setautotime start:Понедельник 00:05 end:Пятница 23:55`');
        return;
    }

    // Обновим cron-выражение и пересоздадим задачу
    const startCron = `${start.minute} ${start.hour} * * ${start.day}`;
    const endCron = `${end.minute} ${end.hour} * * ${end.day}`;
    scheduleManager.setCustomSchedule(startCron, endCron);
    scheduleManager.setGlobalAutoTime(startCron, endCron); // сохраняем глобально


    await interaction.editReply(`✅ Автоопросы будут запускаться: **${startInput}**, завершаться: **${endInput}**`);
    },

    async setconfig(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const guildId = interaction.guildId;
        const guild = interaction.guild;
        const setting = interaction.options.getString('setting');
        const value = interaction.options.getString('value');

        const config = SettingsManager.getConfig(guildId);
        if (!config) {
            await interaction.editReply('❌ Этот сервер не настроен в системе бота.');
            return;
        }

        if (!/^[0-9]{17,20}$/.test(value)) {
            await interaction.editReply('⚠️ Неверный формат ID. Используй только числовой ID канала или роли.');
            return;
        }

        let updated = {};
        let name = '';
        try {
            if (setting === 'channel') {
                const channel = guild.channels.cache.get(value) || await guild.channels.fetch(value).catch(() => null);
                if (!channel || !channel.isTextBased()) {
                    await interaction.editReply('❌ Указанный канал не найден или не является текстовым.');
                    return;
                }
                updated.channelId = value;
                name = channel.name;
            } else {
                const role = guild.roles.cache.get(value) || await guild.roles.fetch(value).catch(() => null);
                if (!role) {
                    await interaction.editReply('❌ Роль не найдена на этом сервере.');
                    return;
                }
                if (setting === 'leader') updated.leaderRoleId = value;
                if (setting === 'voter') updated.voterRoleId = value;
                if (setting === 'curator') updated.curatorRoleId = value;
                name = role.name;
            }

            SettingsManager.updateConfig(guildId, updated);

            await interaction.editReply(`✅ Настройка \`${setting}\` обновлена: ${name} (\`${value}\`)`);
            Logger.success(`Настройка "${setting}" обновлена на ${guild.name} (${guildId}) → ${value}`);
        } catch (error) {
            Logger.error(`Ошибка при установке config ${setting} на ${guildId}:`, error);
            await interaction.editReply('❌ Ошибка при применении настройки. Подробности в логах.');
        }
    },

    async endpoll(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const result = await pollManager.endPoll(interaction.guildId, true);
        await interaction.editReply('✅ Опрос завершён вручную.');
    },

    async config(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const guildId = interaction.guildId;
        const config = SettingsManager.getConfig(guildId);
        const guild = interaction.guild;

        if (!config) {
            await interaction.editReply('❌ Этот сервер не настроен в системе бота.');
            return;
        }

        const resolveName = (type, id) => {
            if (!id) return '❌ Не указано';
            try {
                const item = type === 'channel'
                    ? guild.channels.cache.get(id)
                    : guild.roles.cache.get(id);
                return item ? `${item.name} (\`${id}\`)` : `⚠️ Не найдено (ID: \`${id}\`)`;
            } catch {
                return `⚠️ Ошибка при поиске ID: \`${id}\``;
            }
        };

        const { channelId, leaderRoleId, voterRoleId, curatorRoleId, enabled } = config;

        const embed = {
            color: 0x5865F2,
            title: `⚙️ Конфигурация для "${guild.name}"`,
            fields: [
                { name: '📢 Канал опросов', value: resolveName('channel', channelId), inline: false },
                { name: '👑 Роль лидера', value: resolveName('role', leaderRoleId), inline: false },
                { name: '🔔 Роль пинга', value: resolveName('role', voterRoleId), inline: false },
                { name: '🧑‍💼 Роль кураторов', value: resolveName('role', curatorRoleId), inline: false },
                { name: '🔄 Автоопросы', value: enabled ? '🟢 Включены' : '🔴 Выключены', inline: false }
            ],
            footer: { text: `ID сервера: ${guildId}` },
            timestamp: new Date()
        };

        await interaction.editReply({ embeds: [embed] });
    },

    async toggle(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const guildId = interaction.guildId;
        const config = SettingsManager.getConfig(guildId);
        if (!config) {
            await interaction.editReply('❌ Этот сервер не настроен.');
            return;
        }
        const newState = !config.enabled;
        SettingsManager.updateConfig(guildId, { enabled: newState });
        await interaction.editReply(`🔄 Автоопросы теперь ${newState ? 'включены ✅' : 'отключены ❌'}.`);
    },

    async pollstatus(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const states = pollManager.getPollStates();
        const configs = SettingsManager.getAllConfigs();

        const fields = [];
        let closestEndTime = null;

        for (const [guildId, config] of Object.entries(configs)) {
            const name = `> ${config.name}`;
            const state = states[guildId];
            const active = state && !state.ended;
            const yes = active ? state.votes.yes.size : 0;
            const no = active ? state.votes.no.size : 0;

            if (active) {
                const stateEnd = pollManager.constructor.getNextTuesdayEnd();
                if (!closestEndTime || stateEnd < closestEndTime) {
                    closestEndTime = stateEnd;
                }
            }

            const value = active
                ? `> ${config.enabled ? '🟢 Включен' : '🔴 Выключен'}\n> \n>  ${yes} | ${no}`
                : `> ${config.enabled ? '🟢 Включен' : '🔴 Выключен'}\n> \n>  😴`;

            fields.push({ name, value, inline: true });
        }

        // Добавляем ⌚ финальный блок
        let timeValue = '';

        if (closestEndTime) {
            const now = new Date();
            const remainingMs = closestEndTime - now;
            const hours = Math.floor(remainingMs / (1000 * 60 * 60));
            const minutes = Math.floor((remainingMs / (1000 * 60)) % 60);
            timeValue = `Опрос оканчивается через ${hours} ч ${minutes} мин`;
        } else {
            timeValue = 'Нет активных опросов';
            const nextPoll = scheduleManager.getNextGlobalPollTime();
            if (nextPoll) {
                const now = new Date();
                const diff = nextPoll - now;
                const hours = Math.floor(diff / (1000 * 60 * 60));
                const minutes = Math.floor((diff / (1000 * 60)) % 60);

                const exactTime = nextPoll.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', weekday: 'short', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'long' });
                timeValue += ` | Следующий опрос: ${hours > 24 ? exactTime : `${hours} ч ${minutes} мин`}`;
            }
        }

        fields.push({
            name: '⌚',
            value: timeValue
        });

        const embed = new EmbedBuilder()
            .setTitle('📊 Статус опросов по серверам')
            .setColor(0x2B6CB0)
            .addFields(fields)
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },

    async clearcommands(interaction) {
        await commandManager.clearAllCommands(interaction);
    }
});
