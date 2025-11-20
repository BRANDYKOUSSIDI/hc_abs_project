# backend/appointments/views.py

from datetime import timedelta
from django.utils import timezone
from django.db import transaction
from django.shortcuts import get_object_or_404

from rest_framework import viewsets, status, filters
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticatedOrReadOnly
from rest_framework.decorators import action
from rest_framework.views import APIView

from django_filters.rest_framework import DjangoFilterBackend

from .models import Specialty, Provider, ProviderSchedule, ScheduleSlot, Appointment, Patient
from .serializers import (
    SpecialtySerializer,
    ProviderSerializer,
    ProviderScheduleSerializer,
    ScheduleSlotSerializer,
    AppointmentSerializer,
    PatientSerializer,
)
from .services import AppointmentService  # keep if you still use it elsewhere


class SpecialtyViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Specialty.objects.all().order_by("name")
    serializer_class = SpecialtySerializer


class ProviderViewSet(viewsets.ModelViewSet):
    queryset = Provider.objects.all().order_by("name")
    serializer_class = ProviderSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["specialty"]
    search_fields = ["name"]

    @action(detail=True, methods=["get"], permission_classes=[AllowAny])
    def slots(self, request, pk=None):
        """
        GET /api/providers/<id>/slots/?days=7
        Returns upcoming slots for the provider (defaults to upcoming 21 days).
        """
        provider = self.get_object()
        days = int(request.query_params.get("days", 21))
        now = timezone.now()
        end = now + timedelta(days=days)
        qs = ScheduleSlot.objects.filter(provider=provider, start__gte=now, start__lte=end).order_by("start")
        serializer = ScheduleSlotSerializer(qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class SlotViewSet(viewsets.ModelViewSet):
    queryset = ScheduleSlot.objects.all().order_by("start")
    serializer_class = ScheduleSlotSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        provider_id = self.request.query_params.get("provider")
        if provider_id:
            qs = qs.filter(provider__id=provider_id)
        return qs


class PatientViewSet(viewsets.ModelViewSet):
    queryset = Patient.objects.all().order_by("-id")
    serializer_class = PatientSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_permissions(self):
        # allow create without auth for quick sign-up flow
        if self.action == "create":
            return [AllowAny()]
        return super().get_permissions()


class AppointmentViewSet(viewsets.ModelViewSet):
    queryset = Appointment.objects.all().order_by("-created_at")
    serializer_class = AppointmentSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_permissions(self):
        if self.action == "create":
            # allow unauthenticated for now; tighten later if needed
            return [AllowAny()]
        return super().get_permissions()

    def create(self, request, *args, **kwargs):
        """
        Expected payload:
        - patient_id (optional) OR patient data (full_name, phone, email)
        - provider_id
        - slot_id
        Optionally start/end can be provided but we will use slot.start/slot.end if slot_id is given.
        """

        data = request.data or {}
        provider_id = data.get("provider_id")
        slot_id = data.get("slot_id")
        patient_id = data.get("patient_id")

        # Basic validation
        if not provider_id:
            return Response({"detail": "provider_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        if not slot_id:
            return Response({"detail": "slot_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        # Ensure provider exists
        provider = get_object_or_404(Provider, pk=provider_id)

        # Optionally create or fetch patient
        patient = None
        if patient_id:
            patient = get_object_or_404(Patient, pk=patient_id)
        else:
            # Try to create using provided fields
            patient_data = {
                "full_name": data.get("full_name"),
                "phone": data.get("phone"),
                "email": data.get("email"),
                "dob": data.get("dob"),
            }
            # minimal check
            if not patient_data.get("full_name") or not patient_data.get("phone"):
                return Response({"detail": "Either patient_id or full_name and phone must be provided."},
                                status=status.HTTP_400_BAD_REQUEST)
            serializer = PatientSerializer(data=patient_data)
            if serializer.is_valid():
                patient = serializer.save()
            else:
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # Now attempt to create appointment atomically to avoid race conditions
        try:
            with transaction.atomic():
                # Lock the slot row (if supported by DB). SQLite may ignore select_for_update.
                slot = ScheduleSlot.objects.select_for_update().get(pk=slot_id, provider=provider)

                if not slot.is_available:
                    return Response({"detail": "Slot not available."}, status=status.HTTP_400_BAD_REQUEST)

                # Create appointment using slot times (ensures consistency)
                appt = Appointment.objects.create(
                    patient=patient,
                    provider=provider,
                    slot=slot,
                    start=slot.start,
                    end=slot.end,
                    status="booked",
                )

                # Mark slot unavailable
                slot.is_available = False
                slot.save(update_fields=["is_available"])

        except ScheduleSlot.DoesNotExist:
            return Response({"detail": "Slot not found for given provider."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as exc:
            return Response({"detail": f"Booking failed: {str(exc)}"}, status=status.HTTP_400_BAD_REQUEST)

        serializer = AppointmentSerializer(appt)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class RegisterView(APIView):
    """
    Minimal registration endpoint that creates a Patient.
    POST /api/register/ { full_name, phone, email }
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PatientSerializer(data=request.data)
        if serializer.is_valid():
            patient = serializer.save()
            return Response(PatientSerializer(patient).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
