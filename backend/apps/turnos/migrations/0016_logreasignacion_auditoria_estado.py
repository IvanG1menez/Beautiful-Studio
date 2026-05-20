from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("turnos", "0015_streakcoupon"),
    ]

    operations = [
        migrations.AddField(
            model_name="logreasignacion",
            name="estado_anterior",
            field=models.JSONField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="logreasignacion",
            name="estado_posterior",
            field=models.JSONField(blank=True, null=True),
        ),
        migrations.AddIndex(
            model_name="logreasignacion",
            index=models.Index(fields=["cliente_notificado", "estado_final", "expires_at"], name="turnos_logr_cliente_45d8a1_idx"),
        ),
    ]
