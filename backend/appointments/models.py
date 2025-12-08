# backend/appointments/models.py

import uuid
from datetime import time as dtime, timedelta
from decimal import Decimal

from django.db import models
from django.utils import timezone
from django.core.validators import MinValueValidator

# Weekday choices for ProviderSchedule
WEEKDAY_CHOICES = [
    (0, "Monday"),
    (1, "Tuesday"),
    (2, "Wednesday"),
    (3, "Thursday"),
    (4, "Friday"),
    (5, "Saturday"),
    (6, "Sunday"),
]


class Specialty(models.Model):
    """
    Medical specialty (e.g., General, Physician, Gynecologist, Surgeon, Optometrist)
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120, unique=True)

    def __str__(self):
        return self.name


class Provider(models.Model):
    """
    A doctor/provider. Includes photo URL, short bio, and consultation fee.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    specialty = models.ForeignKey(
        Specialty, on_delete=models.SET_NULL, null=True, related_name="providers"
    )

    # descriptive fields
    bio = models.TextField(blank=True, null=True)         # free-text bio
    photo = models.URLField(blank=True, null=True)        # image URL (useful for quick demo)
    fee = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )

    # contact fields optional
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True, null=True)

    def __str__(self):
        # show specialty name if available
        spec = self.specialty.name if self.specialty else "No specialty"
        return f"{self.name} ({spec})"
    
    def save(self, *args, **kwargs):
        """Override save to automatically create default schedules for new providers"""
        is_new = self._state.adding
        super().save(*args, **kwargs)
        
        # If this is a new provider and has no schedules, create default ones
        if is_new:
            from datetime import time
            from .models import ProviderSchedule
            
            existing_schedules = ProviderSchedule.objects.filter(provider=self).count()
            if existing_schedules == 0:
                # Create Mon-Fri morning & afternoon schedules
                for wd in range(0, 5):  # Monday to Friday
                    ProviderSchedule.objects.get_or_create(
                        provider=self,
                        weekday=wd,
                        start_time=time(10, 0),
                        end_time=time(12, 0),
                        defaults={'slot_duration_minutes': 30}
                    )
                    ProviderSchedule.objects.get_or_create(
                        provider=self,
                        weekday=wd,
                        start_time=time(14, 0),
                        end_time=time(16, 0),
                        defaults={'slot_duration_minutes': 30}
                    )


class Patient(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    full_name = models.CharField(max_length=200)
    dob = models.DateField(null=True, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(null=True, blank=True)

    def __str__(self):
        return self.full_name


class ProviderSchedule(models.Model):
    """
    Defines a weekly recurring availability for a provider:
    e.g. Monday 10:00 - 12:00, slot_duration_minutes=30
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    provider = models.ForeignKey(Provider, on_delete=models.CASCADE, related_name="schedules")
    weekday = models.IntegerField(choices=WEEKDAY_CHOICES)
    start_time = models.TimeField()  # e.g., 10:00
    end_time = models.TimeField()    # e.g., 12:00
    slot_duration_minutes = models.PositiveIntegerField(default=30)

    class Meta:
        unique_together = ("provider", "weekday", "start_time", "end_time")

    def __str__(self):
        day = dict(WEEKDAY_CHOICES).get(self.weekday, str(self.weekday))
        return f"{self.provider.name} - {day} {self.start_time}-{self.end_time}"


class ScheduleSlot(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    provider = models.ForeignKey(Provider, on_delete=models.CASCADE, related_name="slots")
    start = models.DateTimeField()
    end = models.DateTimeField()
    is_available = models.BooleanField(default=True)
    slot_type = models.CharField(max_length=50, default="standard")

    class Meta:
        unique_together = ("provider", "start", "end")
        ordering = ["start"]

    def __str__(self):
        return f"{self.provider} | {self.start.isoformat()}"


class Appointment(models.Model):
    STATUS_CHOICES = [
        ("proposed", "Proposed"),
        ("booked", "Booked"),
        ("cancelled", "Cancelled"),
        ("noshow", "No-show"),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="appointments")
    provider = models.ForeignKey(Provider, on_delete=models.CASCADE, related_name="appointments")
    slot = models.ForeignKey(ScheduleSlot, on_delete=models.SET_NULL, null=True, blank=True)
    start = models.DateTimeField()
    end = models.DateTimeField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="proposed")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Appt {self.id} {self.patient} with {self.provider} at {self.start}"
