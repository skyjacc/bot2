const cron = require('node-cron');
const Logger = require('./logger');
const SettingsManager = require('./settingsManager');

let cronJob = null;
let customStart = null;
let customEnd = null;
let globalStartCron = null;
let globalEndCron = null;

class ScheduleManager {
    constructor(pollManager) {
        this.pollManager = pollManager;
    }

    setGlobalAutoTime(start, end) {
        globalStartCron = start;
        globalEndCron = end;
    }

    getNextGlobalPollTime() {
        if (!globalStartCron) return null;
        const [min, hour, , , day] = globalStartCron.split(' ').map(Number);
        const now = new Date();
        const target = new Date(now);
        const moscowNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));

        let diff = (day - moscowNow.getDay() + 7) % 7;
        if (diff === 0 && (moscowNow.getHours() > hour || (moscowNow.getHours() === hour && moscowNow.getMinutes() >= min))) {
            diff = 7;
        }

        target.setDate(moscowNow.getDate() + diff);
        target.setHours(hour, min, 0, 0);
        return target;
    }

    getCurrentGlobalEndTime() {
        if (!globalEndCron) return null;
        const [min, hour, , , day] = globalEndCron.split(' ').map(Number);
        const now = new Date();
        const target = new Date(now);
        const moscowNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));

        let diff = (day - moscowNow.getDay() + 7) % 7;
        if (diff === 0 && (moscowNow.getHours() > hour || (moscowNow.getHours() === hour && moscowNow.getMinutes() >= min))) {
            diff = 7;
        }

        target.setDate(moscowNow.getDate() + diff);
        target.setHours(hour, min, 0, 0);
        return target;
    }
    start() {
        if (cronJob) {
            cronJob.stop();
            Logger.info('Старый планировщик остановлен.');
        }

        cronJob = cron.schedule('5 0 * * 1', async () => {
            Logger.info('⏰ Запуск автоматических опросов по расписанию...');

            const configs = SettingsManager.getAllConfigs();
            const guildsToPoll = Object.keys(configs).filter(id => configs[id].enabled);

            if (guildsToPoll.length === 0) {
                Logger.info('Нет серверов с включёнными опросами.');
                return;
            }

            for (const guildId of guildsToPoll) {
                try {
                    const result = await this.pollManager.startPoll(guildId, false);

                    Logger.info(`→ ${guildId}: ${result.message}`);

                    if (result.success) {
                        this.pollManager.scheduleEndPoll(guildId);
                    }
                } catch (err) {
                    Logger.error(`Ошибка при запуске опроса на ${guildId}:`, err);
                }

                await new Promise(res => setTimeout(res, 3000));
            }
        }, {
            timezone: 'Europe/Moscow',
            scheduled: true
        });

        Logger.success('📆 Планировщик опросов активен (понедельник 00:05 МСК).');
    }

    stop() {
        if (cronJob) {
            cronJob.stop();
            cronJob = null;
            Logger.info('⛔ Планировщик остановлен.');
        }
    }
    setCustomSchedule(startCron, endCron) {
        if (cronJob) cronJob.stop();

        customStart = startCron;
        customEnd = endCron;

        cronJob = cron.schedule(startCron, async () => {
        Logger.info('⏰ Запуск опросов по пользовательскому расписанию...');
        const configs = SettingsManager.getAllConfigs();
        const guildsToPoll = Object.keys(configs).filter(id => configs[id].enabled);
        for (const guildId of guildsToPoll) {
            const result = await this.pollManager.startPoll(guildId, false);
            Logger.info(`→ ${guildId}: ${result.message}`);
            if (result.success) {
            this.pollManager.scheduleEndPoll(guildId, false, null, customEnd);
            }
            await new Promise(res => setTimeout(res, 3000));
        }
        }, {
        timezone: 'Europe/Moscow',
        scheduled: true
        });

        Logger.success(`📆 Пользовательское расписание установлено: start="${startCron}", end="${endCron}"`);
    }
    startDailyGuildCheck(client) {
        cron.schedule('0 4 * * *', async () => {
            Logger.info('🔍 Ежедневная проверка серверов на соответствие whitelist...');

            const guilds = client.guilds.cache;
            let total = guilds.size;
            let allowed = 0;
            let left = 0;

            for (const guild of guilds.values()) {
                if (!ALLOWED_GUILD_IDS.includes(guild.id)) {
                    Logger.warn(`⚠️ 🛑 ${guild.name} (${guild.id}) — не входит в список разрешённых. Покидаем...`);
                    try {
                        await guild.leave();
                        left++;
                    } catch (err) {
                        Logger.error(`❌ Не удалось покинуть ${guild.name} (${guild.id})`, err);
                    }
                } else {
                    allowed++;
                }
            }

            Logger.info(`📊 Серверов всего: ${total}, осталось: ${allowed}, покинул: ${left}`);
        }, {
            timezone: 'Europe/Moscow',
            scheduled: true
        });

        Logger.success('📅 Запланирована ежедневная проверка серверов (в 04:00 МСК).');
    }
}

module.exports = ScheduleManager;
