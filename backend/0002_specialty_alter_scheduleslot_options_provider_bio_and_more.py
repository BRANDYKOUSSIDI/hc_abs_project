from django.db import migrations, models
import django.db.models.deletion
import uuid
def forwards_create_specialties_and_assign(apps, schema_editor):
    Provider = apps.get_model('appointments', 'Provider')
Specialty = apps.get_model('appointments', 'Specialty')
 with schema_editor.connection.cursor() as cursor:
        cursor.execute("SELECT DISTINCT specialty FROM appointments_provider")
 rows = cursor.fetchall()
names = [r[0] for r in rows if r and r[0] is not None]
 name_to_obj = {}
for val in names:
  nm = str(val)
 if nm.strip() == "":
 continue
 spec_obj, created = Specialty.objects.get_or_create(name=nm)
 name_to_obj[nm] = spec_obj
for prov in Provider.objects.all():
 curval = prov.specialty
if curval is None:
continue
 curstr = str(curval)
 spec = name_to_obj.get(curstr)
 if spec:
prov.specialty_tmp_id = spec.id
 prov.save(update_fields=['specialty_tmp_id'])
def backwards_remove_specialty_tmp(apps, schema_editor):
  return
class Migration(migrations.Migration):
 dependencies = [
 ('appointments', '0001_initial'),
 ]
operations = [
migrations.CreateModel(
 name='Specialty',
 fields=[
 ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
  ('name', models.CharField(max_length=120, unique=True)),
  ],
 ),
migrations.AddField(
 model_name='provider',
name='specialty_tmp',
field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to='appointments.specialty'),
 ),
 migrations.RunPython(forwards_create_specialties_and_assign, backwards_remove_specialty_tmp),
 migrations.RemoveField(
 model_name='provider',
name='specialty',
  ),
migrations.RenameField(
model_name='provider',
 old_name='specialty_tmp',
 new_name='specialty',
),
 ]
