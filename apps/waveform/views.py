import os
from django.shortcuts import render
from django.http import JsonResponse
from django.conf import settings
import vcdvcd
from pyDigitalWaveTools.vcd.parser import VcdParser
import logging
from datetime import datetime

# Configure file-based logging
log_dir = os.path.join(settings.MEDIA_ROOT, 'logs')
os.makedirs(log_dir, exist_ok=True)
log_file = os.path.join(log_dir, f'vcd_debug_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log')

# Set up file handler
file_handler = logging.FileHandler(log_file)
file_handler.setLevel(logging.DEBUG)
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
file_handler.setFormatter(formatter)

# Configure logger
logger = logging.getLogger('vcd_parser')
logger.setLevel(logging.DEBUG)
logger.addHandler(file_handler)

def get_signal_data(vcd):
    """Extract signal names and their waveform data using vcdvcd API"""
    signals_data = []
    
    # Get all signal names
    signal_names = vcd.get_signals()
    logger.debug(f"Found signals: {signal_names}")
    
    # For each signal, get its data using the Signal object's tv attribute
    for signal_name in signal_names:
        # Get the Signal object using __getitem__
        signal = vcd[signal_name]
        
        # Get the time-value pairs from the tv attribute
        if hasattr(signal, 'tv'):
            data = []
            for time, value in signal.tv:
                data.append({
                    'time': time,
                    'value': value
                })
            
            signals_data.append({
                'name': signal_name,
                'data': data
            })
            logger.debug(f"Processed signal {signal_name} with {len(data)} data points")
        else:
            logger.debug(f"No data found for signal {signal_name}")
    
    return sorted(signals_data, key=lambda x: x['name'])

def handle_vcd_file(file_path):
    """Try parsing VCD file with vcdvcd first, then pydigitalwavetools if that fails"""
    try:
        # Try vcdvcd first
        logger.debug(f"\nAttempting to parse {file_path} with vcdvcd")
        vcd = vcdvcd.VCDVCD(file_path)
        signals_data = get_signal_data(vcd)
        logger.debug(f"Found {len(signals_data)} signals")
        return True, "File parsed successfully with vcdvcd", signals_data
    except Exception as e:
        logger.error(f"vcdvcd parsing failed: {str(e)}")
        try:
            # Fallback to pydigitalwavetools
            with open(file_path, 'r') as f:
                parser = VcdParser()
                parser.parse(f)
            return True, "File parsed successfully with pydigitalwavetools", []  # TODO: Extract signals from pydigitalwavetools
        except Exception as e2:
            logger.error(f"pydigitalwavetools parsing failed: {str(e2)}")
            return False, f"Failed to parse file: {str(e2)}", []

def index(request):
    if request.method == 'POST' and request.FILES.get('vcd_file'):
        vcd_file = request.FILES['vcd_file']
        
        # Ensure session is created
        if not request.session.session_key:
            request.session.save()
        
        # Create session directory if it doesn't exist
        session_dir = os.path.join(settings.MEDIA_ROOT, request.session.session_key)
        os.makedirs(session_dir, exist_ok=True)
        
        # Save file to session directory
        file_path = os.path.join(session_dir, vcd_file.name)
        with open(file_path, 'wb+') as destination:
            for chunk in vcd_file.chunks():
                destination.write(chunk)
        
        # Try parsing the file
        success, message, signals_data = handle_vcd_file(file_path)
        
        response_data = {
            'success': success,
            'message': message,
            'signals': signals_data
        }
        return JsonResponse(response_data)
    
    return render(request, 'waveform/index.html') 