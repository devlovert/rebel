const fs = require('fs');
const path = require('path');

const bannedFile = path.join(__dirname, '../../data/muted_banned_users.json');
const warnFile = path.join(__dirname, '../../data/warnings.json');
const welcomeFile = path.join(__dirname, '../../data/welcome.json');

const readJson = file => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
const writeJson = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');

const getBannedList = () => readJson(bannedFile);
const saveBannedList = list => writeJson(bannedFile, list);
const getWarnList = () => readJson(warnFile);
const saveWarnList = list => writeJson(warnFile, list);
const getWelcomeSettings = () => readJson(welcomeFile);
const saveWelcomeSettings = settings => writeJson(welcomeFile, settings);
const getTargetJid = m => {
    const mentioned = m.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const quoted = m.message.extendedTextMessage?.contextInfo?.participant;
    return mentioned[0] || quoted || null;
};

module.exports = { getBannedList, saveBannedList, getWarnList, saveWarnList, getWelcomeSettings, saveWelcomeSettings, getTargetJid };