// Show bot information.
module.exports = { name: 'info', async execute({ reply, db }) { reply(`ℹ️ *BOT INFO*\nName: ${db.botName}\nOwner: ${db.ownerName}\nVersion: 1.1.0`); } };