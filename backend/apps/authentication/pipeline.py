"""
Pipeline personalizado para Social Auth (Google OAuth)
"""
from apps.clientes.models import Cliente
from apps.authentication.models import ConfiguracionSSO
from social_core.pipeline.user import create_user as social_create_user
from django.contrib.auth import get_user_model

User = get_user_model()


def associate_by_email(backend, details, user=None, *args, **kwargs):
    """
    Pipeline para asociar una cuenta de Google con un usuario existente por email.
    Si el usuario ya existe con ese email, lo asocia en lugar de crear uno nuevo.
    """
    if user:
        return {'user': user}
    
    email = details.get('email')
    if email:
        # Buscar usuario existente con ese email
        try:
            existing_user = User.objects.get(email=email)
            return {'user': existing_user, 'is_new': False}
        except User.DoesNotExist:
            pass
    
    return None


def create_user_with_username(strategy, details, backend, user=None, *args, **kwargs):
    """
    Pipeline personalizado para crear usuarios con username generado automáticamente.
    Reemplaza el pipeline estándar de social_core.pipeline.user.create_user
    """
    if user:
        return {'is_new': False, 'user': user}
    
    # Generar username único basado en email
    email = details.get('email')
    if not email:
        return
    
    base_username = email.split('@')[0]
    username = base_username
    counter = 1
    
    # Asegurar que el username sea único
    while User.objects.filter(username=username).exists():
        username = f"{base_username}{counter}"
        counter += 1
    
    # Agregar username a los detalles
    details['username'] = username
    
    # Llamar al pipeline estándar de creación de usuario con el username
    return social_create_user(strategy, details, backend, user, *args, **kwargs)


def create_cliente_profile(backend, user, response, *args, **kwargs):
    """
    Pipeline personalizado para crear perfil de Cliente automáticamente
    cuando un usuario se registra con Google OAuth
    
    Args:
        backend: Backend de autenticación (GoogleOAuth2)
        user: Usuario creado/actualizado
        response: Respuesta de Google con datos del usuario
        *args, **kwargs: Argumentos adicionales
    
    Returns:
        None o dict con información adicional
    """
    # Verificar si la autocreación de clientes está activa
    config = ConfiguracionSSO.get_config()
    
    if not config.autocreacion_cliente_sso:
        # Si la autocreación está desactivada, solo asignar rol cliente
        if not user.role:
            user.role = 'cliente'
            user.save()
        return
    
    # Verificar si el usuario es nuevo (no tiene rol asignado)
    if not user.role or user.role == 'cliente':
        # Asignar rol de cliente
        user.role = 'cliente'
        user.save()
        
        # Crear perfil de cliente si no existe
        if not hasattr(user, 'cliente_profile'):
            Cliente.objects.create(
                user=user,
                fecha_nacimiento=None,  # El cliente puede completar después
            )
    
    return
