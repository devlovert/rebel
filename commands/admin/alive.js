// Report that the bot is active.
module.exports = { name: 'alive', async execute({ reply, db }) { await reply(`*${db.botName}* is active and running smoothly.\nOwner: ${db.ownerName}`); } };