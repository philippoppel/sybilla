export default async function handler(req, res) {
    // Only allow in development or for specific debug requests
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Debug info (mask sensitive data)
    res.json({
        env: {
            NODE_ENV: process.env.NODE_ENV,
            ADMIN_USER: process.env.ADMIN_USER || 'NOT_SET',
            ADMIN_PASS_LENGTH: process.env.ADMIN_PASS ? process.env.ADMIN_PASS.length : 0,
            ADMIN_PASS_FIRST_CHAR: process.env.ADMIN_PASS ? process.env.ADMIN_PASS[0] : 'N/A',
            SECRET_KEY_LENGTH: process.env.SECRET_KEY ? process.env.SECRET_KEY.length : 0,
            GIT_ENABLED: process.env.GIT_ENABLED
        },
        timestamp: new Date().toISOString()
    });
}