from django.apps import AppConfig
import os


class WaveformConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.waveform"
    path = os.path.dirname(os.path.abspath(__file__))
