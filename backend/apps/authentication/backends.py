"""
Backend personalizado para Google OAuth que obtiene credenciales desde la base de datos
"""

from django.conf import settings
from social_core.backends.google import GoogleOAuth2
from apps.authentication.models import ConfiguracionSSO


class CustomGoogleOAuth2(GoogleOAuth2):
    """
    Backend de Google OAuth2 que obtiene credenciales desde ConfiguracionSSO
    en lugar de usar solo variables de entorno.

    Prioridad:
    1. Variables de entorno (.env) - para desarrollo/producción
    2. Base de datos (ConfiguracionSSO) - configuradas desde el dashboard
    """

    name = "google-oauth2"

    def get_key_and_secret(self):
        """
        Sobrescribe el método para obtener credenciales desde la BD
        si no están disponibles en variables de entorno
        """
        # Intentar obtener desde variables de entorno primero (comportamiento original)
        client_id = self.setting("KEY", "")
        client_secret = self.setting("SECRET", "")

        # Si no están en variables de entorno, obtener desde BD
        if not client_id or not client_secret:
            try:
                config = ConfiguracionSSO.get_config()

                # Usar credenciales de BD si están configuradas
                if config.client_id and config.client_secret:
                    client_id = config.client_id
                    client_secret = config.client_secret
            except Exception as e:
                # Log del error pero continuar con valores vacíos
                print(f"⚠️ Error al obtener credenciales de BD: {e}")

        return client_id, client_secret

    def get_redirect_uri(self, state=None):
        """
        Usa SOCIAL_AUTH_GOOGLE_OAUTH2_REDIRECT_URI cuando está configurado.
        Sin este override social-auth construye la URI desde el request de Django,
        lo que devuelve http://localhost:8000/... en lugar de la URL de ngrok,
        causando redirect_uri_mismatch en Google.
        """
        uri = getattr(settings, "SOCIAL_AUTH_GOOGLE_OAUTH2_REDIRECT_URI", None)
        if uri:
            return uri
        return super().get_redirect_uri(state)
