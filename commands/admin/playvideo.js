const { sendDownloaded, isUrl } = require('./shared-media');

// Download and send a video search result or URL.
module.exports = { name: 'playvideo', alias: 'playideo', groupOnly: true, async execute({ sock, m, reply, q }) { if (!q) return reply('Example: .playvideo video name'); await sendDownloaded({ sock, m, reply, target: isUrl(q) ? q : `ytsearch1:${q}`, kind: 'video' }); } };