# === Backup the current database ===
cd "C:\Users\USER\Documents\hc_abs_project\backend"
if (Test-Path .\db.sqlite3) {
    Copy-Item .\db.sqlite3 .\db.sqlite3.bak -Force
    Write-Host "✅ Database backed up as db.sqlite3.bak"
} else {
    Write-Host "⚠️ No database file found!"
}

# === Create a migration to add the 'bio' column to Provider ===
@'
from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ("appointments", "0002_specialty_alter_scheduleslot_options_provider_bio_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="provider",
            name="bio",
            field=models.TextField(blank=True, null=True),
        ),
    ]
'@ | Out-File -Encoding utf8 .\appointments\migrations\0003_add_provider_bio.py

Write-Host "✅ Migration file created: appointments/migrations/0003_add_provider_bio.py"

# === Run the migration ===
& python manage.py migrate appointments

# === Verify ===
Write-Host "✅ Done. You can now test with:"
Write-Host "python manage.py shell"
Write-Host ">>> from appointments.models import Provider"
Write-Host ">>> Provider.objects.all()[:5]"
