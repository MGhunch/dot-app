"""
Dot App - Airtable Functions
Data access for clients, jobs, tracker
"""

import os
import requests

AIRTABLE_API_KEY = os.environ.get('AIRTABLE_API_KEY')
AIRTABLE_BASE_ID = os.environ.get('AIRTABLE_BASE_ID')

HEADERS = {
    'Authorization': f'Bearer {AIRTABLE_API_KEY}',
    'Content-Type': 'application/json'
}

BASE_URL = f'https://api.airtable.com/v0/{AIRTABLE_BASE_ID}'

# ==================== 
# Clients
# ==================== 

def get_clients():
    """Get all clients with codes"""
    # TODO: Fetch from Airtable Clients table
    # For now, return mock data matching the brief
    return {
        'main': [
            {'code': 'ONE', 'name': 'One Marketing'},
            {'code': 'ONB', 'name': 'One Business'},
            {'code': 'ONS', 'name': 'One Simplification'},
            {'code': 'SKY', 'name': 'Sky'},
            {'code': 'TOW', 'name': 'Tower'}
        ],
        'other': [
            {'code': 'EON', 'name': 'Enable On'},
            {'code': 'FIS', 'name': 'Fisher Funds'},
            {'code': 'HUN', 'name': 'Hunch'},
            {'code': 'LAB', 'name': 'Labour Party'},
            {'code': 'WKA', 'name': 'Waikato'}
        ]
    }

# ==================== 
# Jobs
# ==================== 

def get_jobs_for_client(client_code):
    """Get active jobs for a client"""
    # TODO: Fetch from Airtable Projects table
    # Filter: Client Code = client_code AND Status != 'Completed'
    return []

def get_job(job_number):
    """Get single job by number"""
    # TODO: Fetch from Airtable Projects table
    return None

# ==================== 
# To Do
# ==================== 

def get_todo_jobs():
    """Get jobs due today and tomorrow"""
    # TODO: Fetch from Airtable Projects table
    # Filter: Update Due = TODAY() OR Update Due = TODAY() + 1
    return {
        'today': [],
        'tomorrow': []
    }

# ==================== 
# Tracker
# ==================== 

def get_tracker_for_client(client_code):
    """Get budget/spend totals for client"""
    # TODO: Fetch from Airtable Tracker table
    # Aggregate by client for current month and quarter
    return {
        'month': {
            'budget': 0,
            'spent': 0,
            'remaining': 0
        },
        'quarter': {
            'budget': 0,
            'spent': 0,
            'remaining': 0
        }
    }

# ==================== 
# Updates
# ==================== 

def create_update(job_number, update_text, status, with_client, update_due):
    """Create update record and patch project"""
    # TODO: 
    # 1. Create record in Updates table
    # 2. Patch Project with new status, withClient, updateDue
    return {'success': True}
