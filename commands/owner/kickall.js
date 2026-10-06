// Owner-only destructive command: remove every eligible non-admin member.
const { normalizePhoneNumber } = require('../../utils/phone');
module.exports = {
    name: 'kickall',
    groupOnly: true,
    ownerOnly: true,
    async execute({ sock, m, reply, db }) {
        try {
            const groupId = m.key.remoteJid;
            const meta = await sock.groupMetadata(groupId);
            const botNumber = normalizePhoneNumber(sock.user?.id);
            const ownerNumber = normalizePhoneNumber(db.ownerNumber);
            const targets = meta.participants.filter(participant => {
                if (participant.admin) return false;

                const participantIds = [
                    participant.id,
                    participant.jid,
                    participant.lid,
                    participant.phoneNumber
                ].filter(Boolean);
                const participantNumbers = participantIds.map(normalizePhoneNumber);
                return !(botNumber && participantNumbers.includes(botNumber)) &&
                    !(ownerNumber && participantNumbers.includes(ownerNumber));
            }).map(participant => participant.id);
            if (targets.length === 0) return reply('Koi bhi non-admin kick karne ke liye available nahi hai.');
            await reply(`⚠️ Warning: Removing ${targets.length} members from the group...`);
            await sock.groupParticipantsUpdate(groupId, targets, 'remove');
            reply('All eligible non-admin members have been kicked.');
        } catch (e) {
            console.error('Kickall err:', e);
            reply('Failed to kick all members.');
        }
    }
};
