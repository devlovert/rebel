// Styles outgoing bot text while preserving links and WhatsApp mentions.
const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const lowercase = 'abcdefghijklmnopqrstuvwxyz';
const digits = '0123456789';
const styledUppercase = Array.from('𝔸𝔹ℂ𝔻𝔼𝔽𝔾ℍ𝕀𝕁𝕂𝕃𝕄ℕ𝕆ℙℚℝ𝕊𝕋𝕌𝕍𝕎𝕏𝕐ℤ');
const styledLowercase = Array.from('𝕒𝕓𝕔𝕕𝕖𝕗𝕘𝕙𝕚𝕛𝕜𝕝𝕞𝕟𝕠𝕡𝕢𝕣𝕤𝕥𝕦𝕧𝕨𝕩𝕪𝕫');
const styledDigits = Array.from('𝟘𝟙𝟚𝟛𝟜𝟝𝟞𝟟𝟠𝟡');

const stylePlainText = (text) => String(text).replace(/[A-Za-z0-9]/g, character => {
    const uppercaseIndex = uppercase.indexOf(character);
    if (uppercaseIndex >= 0) return styledUppercase[uppercaseIndex];

    const lowercaseIndex = lowercase.indexOf(character);
    if (lowercaseIndex >= 0) return styledLowercase[lowercaseIndex];

    return styledDigits[digits.indexOf(character)];
});

const styleText = (text) => {
    const protectedParts = [];
    const protectedText = String(text).replace(/(?:https?:\/\/|www\.|wa\.me\/|chat\.whatsapp\.com\/)[^\s]+|@[0-9]+/gi, match => {
        const marker = `\u0000${String.fromCodePoint(0xE000 + protectedParts.length)}\u0000`;
        protectedParts.push(match);
        return marker;
    });

    return stylePlainText(protectedText).replace(/\u0000([\uE000-\uF8FF])\u0000/g, (_, marker) => {
        return protectedParts[marker.codePointAt(0) - 0xE000];
    });
};

const styleContent = (content) => {
    if (!content || typeof content !== 'object') return content;
    if (Buffer.isBuffer(content) || content instanceof Uint8Array) return content;
    if (Array.isArray(content)) return content.map(styleContent);

    const styled = {};
    for (const [key, value] of Object.entries(content)) {
        if ((key === 'text' || key === 'caption') && typeof value === 'string') {
            styled[key] = styleText(value);
        } else if (key === 'contextInfo' || key === 'quotedMessage') {
            styled[key] = value;
        } else if (value && typeof value === 'object') {
            styled[key] = styleContent(value);
        } else {
            styled[key] = value;
        }
    }
    return styled;
};

const createStyledSocket = (sock) => new Proxy(sock, {
    get(target, property) {
        if (property === 'sendMessageRaw') return target.sendMessage.bind(target);
        if (property !== 'sendMessage') return target[property];
        return (jid, content, options) => {
            if (!content || typeof content !== 'object') return target.sendMessage(jid, content, options);
            return target.sendMessage(jid, styleContent(content), options);
        };
    }
});

module.exports = { createStyledSocket, styleText, styleContent };
