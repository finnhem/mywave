from django import forms
from django.core.exceptions import ValidationError
import os

class VCDFileUploadForm(forms.Form):
    vcd_file = forms.FileField(
        label='VCD File',
        help_text='Upload a Value Change Dump (VCD) file',
        validators=[
            lambda file: ValidationError('File size too large') 
                if file.size > 10 * 1024 * 1024 else None,  # 10MB limit
        ]
    )

    def clean_vcd_file(self):
        file = self.cleaned_data['vcd_file']
        ext = os.path.splitext(file.name)[1].lower()
        
        if ext != '.vcd':
            raise ValidationError('Only VCD files are allowed')
            
        # Check file header for VCD format
        try:
            header = file.read(1024).decode('utf-8')
            if not header.startswith('$date') and '$version' not in header:
                raise ValidationError('Invalid VCD file format')
            file.seek(0)  # Reset file pointer
        except UnicodeDecodeError:
            raise ValidationError('Invalid VCD file format')
            
        return file 