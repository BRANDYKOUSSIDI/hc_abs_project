from django.contrib import admin
from .models import Specialty, Provider, ProviderSchedule, ScheduleSlot, Patient, Appointment

admin.site.register(Specialty)
admin.site.register(Provider)
admin.site.register(ProviderSchedule)
admin.site.register(ScheduleSlot)
admin.site.register(Patient)
admin.site.register(Appointment)
