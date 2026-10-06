const fs = require('fs');
const path = require('path');
const config = require('./config');
const { normalizePhoneNumber } = require('./utils/phone');
const { styleText } = require('./textStyle');

// Persistent moderation data is kept outside the command source tree.
const dataDir = path.join(__dirname, 'data');
const bannedFile = path.join(dataDir, 'muted_banned_users.json');
const stickerWarningsFile = path.join(dataDir, 'sticker_warnings.json');

const getBody = (msg) => {
    if (!msg) return '';
    if (msg.conversation) return msg.conversation;
    if (msg.extendedTextMessage) return msg.extendedTextMessage.text;
    if (msg.ephemeralMessage) return getBody(msg.ephemeralMessage.message);
    if (msg.viewOnceMessage) return getBody(msg.viewOnceMessage.message);
    if (msg.viewOnceMessageV2) return getBody(msg.viewOnceMessageV2.message);
    return '';
};

const containsSticker = (message) => {
    const visited = new Set();
    const search = (value) => {
        if (!value || typeof value !== 'object' || visited.has(value)) return false;
        visited.add(value);
        if (value.stickerMessage) return true;
        return Object.values(value).some(search);
    };
    return search(message);
};

const getStickerWarnings = () => {
    if (!fs.existsSync(stickerWarningsFile)) return {};
    try {
        return JSON.parse(fs.readFileSync(stickerWarningsFile, 'utf8'));
    } catch (e) {
        return {};
    }
};

const saveStickerWarnings = (warnings) => {
    fs.writeFileSync(stickerWarningsFile, JSON.stringify(warnings, null, 2), 'utf8');
};

const emojis = ['❤️', '👍', '🔥', '⚡', '😎', '🎉', '👀', '🙌'];

class CommandHandler {
    constructor() {
        this.commands = new Map();
    }

    loadCommands(dir) {
        const category = path.basename(dir);
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const filePath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                this.loadCommands(filePath);
                continue;
            }
            if (!entry.name.endsWith('.js')) continue;

            let cmds = require(filePath);
            if (!Array.isArray(cmds)) {
                cmds = [cmds];
            }

            cmds.forEach(cmd => {
                if (!cmd || !cmd.name) return;
                // Folder placement is the access-control documentation: admin or owner.
                if (category === 'admin') cmd.adminOnly = true;
                if (category === 'owner') cmd.ownerOnly = true;
                this.commands.set(cmd.name, cmd);
                if (cmd.alias) {
                    const aliases = Array.isArray(cmd.alias) ? cmd.alias : [cmd.alias];
                    aliases.forEach(a => this.commands.set(a, cmd));
                }
            });
        }
    }

    isUserBanned(groupId, senderJid) {
        if (!fs.existsSync(bannedFile)) return false;
        try {
            const bannedList = JSON.parse(fs.readFileSync(bannedFile, 'utf8'));
            const groupBans = bannedList[groupId] || [];
            if (groupBans.length === 0) return false;

            const cleanTarget = String(senderJid).split('@')[0];
            return groupBans.some(b => String(b).split('@')[0] === cleanTarget);
        } catch (e) {
            return false;
        }
    }

    async intercept(sock, m, db) {
        if (!m.message) return false;
        const from = m.key.remoteJid;
        const isGroup = from.endsWith('@g.us');

        if (m.key.fromMe) return false;

        const deleteTarget = {
            ...m.key,
            remoteJid: from,
            fromMe: Boolean(m.key.fromMe),
            participant: m.key.participant || m.key.participantAlt
        };

        if (!isGroup) return false;

        // Antisticker applies only to group chats.
        if (db.features.antisticker && containsSticker(m.message)) {
            try {
                await sock.sendMessage(from, { delete: deleteTarget });
                const memberId = m.key.participant || m.key.participantAlt;
                const warnings = getStickerWarnings();
                if (!warnings[from]) warnings[from] = {};
                const memberKey = String(memberId || from).split('@')[0].split(':')[0];
                const count = (warnings[from][memberKey] || 0) + 1;
                warnings[from][memberKey] = count;
                saveStickerWarnings(warnings);

                if (count === 1) {
                    await sock.sendMessage(from, { text: 'okat me reh' }, { quoted: m });
                } else if (count === 2) {
                    await sock.sendMessage(from, { text: 'tera to game bajana pary ga' }, { quoted: m });
                } else {
                    await sock.sendMessage(from, { text: 'program to war gaya' }, { quoted: m });
                    await sock.groupParticipantsUpdate(from, [memberId], 'remove');
                    delete warnings[from][memberKey];
                    saveStickerWarnings(warnings);
                }
            } catch (e) { console.error('Delete sticker err:', e); }
            return true;
        }

        const senderJid = m.key.participant || from;

        // 0. Message-banned users check (Permanent auto-delete until unbanned)
        if (this.isUserBanned(from, senderJid)) {
            try {
                await sock.sendMessage(from, { delete: deleteTarget });
            } catch (e) {
                console.error('Delete muted-banned message err:', e);
            }
            return true;
        }

        const body = getBody(m.message);
        // 1. Antilink
        if (db.features.antilink) {
            const linkRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|wa\.me\/[^\s]+|t\.me\/[^\s]+)/i;
            if (linkRegex.test(body)) {
                try {
                    await sock.sendMessage(from, { delete: deleteTarget });
                    await sock.sendMessage(from, {
                        text: 'Ye meri property hai, yahan had mein reh.'
                    }, { quoted: m });
                } catch (e) { console.error('Delete link err:', e); }
                return true;
            }
        }

        // 3. Statusmention check
        if (db.features.statusmention) {
            const contextInfo = m.message.extendedTextMessage?.contextInfo ||
                m.message.imageMessage?.contextInfo ||
                m.message.videoMessage?.contextInfo;
            const isStatusReply = contextInfo?.remoteJid === 'status@broadcast' ||
                contextInfo?.participant?.includes('status') ||
                JSON.stringify(m.message).includes('status@broadcast');

            if (isStatusReply) {
                try {
                    await sock.sendMessage(from, { delete: deleteTarget });
                } catch (e) { console.error('Delete statusmention err:', e); }
                return true;
            }
        }

        // 4. Autoreact
        if (db.features.autoreact) {
            const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
            try {
                await sock.sendMessage(from, {
                    react: {
                        text: randomEmoji,
                        key: m.key
                    }
                });
            } catch (e) { console.error('React err:', e); }
        }

        return false;
    }

    async run(sock, m, db) {
        if (!m.message) return;

        // Background features execution & message deletion interceptor
        const intercepted = await this.intercept(sock, m, db);
        if (intercepted) return; // Agar message delete ho gaya toh command process nahi hoga

        const from = m.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        const sender = isGroup ? m.key.participant : (m.key.fromMe ? (sock.user?.id || from) : from);
        const senderIds = [
            sender,
            m.key.participantAlt,
            m.key.senderPn,
            m.key.remoteJidAlt
        ].filter(Boolean).map(String);

        const senderNumbers = senderIds.map(normalizePhoneNumber).filter(Boolean);
        const ownerNumber = normalizePhoneNumber(db.ownerNumber);
        const isOwner = Boolean(ownerNumber && senderNumbers.includes(ownerNumber));

        let isAdmin = false;
        if (isGroup && !isOwner) {
            try {
                const meta = await sock.groupMetadata(from);
                isAdmin = Boolean(meta?.participants?.find(p =>
                    p.admin && [p.id, p.jid, p.lid, p.phoneNumber]
                        .filter(Boolean)
                        .some(id => senderIds.includes(String(id)) ||
                            (normalizePhoneNumber(id) && senderNumbers.includes(normalizePhoneNumber(id))))
                ));
            } catch (e) {
                isAdmin = false;
            }
        } else if (isOwner) {
            isAdmin = true;
        }

        const body = getBody(m.message);
        if (!body || !body.startsWith(db.prefix)) return;

        const args = body.slice(db.prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();
        const q = args.join(' ');

        const reply = (text) => sock.sendMessage(from, { text: styleText(text) }, { quoted: m });
        const cmd = this.commands.get(commandName);
        const memberUnauthorizedMessage = '❌ Okat me reh putur, yeh tumhari pitasheri ka kaam hai!';
        const adminOwnerUnauthorizedMessage = '❌ Putur, tumhari pitasheri ne tumhe jaidad se dakhal kar diya hai!';

        if ((db.mode === 'private' || db.mode === 'owner') && !isOwner) {
            return reply(isAdmin ? adminOwnerUnauthorizedMessage : memberUnauthorizedMessage);
        }
        if (db.mode === 'admin' && !isOwner && !isAdmin) {
            return reply(memberUnauthorizedMessage);
        }
        if (!cmd) {
            if (!isOwner && !isAdmin) return reply(memberUnauthorizedMessage);
            return;
        }
        if (!isOwner && !isAdmin) return reply(memberUnauthorizedMessage);
        if (cmd.ownerOnly && !isOwner) return reply(adminOwnerUnauthorizedMessage);
        if (cmd.groupOnly && !isGroup) return reply('Group only command!');
        if (cmd.adminOnly && !isOwner && !isAdmin) return reply(memberUnauthorizedMessage);

        if (cmd.toggle) {
            const toggleKey = cmd.key || cmd.name;
            if (q === 'on' || q === 'off') {
                db.features[toggleKey] = q === 'on';
                return reply(`${cmd.name} turned ${q}`);
            } else {
                return reply(`Current ${cmd.name}: ${db.features[toggleKey] ? 'on' : 'off'}. Use ${db.prefix}${cmd.name} on/off`);
            }
        }

        try {
            await cmd.execute({ sock, m, reply, args, q, isOwner, isGroup, db });
        } catch (e) {
            console.error(e);
            reply('Error executing command.');
        }
    }
}

module.exports = CommandHandler;