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
    return { today: [], tomorrow: [] };
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
    
    container.innerHTML = jobs.map(job => {
        // Escape values for HTML attributes
        const number = escapeHtml(job.jobNumber || '');
        const name = escapeHtml(job.jobName || '');
        const desc = escapeHtml(job.description || '');
        const status = job.status || 'In Progress';
        const withClient = job.withClient || false;
        const update = escapeHtml(job.update || '');
        const updateDue = job.updateDue || '';
        
        return `
        <div class="job-item" onclick="openJob('${number}', this)" 
             data-name="${name}" 
             data-desc="${desc}" 
             data-status="${status}" 
             data-with-client="${withClient}"
             data-update="${update}"
             data-update-due="${updateDue}">
            <div class="job-item-header">
                <div class="job-item-number">${number}</div>
                <div class="job-item-status ${withClient ? 'with-client' : ''}">${withClient ? 'With client' : status}</div>
            </div>
            <div class="job-item-name">${name}</div>
            <div class="job-item-desc">${desc || 'No description'}</div>
        </div>
    `}).join('');
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
    
    previousScreen = 'jobs';
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
    if (data.today && data.today.length > 0) {
        html += data.today.map(job => renderTodoItem(job)).join('');
    } else {
        html += '<div class="todo-empty">Nothing due today</div>';
    }
    
    // Tomorrow section
    html += '<div class="todo-title" style="margin-top: 24px;">Tomorrow</div>';
    if (data.tomorrow && data.tomorrow.length > 0) {
        html += data.tomorrow.map(job => renderTodoItem(job)).join('');
    } else {
        html += '<div class="todo-empty">Nothing due tomorrow</div>';
    }
    
    container.innerHTML = html;
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
        
        // If jobs were returned, show them
        if (result.jobs && Array.isArray(result.jobs) && result.jobs.length > 0) {
            const jobsHtml = result.jobs.map(jobNum => {
                // Jobs might be just job numbers (strings) or full objects
                const num = typeof jobNum === 'string' ? jobNum : jobNum.jobNumber;
                return `<div class="job-chip">${escapeHtml(num)}</div>`;
            }).join('');
            container.innerHTML += `<div class="message-jobs">${jobsHtml}</div>`;
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

const QUARTERS = {
    'Q1': ['January', 'February', 'March'],
    'Q2': ['April', 'May', 'June'],
    'Q3': ['July', 'August', 'September'],
    'Q4': ['October', 'November', 'December']
};

function getCurrentMonth() {
    return MONTHS[new Date().getMonth()];
}

function getCurrentQuarter() {
    const month = new Date().getMonth();
    if (month < 3) return 'Q1';
    if (month < 6) return 'Q2';
    if (month < 9) return 'Q3';
    return 'Q4';
}

function getQuarterMonths(quarter) {
    return QUARTERS[quarter] || QUARTERS['Q1'];
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

function getQuarterSpend(quarter) {
    const months = getQuarterMonths(quarter);
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

async function openTracker(code, name) {
    document.getElementById('tracker-title').textContent = name;
    
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
}

function renderTrackerContent(clientCode) {
    const content = document.getElementById('tracker-content');
    const client = trackerClients[clientCode];
    
    if (!client) {
        content.innerHTML = '<div class="todo-empty">No budget data available</div>';
        return;
    }
    
    const currentMonth = getCurrentMonth();
    const currentQuarter = client.currentQuarter || getCurrentQuarter();
    const quarterMonths = getQuarterMonths(currentQuarter);
    
    // Calculate month totals
    const monthBudget = client.committed;
    const monthSpent = getMonthSpend(currentMonth);
    const monthRemaining = monthBudget - monthSpent;
    const monthProgress = monthBudget > 0 ? Math.min((monthSpent / monthBudget) * 100, 100) : 0;
    const monthOver = monthSpent > monthBudget;
    
    // Calculate quarter totals
    const quarterBudget = client.committed * 3;
    const quarterSpent = getQuarterSpend(currentQuarter);
    const quarterRemaining = quarterBudget - quarterSpent;
    const quarterProgress = quarterBudget > 0 ? Math.min((quarterSpent / quarterBudget) * 100, 100) : 0;
    const quarterOver = quarterSpent > quarterBudget;
    
    content.innerHTML = `
        <div class="tracker-card">
            <div class="tracker-period">${currentMonth}</div>
            <div class="tracker-row">
                <span class="tracker-label">Budget</span>
                <span class="tracker-value">${formatCurrency(monthBudget)}</span>
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
        
        <div class="tracker-card">
            <div class="tracker-period">${currentQuarter} (${quarterMonths[0].slice(0,3)} - ${quarterMonths[2].slice(0,3)})</div>
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
        </div>
        
        ${client.rollover > 0 ? `
        <div class="tracker-card rollover">
            <div class="tracker-period">Rollover Credit</div>
            <div class="tracker-row">
                <span class="tracker-label">From last quarter</span>
                <span class="tracker-value remaining">+${formatCurrency(client.rollover)}</span>
            </div>
        </div>
        ` : ''}
    `;
}
