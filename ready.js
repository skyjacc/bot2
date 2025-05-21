const Logger = require('../logger');
const SettingsManager = require('../settingsManager');
const { ALLOWED_GUILD_IDS } = require('../config');

module.exports = async function onReady(client, commandManager, scheduleManager) {
    try {
        await SettingsManager.load();
        Logger.info('✅ Настройки успешно загружены.');

    for (const guild of client.guilds.cache.values()) {
    if (ALLOWED_GUILD_IDS.includes(guild.id)) {
        await commandManager.register(guild.id);
        Logger.info(`✅ Команды зарегистрированы для ${guild.name} (${guild.id})`);
    }
    }
// Глобальная регистрация
        
        scheduleManager.start();
        Logger.success('⏰ Планировщик опросов запущен.');

        scheduleManager.startDailyGuildCheck(client); // ← вот эта строка

        client.user.setActivity('опросы /startpoll', { type: 3 });

        Logger.success(`Бот готов! Авторизован как ${client.user.tag} (${client.user.id})`);
        Logger.info(`Подключен к ${client.guilds.cache.size} серверам:`);

        for (const guild of client.guilds.cache.values()) {
            const config = SettingsManager.getConfig(guild.id);

            if (!ALLOWED_GUILD_IDS.includes(guild.id)) {
                Logger.warn(`🛑 ${guild.name} (${guild.id}) — не входит в список разрешённых. Покидаем сервер...`);
                try {
                    await guild.leave();
                } catch (err) {
                    Logger.error(`❌ Не удалось покинуть сервер ${guild.id}:`, err);
                }
                continue;
            }

            const status = config
                ? `Автоопросы: ${config.enabled ? '🟢 ВКЛ' : '🔴 ВЫКЛ'}, Канал: ${config.channelId || 'не указан'}`
                : 'Не настроен';

            Logger.info(`  • ${guild.name} (${guild.id}) — ${status}`);
        }
    } catch (error) {
        Logger.error('Ошибка в onReady обработчике:', error);
    }
};
