// Demote a mentioned or quoted participant.
const { getTargetJid } = require('./shared');
module.exports = { name: 'demote', groupOnly: true, adminOnly: true, async execute({ sock, m, reply }) { const target = getTargetJid(m); if (!target) return reply('Quote target user to demote!'); await sock.groupParticipantsUpdate(m.key.remoteJid, [target], 'demote'); reply('User demoted.'); } };