// Dot App - UI Logic

// ==================== 
// State
// ==================== 

let currentPin = '';
let selectedClient = null;
let previousScreen = 'home';

const VALID_PINS = {
    '9871': 'Michael',
    '9262': 'Emma',
    '1919': 'Team'
};

// Mock job data (will be replaced with API calls)
const JOBS = {
    'SKY': [
        { number: 'SKY 018', name: 'Offboarding Journey', desc: 'Simplify and improve Sky Exit Journey', status: 'In Progress', withClient: true },
        { number: 'SKY 042', name: 'Paint the Waterfall', desc: 'Brand campaign creative', status: 'In Progress', withClient: false },
        { number: 'SKY 045', name: 'Broadband Promo', desc: 'Q1 promotional campaign', status: 'On Hold', withClient: false }
    ],
    'TOW': [
        { number: 'TOW 088', name: 'Car Insurance Cross-sell', desc: 'Email sequence for existing customers', status: 'In Progress', withClient: false },
        { number: 'TOW 091', name: 'Policy Refresh', desc: 'Update policy documents for 2026', status: 'In Progress', withClient: false }
    ],
    'ONB': [
        { number: 'ONB 012', name: 'Business Portal Refresh', desc: 'Update B2B customer portal', status: 'In Progress', withClient: false }
    ],
    'ONE': [
        { number: 'ONE 023', name: 'Network Upgrade Comms', desc: 'Customer communications for network changes', status: 'In Progress', withClient: false }
    ],
    'ONS': [
        { number: 'ONS 078', name: 'Simplification Phase 2', desc: 'Internal change management', status: 'In Progress', withClient: true }
    ],
    'EON': [
        { number: 'EON 003', name: 'Fibre Launch Campaign', desc: 'Regional rollout communications', status: 'In Progress', withClient: false }
    ],
    'FIS': [
        { number: 'FIS 025', name: 'Fund Report Design', desc: 'Quarterly report templates', status: 'In Progress', withClient: false }
    ],
    'LAB': [
        { number: 'LAB 055', name: 'Election 26', desc: 'Election campaign materials', status: 'In Progress', withClient: false }
    ],
    'WKA': [],
    'HUN': [
        { number: 'HUN 001', name: 'Dot Platform', desc: 'Internal admin automation', status: 'In Progress', withClient: false }
    ]
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

function validatePin() {
    if (VALID_PINS[currentPin]) {
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
// Client Selection
// ==================== 

function selectClient(code, name) {
    selectedClient = { code, name };
    document.getElementById('jobs-title').textContent = name + ' Jobs';
    renderJobs(code);
    goTo('jobs');
}

function renderJobs(clientCode) {
    const jobs = JOBS[clientCode] || [];
    const container = document.getElementById('job-list');
    
    if (jobs.length === 0) {
        container.innerHTML = '<div class="todo-empty">No active jobs</div>';
        return;
    }
    
    container.innerHTML = jobs.map(job => `
        <div class="job-item" onclick="openJob('${job.number}', '${job.name}', '${job.desc}', '${job.status}', ${job.withClient})">
            <div class="job-item-header">
                <div class="job-item-number">${job.number}</div>
                <div class="job-item-status ${job.withClient ? 'with-client' : ''}">${job.withClient ? 'With client' : job.status}</div>
            </div>
            <div class="job-item-name">${job.name}</div>
            <div class="job-item-desc">${job.desc}</div>
        </div>
    `).join('');
}

// ==================== 
// Job Card
// ==================== 

function openJob(number, name, desc, status, withClient) {
    document.getElementById('card-number').textContent = number;
    document.getElementById('card-name').textContent = name;
    document.getElementById('card-desc').textContent = desc;
    document.getElementById('status-display').textContent = status;
    document.getElementById('with-client-toggle').checked = withClient;
    document.getElementById('update-display').textContent = 'Add an update...';
    document.getElementById('update-display').classList.add('placeholder');
    document.getElementById('update-input').value = '';
    previousScreen = 'jobs';
    goTo('card');
}

function openTodoJob(number, name, desc) {
    document.getElementById('card-number').textContent = number;
    document.getElementById('card-name').textContent = name;
    document.getElementById('card-desc').textContent = desc;
    document.getElementById('update-display').textContent = 'Add an update...';
    document.getElementById('update-display').classList.add('placeholder');
    document.getElementById('update-input').value = '';
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

function saveUpdate() {
    const toast = document.getElementById('toast');
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
        goTo(previousScreen);
    }, 1500);
}

// ==================== 
// Tracker
// ==================== 

function openTracker(code, name) {
    document.getElementById('tracker-title').textContent = name;
    goTo('tracker-view');
}

// ==================== 
// Ask Dot
// ==================== 

function sendMessage() {
    const input = document.getElementById('ask-input');
    const message = input.value.trim();
    if (!message) return;
    
    const container = document.getElementById('ask-messages');
    container.innerHTML += `<div class="message user">${message}</div>`;
    input.value = '';
    
    // TODO: Replace with actual API call to Brain /hub endpoint
    setTimeout(() => {
        container.innerHTML += `<div class="message dot">I'd tell you, but this is just a prototype. The real Dot lives in the Hub!</div>`;
        container.scrollTop = container.scrollHeight;
    }, 800);
    
    container.scrollTop = container.scrollHeight;
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
