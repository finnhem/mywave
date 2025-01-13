import os
from django.shortcuts import render
from django.http import JsonResponse
from django.conf import settings
import vcdvcd
from pyDigitalWaveTools.vcd.parser import VcdParser
import logging

logger = logging.getLogger(__name__)

def get_signal_names(vcd):
    """Extract hierarchical signal names from VCD file"""
    try:
        # Get all signals from the VCD object
        signals = []
        for signal_name in vcd.get_signals():
            signals.append(signal_name)
        return sorted(signals)  # Sort alphabetically for consistent display
    except Exception as e:
        logger.error(f"Error extracting signal names: {str(e)}")
        return []

def handle_vcd_file(file_path):
    """Try parsing VCD file with vcdvcd first, then pydigitalwavetools if that fails"""
    try:
        # Try vcdvcd first
        logger.debug(f"Attempting to parse {file_path} with vcdvcd")
        vcd = vcdvcd.VCDVCD(file_path)
        signal_names = get_signal_names(vcd)
        logger.debug(f"Found signals: {signal_names}")
        return True, "File parsed successfully with vcdvcd", signal_names
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
        success, message, signals = handle_vcd_file(file_path)
        
        response_data = {
            'success': success,
            'message': message,
            'signals': signals
        }
        logger.debug(f"Sending response: {response_data}")
        return JsonResponse(response_data)
    
    return render(request, 'waveform/index.html') 