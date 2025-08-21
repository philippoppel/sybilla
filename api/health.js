export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method === 'GET') {
        res.json({ 
            status: 'ok', 
            timestamp: new Date().toISOString(),
            env: process.env.NODE_ENV || 'development'
        });
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}