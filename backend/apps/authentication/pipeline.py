"""
Pipeline personalizado para Social Auth (Google OAuth)
"""
from apps.clientes.models import Cliente
from apps.authentication.models import ConfiguracionSSO
from social_core.pipeline.user import create_user as social_create_user
from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token
from django.shortcuts import redirect
from django.conf import settings
import json
from urllib.parse import urlencode

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
        print(f"[Pipeline] Usuario ya existe: {user.email}")
        return {'is_new': False, 'user': user}
    
    # Generar username único basado en email
    email = details.get('email')
    if not email:
        print("[Pipeline] ERROR: No hay email en los detalles")
        return
    
    base_username = email.split('@')[0]
    username = base_username
    counter = 1
    
    # Asegurar que el username sea único
    while User.objects.filter(username=username).exists():
        username = f"{base_username}{counter}"
        counter += 1
    
    print(f"[Pipeline] Creando nuevo usuario: {email} con username: {username}")
    
    # Agregar username a los detalles
    details['username'] = username
    
    # Llamar al pipeline estándar de creación de usuario con el username
    result = social_create_user(strategy, details, backend, user, *args, **kwargs)
    
    if result and result.get('user'):
        print(f"[Pipeline] Usuario creado exitosamente: ID={result['user'].id}, Email={result['user'].email}")
    
    return result


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
    print(f"[Pipeline] create_cliente_profile - Usuario: {user.email}, Rol actual: {user.role}")
    
    # Verificar si la autocreación de clientes está activa
    config = ConfiguracionSSO.get_config()
    print(f"[Pipeline] Autocreación de clientes: {config.autocreacion_cliente_sso}")
    
    if not config.autocreacion_cliente_sso:
        # Si la autocreación está desactivada, solo asignar rol cliente
        if not user.role:
            user.role = 'cliente'
            user.save()
            print(f"[Pipeline] Rol 'cliente' asignado (autocreación desactivada)")
        return
    
    # Verificar si el usuario es nuevo (no tiene rol asignado)
    if not user.role or user.role == 'cliente':
        # Asignar rol de cliente
        user.role = 'cliente'
        user.save()
        print(f"[Pipeline] Rol 'cliente' asignado")
        
        # Crear perfil de cliente si no existe
        if not hasattr(user, 'cliente_profile'):
            cliente = Cliente.objects.create(
                user=user,
                fecha_nacimiento=None,  # El cliente puede completar después
            )
            print(f"[Pipeline] Perfil de Cliente creado: ID={cliente.id}")
        else:
            print(f"[Pipeline] Usuario ya tiene perfil de Cliente")
    
    return


def redirect_with_token(backend, user, response, *args, **kwargs):
    """
    Pipeline final que redirige al frontend con el token en la URL
    para que el frontend pueda guardarlo en localStorage
    """
    # Crear o obtener el token del usuario
    token, created = Token.objects.get_or_create(user=user)
    
    # Preparar los datos del usuario para pasar al frontend
    user_data = {
        'id': user.id,
        'email': user.email,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'role': user.role,
        'phone': user.phone if hasattr(user, 'phone') else '',
    }
    
    # Construir la URL de redirección con el token y datos del usuario
    frontend_url = settings.SOCIAL_AUTH_LOGIN_REDIRECT_URL
    params = {
        'token': token.key,
        'user': json.dumps(user_data)
    }
    
    redirect_url = f"{frontend_url}?{urlencode(params)}"
    
    # Retornar una redirección HTTP
    return redirect(redirect_url)
