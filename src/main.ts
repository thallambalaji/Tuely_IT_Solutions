import './style.css'
import './chatbot.ts'

// --- Scroll Reveal ---
const revealElements = document.querySelectorAll('.reveal');
const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('active');
            revealObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.15 });
revealElements.forEach(el => revealObserver.observe(el));

function animateCounter(el: HTMLElement): void {
  const target = parseInt(el.getAttribute('data-target') || '0', 10);
  if (isNaN(target)) return;

  const duration  = 2000;
  const stepTime  = 16;
  const steps     = duration / stepTime;
  const increment = target / steps;
  const suffix    = el.getAttribute('data-suffix') || '';
  let current     = 0;

  const timer = setInterval(() => {
    current += increment;
    if (current >= target) {
      current = target;
      clearInterval(timer);
    }
    el.textContent = Math.floor(current) + suffix;
  }, stepTime);
}

const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      animateCounter(entry.target as HTMLElement);
      counterObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('[data-target]').forEach((el) => counterObserver.observe(el));

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

function toggleJobDetails(btn: HTMLElement): void {
  const card    = btn.closest('.job-listing') as HTMLElement;
  const details = card.querySelector('.job-drawer') as HTMLElement;
  const isOpen  = details.classList.contains('active');
  
  if (isOpen) {
    details.classList.remove('active');
    btn.textContent = 'View Details';
  } else {
    details.classList.add('active');
    btn.textContent = 'Hide Details';
  }
}
(window as any).toggleJobDetails = toggleJobDetails;

document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('view-details')) {
        toggleJobDetails(target);
    }
});

const benefitCards = document.querySelectorAll('.benefit-card');
benefitCards.forEach(card => {
    card.addEventListener('click', () => {
        const isActive = card.classList.contains('active');
        benefitCards.forEach(c => c.classList.remove('active'));
        if (!isActive) card.classList.add('active');
    });
});

// --- Contact Form Logic ---
const contactForm = document.getElementById('contact-form') as HTMLFormElement;
const radioPills = document.querySelectorAll('.radio-pill');
const methodInput = document.getElementById('contact-method-input') as HTMLInputElement;

radioPills.forEach(pill => {
    pill.addEventListener('click', () => {
        radioPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        if (methodInput) {
            methodInput.value = pill.getAttribute('data-method') || 'phone';
        }
    });
});

if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = contactForm.querySelector('button[type="submit"]');
        if (btn) (btn as HTMLButtonElement).innerText = 'Sending...';
        
        const formData = new FormData(contactForm);
        
        try {
            const response = await fetch("/", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams(formData as any).toString(),
            });

            if (response.ok) {
                contactForm.style.display = 'none';
                const successMsg = document.getElementById('form-success');
                if (successMsg) successMsg.style.display = 'block';
            } else {
                alert("Submission failed. Please try again.");
                if (btn) (btn as HTMLButtonElement).innerText = 'Send Message';
            }
        } catch (error) {
            alert("An error occurred. Please try again.");
            if (btn) (btn as HTMLButtonElement).innerText = 'Send Message';
        }
    });
}

// Initializations
document.addEventListener('DOMContentLoaded', () => {
    console.log('Teuly IT Solutions - Production Web Application Ready');
});
