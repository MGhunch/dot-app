// Dot App - UI Logic
// Wired to real APIs

// ==================== 
// State
// ==================== 

let currentPin = '';
let selectedClient = null;
let previousScreen = 'home';
let currentUser = null;
let allJobs = [];  // Cache of all jobs for Ask Dot context
let conversationHistory = [];  // Chat history for context

const VALID_PINS = {
    '9871': { name: 'Michael', fullName: 'Michael Goldthorpe' },
    '9262': { name: 'Emma', fullName: 'Emma Moore' },
    '1919': { name: 'Team', fullName: 'Hunch Team' }
};

// ==================== 
// PIN Functions
// ==================== 

function enterPin(digit) {
    if (currentPin.length < 4) {
        currentPin += digit;
        updatePinDisplay();
        
        if (currentPin.length === 4) {
            validatePin();
        }
    }
}

function deletePin() {
    currentPin = currentPin.slice(0, -1);
    updatePinDisplay();
    document.getElementById('pin-error').textContent = '';
}

function updatePinDisplay() {
    for (let i = 0; i < 4; i++) {
        const dot = document.getElementById('dot-' + i);
        dot.classList.toggle('filled', i < currentPin.length);
    }
}

async function validatePin() {
    if (VALID_PINS[currentPin]) {
        currentUser = VALID_PINS[currentPin];
        
        // Call backend to set session
        try {
            await fetch('/auth/pin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin: currentPin })
            });
        } catch (e) {
            console.log('Session set failed (non-blocking):', e);
        }
        
        // Load jobs in background
        loadAllJobs();
        
        goTo('home');
    } else {
        document.getElementById('pin-error').textContent = 'Invalid PIN';
        setTimeout(() => {
            currentPin = '';
            updatePinDisplay();
        }, 300);
    }
}

// ==================== 
// Navigation
// ==================== 

function goTo(screen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screen + '-screen').classList.add('active');
}

// ==================== 
// Data Loading
// ==================== 

async function loadAllJobs() {
    try {
        const response = await fetch('/api/jobs/all');
        if (response.ok) {
            allJobs = await response.json();
            console.log(`[App] Loaded ${allJobs.length} jobs`);
        }
    } catch (e) {
        console.error('[App] Failed to load jobs:', e);
        allJobs = [];
    }
}

async function loadJobsForClient(clientCode) {
    try {
        const response = await fetch(`/api/jobs?client=${clientCode}`);
        if (response.ok) {
            return await response.json();
        }
    } catch (e) {
        console.error(`[App] Failed to load jobs for ${clientCode}:`, e);
    }
    return [];
}

async function loadTodoJobs() {
    try {
        const response = await fetch('/api/todo');
        if (response.ok) {
            return await response.json();
        }
    } catch (e) {
        console.error('[App] Failed to load todo jobs:', e);
    }
    return { today: { meetings: [], jobs: [] }, next: { label: 'Tomorrow', meetings: [], jobs: [] } };
}

// ==================== 
// Client Selection
// ==================== 

async function selectClient(code, name) {
    selectedClient = { code, name };
    document.getElementById('jobs-title').textContent = name + ' Jobs';
    
    // Show loading state
    const container = document.getElementById('job-list');
    container.innerHTML = '<div class="todo-empty">Loading...</div>';
    
    goTo('jobs');
    
    // Fetch and render jobs
    const jobs = await loadJobsForClient(code);
    renderJobs(jobs);
}

function renderJobs(jobs) {
    const container = document.getElementById('job-list');
    
    if (!jobs || jobs.length === 0) {
        container.innerHTML = '<div class="todo-empty">No active jobs</div>';
        return;
    }
    
    container.innerHTML = jobs.map(job => renderJobCard(job)).join('');
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ==================== 
// Job Card Rendering (shared)
// ==================== 

function resolveJobNumber(jobNum) {
    // Find full job object from allJobs cache
    const num = typeof jobNum === 'string' ? jobNum : jobNum.jobNumber;
    return allJobs.find(j => j.jobNumber === num) || { jobNumber: num };
}

function renderJobCard(job, source = 'jobs') {
    // Renders a compact job card - clickable to SUMMARY
    const number = escapeHtml(job.jobNumber || '');
    const name = escapeHtml(job.jobName || '');
    const desc = escapeHtml(job.description || '');
    const status = job.status || 'In Progress';
    const withClient = job.withClient || false;
    const update = escapeHtml(job.update || '');
    const updateDue = job.updateDue || '';
    const theStory = escapeHtml(job.theStory || '');
    const liveDate = escapeHtml(job.liveDate || '');
    const projectOwner = escapeHtml(job.projectOwner || '');
    
    return `
        <div class="job-item" onclick="openSummary('${number}', this, '${source}')" 
             data-name="${name}" 
             data-desc="${desc}" 
             data-status="${status}" 
             data-with-client="${withClient}"
             data-update="${update}"
             data-update-due="${updateDue}"
             data-the-story="${theStory}"
             data-live-date="${liveDate}"
             data-project-owner="${projectOwner}">
            <div class="job-item-header">
                <div class="job-item-number">${number}</div>
                <div class="job-item-status ${withClient ? 'with-client' : ''}">${withClient ? 'With client' : status}</div>
            </div>
            <div class="job-item-name">${name}</div>
            <div class="job-item-desc">${desc || 'No description'}</div>
        </div>
    `;
}

function openJobFrom(number, element, source) {
    previousScreen = source;
    openJob(number, element);
}

// ==================== 
// Summary Card (read-only detail view)
// ==================== 

let currentSummaryJob = null;
let summaryPreviousScreen = 'jobs';

function openSummary(number, element, source) {
    summaryPreviousScreen = source;
    
    // Get data from element attributes
    const name = element?.dataset?.name || '';
    const desc = element?.dataset?.desc || '';
    const status = element?.dataset?.status || 'In Progress';
    const withClient = element?.dataset?.withClient === 'true';
    const update = element?.dataset?.update || '';
    const updateDue = element?.dataset?.updateDue || '';
    const theStory = element?.dataset?.theStory || '';
    const liveDate = element?.dataset?.liveDate || '';
    const projectOwner = element?.dataset?.projectOwner || '';
    
    currentSummaryJob = {
        jobNumber: number,
        jobName: name,
        description: desc,
        status: status,
        withClient: withClient,
        update: update,
        updateDue: updateDue,
        theStory: theStory,
        liveDate: liveDate,
        projectOwner: projectOwner
    };
    
    // Populate summary screen
    document.getElementById('summary-name').textContent = name;
    document.getElementById('summary-number').textContent = number;
    document.getElementById('summary-desc').textContent = desc || 'No description';
    document.getElementById('summary-owner').textContent = projectOwner || 'Unassigned';
    document.getElementById('summary-story').textContent = theStory || 'Still working on it';
    document.getElementById('summary-update').textContent = update || 'No updates yet';
    
    // Format dates
    if (updateDue) {
        const date = new Date(updateDue);
        document.getElementById('summary-due').textContent = date.toLocaleDateString('en-GB', { 
            day: 'numeric', month: 'short', year: 'numeric' 
        });
    } else {
        document.getElementById('summary-due').textContent = 'Not set';
    }
    
    document.getElementById('summary-live').textContent = liveDate || 'TBC';
    
    goTo('summary');
}

function openUpdateFromSummary() {
    // Transfer data to update card
    if (!currentSummaryJob) return;
    
    previousScreen = 'summary';
    
    const job = currentSummaryJob;
    currentJob = { ...job };
    
    document.getElementById('card-number').textContent = job.jobNumber;
    document.getElementById('card-name').textContent = job.jobName;
    document.getElementById('card-desc').textContent = job.description || 'No description';
    document.getElementById('status-display').textContent = job.status;
    document.getElementById('with-client-toggle').checked = job.withClient;
    
    // Set update display
    const updateDisplay = document.getElementById('update-display');
    if (job.update) {
        updateDisplay.textContent = job.update;
        updateDisplay.classList.remove('placeholder');
    } else {
        updateDisplay.textContent = 'Add an update...';
        updateDisplay.classList.add('placeholder');
    }
    document.getElementById('update-input').value = '';
    
    // Set date display
    const dateDisplay = document.getElementById('date-display');
    if (job.updateDue) {
        const date = new Date(job.updateDue);
        dateDisplay.textContent = date.toLocaleDateString('en-GB', { 
            day: 'numeric', month: 'short', year: 'numeric' 
        });
        document.getElementById('date-input').value = job.updateDue;
    } else {
        dateDisplay.textContent = 'Set date...';
        document.getElementById('date-input').value = '';
    }
    
    goTo('card');
}

function goBackFromSummary() {
    goTo(summaryPreviousScreen);
}

// ==================== 
// Job Card
// ==================== 

let currentJob = null;  // Track current job being edited

function openJob(number, element) {
    // Get data from element attributes
    const name = element?.dataset?.name || '';
    const desc = element?.dataset?.desc || '';
    const status = element?.dataset?.status || 'In Progress';
    const withClient = element?.dataset?.withClient === 'true';
    const update = element?.dataset?.update || '';
    const updateDue = element?.dataset?.updateDue || '';
    
    currentJob = {
        jobNumber: number,
        jobName: name,
        description: desc,
        status: status,
        withClient: withClient,
        update: update,
        updateDue: updateDue
    };
    
    document.getElementById('card-number').textContent = number;
    document.getElementById('card-name').textContent = name;
    document.getElementById('card-desc').textContent = desc || 'No description';
    document.getElementById('status-display').textContent = status;
    document.getElementById('with-client-toggle').checked = withClient;
    
    // Set update display
    const updateDisplay = document.getElementById('update-display');
    if (update) {
        updateDisplay.textContent = update;
        updateDisplay.classList.remove('placeholder');
    } else {
        updateDisplay.textContent = 'Add an update...';
        updateDisplay.classList.add('placeholder');
    }
    document.getElementById('update-input').value = '';
    
    // Set date display
    const dateDisplay = document.getElementById('date-display');
    if (updateDue) {
        const date = new Date(updateDue);
        dateDisplay.textContent = date.toLocaleDateString('en-GB', { 
            day: 'numeric', month: 'short', year: 'numeric' 
        });
        document.getElementById('date-input').value = updateDue;
    } else {
        dateDisplay.textContent = 'Set date...';
        document.getElementById('date-input').value = '';
    }
    
    goTo('card');
}

function openTodoJob(number, name, desc, updateDue) {
    currentJob = {
        jobNumber: number,
        jobName: name,
        description: desc,
        updateDue: updateDue
    };
    
    document.getElementById('card-number').textContent = number;
    document.getElementById('card-name').textContent = name;
    document.getElementById('card-desc').textContent = desc || 'No description';
    document.getElementById('update-display').textContent = 'Add an update...';
    document.getElementById('update-display').classList.add('placeholder');
    document.getElementById('update-input').value = '';
    
    // Set date
    const dateDisplay = document.getElementById('date-display');
    if (updateDue) {
        const date = new Date(updateDue);
        dateDisplay.textContent = date.toLocaleDateString('en-GB', { 
            day: 'numeric', month: 'short', year: 'numeric' 
        });
    } else {
        dateDisplay.textContent = 'Set date...';
    }
    
    previousScreen = 'todo';
    goTo('card');
}

// ==================== 
// Modals
// ==================== 

function openModal(type) {
    document.getElementById(type + '-modal').classList.add('active');
    if (type === 'update') {
        setTimeout(() => document.getElementById('update-input').focus(), 100);
    }
}

function closeModal(type) {
    document.getElementById(type + '-modal').classList.remove('active');
}

function saveUpdateText() {
    const value = document.getElementById('update-input').value;
    const display = document.getElementById('update-display');
    display.textContent = value || 'Add an update...';
    display.classList.toggle('placeholder', !value);
    closeModal('update');
}

function saveDate() {
    const value = document.getElementById('date-input').value;
    if (value) {
        const date = new Date(value);
        document.getElementById('date-display').textContent = date.toLocaleDateString('en-GB', { 
            day: 'numeric', month: 'short', year: 'numeric' 
        });
    }
    closeModal('date');
}

function selectStatus(status, element) {
    document.querySelectorAll('.status-option').forEach(opt => opt.classList.remove('selected'));
    element.classList.add('selected');
    document.getElementById('status-display').textContent = status;
    setTimeout(() => closeModal('status'), 150);
}

// ==================== 
// Save Update (Real API)
// ==================== 

async function saveUpdate() {
    if (!currentJob) {
        showToast('No job selected', 'error');
        return;
    }
    
    const jobNumber = currentJob.jobNumber;
    const message = document.getElementById('update-input').value.trim();
    const status = document.getElementById('status-display').textContent;
    const withClient = document.getElementById('with-client-toggle').checked;
    const updateDue = document.getElementById('date-input').value;
    
    // Validation: if posting an update, must set next update due date
    if (message && !updateDue) {
        showToast("When's the update due?", 'error');
        openModal('date');
        return;
    }
    
    // Build payload
    const payload = {
        status: status,
        withClient: withClient
    };
    
    if (updateDue) {
        payload.updateDue = updateDue;
    }
    
    if (message) {
        payload.message = message;
    }
    
    // Show saving state
    showToast('Saving...', 'info');
    
    try {
        const response = await fetch(`/api/job/${encodeURIComponent(jobNumber)}/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            throw new Error('Update failed');
        }
        
        showToast('Updated!', 'success');
        
        // Refresh jobs cache
        loadAllJobs();
        
        // Go back after short delay
        setTimeout(() => {
            goTo(previousScreen);
        }, 1000);
        
    } catch (e) {
        console.error('[App] Update failed:', e);
        showToast("That didn't work", 'error');
    }
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast show ' + type;
    
    if (type !== 'info') {
        setTimeout(() => {
            toast.classList.remove('show');
        }, 2000);
    }
}

// ==================== 
// To Do
// ==================== 

async function loadAndRenderTodo() {
    const container = document.getElementById('todo-list');
    if (!container) return;
    
    container.innerHTML = '<div class="todo-empty">Loading...</div>';
    
    const data = await loadTodoJobs();
    
    let html = '';
    
    // Today section
    html += '<div class="todo-title">Today</div>';
    const todayMeetings = data.today?.meetings || [];
    const todayJobs = data.today?.jobs || [];
    
    if (todayMeetings.length > 0 || todayJobs.length > 0) {
        if (todayMeetings.length > 0) {
            html += '<div class="todo-subtitle">Meetings</div>';
            html += todayMeetings.map(m => renderMeetingCard(m)).join('');
        }
        if (todayJobs.length > 0) {
            html += '<div class="todo-subtitle">Jobs due</div>';
            html += todayJobs.map(job => renderJobCard(job, 'todo')).join('');
        }
    } else {
        html += '<div class="todo-empty">Nothing on today</div>';
    }
    
    // Next workday section
    const nextLabel = data.next?.label || 'Tomorrow';
    const nextMeetings = data.next?.meetings || [];
    const nextJobs = data.next?.jobs || [];
    
    html += `<div class="todo-title" style="margin-top: 24px;">${escapeHtml(nextLabel)}</div>`;
    
    if (nextMeetings.length > 0 || nextJobs.length > 0) {
        if (nextMeetings.length > 0) {
            html += '<div class="todo-subtitle">Meetings</div>';
            html += nextMeetings.map(m => renderMeetingCard(m)).join('');
        }
        if (nextJobs.length > 0) {
            html += '<div class="todo-subtitle">Jobs due</div>';
            html += nextJobs.map(job => renderJobCard(job, 'todo')).join('');
        }
    } else {
        html += `<div class="todo-empty">Nothing on ${escapeHtml(nextLabel.toLowerCase())}</div>`;
    }
    
    container.innerHTML = html;
}

function renderMeetingCard(meeting) {
    const title = escapeHtml(meeting.title || '');
    const location = escapeHtml(meeting.location || '');
    const whose = escapeHtml(meeting.whose || '');
    const startTime = meeting.startTime || '';
    const endTime = meeting.endTime || '';
    const attendees = escapeHtml(meeting.attendees || '');
    
    return `
        <div class="meeting-card" onclick="this.classList.toggle('expanded')">
            <div class="meeting-card-header">
                <div class="meeting-card-time">${startTime} – ${endTime}</div>
                <div class="meeting-card-whose">${whose}</div>
            </div>
            <div class="meeting-card-title">${title}</div>
            ${location ? `<div class="meeting-card-location">📍 ${location}</div>` : ''}
            ${attendees ? `<div class="meeting-card-attendees"><div class="meeting-card-attendees-label">Who's going</div>${attendees}</div>` : ''}
        </div>
    `;
}

function renderTodoItem(job) {
    const number = escapeHtml(job.jobNumber || '');
    const name = escapeHtml(job.jobName || '');
    const desc = escapeHtml(job.description || '');
    const updateDue = job.updateDue || '';
    
    return `
        <div class="todo-item" onclick="openTodoJob('${number}', '${name.replace(/'/g, "\\'")}', '${desc.replace(/'/g, "\\'")}', '${updateDue}')">
            <div class="todo-item-number">${number}</div>
            <div class="todo-item-name">${name}</div>
        </div>
    `;
}

// ==================== 
// Tracker
// ==================== 

async function openTracker(code, name) {
    document.getElementById('tracker-title').textContent = name;
    
    // For now, show placeholder - tracker view needs more work
    goTo('tracker-view');
    
    // TODO: Load and render tracker data
    // const data = await fetch(`/api/tracker?client=${code}`).then(r => r.json());
}

// ==================== 
// Ask Dot (Real API)
// ==================== 

async function sendMessage() {
    const input = document.getElementById('ask-input');
    const message = input.value.trim();
    if (!message) return;
    
    const container = document.getElementById('ask-messages');
    
    // Add user message
    container.innerHTML += `<div class="message user">${escapeHtml(message)}</div>`;
    input.value = '';
    container.scrollTop = container.scrollHeight;
    
    // Add thinking indicator
    container.innerHTML += `<div class="message dot thinking" id="thinking-msg">Thinking...</div>`;
    container.scrollTop = container.scrollHeight;
    
    // Add to history before sending
    conversationHistory.push({ role: 'user', content: message });
    
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: message,
                history: conversationHistory.slice(0, -1)  // Send history without current message
            })
        });
        
        // Remove thinking indicator
        document.getElementById('thinking-msg')?.remove();
        
        if (!response.ok) {
            throw new Error('Chat failed');
        }
        
        const data = await response.json();
        const result = data.response || {};
        const dotMessage = result.message || "I'm not sure how to help with that.";
        
        // Add assistant response to history
        conversationHistory.push({ role: 'assistant', content: dotMessage });
        
        // Keep history manageable
        if (conversationHistory.length > 20) {
            conversationHistory = conversationHistory.slice(-20);
        }
        
        // Render response
        container.innerHTML += `<div class="message dot">${escapeHtml(dotMessage)}</div>`;
        
        // If jobs were returned, show them as full cards
        if (result.jobs && Array.isArray(result.jobs) && result.jobs.length > 0) {
            const jobsHtml = result.jobs.map(jobNum => {
                const job = resolveJobNumber(jobNum);
                return renderJobCard(job, 'ask');
            }).join('');
            container.innerHTML += `<div class="chat-jobs">${jobsHtml}</div>`;
        }
        
        container.scrollTop = container.scrollHeight;
        
    } catch (e) {
        console.error('[App] Chat error:', e);
        
        // Remove thinking indicator
        document.getElementById('thinking-msg')?.remove();
        
        // Remove failed message from history
        conversationHistory.pop();
        
        container.innerHTML += `<div class="message dot">Sorry, I got tangled up. Try again?</div>`;
        container.scrollTop = container.scrollHeight;
    }
}

// ==================== 
// Event Listeners
// ==================== 

document.addEventListener('DOMContentLoaded', () => {
    // Modal overlay click to close
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.classList.remove('active');
        });
    });
    
    // Enter key for chat
    const askInput = document.getElementById('ask-input');
    if (askInput) {
        askInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }
});

// ==================== 
// Navigation helpers (for HTML onclick)
// ==================== 

function goToTodo() {
    loadAndRenderTodo();
    goTo('todo');
}

// ==================== 
// Tracker
// ==================== 

let trackerClients = {};  // Client budget info keyed by code
let trackerData = [];     // Spend records for current client

// Current month and quarter helpers
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 
                'July', 'August', 'September', 'October', 'November', 'December'];

function getCurrentMonth() {
    return MONTHS[new Date().getMonth()];
}

function getCalendarQuarterMonths() {
    // Returns the months for the current calendar quarter
    const month = new Date().getMonth();
    if (month < 3) return ['January', 'February', 'March'];
    if (month < 6) return ['April', 'May', 'June'];
    if (month < 9) return ['July', 'August', 'September'];
    return ['October', 'November', 'December'];
}

async function loadTrackerClients() {
    try {
        const response = await fetch('/api/tracker/clients');
        if (response.ok) {
            const data = await response.json();
            trackerClients = {};
            data.forEach(c => {
                trackerClients[c.code] = {
                    name: c.name,
                    committed: c.committed,
                    rollover: c.rollover || 0,
                    currentQuarter: c.currentQuarter || getCurrentQuarter()
                };
            });
            return true;
        }
    } catch (e) {
        console.error('[App] Failed to load tracker clients:', e);
    }
    return false;
}

async function loadTrackerData(clientCode) {
    try {
        const response = await fetch(`/api/tracker?client=${clientCode}`);
        if (response.ok) {
            trackerData = await response.json();
            return true;
        }
    } catch (e) {
        console.error(`[App] Failed to load tracker data for ${clientCode}:`, e);
    }
    trackerData = [];
    return false;
}

function getMonthSpend(month) {
    return trackerData
        .filter(d => d.month === month)
        .reduce((sum, d) => sum + (d.spend || 0), 0);
}

function getQuarterSpend() {
    // Sum spend for current calendar quarter months
    const months = getCalendarQuarterMonths();
    return trackerData
        .filter(d => months.includes(d.month))
        .reduce((sum, d) => sum + (d.spend || 0), 0);
}

function formatCurrency(amount) {
    if (Math.abs(amount) >= 1000) {
        return '$' + (amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1) + 'K';
    }
    return '$' + Math.abs(amount).toLocaleString();
}

// Tracker state
let currentTrackerClient = null;
let currentMonthIndex = 0;  // 0, 1, 2 within quarter

async function openTracker(code, name) {
    document.getElementById('tracker-title').textContent = name;
    currentTrackerClient = code;
    
    // Reset to current month within quarter
    const quarterMonths = getCalendarQuarterMonths();
    const currentMonth = getCurrentMonth();
    currentMonthIndex = quarterMonths.indexOf(currentMonth);
    if (currentMonthIndex === -1) currentMonthIndex = 0;
    
    // Show loading state
    const content = document.getElementById('tracker-content');
    content.innerHTML = '<div class="todo-empty">Loading...</div>';
    
    goTo('tracker-view');
    
    // Load client info if not already loaded
    if (!trackerClients[code]) {
        await loadTrackerClients();
    }
    
    // Load spend data for this client
    await loadTrackerData(code);
    
    // Render the tracker cards
    renderTrackerContent(code);
    
    // Setup swipe after render
    setupMonthSwipe();
}

function renderTrackerContent(clientCode) {
    const content = document.getElementById('tracker-content');
    const client = trackerClients[clientCode];
    
    if (!client) {
        content.innerHTML = '<div class="todo-empty">No budget data available</div>';
        return;
    }
    
    const quarterMonths = getCalendarQuarterMonths();
    
    // Client's quarter label (e.g., ONE's Q4 = Jan-Mar)
    const currentQuarter = client.currentQuarter || 'Q1';
    
    // Previous quarter for rollover label
    const prevQuarterNum = parseInt(currentQuarter.replace('Q', '')) - 1;
    const prevQuarter = prevQuarterNum < 1 ? 'Q4' : 'Q' + prevQuarterNum;
    
    // Calculate quarter totals
    const quarterBudget = client.committed * 3;
    const quarterSpent = getQuarterSpend();
    const quarterRemaining = quarterBudget - quarterSpent;
    const quarterProgress = quarterBudget > 0 ? Math.min((quarterSpent / quarterBudget) * 100, 100) : 0;
    const quarterOver = quarterSpent > quarterBudget;
    
    // Rollover display
    const rolloverHtml = client.rollover > 0 
        ? `<div class="tracker-rollover">+${prevQuarter} Rollover – ${formatCurrency(client.rollover)}</div>`
        : '';
    
    // Dot indicators
    const dots = quarterMonths.map((_, i) => 
        `<div class="month-dot ${i === currentMonthIndex ? 'active' : ''}" onclick="goToMonth(${i})"></div>`
    ).join('');
    
    content.innerHTML = `
        <div class="tracker-card">
            <div class="tracker-period">${currentQuarter} (${quarterMonths[0].slice(0,3)} – ${quarterMonths[2].slice(0,3)})</div>
            <div class="tracker-row">
                <span class="tracker-label">Budget</span>
                <span class="tracker-value">${formatCurrency(quarterBudget)}</span>
            </div>
            <div class="tracker-row">
                <span class="tracker-label">Spent</span>
                <span class="tracker-value">${formatCurrency(quarterSpent)}</span>
            </div>
            <div class="tracker-row">
                <span class="tracker-label">${quarterOver ? 'Over' : 'Remaining'}</span>
                <span class="tracker-value ${quarterOver ? 'over' : 'remaining'}">${quarterOver ? '-' : ''}${formatCurrency(Math.abs(quarterRemaining))}</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill ${quarterOver ? 'over' : ''}" style="width: ${quarterProgress}%"></div>
            </div>
            <div class="tracker-percent">${Math.round(quarterProgress)}% used</div>
            ${rolloverHtml}
        </div>
        
        <div class="month-card-container" id="month-card-container">
            <div class="month-card-inner" id="month-card-inner">
                ${renderMonthCard(quarterMonths[currentMonthIndex], client.committed)}
            </div>
            <div class="month-dots">${dots}</div>
        </div>
    `;
}

function renderMonthCard(month, committed) {
    const monthSpent = getMonthSpend(month);
    const monthRemaining = committed - monthSpent;
    const monthProgress = committed > 0 ? Math.min((monthSpent / committed) * 100, 100) : 0;
    const monthOver = monthSpent > committed;
    
    return `
        <div class="tracker-card month-card">
            <div class="tracker-period">${month}</div>
            <div class="tracker-row">
                <span class="tracker-label">Budget</span>
                <span class="tracker-value">${formatCurrency(committed)}</span>
            </div>
            <div class="tracker-row">
                <span class="tracker-label">Spent</span>
                <span class="tracker-value">${formatCurrency(monthSpent)}</span>
            </div>
            <div class="tracker-row">
                <span class="tracker-label">${monthOver ? 'Over' : 'Remaining'}</span>
                <span class="tracker-value ${monthOver ? 'over' : 'remaining'}">${monthOver ? '-' : ''}${formatCurrency(Math.abs(monthRemaining))}</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill ${monthOver ? 'over' : ''}" style="width: ${monthProgress}%"></div>
            </div>
            <div class="tracker-percent">${Math.round(monthProgress)}% used</div>
        </div>
    `;
}

function goToMonth(index) {
    const quarterMonths = getCalendarQuarterMonths();
    if (index < 0 || index >= quarterMonths.length) return;
    
    const direction = index > currentMonthIndex ? 'left' : 'right';
    currentMonthIndex = index;
    
    updateMonthCard(direction);
}

function updateMonthCard(direction) {
    const client = trackerClients[currentTrackerClient];
    if (!client) return;
    
    const quarterMonths = getCalendarQuarterMonths();
    const inner = document.getElementById('month-card-inner');
    
    // Add exit animation class
    inner.classList.add(`slide-out-${direction}`);
    
    setTimeout(() => {
        // Update content
        inner.innerHTML = renderMonthCard(quarterMonths[currentMonthIndex], client.committed);
        
        // Update dots
        document.querySelectorAll('.month-dot').forEach((dot, i) => {
            dot.classList.toggle('active', i === currentMonthIndex);
        });
        
        // Setup entry animation
        inner.classList.remove(`slide-out-${direction}`);
        inner.classList.add(`slide-in-${direction}`);
        
        setTimeout(() => {
            inner.classList.remove(`slide-in-${direction}`);
        }, 200);
    }, 150);
}

// Swipe handling
let touchStartX = 0;
let touchEndX = 0;

function setupMonthSwipe() {
    const container = document.getElementById('month-card-container');
    if (!container) return;
    
    container.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    
    container.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });
}

function handleSwipe() {
    const diff = touchStartX - touchEndX;
    const threshold = 50;
    
    if (Math.abs(diff) < threshold) return;
    
    const quarterMonths = getCalendarQuarterMonths();
    
    if (diff > 0 && currentMonthIndex < quarterMonths.length - 1) {
        // Swipe left → next month
        currentMonthIndex++;
        updateMonthCard('left');
    } else if (diff < 0 && currentMonthIndex > 0) {
        // Swipe right → prev month
        currentMonthIndex--;
        updateMonthCard('right');
    }
}
