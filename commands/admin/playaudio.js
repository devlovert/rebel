const { sendDownloaded, isUrl } = require('./shared-media');

// Download and send an audio search result or URL.
module.exports = { name: 'playaudio', groupOnly: true, async execute({ sock, m, reply, q }) { if (!q) return reply('Example: .playaudio song name'); await sendDownloaded({ sock, m, reply, target: isUrl(q) ? q : `ytsearch1:${q}`, kind: 'audio' }); } };