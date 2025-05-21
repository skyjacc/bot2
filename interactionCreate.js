const Logger = require('../logger');

module.exports = function onInteractionCreate(commandHandlers, pollManager) {
    return async (interaction) => {
        try {
            if (interaction.isChatInputCommand()) {
                const command = commandHandlers[interaction.commandName];
                if (command) {
                    await command(interaction);
                } else {
                    await interaction.reply({ content: '❌ Неизвестная команда.', ephemeral: true });
                }
            } else if (interaction.isButton()) {
                if (interaction.customId === 'poll_yes' || interaction.customId === 'poll_no') {
                    await pollManager.handleVote(interaction);
                }
            }
        } catch (error) {
            Logger.error('Ошибка при обработке взаимодействия:', error);
            if (interaction.deferred || interaction.replied) {
                await interaction.followUp({ content: '⚠️ Произошла ошибка.', ephemeral: true }).catch(() => {});
            } else {
                await interaction.reply({ content: '⚠️ Произошла ошибка.', ephemeral: true }).catch(() => {});
            }
        }
    };
};
