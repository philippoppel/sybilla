export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // Debug environment variables
    const envDebug = {
        SECRET_KEY: !!process.env.SECRET_KEY,
        ADMIN_USER: process.env.ADMIN_USER || 'not_set',
        ADMIN_PASS: !!process.env.ADMIN_PASS,
        NODE_ENV: process.env.NODE_ENV,
        env_count: Object.keys(process.env).length
    };
    
    if (req.method === 'GET') {
        return res.status(200).json({
            debug: 'Environment variables status',
            ...envDebug,
            timestamp: new Date().toISOString()
        });
    }
    
    if (req.method === 'POST') {
        const { username, password } = req.body || {};
        
        const result = {
            debug: 'Authentication debug',
            env: envDebug,
            request: {
                username_provided: !!username,
                password_provided: !!password,
                body_type: typeof req.body,
                body_exists: !!req.body
            },
            comparison: {
                user_match: username === (process.env.ADMIN_USER || 'admin'),
                expected_user: process.env.ADMIN_USER || 'admin',
                provided_user: username
            },
            timestamp: new Date().toISOString()
        };
        
        // Test login
        if (username === 'admin' && password === 'TestPassword123!') {
            return res.status(200).json({
                success: true,
                token: 'debug_token_' + Date.now(),
                user: username,
                debug: result
            });
        }
        
        return res.status(401).json({
            error: 'Invalid credentials',
            debug: result
        });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
}