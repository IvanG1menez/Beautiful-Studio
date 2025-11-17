"""
Script para generar 100 clientes con datos realistas
"""

import os
import sys
import django
import random
from datetime import datetime, timedelta

# Configurar el path para encontrar el módulo de settings
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Configurar Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from django.contrib.auth import get_user_model
from apps.clientes.models import Cliente
from django.utils import timezone

User = get_user_model()

# Datos realistas para Argentina/América Latina
NOMBRES = [
    "María",
    "Juan",
    "Ana",
    "Carlos",
    "Laura",
    "Miguel",
    "Sofia",
    "Diego",
    "Valentina",
    "Mateo",
    "Isabella",
    "Santiago",
    "Camila",
    "Sebastián",
    "Martina",
    "Lucas",
    "Emma",
    "Nicolás",
    "Lucía",
    "Benjamín",
    "Victoria",
    "Joaquín",
    "Catalina",
    "Gabriel",
    "Paula",
    "Tomás",
    "Carolina",
    "Agustín",
    "Florencia",
    "Felipe",
    "Antonella",
    "Matías",
    "Renata",
    "Samuel",
    "Julieta",
    "Ignacio",
    "Amanda",
    "Andrés",
    "Fernanda",
    "Rafael",
    "Daniela",
    "Emilio",
    "Gabriela",
    "Eduardo",
    "Patricia",
    "Ricardo",
    "Mariana",
    "Francisco",
    "Sandra",
]

APELLIDOS = [
    "González",
    "Rodríguez",
    "Fernández",
    "López",
    "Martínez",
    "García",
    "Sánchez",
    "Pérez",
    "Romero",
    "Gómez",
    "Díaz",
    "Álvarez",
    "Moreno",
    "Jiménez",
    "Ruiz",
    "Hernández",
    "Muñoz",
    "Torres",
    "Vargas",
    "Castro",
    "Ramos",
    "Gil",
    "Núñez",
    "Ramírez",
    "Méndez",
    "Cruz",
    "Flores",
    "Vega",
    "Silva",
    "Ortiz",
    "Reyes",
    "Molina",
    "Guerrero",
    "Medina",
    "Aguilar",
    "Ríos",
    "Gutiérrez",
    "Campos",
    "Morales",
    "Cortés",
    "Herrera",
    "Mendoza",
    "Castillo",
    "Cabrera",
    "Peralta",
    "Acosta",
    "Benítez",
    "Luna",
    "Márquez",
]

CALLES = [
    "Av. Libertador",
    "Av. Corrientes",
    "Av. Santa Fe",
    "Calle Florida",
    "Av. Callao",
    "Av. Rivadavia",
    "Calle Tucumán",
    "Av. Córdoba",
    "Calle Lavalle",
    "Av. de Mayo",
    "Calle Reconquista",
    "Av. Belgrano",
    "Calle San Martín",
    "Av. Independencia",
    "Calle Maipú",
    "Av. Pueyrredón",
    "Calle Sarmiento",
    "Av. Cabildo",
    "Calle Paraguay",
    "Av. Las Heras",
]

PREFERENCIAS = [
    "Prefiere turnos por la mañana",
    "Sensible a productos con fragancia",
    "Prefiere estilista femenina",
    "Cliente VIP - atención preferencial",
    "Prefiere turnos de fin de semana",
    "Alérgico a ciertos productos químicos",
    "Prefiere cortes modernos y arriesgados",
    "Busca tratamientos naturales",
    "Interesado en coloración sin amoníaco",
    "Prefiere ambientes tranquilos",
]


def generar_telefono():
    """Genera un número de teléfono argentino realista"""
    return f"+54 11 {random.randint(1000, 9999)}-{random.randint(1000, 9999)}"


def generar_email(nombre, apellido):
    """Genera un email realista"""
    dominios = ["gmail.com", "hotmail.com", "yahoo.com", "outlook.com", "live.com"]
    separadores = [".", "_", ""]
    separador = random.choice(separadores)
    dominio = random.choice(dominios)

    nombre_lower = nombre.lower().replace(" ", "")
    apellido_lower = apellido.lower().replace(" ", "")

    numero = random.randint(1, 999) if random.random() > 0.5 else ""

    return f"{nombre_lower}{separador}{apellido_lower}{numero}@{dominio}"


def generar_direccion():
    """Genera una dirección realista de Buenos Aires"""
    calle = random.choice(CALLES)
    numero = random.randint(100, 9999)
    piso = random.randint(1, 20) if random.random() > 0.4 else None
    depto = random.choice(["A", "B", "C", "D", "E", "F"]) if piso else None

    direccion = f"{calle} {numero}"
    if piso and depto:
        direccion += f", Piso {piso} Depto {depto}"

    return direccion


def generar_fecha_nacimiento():
    """Genera una fecha de nacimiento realista (18-80 años)"""
    años_atras = random.randint(18, 80)
    dias_atras = random.randint(0, 365)

    fecha = datetime.now() - timedelta(days=años_atras * 365 + dias_atras)
    return fecha.date()


def crear_clientes(cantidad=100):
    """Crea la cantidad especificada de clientes con datos realistas"""
    print(f"Iniciando creación de {cantidad} clientes...")

    clientes_creados = 0
    clientes_fallidos = 0

    for i in range(cantidad):
        try:
            # Generar datos del usuario
            nombre = random.choice(NOMBRES)
            apellido = random.choice(APELLIDOS)
            email = generar_email(nombre, apellido)
            username = email.split("@")[0] + str(random.randint(100, 999))

            # Verificar si el usuario ya existe
            if User.objects.filter(email=email).exists():
                print(f"⚠️  Email {email} ya existe, generando otro...")
                email = f"{username}{random.randint(1000, 9999)}@gmail.com"

            if User.objects.filter(username=username).exists():
                print(f"⚠️  Username {username} ya existe, generando otro...")
                username = f"{username}{random.randint(1000, 9999)}"

            # Crear usuario
            user = User.objects.create_user(
                username=username,
                email=email,
                password="password123",  # Contraseña por defecto
                first_name=nombre,
                last_name=apellido,
                is_active=True,
            )

            # Generar datos del cliente
            fecha_nacimiento = generar_fecha_nacimiento()
            direccion = generar_direccion()
            telefono = generar_telefono()

            # Preferencias aleatorias (0-3 preferencias por cliente)
            num_preferencias = random.randint(0, 3)
            preferencias_cliente = random.sample(PREFERENCIAS, num_preferencias)
            preferencias_texto = (
                "\n".join(preferencias_cliente) if preferencias_cliente else ""
            )

            # Fecha de primera visita (algunos nuevos, otros antiguos)
            if random.random() > 0.3:  # 70% tienen historial
                dias_atras = random.randint(1, 730)  # Hasta 2 años atrás
                fecha_primera_visita = timezone.now() - timedelta(days=dias_atras)
            else:
                fecha_primera_visita = None

            # Determinar si es VIP (10% de probabilidad)
            is_vip = random.random() > 0.9

            # Crear cliente
            cliente = Cliente.objects.create(
                user=user,
                fecha_nacimiento=fecha_nacimiento,
                direccion=direccion,
                preferencias=preferencias_texto,
                fecha_primera_visita=fecha_primera_visita,
                is_vip=is_vip,
            )

            clientes_creados += 1
            estado = "VIP" if is_vip else "Regular"
            print(
                f"✅ Cliente {clientes_creados}/{cantidad}: {nombre} {apellido} ({estado})"
            )

        except Exception as e:
            clientes_fallidos += 1
            print(f"❌ Error creando cliente {i+1}: {str(e)}")

    print("\n" + "=" * 50)
    print(f"✅ Proceso completado!")
    print(f"📊 Clientes creados: {clientes_creados}")
    print(f"❌ Clientes fallidos: {clientes_fallidos}")
    print(f"👥 Total clientes en base de datos: {Cliente.objects.count()}")
    print(f"⭐ Clientes VIP: {Cliente.objects.filter(is_vip=True).count()}")
    print("=" * 50)


if __name__ == "__main__":
    # Confirmar antes de ejecutar
    respuesta = input("¿Deseas crear 100 clientes de prueba? (s/n): ")

    if respuesta.lower() in ["s", "si", "sí", "yes", "y"]:
        crear_clientes(100)
    else:
        print("Operación cancelada.")
