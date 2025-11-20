# backend/appointments/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SpecialtyViewSet,
    ProviderViewSet,
    SlotViewSet,
    AppointmentViewSet,
    PatientViewSet,
    RegisterView,
)

# Create the API router
router = DefaultRouter()
router.register(r'specialties', SpecialtyViewSet, basename='specialty')
router.register(r'providers', ProviderViewSet, basename='provider')
router.register(r'slots', SlotViewSet, basename='slot')
router.register(r'patients', PatientViewSet, basename='patient')
router.register(r'appointments', AppointmentViewSet, basename='appointment')

# Add custom non-viewset routes (e.g., registration)
urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('', include(router.urls)),
]
