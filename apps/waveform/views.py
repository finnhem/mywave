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
        
        for signal_name in signal_names:
            try:
                signal = vcd[signal_name]
                if hasattr(signal, 'tv'):
                    data = [
                        {'time': time, 'value': value}
                        for time, value in signal.tv
                    ]
                    signals_data.append({
                        'name': signal_name,
                        'data': data
                    })
                    logger.debug(f"Processed signal {signal_name} with {len(data)} data points")
            except Exception as e:
                logger.error(f"Error processing signal {signal_name}: {str(e)}")
                continue
                
        return sorted(signals_data, key=lambda x: x['name'])
    except Exception as e:
        logger.error(f"Error getting signals: {str(e)}")
        return []

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
                    'signals': []
                })
            except Exception as e:
                logger.exception("Error processing VCD file")
                return JsonResponse({
                    'success': False,
                    'message': 'Server error processing file',
                    'signals': []
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
            'signals': []
        })
    except Exception as e:
        logger.exception("Error processing VCD file")
        return JsonResponse({
            'success': False,
            'message': 'Server error processing file',
            'signals': []
        }) 