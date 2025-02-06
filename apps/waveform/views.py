import os
import logging
from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from django.conf import settings
from django.views.decorators.http import require_http_methods
from django.core.exceptions import ValidationError
from .forms import VCDFileUploadForm
from .models import VCDFile

# Configure logging
logger = logging.getLogger(__name__)

try:
    import vcdvcd
    from pyDigitalWaveTools.vcd.parser import VcdParser
    PARSERS_AVAILABLE = True
except ImportError as e:
    logger.error(f"Failed to import VCD parsing libraries: {str(e)}")
    PARSERS_AVAILABLE = False

def get_signal_data(vcd):
    """Extract signal names and their waveform data using vcdvcd API"""
    try:
        signal_names = vcd.get_signals()
        signals_data = []
        
        # Get timescale information
        timescale = vcd.get_timescale()
        logger.debug(f"Raw timescale from VCD: {timescale}")
        
        if not timescale:
            timescale = {'value': 1, 'unit': 'ns'}  # Default to 1ns if not specified
        
        # Convert timescale to a standard format
        # Handle scientific notation in timescale
        if 'timescale' in timescale:
            # If we have scientific notation, use it directly
            timescale_value = float(timescale['timescale'])
            # The unit will be seconds in this case, convert to the appropriate unit
            if timescale_value == 1e-12:  # 1ps
                timescale_unit = 'ps'
                timescale_value = 1
            elif timescale_value == 1e-11:  # 10ps
                timescale_unit = 'ps'
                timescale_value = 10
            elif timescale_value == 1e-10:  # 100ps
                timescale_unit = 'ps'
                timescale_value = 100
            elif timescale_value == 1e-9:  # 1ns
                timescale_unit = 'ns'
                timescale_value = 1
            else:
                # Convert to ns
                timescale_unit = 'ns'
                timescale_value = timescale_value * 1e9
        else:
            # Use the standard format
            timescale_value = float(timescale.get('value', 1))
            if 'magnitude' in timescale:
                timescale_value *= float(timescale['magnitude'])
            timescale_unit = str(timescale.get('unit', 'ns')).lower()
        
        logger.debug(f"Parsed timescale: {timescale_value} {timescale_unit}")
        
        # Normalize unit to standard form (convert everything to ns)
        unit_map = {
            's': 1e9,    # 1s = 1e9 ns
            'ms': 1e6,   # 1ms = 1e6 ns
            'us': 1e3,   # 1us = 1e3 ns
            'µs': 1e3,   # 1µs = 1e3 ns
            'ns': 1,     # 1ns = 1 ns
            'ps': 1e-3,  # 1ps = 0.001 ns
            'fs': 1e-6   # 1fs = 0.000001 ns
        }
        
        scale_factor = unit_map.get(timescale_unit, 1) * timescale_value
        logger.debug(f"Scale factor for time values: {scale_factor}")
        
        # Get first and last timestamps for debugging
        first_time = None
        last_time = None
        
        for signal_name in signal_names:
            try:
                signal = vcd[signal_name]
                if hasattr(signal, 'tv'):
                    # Scale time values to nanoseconds
                    data = [
                        {'time': float(time) * scale_factor, 'value': value}
                        for time, value in signal.tv
                    ]
                    if data:
                        if first_time is None:
                            first_time = data[0]['time']
                            last_time = data[-1]['time']
                        else:
                            first_time = min(first_time, data[0]['time'])
                            last_time = max(last_time, data[-1]['time'])
                            
                    signals_data.append({
                        'name': signal_name,
                        'data': data
                    })
            except Exception as e:
                logger.error(f"Error processing signal {signal_name}: {str(e)}")
                continue
        
        logger.debug(f"Time range in VCD: {first_time} to {last_time} ns")
                
        return {
            'signals': sorted(signals_data, key=lambda x: x['name']),
            'timescale': {
                'value': 1,  # Since we've normalized all times to ns
                'unit': 'ns'
            }
        }
    except Exception as e:
        logger.error(f"Error getting signals: {str(e)}")
        return {
            'signals': [],
            'timescale': {'value': 1, 'unit': 'ns'}
        }

def parse_vcd_file(file_path):
    """Parse VCD file and extract signal data"""
    if not PARSERS_AVAILABLE:
        raise ValidationError("VCD parsing libraries not available")

    try:
        vcd = vcdvcd.VCDVCD(file_path)
        signals_data = get_signal_data(vcd)
        return signals_data
    except Exception as e:
        logger.error(f"vcdvcd parsing failed: {str(e)}")
        try:
            with open(file_path, 'r') as f:
                parser = VcdParser()
                parser.parse(f)
            # TODO: Extract signals from pydigitalwavetools
            return []
        except Exception as e2:
            logger.error(f"pydigitalwavetools parsing failed: {str(e2)}")
            raise ValidationError(f"Failed to parse file: {str(e2)}")

@require_http_methods(["GET", "POST"])
def index(request):
    """Handle file upload and display main page"""
    if request.method == "POST":
        form = VCDFileUploadForm(request.POST, request.FILES)
        if form.is_valid():
            try:
                # Save file
                vcd_file = VCDFile.objects.create(
                    file=form.cleaned_data['vcd_file'],
                    original_name=form.cleaned_data['vcd_file'].name
                )
                
                # Parse file
                signals_data = parse_vcd_file(vcd_file.file.path)
                
                # Update model
                vcd_file.processed = True
                vcd_file.save()
                
                return JsonResponse({
                    'success': True,
                    'message': 'File uploaded and processed successfully',
                    'signals': signals_data
                })
            except ValidationError as e:
                return JsonResponse({
                    'success': False,
                    'message': str(e),
                    'signals': {'signals': [], 'timescale': {'value': 1, 'unit': 'ns'}}
                })
            except Exception as e:
                logger.exception("Error processing VCD file")
                return JsonResponse({
                    'success': False,
                    'message': 'Server error processing file',
                    'signals': {'signals': [], 'timescale': {'value': 1, 'unit': 'ns'}}
                })
        else:
            return JsonResponse({
                'success': False,
                'message': 'Invalid form submission',
                'errors': form.errors
            })
    
    return render(request, 'waveform/index.html')

@require_http_methods(["GET"])
def view_file(request, pk):
    """View a specific VCD file"""
    vcd_file = get_object_or_404(VCDFile, pk=pk)
    try:
        signals_data = parse_vcd_file(vcd_file.file.path)
        return JsonResponse({
            'success': True,
            'file_name': vcd_file.original_name,
            'signals': signals_data
        })
    except ValidationError as e:
        return JsonResponse({
            'success': False,
            'message': str(e),
            'signals': {'signals': [], 'timescale': {'value': 1, 'unit': 'ns'}}
        })
    except Exception as e:
        logger.exception("Error processing VCD file")
        return JsonResponse({
            'success': False,
            'message': 'Server error processing file',
            'signals': {'signals': [], 'timescale': {'value': 1, 'unit': 'ns'}}
        }) 