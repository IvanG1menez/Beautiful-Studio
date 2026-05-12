from django.db import migrations, models
import django.core.validators


def _seed_streak_alert_days(apps, schema_editor):
    ConfiguracionGlobal = apps.get_model("authentication", "ConfiguracionGlobal")
    ConfiguracionGlobal.objects.filter(pk=1).update(streak_alert_days=[3, 1])


class Migration(migrations.Migration):

    dependencies = [
        ("authentication", "0003_configuracionglobal_dias_vencimiento_credito"),
    ]

    operations = [
        migrations.AddField(
            model_name="configuracionglobal",
            name="streak_alert_days",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="Lista de días previos al vencimiento para disparar alertas (ej: [3, 1]).",
                verbose_name="Umbrales de alerta de vencimiento",
            ),
        ),
        migrations.AddField(
            model_name="configuracionglobal",
            name="streak_bonus_amount",
            field=models.DecimalField(
                decimal_places=2,
                default=0,
                help_text="Monto fijo de descuento promocional que se aplica al alcanzar cada múltiplo de 5.",
                max_digits=10,
                verbose_name="Bono fijo por racha",
            ),
        ),
        migrations.AddField(
            model_name="configuracionglobal",
            name="streak_expiration_days",
            field=models.IntegerField(
                default=180,
                help_text="Si entre turnos completados pasan más días que este valor, la racha se reinicia.",
                validators=[django.core.validators.MinValueValidator(1)],
                verbose_name="Días de vencimiento de racha",
            ),
        ),
        migrations.RunPython(
            code=_seed_streak_alert_days,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
