from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("turnos", "0014_delete_solicitudreprogramacionflexible"),
    ]

    operations = [
        migrations.CreateModel(
            name="StreakCoupon",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.CharField(blank=True, max_length=20, null=True, unique=True)),
                ("milestone_number", models.PositiveIntegerField(verbose_name="Hito alcanzado")),
                ("discount_amount", models.DecimalField(decimal_places=2, max_digits=10)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pendiente", "Pendiente"),
                            ("reclamado", "Reclamado"),
                            ("usado", "Usado"),
                            ("vencido", "Vencido"),
                            ("cancelado", "Cancelado"),
                        ],
                        default="pendiente",
                        max_length=20,
                    ),
                ),
                ("claimed_at", models.DateTimeField(blank=True, null=True)),
                ("used_at", models.DateTimeField(blank=True, null=True)),
                ("expires_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "cliente",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="streak_coupons", to="clientes.cliente"),
                ),
                (
                    "reward_event",
                    models.OneToOneField(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="coupon",
                        to="turnos.streakrewardevent",
                    ),
                ),
                (
                    "used_turno",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="streak_coupons_used",
                        to="turnos.turno",
                    ),
                ),
            ],
            options={
                "verbose_name": "Cupón de racha",
                "verbose_name_plural": "Cupones de racha",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="streakcoupon",
            index=models.Index(fields=["cliente", "status"], name="turnos_stre_cliente_7c87a9_idx"),
        ),
        migrations.AddIndex(
            model_name="streakcoupon",
            index=models.Index(fields=["code"], name="turnos_stre_code_16d4d8_idx"),
        ),
    ]
