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
from django.core.mail import send_mail
import re

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


def normalize_phone(phone: str):
    """Keep digits only for simple deduplication."""
    if not phone:
        return ""
    return re.sub(r"\D", "", phone)


class SpecialtyViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Specialty.objects.all().order_by("name")
    serializer_class = SpecialtySerializer


class ProviderViewSet(viewsets.ModelViewSet):
    queryset = Provider.objects.all().order_by("name")
    serializer_class = ProviderSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["specialty"]
    search_fields = ["name"]

    def create(self, request, *args, **kwargs):
        """Override create to ensure schedules and slots are generated for new providers"""
        response = super().create(request, *args, **kwargs)
        
        # The save() method will create schedules automatically
        # Now generate slots for this provider
        if response.status_code == status.HTTP_201_CREATED:
            provider_id = response.data.get('id')
            if provider_id:
                try:
                    provider = Provider.objects.get(pk=provider_id)
                    self._ensure_slots_for_provider(provider)
                except Provider.DoesNotExist:
                    pass
        
        return response
    
    def _ensure_slots_for_provider(self, provider, days=21):
        """Generate slots for a specific provider"""
        from datetime import datetime, timedelta
        
        now = timezone.now()
        tz = timezone.get_current_timezone()
        
        # Ensure schedules exist (should be created by save() method, but double-check)
        schedules_count = ProviderSchedule.objects.filter(provider=provider).count()
        if schedules_count == 0:
            from datetime import time as dtime
            for wd in range(0, 5):  # Monday to Friday
                ProviderSchedule.objects.get_or_create(
                    provider=provider,
                    weekday=wd,
                    start_time=dtime(10, 0),
                    end_time=dtime(12, 0),
                    defaults={'slot_duration_minutes': 30}
                )
                ProviderSchedule.objects.get_or_create(
                    provider=provider,
                    weekday=wd,
                    start_time=dtime(14, 0),
                    end_time=dtime(16, 0),
                    defaults={'slot_duration_minutes': 30}
                )
        
        # Generate slots for the next N days
        for day_offset in range(days):
            day = (now + timedelta(days=day_offset)).date()
            weekday = day.weekday()
            schedules = ProviderSchedule.objects.filter(provider=provider, weekday=weekday)
            
            for sched in schedules:
                start_dt = datetime.combine(day, sched.start_time)
                end_dt = datetime.combine(day, sched.end_time)
                
                if start_dt.tzinfo is None:
                    start_dt = timezone.make_aware(start_dt, tz)
                if end_dt.tzinfo is None:
                    end_dt = timezone.make_aware(end_dt, tz)
                
                slot_len = timedelta(minutes=sched.slot_duration_minutes)
                cur = start_dt
                
                while cur + slot_len <= end_dt:
                    exists = ScheduleSlot.objects.filter(
                        provider=provider,
                        start=cur,
                        end=cur + slot_len
                    ).exists()
                    
                    if not exists:
                        ScheduleSlot.objects.create(
                            provider=provider,
                            start=cur,
                            end=cur + slot_len,
                            is_available=True
                        )
                    
                    cur += slot_len

    @action(detail=True, methods=["get"], permission_classes=[AllowAny])
    def slots(self, request, pk=None):
        """
        GET /api/providers/<id>/slots/?days=7
        Returns upcoming slots for the provider (defaults to upcoming 21 days).
        Also ensures slots exist if they don't.
        """
        provider = self.get_object()
        
        # Check if provider has any slots, if not, generate them
        slots_count = ScheduleSlot.objects.filter(provider=provider, start__gte=timezone.now()).count()
        if slots_count == 0:
            self._ensure_slots_for_provider(provider)
        
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


class GenerateSlotsView(APIView):
    """
    Generate slots for all providers based on their schedules.
    POST /api/generate-slots/?days=21
    Also creates default schedules for providers that don't have any.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        from datetime import datetime, timedelta, time as dtime
        
        days = int(request.query_params.get("days", 21))
        now = timezone.now()
        tz = timezone.get_current_timezone()
        created = 0
        schedules_created = 0
        
        # First, create default schedules for providers that don't have any
        providers = Provider.objects.all()
        for provider in providers:
            existing_schedules = ProviderSchedule.objects.filter(provider=provider).count()
            if existing_schedules == 0:
                # Create Mon-Fri morning & afternoon schedules
                for wd in range(0, 5):  # Monday to Friday
                    ProviderSchedule.objects.get_or_create(
                        provider=provider,
                        weekday=wd,
                        start_time=dtime(10, 0),
                        end_time=dtime(12, 0),
                        defaults={'slot_duration_minutes': 30}
                    )
                    ProviderSchedule.objects.get_or_create(
                        provider=provider,
                        weekday=wd,
                        start_time=dtime(14, 0),
                        end_time=dtime(16, 0),
                        defaults={'slot_duration_minutes': 30}
                    )
                    schedules_created += 2
        
        # Now generate slots based on schedules
        for day_offset in range(days):
            day = (now + timedelta(days=day_offset)).date()
            weekday = day.weekday()  # Monday = 0
            schedules = ProviderSchedule.objects.filter(weekday=weekday)
            
            for sched in schedules:
                start_dt = datetime.combine(day, sched.start_time)
                end_dt = datetime.combine(day, sched.end_time)
                
                if start_dt.tzinfo is None:
                    start_dt = timezone.make_aware(start_dt, tz)
                if end_dt.tzinfo is None:
                    end_dt = timezone.make_aware(end_dt, tz)
                
                slot_len = timedelta(minutes=sched.slot_duration_minutes)
                cur = start_dt
                
                while cur + slot_len <= end_dt:
                    exists = ScheduleSlot.objects.filter(
                        provider=sched.provider,
                        start=cur,
                        end=cur + slot_len
                    ).exists()
                    
                    if not exists:
                        ScheduleSlot.objects.create(
                            provider=sched.provider,
                            start=cur,
                            end=cur + slot_len,
                            is_available=True
                        )
                        created += 1
                    
                    cur += slot_len
        
        return Response({
            "success": True,
            "message": f"Created {schedules_created} schedules and generated {created} slots for the next {days} days.",
            "schedules_created": schedules_created,
            "slots_created": created
        }, status=status.HTTP_200_OK)


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
            # Try to create or reuse using provided fields
            patient_data = {
                "full_name": data.get("full_name"),
                "phone": normalize_phone(data.get("phone")),
                "email": data.get("email"),
                "dob": data.get("dob"),
            }
            # minimal check
            if not patient_data.get("full_name") or not patient_data.get("phone"):
                return Response({"detail": "Either patient_id or full_name and phone must be provided."},
                                status=status.HTTP_400_BAD_REQUEST)
            # Deduplicate by phone or email
            lookup = {}
            if patient_data.get("phone"):
                lookup["phone"] = patient_data["phone"]
            if patient_data.get("email"):
                lookup["email"] = patient_data["email"]
            if lookup:
                patient = Patient.objects.filter(**lookup).first()
            if not patient:
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

        # email notification
        if patient.email:
            try:
                send_mail(
                    subject="Appointment booked",
                    message=f"Your appointment with {provider.name} on {appt.start} is confirmed.",
                    from_email=None,
                    recipient_list=[patient.email],
                    fail_silently=True,
                )
            except Exception:
                pass
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], permission_classes=[AllowAny])
    def by_contact(self, request):
        """
        GET /api/appointments/by_contact/?phone=...&email=...
        Returns appointments filtered by patient phone or email.
        """
        phone = (request.query_params.get("phone") or "").strip()
        email = (request.query_params.get("email") or "").strip()
        if not phone and not email:
            return Response({"detail": "phone or email is required."}, status=status.HTTP_400_BAD_REQUEST)

        phone_norm = normalize_phone(phone)

        qs = Appointment.objects.all().order_by("-start")
        if phone_norm and email:
            qs = qs.filter(patient__phone=phone_norm, patient__email=email)
        elif phone_norm:
            qs = qs.filter(patient__phone=phone_norm)
        elif email:
            qs = qs.filter(patient__email=email)
        serializer = AppointmentSerializer(qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], permission_classes=[AllowAny])
    def cancel(self, request, pk=None):
        """
        POST /api/appointments/<id>/cancel/
        Sets status to 'cancelled' and frees the slot.
        """
        appt = self.get_object()
        if appt.status == "cancelled":
            return Response({"detail": "Appointment already cancelled."}, status=status.HTTP_200_OK)

        # free the slot if exists
        if appt.slot:
            appt.slot.is_available = True
            appt.slot.save(update_fields=["is_available"])

        appt.status = "cancelled"
        appt.save(update_fields=["status"])

        # email notification
        patient = appt.patient
        if patient and patient.email:
            try:
                send_mail(
                    subject="Appointment cancelled",
                    message=f"Your appointment with {appt.provider.name} on {appt.start} was cancelled.",
                    from_email=None,
                    recipient_list=[patient.email],
                    fail_silently=True,
                )
            except Exception:
                pass
        return Response({"detail": "Appointment cancelled."}, status=status.HTTP_200_OK)


class RegisterView(APIView):
    """
    Registration endpoint that creates a User account and a Patient record.
    POST /api/register/ { username, full_name, phone, email, password }
    """
    permission_classes = [AllowAny]

    def post(self, request):
        from django.contrib.auth.models import User
        
        username = request.data.get("username")
        email = request.data.get("email")
        password = request.data.get("password")
        full_name = request.data.get("full_name")
        phone = normalize_phone(request.data.get("phone"))
        
        # Validate required fields
        if not username:
            return Response({"detail": "username is required."}, status=status.HTTP_400_BAD_REQUEST)
        if not password:
            return Response({"detail": "password is required."}, status=status.HTTP_400_BAD_REQUEST)
        if not full_name:
            return Response({"detail": "full_name is required."}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if username already exists
        if User.objects.filter(username=username).exists():
            return Response({"detail": "Username already exists."}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if email already exists (if provided)
        if email and User.objects.filter(email=email).exists():
            return Response({"detail": "Email already exists."}, status=status.HTTP_400_BAD_REQUEST)
        
        # Create User account
        try:
            user = User.objects.create_user(
                username=username,
                email=email or "",
                password=password
            )
        except Exception as e:
            return Response({"detail": f"Failed to create user: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Create Patient record
        patient_data = {
            "full_name": full_name,
            "phone": phone or "",
            "email": email or "",
        }
        serializer = PatientSerializer(data=patient_data)
        if serializer.is_valid():
            patient = serializer.save()
            return Response({
                "id": patient.id,
                "username": user.username,
                "email": user.email,
                "full_name": patient.full_name,
                "phone": patient.phone,
            }, status=status.HTTP_201_CREATED)
        else:
            # If patient creation fails, delete the user
            user.delete()
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
