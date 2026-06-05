from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("emails", "0004_promotionoffer"),
    ]

    operations = [
        migrations.AddField(
            model_name="promotionoffer",
            name="payment_tipo_pago",
            field=models.CharField(blank=True, default="", max_length=20),
        ),
        migrations.AddField(
            model_name="promotionoffer",
            name="payment_creditos_aplicados",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.AddField(
            model_name="promotionoffer",
            name="payment_monto_mp",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
    ]
