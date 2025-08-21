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
            // In serverless, read from the bundled content
            const content = require('../content.json');
            res.json(content);
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
            
            // In serverless environment, we can't write files
            // Instead, we'll return the content for client-side handling
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            
            // For now, just return success - actual file writing needs to be done differently
            console.log('Content update requested:', { timestamp, contentKeys: Object.keys(newContent) });
            
            res.json({ 
                success: true, 
                message: 'Content validated and ready for update',
                timestamp: timestamp,
                note: 'Serverless environment - content update requires deployment'
            });
            
        } catch (error) {
            console.error('Error processing content:', error);
            res.status(500).json({ error: 'Could not process content update' });
        }
    }
    
    else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}