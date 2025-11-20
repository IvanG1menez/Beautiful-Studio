"""
Script para resetear contraseñas de usuarios específicos
"""
import os
import sys
import django

# Configurar Django
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.users.models import User

def reset_user_password(email, new_password):
    """Resetear contraseña de un usuario"""
    try:
        user = User.objects.get(email=email)
        user.set_password(new_password)
        user.save()
        print(f"✓ Contraseña actualizada para {email}")
        print(f"  Usuario: {user.first_name} {user.last_name}")
        print(f"  Rol: {user.role}")
        print(f"  Nueva contraseña: {new_password}")
        return True
    except User.DoesNotExist:
        print(f"✗ Usuario no encontrado: {email}")
        return False

if __name__ == '__main__':
    print("\n" + "="*60)
    print("RESETEO DE CONTRASEÑAS - USUARIOS DE TRABAJO")
    print("="*60 + "\n")
    
    # Resetear contraseñas a valores genéricos
    users_to_reset = [
        ('pro.adriana.cruz.pro636292@gmail.com', 'profesional123'),
        ('ricardo.prieto98@hotmail.com', 'cliente123'),
    ]
    
    for email, password in users_to_reset:
        reset_user_password(email, password)
        print()
    
    print("="*60)
    print("RESUMEN: Contraseñas reseteadas correctamente")
    print("="*60)
    print("\n📝 CREDENCIALES:")
    print("  Profesional: pro.adriana.cruz.pro636292@gmail.com / profesional123")
    print("  Cliente: ricardo.prieto98@hotmail.com / cliente123")
