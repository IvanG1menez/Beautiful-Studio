"""
Backend de autenticación personalizado para usar email en lugar de username
"""
from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model

User = get_user_model()


class EmailBackend(ModelBackend):
    """
    Backend de autenticación que permite login con email en lugar de username
    """

    def authenticate(self, request, username=None, password=None, **kwargs):
        """
        Autenticar usuario usando email como username
        
        Args:
            request: HTTP request
            username: Email del usuario (se llama username por compatibilidad con Django)
            password: Contraseña del usuario
        
        Returns:
            User object si autenticación exitosa, None si falla
        """
        try:
            # Buscar usuario por email (case-insensitive)
            user = User.objects.get(email__iexact=username)
        except User.DoesNotExist:
            # Run the default password hasher once to reduce the timing
            # difference between an existing and a nonexistent user (#20760).
            User().set_password(password)
            return None
        except User.MultipleObjectsReturned:
            # Si hay múltiples usuarios con el mismo email (no debería pasar por unique=True)
            user = User.objects.filter(email__iexact=username).order_by('id').first()

        # Verificar password y si el usuario está activo
        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        
        return None
