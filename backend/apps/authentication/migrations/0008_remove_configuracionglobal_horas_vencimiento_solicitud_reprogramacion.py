from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("authentication", "0007_alter_configuracionglobal_max_reprogramaciones_mensuales"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="configuracionglobal",
            name="horas_vencimiento_solicitud_reprogramacion",
        ),
    ]
