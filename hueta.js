// resetCommands.js
require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { ALLOWED_GUILD_IDS } = require('./config');
const Logger = require('./logger');
const CommandManager = require('./commandManager');

const token = process.env.BOT_TOKEN;
const clientId = process.env.CLIENT_ID;
const ownerId = process.env.BOT_OWNER_ID;

const rest = new REST({ version: '10' }).setToken(token);
const commandManager = new CommandManager(token, clientId, ownerId);

(async () => {
    try {
        Logger.info('⛔ Удаляем все глобальные команды...');
        await rest.put(Routes.applicationCommands(clientId), { body: [] });
        Logger.success('✅ Глобальные команды удалены.');

        Logger.info('⛔ Удаляем и перерегистрируем локальные команды...');
        for (const guildId of ALLOWED_GUILD_IDS) {
            try {
                await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
                Logger.success(`✅ Локальные команды удалены в гильдии ${guildId}`);

                await commandManager.register(guildId);
                Logger.success(`✅ Зарегистрированы локальные команды для ${guildId}`);
            } catch (error) {
                if (error.code === 50001) {
                    Logger.warn(`⚠️ Пропущена гильдия ${guildId} — Missing Access (бот не имеет прав).`);
                } else {
                    Logger.error(`❌ Ошибка при работе с гильдией ${guildId}:`, error);
                }
            }
        }

        Logger.success('🎯 Все команды обновлены локально только в ALLOWED_GUILD_IDS!');
    } catch (error) {
        Logger.error('❌ Общая ошибка при сбросе и регистрации команд:', error);
    }
})();
