from django.urls import path
from . import views

app_name = "waveform"

urlpatterns = [
    path("", views.index, name="index"),
    path("upload/", views.index, name="upload"),  # Explicit upload endpoint
    path("file/<int:pk>/", views.view_file, name="view_file"),  # View specific file
]
