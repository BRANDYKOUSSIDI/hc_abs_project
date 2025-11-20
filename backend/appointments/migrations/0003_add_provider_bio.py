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
