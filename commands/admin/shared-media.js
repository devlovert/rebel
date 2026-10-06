const fs = require('fs');
const os = require('os');
const path = require('path');
const YTDlpWrap = require('yt-dlp-wrap').default;
const { execFile } = require('child_process');
const { promisify } = require('util');
const https = require('https');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;

const ytdlp = process.env.YTDLP_PATH || 'yt-dlp';
const execFileAsync = promisify(execFile);
const bundledBinary = path.join(__dirname, '..', '..', 'bin', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
const jsRuntimeArg = () => {
    const runtimePath = process.execPath || 'node';
    const runtimeName = runtimePath.includes('nodejs') ? 'nodejs' : 'node';
    return ['--js-runtimes', `${runtimeName}:${runtimePath}`];
};
let ytDlp;
let binaryReady;

const canExecute = async binary => {
    try {
        await execFileAsync(binary, ['--version']);
        return true;
    } catch (error) {
        return error.code !== 'ENOENT';
    }
};

const getYtDlp = async () => {
    if (ytDlp) return ytDlp;
    if (await canExecute(ytdlp)) {
        ytDlp = new YTDlpWrap(ytdlp);
        return ytDlp;
    }

    if (!binaryReady) {
        binaryReady = (async () => {
            fs.mkdirSync(path.dirname(bundledBinary), { recursive: true });
            if (!fs.existsSync(bundledBinary)) {
                await YTDlpWrap.downloadFromGithub(bundledBinary);
            }
            ytDlp = new YTDlpWrap(bundledBinary);
        })().catch(error => {
            binaryReady = null;
            throw new Error(`yt-dlp setup failed: ${error.message}`);
        });
    }
    await binaryReady;
    return ytDlp;
};

const runDownload = async (binary, args, extraEnv = {}) => {
    try {
        return await execFileAsync(binary, [...jsRuntimeArg(), ...args], {
            maxBuffer: 1024 * 1024 * 8,
            env: {
                ...process.env,
                PATH: `${path.dirname(ffmpegPath)}:${process.env.PATH || ''}`,
                FFmpeg_BINARY: ffmpegPath,
                FFprobe_BINARY: ffprobePath,
                ...extraEnv
            }
        });
    } catch (error) {
        const detail = error.stderr?.trim() || error.message || 'Unknown yt-dlp error';
        throw new Error(detail);
    }
};

// Download media with yt-dlp and send it through the bot socket.
const download = async (target, kind) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rebel-media-'));
    const outputTemplate = path.join(tempDir, '%(id)s.%(ext)s');
    const format = kind === 'audio' ? 'bestaudio/best' : 'best[height<=720]/best';
    const buildArgs = selectedFormat => [
        '--no-playlist',
        '--extractor-args', 'youtube:player_client=android',
        '--format', selectedFormat,
        '--max-filesize', '50M',
        '--compat-options', 'no-youtube-unavailable-videos',
        '--output', outputTemplate,
        '--print', 'after_move:filepath',
        target
    ];
    try {
        const binary = (await getYtDlp()).getBinaryPath();
        let result;
        try {
            result = await runDownload(binary, buildArgs(format));
        } catch (error) {
            if (kind !== 'video' || !/format is not available|requested format/i.test(error.message)) {
                throw error;
            }
            result = await runDownload(binary, buildArgs('best'));
        }
        const stdout = result.stdout;
        const filePath = stdout.trim().split('\n').filter(Boolean).pop();
        if (!filePath || !fs.existsSync(filePath)) throw new Error('Downloaded file was not found.');
        return { tempDir, filePath };
    } catch (error) {
        fs.rmSync(tempDir, { recursive: true, force: true });
        throw error;
    }
};

const downloadThumbnail = url => new Promise((resolve, reject) => {
    if (!/^https?:\/\//i.test(url || '')) return resolve(null);
    const request = https.get(url, response => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            response.resume();
            return downloadThumbnail(response.headers.location).then(resolve, reject);
        }
        if (response.statusCode !== 200) {
            response.resume();
            return resolve(null);
        }
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks)));
        response.on('error', reject);
    });
    request.setTimeout(10000, () => {
        request.destroy();
        resolve(null);
    });
    request.on('error', () => resolve(null));
});

const getMediaInfo = async (binary, target) => {
    try {
        const result = await runDownload(binary, [
            '--no-playlist',
            '--skip-download',
            '--dump-single-json',
            '--extractor-args', 'youtube:player_client=android',
            '--compat-options', 'no-youtube-unavailable-videos',
            target
        ]);
        const info = JSON.parse(result.stdout);
        return {
            title: info.title || target,
            thumbnail: info.thumbnail || null
        };
    } catch (error) {
        console.error('Media info error:', error.message);
        return { title: target, thumbnail: null };
    }
};

const sendDownloaded = async ({ sock, m, reply, target, kind }) => {
    let downloadResult;
    try {
        const binary = (await getYtDlp()).getBinaryPath();
        const info = await getMediaInfo(binary, target);
        const thumbnail = await downloadThumbnail(info.thumbnail);
        const waitingText = `🎵 ${info.title}\n\nMere bachy, thora dhairye rakho download honay tak...`;
        if (thumbnail) {
            await sock.sendMessage(m.key.remoteJid, {
                image: thumbnail,
                caption: waitingText,
                mimetype: 'image/jpeg'
            }, { quoted: m });
        } else {
            await reply(waitingText);
        }
        downloadResult = await download(target, kind);
        const buffer = fs.readFileSync(downloadResult.filePath);
        const payload = kind === 'audio' ? { audio: buffer, mimetype: 'audio/ogg; codecs=opus', ptt: false } : { video: buffer, mimetype: 'video/mp4' };
        await sock.sendMessage(m.key.remoteJid, payload, { quoted: m });
    } catch (error) {
        console.error(`${kind} download error:`, error.message);
        await reply(`Download nahi ho saka: ${error.message}`);
    } finally {
        if (downloadResult?.tempDir) fs.rmSync(downloadResult.tempDir, { recursive: true, force: true });
    }
};

const isUrl = value => /^https?:\/\//i.test(value);
const isPlatformUrl = (value, platform) => {
    try {
        const hostname = new URL(value).hostname.toLowerCase();
        return platform.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
    } catch (e) { return false; }
};

module.exports = { sendDownloaded, isUrl, isPlatformUrl };