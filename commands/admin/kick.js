// Remove a mentioned or quoted participant.
const { getTargetJid } = require('./shared');
module.exports = { name: 'kick', groupOnly: true, adminOnly: true, async execute({ sock, m, reply }) { const target = getTargetJid(m); if (!target) return reply('Tag or quote user to kick (.kick @user)'); await sock.groupParticipantsUpdate(m.key.remoteJid, [target], 'remove'); reply('User kicked.'); } };