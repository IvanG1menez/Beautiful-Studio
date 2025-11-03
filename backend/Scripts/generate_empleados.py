"""
Script para generar 100 profesionales/empleados con datos realistas
"""

import os
import django
import random
from datetime import datetime, timedelta, date, time

# Configurar Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "beautiful_studio_backend.settings")
django.setup()

from django.contrib.auth import get_user_model
from apps.empleados.models import Empleado
from decimal import Decimal

User = get_user_model()

# Datos realistas para Argentina/América Latina
NOMBRES_PROFESIONALES = [
    "María",
    "Juan",
    "Ana",
    "Carlos",
    "Laura",
    "Miguel",
    "Sofía",
    "Diego",
    "Valentina",
    "Mateo",
    "Isabella",
    "Santiago",
    "Camila",
    "Sebastián",
    "Martina",
    "Nicolás",
    "Lucía",
    "Alejandro",
    "Victoria",
    "Fernando",
    "Carolina",
    "Gabriel",
    "Paula",
    "Andrés",
    "Julia",
    "Martín",
    "Elena",
    "Lucas",
    "Daniela",
    "Ricardo",
    "Natalia",
    "Jorge",
    "Gabriela",
    "Pablo",
    "Andrea",
    "Pedro",
    "Adriana",
    "Roberto",
    "Mariana",
    "Emilio",
    "Claudia",
    "Rodrigo",
    "Silvia",
    "Francisco",
    "Patricia",
    "Manuel",
    "Verónica",
    "Javier",
    "Cecilia",
    "Raúl",
    "Beatriz",
    "Gustavo",
    "Rosa",
    "Alberto",
    "Carmen",
    "Marcos",
    "Liliana",
    "Daniel",
    "Mercedes",
    "Sergio",
    "Isabel",
]

APELLIDOS_PROFESIONALES = [
    "García",
    "Rodríguez",
    "González",
    "Fernández",
    "López",
    "Martínez",
    "Sánchez",
    "Pérez",
    "Gómez",
    "Martín",
    "Jiménez",
    "Ruiz",
    "Hernández",
    "Díaz",
    "Moreno",
    "Álvarez",
    "Muñoz",
    "Romero",
    "Alonso",
    "Gutiérrez",
    "Navarro",
    "Torres",
    "Domínguez",
    "Vázquez",
    "Ramos",
    "Gil",
    "Ramírez",
    "Serrano",
    "Blanco",
    "Molina",
    "Morales",
    "Suárez",
    "Ortega",
    "Delgado",
    "Castro",
    "Ortiz",
    "Rubio",
    "Marín",
    "Sanz",
    "Iglesias",
    "Núñez",
    "Medina",
    "Garrido",
    "Santos",
    "Castillo",
    "Cortés",
    "Lozano",
    "Guerrero",
    "Cano",
    "Prieto",
    "Méndez",
    "Cruz",
    "Flores",
    "Herrera",
    "Aguilar",
]

ESPECIALIDADES = ["corte", "color", "tratamientos", "unas", "maquillaje", "general"]

DIAS_TRABAJO_OPTIONS = [
    "L,M,M,J,V",  # Lunes a Viernes
    "L,M,M,J,V,S",  # Lunes a Sábado
    "M,M,J,V,S",  # Martes a Sábado
    "L,M,J,V,S",  # Sin miércoles
    "L,M,M,V,S",  # Sin jueves
    "M,J,V,S,D",  # Martes a Domingo
]

HORARIOS = [
    (time(9, 0), time(17, 0)),  # 9 AM - 5 PM
    (time(10, 0), time(18, 0)),  # 10 AM - 6 PM
    (time(11, 0), time(19, 0)),  # 11 AM - 7 PM
    (time(14, 0), time(22, 0)),  # 2 PM - 10 PM (turno tarde)
    (time(8, 0), time(16, 0)),  # 8 AM - 4 PM
]

BIOGRAFIAS = [
    "Profesional con más de {} años de experiencia en el sector. Apasionado/a por crear looks únicos para cada cliente.",
    "Especialista certificado/a con {} años en la industria de la belleza. Me encanta trabajar con las últimas tendencias.",
    "Experto/a en {} con formación internacional. Comprometido/a con la excelencia y satisfacción del cliente.",
    "Profesional dedicado/a con {} años de trayectoria. Especializado/a en técnicas innovadoras y personalizadas.",
    "Artista de la belleza con {} años de experiencia. Mi pasión es realzar la belleza natural de cada persona.",
    "Técnico/a certificado/a con {} años en el rubro. Actualizado/a constantemente en nuevas técnicas y productos.",
    "Profesional creativo/a con {} años de experiencia. Enfocado/a en resultados que superen las expectativas.",
    "Especialista con {} años de trayectoria. Me apasiona transformar y embellecer a cada cliente.",
]


def generar_dni():
    """Genera un DNI argentino realista (8 dígitos)"""
    return f"{random.randint(20000000, 45000000)}"


def generar_telefono():
    """Genera un teléfono argentino realista"""
    prefijos = ["11", "15", "351", "341", "261", "221", "223"]
    prefijo = random.choice(prefijos)
    numero = random.randint(1000000, 9999999)
    return f"+54 {prefijo} {numero}"


def generar_email(nombre, apellido, numero):
    """Genera un email realista"""
    dominios = ["gmail.com", "hotmail.com", "yahoo.com", "outlook.com"]
    nombre_limpio = nombre.lower().replace(" ", "")
    apellido_limpio = apellido.lower().replace(" ", "")

    formatos = [
        f"{nombre_limpio}.{apellido_limpio}",
        f"{nombre_limpio}{apellido_limpio}",
        f"{nombre_limpio[0]}{apellido_limpio}",
        f"{nombre_limpio}.{apellido_limpio}{numero}",
        f"pro.{nombre_limpio}",
    ]

    formato = random.choice(formatos)
    dominio = random.choice(dominios)
    return f"{formato}@{dominio}"


def generar_fecha_ingreso():
    """Genera una fecha de ingreso en los últimos 10 años"""
    dias_atras = random.randint(30, 3650)  # Entre 1 mes y 10 años
    fecha = date.today() - timedelta(days=dias_atras)
    return fecha


def generar_biografia(especialidad, anos_experiencia):
    """Genera una biografía profesional"""
    template = random.choice(BIOGRAFIAS)
    especialidad_texto = {
        "corte": "cortes de cabello",
        "color": "coloración y técnicas de color",
        "tratamientos": "tratamientos capilares",
        "unas": "manicura y pedicura",
        "maquillaje": "maquillaje profesional",
        "general": "servicios de belleza integral",
    }

    texto_esp = especialidad_texto.get(especialidad, "belleza")
    return template.format(anos_experiencia).replace("{}", texto_esp)


def calcular_anos_experiencia(fecha_ingreso):
    """Calcula años de experiencia"""
    delta = date.today() - fecha_ingreso
    anos = delta.days // 365
    return max(1, anos)


def generar_comision():
    """Genera un porcentaje de comisión realista"""
    # Comisiones típicas entre 10% y 40%
    opciones = [10, 12, 15, 18, 20, 22, 25, 28, 30, 35, 40]
    return Decimal(str(random.choice(opciones)))


def crear_empleados(cantidad=100):
    """Crea la cantidad especificada de empleados/profesionales"""
    print(f"🚀 Iniciando generación de {cantidad} profesionales...")

    empleados_creados = 0
    errores = 0

    # Contador de especialidades para distribución equilibrada
    contador_especialidades = {esp: 0 for esp, _ in Empleado.ESPECIALIDAD_CHOICES}

    for i in range(cantidad):
        try:
            # Generar datos del usuario
            nombre = random.choice(NOMBRES_PROFESIONALES)
            apellido = random.choice(APELLIDOS_PROFESIONALES)
            username = f"{nombre.lower()}.{apellido.lower()}.pro{i+1}"
            email = generar_email(nombre, apellido, i + 1)
            dni = generar_dni()
            telefono = generar_telefono()

            # Verificar que no exista ya
            if User.objects.filter(email=email).exists():
                email = f"pro.{username}{random.randint(1000, 9999)}@gmail.com"

            if User.objects.filter(dni=dni).exists():
                dni = generar_dni()

            # Seleccionar especialidad (distribución equilibrada)
            especialidad = min(contador_especialidades, key=contador_especialidades.get)
            contador_especialidades[especialidad] += 1

            # Fecha de ingreso
            fecha_ingreso = generar_fecha_ingreso()
            anos_experiencia = calcular_anos_experiencia(fecha_ingreso)

            # Crear usuario
            user = User.objects.create_user(
                username=username,
                email=email,
                password="empleado123",  # Contraseña por defecto
                first_name=nombre,
                last_name=apellido,
                dni=dni,
                phone=telefono,
                role="empleado",
                is_active=True,
            )

            # Seleccionar horario y días
            horario_entrada, horario_salida = random.choice(HORARIOS)
            dias_trabajo = random.choice(DIAS_TRABAJO_OPTIONS)

            # Crear perfil de empleado
            empleado = Empleado.objects.create(
                user=user,
                especialidades=especialidad,
                fecha_ingreso=fecha_ingreso,
                horario_entrada=horario_entrada,
                horario_salida=horario_salida,
                dias_trabajo=dias_trabajo,
                comision_porcentaje=generar_comision(),
                is_disponible=random.choice(
                    [True, True, True, False]
                ),  # 75% disponibles
                biografia=generar_biografia(especialidad, anos_experiencia),
            )

            empleados_creados += 1

            # Mostrar progreso cada 10 empleados
            if (i + 1) % 10 == 0:
                print(f"✅ Creados {empleados_creados} profesionales...")

        except Exception as e:
            errores += 1
            print(f"❌ Error creando empleado {i+1}: {str(e)}")

    print(f"\n{'='*70}")
    print(f"✅ Proceso completado!")
    print(f"{'='*70}")
    print(f"📊 Profesionales creados: {empleados_creados}")
    print(f"❌ Errores: {errores}")
    print(f"🔑 Contraseña por defecto para todos: empleado123")
    print(f"{'='*70}\n")

    # Mostrar estadísticas por especialidad
    print("📊 Distribución por especialidad:")
    for especialidad, label in Empleado.ESPECIALIDAD_CHOICES:
        cantidad = Empleado.objects.filter(especialidades=especialidad).count()
        print(f"   • {label}: {cantidad} profesional(es)")

    print()

    # Mostrar algunos ejemplos
    if empleados_creados > 0:
        print("📋 Ejemplos de profesionales creados:")
        ejemplos = Empleado.objects.select_related("user").order_by("?")[:5]
        for empleado in ejemplos:
            print(
                f"\n   • {empleado.user.full_name} - {empleado.get_especialidades_display()}"
            )
            print(f"     Email: {empleado.user.email}")
            print(f"     DNI: {empleado.user.dni} | Tel: {empleado.user.phone}")
            print(
                f"     Horario: {empleado.horario_entrada.strftime('%H:%M')} - {empleado.horario_salida.strftime('%H:%M')}"
            )
            print(f"     Días: {empleado.dias_trabajo}")
            print(f"     Comisión: {empleado.comision_porcentaje}%")
            print(
                f"     Experiencia desde: {empleado.fecha_ingreso.strftime('%d/%m/%Y')}"
            )
            if empleado.biografia:
                print(f"     Bio: {empleado.biografia[:80]}...")


if __name__ == "__main__":
    print("\n" + "=" * 70)
    print("💼 GENERADOR DE PROFESIONALES - BEAUTIFUL STUDIO")
    print("=" * 70 + "\n")

    crear_empleados(100)
