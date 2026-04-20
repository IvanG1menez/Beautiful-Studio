import logging

from django.conf import settings
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import TelegramUpdateLog
from .tasks import process_telegram_update
from .services import TelegramBotService

logger = logging.getLogger(__name__)


@method_decorator(csrf_exempt, name="dispatch")
class TelegramWebhookView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        expected_secret = getattr(settings, "TELEGRAM_WEBHOOK_SECRET", "")
        provided_secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")

        if expected_secret and provided_secret != expected_secret:
            logger.warning("Webhook Telegram rechazado por secret invalido")
            return Response({"detail": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)

        payload = request.data if isinstance(request.data, dict) else {}
        update_id = payload.get("update_id")
        if update_id is None:
            logger.info("Webhook Telegram sin update_id: ignorado")
            return Response({"detail": "Ignored"}, status=status.HTTP_200_OK)

        logger.info("Webhook Telegram recibido update_id=%s", update_id)

        update_log, created = TelegramUpdateLog.objects.get_or_create(
            update_id=update_id,
            defaults={"payload": payload},
        )
        if not created:
            logger.info("Webhook Telegram duplicado update_id=%s", update_id)
            return Response({"detail": "Duplicate"}, status=status.HTTP_200_OK)

        try:
            process_telegram_update.delay(update_log.id)
        except Exception as exc:
            logger.exception("Fallo cola async de Telegram, proceso inline: %s", exc)
            TelegramBotService().process_update(payload)
            update_log.processed = True
            from django.utils import timezone

            update_log.processed_at = timezone.now()
            update_log.save(update_fields=["processed", "processed_at"])

        return Response({"detail": "ok"}, status=status.HTTP_200_OK)
