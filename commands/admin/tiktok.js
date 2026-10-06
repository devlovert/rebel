const { sendDownloaded, isPlatformUrl } = require('./shared-media');

// Download and send a TikTok video.
module.exports = { name: 'tiktok', groupOnly: true, async execute({ sock, m, reply, q }) { if (!q || !isPlatformUrl(q, ['tiktok.com'])) return reply('Example: .tiktok TikTok video link'); await sendDownloaded({ sock, m, reply, target: q, kind: 'video' }); } };