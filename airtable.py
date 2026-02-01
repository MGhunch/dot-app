"""
Dot App - Airtable Functions
Data access for clients, jobs, tracker.
Mirrors Hub's patterns for consistency.
"""

import os
import requests
from datetime import datetime, timedelta
import re

# ==================== 
# Configuration
# ==================== 

AIRTABLE_API_KEY = os.environ.get('AIRTABLE_API_KEY')
AIRTABLE_BASE_ID = os.environ.get('AIRTABLE_BASE_ID', 'app8CI7NAZqhQ4G1Y')

HEADERS = {
    'Authorization': f'Bearer {AIRTABLE_API_KEY}',
    'Content-Type': 'application/json'
}

def get_airtable_url(table):
    return f'https://api.airtable.com/v0/{AIRTABLE_BASE_ID}/{table}'


# ==================== 
# Date Helpers
# ==================== 

def parse_airtable_date(date_str):
    """
    Parse Airtable date field into ISO format (YYYY-MM-DD).
    Handles: ISO "2026-01-31", D/M/YYYY "31/1/2026"
    """
    if not date_str or str(date_str).upper() == 'TBC':
        return None
    
    date_str = str(date_str).strip()
    
    # ISO format (YYYY-MM-DD)
    iso_match = re.search(r'^(\d{4})-(\d{2})-(\d{2})', date_str)
    if iso_match:
        return f"{iso_match.group(1)}-{iso_match.group(2)}-{iso_match.group(3)}"
    
    # D/M/YYYY format
    dmy_match = re.search(r'(\d{1,2})/(\d{1,2})/(\d{4})', date_str)
    if dmy_match:
        day, month, year = int(dmy_match.group(1)), int(dmy_match.group(2)), int(dmy_match.group(3))
        try:
            return datetime(year, month, day).strftime('%Y-%m-%d')
        except ValueError:
            return None
    
    return None


def extract_client_code(job_number):
    """Extract client code from job number: 'SKY 017' -> 'SKY'"""
    if not job_number:
        return None
    parts = job_number.split(' ')
    return parts[0] if parts else None


# ==================== 
# Transform Functions
# ==================== 

def transform_project(record):
    """
    Transform Airtable record to universal schema format.
    Matches Hub's transform_project exactly.
    """
    fields = record.get('fields', {})
    job_number = fields.get('Job Number', '')
    
    # Parse update - get latest if pipe-separated
    update_summary = fields.get('Update Summary', '') or fields.get('Update', '')
    latest_update = update_summary
    if '|' in update_summary:
        parts = update_summary.split('|')
        latest_update = parts[-1].strip() if parts else update_summary
    
    # Parse dates
    update_due = parse_airtable_date(fields.get('Update Due', ''))
    
    # Days Since Update - pre-calculated by Airtable formula
    days_since_update = fields.get('Days Since Update', '-')
    
    # Live is a dropdown (month name or "Tbc")
    live_in = fields.get('Live', '')
    
    # Parse update history
    update_history_raw = fields.get('Update History', []) or fields.get('Update history', [])
    if isinstance(update_history_raw, str):
        update_history = [u.strip() for u in update_history_raw.split('\n') if u.strip()]
    elif isinstance(update_history_raw, list):
        update_history = update_history_raw
    else:
        update_history = []
    
    return {
        # Identity
        'jobNumber': job_number,
        'jobName': fields.get('Project Name', ''),
        'clientCode': extract_client_code(job_number),
        
        # Status
        'stage': fields.get('Stage', 'Triage'),
        'status': fields.get('Status', 'Incoming'),
        'withClient': bool(fields.get('With Client?', False)),
        
        # Dates
        'updateDue': update_due,
        'liveDate': live_in,
        'daysSinceUpdate': days_since_update,
        
        # Content
        'description': fields.get('Description', ''),
        'theStory': fields.get('The Story', ''),
        'update': latest_update,
        'updateHistory': update_history,
        'projectOwner': fields.get('Project Owner', ''),
        
        # Links
        'channelUrl': fields.get('Channel Url', ''),
    }


# ==================== 
# Clients
# ==================== 

def get_clients():
    """
    Get all clients, split into main (retainer) vs other.
    Main clients: Monthly Committed > 0
    """
    try:
        url = get_airtable_url('Clients')
        response = requests.get(url, headers=HEADERS)
        response.raise_for_status()
        
        main = []
        other = []
        
        for record in response.json().get('records', []):
            fields = record.get('fields', {})
            code = fields.get('Client code', '')
            name = fields.get('Clients', '')
            
            if not code:
                continue
            
            # Parse Monthly Committed
            monthly = fields.get('Monthly Committed', 0)
            if isinstance(monthly, str):
                monthly = int(monthly.replace('$', '').replace(',', '') or 0)
            
            client = {'code': code, 'name': name}
            
            if monthly > 0:
                main.append(client)
            else:
                other.append(client)
        
        # Sort alphabetically by name
        main.sort(key=lambda x: x['name'])
        other.sort(key=lambda x: x['name'])
        
        return {'main': main, 'other': other}
    
    except Exception as e:
        print(f'[Airtable] Error fetching clients: {e}')
        return {'main': [], 'other': []}


# ==================== 
# Jobs
# ==================== 

def get_all_jobs(status_filter='active', client_filter=None):
    """
    Get jobs in universal schema format.
    
    Args:
        status_filter: 'active' (default), 'completed', 'all'
        client_filter: filter by client code (e.g., 'SKY')
    """
    try:
        url = get_airtable_url('Projects')
        
        # Build status filter
        if status_filter == 'active':
            statuses = ['Incoming', 'In Progress', 'On Hold']
        elif status_filter == 'completed':
            statuses = ['Completed']
        elif status_filter == 'all':
            statuses = ['Incoming', 'In Progress', 'On Hold', 'Completed', 'Archived']
        else:
            statuses = ['Incoming', 'In Progress', 'On Hold']
        
        formula_parts = [f"{{Status}} = '{s}'" for s in statuses]
        filter_formula = f"OR({', '.join(formula_parts)})"
        
        # Add client filter if provided
        if client_filter:
            filter_formula = f"AND({filter_formula}, FIND('{client_filter}', {{Job Number}})=1)"
        
        params = {'filterByFormula': filter_formula}
        
        all_jobs = []
        offset = None
        
        while True:
            if offset:
                params['offset'] = offset
            
            response = requests.get(url, headers=HEADERS, params=params)
            response.raise_for_status()
            data = response.json()
            
            for record in data.get('records', []):
                all_jobs.append(transform_project(record))
            
            offset = data.get('offset')
            if not offset:
                break
        
        return all_jobs
    
    except Exception as e:
        print(f'[Airtable] Error fetching jobs: {e}')
        return []


def get_jobs_for_client(client_code):
    """Get active jobs for a specific client."""
    return get_all_jobs(status_filter='active', client_filter=client_code)


def get_job(job_number):
    """Get a single job by job number."""
    try:
        url = get_airtable_url('Projects')
        params = {
            'filterByFormula': f"{{Job Number}} = '{job_number}'",
            'maxRecords': 1
        }
        
        response = requests.get(url, headers=HEADERS, params=params)
        response.raise_for_status()
        
        records = response.json().get('records', [])
        if not records:
            return None
        
        return transform_project(records[0])
    
    except Exception as e:
        print(f'[Airtable] Error fetching job {job_number}: {e}')
        return None


def get_job_record_id(job_number):
    """Get Airtable record ID for a job (needed for updates)."""
    try:
        url = get_airtable_url('Projects')
        params = {
            'filterByFormula': f"{{Job Number}} = '{job_number}'",
            'maxRecords': 1
        }
        
        response = requests.get(url, headers=HEADERS, params=params)
        response.raise_for_status()
        
        records = response.json().get('records', [])
        if not records:
            return None
        
        return records[0].get('id')
    
    except Exception as e:
        print(f'[Airtable] Error getting record ID for {job_number}: {e}')
        return None


# ==================== 
# To Do
# ==================== 

def get_soon_range():
    """Get date range for 'soon' section.
    Mon-Thu: tomorrow through Friday.
    Fri-Sun: next Monday through next Friday.
    """
    today = datetime.now().date()
    weekday = today.weekday()  # Mon=0, Sun=6
    
    if weekday >= 4:  # Fri, Sat, Sun — show next week
        days_to_next_monday = 7 - weekday
        next_monday = today + timedelta(days=days_to_next_monday)
        next_friday = next_monday + timedelta(days=4)
        return today + timedelta(days=1), next_friday
    else:  # Mon, Tue, Wed, Thu — rest of this week
        tomorrow = today + timedelta(days=1)
        friday = today + timedelta(days=4 - weekday)
        return tomorrow, friday


def parse_meeting_datetime(dt_str):
    """Parse meeting datetime from Airtable.
    Returns: (date, time_str) or (None, '')
    """
    if not dt_str:
        return None, ''
    
    # ISO format from API: "2026-02-02T11:00:00.000Z"
    iso_match = re.match(r'(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})', dt_str)
    if iso_match:
        y, mo, d = int(iso_match.group(1)), int(iso_match.group(2)), int(iso_match.group(3))
        h, mi = int(iso_match.group(4)), int(iso_match.group(5))
        period = 'am' if h < 12 else 'pm'
        display_h = h % 12 or 12
        return datetime(y, mo, d).date(), f"{display_h}:{mi:02d}{period}"
    
    # Text format: "2/2/2026 11:00am"
    text_match = re.match(r'(\d{1,2})/(\d{1,2})/(\d{4})\s+(\d{1,2}:\d{2}(?:am|pm))', dt_str, re.IGNORECASE)
    if text_match:
        d, mo, y = int(text_match.group(1)), int(text_match.group(2)), int(text_match.group(3))
        return datetime(y, mo, d).date(), text_match.group(4).lower()
    
    return None, ''


def get_todo_jobs():
    """
    Get jobs for today and soon.
    Returns: {'today': [...], 'soon': {'Wednesday': [...], ...}}
    """
    try:
        all_jobs = get_all_jobs(status_filter='active')
        
        today = datetime.now().date()
        soon_start, soon_end = get_soon_range()
        
        today_jobs = []
        soon_jobs = {}
        
        for job in all_jobs:
            if job.get('withClient'):
                continue
            
            update_due = job.get('updateDue')
            if not update_due:
                continue
            
            try:
                due_date = datetime.strptime(update_due, '%Y-%m-%d').date()
            except ValueError:
                continue
            
            if due_date <= today:
                today_jobs.append(job)
            elif soon_start <= due_date <= soon_end:
                day_name = due_date.strftime('%A')
                if day_name not in soon_jobs:
                    soon_jobs[day_name] = []
                soon_jobs[day_name].append(job)
        
        today_jobs.sort(key=lambda x: x.get('updateDue', ''))
        for day_list in soon_jobs.values():
            day_list.sort(key=lambda x: x.get('updateDue', ''))
        
        return {'today': today_jobs, 'soon': soon_jobs}
    
    except Exception as e:
        print(f'[Airtable] Error fetching todo jobs: {e}')
        return {'today': [], 'soon': {}}


def get_meetings():
    """
    Get meetings for today and soon.
    Returns: {'today': [...], 'soon': {'Wednesday': [...], ...}}
    """
    try:
        url = get_airtable_url('Meetings')
        response = requests.get(url, headers=HEADERS)
        response.raise_for_status()
        
        today_date = datetime.now().date()
        soon_start, soon_end = get_soon_range()
        
        today_meetings = []
        soon_meetings = {}
        
        for record in response.json().get('records', []):
            fields = record.get('fields', {})
            
            start_str = fields.get('Start', '')
            end_str = fields.get('End', '')
            meeting_date, start_time = parse_meeting_datetime(start_str)
            _, end_time = parse_meeting_datetime(end_str)
            
            if not meeting_date:
                continue
            
            meeting = {
                'id': record.get('id'),
                'title': fields.get('Title', ''),
                'startTime': start_time,
                'endTime': end_time,
                'start': start_str,
                'location': fields.get('Location', ''),
                'whose': fields.get('Whose meeting', ''),
            }
            
            if meeting_date == today_date:
                today_meetings.append(meeting)
            elif soon_start <= meeting_date <= soon_end:
                day_name = meeting_date.strftime('%A')
                if day_name not in soon_meetings:
                    soon_meetings[day_name] = []
                soon_meetings[day_name].append(meeting)
        
        today_meetings.sort(key=lambda x: x.get('start', ''))
        for day_list in soon_meetings.values():
            day_list.sort(key=lambda x: x.get('start', ''))
        
        return {'today': today_meetings, 'soon': soon_meetings}
    
    except Exception as e:
        print(f'[Airtable] Error fetching meetings: {e}')
        return {'today': [], 'soon': {}}


# ==================== 
# Updates
# ==================== 

def update_project(job_number, fields):
    """
    Update a project's fields in Airtable.
    
    Args:
        job_number: e.g. "SKY 018"
        fields: dict of frontend field names to values
            - status, stage, withClient, updateDue, liveDate, description, projectOwner
    
    Returns:
        {'success': True/False, 'error': '...'}
    """
    try:
        # Get record ID
        url = get_airtable_url('Projects')
        params = {
            'filterByFormula': f"{{Job Number}} = '{job_number}'",
            'maxRecords': 1
        }
        response = requests.get(url, headers=HEADERS, params=params)
        response.raise_for_status()
        
        records = response.json().get('records', [])
        if not records:
            return {'success': False, 'error': 'Job not found'}
        
        record_id = records[0].get('id')
        
        # Map frontend field names to Airtable field names
        field_mapping = {
            'stage': 'Stage',
            'status': 'Status',
            'updateDue': 'Update Due',
            'liveDate': 'Live',
            'withClient': 'With Client?',
            'description': 'Description',
            'projectOwner': 'Project Owner',
            'projectName': 'Project Name'
        }
        
        airtable_fields = {}
        for key, value in fields.items():
            if key in field_mapping:
                airtable_key = field_mapping[key]
                if key == 'withClient':
                    airtable_fields[airtable_key] = bool(value)
                else:
                    airtable_fields[airtable_key] = value
        
        if not airtable_fields:
            return {'success': False, 'error': 'No valid fields to update'}
        
        # Update the record
        update_response = requests.patch(
            f"{url}/{record_id}",
            headers=HEADERS,
            json={'fields': airtable_fields}
        )
        update_response.raise_for_status()
        
        print(f'[Airtable] Updated project {job_number}: {list(airtable_fields.keys())}')
        return {'success': True, 'updated': list(airtable_fields.keys())}
    
    except Exception as e:
        print(f'[Airtable] Error updating project {job_number}: {e}')
        return {'success': False, 'error': str(e)}


def create_update_record(job_number, message, update_due=None):
    """
    Create an Updates table record for a job.
    
    Args:
        job_number: e.g. "SKY 018"
        message: The update text
        update_due: Optional next update due date (YYYY-MM-DD)
    
    Returns:
        {'success': True/False, 'record_id': '...', 'error': '...'}
    """
    try:
        # Get project record ID for linking
        record_id = get_job_record_id(job_number)
        if not record_id:
            return {'success': False, 'error': 'Job not found'}
        
        # Create Updates record
        url = get_airtable_url('Updates')
        fields = {
            'Update': message,
            'Project Link': [record_id]
        }
        
        if update_due:
            fields['Update Due'] = update_due
        
        response = requests.post(
            url,
            headers=HEADERS,
            json={'fields': fields}
        )
        response.raise_for_status()
        
        new_record = response.json()
        print(f'[Airtable] Created update record for {job_number}')
        return {'success': True, 'record_id': new_record.get('id')}
    
    except Exception as e:
        print(f'[Airtable] Error creating update record: {e}')
        return {'success': False, 'error': str(e)}


# ==================== 
# Tracker
# ==================== 

def get_tracker_for_client(client_code):
    """
    Get budget/spend data for a client.
    Returns spend records for the client.
    """
    try:
        url = get_airtable_url('Tracker')
        params = {'filterByFormula': f"{{Client Code}} = '{client_code}'"}
        
        all_records = []
        offset = None
        
        while True:
            if offset:
                params['offset'] = offset
            
            response = requests.get(url, headers=HEADERS, params=params)
            response.raise_for_status()
            data = response.json()
            
            for record in data.get('records', []):
                fields = record.get('fields', {})
                
                # Handle lookup fields that may return as lists
                job_number = fields.get('Job Number', '')
                if isinstance(job_number, list):
                    job_number = job_number[0] if job_number else ''
                
                project_name = fields.get('Project Name', '')
                if isinstance(project_name, list):
                    project_name = project_name[0] if project_name else ''
                
                owner = fields.get('Owner', '')
                if isinstance(owner, list):
                    owner = owner[0] if owner else ''
                
                spend = fields.get('Spend', 0)
                if isinstance(spend, str):
                    spend = float(spend.replace('$', '').replace(',', '') or 0)
                
                # Skip zero spend records
                if spend == 0:
                    continue
                
                all_records.append({
                    'id': record.get('id'),
                    'client': client_code,
                    'jobNumber': job_number,
                    'projectName': project_name,
                    'owner': owner,
                    'description': fields.get('Tracker notes', ''),
                    'spend': spend,
                    'month': fields.get('Month', ''),
                    'spendType': fields.get('Spend type', 'Project budget'),
                    'ballpark': bool(fields.get('Ballpark', False)),
                })
            
            offset = data.get('offset')
            if not offset:
                break
        
        return all_records
    
    except Exception as e:
        print(f'[Airtable] Error fetching tracker data for {client_code}: {e}')
        return []


def get_tracker_clients():
    """
    Get clients with budget info (for tracker view).
    Only returns clients with Monthly Committed > 0.
    """
    try:
        url = get_airtable_url('Clients')
        response = requests.get(url, headers=HEADERS)
        response.raise_for_status()
        
        def parse_currency(val):
            if isinstance(val, (int, float)):
                return val
            if isinstance(val, str):
                return int(val.replace('$', '').replace(',', '') or 0)
            return 0
        
        clients = []
        for record in response.json().get('records', []):
            fields = record.get('fields', {})
            
            monthly = parse_currency(fields.get('Monthly Committed', 0))
            if monthly > 0:
                rollover = fields.get('Rollover', 0)
                if isinstance(rollover, (int, float)):
                    rollover = max(0, rollover)
                else:
                    rollover = 0
                
                clients.append({
                    'code': fields.get('Client code', ''),
                    'name': fields.get('Clients', ''),
                    'committed': monthly,
                    'rollover': rollover,
                    'rolloverUseIn': 'JAN-MAR' if rollover > 0 else '',
                    'yearEnd': fields.get('Year end', ''),
                    'currentQuarter': fields.get('Current Quarter', '')
                })
        
        clients.sort(key=lambda x: x['name'])
        return clients
    
    except Exception as e:
        print(f'[Airtable] Error fetching tracker clients: {e}')
        return []
