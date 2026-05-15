from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.mercadopago import services


class Command(BaseCommand):
    help = "Crea/verifica la caja POS de Mercado Pago QR configurada en .env"

    def handle(self, *args, **options):
        external_id = (getattr(settings, "MP_QR_POS_EXTERNAL_ID", "") or "").strip()
        store_id = (getattr(settings, "MP_QR_STORE_ID", "") or "").strip()
        external_store_id = (getattr(settings, "MP_QR_EXTERNAL_STORE_ID", "") or "").strip()
        collector_id = (getattr(settings, "MP_QR_COLLECTOR_ID", "") or "").strip()

        self.stdout.write(f"MP_QR_POS_EXTERNAL_ID={external_id}")
        self.stdout.write(f"MP_QR_STORE_ID={store_id or '(vacío)'}")
        self.stdout.write(f"MP_QR_EXTERNAL_STORE_ID={external_store_id or '(vacío)'}")
        self.stdout.write(f"MP_QR_COLLECTOR_ID={collector_id or '(vacío)'}")

        if store_id:
            self.stdout.write(self.style.SUCCESS("Sucursal ya configurada por MP_QR_STORE_ID; no se crea nuevamente."))
        elif external_store_id:
            try:
                store_result = services.crear_store_qr(
                    collector_id=collector_id,
                    name=getattr(settings, "MP_QR_STORE_NAME", "Beautiful Studio"),
                    external_id=external_store_id,
                    street_name=getattr(settings, "MP_QR_STORE_STREET_NAME", "Av Corrientes"),
                    street_number=getattr(settings, "MP_QR_STORE_STREET_NUMBER", "1234"),
                    city_name=getattr(settings, "MP_QR_STORE_CITY_NAME", "CABA"),
                    state_name=getattr(settings, "MP_QR_STORE_STATE_NAME", "Capital Federal"),
                    latitude=getattr(settings, "MP_QR_STORE_LATITUDE", "-34.603722"),
                    longitude=getattr(settings, "MP_QR_STORE_LONGITUDE", "-58.381592"),
                    reference=getattr(settings, "MP_QR_STORE_REFERENCE", "Beautiful Studio"),
                )
            except ValueError as exc:
                raise CommandError(str(exc)) from exc

            if store_result.get("status") == "exists":
                self.stdout.write(self.style.WARNING("La sucursal ya existe en Mercado Pago."))
            else:
                self.stdout.write(self.style.SUCCESS("Sucursal QR creada correctamente."))
                self.stdout.write(f"ID sucursal Mercado Pago: {store_result.get('id')}")
                store_id = str(store_result.get("id") or store_id)

        try:
            result = services.crear_pos_qr(
                name="Beautiful Studio Profesional",
                external_id=external_id,
                store_id=store_id,
                external_store_id=external_store_id,
            )
        except ValueError as exc:
            raise CommandError(str(exc)) from exc

        status = result.get("status")
        if status == "exists":
            self.stdout.write(self.style.WARNING("El POS ya existe en Mercado Pago."))
            self.stdout.write(result.get("detail", ""))
            return

        self.stdout.write(self.style.SUCCESS("POS QR creado correctamente."))
        self.stdout.write(f"ID Mercado Pago: {result.get('id')}")
        self.stdout.write(f"External ID: {result.get('external_id')}")
        qr = result.get("qr") or {}
        if qr.get("image"):
            self.stdout.write(f"QR estático: {qr.get('image')}")
