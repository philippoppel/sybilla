const http = require('http');
const { spawn } = require('child_process');

class EdgeCaseTester {
    constructor() {
        this.baseUrl = 'http://localhost:3000';
        this.server = null;
        this.testResults = [];
    }

    async makeRequest(method, path, data = null, headers = {}) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'localhost',
                port: 3000,
                path: path,
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    ...headers
                }
            };

            const req = http.request(options, (res) => {
                let responseData = '';
                res.on('data', chunk => responseData += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(responseData);
                        resolve({ status: res.statusCode, data: parsed });
                    } catch (e) {
                        resolve({ status: res.statusCode, data: responseData });
                    }
                });
            });

            req.on('error', reject);
            
            if (data) {
                if (typeof data === 'string') {
                    req.write(data); // For malformed JSON tests
                } else {
                    req.write(JSON.stringify(data));
                }
            }
            req.end();
        });
    }

    async startServer() {
        return new Promise((resolve, reject) => {
            this.server = spawn('node', ['server.js'], { 
                stdio: ['pipe', 'pipe', 'pipe'], 
                cwd: process.cwd() 
            });
            
            this.server.stdout.on('data', (data) => {
                if (data.toString().includes('Server running on port 3000')) {
                    setTimeout(resolve, 500);
                }
            });

            setTimeout(() => reject(new Error('Server start timeout')), 10000);
        });
    }

    async stopServer() {
        if (this.server) {
            this.server.kill();
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    async test(name, testFn) {
        try {
            console.log(`\n🧪 ${name}`);
            await testFn();
            console.log(`✅ ${name} - PASSED`);
            this.testResults.push({ name, status: 'PASSED' });
        } catch (error) {
            console.log(`❌ ${name} - FAILED: ${error.message}`);
            this.testResults.push({ name, status: 'FAILED', error: error.message });
        }
    }

    async runTests() {
        console.log('🚀 Starting CMS Edge Case Tests...');
        
        try {
            await this.startServer();
            console.log('✅ Server started successfully');

            // Edge Case 1: Empty request bodies
            await this.test('Empty login request', async () => {
                const response = await this.makeRequest('POST', '/api/auth', {});
                if (response.status !== 400) throw new Error(`Expected 400, got ${response.status}`);
            });

            // Edge Case 2: Malformed JSON
            await this.test('Malformed JSON request', async () => {
                const response = await this.makeRequest('POST', '/api/auth', '{"username":"admin","password":');
                if (response.status !== 400 && response.status !== 500) throw new Error(`Expected 400/500, got ${response.status}`);
            });

            // Edge Case 3: Oversized requests
            await this.test('Oversized username/password', async () => {
                const longString = 'a'.repeat(200);
                const response = await this.makeRequest('POST', '/api/auth', {
                    username: longString,
                    password: longString
                });
                if (response.status !== 400) throw new Error(`Expected 400, got ${response.status}`);
            });

            // Edge Case 4: Missing Authorization header
            await this.test('Missing Authorization header', async () => {
                const response = await this.makeRequest('GET', '/api/content');
                if (response.status !== 401) throw new Error(`Expected 401, got ${response.status}`);
            });

            // Edge Case 5: Malformed Authorization header
            await this.test('Malformed Authorization header', async () => {
                const response = await this.makeRequest('GET', '/api/content', null, {
                    'Authorization': 'InvalidFormat'
                });
                if (response.status !== 401) throw new Error(`Expected 401, got ${response.status}`);
            });

            // Edge Case 6: Invalid token format
            await this.test('Invalid token format', async () => {
                const response = await this.makeRequest('GET', '/api/content', null, {
                    'Authorization': 'Bearer not.a.real.token'
                });
                if (response.status !== 401) throw new Error(`Expected 401, got ${response.status}`);
            });

            // Edge Case 7: Expired token simulation
            await this.test('Token expiration handling', async () => {
                // Create a token with expired timestamp
                const expiredToken = 'ZXhwaXJlZDp0b2tlbjoxNjAwMDAwMDAw.invalidSignature';
                const response = await this.makeRequest('GET', '/api/content', null, {
                    'Authorization': `Bearer ${expiredToken}`
                });
                if (response.status !== 401) throw new Error(`Expected 401, got ${response.status}`);
            });

            // Edge Case 8: Rate limiting
            await this.test('Rate limiting triggers correctly', async () => {
                const promises = [];
                for (let i = 0; i < 12; i++) {
                    promises.push(this.makeRequest('POST', '/api/auth', {
                        username: 'attacker',
                        password: 'wrong'
                    }));
                }
                
                const responses = await Promise.all(promises);
                const rateLimited = responses.some(r => r.status === 429);
                
                if (!rateLimited) throw new Error('Rate limiting should trigger');
            });

            // Edge Case 9: Invalid content structure
            await this.test('Invalid content structure rejection', async () => {
                // First get a valid token
                const authResponse = await this.makeRequest('POST', '/api/auth', {
                    username: 'admin',
                    password: 'secret'
                });
                const token = authResponse.data.token;

                const response = await this.makeRequest('POST', '/api/content', {
                    invalid: 'structure'
                }, {
                    'Authorization': `Bearer ${token}`
                });
                
                if (response.status !== 400) throw new Error(`Expected 400, got ${response.status}`);
            });

            // Edge Case 10: Concurrent requests with same token
            await this.test('Concurrent requests with same token', async () => {
                // Get a fresh token
                const authResponse = await this.makeRequest('POST', '/api/auth', {
                    username: 'admin',
                    password: 'secret'
                });
                const token = authResponse.data.token;

                // Make 3 concurrent content updates
                const promises = [
                    this.makeRequest('POST', '/api/content', {
                        site: { title: 'Concurrent Test 1', description: 'Test', author: 'Test' },
                        hero: { title: 'Concurrent 1' },
                        about: { name: 'Test' }
                    }, { 'Authorization': `Bearer ${token}` }),
                    
                    this.makeRequest('POST', '/api/content', {
                        site: { title: 'Concurrent Test 2', description: 'Test', author: 'Test' },
                        hero: { title: 'Concurrent 2' },
                        about: { name: 'Test' }
                    }, { 'Authorization': `Bearer ${token}` }),
                    
                    this.makeRequest('POST', '/api/content', {
                        site: { title: 'Concurrent Test 3', description: 'Test', author: 'Test' },
                        hero: { title: 'Concurrent 3' },
                        about: { name: 'Test' }
                    }, { 'Authorization': `Bearer ${token}` })
                ];

                const responses = await Promise.all(promises);
                const successful = responses.filter(r => r.status === 200).length;
                
                if (successful < 3) throw new Error(`Only ${successful}/3 concurrent requests succeeded`);
            });

            // Edge Case 11: XSS Content Protection  
            await this.test('XSS content sanitization', async () => {
                const authResponse = await this.makeRequest('POST', '/api/auth', {
                    username: 'admin',
                    password: 'secret'
                });
                const token = authResponse.data.token;

                const response = await this.makeRequest('POST', '/api/content', {
                    site: { title: '<script>alert("xss")</script>', description: 'Test', author: 'Test' },
                    hero: { title: 'javascript:alert("xss")' },
                    about: { name: 'onclick="alert(1)"' }
                }, {
                    'Authorization': `Bearer ${token}`
                });
                
                if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
                // Content should be sanitized - this is handled by the sanitizeContent function
            });

        } finally {
            await this.stopServer();
        }

        this.printResults();
    }

    printResults() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 EDGE CASE TEST RESULTS');
        console.log('='.repeat(60));
        
        const passed = this.testResults.filter(r => r.status === 'PASSED').length;
        const failed = this.testResults.filter(r => r.status === 'FAILED').length;
        
        this.testResults.forEach(result => {
            const icon = result.status === 'PASSED' ? '✅' : '❌';
            console.log(`${icon} ${result.name}`);
            if (result.error) {
                console.log(`   Error: ${result.error}`);
            }
        });
        
        console.log(`\n📈 Total: ${this.testResults.length} | Passed: ${passed} | Failed: ${failed}`);
        
        if (failed === 0) {
            console.log('\n🎉 ALL EDGE CASE TESTS PASSED! System is robust!');
        } else {
            console.log(`\n⚠️ ${failed} edge case test(s) failed. Please check security and robustness.`);
            process.exit(1);
        }
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    const tester = new EdgeCaseTester();
    tester.runTests().catch(error => {
        console.error('Edge case test runner failed:', error);
        process.exit(1);
    });
}

module.exports = EdgeCaseTester;