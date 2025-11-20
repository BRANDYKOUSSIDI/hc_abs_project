import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django
django.setup()
from appointments.models import Specialty, Provider
print("Specialties:", [s.name for s in Specialty.objects.all()])
for p in Provider.objects.all()[:50]:
    print("Provider:", p.id, p.name, "->", getattr(p.specialty, 'name', p.specialty))
