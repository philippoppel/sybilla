const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs').promises;

class APITester {
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
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        resolve({ status: res.statusCode, data: parsed, headers: res.headers });
                    } catch (e) {
                        resolve({ status: res.statusCode, data: data, headers: res.headers });
                    }
                });
            });

            req.on('error', reject);
            
            if (data) {
                req.write(JSON.stringify(data));
            }
            req.end();
        });
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

    async startServer() {
        return new Promise((resolve, reject) => {
            this.server = spawn('node', ['server.js'], { 
                stdio: ['pipe', 'pipe', 'pipe'], 
                cwd: process.cwd() 
            });
            
            this.server.stdout.on('data', (data) => {
                if (data.toString().includes('Server running on port 3000')) {
                    setTimeout(resolve, 500); // Give server time to start
                }
            });

            this.server.stderr.on('data', (data) => {
                console.error(`Server error: ${data}`);
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

    async runTests() {
        console.log('🚀 Starting CMS API Tests...');
        
        try {
            await this.startServer();
            console.log('✅ Server started successfully');

            // Backup original content
            await this.backupContent();

            // Session Management Tests
            await this.test('Authentication with correct credentials', async () => {
                const response = await this.makeRequest('POST', '/api/auth', {
                    username: 'admin',
                    password: 'secret'
                });
                
                if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
                if (!response.data.success) throw new Error('Login should succeed');
                if (!response.data.token) throw new Error('Token should be provided');
                
                this.validToken = response.data.token;
            });

            await this.test('Authentication with wrong credentials', async () => {
                const response = await this.makeRequest('POST', '/api/auth', {
                    username: 'wrong',
                    password: 'wrong'
                });
                
                if (response.status !== 401) throw new Error(`Expected 401, got ${response.status}`);
                if (response.data.error !== 'Invalid credentials') throw new Error('Wrong error message');
            });

            await this.test('Content access with valid token', async () => {
                const response = await this.makeRequest('GET', '/api/content', null, {
                    'Authorization': `Bearer ${this.validToken}`
                });
                
                if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
                if (!response.data.site) throw new Error('Content should contain site data');
            });

            await this.test('Content access with invalid token', async () => {
                const response = await this.makeRequest('GET', '/api/content', null, {
                    'Authorization': 'Bearer invalid.token.here'
                });
                
                if (response.status !== 401) throw new Error(`Expected 401, got ${response.status}`);
            });

            // Critical Session Tests (The original problem)
            await this.test('First content update (should work)', async () => {
                const response = await this.makeRequest('POST', '/api/content', {
                    site: { title: 'Test Site', description: 'Test', author: 'Test' },
                    hero: { title: 'Erste Änderung' },
                    about: { name: 'Test Name' }
                }, {
                    'Authorization': `Bearer ${this.validToken}`
                });
                
                if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
                if (!response.data.success) throw new Error('First update should succeed');
            });

            await this.test('Second content update with same token (THE CRITICAL TEST)', async () => {
                const response = await this.makeRequest('POST', '/api/content', {
                    site: { title: 'Test Site 2', description: 'Test', author: 'Test' },
                    hero: { title: 'Zweite Änderung - CRITICAL!' },
                    about: { name: 'Test Name 2' }
                }, {
                    'Authorization': `Bearer ${this.validToken}`
                });
                
                if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
                if (!response.data.success) throw new Error('Second update should succeed - THIS WAS THE ORIGINAL BUG!');
            });

            await this.test('Publish action with same token', async () => {
                const response = await this.makeRequest('POST', '/api/publish', {
                    message: 'Test publish workflow'
                }, {
                    'Authorization': `Bearer ${this.validToken}`
                });
                
                if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
                if (!response.data.success) throw new Error('Publish should succeed');
            });

            await this.test('Re-login after logout simulation', async () => {
                const response = await this.makeRequest('POST', '/api/auth', {
                    username: 'admin',
                    password: 'secret'
                });
                
                if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
                if (!response.data.success) throw new Error('Re-login should work');
            });

            // Rate Limiting Tests
            await this.test('Rate limiting protection', async () => {
                const promises = [];
                for (let i = 0; i < 12; i++) {
                    promises.push(this.makeRequest('POST', '/api/auth', {
                        username: 'wrong',
                        password: 'wrong'
                    }));
                }
                
                const responses = await Promise.all(promises);
                const rateLimited = responses.some(r => r.status === 429);
                
                if (!rateLimited) throw new Error('Rate limiting should kick in');
            });

            // Restore content
            await this.restoreContent();

        } finally {
            await this.stopServer();
        }

        this.printResults();
    }

    async backupContent() {
        try {
            const content = await fs.readFile('content.json', 'utf8');
            await fs.writeFile('content-test-backup.json', content);
            console.log('✅ Content backed up');
        } catch (error) {
            console.log('⚠️ Could not backup content:', error.message);
        }
    }

    async restoreContent() {
        try {
            const backup = await fs.readFile('content-test-backup.json', 'utf8');
            await fs.writeFile('content.json', backup);
            console.log('✅ Content restored from backup');
        } catch (error) {
            console.log('⚠️ Could not restore content:', error.message);
        }
    }

    printResults() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 TEST RESULTS SUMMARY');
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
            console.log('\n🎉 ALL TESTS PASSED! CMS is working perfectly!');
        } else {
            console.log(`\n⚠️ ${failed} test(s) failed. Please check the issues above.`);
            process.exit(1);
        }
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    const tester = new APITester();
    tester.runTests().catch(error => {
        console.error('Test runner failed:', error);
        process.exit(1);
    });
}

module.exports = APITester;