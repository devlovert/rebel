const fs = require('fs');
const path = require('path');

const commandNames = (directory, excluded) => {
    const names = [];
    const visit = currentDirectory => {
        for (const entry of fs.readdirSync(currentDirectory, { withFileTypes: true })) {
            const filePath = path.join(currentDirectory, entry.name);
            if (entry.isDirectory()) {
                visit(filePath);
                continue;
            }
            if (!entry.name.endsWith('.js')) continue;

            const loaded = require(filePath);
            const commands = Array.isArray(loaded) ? loaded : [loaded];
            for (const command of commands) {
                if (command?.name && !excluded.has(command.name)) names.push(command.name);
            }
        }
    };
    visit(directory);
    return [...new Set(names)].sort();
};

const formatCommands = (prefix, names) => names.map(name => `│ ${prefix}${name}`).join('\n');

module.exports = {
    name: 'menu',
    alias: ['help'],
    async execute({ sock, m, reply, db }) {
        const commandsRoot = path.join(__dirname, '..');
        const ownerCommands = commandNames(path.join(commandsRoot, 'owner'), new Set());
        const adminCommands = commandNames(path.join(commandsRoot, 'admin'), new Set(['menu', 'help']));
        const menuText = `╭━━━━━━━━━━━━━━━━━━╮
│       ${db.botName}
╰━━━━━━━━━━━━━━━━━━╯

Bot Name: ${db.botName}
Prefix: ${db.prefix}
Owner Name: ${db.ownerName}

┌── OWNER COMMANDS ──
${formatCommands(db.prefix, ownerCommands)}

┌── ADMIN COMMANDS ──
${formatCommands(db.prefix, adminCommands)}
└────────────────────`;

        const rootImagePath = path.join(process.cwd(), 'menu.png');
        try {
            if (fs.existsSync(rootImagePath)) {
                await sock.sendMessage(m.key.remoteJid, {
                    image: fs.readFileSync(rootImagePath),
                    caption: menuText
                }, { quoted: m });
            } else {
                await reply(menuText);
            }
        } catch (error) {
            console.error('Menu image send err:', error);
            await reply(menuText);
        }
    }
};
