from rest_framework import serializers
from .models import Specialty, Provider, ProviderSchedule, ScheduleSlot, Patient, Appointment

class SpecialtySerializer(serializers.ModelSerializer):
    class Meta:
        model = Specialty
        fields = ('id','name')

class ProviderScheduleSerializer(serializers.ModelSerializer):
    weekday_display = serializers.SerializerMethodField()
    class Meta:
        model = ProviderSchedule
        fields = ('id','weekday','weekday_display','start_time','end_time','slot_duration_minutes')

    def get_weekday_display(self, obj):
        return obj.get_weekday_display()

class ProviderSerializer(serializers.ModelSerializer):
    specialty = SpecialtySerializer(read_only=True)
    specialty_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    schedules = ProviderScheduleSerializer(many=True, read_only=True)
    class Meta:
        model = Provider
        fields = ('id','name','specialty','specialty_id','bio','phone','email','schedules')

class ScheduleSlotSerializer(serializers.ModelSerializer):
    provider = ProviderSerializer(read_only=True)
    provider_id = serializers.UUIDField(write_only=True, required=True)
    class Meta:
        model = ScheduleSlot
        fields = ('id','provider','provider_id','start','end','is_available','slot_type')

class PatientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Patient
        fields = ('id','full_name','dob','phone','email')

class AppointmentSerializer(serializers.ModelSerializer):
    patient = PatientSerializer(read_only=True)
    patient_id = serializers.UUIDField(write_only=True, required=True)
    provider = ProviderSerializer(read_only=True)
    provider_id = serializers.UUIDField(write_only=True, required=True)
    slot = ScheduleSlotSerializer(read_only=True)
    slot_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    class Meta:
        model = Appointment
        fields = ('id','patient','patient_id','provider','provider_id','slot','slot_id','start','end','status','created_at')
        read_only_fields = ('created_at',)
