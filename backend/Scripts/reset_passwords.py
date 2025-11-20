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
        print(f"  Nueva contraseña: {new_password}")
        return True
    except User.DoesNotExist:
        print(f"✗ Usuario no encontrado: {email}")
        return False

if __name__ == '__main__':
    print("\n" + "="*60)
    print("RESETEO DE CONTRASEÑAS")
    print("="*60 + "\n")
    
    # Resetear contraseñas a valores conocidos
    users_to_reset = [
        ('admin@test.com', 'admin123'),
        ('mailfalso321@yahoo.com', 'empleado123'),
        ('gimenezivanb@gmail.com', 'password123'),
    ]
    
    for email, password in users_to_reset:
        reset_user_password(email, password)
        print()
    
    print("="*60)
    print("RESUMEN: Todas las contraseñas han sido reseteadas")
    print("="*60)
