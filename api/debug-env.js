module.exports = (req, res) => {
    // Security check - only allow in development or with secret param
    const isDev = process.env.NODE_ENV !== 'production';
    const hasDebugSecret = req.query.secret === 'debug123';
    
    if (!isDev && !hasDebugSecret) {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    const ADMIN_USER = process.env.ADMIN_USER;
    const ADMIN_PASS = process.env.ADMIN_PASS;
    const SECRET_KEY = process.env.SECRET_KEY;
    
    // Test authentication with provided credentials
    const testUser = req.query.user || 'admin';
    const testPass = req.query.pass || 'CMS2024!Secure';
    
    const envVars = {
        NODE_ENV: process.env.NODE_ENV,
        ADMIN_USER: ADMIN_USER,
        ADMIN_PASS: ADMIN_PASS ? '[SET]' : '[NOT SET]',
        SECRET_KEY: SECRET_KEY ? '[SET]' : '[NOT SET]',
        ADMIN_PASS_LENGTH: ADMIN_PASS ? ADMIN_PASS.length : 0,
        SECRET_KEY_LENGTH: SECRET_KEY ? SECRET_KEY.length : 0,
        // Test auth logic
        expectedUser: ADMIN_USER,
        expectedPass: ADMIN_PASS || 'secret',
        actualPass: ADMIN_PASS,
        testCredentials: {
            inputUser: testUser,
            inputPass: testPass,
            userMatch: testUser === ADMIN_USER,
            passMatch: testPass === (ADMIN_PASS || 'secret'),
            bothMatch: testUser === ADMIN_USER && testPass === (ADMIN_PASS || 'secret'),
            fallbackUsed: !ADMIN_PASS
        },
        rawValues: {
            ADMIN_USER_RAW: JSON.stringify(ADMIN_USER),
            ADMIN_PASS_RAW: ADMIN_PASS ? JSON.stringify(ADMIN_PASS.substring(0,5) + '...') : 'null',
            SECRET_KEY_RAW: SECRET_KEY ? JSON.stringify(SECRET_KEY.substring(0,3) + '...') : 'null'
        }
    };
    
    res.json(envVars);
};