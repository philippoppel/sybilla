// Admin Panel JavaScript
class AdminPanel {
    constructor() {
        this.content = {};
        this.isAuthenticated = false;
        this.currentUser = '';
        
        this.init();
    }

    getApiUrl(endpoint) {
        const bypassParam = window.location.hostname.includes('vercel.app') 
            ? '?x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=8qFWgAl0w4LFwnknoXU49gEnyrc2E1wL'
            : '';
        return `${endpoint}${bypassParam}`;
    }

    init() {
        this.setupEventListeners();
        this.checkAuth();
        this.loadContent();
    }

    setupEventListeners() {
        // Login form
        document.getElementById('adminLogin').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });

        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Save and publish buttons
        document.getElementById('saveBtn').addEventListener('click', () => {
            this.saveChanges();
        });

        document.getElementById('publishBtn').addEventListener('click', () => {
            this.publishChanges();
        });

        // Image uploads
        document.getElementById('heroImageUpload').addEventListener('change', (e) => {
            this.handleImageUpload(e, 'hero');
        });

        document.getElementById('profileImageUpload').addEventListener('change', (e) => {
            this.handleImageUpload(e, 'profile');
        });

        // Services management
        document.getElementById('addServiceBtn').addEventListener('click', () => {
            this.addService();
        });

        // Testimonials management
        document.getElementById('addTestimonialBtn').addEventListener('click', () => {
            this.addTestimonial();
        });

        // Removed test API button
    }

    checkAuth() {
        const authData = sessionStorage.getItem('admin_auth');
        if (authData) {
            try {
                const auth = JSON.parse(authData);
                // Check if token exists and is not expired (with 5 minute buffer)
                const buffer = 5 * 60 * 1000; // 5 minutes
                if (auth.token && auth.expires && (Date.now() + buffer) < auth.expires) {
                    this.isAuthenticated = true;
                    this.currentUser = auth.username;
                    this.cachedToken = auth.token;
                    this.showAdminPanel();
                    return;
                } else if (auth.token) {
                    // Token exists but is expired or about to expire
                    console.log('Token expired or about to expire, clearing auth');
                    this.clearAuthData();
                }
            } catch (e) {
                console.error('Invalid auth data:', e);
                this.clearAuthData();
            }
        }
        this.showLoginForm();
    }

    async handleLogin() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        // Clear any existing auth data before login attempt
        this.clearAuthData();
        
        try {
            // Try serverless endpoint first, then local server endpoint
            let response = await fetch(this.getApiUrl('/api/auth.js'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            // If serverless returns 404, try local server endpoint
            if (response.status === 404) {
                response = await fetch(this.getApiUrl('/api/auth'), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, password })
                });
            }

            if (response.ok) {
                const result = await response.json();
                this.isAuthenticated = true;
                this.currentUser = result.user;
                
                // Store auth token with server-provided expiration
                const expires = (result.timestamp || Date.now()) + (2 * 60 * 60 * 1000);
                const authData = {
                    token: result.token,
                    username: result.user,
                    expires: expires,
                    timestamp: result.timestamp || Date.now()
                };
                
                sessionStorage.setItem('admin_auth', JSON.stringify(authData));
                
                this.showAdminPanel();
                this.showStatus('Erfolgreich angemeldet!', 'success');
                
                // Reload content with authenticated session
                await this.loadContent();
            } else {
                let errorText = 'Anmeldung fehlgeschlagen';
                try {
                    const error = await response.json();
                    errorText = error.error || errorText;
                } catch (e) {
                    // Use default error message if JSON parsing fails
                }
                
                if (response.status === 429) {
                    this.showError('Zu viele Login-Versuche. Bitte warten Sie 5 Minuten.');
                } else {
                    this.showError(errorText);
                }
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showError(`Verbindungsfehler: ${error.message}`);
        }
    }

    logout() {
        this.isLoggingOut = true;
        this.clearAuthData();
        this.isAuthenticated = false;
        this.currentUser = '';
        this.content = {}; // Clear content data
        this.showLoginForm();
        this.showStatus('Erfolgreich abgemeldet', 'info');
        this.isLoggingOut = false;
    }
    
    clearAuthData() {
        // Clear all possible storage locations
        sessionStorage.removeItem('admin_auth');
        localStorage.removeItem('admin_auth');
        
        // Clear any cached headers or tokens
        delete this.cachedToken;
    }

    showLoginForm() {
        document.getElementById('loginForm').style.display = 'flex';
        document.getElementById('adminPanel').style.display = 'none';
    }

    showAdminPanel() {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'block';
        document.getElementById('currentUser').textContent = this.currentUser;
    }

    showError(message) {
        const errorDiv = document.getElementById('loginError');
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
        setTimeout(() => {
            errorDiv.classList.add('hidden');
        }, 5000);
    }

    async loadContent() {
        try {
            let response;
            if (this.isAuthenticated) {
                // Try serverless endpoint first, then local server endpoint
                response = await fetch(this.getApiUrl('/api/content.js'), {
                    headers: {
                        'Authorization': `Bearer ${this.getAuthToken()}`
                    }
                });
                
                // If serverless returns 404, try local server endpoint
                if (response.status === 404) {
                    response = await fetch(this.getApiUrl('/api/content'), {
                        headers: {
                            'Authorization': `Bearer ${this.getAuthToken()}`
                        }
                    });
                }
            } else {
                response = await fetch('content.json');
            }
            
            this.content = await response.json();
            this.populateForm();
        } catch (error) {
            console.error('Error loading content:', error);
            this.showStatus('Fehler beim Laden der Inhalte', 'error');
        }
    }

    getAuthToken() {
        // Use cached token if available and valid
        if (this.cachedToken) {
            return this.cachedToken;
        }
        
        const authData = sessionStorage.getItem('admin_auth');
        if (authData) {
            try {
                const auth = JSON.parse(authData);
                // Verify token is still valid before using
                if (auth.token && auth.expires && Date.now() < auth.expires) {
                    this.cachedToken = auth.token;
                    return auth.token;
                } else {
                    // Token expired, clear auth and return null  
                    this.clearAuthData();
                    this.isAuthenticated = false;
                    // Don't call showLoginForm here to prevent recursion in loadContent
                    if (!this.isLoggingOut) {
                        this.showLoginForm();
                    }
                }
            } catch (e) {
                console.error('Error parsing auth data:', e);
                this.clearAuthData();
            }
        }
        return null;
    }

    populateForm() {
        // Hero section
        document.getElementById('heroTitle').value = this.content.hero?.title || '';
        document.getElementById('heroSubtitle').value = this.content.hero?.subtitle || '';
        document.getElementById('heroButtonText').value = this.content.hero?.buttonText || '';

        // About section  
        document.getElementById('aboutName').value = this.content.about?.name || '';
        document.getElementById('aboutDesc1').value = this.content.about?.description1 || '';
        document.getElementById('aboutDesc2').value = this.content.about?.description2 || '';

        // Contact section
        document.getElementById('contactEnabled').checked = this.content.contact?.enabled || false;
        document.getElementById('contactDescription').value = this.content.contact?.formDescription || '';

        // Services section
        document.getElementById('servicesTitle').value = this.content.services?.title || '';
        document.getElementById('servicesSubtitle').value = this.content.services?.subtitle || '';
        this.renderServices();

        // Testimonials section
        document.getElementById('testimonialsTitle').value = this.content.testimonials?.title || '';
        document.getElementById('testimonialsSubtitle').value = this.content.testimonials?.subtitle || '';
        this.renderTestimonials();

        // Images
        this.loadCurrentImages();
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('border-blue-500', 'text-blue-600');
            btn.classList.add('border-transparent', 'text-gray-500');
        });
        
        document.querySelector(`[data-tab="${tabName}"]`).classList.remove('border-transparent', 'text-gray-500');
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('border-blue-500', 'text-blue-600');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.add('hidden');
        });
        
        document.getElementById(`${tabName}-tab`).classList.remove('hidden');
    }

    collectFormData() {
        return {
            ...this.content,
            hero: {
                ...this.content.hero,
                title: document.getElementById('heroTitle').value,
                subtitle: document.getElementById('heroSubtitle').value,
                buttonText: document.getElementById('heroButtonText').value
            },
            about: {
                ...this.content.about,
                name: document.getElementById('aboutName').value,
                description1: document.getElementById('aboutDesc1').value,
                description2: document.getElementById('aboutDesc2').value
            },
            contact: {
                ...this.content.contact,
                enabled: document.getElementById('contactEnabled').checked,
                formDescription: document.getElementById('contactDescription').value
            },
            services: {
                ...this.content.services,
                title: document.getElementById('servicesTitle').value,
                subtitle: document.getElementById('servicesSubtitle').value,
                items: this.collectServices()
            },
            testimonials: {
                ...this.content.testimonials,
                title: document.getElementById('testimonialsTitle').value,
                subtitle: document.getElementById('testimonialsSubtitle').value,
                items: this.collectTestimonials()
            }
        };
    }

    async saveChanges() {
        const token = this.getAuthToken();
        if (!token) {
            this.showStatus('Session abgelaufen. Bitte loggen Sie sich erneut ein.', 'error');
            this.logout();
            return;
        }
        
        try {
            const updatedContent = this.collectFormData();
            
            // Try serverless endpoint first, then local server endpoint
            let response = await fetch(this.getApiUrl('/api/content.js'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updatedContent)
            });
            
            // If serverless returns 404, try local server endpoint
            if (response.status === 404) {
                response = await fetch(this.getApiUrl('/api/content'), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(updatedContent)
                });
            }

            if (response.ok) {
                this.content = updatedContent;
                this.showStatus('Änderungen gespeichert', 'success');
            } else if (response.status === 401) {
                this.showStatus('Session abgelaufen. Bitte loggen Sie sich erneut ein.', 'error');
                this.logout();
            } else {
                let errorMessage = 'Server error';
                try {
                    const error = await response.json();
                    errorMessage = error.error || errorMessage;
                } catch (e) {
                    // Use default error message if JSON parsing fails
                }
                throw new Error(errorMessage);
            }
        } catch (error) {
            console.error('Error saving:', error);
            this.showStatus('Fehler beim Speichern: ' + error.message, 'error');
        }
    }

    async publishChanges() {
        const token = this.getAuthToken();
        if (!token) {
            this.showStatus('Session abgelaufen. Bitte loggen Sie sich erneut ein.', 'error');
            this.logout();
            return;
        }
        
        try {
            const updatedContent = this.collectFormData();
            
            this.showStatus('Veröffentlichung wird vorbereitet...', 'info');
            
            // Try serverless endpoint first, then local server endpoint
            let response = await fetch(this.getApiUrl('/api/github-publish.js'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    content: updatedContent,
                    message: 'Content update via admin panel 🚀'
                })
            });
            
            // If serverless returns 404, try local server endpoint
            if (response.status === 404) {
                response = await fetch(this.getApiUrl('/api/publish'), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        content: updatedContent,
                        message: 'Content update via admin panel 🚀'
                    })
                });
            }

            if (response.ok) {
                const result = await response.json();
                if (result.success && result.deployed) {
                    this.showStatus('🚀 Erfolgreich auf GitHub veröffentlicht! Vercel deployt automatisch in ~2 Minuten.', 'success');
                    this.content = updatedContent;
                } else if (result.success) {
                    this.showStatus(result.message || 'Änderungen verarbeitet', 'info');
                } else {
                    this.showStatus(result.message || 'Veröffentlichung nicht möglich', 'warning');
                }
            } else if (response.status === 401) {
                this.showStatus('Session abgelaufen. Bitte loggen Sie sich erneut ein.', 'error');
                this.logout();
            } else {
                let errorMessage = 'Server error';
                try {
                    const error = await response.json();
                    errorMessage = error.error || errorMessage;
                } catch (e) {
                    // Use default error message if JSON parsing fails
                }
                throw new Error(errorMessage);
            }
            
        } catch (error) {
            console.error('Error publishing:', error);
            this.showStatus('Fehler beim Veröffentlichen: ' + error.message, 'error');
        }
    }

    updateMainSite(content) {
        // This simulates how the main site would be updated
        // In production, this would be handled by the deployment process
        console.log('Content would be deployed:', content);
        
        // For demo purposes, we could open the main site in a new tab
        // window.open('index.html', '_blank');
    }

    handleImageUpload(event, type) {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file
        if (!file.type.startsWith('image/')) {
            this.showStatus('Bitte wählen Sie eine Bilddatei aus', 'error');
            return;
        }

        if (file.size > 10 * 1024 * 1024) { // 10MB
            this.showStatus('Datei ist zu groß (max. 10MB)', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const previewId = type === 'hero' ? 'heroImagePreview' : 'profileImagePreview';
            const preview = document.getElementById(previewId);
            preview.src = e.target.result;
            preview.style.display = 'block';

            // In production, this would upload to a server
            this.showStatus(`${type === 'hero' ? 'Hero' : 'Profil'} Bild ausgewählt`, 'success');
        };
        reader.readAsDataURL(file);
    }

    showStatus(message, type = 'info') {
        const statusDiv = document.getElementById('statusMessage');
        const statusText = document.getElementById('statusText');
        const statusIcon = document.getElementById('statusIcon');

        statusText.textContent = message;

        // Set icon based on type
        const icons = {
            success: '✓',
            error: '✗', 
            info: 'i',
            warning: '!'
        };

        const colors = {
            success: 'text-green-600',
            error: 'text-red-600',
            info: 'text-blue-600', 
            warning: 'text-yellow-600'
        };

        statusIcon.textContent = icons[type] || icons.info;
        statusIcon.className = `flex-shrink-0 w-5 h-5 mr-3 ${colors[type] || colors.info}`;

        // Show message
        statusDiv.classList.remove('hidden');

        // Hide after 5 seconds
        setTimeout(() => {
            statusDiv.classList.add('hidden');
        }, 5000);
    }

    loadCurrentImages() {
        // Load hero image
        if (this.content.hero?.backgroundImage) {
            const heroImg = document.getElementById('heroImagePreview');
            const heroPath = document.getElementById('heroImagePath');
            heroImg.src = this.content.hero.backgroundImage;
            heroImg.style.display = 'block';
            heroPath.textContent = `Aktuell: ${this.content.hero.backgroundImage}`;
        }

        // Load profile image
        if (this.content.about?.profileImage) {
            const profileImg = document.getElementById('profileImagePreview');
            const profilePath = document.getElementById('profileImagePath');
            profileImg.src = this.content.about.profileImage;
            profileImg.style.display = 'block';
            profilePath.textContent = `Aktuell: ${this.content.about.profileImage}`;
        }
    }

    renderServices() {
        const container = document.getElementById('servicesList');
        container.innerHTML = '';
        
        if (!this.content.services?.items) return;

        this.content.services.items.forEach((service, index) => {
            const serviceDiv = document.createElement('div');
            serviceDiv.className = 'border border-gray-200 rounded-lg p-4 mb-4';
            serviceDiv.innerHTML = `
                <div class="space-y-3">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Titel</label>
                        <input type="text" class="service-title w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" value="${service.title || ''}">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
                        <textarea class="service-description w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y" rows="3">${service.description || ''}</textarea>
                    </div>
                    <button type="button" onclick="adminPanel.removeService(${index})" class="text-red-600 hover:text-red-800 text-sm font-medium px-2 py-1 rounded border border-red-200 hover:border-red-300 transition-colors">
                        Leistung entfernen
                    </button>
                </div>
            `;
            container.appendChild(serviceDiv);
        });
    }

    addService() {
        if (!this.content.services) {
            this.content.services = { items: [] };
        }
        if (!this.content.services.items) {
            this.content.services.items = [];
        }
        
        this.content.services.items.push({
            title: 'Neue Leistung',
            description: 'Beschreibung der Leistung'
        });
        
        this.renderServices();
    }

    removeService(index) {
        this.content.services.items.splice(index, 1);
        this.renderServices();
    }

    collectServices() {
        const services = [];
        const serviceDivs = document.querySelectorAll('#servicesList > div');
        
        serviceDivs.forEach(div => {
            const title = div.querySelector('.service-title').value;
            const description = div.querySelector('.service-description').value;
            
            if (title.trim() || description.trim()) {
                services.push({ title, description });
            }
        });
        
        return services;
    }

    renderTestimonials() {
        const container = document.getElementById('testimonialsList');
        container.innerHTML = '';
        
        if (!this.content.testimonials?.items) return;

        this.content.testimonials.items.forEach((testimonial, index) => {
            const testimonialDiv = document.createElement('div');
            testimonialDiv.className = 'border border-gray-200 rounded-lg p-4 mb-4';
            testimonialDiv.innerHTML = `
                <div class="space-y-3">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Zitat</label>
                        <textarea class="testimonial-text w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y" rows="3">${testimonial.text || ''}</textarea>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
                        <input type="text" class="testimonial-author w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" value="${testimonial.author || ''}">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Position</label>
                        <input type="text" class="testimonial-position w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" value="${testimonial.position || ''}">
                    </div>
                    <button type="button" onclick="adminPanel.removeTestimonial(${index})" class="text-red-600 hover:text-red-800 text-sm font-medium px-2 py-1 rounded border border-red-200 hover:border-red-300 transition-colors">
                        Kundenstimme entfernen
                    </button>
                </div>
            `;
            container.appendChild(testimonialDiv);
        });
    }

    addTestimonial() {
        if (!this.content.testimonials) {
            this.content.testimonials = { items: [] };
        }
        if (!this.content.testimonials.items) {
            this.content.testimonials.items = [];
        }
        
        this.content.testimonials.items.push({
            text: 'Neue Kundenstimme',
            author: 'Name des Kunden',
            position: 'Position, Unternehmen'
        });
        
        this.renderTestimonials();
    }

    removeTestimonial(index) {
        this.content.testimonials.items.splice(index, 1);
        this.renderTestimonials();
    }

    collectTestimonials() {
        const testimonials = [];
        const testimonialDivs = document.querySelectorAll('#testimonialsList > div');
        
        testimonialDivs.forEach(div => {
            const text = div.querySelector('.testimonial-text').value;
            const author = div.querySelector('.testimonial-author').value;
            const position = div.querySelector('.testimonial-position').value;
            
            if (text.trim() || author.trim() || position.trim()) {
                testimonials.push({ text, author, position });
            }
        });
        
        return testimonials;
    }

    // Test API function removed
}

// Global reference for onclick handlers
let adminPanel;

// Initialize admin panel when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    adminPanel = new AdminPanel();
});

// Content sanitization helper
function sanitizeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Validate content helper
function validateContent(content) {
    const errors = [];
    
    if (!content.hero?.title?.trim()) {
        errors.push('Hero Titel ist erforderlich');
    }
    
    if (!content.about?.name?.trim()) {
        errors.push('Name ist erforderlich');
    }
    
    return errors;
}