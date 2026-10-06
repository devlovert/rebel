// Static bot identity and feature defaults. Runtime changes live in index.js memory.
const globalDb = {
    botName: 'rebel-bot',
    ownerName: 'atangwadi',
    ownerNumber: '923100064004',
    usePairingCode: false,
    prefix: '.',
    mode: 'admin',
    features: {
        statusmention: false,
        antilink: false,
        antisticker: true,
        fileFilter: false,
        autoreact: false
    }
};

module.exports = globalDb;