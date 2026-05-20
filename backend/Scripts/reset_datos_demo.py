"""Script de utilidad para limpiar datos de turnos/pagos
y crear usuarios base de testing.

Se puede ejecutar de dos formas:
- Con django-extensions: `python manage.py runscript reset_datos_demo`
- Desde el shell de Django: `from Scripts.reset_datos_demo import run; run()`
- Directamente como script: `python Scripts/reset_datos_demo.py` (desde la carpeta `backend/`).

Usuarios creados (login por email):
- Superadmin:   admin@beautifulstudio.com        / pass: admin123
- Propietario:  propietario@beautifulstudio.com  / pass: admin123
- Profesional:  profesional@beautifulstudio.com  / pass: profesional123
- Profesional 2: profesional2@beautifulstudio.com / pass: profesional123
- Maria Gomez:      maria.gomez@beautifulstudio.com      / pass: cliente123
- Juan Perez:       juan.perez@beautifulstudio.com       / pass: cliente123
- Rocio Fiel:       rocio.fiel@beautifulstudio.com       / pass: cliente123
- Pedro Olvidado:   pedro.olvidado@beautifulstudio.com   / pass: cliente123
- Jose Kziolvidado: jose.kziolvidado@beautifulstudio.com / pass: cliente123
- Manuel MasLejano: manuel.maslejano@beautifulstudio.com / pass: cliente123
- Agustin Lejano:   agustin.lejano@beautifulstudio.com   / pass: cliente123
"""

from datetime import date, time


def limpiar_datos():
    """Elimina turnos y pagos asociados, sin borrar usuarios.

    Tablas afectadas:
    - Turno
    - PagoMercadoPago (pagos de Mercado Pago)
    """

    print("\n🧹 Limpiando datos de Turnos y Pagos...")

    # Importar modelos dentro de la función para que funcione
    # tanto con runscript como al ejecutar el script directamente
    from apps.turnos.models import Turno, HistorialTurno
    from apps.mercadopago.models import PagoMercadoPago

    pagos_deleted, _ = PagoMercadoPago.objects.all().delete()
    historial_deleted, _ = HistorialTurno.objects.all().delete()
    turnos_deleted, _ = Turno.objects.all().delete()

    print(f"  - Turnos eliminados: {turnos_deleted}")
    print(f"  - Historial de turnos eliminado: {historial_deleted}")
    print(f"  - Pagos Mercado Pago eliminados: {pagos_deleted}\n")


def crear_usuarios_base():
    """Crea (o recupera) usuarios base y sus perfiles relacionados.

    Usuarios creados con get_or_create (login por email):
    - Superadmin (superusuario): admin@beautifulstudio.com / admin123
    - Propietario (dueño local): propietario@beautifulstudio.com / admin123
    - Profesional:              profesional@beautifulstudio.com / profesional123
    - Profesional 2:            profesional2@beautifulstudio.com / profesional123
    - Clientes demo:            maria.gomez, juan.perez, rocio.fiel,
                                pedro.olvidado, jose.kziolvidado,
                                manuel.maslejano, agustin.lejano
    """

    # Importar aquí para evitar problemas de configuración de Django
    from django.contrib.auth import get_user_model
    from apps.clientes.models import Cliente, Billetera
    from apps.empleados.models import Empleado, EmpleadoServicio, HorarioEmpleado
    from apps.servicios.models import Sala, CategoriaServicio, Servicio
    from apps.authentication.models import ConfiguracionGlobal
    from datetime import date
    from decimal import Decimal

    User = get_user_model()

    # 0) Asegurar configuración global básica del negocio
    ConfiguracionGlobal.get_config()

    # 1) Superusuario (admin técnico)
    superuser_email = "admin@beautifulstudio.com"

    superuser, created = User.objects.get_or_create(
        email=superuser_email,
        defaults={
            "username": "admin",
            "first_name": "Admin",
            "last_name": "Principal",
            "role": "superusuario",
            "is_staff": True,
            "is_superuser": True,
        },
    )

    if created:
        superuser.set_password("admin123")
        superuser.save()
        print("✅ Superusuario 'admin@beautifulstudio.com' creado (pass: admin123)")
    else:
        # Asegurar flags de superusuario por si se modificaron
        changed = False
        if not superuser.is_staff:
            superuser.is_staff = True
            changed = True
        if not superuser.is_superuser:
            superuser.is_superuser = True
            changed = True
        if superuser.role != "superusuario":
            superuser.role = "superusuario"
            changed = True
        if changed:
            superuser.save(update_fields=["is_staff", "is_superuser", "role"])
        print(
            "ℹ️ Superusuario 'admin@beautifulstudio.com' ya existía (no se cambió la contraseña)"
        )

    # Identidad del superadmin
    superuser.first_name = "Admin"
    superuser.last_name = "Sistema"
    superuser.dni = superuser.dni or "00000000"
    superuser.phone = superuser.phone or "+54 9 11 0000-0000"
    superuser.save(update_fields=["first_name", "last_name", "dni", "phone"])

    # 2) Propietario del local (no superusuario)
    owner_email = "propietario@beautifulstudio.com"

    owner_user, created = User.objects.get_or_create(
        email=owner_email,
        defaults={
            "username": "propietario",
            "first_name": "Carla",
            "last_name": "Rodríguez",
            "role": "propietario",
            "is_staff": True,
            "is_superuser": False,
        },
    )

    if created:
        owner_user.set_password("admin123")
        owner_user.save()
        print(
            "✅ Usuario propietario 'propietario@beautifulstudio.com' creado (pass: admin123)"
        )
    else:
        changed = False
        if not owner_user.is_staff:
            owner_user.is_staff = True
            changed = True
        if owner_user.is_superuser:
            owner_user.is_superuser = False
            changed = True
        if owner_user.role != "propietario":
            owner_user.role = "propietario"
            changed = True
        if changed:
            owner_user.save(update_fields=["is_staff", "is_superuser", "role"])
        print("ℹ️ Usuario propietario 'propietario@beautifulstudio.com' ya existía")

    # Identidad del propietario
    owner_user.first_name = "Carla"
    owner_user.last_name = "Rodríguez"
    owner_user.dni = owner_user.dni or "27123456789"
    owner_user.phone = owner_user.phone or "+54 9 11 5555-1111"
    owner_user.save(update_fields=["first_name", "last_name", "dni", "phone"])

    # 3) Profesional con perfil Empleado
    pro_email = "profesional@beautifulstudio.com"

    profesional_user, created = User.objects.get_or_create(
        email=pro_email,
        defaults={
            "username": "profesional",
            "first_name": "Lucía",
            "last_name": "Fernández",
            "role": "profesional",
            "is_staff": False,
            "is_superuser": False,
        },
    )

    if created:
        profesional_user.set_password("profesional123")
        profesional_user.save()
        print(
            "✅ Usuario profesional 'profesional@beautifulstudio.com' creado (pass: profesional123)"
        )
    else:
        changed = False
        if profesional_user.role != "profesional":
            profesional_user.role = "profesional"
            changed = True
        if changed:
            profesional_user.save(update_fields=["role"])
        print("ℹ️ Usuario profesional 'profesional@beautifulstudio.com' ya existía")

    # Identidad del profesional
    profesional_user.first_name = "Lucía"
    profesional_user.last_name = "Fernández"
    profesional_user.dni = profesional_user.dni or "28333444555"
    profesional_user.phone = profesional_user.phone or "+54 9 11 5555-2222"
    profesional_user.save(update_fields=["first_name", "last_name", "dni", "phone"])

    empleado_defaults = {
        "fecha_ingreso": date.today(),
        "horario_entrada": time(10, 0),
        "horario_salida": time(19, 0),
        "dias_trabajo": "L,Mi,V",
        "comision_porcentaje": 30,
        "is_disponible": True,
        "biografia": "Especialista en color y cortes modernos con más de 8 años de experiencia.",
    }
    empleado, created = Empleado.objects.get_or_create(
        user=profesional_user,
        defaults=empleado_defaults,
    )
    if created:
        print(
            "✅ Perfil profesional (Empleado) creado para 'profesional@beautifulstudio.com'"
        )
    else:
        # Actualizar algunos campos clave si ya existía
        for field, value in empleado_defaults.items():
            setattr(empleado, field, value)
        empleado.save()
        print(
            "ℹ️ Perfil profesional ya existía para 'profesional@beautifulstudio.com' (datos actualizados)"
        )

    # Crear Sala, Categoría y Servicio de ejemplo para el profesional
    sala, _ = Sala.objects.get_or_create(
        nombre="Sala Principal",
        defaults={"capacidad_simultanea": 3},
    )
    categoria, _ = CategoriaServicio.objects.get_or_create(
        nombre="Coloración",
        defaults={
            "descripcion": "Servicios de coloración y mechas",
            "sala": sala,
            "is_active": True,
        },
    )
    if categoria.sala is None:
        categoria.sala = sala
        categoria.save(update_fields=["sala"])

    servicio_defaults = {
        "descripcion": "Servicio integral de color, lavado y brushing.",
        "precio": Decimal("20000.00"),
        "descuento_reasignacion": Decimal("0.00"),
        "tipo_descuento_adelanto": "PORCENTAJE",
        "valor_descuento_adelanto": Decimal("90.00"),
        "tiempo_espera_respuesta": 20,
        "porcentaje_sena": Decimal("10.00"),
        "frecuencia_recurrencia_dias": 45,
        "descuento_fidelizacion_pct": Decimal("15.00"),
        "descuento_fidelizacion_monto": Decimal("0.00"),
        "duracion_minutos": 120,
        "is_active": True,
    }

    servicio, created = Servicio.objects.get_or_create(
        nombre="Color completo + Brushing",
        categoria=categoria,
        defaults=servicio_defaults,
    )

    # Dejar los números del servicio demo siempre fijos,
    # aunque el servicio ya exista en la base.
    update_fields = []
    for field, value in servicio_defaults.items():
        if getattr(servicio, field) != value:
            setattr(servicio, field, value)
            update_fields.append(field)

    if update_fields:
        servicio.save(update_fields=update_fields)

    if created:
        print("✅ Servicio demo creado con configuración fija")
    else:
        print("ℹ️ Servicio demo existente: configuración numérica actualizada")

    # Asegurar que el profesional tenga al menos un servicio asociado
    EmpleadoServicio.objects.get_or_create(
        empleado=empleado,
        servicio=servicio,
        defaults={"nivel_experiencia": 3},
    )

    # Horarios de trabajo detallados lunes, miercoles y viernes 10-19
    for dia in (0, 2, 4):  # 0=Lunes, 2=Miercoles, 4=Viernes
        HorarioEmpleado.objects.get_or_create(
            empleado=empleado,
            dia_semana=dia,
            hora_inicio=time(10, 0),
            hora_fin=time(19, 0),
            defaults={"is_active": True},
        )

    # 3.b) Segundo profesional con perfil Empleado
    pro2_email = "profesional2@beautifulstudio.com"

    profesional2_user, created = User.objects.get_or_create(
        email=pro2_email,
        defaults={
            "username": "profesional2",
            "first_name": "Valentina",
            "last_name": "Suárez",
            "role": "profesional",
            "is_staff": False,
            "is_superuser": False,
        },
    )

    if created:
        profesional2_user.set_password("profesional123")
        profesional2_user.save()
        print(
            "✅ Usuario profesional 'profesional2@beautifulstudio.com' creado (pass: profesional123)"
        )
    else:
        changed = False
        if profesional2_user.role != "profesional":
            profesional2_user.role = "profesional"
            changed = True
        if changed:
            profesional2_user.save(update_fields=["role"])
        print("ℹ️ Usuario profesional 'profesional2@beautifulstudio.com' ya existía")

    # Identidad del profesional 2
    profesional2_user.first_name = "Valentina"
    profesional2_user.last_name = "Suárez"
    profesional2_user.dni = profesional2_user.dni or "29444555666"
    profesional2_user.phone = profesional2_user.phone or "+54 9 11 5555-4444"
    profesional2_user.save(update_fields=["first_name", "last_name", "dni", "phone"])

    empleado2_defaults = {
        "fecha_ingreso": date.today(),
        "horario_entrada": time(10, 0),
        "horario_salida": time(19, 0),
        "dias_trabajo": "M,J,S",
        "comision_porcentaje": 30,
        "is_disponible": True,
        "biografia": "Especialista en peinados y tratamientos capilares con enfoque en atención personalizada.",
    }
    empleado2, created = Empleado.objects.get_or_create(
        user=profesional2_user,
        defaults=empleado2_defaults,
    )
    if created:
        print(
            "✅ Perfil profesional (Empleado) creado para 'profesional2@beautifulstudio.com'"
        )
    else:
        for field, value in empleado2_defaults.items():
            setattr(empleado2, field, value)
        empleado2.save()
        print(
            "ℹ️ Perfil profesional ya existía para 'profesional2@beautifulstudio.com' (datos actualizados)"
        )

    # Vincular el segundo profesional al mismo servicio demo
    EmpleadoServicio.objects.get_or_create(
        empleado=empleado2,
        servicio=servicio,
        defaults={"nivel_experiencia": 3},
    )

    # Horarios de trabajo detallados martes, jueves y sabado 10-19 para profesional 2
    for dia in (1, 3, 5):  # 1=Martes, 3=Jueves, 5=Sabado
        HorarioEmpleado.objects.get_or_create(
            empleado=empleado2,
            dia_semana=dia,
            hora_inicio=time(10, 0),
            hora_fin=time(19, 0),
            defaults={"is_active": True},
        )

    # 4) Clientes de prueba con perfil Cliente
    def ensure_cliente_demo(email, first_name, last_name, dni, phone, nacimiento, direccion, preferencias, saldo, is_vip=False):
        username = email.split("@")[0]
        user, user_created = User.objects.get_or_create(
            email=email,
            defaults={
                "username": username,
                "first_name": first_name,
                "last_name": last_name,
                "role": "cliente",
                "is_staff": False,
                "is_superuser": False,
            },
        )
        user.username = user.username or username
        user.first_name = first_name
        user.last_name = last_name
        user.role = "cliente"
        user.is_staff = False
        user.is_superuser = False
        user.dni = user.dni or dni
        user.phone = user.phone or phone
        user.set_password("cliente123")
        user.save()

        cliente, cliente_created = Cliente.objects.get_or_create(user=user)
        cliente.fecha_nacimiento = nacimiento
        cliente.direccion = direccion
        cliente.preferencias = preferencias
        cliente.is_vip = is_vip
        cliente.is_active = True
        cliente.save()

        billetera, _ = Billetera.objects.get_or_create(cliente=cliente)
        billetera.saldo = Decimal(str(saldo))
        billetera.save()

        estado = "creado" if user_created or cliente_created else "actualizado"
        print(f"✅ Cliente demo '{email}' {estado} (pass: cliente123)")
        return cliente

    cliente1 = ensure_cliente_demo(
        "maria.gomez@beautifulstudio.com",
        "Maria",
        "Gomez",
        "30111222",
        "+54 9 11 4444-1111",
        date(1990, 5, 14),
        "Av. Siempre Viva 742, Ciudad Autonoma de Buenos Aires",
        "Prefiere colores calidos y turnos por la tarde.",
        "0.00",
        True,
    )
    cliente2 = ensure_cliente_demo(
        "juan.perez@beautifulstudio.com",
        "Juan",
        "Perez",
        "30122333",
        "+54 9 11 4444-2222",
        date(1985, 11, 3),
        "Calle Falsa 123, Cordoba",
        "Cliente principal para prueba de reacomodamiento.",
        "0.00",
    )
    ensure_cliente_demo(
        "rocio.fiel@beautifulstudio.com",
        "Rocio",
        "Fiel",
        "30133444",
        "+54 9 11 4444-3333",
        date(1992, 7, 21),
        "Av. Corrientes 1234, Ciudad Autonoma de Buenos Aires",
        "Cliente preparada para fidelidad por rachas.",
        "0.00",
    )
    ensure_cliente_demo(
        "pedro.olvidado@beautifulstudio.com",
        "Pedro",
        "Olvidado",
        "30144555",
        "+54 9 11 4444-4444",
        date(1988, 2, 9),
        "San Martin 555, Buenos Aires",
        "Cliente olvidado sin saldo para mail promocional.",
        "0.00",
    )
    ensure_cliente_demo(
        "jose.kziolvidado@beautifulstudio.com",
        "Jose",
        "Kziolvidado",
        "30155666",
        "+54 9 11 4444-5555",
        date(1987, 9, 18),
        "Belgrano 777, Buenos Aires",
        "Cliente olvidado con saldo para mail de billetera.",
        "1500.00",
    )
    ensure_cliente_demo(
        "manuel.maslejano@beautifulstudio.com",
        "Manuel",
        "MasLejano",
        "30166777",
        "+54 9 11 4444-6666",
        date(1991, 4, 12),
        "Laprida 888, Buenos Aires",
        "Candidato mas lejano para reacomodamiento; rechaza oferta.",
        "0.00",
    )
    ensure_cliente_demo(
        "agustin.lejano@beautifulstudio.com",
        "Agustin",
        "Lejano",
        "30177888",
        "+54 9 11 4444-7777",
        date(1993, 12, 1),
        "Rivadavia 999, Buenos Aires",
        "Segundo candidato para reacomodamiento; acepta oferta.",
        "0.00",
    )

    # Crear algunos turnos y pagos de ejemplo para que la base
    # tenga datos "reales" que se vean en los paneles.
    crear_turnos_demo(
        owner_user=owner_user,
        profesional_user=profesional_user,
    )


def crear_turnos_demo(owner_user, profesional_user):
    """Crea turnos y pagos de ejemplo para clientes y profesional.

    - Turno futuro reservado desde la web del cliente con pago MP aprobado.
    - Turno futuro reservado desde el panel profesional con seña en efectivo.
    - Turno pasado completado con pago por QR.
    """

    from decimal import Decimal
    from datetime import timedelta

    from django.contrib.auth import get_user_model
    from django.utils import timezone

    from apps.clientes.models import Cliente
    from apps.empleados.models import Empleado
    from apps.mercadopago.models import PagoMercadoPago
    from apps.servicios.models import Servicio
    from apps.turnos.models import HistorialTurno, Turno

    User = get_user_model()

    now = timezone.now()

    # Obtener objetos base
    try:
        empleado = Empleado.objects.get(user__email="profesional@beautifulstudio.com")
    except Empleado.DoesNotExist:
        print(
            "⚠️ No se encontró el perfil Empleado del profesional demo; no se crean turnos."
        )
        return

    servicio = (
        Servicio.objects.filter(nombre="Color completo + Brushing").first()
        or Servicio.objects.filter(is_active=True).first()
    )
    if not servicio:
        print("⚠️ No se encontró un servicio activo para crear turnos demo.")
        return

    cliente1 = Cliente.objects.filter(
        user__email="maria.gomez@beautifulstudio.com"
    ).first()
    cliente2 = Cliente.objects.filter(
        user__email="juan.perez@beautifulstudio.com"
    ).first()
    cliente3 = Cliente.objects.filter(
        user__email="rocio.fiel@beautifulstudio.com"
    ).first()

    if not cliente1 or not cliente2:
        print("⚠️ No se encontraron clientes demo suficientes para crear turnos.")
        return

    # 1) Turno futuro confirmado con pago completo por Mercado Pago (web cliente)
    fecha_turno1 = now + timedelta(days=1, hours=1)
    turno1 = Turno.objects.create(
        cliente=cliente1,
        empleado=empleado,
        servicio=servicio,
        fecha_hora=fecha_turno1,
        estado="confirmado",
        precio_final=Decimal("20000.00"),
        senia_pagada=Decimal("20000.00"),
        canal_reserva="web_cliente",
        metodo_pago="mercadopago",
        es_cliente_registrado=True,
        notas_cliente="Turno demo generado desde script de reset.",
        fecha_pago_registrado=now,
    )

    HistorialTurno.objects.create(
        turno=turno1,
        usuario=cliente1.user,
        accion="creacion",
        estado_anterior=None,
        estado_nuevo="confirmado",
        observaciones="Turno creado automáticamente para demo.",
    )

    HistorialTurno.objects.create(
        turno=turno1,
        usuario=owner_user,
        accion="pago_registrado",
        estado_anterior="pendiente",
        estado_nuevo="confirmado",
        observaciones="Pago completo registrado (demo).",
    )

    PagoMercadoPago.objects.create(
        turno=turno1,
        cliente=cliente1,
        preference_id="DEMO-PREF-1",
        payment_id="DEMO-PAY-1",
        init_point="https://www.mercadopago.com.ar/checkout/v1/demo",
        monto=Decimal("20000.00"),
        moneda="ARS",
        descripcion="Turno demo pago completo",
        estado="approved",
    )

    # 2) Turno futuro pendiente con seña en efectivo (panel profesional)
    fecha_turno2 = now + timedelta(days=2, hours=3)
    turno2 = Turno.objects.create(
        cliente=cliente2,
        empleado=empleado,
        servicio=servicio,
        fecha_hora=fecha_turno2,
        estado="pendiente",
        precio_final=Decimal("20000.00"),
        senia_pagada=Decimal("10000.00"),
        canal_reserva="panel_profesional",
        metodo_pago="efectivo",
        es_cliente_registrado=True,
        notas_cliente="Turno demo reservado desde panel profesional.",
    )

    HistorialTurno.objects.create(
        turno=turno2,
        usuario=profesional_user,
        accion="creacion",
        estado_anterior=None,
        estado_nuevo="pendiente",
        observaciones="Turno creado por el profesional (demo).",
    )

    # 3) Turno pasado completado con pago por QR (panel profesional)
    fecha_turno3 = now - timedelta(days=3, hours=2)
    turno3 = Turno.objects.create(
        cliente=cliente1,
        empleado=empleado,
        servicio=servicio,
        fecha_hora=fecha_turno3,
        estado="completado",
        precio_final=Decimal("20000.00"),
        senia_pagada=Decimal("20000.00"),
        canal_reserva="panel_profesional",
        metodo_pago="mercadopago_qr",
        es_cliente_registrado=True,
        notas_cliente="Turno demo completado y cobrado por QR.",
        fecha_pago_registrado=fecha_turno3,
        fecha_hora_completado=fecha_turno3 + timedelta(hours=2),
    )

    HistorialTurno.objects.create(
        turno=turno3,
        usuario=profesional_user,
        accion="completado",
        estado_anterior="confirmado",
        estado_nuevo="completado",
        observaciones="Turno marcado como completado (demo).",
    )

    PagoMercadoPago.objects.create(
        turno=turno3,
        cliente=cliente1,
        preference_id="DEMO-PREF-3",
        payment_id="DEMO-PAY-3",
        init_point="https://www.mercadopago.com.ar/checkout/v1/demo",
        monto=Decimal("20000.00"),
        moneda="ARS",
        descripcion="Turno demo QR completado",
        estado="approved",
    )

    print("✅ Turnos y pagos demo creados correctamente.")


def run():
    """Entry point para django-extensions (runscript)."""

    limpiar_datos()
    crear_usuarios_base()
    print("\n✅ Reset de datos de demo completado.\n")


if __name__ == "__main__":
    # Permite ejecutar el script directamente, incluso si se llama
    # desde la carpeta Scripts:
    #   cd backend && python Scripts/reset_datos_demo.py
    #   cd backend/Scripts && python reset_datos_demo.py
    import os
    import sys
    import django

    # Asegurar que el directorio "backend" esté en el PYTHONPATH
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if BASE_DIR not in sys.path:
        sys.path.insert(0, BASE_DIR)

    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
    django.setup()

    run()
