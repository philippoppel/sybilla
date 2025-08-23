const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
const fs = require('fs').promises;

class UITester {
    constructor() {
        this.baseUrl = 'http://localhost:3000';
        this.server = null;
        this.browser = null;
        this.page = null;
        this.testResults = [];
    }

    async startServer() {
        return new Promise((resolve, reject) => {
            this.server = spawn('node', ['server.js'], { 
                stdio: ['pipe', 'pipe', 'pipe'], 
                cwd: process.cwd() 
            });
            
            this.server.stdout.on('data', (data) => {
                if (data.toString().includes('Server running on port 3000')) {
                    setTimeout(resolve, 1000); // Give server time to fully start
                }
            });

            setTimeout(() => reject(new Error('Server start timeout')), 15000);
        });
    }

    async stopServer() {
        if (this.server) {
            this.server.kill();
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    async setupBrowser() {
        this.browser = await puppeteer.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        this.page = await this.browser.newPage();
        
        // Set mobile viewport for responsive testing
        await this.page.setViewport({ width: 375, height: 667 }); // iPhone SE
        
        // Listen for console logs and errors
        this.page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log(`Browser Error: ${msg.text()}`);
            }
        });
    }

    async closeBrowser() {
        if (this.browser) {
            await this.browser.close();
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

    async login(username = 'admin', password = 'secret') {
        await this.page.goto(`${this.baseUrl}/admin.html`);
        await this.page.waitForSelector('#username', { timeout: 5000 });
        
        await this.page.type('#username', username);
        await this.page.type('#password', password);
        await this.page.click('button[type="submit"]');
        
        // Wait for either admin panel or error
        try {
            await this.page.waitForSelector('#adminPanel', { timeout: 3000 });
            return true;
        } catch {
            return false;
        }
    }

    async runTests() {
        console.log('🚀 Starting CMS UI Tests...');
        
        try {
            await this.startServer();
            console.log('✅ Server started');
            
            await this.setupBrowser();
            console.log('✅ Browser started');

            // Test 1: Page loads correctly
            await this.test('Admin page loads correctly', async () => {
                await this.page.goto(`${this.baseUrl}/admin.html`);
                
                const title = await this.page.title();
                if (!title.includes('Admin Panel')) throw new Error('Page title incorrect');
                
                const loginForm = await this.page.$('#loginForm');
                if (!loginForm) throw new Error('Login form not found');
            });

            // Test 2: Login functionality
            await this.test('Login with correct credentials', async () => {
                const success = await this.login();
                if (!success) throw new Error('Login failed');
                
                const currentUser = await this.page.$eval('#currentUser', el => el.textContent);
                if (currentUser !== 'admin') throw new Error('Current user not displayed correctly');
            });

            // Test 3: Tab navigation
            await this.test('Tab navigation works', async () => {
                await this.page.click('[data-tab="about"]');
                await this.page.waitForSelector('#about-tab:not(.hidden)', { timeout: 2000 });
                
                const aboutTab = await this.page.$('#about-tab:not(.hidden)');
                if (!aboutTab) throw new Error('About tab not visible after click');
                
                await this.page.click('[data-tab="services"]');
                await this.page.waitForSelector('#services-tab:not(.hidden)', { timeout: 2000 });
                
                const servicesTab = await this.page.$('#services-tab:not(.hidden)');
                if (!servicesTab) throw new Error('Services tab not visible after click');
            });

            // Test 4: Content editing
            await this.test('Hero content editing works', async () => {
                await this.page.click('[data-tab="hero"]');
                await this.page.waitForSelector('#hero-tab:not(.hidden)');
                
                await this.page.clear('#heroTitle');
                await this.page.type('#heroTitle', 'Test Hero Title');
                
                const value = await this.page.$eval('#heroTitle', el => el.value);
                if (value !== 'Test Hero Title') throw new Error('Hero title not updated');
            });

            // Test 5: Save functionality
            await this.test('Save functionality works', async () => {
                await this.page.click('#saveBtn');
                
                // Wait for status message
                await this.page.waitForSelector('#statusMessage:not(.hidden)', { timeout: 5000 });
                
                const statusText = await this.page.$eval('#statusText', el => el.textContent);
                if (!statusText.includes('gespeichert')) throw new Error('Save status not shown');
            });

            // Test 6: Session persistence (The critical test!)
            await this.test('Second save with same session (CRITICAL TEST)', async () => {
                await this.page.clear('#heroTitle');
                await this.page.type('#heroTitle', 'Second Save Test');
                
                await this.page.click('#saveBtn');
                
                // Wait for status message
                await this.page.waitForSelector('#statusMessage:not(.hidden)', { timeout: 5000 });
                
                const statusText = await this.page.$eval('#statusText', el => el.textContent);
                if (!statusText.includes('gespeichert')) throw new Error('Second save failed - SESSION PROBLEM!');
            });

            // Test 7: Mobile responsiveness
            await this.test('Mobile responsive design', async () => {
                // Test mobile viewport
                await this.page.setViewport({ width: 375, height: 667 });
                await this.page.reload();
                
                // Login again for mobile test
                await this.login();
                
                // Check if tabs are responsive
                const tabsContainer = await this.page.$('.mobile-tabs');
                if (!tabsContainer) throw new Error('Mobile tabs class not applied');
                
                // Check if buttons stack on mobile
                const saveButton = await this.page.$('#saveBtn');
                const boundingBox = await saveButton.boundingBox();
                if (boundingBox.width < 100) throw new Error('Button too small on mobile');
            });

            // Test 8: Logout functionality
            await this.test('Logout functionality', async () => {
                await this.page.click('#logoutBtn');
                
                await this.page.waitForSelector('#loginForm', { timeout: 3000 });
                
                const loginForm = await this.page.$('#loginForm');
                const adminPanel = await this.page.$('#adminPanel:not([style*="none"])');
                
                if (!loginForm) throw new Error('Login form not shown after logout');
                if (adminPanel) throw new Error('Admin panel still visible after logout');
            });

            // Test 9: Re-login after logout
            await this.test('Re-login after logout works', async () => {
                const success = await this.login();
                if (!success) throw new Error('Re-login failed after logout');
            });

            // Test 10: Error handling
            await this.test('Login error handling', async () => {
                await this.page.goto(`${this.baseUrl}/admin.html`);
                await this.page.waitForSelector('#username');
                
                await this.page.type('#username', 'wrong');
                await this.page.type('#password', 'wrong');
                await this.page.click('button[type="submit"]');
                
                await this.page.waitForSelector('#loginError:not(.hidden)', { timeout: 3000 });
                
                const errorText = await this.page.$eval('#loginError', el => el.textContent);
                if (!errorText.includes('Invalid credentials')) throw new Error('Error message not shown');
            });

        } finally {
            await this.closeBrowser();
            await this.stopServer();
        }

        this.printResults();
    }

    printResults() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 UI TEST RESULTS SUMMARY');
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
            console.log('\n🎉 ALL UI TESTS PASSED! The admin panel is working perfectly!');
        } else {
            console.log(`\n⚠️ ${failed} UI test(s) failed. Please check the issues above.`);
            process.exit(1);
        }
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    const tester = new UITester();
    tester.runTests().catch(error => {
        console.error('UI Test runner failed:', error);
        process.exit(1);
    });
}

module.exports = UITester;