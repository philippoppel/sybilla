// Simple Node.js server for content management and auto-deploy
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const crypto = require('crypto');
const app = express();

// Configuration
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || 'your-secret-key-here';
const GIT_ENABLED = process.env.GIT_ENABLED === 'true';

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.static('.'));

// Rate limiting for admin endpoints
const rateLimiter = new Map();

function rateLimit(req, res, next) {
    const ip = req.ip;
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    const maxRequests = 10;

    if (!rateLimiter.has(ip)) {
        rateLimiter.set(ip, []);
    }

    const requests = rateLimiter.get(ip);
    const recentRequests = requests.filter(time => now - time < windowMs);
    
    if (recentRequests.length >= maxRequests) {
        return res.status(429).json({ error: 'Too many requests' });
    }

    recentRequests.push(now);
    rateLimiter.set(ip, recentRequests);
    next();
}

// Authentication middleware
function authenticate(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const token = auth.slice(7);
    
    try {
        // Simple token validation (in production, use proper JWT)
        const decoded = Buffer.from(token, 'base64').toString();
        const [username, password, timestamp] = decoded.split(':');
        
        // Check credentials
        if (username !== 'sybilla' || password !== 'secret') {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Check timestamp (2 hour expiry)
        if (Date.now() - parseInt(timestamp) > 2 * 60 * 60 * 1000) {
            return res.status(401).json({ error: 'Token expired' });
        }
        
        req.user = username;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}

// Utility functions
function sanitizeContent(content) {
    // Basic content sanitization
    const sanitized = JSON.parse(JSON.stringify(content));
    
    // Remove any potential script injections
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

async function executeGitCommands(message) {
    return new Promise((resolve, reject) => {
        const commands = [
            'git add .',
            `git commit -m "${message}"`,
            'git push origin master'
        ];
        
        const fullCommand = commands.join(' && ');
        
        exec(fullCommand, { cwd: __dirname }, (error, stdout, stderr) => {
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

// Routes

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Authentication endpoint
app.post('/api/auth', rateLimit, (req, res) => {
    const { username, password } = req.body;
    
    if (username === 'sybilla' && password === 'secret') {
        // Create simple token
        const timestamp = Date.now();
        const tokenData = `${username}:${password}:${timestamp}`;
        const token = Buffer.from(tokenData).toString('base64');
        
        res.json({
            success: true,
            token: token,
            user: username,
            expiresIn: '2h'
        });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// Get current content
app.get('/api/content', authenticate, async (req, res) => {
    try {
        const content = await fs.readFile('content.json', 'utf8');
        res.json(JSON.parse(content));
    } catch (error) {
        console.error('Error reading content:', error);
        res.status(500).json({ error: 'Could not read content' });
    }
});

// Update content
app.post('/api/content', authenticate, rateLimit, async (req, res) => {
    try {
        const newContent = sanitizeContent(req.body);
        
        // Validate content structure
        if (!newContent.site || !newContent.hero || !newContent.about) {
            return res.status(400).json({ error: 'Invalid content structure' });
        }
        
        // Backup current content
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        try {
            const currentContent = await fs.readFile('content.json', 'utf8');
            await fs.writeFile(`content-backup-${timestamp}.json`, currentContent);
        } catch (backupError) {
            console.warn('Could not create backup:', backupError);
        }
        
        // Write new content
        await fs.writeFile('content.json', JSON.stringify(newContent, null, 2));
        
        res.json({ 
            success: true, 
            message: 'Content updated successfully',
            timestamp: timestamp
        });
        
    } catch (error) {
        console.error('Error updating content:', error);
        res.status(500).json({ error: 'Could not update content' });
    }
});

// Publish content (commit and deploy)
app.post('/api/publish', authenticate, rateLimit, async (req, res) => {
    try {
        const { message = 'Update content via admin panel' } = req.body;
        
        if (GIT_ENABLED) {
            await executeGitCommands(message);
            res.json({ 
                success: true, 
                message: 'Content published and deployed successfully',
                deployed: true
            });
        } else {
            res.json({ 
                success: true, 
                message: 'Content updated (Git deployment disabled)',
                deployed: false
            });
        }
        
    } catch (error) {
        console.error('Error publishing:', error);
        res.status(500).json({ 
            error: 'Could not publish content', 
            details: error.message 
        });
    }
});

// Upload image endpoint
app.post('/api/upload', authenticate, rateLimit, async (req, res) => {
    try {
        const { image, filename, type } = req.body;
        
        if (!image || !filename) {
            return res.status(400).json({ error: 'Image and filename required' });
        }
        
        // Validate image format
        if (!image.startsWith('data:image/')) {
            return res.status(400).json({ error: 'Invalid image format' });
        }
        
        // Extract image data
        const base64Data = image.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Validate file size (max 10MB)
        if (buffer.length > 10 * 1024 * 1024) {
            return res.status(400).json({ error: 'Image too large (max 10MB)' });
        }
        
        // Generate safe filename
        const ext = path.extname(filename);
        const safeName = `${type}-${Date.now()}${ext}`;
        const filePath = path.join(__dirname, safeName);
        
        await fs.writeFile(filePath, buffer);
        
        res.json({
            success: true,
            filename: safeName,
            url: `/${safeName}`
        });
        
    } catch (error) {
        console.error('Error uploading image:', error);
        res.status(500).json({ error: 'Could not upload image' });
    }
});

// Get deployment status
app.get('/api/status', authenticate, (req, res) => {
    res.json({
        server: 'running',
        git: GIT_ENABLED,
        timestamp: new Date().toISOString(),
        user: req.user
    });
});

// Error handling
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Git deployment: ${GIT_ENABLED ? 'enabled' : 'disabled'}`);
    console.log(`Admin panel: http://localhost:${PORT}/admin.html`);
});

module.exports = app;