import './style.css'
import './chatbot.ts'

// --- Scroll Reveal ---
const revealElements = document.querySelectorAll('.reveal');
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('active');
            
            // Trigger Stats Counter if applicable
            const counters = (entry.target as HTMLElement).querySelectorAll('.count');
            counters.forEach(counter => {
                if (!counter.classList.contains('counted')) {
                    animateValue(counter as HTMLElement);
                    counter.classList.add('counted');
                }
            });
        }
    });
}, { threshold: 0.15 });

revealElements.forEach(el => observer.observe(el));

function animateValue(obj: HTMLElement) {
    const targetText = obj.getAttribute('data-target') || '0';
    const target = parseInt(targetText);
    let current = 0;
    const duration = 2000;
    const stepTime = Math.abs(Math.floor(duration / (target || 1)));
    
    const timer = setInterval(() => {
        current += 1;
        obj.innerText = current.toString();
        if (current >= target) {
            obj.innerText = target.toString();
            clearInterval(timer);
        }
    }, stepTime > 0 ? stepTime : 1);
}

// --- Careers Page Specific ---
const filterDept = document.getElementById('filter-dept') as HTMLSelectElement;
const jobListings = document.querySelectorAll('.job-listing');

filterDept?.addEventListener('change', () => {
    const dept = filterDept.value;
    jobListings.forEach(job => {
        const jobDept = job.getAttribute('data-dept');
        if (dept === 'all' || jobDept === dept) {
            (job as HTMLElement).style.display = 'block';
        } else {
            (job as HTMLElement).style.display = 'none';
        }
    });
});

const viewDetailBtns = document.querySelectorAll('.view-details');
viewDetailBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const drawer = btn.closest('.job-listing')?.querySelector('.job-drawer');
        if (drawer) {
            drawer.classList.toggle('active');
            btn.textContent = drawer.classList.contains('active') ? 'Close Details' : 'View Details';
        }
    });
});

const benefitCards = document.querySelectorAll('.benefit-card');
benefitCards.forEach(card => {
    card.addEventListener('click', () => {
        const isActive = card.classList.contains('active');
        benefitCards.forEach(c => c.classList.remove('active'));
        if (!isActive) card.classList.add('active');
    });
});

// --- Contact Page Specific ---
const contactForm = document.getElementById('contact-form') as HTMLFormElement;
const formSuccess = document.getElementById('form-success');
const radioPills = document.querySelectorAll('.radio-pill');

radioPills.forEach(pill => {
    pill.addEventListener('click', () => {
        radioPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
    });
});

contactForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = contactForm.querySelector('button[type="submit"]');
    if (btn) (btn as HTMLButtonElement).innerText = 'Sending...';
    
    setTimeout(() => {
        contactForm.style.display = 'none';
        if (formSuccess) formSuccess.style.display = 'block';
    }, 1500);
});

// Initializations
document.addEventListener('DOMContentLoaded', () => {
    console.log('Teuly IT Solutions - Production Web Application Ready');
});
