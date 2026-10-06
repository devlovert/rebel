const fs = require('fs');
const path = require('path');

// Automatic group-member welcome settings.
const welcomeFile = path.join(__dirname, 'data/welcome.json');

const readWelcomeSettings = () => {
    if (fs.existsSync(welcomeFile)) {
        try {
            return JSON.parse(fs.readFileSync(welcomeFile, 'utf8'));
        } catch (e) {
            return {};
        }
    }
    return {};
};

const formatMention = (jid) => {
    if (!jid) return '';
    return jid.includes('@') ? jid.split('@')[0] : jid;
};

const recentWelcomeMap = new Map();

const shouldSendWelcome = (groupId, participantJid) => {
    if (!groupId || !participantJid) return false;
    const key = `${String(groupId)}:${String(participantJid)}`;
    const now = Date.now();
    const lastSent = recentWelcomeMap.get(key) || 0;

    if (now - lastSent < 60000) {
        return false;
    }

    recentWelcomeMap.set(key, now);
    return true;
};

const sendWelcomeMessage = async (sock, groupId, participantJid) => {
    try {
        const settings = readWelcomeSettings();
        const savedText = settings[groupId] || 'bhot dair kar di meherban aaty aaty';
        const meta = await sock.groupMetadata(groupId);
        const memberCount = meta?.participants?.length || 0;

        const text = `✨ *Nawa aaya hain sohneya!* 👋\n\n` +
            `@${formatMention(participantJid)} *welcome*!\n\n` +
            `${savedText}\n\n` +
            `📌 *Group Info*\n` +
            `• Name: ${meta?.subject || 'Group'}\n` +
            `• Members: ${memberCount}\n\n` +
            `💙 Welcome to the family!`;

        await sock.sendMessage(groupId, {
            text,
            mentions: [participantJid]
        });
    } catch (e) {
        console.error('Welcome message error:', e);
    }
};

const attachWelcomeHandler = (sock) => {
    const handleAddParticipant = async (groupId, participants = []) => {
        if (!groupId || !Array.isArray(participants) || participants.length === 0) return;
        for (const participant of participants) {
            if (!participant || !shouldSendWelcome(groupId, participant)) continue;
            await sendWelcomeMessage(sock, groupId, participant);
        }
    };

    sock.ev.on('group-participants.update', async (update) => {
        try {
            if (!update || update.action !== 'add' || !update.participants || update.participants.length === 0) {
                return;
            }
            await handleAddParticipant(update.id, update.participants);
        } catch (e) {
            console.error('Group participant update error:', e);
        }
    });

    sock.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            const messages = chatUpdate?.messages || [];
            for (const msg of messages) {
                if (!msg || !msg.messageStubType) continue;
                const stubType = Number(msg.messageStubType);
                const addStubTypes = [27, 31, 71];
                if (!addStubTypes.includes(stubType)) continue;

                const groupId = msg.key?.remoteJid;
                const participants = Array.isArray(msg.messageStubParameters) ? msg.messageStubParameters : [];
                await handleAddParticipant(groupId, participants);
            }
        } catch (e) {
            console.error('Group participant stub message error:', e);
        }
    });
};

module.exports = { attachWelcomeHandler };
