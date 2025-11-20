
# Generated replacement migration with data migration to safely convert provider.specialty text -> FK
from django.db import migrations, models
import django.db.models.deletion
import uuid

def forwards_create_specialties_and_assign(apps, schema_editor):
    Provider = apps.get_model('appointments', 'Provider')
    Specialty = apps.get_model('appointments', 'Specialty')

    # read distinct specialty string values from the current provider table (raw SQL)
    # (some rows may already be UUIDs; handle non-UUID text)
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("SELECT DISTINCT specialty FROM appointments_provider")
        rows = cursor.fetchall()
        names = [r[0] for r in rows if r and r[0] is not None]

    name_to_obj = {}
    for val in names:
        # If value looks like a UUID (36 or 32 hex chars), skip creating duplicate name; use it as string name
        # We'll create Specialty rows using the textual value as the `name`.
        nm = str(val)
        # avoid creating empty names
        if nm.strip() == "":
            continue
        spec_obj, created = Specialty.objects.get_or_create(name=nm)
        name_to_obj[nm] = spec_obj

    # Now assign specialty_tmp for providers whose specialty text matches a created Specialty name
    for prov in Provider.objects.all():
        curval = prov.specialty
        if curval is None:
            continue
        curstr = str(curval)
        spec = name_to_obj.get(curstr)
        if spec:
            # Use ORM's update to set the fk temporary field (field added earlier in migration)
            prov.specialty_tmp_id = spec.id
            prov.save(update_fields=['specialty_tmp_id'])


def backwards_remove_specialty_tmp(apps, schema_editor):
    # No-op for backwards (we won't attempt to restore text automatically)
    return

class Migration(migrations.Migration):

    dependencies = [
        ('appointments', '0001_initial'),
    ]

    operations = [
        # 1. Create Specialty model
        migrations.CreateModel(
            name='Specialty',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=120, unique=True)),
            ],
        ),

        # 2. Add a nullable FK temp field to Provider to hold new FK values while we copy data
        migrations.AddField(
            model_name='provider',
            name='specialty_tmp',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to='appointments.specialty'),
        ),

        # 3. Data migration: create specialty rows from existing provider.specialty text values and assign specialty_tmp
        migrations.RunPython(forwards_create_specialties_and_assign, backwards_remove_specialty_tmp),

        # 4. Remove the old text 'specialty' field (may currently be CharField) from Provider
        migrations.RemoveField(
            model_name='provider',
            name='specialty',
        ),

        # 5. Rename specialty_tmp to specialty (this makes the FK permanent)
        migrations.RenameField(
            model_name='provider',
            old_name='specialty_tmp',
            new_name='specialty',
        ),

        # 6. Ensure ScheduleSlot options / Provider bio and other alterations can follow after the FK exists.
        # (If your original 0002 had other operations for ScheduleSlot or Provider, add them here as needed.)
    ]

