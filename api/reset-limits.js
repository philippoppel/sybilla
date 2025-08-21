export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // This will reset rate limiting by restarting the serverless function
    // (Rate limiter is stored in memory, so it gets reset on each cold start)
    
    res.json({
        success: true,
        message: 'Rate limits will reset on next serverless function restart',
        timestamp: new Date().toISOString()
    });
}