from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("servicios", "0002_descuento_reasignacion"),
    ]

    operations = [
        migrations.AddField(
            model_name="servicio",
            name="permite_reacomodamiento",
            field=models.BooleanField(
                default=False,
                verbose_name="Permite reacomodamiento",
                help_text="Indica si el servicio participa en la lógica de rellenar huecos",
            ),
        ),
        migrations.AddField(
            model_name="servicio",
            name="tipo_descuento_adelanto",
            field=models.CharField(
                choices=[("PORCENTAJE", "Porcentaje"), ("MONTO_FIJO", "Monto fijo")],
                default="PORCENTAJE",
                max_length=20,
                verbose_name="Tipo de descuento por adelanto",
            ),
        ),
        migrations.AddField(
            model_name="servicio",
            name="valor_descuento_adelanto",
            field=models.DecimalField(
                decimal_places=2,
                default=0,
                max_digits=10,
                verbose_name="Valor del descuento por adelanto",
            ),
        ),
        migrations.AddField(
            model_name="servicio",
            name="tiempo_espera_respuesta",
            field=models.PositiveIntegerField(
                default=15,
                verbose_name="Tiempo de espera de respuesta (minutos)",
                help_text="Minutos que el sistema espera antes de pasar al siguiente cliente",
            ),
        ),
        migrations.AddField(
            model_name="servicio",
            name="porcentaje_sena",
            field=models.DecimalField(
                decimal_places=2,
                default=25.00,
                max_digits=5,
                verbose_name="Porcentaje de seña",
                help_text="Porcentaje que se cobrará por Mercado Pago",
            ),
        ),
    ]
