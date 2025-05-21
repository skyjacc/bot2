// commandManager.js
const { SlashCommandBuilder, PermissionsBitField, REST, Routes } = require('discord.js');
const Logger = require('./logger');

class CommandManager {
    constructor(token, clientId, ownerId) {
        this.token = token;
        this.clientId = clientId;
        this.ownerId = ownerId;
        this.rest = new REST({ version: '10' }).setToken(this.token);
    }

    getCommands() {
        return [
            new SlashCommandBuilder()
                .setName('startpoll')
                .setDescription('🗳️ Запустить опрос вручную')
                .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

            new SlashCommandBuilder()
                .setName('toggle')
                .setDescription('🔄 Включить или выключить автоопросы')
                .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

            new SlashCommandBuilder()
                .setName('pollstatus')
                .setDescription('📊 Посмотреть статус опросов')
                .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

            new SlashCommandBuilder()
                .setName('clearcommands')
                .setDescription('🧹 Удалить все команды (только для владельца)')
                .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
            new SlashCommandBuilder()
                .setName('config')
                .setDescription('⚙️ Показать конфигурацию сервера')
                .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

            new SlashCommandBuilder()
                .setName('endpoll')
                .setDescription('🛑 Завершить активный опрос')
                .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

            new SlashCommandBuilder()
                .setName('testall')
                .setDescription('🧪 Запустить тестовый опрос во всех включённых гильдиях на 1 минуту')
                .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

            new SlashCommandBuilder()
                .setName('setconfig')
                .setDescription('🧩 Изменить настройки сервера')
                .addStringOption(option =>
                    option.setName('setting')
                        .setDescription('Что изменить')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Канал опросов', value: 'channel' },
                            { name: 'Роль лидера', value: 'leader' },
                            { name: 'Роль для пинга', value: 'voter' },
                            { name: 'Роль кураторов', value: 'curator' }
                        )
                )
                .addStringOption(option =>
                    option.setName('value')
                        .setDescription('ID канала или роли')
                        .setRequired(true)
                )
                .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
            new SlashCommandBuilder()
            .setName('setautotime')
            .setDescription('🕒 Настроить время автоопросов')
            .addStringOption(option =>
                option.setName('start')
                .setDescription('Начало (напр: Понедельник 00:05)')
                .setRequired(true))
            .addStringOption(option =>
                option.setName('end')
                .setDescription('Конец (напр: Пятница 23:55)')
                .setRequired(true))
            .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

        ];
    }

    async register(guildId = null) {
        const commands = this.getCommands().map(cmd => cmd.toJSON());
        const route = guildId
            ? Routes.applicationGuildCommands(this.clientId, guildId)
            : Routes.applicationCommands(this.clientId);

        Logger.info(`Регистрируем ${commands.length} команд ${guildId ? `для сервера ${guildId}` : 'глобально'}...`);
        try {
            const registered = await this.rest.put(route, { body: commands });
            Logger.success(`Успешно зарегистрировано ${registered.length} команд.`);
        } catch (error) {
            Logger.error('Ошибка при регистрации команд:', error);
        }
    }

    async clearAllCommands(interaction) {
        if (interaction.user.id !== this.ownerId) {
            await interaction.reply({ content: '⛔ Только владелец бота может очистить команды.', ephemeral: true });
            return;
        }

        try {
            await interaction.deferReply({ ephemeral: true });
            await this.rest.put(Routes.applicationCommands(this.clientId), { body: [] });
            await interaction.editReply('✅ Все глобальные команды были удалены.');
        } catch (error) {
            Logger.error('Ошибка при удалении команд:', error);
            await interaction.editReply('❌ Ошибка при удалении команд.');
        }
    }
}

module.exports = CommandManager;
