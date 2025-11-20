from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import datetime, timedelta
from appointments.models import ProviderSchedule, ScheduleSlot
import pytz

class Command(BaseCommand):
    help = "Generate ScheduleSlot instances for the next N days based on ProviderSchedule recurring rules."

    def add_arguments(self, parser):
        parser.add_argument('--days', type=int, default=14, help='Number of days to generate (default 14)')

    def handle(self, *args, **options):
        days = options['days']
        now = timezone.now()
        tz = timezone.get_current_timezone()

        created = 0
        for day_offset in range(days):
            day = (now + timedelta(days=day_offset)).date()
            weekday = day.weekday()  # Monday = 0
            schedules = ProviderSchedule.objects.filter(weekday=weekday)

            for sched in schedules:
                start_dt = datetime.combine(day, sched.start_time)
                end_dt = datetime.combine(day, sched.end_time)

                if start_dt.tzinfo is None:
                    start_dt = tz.localize(start_dt) if hasattr(tz, 'localize') else start_dt.replace(tzinfo=tz)
                if end_dt.tzinfo is None:
                    end_dt = tz.localize(end_dt) if hasattr(tz, 'localize') else end_dt.replace(tzinfo=tz)

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

        self.stdout.write(self.style.SUCCESS(f"Generated {created} slots for next {days} days."))
