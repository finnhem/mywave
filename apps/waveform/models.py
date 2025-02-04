from django.db import models
from django.conf import settings
import os
import uuid

def vcd_file_path(instance, filename):
    """Generate unique path for uploaded VCD files"""
    ext = os.path.splitext(filename)[1]
    filename = f"{uuid.uuid4()}{ext}"
    return os.path.join('vcd_files', filename)

class VCDFile(models.Model):
    file = models.FileField(upload_to=vcd_file_path)
    original_name = models.CharField(max_length=255)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    processed = models.BooleanField(default=False)
    error_message = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-uploaded_at']
    
    def __str__(self):
        return self.original_name
    
    def delete(self, *args, **kwargs):
        # Delete the file when model is deleted
        if self.file:
            if os.path.isfile(self.file.path):
                os.remove(self.file.path)
        super().delete(*args, **kwargs)
    
    def get_absolute_url(self):
        from django.urls import reverse
        return reverse('waveform:view_file', args=[str(self.id)]) 