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
    const windowMs = 15 * 60 * 1000; // 15 minutes
    const maxRequests = 5;

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

    // Rate limiting
    if (!rateLimit(req)) {
        return res.status(429).json({ error: 'Too many requests' });
    }

    const { username, password } = req.body;
    
    // Input validation
    if (!username || !password || username.length > 50 || password.length > 100) {
        return res.status(400).json({ error: 'Invalid input' });
    }
    
    // Debug logging
    console.log('Auth attempt:', { 
        username, 
        password: password ? 'PROVIDED' : 'MISSING',
        ADMIN_USER,
        ADMIN_PASS: ADMIN_PASS ? 'SET' : 'MISSING',
        SECRET_KEY: SECRET_KEY ? 'SET' : 'MISSING'
    });
    
    if (username === ADMIN_USER && password === ADMIN_PASS) {
        // Create secure token with HMAC signature
        const timestamp = Date.now();
        const payload = Buffer.from(`${username}:${password}:${timestamp}`).toString('base64url');
        const signature = crypto
            .createHmac('sha256', SECRET_KEY)
            .update(payload)
            .digest('base64url');
        const token = `${payload}.${signature}`;
        
        res.json({
            success: true,
            token: token,
            user: username,
            expiresIn: '2h'
        });
    } else {
        // Add delay to prevent brute force
        await new Promise(resolve => setTimeout(resolve, 1000));
        res.status(401).json({ error: 'Invalid credentials' });
    }
}