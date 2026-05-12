from django.core.validators import MinValueValidator
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("authentication", "0004_configuracionglobal_pa3_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="configuracionglobal",
            name="horas_vencimiento_solicitud_reprogramacion",
            field=models.IntegerField(
                default=48,
                help_text="Horas disponibles para que el profesional atienda una solicitud flexible de reprogramación",
                validators=[MinValueValidator(1)],
                verbose_name="Horas de vencimiento de solicitud de reprogramación",
            ),
        ),
    ]
