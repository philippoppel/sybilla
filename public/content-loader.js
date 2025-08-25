// Content Loader for Dynamic Website
class ContentLoader {
    constructor() {
        this.content = {};
        this.init();
    }

    async init() {
        try {
            await this.loadContent();
            this.updateDOM();
        } catch (error) {
            console.error('Error loading content:', error);
            // Fallback to static content if JSON fails
        }
    }

    async loadContent() {
        try {
            const response = await fetch('content.json?v=' + Date.now());
            this.content = await response.json();
        } catch (error) {
            console.warn('Could not load content.json, using static content');
            throw error;
        }
    }

    updateDOM() {
        this.updateHero();
        this.updateAbout();
        this.updateServices();
        this.updateTestimonials();
        this.updateContact();
        this.updateMeta();
    }

    updateHero() {
        const hero = this.content.hero;
        if (!hero) return;

        // Update hero title
        const heroTitle = document.getElementById('hero-heading');
        if (heroTitle && hero.title) {
            heroTitle.textContent = hero.title;
        }

        // Update hero subtitle
        const heroSubtitle = document.querySelector('#home p');
        if (heroSubtitle && hero.subtitle) {
            heroSubtitle.textContent = hero.subtitle;
        }

        // Update hero button
        const heroButton = document.querySelector('#home a[href="#services"]');
        if (heroButton && hero.buttonText) {
            heroButton.textContent = hero.buttonText;
        }

        // Update background image
        if (hero.backgroundImage) {
            const heroSection = document.getElementById('home');
            if (heroSection) {
                heroSection.style.backgroundImage = `url('${hero.backgroundImage}')`;
            }
        }
    }

    updateAbout() {
        const about = this.content.about;
        if (!about) return;

        // Update section title
        const aboutTitle = document.querySelector('#about h2');
        if (aboutTitle && about.title) {
            aboutTitle.textContent = about.title;
        }

        // Update subtitle
        const aboutSubtitle = document.querySelector('#about .text-lg.text-gray-600');
        if (aboutSubtitle && about.subtitle) {
            aboutSubtitle.textContent = about.subtitle;
        }

        // Update name
        const aboutName = document.querySelector('#about h3');
        if (aboutName && about.name) {
            aboutName.textContent = about.name;
        }

        // Update descriptions
        const descriptions = document.querySelectorAll('#about .text-gray-700.leading-relaxed');
        if (descriptions.length >= 2) {
            if (about.description1) {
                descriptions[0].innerHTML = this.sanitizeHTML(about.description1);
            }
            if (about.description2) {
                descriptions[1].innerHTML = this.sanitizeHTML(about.description2);
            }
        }

        // Update profile image
        if (about.profileImage) {
            const profileImg = document.querySelector('#about img[alt*="Portrait"]');
            if (profileImg) {
                profileImg.src = about.profileImage;
            }
        }
    }

    updateServices() {
        const services = this.content.services;
        if (!services) return;

        // Update section title
        const servicesTitle = document.querySelector('#services h2');
        if (servicesTitle && services.title) {
            servicesTitle.textContent = services.title;
        }

        // Update subtitle
        const servicesSubtitle = document.querySelector('#services .text-lg.text-gray-600');
        if (servicesSubtitle && services.subtitle) {
            servicesSubtitle.textContent = services.subtitle;
        }

        // Update service items
        if (services.items && services.items.length > 0) {
            const serviceCards = document.querySelectorAll('#services .bg-white.p-8');
            services.items.forEach((item, index) => {
                if (serviceCards[index]) {
                    const title = serviceCards[index].querySelector('h3');
                    const description = serviceCards[index].querySelector('p');
                    
                    if (title && item.title) {
                        title.textContent = item.title;
                    }
                    if (description && item.description) {
                        description.innerHTML = this.sanitizeHTML(item.description);
                    }
                }
            });
        }
    }

    updateTestimonials() {
        const testimonials = this.content.testimonials;
        if (!testimonials) return;

        // Update section title
        const testimonialsTitle = document.querySelector('#testimonials h2');
        if (testimonialsTitle && testimonials.title) {
            testimonialsTitle.textContent = testimonials.title;
        }

        // Update subtitle
        const testimonialsSubtitle = document.querySelector('#testimonials .text-lg.text-gray-600');
        if (testimonialsSubtitle && testimonials.subtitle) {
            testimonialsSubtitle.textContent = testimonials.subtitle;
        }

        // Update testimonial items
        if (testimonials.items && testimonials.items.length > 0) {
            const testimonialCards = document.querySelectorAll('#testimonials .bg-white.p-8');
            testimonials.items.forEach((item, index) => {
                if (testimonialCards[index]) {
                    const text = testimonialCards[index].querySelector('p.italic');
                    const author = testimonialCards[index].querySelector('p.font-bold');
                    const position = testimonialCards[index].querySelector('p.text-sm.text-gray-500');
                    
                    if (text && item.text) {
                        text.textContent = `"${item.text}"`;
                    }
                    if (author && item.author) {
                        author.textContent = item.author;
                    }
                    if (position && item.position) {
                        position.textContent = item.position;
                    }
                }
            });
        }
    }

    updateContact() {
        const contact = this.content.contact;
        if (!contact) return;

        // Update section title
        const contactTitle = document.querySelector('#contact h2');
        if (contactTitle && contact.title) {
            contactTitle.textContent = contact.title;
        }

        // Update subtitle
        const contactSubtitle = document.querySelector('#contact .text-lg.text-gray-600');
        if (contactSubtitle && contact.subtitle) {
            contactSubtitle.textContent = contact.subtitle;
        }

        // Update form description
        const formDescription = document.querySelector('#contact .text-center.text-gray-700');
        if (formDescription && contact.formDescription) {
            formDescription.textContent = contact.formDescription;
        }

        // Show/hide contact form
        const contactForm = document.getElementById('contactForm');
        const contactSection = document.getElementById('contact');
        
        if (contact.enabled === false) {
            if (contactForm) {
                contactForm.style.display = 'none';
            }
            // Add disabled message
            if (contactSection && !document.getElementById('contact-disabled')) {
                const disabledMsg = document.createElement('div');
                disabledMsg.id = 'contact-disabled';
                disabledMsg.className = 'text-center text-gray-600 bg-gray-100 p-8 rounded-lg';
                disabledMsg.innerHTML = '<p class="text-lg">Das Kontaktformular ist derzeit deaktiviert.</p><p class="text-sm mt-2">Bitte versuchen Sie es später erneut.</p>';
                contactSection.appendChild(disabledMsg);
            }
        } else {
            if (contactForm) {
                contactForm.style.display = 'block';
            }
            // Remove disabled message if it exists
            const disabledMsg = document.getElementById('contact-disabled');
            if (disabledMsg) {
                disabledMsg.remove();
            }
        }
    }

    updateMeta() {
        const site = this.content.site;
        if (!site) return;

        // Update page title
        if (site.title) {
            document.title = site.title;
        }

        // Update meta description
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc && site.description) {
            metaDesc.setAttribute('content', site.description);
        }

        // Update author
        const metaAuthor = document.querySelector('meta[name="author"]');
        if (metaAuthor && site.author) {
            metaAuthor.setAttribute('content', site.author);
        }
    }

    sanitizeHTML(str) {
        // Allow only basic HTML tags for rich text
        const allowedTags = ['strong', 'em', 'b', 'i', 'br'];
        const div = document.createElement('div');
        div.innerHTML = str;
        
        // Remove any script tags or dangerous content
        const scripts = div.querySelectorAll('script');
        scripts.forEach(script => script.remove());
        
        return div.innerHTML;
    }

    // Method to reload content (useful for admin panel)
    async reload() {
        await this.loadContent();
        this.updateDOM();
    }
}

// Initialize content loader when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.contentLoader = new ContentLoader();
});

// Make reload available globally for admin panel
window.reloadContent = function() {
    if (window.contentLoader) {
        return window.contentLoader.reload();
    }
};