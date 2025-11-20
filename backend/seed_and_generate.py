# seed_and_generate.py
# Run this from backend folder with your venv active:
# python seed_and_generate.py

import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django
django.setup()

from datetime import time, timedelta
from django.db import transaction
from django.utils import timezone
from appointments.models import Specialty, Provider, ProviderSchedule, ScheduleSlot

def seed_providers():
    photo_map = {
        "General Practice": "https://i.pravatar.cc/400?img=12",
        "Physician": "https://i.pravatar.cc/400?img=15",
        "Gynecologist": "https://i.pravatar.cc/400?img=22",
        "Surgeon": "https://i.pravatar.cc/400?img=17",
        "Optometrist": "https://i.pravatar.cc/400?img=20",
    }
    spec_names = ["General Practice", "Physician", "Gynecologist", "Surgeon", "Optometrist"]

    with transaction.atomic():
        for name in spec_names:
            spec, _ = Specialty.objects.get_or_create(name=name)
            for i in range(1, 3):  # two doctors per specialty
                p_name = f"Dr. {name.split()[0]} {chr(64 + i)}"
                defaults = {
                    "bio": f"{name} expert with years of experience.",
                    "photo": photo_map.get(name),
                    "fee": 50.00 + i * 20,
                    "phone": "+256700000000",
                    "email": None,
                }
                provider, created = Provider.objects.get_or_create(
                    name=p_name,
                    specialty=spec,
                    defaults=defaults
                )

                # create Mon-Fri morning & afternoon schedules
                for wd in range(0, 5):
                    ProviderSchedule.objects.get_or_create(
                        provider=provider,
                        weekday=wd,
                        start_time=time(10, 0),
                        end_time=time(12, 0),
                        slot_duration_minutes=30
                    )
                    ProviderSchedule.objects.get_or_create(
                        provider=provider,
                        weekday=wd,
                        start_time=time(14, 0),
                        end_time=time(16, 0),
                        slot_duration_minutes=30
                    )
    print("Seeding complete.")

def generate_slots(days=21):
    now = timezone.now()
    tz = timezone.get_current_timezone()
    created = 0
    for day_offset in range(days):
        day = (now + timedelta(days=day_offset)).date()
        weekday = day.weekday()
        schedules = ProviderSchedule.objects.filter(weekday=weekday)
        for sched in schedules:
            # build timezone-aware datetimes
            start_dt = timezone.make_aware(datetime := __import__('datetime').datetime.combine(day, sched.start_time), tz) if True else None
            end_dt = timezone.make_aware(datetime := __import__('datetime').datetime.combine(day, sched.end_time), tz) if True else None

            # alternative to avoid localize issues if make_aware doesn't like naive
            # (the above line ensures tz-aware using Django utilities)

            if start_dt >= end_dt:
                continue
            slot_len = timedelta(minutes=sched.slot_duration_minutes)
            cur = start_dt
            while cur + slot_len <= end_dt:
                exists = ScheduleSlot.objects.filter(provider=sched.provider, start=cur, end=cur + slot_len).exists()
                if not exists:
                    ScheduleSlot.objects.create(provider=sched.provider, start=cur, end=cur + slot_len, is_available=True)
                    created += 1
                cur += slot_len
    print(f"Generated {created} slots for next {days} days.")

if __name__ == "__main__":
    # run seeding then slot generation
    seed_providers()
    generate_slots(days=21)
