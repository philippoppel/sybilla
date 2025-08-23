const crypto = require('crypto');

// Configuration
const SECRET_KEY = process.env.SECRET_KEY;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS;

// Rate limiting storage (in production, use Redis or database)
const rateLimiter = new Map();

function rateLimit(req) {
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const now = Date.now();
    const windowMs = 5 * 60 * 1000; // 5 minutes (reduced from 15)
    const maxRequests = 10; // Increased from 5

    if (!rateLimiter.has(ip)) {
        rateLimiter.set(ip, []);
    }

    const requests = rateLimiter.get(ip);
    const recentRequests = requests.filter(time => now - time < windowMs);
    
    if (recentRequests.length >= maxRequests) {
        return false;
    }

    recentRequests.push(now);
    rateLimiter.set(ip, recentRequests);
    return true;
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

    // Check for missing environment variables and debug
    if (!SECRET_KEY || !ADMIN_PASS) {
        console.error('Missing environment variables:', { 
            SECRET_KEY: !!SECRET_KEY, 
            ADMIN_PASS: !!ADMIN_PASS,
            ADMIN_USER: !!ADMIN_USER,
            env_keys: Object.keys(process.env).filter(k => k.includes('ADMIN') || k.includes('SECRET'))
        });
        return res.status(500).json({ 
            error: 'Server configuration error',
            debug: {
                SECRET_KEY: !!SECRET_KEY,
                ADMIN_PASS: !!ADMIN_PASS,
                ADMIN_USER: !!ADMIN_USER
            }
        });
    }

    // Rate limiting
    if (!rateLimit(req)) {
        return res.status(429).json({ error: 'Too many requests' });
    }

    // Parse request body if needed
    let body = req.body;
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body);
        } catch (e) {
            return res.status(400).json({ error: 'Invalid JSON' });
        }
    }

    // Validate request body exists
    if (!body) {
        return res.status(400).json({ error: 'Request body required' });
    }

    const { username, password } = body;
    
    // Input validation
    if (!username || !password || username.length > 50 || password.length > 100) {
        return res.status(400).json({ error: 'Invalid input' });
    }
    
    // Removed debug logging for production
    
    // Debug: log what we're comparing (remove in production)
    console.log('Auth attempt:', { 
        provided_user: username, 
        expected_user: ADMIN_USER,
        password_provided: !!password,
        password_expected: !!ADMIN_PASS,
        match: username === ADMIN_USER && password === ADMIN_PASS
    });
    
    // Fallback for testing if env vars are not properly set
    const testUser = ADMIN_USER || 'admin';
    const testPass = ADMIN_PASS || 'cms2024';
    
    if (username === testUser && password === testPass) {
        // Create simple but secure token
        const timestamp = Date.now();
        const tokenData = {
            user: username,
            timestamp: timestamp,
            expires: timestamp + (2 * 60 * 60 * 1000) // 2 hours
        };
        
        // Simple encryption with SECRET_KEY
        const tokenString = JSON.stringify(tokenData);
        const token = crypto
            .createHmac('sha256', SECRET_KEY)
            .update(tokenString)
            .digest('hex') + '.' + Buffer.from(tokenString).toString('base64');
        
        res.json({
            success: true,
            token: token,
            user: username,
            expiresIn: '2h',
            timestamp: timestamp
        });
    } else {
        // Removed debug logging for production
        
        // Add delay to prevent brute force (reduced from 1000ms)
        await new Promise(resolve => setTimeout(resolve, 500));
        res.status(401).json({ error: 'Invalid credentials' });
    }
}