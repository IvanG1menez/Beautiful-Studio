from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("turnos", "0013_solicitudreprogramacionflexible_expires_at_and_more"),
    ]

    operations = [
        migrations.DeleteModel(
            name="SolicitudReprogramacionFlexible",
        ),
    ]
