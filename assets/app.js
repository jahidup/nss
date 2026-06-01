document.addEventListener('DOMContentLoaded', () => {
  initGlobalNavigation();
  initHomeSlider();
  initFloatingWidget();
  initChatbot();
  initQuestionSolver();
  initResultChecker();
  initGalleryPage();
  initFaqAccordion();
  initContactForm();
  initEnrollForm();
  initAssistantPage();
  initAdminAuth();
  initAdminDashboard();
});

// ---------------- 1. GLOBAL NAVIGATION & HELPER FUNCTIONS ----------------

function initGlobalNavigation() {
  const hamburger = document.querySelector('.hamburger');
  const navMenu = document.querySelector('.nav-menu');
  const navLinks = document.querySelectorAll('.nav-link');

  if (hamburger && navMenu) {
    // Toggle Mobile menu
    hamburger.addEventListener('click', () => {
      navMenu.classList.toggle('active');
      hamburger.classList.toggle('active');
    });

    // Close on nav link click
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('active');
        hamburger.classList.remove('active');
      });
    });

    // Close when clicking outside header
    document.addEventListener('click', (e) => {
      const header = document.querySelector('header');
      if (header && !header.contains(e.target)) {
        navMenu.classList.remove('active');
        hamburger.classList.remove('active');
      }
    });
  }

  // Set active link based on window location
  const currentPath = window.location.pathname;
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPath || (currentPath === '/' && href === 'index.html')) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

// Simple Markdown Parser Helper
function parseMarkdown(text) {
  if (!text) return '';
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Headers
  html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
  
  // Code Blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
    return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
  });
  
  // Strong / Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Bullet Lists
  html = html.replace(/^\s*[-*]\s+(.*?)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*?<\/li>)+/g, '<ul>$&</ul>');
  
  // Linebreaks
  html = html.replace(/\n/g, '<br>');
  
  return html;
}

// ---------------- 2. HOME SLIDER (FADE SLIDESHOW) ----------------

function initHomeSlider() {
  const slides = document.querySelectorAll('.hero-slider-container .slide');
  if (slides.length === 0) return;

  let currentSlide = 0;
  setInterval(() => {
    slides[currentSlide].classList.remove('active');
    currentSlide = (currentSlide + 1) % slides.length;
    slides[currentSlide].classList.add('active');
  }, 5000);
}

// ---------------- 3. FLOATING SCROLL WIDGETS ----------------

function initFloatingWidget() {
  const floatContainer = document.querySelector('.floating-container');
  if (!floatContainer) return;
  // Ensure accessibility
}

// ---------------- 4. CHATBOT STREAMING (SANKALP SATHI) ----------------

function initChatbot() {
  const chatMessages = document.getElementById('chat-messages');
  const chatInput = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send-btn');
  const chatForm = document.getElementById('chat-form-container');
  const quickChips = document.querySelectorAll('.chat-chips .chip');

  if (!chatMessages) return;

  let conversationHistory = [];

  const addMessage = (role, text) => {
    const bubble = document.createElement('div');
    bubble.classList.add('message-bubble', role === 'user' ? 'message-user' : 'message-bot');
    
    if (role === 'user') {
      bubble.textContent = text;
    } else {
      bubble.innerHTML = parseMarkdown(text);
    }
    
    chatMessages.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return bubble;
  };

  const showTypingIndicator = () => {
    const indicator = document.createElement('div');
    indicator.classList.add('message-bubble', 'message-bot', 'typing-indicator-bubble');
    indicator.innerHTML = `<div class="typing-dots"><span></span><span></span><span></span></div>`;
    chatMessages.appendChild(indicator);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return indicator;
  };

  const submitMessage = async (text) => {
    if (!text.trim()) return;
    addMessage('user', text);
    conversationHistory.push({ role: 'user', content: text });

    if (chatInput) chatInput.value = '';

    const typingIndicator = showTypingIndicator();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: conversationHistory })
      });

      typingIndicator.remove();

      if (!response.ok) {
        addMessage('bot', 'I am facing connectivity issues at the moment. Please try again.');
        return;
      }

      // Read chunk streams
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantBubble = addMessage('bot', '');
      let assistantText = '';
      let streamBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        streamBuffer += decoder.decode(value, { stream: true });

        const lines = streamBuffer.split('\n');
        streamBuffer = lines.pop();

        for (const line of lines) {
          const cleanedLine = line.trim();
          if (cleanedLine.startsWith('data: ')) {
            const dataPayload = cleanedLine.slice(6).trim();
            if (dataPayload === '[DONE]') continue;
            try {
              const json = JSON.parse(dataPayload);
              const content = json.choices?.[0]?.delta?.content || '';
              if (content) {
                assistantText += content;
                assistantBubble.innerHTML = parseMarkdown(assistantText) + '<span class="blinking-cursor">|</span>';
                chatMessages.scrollTop = chatMessages.scrollHeight;
              }
            } catch (e) {
              // Fail silently for heartbeat lines
            }
          }
        }
      }

      // Remove blinking cursor at end
      const cursor = assistantBubble.querySelector('.blinking-cursor');
      if (cursor) cursor.remove();

      conversationHistory.push({ role: 'assistant', content: assistantText });

    } catch (err) {
      typingIndicator.remove();
      addMessage('bot', 'An unexpected error occurred while communicating with the assistant.');
    }
  };

  if (sendBtn && chatInput) {
    sendBtn.addEventListener('click', () => submitMessage(chatInput.value));
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') submitMessage(chatInput.value);
    });
  }

  // Quick Chips interaction
  quickChips.forEach(chip => {
    chip.addEventListener('click', () => {
      submitMessage(chip.textContent.trim());
    });
  });

  // Lead capture in chatbot page
  const leadForm = document.getElementById('chat-lead-form');
  if (leadForm) {
    leadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = leadForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Analyzing...';

      const payload = {
        firstName: document.getElementById('lead-name').value,
        class: document.getElementById('lead-class').value,
        interest: document.getElementById('lead-interest').value,
        phone: document.getElementById('lead-phone').value,
        city: document.getElementById('lead-city').value,
        parentName: document.getElementById('lead-parent').value,
        email: document.getElementById('lead-email').value
      };

      try {
        const response = await fetch('/api/lead', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (response.ok) {
          const successBox = document.createElement('div');
          successBox.style.color = '#059669';
          successBox.style.marginTop = '1rem';
          successBox.style.fontWeight = '600';
          successBox.textContent = `Lead assessment completed! AI score: ${data.leadScore}/100. Our counselors will call you shortly.`;
          leadForm.appendChild(successBox);
          leadForm.reset();
        } else {
          alert(data.error || 'Failed to submit details');
        }
      } catch (err) {
        alert('Connectivity failure. Please try again.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Details';
      }
    });
  }
}

// ---------------- 5. AI QUESTION SOLVER (TABS & UPLOADS) ----------------

function initQuestionSolver() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');
  const zoneImg = document.getElementById('dropzone-image');
  const zonePdf = document.getElementById('dropzone-pdf');
  const fileImg = document.getElementById('file-image');
  const filePdf = document.getElementById('file-pdf');
  const previewImg = document.getElementById('preview-image');
  const previewPdf = document.getElementById('preview-pdf');

  // Tab switcher
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPanel = document.getElementById(btn.getAttribute('data-tab'));
      if (targetPanel) targetPanel.classList.add('active');
    });
  });

  // Dropzone helper triggers
  const setupDropzone = (zone, fileInput, previewBox) => {
    if (!zone || !fileInput) return;

    zone.addEventListener('click', () => fileInput.click());
    
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('dragover');
    });

    zone.addEventListener('dragleave', () => {
      zone.classList.remove('dragover');
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
      if (e.dataTransfer.files.length) {
        fileInput.files = e.dataTransfer.files;
        handleFileSelect(fileInput.files[0], previewBox);
      }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files.length) {
        handleFileSelect(fileInput.files[0], previewBox);
      }
    });
  };

  const handleFileSelect = (file, previewBox) => {
    if (!previewBox) return;
    previewBox.style.display = 'flex';
    if (file.type.startsWith('image/')) {
      const img = previewBox.querySelector('img') || document.createElement('img');
      img.src = URL.createObjectURL(file);
      previewBox.innerHTML = '';
      previewBox.appendChild(img);
    } else {
      previewBox.innerHTML = `<p style="font-weight:600; color:var(--primary);">📄 ${file.name} (${(file.size/1024/1024).toFixed(2)} MB)</p>`;
    }
  };

  setupDropzone(zoneImg, fileImg, previewImg);
  setupDropzone(zonePdf, filePdf, previewPdf);

  // Forms submission handlers
  const handleSolveSubmit = (formId, fileInput, textInputId, type) => {
    const form = document.getElementById(formId);
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const outputDiv = document.getElementById('solution-output');
      const submitBtn = form.querySelector('button[type="submit"]');

      submitBtn.disabled = true;
      submitBtn.textContent = 'Generating solution...';

      if (outputDiv) {
        outputDiv.innerHTML = `<div style="text-align:center;"><div class="typing-dots" style="justify-content:center; margin-bottom:1rem;"><span></span><span></span><span></span></div><p>Sankalp AI is thinking. Please hold on...</p></div>`;
      }

      const formData = new FormData();
      formData.append('type', type);
      
      const txtVal = document.getElementById(textInputId)?.value;
      if (txtVal) formData.append('question', txtVal);

      if (fileInput && fileInput.files.length) {
        formData.append('file', fileInput.files[0]);
      }

      try {
        const response = await fetch('/api/solve-question', {
          method: 'POST',
          body: formData
        });

        const data = await response.json();
        if (response.ok) {
          outputDiv.innerHTML = `
            <div style="border-left: 4px solid var(--primary); padding-left: 1.5rem; background: var(--off-white); padding: 1.5rem; border-radius: var(--radius-sm);">
              <h3 style="margin-bottom:1rem; color:var(--navy);">Step-by-step Solution:</h3>
              <div class="solution-text">${parseMarkdown(data.answer)}</div>
            </div>
          `;
        } else {
          outputDiv.innerHTML = `<p style="color:#dc2626;">Error: ${data.error}</p>`;
        }
      } catch (err) {
        outputDiv.innerHTML = `<p style="color:#dc2626;">Network connectivity failure solving this question.</p>`;
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Resolve Question';
      }
    });
  };

  handleSolveSubmit('solve-text-form', null, 'question-text', 'text');
  handleSolveSubmit('solve-image-form', fileImg, 'question-image-txt', 'image');
  handleSolveSubmit('solve-pdf-form', filePdf, 'question-pdf-txt', 'pdf');
}

// ---------------- 6. PUBLIC RESULT CHECKER ----------------

function initResultChecker() {
  const checkForm = document.getElementById('result-check-form');
  const marksheetContainer = document.getElementById('marksheet-container');

  if (!checkForm) return;

  checkForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const regNo = document.getElementById('reg-no').value;
    const dob = document.getElementById('dob').value;
    const submitBtn = checkForm.querySelector('button[type="submit"]');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Searching...';

    try {
      const response = await fetch('/api/result/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationNumber: regNo, dob })
      });

      const data = await response.json();

      if (response.ok) {
        const student = data.result;
        marksheetContainer.innerHTML = `
          <div class="marksheet-wrapper fade-in-up">
            <div class="marksheet-watermark">SDP</div>
            <div class="marksheet-header">
              <h2>Sankalp Digital Pathshala</h2>
              <p>Academic Excellence marksheets and Reports</p>
              <div style="font-weight:bold; color:var(--primary); margin-top:0.5rem;">VERIFIED ONLINE REPORT</div>
            </div>
            <div class="marksheet-body">
              <div class="marksheet-details">
                <div class="marksheet-info-grid">
                  <div class="marksheet-label">Reg. Number:</div>
                  <div class="marksheet-val">${student.registrationNumber}</div>

                  <div class="marksheet-label">Student Name:</div>
                  <div class="marksheet-val">${student.studentName}</div>

                  <div class="marksheet-label">Father's Name:</div>
                  <div class="marksheet-val">${student.fatherName}</div>

                  <div class="marksheet-label">Date of Birth:</div>
                  <div class="marksheet-val">${student.dob}</div>
                </div>
                <div class="marksheet-photo-box">
                  ${student.photo ? `<img src="${student.photo}" alt="Student Photo">` : '<span>NO PHOTO UPLOADED</span>'}
                </div>
              </div>

              <table class="marksheet-table">
                <thead>
                  <tr>
                    <th>Report Grade</th>
                    <th>Academic Remarks / Comments</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="font-size:1.8rem; font-weight:800; text-align:center;">${student.grade}</td>
                    <td>${student.remarks || 'Satisfactory academic progress.'}</td>
                  </tr>
                </tbody>
              </table>

              <div class="verified-stamp">VERIFIED PORTAL</div>
              <div class="marksheet-signatures">
                <div class="signature-line">Controller of Exams</div>
              </div>
            </div>
          </div>
          <div style="text-align:center; margin-top:2.5rem;">
            <button class="btn btn-primary" onclick="window.print()"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z"/></svg> Print Report Card</button>
          </div>
        `;
        marksheetContainer.scrollIntoView({ behavior: 'smooth' });
      } else {
        alert(data.error);
        marksheetContainer.innerHTML = `<p style="text-align:center; color:#dc2626; font-weight:600; margin-top:2rem;">${data.error}</p>`;
      }
    } catch (err) {
      alert('Failed to retrieve marksheet records.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Search Result';
    }
  });
}

// ---------------- 7. GALLERY LIGHTBOX & FILTERING ----------------

function initGalleryPage() {
  const filterInput = document.getElementById('gallery-search');
  const items = document.querySelectorAll('.gallery-item');
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxCaption = document.getElementById('lightbox-caption');

  if (items.length === 0) return;

  let activeIndex = 0;
  const activeList = [];

  // Filter caption logic
  if (filterInput) {
    filterInput.addEventListener('input', (e) => {
      const val = e.target.value.toLowerCase();
      items.forEach(item => {
        const cap = item.getAttribute('data-caption').toLowerCase();
        if (cap.includes(val)) {
          item.style.display = 'block';
        } else {
          item.style.display = 'none';
        }
      });
    });
  }

  // Populate activeList
  const refreshActiveList = () => {
    activeList.length = 0;
    items.forEach(item => {
      if (item.style.display !== 'none') {
        activeList.push(item);
      }
    });
  };

  const showLightbox = (index) => {
    refreshActiveList();
    if (activeList.length === 0) return;
    
    // Bounds check
    if (index < 0) index = activeList.length - 1;
    if (index >= activeList.length) index = 0;
    
    activeIndex = index;
    const targetItem = activeList[activeIndex];
    
    if (lightbox && lightboxImg && lightboxCaption) {
      lightboxImg.src = targetItem.querySelector('img').src;
      lightboxCaption.textContent = targetItem.getAttribute('data-caption');
      lightbox.style.display = 'flex';
    }
  };

  items.forEach((item, idx) => {
    item.addEventListener('click', () => {
      refreshActiveList();
      const currentIdxInActive = activeList.indexOf(item);
      showLightbox(currentIdxInActive);
    });
  });

  const closeBtn = document.querySelector('.lightbox-close');
  const prevBtn = document.querySelector('.lightbox-prev');
  const nextBtn = document.querySelector('.lightbox-next');

  if (closeBtn) closeBtn.addEventListener('click', () => lightbox.style.display = 'none');
  if (prevBtn) prevBtn.addEventListener('click', () => showLightbox(activeIndex - 1));
  if (nextBtn) nextBtn.addEventListener('click', () => showLightbox(activeIndex + 1));

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (lightbox && lightbox.style.display === 'flex') {
      if (e.key === 'Escape') lightbox.style.display = 'none';
      if (e.key === 'ArrowLeft') showLightbox(activeIndex - 1);
      if (e.key === 'ArrowRight') showLightbox(activeIndex + 1);
    }
  });
}

// ---------------- 8. FAQ ACCORDION ----------------

function initFaqAccordion() {
  const triggers = document.querySelectorAll('.faq-trigger');
  triggers.forEach(trigger => {
    trigger.addEventListener('click', () => {
      const item = trigger.closest('.faq-item');
      const isActive = item.classList.contains('active');
      
      // Close all other elements
      document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('active'));
      
      if (!isActive) {
        item.classList.add('active');
      }
    });
  });

  // Filter FAQ questions
  const searchInput = document.getElementById('faq-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      document.querySelectorAll('.faq-item').forEach(item => {
        const questionText = item.querySelector('.faq-trigger').textContent.toLowerCase();
        const answerText = item.querySelector('.faq-answer').textContent.toLowerCase();
        if (questionText.includes(query) || answerText.includes(query)) {
          item.style.display = 'block';
        } else {
          item.style.display = 'none';
        }
      });
    });
  }
}

// ---------------- 9. CONTACT FORM ----------------

function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Submitting...';

    const payload = {
      fullName: document.getElementById('contact-name').value,
      email: document.getElementById('contact-email').value,
      mobile: document.getElementById('contact-mobile').value,
      subject: document.getElementById('contact-subject').value,
      message: document.getElementById('contact-message').value
    };

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        alert('Thank you for contacting us! We will get back to you shortly.');
        form.reset();
      } else {
        alert(data.error || 'Submission failed.');
      }
    } catch (err) {
      alert('Connection error. Please try again.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Send Message';
    }
  });
}

// ---------------- 10. ENROLL FORM ----------------

function initEnrollForm() {
  const form = document.getElementById('enroll-form');
  if (!form) return;

  const steps = document.querySelectorAll('.step-indicator .step');
  const panels = document.querySelectorAll('.enroll-step-panel');
  const prevBtn = document.getElementById('prev-step');
  const nextBtn = document.getElementById('next-step');
  let currentStep = 0;

  const updateSteps = () => {
    panels.forEach((p, idx) => {
      p.style.display = idx === currentStep ? 'block' : 'none';
    });
    steps.forEach((s, idx) => {
      if (idx <= currentStep) s.classList.add('active');
      else s.classList.remove('active');
    });

    if (currentStep === 0) {
      prevBtn.style.visibility = 'hidden';
      nextBtn.textContent = 'Next Step';
    } else if (currentStep === panels.length - 1) {
      prevBtn.style.visibility = 'visible';
      nextBtn.textContent = 'Submit Registration';
    } else {
      prevBtn.style.visibility = 'visible';
      nextBtn.textContent = 'Next Step';
    }
  };

  if (nextBtn) {
    updateSteps();

    nextBtn.addEventListener('click', async () => {
      // Validate active step inputs
      const activeInputs = panels[currentStep].querySelectorAll('[required]');
      let valid = true;
      activeInputs.forEach(i => {
        if (!i.value.trim()) {
          valid = false;
          i.style.borderColor = '#dc2626';
        } else {
          i.style.borderColor = 'var(--border)';
        }
      });

      if (!valid) {
        alert('Please fill out all required fields.');
        return;
      }

      if (currentStep < panels.length - 1) {
        currentStep++;
        updateSteps();
      } else {
        // Submit
        nextBtn.disabled = true;
        nextBtn.textContent = 'Submitting...';

        const payload = {
          fullName: document.getElementById('student-name').value,
          email: document.getElementById('student-email').value,
          mobile: document.getElementById('student-mobile').value,
          subject: `Enrollment in Course: ${document.getElementById('student-course').value}`,
          message: `Class: ${document.getElementById('student-class').value}. Parent Name: ${document.getElementById('parent-name').value}. City: ${document.getElementById('student-city').value}. Additional note: ${document.getElementById('student-msg').value}`
        };

        try {
          const res = await fetch('/api/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          if (res.ok) {
            alert('Enrollment registration submitted! Our academic counselor will call you within 24 hours.');
            form.reset();
            currentStep = 0;
            updateSteps();
          } else {
            alert(data.error);
          }
        } catch (err) {
          alert('Network failure submitting registration.');
        } finally {
          nextBtn.disabled = false;
        }
      }
    });

    prevBtn.addEventListener('click', () => {
      if (currentStep > 0) {
        currentStep--;
        updateSteps();
      }
    });
  }
}

// ---------------- 11. AI ASSISTANT PAGE (MENTOR, SOLVER, STUDY PLAN) ----------------

function initAssistantPage() {
  const planForm = document.getElementById('study-plan-form');
  const planOutput = document.getElementById('plan-output');

  if (!planForm) return;

  planForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const examClass = document.getElementById('plan-class').value;
    const hours = document.getElementById('plan-hours').value;
    const weakAreas = document.getElementById('plan-weakness').value;

    planOutput.innerHTML = `
      <div class="card card-glass fade-in-up" style="background:#fff; border-top: 4px solid var(--primary);">
        <h3 style="margin-bottom: 1.5rem; display:flex; align-items:center; gap:0.5rem;">🎯 Your Personalized AI Study Plan</h3>
        <p style="margin-bottom: 1.25rem;">Custom schedule generated for <strong>${examClass}</strong> studying <strong>${hours} hours/day</strong>. Focusing on key weak areas: <strong>${weakAreas}</strong>.</p>
        
        <table class="marksheet-table" style="width:100%; border: 1px solid var(--border);">
          <thead>
            <tr style="background:var(--off-white); border-bottom:2px solid var(--border);">
              <th style="border: 1px solid var(--border); color:var(--navy);">Session / Time</th>
              <th style="border: 1px solid var(--border); color:var(--navy);">Activity Details</th>
              <th style="border: 1px solid var(--border); color:var(--navy);">Objective / Focus</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border:1px solid var(--border); font-weight:600;">Morning Boost (1.5h)</td>
              <td style="border:1px solid var(--border);">Revision of tough concepts & weak topics: ${weakAreas}</td>
              <td style="border:1px solid var(--border);">Fresh memory consolidation</td>
            </tr>
            <tr>
              <td style="border:1px solid var(--border); font-weight:600;">Afternoon Practice (2h)</td>
              <td style="border:1px solid var(--border);">Solve 15-20 Topic-wise Practice Questions on SDP Test Series</td>
              <td style="border:1px solid var(--border);">Speed & accuracy benchmarking</td>
            </tr>
            <tr>
              <td style="border:1px solid var(--border); font-weight:600;">Evening Revision (1h)</td>
              <td style="border:1px solid var(--border);">AI Mentor Q&A doubt resolution & formula review</td>
              <td style="border:1px solid var(--border);">Doubt clearance</td>
            </tr>
          </tbody>
        </table>
        <div style="margin-top: 1.5rem; text-align:right;">
          <button class="btn btn-outline" onclick="window.print()">Print Study Plan</button>
        </div>
      </div>
    `;
    planOutput.scrollIntoView({ behavior: 'smooth' });
  });
}

// ---------------- 12. ADMIN AUTHENTICATION MANAGEMENT ----------------

function initAdminAuth() {
  const loginForm = document.getElementById('admin-login-form');
  if (!loginForm) return;

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    const btn = loginForm.querySelector('button');

    btn.disabled = true;
    btn.textContent = 'Verifying credentials...';

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass })
      });
      const data = await res.json();
      if (res.ok) {
        window.location.href = '/admin-dashboard.html';
      } else {
        alert(data.error || 'Authentication failure');
      }
    } catch (err) {
      alert('Internal Server Error connecting to login node.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  });

  const logoutBtn = document.getElementById('admin-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await fetch('/api/admin/logout', { method: 'POST' });
        window.location.href = '/admin-login.html';
      } catch (e) {
        window.location.href = '/admin-login.html';
      }
    });
  }
}

// ---------------- 13. ADMIN CRM DASHBOARD DYNAMICS ----------------

async function initAdminDashboard() {
  const dashboardStats = document.getElementById('admin-stats-row');
  if (!dashboardStats) return;

  // Protect Admin views
  try {
    const authRes = await fetch('/api/admin/check-auth');
    if (!authRes.ok) {
      window.location.href = '/admin-login.html';
      return;
    }
  } catch (err) {
    window.location.href = '/admin-login.html';
    return;
  }

  // Load Dashboard Numbers
  const loadStats = async () => {
    try {
      const res = await fetch('/api/admin/dashboard');
      if (res.ok) {
        const stats = await res.json();
        const leadsCnt = document.getElementById('stat-leads-val');
        const inquiriesCnt = document.getElementById('stat-inquiries-val');
        const resultsCnt = document.getElementById('stat-results-val');

        if (leadsCnt) leadsCnt.textContent = stats.leads;
        if (inquiriesCnt) inquiriesCnt.textContent = stats.inquiries.total;
        if (resultsCnt) resultsCnt.textContent = stats.results;
      }
    } catch (e) {
      console.error('Failed to load dashboard metrics.');
    }
  };
  loadStats();

  // Load Leads Table
  const leadsTable = document.getElementById('leads-tbody');
  if (leadsTable) {
    const loadLeads = async () => {
      try {
        const res = await fetch('/api/admin/leads');
        const leads = await res.json();
        leadsTable.innerHTML = '';
        leads.forEach(lead => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><strong>${lead.firstName}</strong></td>
            <td>Class ${lead.class}</td>
            <td>${lead.phone}</td>
            <td><span class="badge ${lead.leadScore >= 75 ? 'badge-converted' : 'badge-contacted'}">${lead.leadScore}/100</span></td>
            <td><span class="badge badge-${lead.status}">${lead.status}</span></td>
            <td>
              <select onchange="updateLeadStatus('${lead._id}', this.value)" class="form-control" style="width:auto; display:inline-block; padding:0.25rem;">
                <option value="pending" ${lead.status === 'pending' ? 'selected' : ''}>Pending</option>
                <option value="contacted" ${lead.status === 'contacted' ? 'selected' : ''}>Contacted</option>
                <option value="converted" ${lead.status === 'converted' ? 'selected' : ''}>Converted</option>
              </select>
              <button onclick="deleteLead('${lead._id}')" class="btn btn-outline" style="padding:0.25rem 0.5rem; color:#dc2626; border-color:#dc2626; font-size:0.8rem; margin-left:0.5rem;">Delete</button>
            </td>
          `;
          leadsTable.appendChild(tr);
        });
      } catch (err) {
        console.error('Failed to load leads list');
      }
    };
    loadLeads();

    window.updateLeadStatus = async (id, status) => {
      try {
        const res = await fetch(`/api/admin/leads/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status })
        });
        if (res.ok) loadLeads();
      } catch (err) { alert('Failed to update status'); }
    };

    window.deleteLead = async (id) => {
      if (!confirm('Are you sure you want to delete this lead?')) return;
      try {
        const res = await fetch(`/api/admin/leads/${id}`, { method: 'DELETE' });
        if (res.ok) loadLeads();
      } catch (err) { alert('Failed to delete lead'); }
    };
  }

  // Load Inquiries Table
  const inquiriesTable = document.getElementById('inquiries-tbody');
  if (inquiriesTable) {
    const loadInquiries = async () => {
      try {
        const res = await fetch('/api/admin/inquiries');
        const inquiries = await res.json();
        inquiriesTable.innerHTML = '';
        inquiries.forEach(inq => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><strong>${inq.fullName}</strong></td>
            <td>${inq.mobile}</td>
            <td>${inq.subject}</td>
            <td><span class="badge badge-${inq.status}">${inq.status}</span></td>
            <td>
              <select onchange="updateInquiryStatus('${inq._id}', this.value)" class="form-control" style="width:auto; display:inline-block; padding:0.25rem;">
                <option value="new" ${inq.status === 'new' ? 'selected' : ''}>New</option>
                <option value="contacted" ${inq.status === 'contacted' ? 'selected' : ''}>Contacted</option>
                <option value="closed" ${inq.status === 'closed' ? 'selected' : ''}>Closed</option>
              </select>
              <button onclick="deleteInquiry('${inq._id}')" class="btn btn-outline" style="padding:0.25rem 0.5rem; color:#dc2626; border-color:#dc2626; font-size:0.8rem; margin-left:0.5rem;">Delete</button>
            </td>
          `;
          inquiriesTable.appendChild(tr);
        });
      } catch (e) { console.error('Failed to load inquiries list'); }
    };
    loadInquiries();

    window.updateInquiryStatus = async (id, status) => {
      try {
        const res = await fetch(`/api/admin/inquiries/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status })
        });
        if (res.ok) loadInquiries();
      } catch (err) { alert('Failed to update status'); }
    };

    window.deleteInquiry = async (id) => {
      if (!confirm('Are you sure you want to delete this Inquiry?')) return;
      try {
        const res = await fetch(`/api/admin/inquiries/${id}`, { method: 'DELETE' });
        if (res.ok) loadInquiries();
      } catch (err) { alert('Failed to delete Inquiry'); }
    };
  }

  // Gallery Manager Form inside Admin
  const galForm = document.getElementById('admin-gallery-form');
  if (galForm) {
    galForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fileInput = document.getElementById('gal-image');
      const caption = document.getElementById('gal-caption').value;
      const btn = galForm.querySelector('button');

      if (!fileInput.files.length) {
        alert('Please select an image file to upload.');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Uploading to Cloudinary...';

      const formData = new FormData();
      formData.append('image', fileInput.files[0]);
      formData.append('caption', caption);

      try {
        const res = await fetch('/api/admin/gallery', {
          method: 'POST',
          body: formData
        });
        if (res.ok) {
          alert('Photo uploaded successfully!');
          galForm.reset();
          loadAdminGallery();
        } else {
          alert('Upload failed.');
        }
      } catch (err) {
        alert('Server connection error.');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Upload to Gallery';
      }
    });

    const adminGalContainer = document.getElementById('admin-gallery-grid');
    const loadAdminGallery = async () => {
      if (!adminGalContainer) return;
      try {
        const res = await fetch('/api/public/gallery');
        const list = await res.json();
        adminGalContainer.innerHTML = '';
        list.forEach(item => {
          const card = document.createElement('div');
          card.className = 'card';
          card.style.padding = '1rem';
          card.innerHTML = `
            <img src="${item.imageUrl}" style="width:100%; height:150px; object-fit:cover; border-radius:var(--radius-sm);" alt="">
            <p style="margin: 0.5rem 0; font-size:0.9rem;">${item.caption}</p>
            <button onclick="deleteGalleryItem('${item._id}')" class="btn btn-outline" style="width:100%; color:#dc2626; border-color:#dc2626; padding:0.4rem;">Delete Photo</button>
          `;
          adminGalContainer.appendChild(card);
        });
      } catch (e) { console.error('Failed to load gallery items in dashboard'); }
    };
    loadAdminGallery();

    window.deleteGalleryItem = async (id) => {
      if (!confirm('Are you sure you want to delete this photo?')) return;
      try {
        const res = await fetch(`/api/admin/gallery/${id}`, { method: 'DELETE' });
        if (res.ok) loadAdminGallery();
      } catch (e) { alert('Delete failed'); }
    };
  }

  // Events Manager Form inside Admin
  const evForm = document.getElementById('admin-event-form');
  if (evForm) {
    evForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fileInput = document.getElementById('ev-image');
      const title = document.getElementById('ev-title').value;
      const desc = document.getElementById('ev-desc').value;
      const date = document.getElementById('ev-date').value;
      const btn = evForm.querySelector('button');

      btn.disabled = true;
      btn.textContent = 'Creating Event...';

      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', desc);
      formData.append('date', date);
      if (fileInput.files.length) {
        formData.append('image', fileInput.files[0]);
      }

      try {
        const res = await fetch('/api/admin/events', {
          method: 'POST',
          body: formData
        });
        if (res.ok) {
          alert('Event created!');
          evForm.reset();
          loadAdminEvents();
        }
      } catch (err) { alert('Event creation failed'); }
      finally {
        btn.disabled = false;
        btn.textContent = 'Add Event';
      }
    });

    const adminEventsGrid = document.getElementById('admin-events-grid');
    const loadAdminEvents = async () => {
      if (!adminEventsGrid) return;
      try {
        const res = await fetch('/api/public/events');
        const list = await res.json();
        adminEventsGrid.innerHTML = '';
        list.forEach(item => {
          const card = document.createElement('div');
          card.className = 'card';
          card.style.padding = '1rem';
          card.innerHTML = `
            ${item.image ? `<img src="${item.image}" style="width:100%; height:120px; object-fit:cover; border-radius:var(--radius-sm);">` : ''}
            <h4 style="margin-top:0.5rem;">${item.title}</h4>
            <p style="font-size:0.85rem; margin-bottom:1rem;">Date: ${new Date(item.date).toLocaleDateString()}</p>
            <button onclick="deleteEventItem('${item._id}')" class="btn btn-outline" style="width:100%; color:#dc2626; border-color:#dc2626; padding:0.4rem;">Delete Event</button>
          `;
          adminEventsGrid.appendChild(card);
        });
      } catch (e) { console.error('Failed to load events'); }
    };
    loadAdminEvents();

    window.deleteEventItem = async (id) => {
      if (!confirm('Are you sure you want to delete this event?')) return;
      try {
        const res = await fetch(`/api/admin/events/${id}`, { method: 'DELETE' });
        if (res.ok) loadAdminEvents();
      } catch (e) { alert('Delete failed'); }
    };
  }
}
