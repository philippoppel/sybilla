const crypto = require('crypto');

// Configuration
const SECRET_KEY = process.env.SECRET_KEY;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'philippoppel/sybilla';

function authenticate(req) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
        return false;
    }

    const token = auth.slice(7);
    
    try {
        const [signature, payload] = token.split('.');
        if (!signature || !payload) {
            return false;
        }
        
        // Decode the token data
        const tokenString = Buffer.from(payload, 'base64').toString();
        const tokenData = JSON.parse(tokenString);
        
        // Verify signature
        const expectedSignature = crypto
            .createHmac('sha256', SECRET_KEY)
            .update(tokenString)
            .digest('hex');
            
        if (signature !== expectedSignature) {
            return false;
        }
        
        // Check if token is expired
        if (Date.now() > tokenData.expires) {
            return false;
        }
        
        // Check user
        if (tokenData.user !== ADMIN_USER) {
            return false;
        }
        
        return true;
    } catch (error) {
        return false;
    }
}

export default async function handler(req, res) {
    // CORS headers
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
    
    try {
        const { content, message = 'Update content via admin panel' } = req.body;
        
        if (!GITHUB_TOKEN) {
            return res.json({
                success: false,
                message: 'GitHub integration not configured. Please add GITHUB_TOKEN environment variable.',
                action: 'manual'
            });
        }
        
        // Update content.json via GitHub API
        const updateUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/content.json`;
        
        // First, get the current file SHA
        const currentFileResponse = await fetch(updateUrl, {
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Sybilla-CMS'
            }
        });
        
        if (!currentFileResponse.ok) {
            throw new Error(`GitHub API error: ${currentFileResponse.status}`);
        }
        
        const currentFile = await currentFileResponse.json();
        
        // Update the file
        const updateData = {
            message,
            content: Buffer.from(JSON.stringify(content, null, 2)).toString('base64'),
            sha: currentFile.sha
        };
        
        const updateResponse = await fetch(updateUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Sybilla-CMS',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });
        
        if (!updateResponse.ok) {
            const errorData = await updateResponse.json();
            throw new Error(`GitHub update failed: ${errorData.message}`);
        }
        
        const result = await updateResponse.json();
        
        res.json({
            success: true,
            message: 'Content successfully published to GitHub! Vercel will auto-deploy shortly.',
            deployed: true,
            github: {
                commit: result.commit.sha,
                url: result.commit.html_url
            }
        });
        
    } catch (error) {
        console.error('Error publishing to GitHub:', error);
        res.status(500).json({ 
            error: 'Could not publish content to GitHub', 
            details: error.message 
        });
    }
}