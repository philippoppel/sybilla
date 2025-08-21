const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Configuration
const SECRET_KEY = process.env.SECRET_KEY;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS;

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

function sanitizeContent(content) {
    const sanitized = JSON.parse(JSON.stringify(content));
    
    function cleanString(str) {
        if (typeof str !== 'string') return str;
        return str.replace(/<script[^>]*>.*?<\/script>/gi, '')
                 .replace(/javascript:/gi, '')
                 .replace(/on\w+\s*=/gi, '');
    }
    
    function recursiveClean(obj) {
        for (const key in obj) {
            if (typeof obj[key] === 'string') {
                obj[key] = cleanString(obj[key]);
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                recursiveClean(obj[key]);
            }
        }
    }
    
    recursiveClean(sanitized);
    return sanitized;
}

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'GET') {
        if (!authenticate(req)) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        try {
            const contentPath = path.join(process.cwd(), 'content.json');
            const content = await fs.readFile(contentPath, 'utf8');
            res.json(JSON.parse(content));
        } catch (error) {
            console.error('Error reading content:', error);
            res.status(500).json({ error: 'Could not read content' });
        }
    }
    
    else if (req.method === 'POST') {
        if (!authenticate(req)) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        try {
            const newContent = sanitizeContent(req.body);
            
            // Validate content structure
            if (!newContent.site || !newContent.hero || !newContent.about) {
                return res.status(400).json({ error: 'Invalid content structure' });
            }
            
            // Backup current content
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const contentPath = path.join(process.cwd(), 'content.json');
            
            try {
                const currentContent = await fs.readFile(contentPath, 'utf8');
                const backupPath = path.join(process.cwd(), `content-backup-${timestamp}.json`);
                await fs.writeFile(backupPath, currentContent);
            } catch (backupError) {
                console.warn('Could not create backup:', backupError);
            }
            
            // Write new content
            await fs.writeFile(contentPath, JSON.stringify(newContent, null, 2));
            
            res.json({ 
                success: true, 
                message: 'Content updated successfully',
                timestamp: timestamp
            });
            
        } catch (error) {
            console.error('Error updating content:', error);
            res.status(500).json({ error: 'Could not update content' });
        }
    }
    
    else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}