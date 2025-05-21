const fs = require('fs').promises;
const path = require('path');
const Logger = require('./logger');
const { SETTINGS_FILE_NAME, INITIAL_SERVER_CONFIGS } = require('./config');

const SETTINGS_FILE = path.join(__dirname, SETTINGS_FILE_NAME);
let currentServerConfigs = JSON.parse(JSON.stringify(INITIAL_SERVER_CONFIGS));

class SettingsManager {
    static getConfig(guildId) {
        return currentServerConfigs[guildId];
    }

    static getAllConfigs() {
        return currentServerConfigs;
    }

    static updateConfig(guildId, partialConfig) {
        if (!currentServerConfigs[guildId]) {
            currentServerConfigs[guildId] = { enabled: false };
        }
        Object.assign(currentServerConfigs[guildId], partialConfig);
        this.save().catch(err => Logger.error("Ошибка авто-сохранения настроек", err));
    }

    static async load() {
        try {
            const data = await fs.readFile(SETTINGS_FILE, 'utf8');
            const loadedFromFile = JSON.parse(data);

            Object.keys(loadedFromFile).forEach(guildId => {
                if (!currentServerConfigs[guildId]) currentServerConfigs[guildId] = {};
                Object.assign(currentServerConfigs[guildId], loadedFromFile[guildId]);
            });

    const allowedGuildIds = Object.keys(INITIAL_SERVER_CONFIGS);

            // Удалить лишние
            Object.keys(currentServerConfigs).forEach(id => {
                if (!allowedGuildIds.includes(id)) {
                    delete currentServerConfigs[id];
                }
            });

            // Добавить недостающие
            allowedGuildIds.forEach(id => {
                const initial = INITIAL_SERVER_CONFIGS[id];
                if (!currentServerConfigs[id]) {
                    currentServerConfigs[id] = { ...initial };
                } else {
                    // Обновить поля, если не хватает
                    Object.keys(initial).forEach(key => {
                        if (currentServerConfigs[id][key] === undefined) {
                            currentServerConfigs[id][key] = initial[key];
                        }
                    });
                }
            });


            Logger.success('Настройки загружены');
        } catch (error) {
            if (error.code === 'ENOENT') {
                Logger.info(`Файл ${SETTINGS_FILE_NAME} не найден. Создаём по умолчанию.`);
                await this.save();
            } else {
                Logger.error('Ошибка загрузки настроек:', error);
            }
        }
        return currentServerConfigs;
    }

    static async save() {
        try {
            const toSave = {};
            Object.entries(currentServerConfigs).forEach(([guildId, config]) => {
                toSave[guildId] = {
                    enabled: config.enabled,
                    channelId: config.channelId,
                    leaderRoleId: config.leaderRoleId,
                    voterRoleId: config.voterRoleId,
                    curatorRoleId: config.curatorRoleId
                };
            });
            await fs.writeFile(SETTINGS_FILE, JSON.stringify(toSave, null, 2));
            Logger.success('Настройки сохранены');
        } catch (error) {
            Logger.error('Ошибка сохранения настроек:', error);
        }
    }
}

module.exports = SettingsManager;
