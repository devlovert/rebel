// Show the bot creator.
module.exports = { name: 'creator', async execute({ reply, db }) { reply(`👨‍💻 *CREATOR*\nCreated and maintained by ${db.ownerName}.`); } };