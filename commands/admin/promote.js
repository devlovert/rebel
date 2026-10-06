// Promote a mentioned or quoted participant.
const { getTargetJid } = require('./shared');
module.exports = { name: 'promote', groupOnly: true, adminOnly: true, async execute({ sock, m, reply }) { const target = getTargetJid(m); if (!target) return reply('Quote target user to promote!'); await sock.groupParticipantsUpdate(m.key.remoteJid, [target], 'promote'); reply('User promoted.'); } };