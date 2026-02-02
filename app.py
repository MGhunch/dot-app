"""
Dot App - Flask Backend
Mobile-first web app for Hunch team.
Mirrors Hub's patterns for consistency.
"""

from flask import Flask, request, jsonify, send_from_directory, session
from flask_cors import CORS
import os
import requests

app = Flask(__name__, static_folder='static')
app.secret_key = os.environ.get('SECRET_KEY', 'dev-secret-key-change-me')
CORS(app)

# ==================== 
# Configuration
# ==================== 

BRAIN_URL = os.environ.get('BRAIN_URL', 'https://dot-traffic-2.up.railway.app')
PROXY_URL = os.environ.get('PROXY_URL', 'https://dot-proxy.up.railway.app')

# ==================== 
# Static Files
# ==================== 

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

# ==================== 
# Auth Routes
# ==================== 

VALID_PINS = {
    '9871': {'name': 'Michael', 'fullName': 'Michael Goldthorpe'},
    '9262': {'name': 'Emma', 'fullName': 'Emma Moore'}, 
    '1919': {'name': 'Team', 'fullName': 'Hunch Team'}
}

@app.route('/auth/pin', methods=['POST'])
def auth_pin():
    """PIN login → set session"""
    data = request.get_json()
    pin = data.get('pin', '')
    
    if pin in VALID_PINS:
        user = VALID_PINS[pin]
        session['user'] = user['name']
        session['fullName'] = user['fullName']
        session['authenticated'] = True
        return jsonify({'success': True, 'user': user['name'], 'fullName': user['fullName']})
    
    return jsonify({'success': False, 'error': 'Invalid PIN'}), 401

@app.route('/auth/logout', methods=['POST'])
def logout():
    """Clear session"""
    session.clear()
    return jsonify({'success': True})

# ==================== 
# Clients API
# ==================== 

@app.route('/api/clients')
def get_clients():
    """List clients (main vs other based on retainer)"""
    from airtable import get_clients as fetch_clients
    clients = fetch_clients()
    return jsonify(clients)

# ==================== 
# Jobs API
# ==================== 

@app.route('/api/jobs')
def get_jobs():
    """Get jobs - optionally filtered by client"""
    client = request.args.get('client', '')
    
    from airtable import get_jobs_for_client, get_all_jobs
    
    if client:
        jobs = get_jobs_for_client(client)
    else:
        jobs = get_all_jobs()
    
    return jsonify(jobs)

@app.route('/api/jobs/all')
def get_all_jobs_route():
    """Get all active jobs (for Ask Dot context)"""
    from airtable import get_all_jobs
    jobs = get_all_jobs()
    return jsonify(jobs)

@app.route('/api/job/<job_number>')
def get_job(job_number):
    """Get a single job by number"""
    from airtable import get_job as fetch_job
    job = fetch_job(job_number)
    if not job:
        return jsonify({'error': 'Job not found'}), 404
    return jsonify(job)

# ==================== 
# To Do API
# ==================== 

@app.route('/api/todo')
def get_todo():
    """Get jobs and meetings for today + next workday"""
    from airtable import get_todo_jobs, get_meetings, get_next_workday
    jobs = get_todo_jobs()
    meetings = get_meetings()
    _, next_label = get_next_workday()
    
    return jsonify({
        'today': {
            'meetings': meetings.get('today', []),
            'jobs': jobs.get('today', [])
        },
        'next': {
            'label': next_label,
            'meetings': meetings.get('next', []),
            'jobs': jobs.get('next', [])
        }
    })

# ==================== 
# Tracker API
# ==================== 

@app.route('/api/tracker/clients')
def get_tracker_clients():
    """Get clients with budget info"""
    from airtable import get_tracker_clients as fetch_tracker_clients
    clients = fetch_tracker_clients()
    return jsonify(clients)

@app.route('/api/tracker')
def get_tracker():
    """Get budget/spend data for a client"""
    client = request.args.get('client', '')
    if not client:
        return jsonify({'error': 'Client code required'}), 400
    
    from airtable import get_tracker_for_client
    tracker = get_tracker_for_client(client)
    return jsonify(tracker)

# ==================== 
# Update API
# ==================== 

@app.route('/api/job/<job_number>/update', methods=['POST'])
def update_job(job_number):
    """
    Update a job's fields and optionally create an Updates record.
    Also posts to Teams if there's a new message.
    
    Mirrors Hub's unified update endpoint.
    """
    data = request.get_json()
    
    from airtable import update_project, create_update_record
    
    # Extract message for Updates table (separate from Projects fields)
    message = data.get('message', '').strip()
    update_due = data.get('updateDue')
    
    results = {
        'project_update': None,
        'update_record': None,
        'teams_post': None
    }
    
    # 1. Update Projects table
    project_fields = {k: v for k, v in data.items() if k != 'message'}
    if project_fields:
        result = update_project(job_number, project_fields)
        results['project_update'] = result
        if not result.get('success'):
            return jsonify({'success': False, 'error': result.get('error')}), 500
    
    # 2. Create Updates record (if message provided)
    if message:
        result = create_update_record(job_number, message, update_due)
        results['update_record'] = result
        
        # 3. Post to Teams (fire and forget)
        try:
            client_code = job_number.split(' ')[0]
            requests.post(
                f"{PROXY_URL}/proxy/update",
                json={
                    'clientCode': client_code,
                    'jobNumber': job_number,
                    'message': message
                },
                timeout=5
            )
            results['teams_post'] = {'success': True}
            print(f'[App] Posted to Teams for {job_number}')
        except Exception as e:
            print(f'[App] Teams post failed (non-blocking): {e}')
            results['teams_post'] = {'success': False, 'error': str(e)}
    
    return jsonify({'success': True, 'results': results})

# ==================== 
# Chat API (Ask Dot)
# ==================== 

@app.route('/api/chat', methods=['POST'])
def chat():
    """
    Ask Dot → Brain /hub endpoint.
    Sends jobs context + conversation history.
    Same pattern as Hub.
    """
    data = request.get_json()
    message = data.get('message', '')
    history = data.get('history', [])
    
    if not message:
        return jsonify({'success': False, 'error': 'No message provided'}), 400
    
    # Get current user from session
    sender_name = session.get('user', 'App User')
    
    # Get all jobs for context
    from airtable import get_all_jobs
    jobs = get_all_jobs()
    
    try:
        # Call Brain /hub endpoint (same as Hub does)
        response = requests.post(
            f"{BRAIN_URL}/hub",
            json={
                'content': message,
                'senderName': sender_name,
                'sessionId': sender_name,
                'jobs': jobs,
                'history': history
            },
            timeout=30
        )
        
        if not response.ok:
            print(f'[App] Brain error: {response.status_code}')
            return jsonify({
                'success': False,
                'error': 'Brain unavailable',
                'response': {
                    'type': 'answer',
                    'message': "Sorry, I'm having trouble thinking right now. Try again?",
                    'jobs': None
                }
            })
        
        result = response.json()
        return jsonify({
            'success': True,
            'response': result
        })
    
    except requests.Timeout:
        print('[App] Brain timeout')
        return jsonify({
            'success': False,
            'error': 'timeout',
            'response': {
                'type': 'answer',
                'message': "That took too long. Try asking something simpler?",
                'jobs': None
            }
        })
    
    except Exception as e:
        print(f'[App] Chat error: {e}')
        return jsonify({
            'success': False,
            'error': str(e),
            'response': {
                'type': 'answer',
                'message': "Something went wrong. Try again?",
                'jobs': None
            }
        })

# ==================== 
# Health Check
# ==================== 

@app.route('/health')
def health():
    return jsonify({
        'status': 'ok',
        'service': 'dot-app',
        'version': '1.0',
        'features': ['clients', 'jobs', 'todo', 'tracker', 'chat', 'updates']
    })

# ==================== 
# Static Files (catch-all, must be last)
# ==================== 

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)

# ==================== 
# Run
# ==================== 

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
