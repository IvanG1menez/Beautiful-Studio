"""
Script para probar autenticación de usuarios
"""
import os
import sys
import django

# Configurar Django
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth import authenticate
from apps.users.models import User

def test_user_authentication(email, password):
    """Probar autenticación de un usuario"""
    print(f"\n{'='*60}")
    print(f"Probando autenticación para: {email}")
    print(f"{'='*60}")
    
    # Verificar que el usuario existe
    try:
        user = User.objects.get(email=email.lower().strip())
        print(f"✓ Usuario encontrado: {user.email}")
        print(f"  - Nombre: {user.first_name} {user.last_name}")
        print(f"  - Role: {user.role}")
        print(f"  - Activo: {user.is_active}")
        print(f"  - Username field: {user.username}")
    except User.DoesNotExist:
        print(f"✗ Usuario NO encontrado con email: {email}")
        return
    
    # Probar autenticación con authenticate()
    print(f"\nProbando authenticate()...")
    authenticated_user = authenticate(username=email.lower().strip(), password=password)
    
    if authenticated_user:
        print(f"✓ Autenticación EXITOSA")
        print(f"  - User ID: {authenticated_user.id}")
        print(f"  - Email: {authenticated_user.email}")
    else:
        print(f"✗ Autenticación FALLIDA")
        
        # Verificar password manualmente
        print(f"\nProbando check_password()...")
        if user.check_password(password):
            print(f"✓ Password es CORRECTO (check_password)")
            print(f"  ⚠ Problema: authenticate() falla pero check_password() funciona")
            print(f"  Posible causa: USERNAME_FIELD configurado incorrectamente")
        else:
            print(f"✗ Password es INCORRECTO")
    
    print(f"{'='*60}\n")

if __name__ == '__main__':
    # Probar varios usuarios
    test_cases = [
        ('admin@test.com', 'admin123'),  # Usuario admin
        ('mailfalso321@yahoo.com', 'empleado123'),  # Profesional
        ('gimenezivanb@gmail.com', 'password123'),  # Cliente
    ]
    
    print("\n" + "="*60)
    print("TEST DE AUTENTICACIÓN DE USUARIOS")
    print("="*60)
    
    for email, password in test_cases:
        test_user_authentication(email, password)
    
    # Mostrar configuración de USERNAME_FIELD
    print("\nCONFIGURACIÓN DEL MODELO User:")
    print(f"  - USERNAME_FIELD: {User.USERNAME_FIELD}")
    print(f"  - REQUIRED_FIELDS: {User.REQUIRED_FIELDS}")
