const { sendDownloaded, isPlatformUrl } = require('./shared-media');

// Download and send an Instagram video.
module.exports = { name: 'insta', groupOnly: true, async execute({ sock, m, reply, q }) { if (!q || !isPlatformUrl(q, ['instagram.com'])) return reply('Example: .insta Instagram video link'); await sendDownloaded({ sock, m, reply, target: q, kind: 'video' }); } };