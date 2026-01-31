"""
Dot App - Flask Backend
Mobile-first web app for Hunch team
"""

from flask import Flask, request, jsonify, send_from_directory, session
import os

app = Flask(__name__, static_folder='static')
app.secret_key = os.environ.get('SECRET_KEY', 'dev-secret-key-change-me')

# ==================== 
# Static Files
# ==================== 

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/static/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)

# ==================== 
# Auth Routes
# ==================== 

VALID_PINS = {
    '9871': 'Michael',
    '9262': 'Emma', 
    '1919': 'Team'
}

@app.route('/auth/pin', methods=['POST'])
def auth_pin():
    """PIN login → set session"""
    data = request.get_json()
    pin = data.get('pin', '')
    
    if pin in VALID_PINS:
        session['user'] = VALID_PINS[pin]
        session['authenticated'] = True
        return jsonify({'success': True, 'user': VALID_PINS[pin]})
    
    return jsonify({'success': False, 'error': 'Invalid PIN'}), 401

@app.route('/auth/request-link', methods=['POST'])
def request_magic_link():
    """Send magic link email"""
    # TODO: Implement magic link flow
    data = request.get_json()
    email = data.get('email', '')
    return jsonify({'success': True, 'message': 'Magic link sent (not implemented)'})

@app.route('/auth/verify')
def verify_magic_link():
    """Magic link landing → set session"""
    # TODO: Implement magic link verification
    token = request.args.get('token', '')
    return jsonify({'success': False, 'error': 'Not implemented'})

@app.route('/auth/logout', methods=['POST'])
def logout():
    """Clear session"""
    session.clear()
    return jsonify({'success': True})

# ==================== 
# API Routes
# ==================== 

@app.route('/api/clients')
def get_clients():
    """List client codes (main 5 + others)"""
    # TODO: Replace with Airtable lookup
    from airtable import get_clients as fetch_clients
    clients = fetch_clients()
    return jsonify(clients)

@app.route('/api/jobs')
def get_jobs():
    """Active jobs for client"""
    client = request.args.get('client', '')
    # TODO: Replace with Airtable lookup
    from airtable import get_jobs_for_client
    jobs = get_jobs_for_client(client)
    return jsonify(jobs)

@app.route('/api/todo')
def get_todo():
    """Jobs due today + tomorrow"""
    # TODO: Replace with Airtable lookup
    from airtable import get_todo_jobs
    jobs = get_todo_jobs()
    return jsonify(jobs)

@app.route('/api/tracker')
def get_tracker():
    """Budget/spend for client"""
    client = request.args.get('client', '')
    # TODO: Replace with Airtable lookup
    from airtable import get_tracker_for_client
    tracker = get_tracker_for_client(client)
    return jsonify(tracker)

@app.route('/api/update', methods=['POST'])
def post_update():
    """Submit update → Brain → Worker"""
    data = request.get_json()
    # TODO: Forward to Brain endpoint
    # This will trigger Update Worker which handles Teams post + confirmation
    return jsonify({'success': True, 'message': 'Update submitted (not implemented)'})

@app.route('/api/chat', methods=['POST'])
def chat():
    """Ask Dot → Brain /hub"""
    data = request.get_json()
    message = data.get('message', '')
    # TODO: Forward to Brain /hub endpoint
    return jsonify({
        'success': True,
        'response': "I'd help, but the Brain connection isn't wired up yet!"
    })

# ==================== 
# Health Check
# ==================== 

@app.route('/health')
def health():
    return jsonify({'status': 'ok', 'service': 'dot-app'})

# ==================== 
# Run
# ==================== 

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
