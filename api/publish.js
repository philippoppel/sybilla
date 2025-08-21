const { exec } = require('child_process');
const crypto = require('crypto');

// Configuration
const SECRET_KEY = process.env.SECRET_KEY;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS;
const GIT_ENABLED = process.env.GIT_ENABLED === 'true';

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
        
        // Verify signature
        const expectedSignature = crypto
            .createHmac('sha256', SECRET_KEY)
            .update(payload)
            .digest('base64url');
            
        if (signature !== expectedSignature) {
            return false;
        }
        
        const decoded = Buffer.from(payload, 'base64url').toString();
        const [username, password, timestamp] = decoded.split(':');
        
        // Check credentials and timestamp
        if (username !== ADMIN_USER || password !== ADMIN_PASS) {
            return false;
        }
        
        if (Date.now() - parseInt(timestamp) > 2 * 60 * 60 * 1000) {
            return false;
        }
        
        return true;
    } catch (error) {
        return false;
    }
}

async function executeGitCommands(message) {
    return new Promise((resolve, reject) => {
        const commands = [
            'git add .',
            `git commit -m "${message}"`,
            'git push origin master'
        ];
        
        const fullCommand = commands.join(' && ');
        
        exec(fullCommand, { cwd: process.cwd() }, (error, stdout, stderr) => {
            if (error) {
                console.error('Git error:', error);
                reject(error);
            } else {
                console.log('Git output:', stdout);
                resolve(stdout);
            }
        });
    });
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
        const { message = 'Update content via admin panel' } = req.body;
        
        // In serverless environment, Git is not available
        // Publishing needs to be handled differently
        res.json({ 
            success: true, 
            message: 'Content changes noted. In serverless environment, publishing requires manual deployment or webhook integration.',
            deployed: false,
            note: 'Serverless limitation: Git commands not available. Consider using GitHub API or webhooks for automated publishing.'
        });
        
    } catch (error) {
        console.error('Error in publish endpoint:', error);
        res.status(500).json({ 
            error: 'Could not process publish request', 
            details: error.message 
        });
    }
}