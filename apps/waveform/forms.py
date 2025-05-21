from django import forms
from django.core.exceptions import ValidationError
import os
import logging

logger = logging.getLogger(__name__)


class VCDFileUploadForm(forms.Form):
    vcd_file = forms.FileField(
        label="VCD File",
        help_text="Upload a Value Change Dump (VCD) file",
        validators=[
            lambda file: ValidationError("File size too large")
            if file.size > 10 * 1024 * 1024
            else None,  # 10MB limit
        ],
    )

    def clean_vcd_file(self):
        file = self.cleaned_data["vcd_file"]

        # Check if file exists
        if not file:
            raise ValidationError("No file was submitted")

        # Check file size
        if file.size == 0:
            raise ValidationError("The uploaded file is empty")

        # Check file extension
        ext = os.path.splitext(file.name)[1].lower()
        if ext != ".vcd":
            logger.warning(f"Invalid file extension: {ext}")
            raise ValidationError("Only VCD files are allowed (.vcd extension)")

        # Check file header for VCD format
        try:
            # Read the first part of the file to check for VCD header markers
            header = file.read(1024).decode("utf-8")

            # Check for key VCD markers in header
            vcd_markers = ["$date", "$version", "$timescale", "$scope", "$var"]
            markers_found = [marker for marker in vcd_markers if marker in header]

            if not markers_found:
                logger.warning(f"No VCD markers found in file: {file.name}")
                raise ValidationError(
                    "Invalid VCD file format - missing required header section"
                )

            if not header.startswith("$") or (
                "$date" not in header and "$version" not in header
            ):
                logger.warning(f"VCD header check failed for file: {file.name}")
                raise ValidationError(
                    "Invalid VCD file format - the file does not appear to be a VCD file"
                )

            # Reset file pointer
            file.seek(0)
        except UnicodeDecodeError as e:
            logger.warning(f"File encoding error in {file.name}: {str(e)}")
            raise ValidationError(
                "The file contains invalid characters or is not a text file"
            )
        except Exception as e:
            logger.error(f"Error validating file {file.name}: {str(e)}")
            raise ValidationError(f"Error validating file: {str(e)}")

        return file
