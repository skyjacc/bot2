require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const Logger = require('./logger');
const SettingsManager = require('./settingsManager');
const CommandManager = require('./commandManager');
const PollManager = require('./pollManager');
const ScheduleManager = require('./scheduleManager');
const initializeCommandHandlers = require('./handlers/commandHandlers');
const onReadyHandler = require('./events/ready');
const onInteractionCreateHandler = require('./events/interactionCreate');
const { ALLOWED_GUILD_IDS } = require('./config');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

const BOT_TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const BOT_OWNER_ID = process.env.BOT_OWNER_ID;

if (!BOT_TOKEN || !CLIENT_ID) {
    Logger.error('❌ Отсутствует BOT_TOKEN или CLIENT_ID в .env');
    process.exit(1);
}

const commandManager = new CommandManager(BOT_TOKEN, CLIENT_ID, BOT_OWNER_ID);
const pollManager = new PollManager(client);
const scheduleManager = new ScheduleManager(pollManager);
const commandHandlers = initializeCommandHandlers(pollManager, commandManager, client, scheduleManager);

client.once('ready', () => onReadyHandler(client, commandManager, scheduleManager));
client.on('interactionCreate', onInteractionCreateHandler(commandHandlers, pollManager));

client.on('guildCreate', async (guild) => {
    if (!ALLOWED_GUILD_IDS.includes(guild.id)) {
        Logger.warn(`Бот был добавлен на НЕразрешённый сервер: ${guild.name} (${guild.id}). Удаляемся.`);
        try {
            await guild.leave();
        } catch (err) {
            Logger.error(`Ошибка при попытке выйти с сервера ${guild.id}:`, err);
        }
    } else {
        Logger.info(`Бот успешно добавлен на разрешённый сервер: ${guild.name} (${guild.id})`);
    }
});

client.login(BOT_TOKEN).then(() => {
    Logger.success('✅ Бот авторизован!');
}).catch(error => {
    Logger.error('❌ Ошибка авторизации:', error);
    process.exit(1);
});
