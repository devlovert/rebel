// Measure response latency.
module.exports = {
    name: 'speedtest',
    async execute({ reply }) {
        const start = Date.now();
        await reply('Testing response latency...');
        await reply(`Response latency: ${Date.now() - start}ms`);
    }
};