from django.db import transaction
from .models import Appointment, ScheduleSlot, Patient, Provider

class AppointmentService:
    @staticmethod
    @transaction.atomic
    def book(patient_id, provider_id, slot_id=None, start=None, end=None):
        # fetch patient and provider
        patient = Patient.objects.get(pk=patient_id)
        provider = Provider.objects.get(pk=provider_id)

        if slot_id:
            slot = ScheduleSlot.objects.select_for_update().get(pk=slot_id)
            if not slot.is_available:
                raise ValueError("Slot not available")
            # reserve the slot
            slot.is_available = False
            slot.save()
            start = slot.start
            end = slot.end
        else:
            # allow custom start/end booking (simple)
            slot = None
            if not (start and end):
                raise ValueError("start and end required when no slot")

        appt = Appointment.objects.create(
            patient=patient,
            provider=provider,
            slot=slot,
            start=start,
            end=end,
            status='booked'
        )
        return appt
