const crypto = require('crypto');

const SECRET_KEY = process.env.SECRET_KEY;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'philippoppel/sybilla-website';

function authenticate(req) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
        return false;
    }

    const token = auth.slice(7);

    try {
        const [payload, signature] = token.split('.');
        if (!payload || !signature) {
            return false;
        }

        const expectedSignature = crypto
            .createHmac('sha256', SECRET_KEY)
            .update(payload)
            .digest('base64url');

        if (signature !== expectedSignature) {
            return false;
        }

        const decoded = Buffer.from(payload, 'base64url').toString();
        const [username, password, timestamp] = decoded.split(':');

        if (!username || !password || !timestamp) {
            return false;
        }

        if (username !== ADMIN_USER) {
            return false;
        }

        const expectedPass = ADMIN_PASS || 'secret';
        if (password !== expectedPass) {
            return false;
        }

        if (Date.now() - parseInt(timestamp, 10) > 2 * 60 * 60 * 1000) {
            return false;
        }

        return true;
    } catch (error) {
        return false;
    }
}

function sanitizeFilename(filename, type) {
    const baseName = filename.replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase();
    const ext = baseName.includes('.') ? baseName.substring(baseName.lastIndexOf('.')) : '.png';
    const safeType = type && typeof type === 'string' ? type.replace(/[^a-z0-9_-]/gi, '') : 'upload';
    return `${safeType}-${Date.now()}${ext}`;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!authenticate(req)) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    if (!SECRET_KEY || !ADMIN_PASS) {
        return res.status(500).json({ error: 'Server configuration error' });
    }

    if (!GITHUB_TOKEN) {
        return res.status(501).json({
            error: 'GitHub integration required',
            message: 'Set GITHUB_TOKEN to enable image uploads on Vercel'
        });
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { image, filename, type } = body || {};

        if (!image || !filename) {
            return res.status(400).json({ error: 'Image and filename required' });
        }

        if (!image.startsWith('data:image/')) {
            return res.status(400).json({ error: 'Invalid image format' });
        }

        const base64Data = image.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        if (buffer.length > 10 * 1024 * 1024) {
            return res.status(400).json({ error: 'Image too large (max 10MB)' });
        }

        const safeName = sanitizeFilename(filename, type);
        const uploadPath = `uploads/${safeName}`;

        const updateUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${uploadPath}`;
        const message = `Upload ${type || 'image'} via admin panel`;

        const getResponse = await fetch(updateUrl, {
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Sybilla-CMS'
            }
        });

        let sha = undefined;
        if (getResponse.ok) {
            const existing = await getResponse.json();
            sha = existing.sha;
        }

        const payload = {
            message,
            content: buffer.toString('base64'),
            sha
        };

        const updateResponse = await fetch(updateUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Sybilla-CMS',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!updateResponse.ok) {
            const errorData = await updateResponse.json().catch(() => ({}));
            throw new Error(errorData.message || 'GitHub upload failed');
        }

        await updateResponse.json();

        res.json({
            success: true,
            filename: safeName,
            url: `/${uploadPath}`
        });
    } catch (error) {
        console.error('Upload error (serverless):', error);
        res.status(500).json({ error: 'Could not upload image', details: error.message });
    }
}
