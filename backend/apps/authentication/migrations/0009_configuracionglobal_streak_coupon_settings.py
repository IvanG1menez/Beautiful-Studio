from django.core.validators import MinValueValidator
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("authentication", "0008_remove_configuracionglobal_horas_vencimiento_solicitud_reprogramacion"),
    ]

    operations = [
        migrations.AddField(
            model_name="configuracionglobal",
            name="streak_coupon_expiration_days",
            field=models.IntegerField(
                default=90,
                help_text="Cantidad de días que el cupón de racha permanece disponible para usar.",
                validators=[MinValueValidator(1)],
                verbose_name="Días de vencimiento de cupón de racha",
            ),
        ),
        migrations.AddField(
            model_name="configuracionglobal",
            name="streak_goal_count",
            field=models.IntegerField(
                default=5,
                help_text="Cantidad de turnos completados necesarios para generar un cupón de fidelidad.",
                validators=[MinValueValidator(1)],
                verbose_name="Meta de turnos para racha",
            ),
        ),
    ]
