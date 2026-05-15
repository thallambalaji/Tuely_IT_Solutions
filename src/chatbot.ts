declare global {
  interface Window {
    handleChatToggle: () => void;
  }
}

(function() {

  // ─── FAQ DATA ─────────────────────────────────────────────────────────────
  interface FAQ {
    q: string;
    a: string;
  }

  const FAQS: FAQ[] = [
    {
      q: "What services do you provide?",
      a: "Teuly IT Solutions provides a wide range of services including XML Conversion, 24/7 Customer Support, IT Consulting, Web Design, Digital Marketing, and Virtual Assistance."
    },
    {
      q: "Where is Teuly located?",
      a: "Our headquarters are located at Manjeera Trinity Corporate, KPHB Phase 3, Kukatpally, Hyderabad, Telangana 500072."
    },
    {
      q: "How can I book a consultation?",
      a: "You can book a consultation by calling us at +91 7013313717 or emailing info@teulyitsolutions.com. We typically respond within 24 hours."
    },
    {
      q: "Do you offer 24/7 support?",
      a: "Yes! We pride ourselves on providing round-the-clock support and technical assistance to ensure your business never stops."
    },
    {
      q: "What is XML Conversion?",
      a: "XML Conversion is the process of converting digital publishing content into structured XML formats for better data management and accessibility."
    },
    {
      q: "Can I talk to a live agent?",
      a: "Absolutely! You can reach us instantly on WhatsApp at +91 7013313717 for immediate assistance."
    }
  ];

  // ─── STATE ────────────────────────────────────────────────────────────────
  let chatOpen = false;
  let minimized = false;

  // ─── MAIN TOGGLE ──────────────────────────────────────────────────────────
  window.handleChatToggle = function() {
    const chatWindow = document.getElementById('teulyChatWindow');
    if (!chatWindow) return;
    if (chatOpen) closeChat(); else openChat();
  };

  function openChat() {
    const chatWindow = document.getElementById('teulyChatWindow');
    const messagesEl = document.getElementById('teulyMessages');
    if (!chatWindow || !messagesEl) return;

    chatWindow.style.display = 'flex';
    chatOpen = true;
    if (messagesEl.children.length === 0) {
      showWelcomeMessage();
    }
  }

  function closeChat() {
    const chatWindow = document.getElementById('teulyChatWindow');
    if (chatWindow) chatWindow.style.display = 'none';
    chatOpen = false;
  }

  // ─── INITIALIZE LISTENERS ──────────────────────────────────────────────────
  function initListeners() {
    const chatLauncher = document.getElementById('chat-launcher');
    if (chatLauncher) chatLauncher.addEventListener('click', () => window.handleChatToggle());

    const closeBtn    = document.getElementById('teulyCloseBtn');
    const minimizeBtn = document.getElementById('teulyMinimizeBtn');
    if (closeBtn) closeBtn.addEventListener('click', closeChat);

    if (minimizeBtn) {
      minimizeBtn.addEventListener('click', function() {
        const chatWindow = document.getElementById('teulyChatWindow');
        if (!chatWindow) return;
        minimized = !minimized;
        chatWindow.style.height = minimized ? '72px' : '600px';
        chatWindow.style.overflow = minimized ? 'hidden' : 'visible';
      });
    }

    const refreshBtn = document.getElementById('teulyRefreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function() {
        const messagesEl = document.getElementById('teulyMessages');
        if (messagesEl) messagesEl.innerHTML = '';
        showWelcomeMessage();
      });
    }

    renderFaqs();
  }

  function renderFaqs() {
    const qrContainer = document.getElementById('teulyQuickReplies');
    if (!qrContainer) return;
    qrContainer.innerHTML = '';
    
    FAQS.forEach((faq) => {
      const btn = document.createElement('button');
      btn.className = 'teuly-qr';
      btn.textContent = faq.q;
      btn.addEventListener('click', () => handleFaqSelection(faq));
      qrContainer.appendChild(btn);
    });
  }

  function handleFaqSelection(faq: FAQ) {
    appendMessage('user', faq.q);
    
    const typing = appendTyping();
    
    setTimeout(() => {
      if (typing) typing.remove();
      appendMessage('bot', faq.a);
      const messagesEl = document.getElementById('teulyMessages');
      if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
    }, 600);
  }

  function appendMessage(role: string, text: string) {
    const messagesEl = document.getElementById('teulyMessages');
    if (!messagesEl) return;
    const div = document.createElement('div');
    div.className = 'teuly-msg teuly-msg-' + role;
    const bubble = document.createElement('div');
    bubble.className = 'teuly-bubble';
    bubble.textContent = text;
    const time = document.createElement('div');
    time.className = 'teuly-timestamp';
    time.textContent = getTime();
    div.appendChild(bubble);
    div.appendChild(time);
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function appendTyping() {
    const messagesEl = document.getElementById('teulyMessages');
    if (!messagesEl) return;
    const div = document.createElement('div');
    div.className = 'teuly-msg teuly-msg-bot';
    div.innerHTML = '<div class="teuly-bubble teuly-typing"><span></span><span></span><span></span></div>';
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function showWelcomeMessage() {
    appendMessage('bot',
      '👋 Hello! Welcome to Teuly IT Solutions Support.\n\nPlease select a question below to learn more about our services and company:'
    );
  }

  function getTime() {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initListeners);
  } else {
    initListeners();
  }

})();
