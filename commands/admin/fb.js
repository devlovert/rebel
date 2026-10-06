const { sendDownloaded, isPlatformUrl } = require('./shared-media');

// Download and send a Facebook video.
module.exports = { name: 'fb', groupOnly: true, async execute({ sock, m, reply, q }) { if (!q || !isPlatformUrl(q, ['facebook.com', 'fb.watch'])) return reply('Example: .fb Facebook video link'); await sendDownloaded({ sock, m, reply, target: q, kind: 'video' }); } };