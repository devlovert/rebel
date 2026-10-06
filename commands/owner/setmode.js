// Owner-only command: switch whether non-owner messages are accepted by the bot.
module.exports = {
    name: 'setmode',
    async execute({ reply, q, db }) {
        const requestedMode = String(q || '').trim().toLowerCase();
        const validModes = ['admin', 'owner'];

        if (requestedMode && !validModes.includes(requestedMode)) {
            return reply('Use: .setmode admin or .setmode owner');
        }

        if (requestedMode) {
            db.mode = requestedMode;
        } else {
            const nextMode = { admin: 'owner', owner: 'admin' };
            db.mode = nextMode[db.mode] || 'admin';
        }
        reply(`Mode switched to: ${db.mode}`);
    }
};
