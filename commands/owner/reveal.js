const {
    downloadContentFromMessage,
    normalizeMessageContent
} = require('@whiskeysockets/baileys');

const unwrapMessage = (message) => {
    let current = message;
    let isViewOnce = false;
    while (current && typeof current === 'object') {
        if (current.ephemeralMessage?.message) {
            current = current.ephemeralMessage.message;
            continue;
        }
        if (current.viewOnceMessage?.message) {
            isViewOnce = true;
            current = current.viewOnceMessage.message;
            continue;
        }
        if (current.viewOnceMessageV2?.message) {
            isViewOnce = true;
            current = current.viewOnceMessageV2.message;
            continue;
        }
        if (current.viewOnceMessageV2Extension?.message) {
            isViewOnce = true;
            current = current.viewOnceMessageV2Extension.message;
            continue;
        }
        break;
    }
    return { message: current, isViewOnce };
};

const getQuotedMessage = (message) => {
    const visited = new Set();
    const find = (value) => {
        if (!value || typeof value !== 'object' || visited.has(value)) return null;
        visited.add(value);

        if (value.contextInfo?.quotedMessage) {
            return value.contextInfo.quotedMessage;
        }

        for (const child of Object.values(value)) {
            const result = find(child);
            if (result) return result;
        }
        return null;
    };
    return find(message);
};

const getMedia = (quotedMessage) => {
    const normalized = normalizeMessageContent(quotedMessage) || quotedMessage;
    const unwrapped = unwrapMessage(normalized);
    const message = unwrapped.message;
    if (!message) return null;

    for (const type of ['imageMessage', 'videoMessage', 'audioMessage']) {
        if (message[type]) {
            return {
                type: type.replace('Message', ''),
                content: message[type],
                isViewOnce: unwrapped.isViewOnce || message[type].viewOnce === true
            };
        }
    }
    return null;
};

const toBuffer = async (stream) => {
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
};

module.exports = {
    name: 'reveal',
    ownerOnly: true,
    async execute({ sock, m }) {
        const quotedMessage = getQuotedMessage(m.message);
        const media = getMedia(quotedMessage);
        if (!media || !media.isViewOnce) return;

        const stream = await downloadContentFromMessage(media.content, media.type, {});
        const buffer = await toBuffer(stream);
        if (!buffer.length) throw new Error('View Once media download returned no data.');

        const payload = media.type === 'image'
            ? { image: buffer, mimetype: media.content.mimetype || 'image/jpeg' }
            : media.type === 'video'
                ? { video: buffer, mimetype: media.content.mimetype || 'video/mp4' }
                : {
                    audio: buffer,
                    mimetype: media.content.mimetype || 'audio/ogg; codecs=opus',
                    ptt: Boolean(media.content.ptt)
                };

        await sock.sendMessage(m.key.remoteJid, payload, { quoted: m });
    }
};