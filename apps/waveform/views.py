import os
import logging
from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.core.exceptions import ValidationError
from .forms import VCDFileUploadForm
from .models import VCDFile
from django.db import models  # Add this import for type hints
from typing import Optional, Tuple, Any

# Configure logging
logger = logging.getLogger(__name__)

# Types for VCD parsing libraries
VCDVCD = Any
VcdParserType = Any

# Lazy loading of VCD parsing libraries
PARSERS_AVAILABLE: bool = False  # Initialize with False instead of None
vcdvcd: Optional[Any] = None
VcdParser: Optional[Any] = None


def ensure_parsers_loaded() -> Tuple[bool, Optional[Any], Optional[Any]]:
    """Lazy-load VCD parsing libraries only when needed

    Returns:
        Tuple containing:
        - Boolean indicating if parsers are available
        - vcdvcd module if available, None otherwise
        - VcdParser class if available, None otherwise
    """
    global PARSERS_AVAILABLE, vcdvcd, VcdParser

    # Only try to load once
    if PARSERS_AVAILABLE is True:  # Only return cached results if parsers are loaded
        return PARSERS_AVAILABLE, vcdvcd, VcdParser

    # Check if VCD parsing is enabled in settings
    from django.conf import settings

    if not getattr(settings, "WAVEFORM_ENABLE_VCD_PARSING", True):
        logger.warning("VCD parsing is disabled in settings")
        PARSERS_AVAILABLE = False
        return False, None, None

    try:
        import vcdvcd as _vcdvcd
        from pyDigitalWaveTools.vcd.parser import VcdParser as _VcdParser

        # Assign to global variables
        vcdvcd = _vcdvcd
        VcdParser = _VcdParser
        PARSERS_AVAILABLE = True
        logger.debug("Successfully loaded VCD parsing libraries")
    except ImportError as e:
        logger.error(f"Failed to import VCD parsing libraries: {str(e)}")
        PARSERS_AVAILABLE = False

    return PARSERS_AVAILABLE, vcdvcd, VcdParser


def get_signal_data(vcd):
    """Extract signal names and their waveform data using vcdvcd API"""
    try:
        # Ensure parsers are loaded
        if not ensure_parsers_loaded():
            logger.error("VCD parsing libraries not available")
            return {"signals": [], "timescale": {"value": 1, "unit": "ns"}}

        if vcd is None:
            logger.error("Received None VCD object")
            return {"signals": [], "timescale": {"value": 1, "unit": "ns"}}

        signal_names = vcd.get_signals()
        if not signal_names:
            logger.warning("No signals found in VCD file")
            return {"signals": [], "timescale": {"value": 1, "unit": "ns"}}

        signals_data = []

        # Get timescale information with validation
        timescale = vcd.get_timescale() or {"value": 1, "unit": "ns"}
        logger.debug(f"Raw timescale from VCD: {timescale}")

        # Default timescale if not provided or invalid
        if not isinstance(timescale, dict):
            logger.warning(f"Invalid timescale format: {timescale}, using default")
            timescale = {"value": 1, "unit": "ns"}

        # Convert timescale to a standard format
        # Handle scientific notation in timescale
        try:
            if "timescale" in timescale:
                # If we have scientific notation, use it directly
                timescale_value = float(timescale["timescale"])
                # The unit will be seconds in this case, convert to the appropriate unit
                if timescale_value == 1e-12:  # 1ps
                    timescale_unit = "ps"
                    timescale_value = 1
                elif timescale_value == 1e-11:  # 10ps
                    timescale_unit = "ps"
                    timescale_value = 10
                elif timescale_value == 1e-10:  # 100ps
                    timescale_unit = "ps"
                    timescale_value = 100
                elif timescale_value == 1e-9:  # 1ns
                    timescale_unit = "ns"
                    timescale_value = 1
                else:
                    # Convert to ns
                    timescale_unit = "ns"
                    timescale_value = timescale_value * 1e9
            else:
                # Use the standard format
                timescale_value = float(timescale.get("value", 1))
                if "magnitude" in timescale:
                    try:
                        timescale_value *= float(timescale["magnitude"])
                    except (ValueError, TypeError) as e:
                        logger.warning(
                            f"Invalid timescale magnitude: {e}, using default"
                        )
                        timescale_value = 1
                timescale_unit = str(timescale.get("unit", "ns")).lower()
        except (ValueError, TypeError) as e:
            logger.warning(f"Error parsing timescale: {e}, using default")
            timescale_value = 1
            timescale_unit = "ns"

        logger.debug(f"Parsed timescale: {timescale_value} {timescale_unit}")

        # Normalize unit to standard form (convert everything to ns)
        unit_map = {
            "s": 1e9,  # 1s = 1e9 ns
            "ms": 1e6,  # 1ms = 1e6 ns
            "us": 1e3,  # 1us = 1e3 ns
            "µs": 1e3,  # 1µs = 1e3 ns
            "ns": 1,  # 1ns = 1 ns
            "ps": 1e-3,  # 1ps = 0.001 ns
            "fs": 1e-6,  # 1fs = 0.000001 ns
        }

        scale_factor = unit_map.get(timescale_unit, 1) * timescale_value
        logger.debug(f"Scale factor for time values: {scale_factor}")

        # Get first and last timestamps for debugging
        first_time = None
        last_time = None

        # Process signals with validation
        for signal_name in signal_names:
            try:
                if not signal_name or not isinstance(signal_name, str):
                    logger.warning(f"Invalid signal name: {signal_name}")
                    continue

                signal = vcd[signal_name]
                if not signal:
                    logger.warning(f"Empty signal object for {signal_name}")
                    continue

                if not hasattr(signal, "tv") or not signal.tv:
                    logger.warning(f"No time-value data for signal {signal_name}")
                    signals_data.append({"name": signal_name, "data": []})
                    continue

                # Validate and scale time values
                data = []
                for time_value_pair in signal.tv:
                    try:
                        if (
                            not isinstance(time_value_pair, (list, tuple))
                            or len(time_value_pair) != 2
                        ):
                            logger.warning(
                                f"Invalid time-value pair for {signal_name}: {time_value_pair}"
                            )
                            continue

                        time, value = time_value_pair
                        scaled_time = float(time) * scale_factor

                        if not isinstance(value, (str, int, float, bool)):
                            value = str(value)

                        data.append({"time": scaled_time, "value": value})
                    except (ValueError, TypeError) as e:
                        logger.warning(
                            f"Error processing time-value pair for {signal_name}: {e}"
                        )
                        continue

                if data:
                    if first_time is None:
                        first_time = data[0]["time"]
                        last_time = data[-1]["time"]
                    else:
                        first_time = min(first_time, data[0]["time"])
                        last_time = max(last_time, data[-1]["time"])

                signals_data.append({"name": signal_name, "data": data})
            except KeyError:
                logger.warning(f"Signal {signal_name} not found in VCD file")
                continue
            except Exception as e:
                logger.error(f"Error processing signal {signal_name}: {str(e)}")
                continue

        if not signals_data:
            logger.warning("No signals data processed successfully")
        else:
            logger.debug(f"Time range in VCD: {first_time} to {last_time} ns")

        return {
            "signals": sorted(signals_data, key=lambda x: x["name"]),
            "timescale": {
                "value": 1,  # Since we've normalized all times to ns
                "unit": "ns",
            },
        }
    except Exception as e:
        logger.error(f"Error getting signals: {str(e)}")
        return {"signals": [], "timescale": {"value": 1, "unit": "ns"}}


def parse_vcd_file(file_path):
    """Parse VCD file and extract signal data"""
    parsers_available, vcdvcd_module, vcd_parser_class = ensure_parsers_loaded()

    if not parsers_available:
        logger.error("VCD parsing libraries not available")
        raise ValidationError("VCD parsing libraries not available")

    # Validate file path
    if not file_path or not os.path.exists(file_path):
        logger.error(f"File not found: {file_path}")
        raise ValidationError(f"File not found: {file_path}")

    # Check file size
    file_size = os.path.getsize(file_path)
    if file_size == 0:
        logger.error(f"File is empty: {file_path}")
        raise ValidationError("The uploaded file is empty")

    # Check file extension
    if not file_path.lower().endswith(".vcd"):
        logger.error(f"Invalid file extension: {file_path}")
        raise ValidationError("Invalid file format. Only VCD files are allowed.")

    # Try to parse with vcdvcd first
    vcd = None
    try:
        logger.debug(f"Attempting to parse file with vcdvcd: {file_path}")
        if vcdvcd_module is None:
            raise ImportError("vcdvcd module is not available")

        vcd = vcdvcd_module.VCDVCD(file_path)
        signals_data = get_signal_data(vcd)
        if not signals_data or not signals_data.get("signals"):
            logger.warning(f"No signals found in VCD file: {file_path}")

        return signals_data
    except Exception as e:
        logger.error(f"vcdvcd parsing failed: {str(e)}")
        # If vcdvcd fails, try with pyDigitalWaveTools
        try:
            logger.debug(
                f"Attempting to parse file with pyDigitalWaveTools: {file_path}"
            )
            if vcd_parser_class is None:
                raise ImportError("VcdParser is not available")

            with open(file_path, "r") as f:
                parser = vcd_parser_class()
                parser.parse(f)

            # Return empty signal list as we don't have good conversion from pyDigitalWaveTools yet
            logger.warning(
                "pyDigitalWaveTools parser succeeded but signal extraction not implemented"
            )
            return {"signals": [], "timescale": {"value": 1, "unit": "ns"}}
        except UnicodeDecodeError as ude:
            logger.error(f"File encoding issue: {str(ude)}")
            raise ValidationError(
                "The file contains invalid characters or is not a text file."
            )
        except Exception as e2:
            logger.error(f"pydigitalwavetools parsing failed: {str(e2)}")

            # If both parsers fail, check for common issues
            try:
                with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                    first_line = f.readline().strip()
                    if (
                        not first_line.startswith("$")
                        and "$date" not in first_line
                        and "$version" not in first_line
                    ):
                        logger.error(
                            "File doesn't appear to be a valid VCD file (missing header)"
                        )
                        raise ValidationError(
                            "The file doesn't appear to be a valid VCD file. Missing proper header."
                        )
            except Exception as e3:
                logger.error(f"File validation check failed: {str(e3)}")

            # If we reach here, both parsers failed but the file seems valid
            raise ValidationError(f"Failed to parse file: {str(e2)}")


@require_http_methods(["GET", "POST"])
def index(request):
    """Handle file upload and display main page"""
    if request.method == "POST":
        form = VCDFileUploadForm(request.POST, request.FILES)
        if form.is_valid():
            try:
                # Save file
                vcd_file: models.Model = VCDFile.objects.create(  # Add type hint
                    file=form.cleaned_data["vcd_file"],
                    original_name=form.cleaned_data["vcd_file"].name,
                )

                # Parse file
                signals_data = parse_vcd_file(vcd_file.file.path)

                # Update model
                vcd_file.processed = True
                vcd_file.save()

                return JsonResponse(
                    {
                        "success": True,
                        "message": "File uploaded and processed successfully",
                        "signals": signals_data,
                    }
                )
            except ValidationError as e:
                return JsonResponse(
                    {
                        "success": False,
                        "message": str(e),
                        "signals": {
                            "signals": [],
                            "timescale": {"value": 1, "unit": "ns"},
                        },
                    }
                )
            except Exception:
                logger.exception("Error processing VCD file")
                return JsonResponse(
                    {
                        "success": False,
                        "message": "Server error processing file",
                        "signals": {
                            "signals": [],
                            "timescale": {"value": 1, "unit": "ns"},
                        },
                    }
                )
        else:
            return JsonResponse(
                {
                    "success": False,
                    "message": "Invalid form submission",
                    "errors": form.errors,
                }
            )

    return render(request, "waveform/index.html")


@require_http_methods(["GET"])
def view_file(request, pk):
    """View a specific VCD file"""
    vcd_file = get_object_or_404(VCDFile, pk=pk)
    try:
        signals_data = parse_vcd_file(vcd_file.file.path)
        return JsonResponse(
            {
                "success": True,
                "file_name": vcd_file.original_name,
                "signals": signals_data,
            }
        )
    except ValidationError as e:
        return JsonResponse(
            {
                "success": False,
                "message": str(e),
                "signals": {"signals": [], "timescale": {"value": 1, "unit": "ns"}},
            }
        )
    except Exception:
        logger.exception("Error processing VCD file")
        return JsonResponse(
            {
                "success": False,
                "message": "Server error processing file",
                "signals": {"signals": [], "timescale": {"value": 1, "unit": "ns"}},
            }
        )
