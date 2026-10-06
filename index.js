const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const fs = require('fs/promises');
const path = require('path');
const config = require('./config');
const { normalizePhoneNumber } = require('./utils/phone');
const CommandHandler = require('./handler');
const { attachWelcomeHandler } = require('./welcomeHandler');
const { createStyledSocket } = require('./textStyle');

const authDir = path.join(__dirname, 'auth_info');
let reconnectTimer = null;
let starting = false;
let activeSocket = null;
let reconnectDelay = 3000;

const ownerNumber = normalizePhoneNumber(config.ownerNumber);

let db = {
    mode: config.mode,
    prefix: config.prefix,
    botName: config.botName,
    ownerName: config.ownerName,
    ownerNumber,
    features: { ...config.features }
};

const cmdHandler = new CommandHandler();
// CommandHandler recursively loads commands/admin and commands/owner.
cmdHandler.loadCommands(path.join(__dirname, 'commands'));

async function startBot() {
    if (starting || activeSocket) return;
    starting = true;
    let state;
    let saveCreds;
    try {
        ({ state, saveCreds } = await useMultiFileAuthState(authDir));
    } catch (error) {
        starting = false;
        throw error;
    }
    const pairingPhone = ownerNumber;
    if (config.usePairingCode && !state.creds.registered && !pairingPhone) {
        starting = false;
        throw new Error('Set a valid ownerNumber in config.js before using a pairing code.');
    }
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        browser: ['Chrome (Linux)', 'Chrome'],
        printQRInTerminal: false
    });
    const styledSock = createStyledSocket(sock);
    activeSocket = sock;
    starting = false;

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            console.log('Scan this QR from WhatsApp > Linked devices > Link a device:');
            qrcode.generate(qr, { small: true });
        }
        if (connection === 'close') {
            if (activeSocket !== sock) return;
            activeSocket = null;
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason === DisconnectReason.loggedOut) {
                const detail = lastDisconnect?.error?.message;
                console.log(`WhatsApp session is logged out (${reason}${detail ? `: ${detail}` : ''}). Clearing saved auth and starting a fresh pairing...`);
                fs.rm(authDir, { recursive: true, force: true })
                    .then(() => {
                        if (!reconnectTimer) {
                            reconnectTimer = setTimeout(() => {
                                reconnectTimer = null;
                                startBot().catch(err => console.error('Reconnect failed:', err));
                            }, reconnectDelay);
                            reconnectDelay = Math.min(reconnectDelay * 2, 30000);
                        }
                    })
                    .catch(error => console.error('Failed to clear logged-out WhatsApp auth:', error));
            } else {
                if (!reconnectTimer) {
                    console.log(`Connection closed (${reason || 'unknown'}${lastDisconnect?.error?.message ? `: ${lastDisconnect.error.message}` : ''}). Reconnecting...`);
                    reconnectTimer = setTimeout(() => {
                        reconnectTimer = null;
                        startBot().catch(err => console.error('Reconnect failed:', err));
                    }, reconnectDelay);
                    reconnectDelay = Math.min(reconnectDelay * 2, 30000);
                }
            }
        } else if (connection === 'open') {
            reconnectDelay = 3000;
            console.log(`${db.botName} is online. Owner: ${ownerNumber || 'not configured'}`);
        }
    });

    sock.ev.on('creds.update', saveCreds);
    if (config.usePairingCode && !state.creds.registered) {
        setTimeout(async () => {
            try {
                const generated = await sock.requestPairingCode(pairingPhone);
                console.log(`WhatsApp pairing code for the selected owner account: ${generated}`);
                console.log('WhatsApp > Linked devices > Link a device > Link with phone number');
            } catch (error) {
                console.error('Pairing request failed:', error.message);
            }
        }, 2000);
    }
    attachWelcomeHandler(styledSock);

    sock.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek || !mek.message) return;
            if (mek.key && mek.key.remoteJid === 'status@broadcast') return;
            await cmdHandler.run(styledSock, mek, db);
        } catch (err) {
            console.error('Error handling message:', err);
        }
    });
}

startBot();