// Give a participant a warning and remove them at three warnings.
const { getTargetJid, getWarnList, saveWarnList } = require('./shared');
module.exports = {
    name: 'warn',
    groupOnly: true,
    adminOnly: true,
    async execute({ sock, m, reply }) {
        const target = getTargetJid(m);
        if (!target) return reply('Quote or mention user to warn (.warn @user)');

        const groupId = m.key.remoteJid;
        const warns = getWarnList();
        if (!warns[groupId]) warns[groupId] = {};

        const cleanTarget = String(target).split('@')[0];
        const currentKey = Object.keys(warns[groupId])
            .find(key => String(key).split('@')[0] === cleanTarget) || target;
        warns[groupId][currentKey] = (warns[groupId][currentKey] || 0) + 1;
        const count = warns[groupId][currentKey];
        saveWarnList(warns);

        if (count >= 3) {
            try {
                await sock.groupParticipantsUpdate(groupId, [target], 'remove');
            } catch (error) {
                console.error('Warning kick failed:', error);
                await reply(`⚠️ User @${cleanTarget} reached 3/3 warnings, but could not be removed. Ask a group admin to remove them.`);
                return;
            }

            delete warns[groupId][currentKey];
            saveWarnList(warns);
            await sock.sendMessage(groupId, {
                text: `⚠️ User @${cleanTarget} reached 3/3 warnings and was removed.`,
                mentions: [target]
            }, { quoted: m });
            return;
        }

        await sock.sendMessage(groupId, {
            text: `⚠️ Warning given to @${cleanTarget}. Total warnings: ${count}/3`,
            mentions: [target]
        }, { quoted: m });
    }
};