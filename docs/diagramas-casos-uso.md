# Diagramas de Casos de Uso - Beautiful Studio

Este documento define la estructura de los diagramas de casos de uso del sistema Beautiful Studio. Primero se presenta el diagrama general del sistema y luego los diagramas por subsistema.

Los casos de uso nombrados como `Gestionar` representan operaciones de alta, baja, modificacion y consulta cuando corresponda. En los diagramas por subsistema dichas operaciones se representan mediante relaciones `<<include>>`.

## Diagrama General Del Sistema

### Actores

- Propietario
- Profesional
- Cliente
- Invitado

### Casos De Uso Generales

- CU-01 Gestionar Usuarios
- CU-02 Gestionar Roles y Permisos
- CU-03 Registrarse
- CU-04 Iniciar Sesion
- CU-05 Recuperar Contrasena
- CU-06 Gestionar Cuenta Personal
- CU-07 Gestionar Profesionales
- CU-08 Gestionar Horarios de Profesionales
- CU-09 Gestionar Clientes
- CU-10 Consultar Historial del Cliente
- CU-11 Explorar Servicios
- CU-12 Gestionar Servicios
- CU-13 Gestionar Categorias de Servicios
- CU-14 Gestionar Salas
- CU-15 Gestionar Turnos
- CU-16 Solicitar Turno
- CU-17 Gestionar Mis Turnos
- CU-18 Gestionar Agenda Profesional
- CU-19 Completar Turno
- CU-20 Registrar Inasistencia
- CU-21 Gestionar Reprogramaciones
- CU-22 Gestionar Reacomodamientos
- CU-23 Gestionar Pagos
- CU-24 Abonar Servicio con Mercado Pago
- CU-25 Confirmar Cobro Presencial
- CU-26 Consultar Comprobante de Pago
- CU-27 Gestionar Billetera del Cliente
- CU-28 Gestionar Notificaciones
- CU-29 Configurar Notificaciones
- CU-30 Gestionar Fidelizacion de Clientes
- CU-31 Gestionar Rachas y Cupones
- CU-32 Gestionar Integracion con Telegram
- CU-33 Consultar Reportes Financieros
- CU-34 Consultar Reportes de Servicios
- CU-35 Consultar Oportunidades de Agenda
- CU-36 Consultar Historial de Cambios
- CU-37 Gestionar Auditoria
- CU-38 Gestionar Configuracion General
- CU-39 Configurar Inicio de Sesion con Google
- CU-40 Consultar Diagnostico del Sistema

### Asociacion De Actores

#### Propietario

- CU-01 Gestionar Usuarios
- CU-02 Gestionar Roles y Permisos
- CU-04 Iniciar Sesion
- CU-05 Recuperar Contrasena
- CU-06 Gestionar Cuenta Personal
- CU-07 Gestionar Profesionales
- CU-08 Gestionar Horarios de Profesionales
- CU-09 Gestionar Clientes
- CU-10 Consultar Historial del Cliente
- CU-11 Explorar Servicios
- CU-12 Gestionar Servicios
- CU-13 Gestionar Categorias de Servicios
- CU-14 Gestionar Salas
- CU-15 Gestionar Turnos
- CU-18 Gestionar Agenda Profesional
- CU-19 Completar Turno
- CU-20 Registrar Inasistencia
- CU-21 Gestionar Reprogramaciones
- CU-22 Gestionar Reacomodamientos
- CU-23 Gestionar Pagos
- CU-25 Confirmar Cobro Presencial
- CU-26 Consultar Comprobante de Pago
- CU-27 Gestionar Billetera del Cliente
- CU-28 Gestionar Notificaciones
- CU-29 Configurar Notificaciones
- CU-30 Gestionar Fidelizacion de Clientes
- CU-31 Gestionar Rachas y Cupones
- CU-32 Gestionar Integracion con Telegram
- CU-33 Consultar Reportes Financieros
- CU-34 Consultar Reportes de Servicios
- CU-35 Consultar Oportunidades de Agenda
- CU-36 Consultar Historial de Cambios
- CU-37 Gestionar Auditoria
- CU-38 Gestionar Configuracion General
- CU-39 Configurar Inicio de Sesion con Google
- CU-40 Consultar Diagnostico del Sistema

#### Profesional

- CU-04 Iniciar Sesion
- CU-05 Recuperar Contrasena
- CU-06 Gestionar Cuenta Personal
- CU-10 Consultar Historial del Cliente
- CU-15 Gestionar Turnos
- CU-18 Gestionar Agenda Profesional
- CU-19 Completar Turno
- CU-20 Registrar Inasistencia
- CU-21 Gestionar Reprogramaciones
- CU-23 Gestionar Pagos
- CU-25 Confirmar Cobro Presencial
- CU-26 Consultar Comprobante de Pago
- CU-28 Gestionar Notificaciones
- CU-29 Configurar Notificaciones

#### Cliente

- CU-03 Registrarse
- CU-04 Iniciar Sesion
- CU-05 Recuperar Contrasena
- CU-06 Gestionar Cuenta Personal
- CU-11 Explorar Servicios
- CU-16 Solicitar Turno
- CU-17 Gestionar Mis Turnos
- CU-21 Gestionar Reprogramaciones
- CU-24 Abonar Servicio con Mercado Pago
- CU-26 Consultar Comprobante de Pago
- CU-27 Gestionar Billetera del Cliente
- CU-28 Gestionar Notificaciones
- CU-29 Configurar Notificaciones
- CU-31 Gestionar Rachas y Cupones
- CU-32 Gestionar Integracion con Telegram

#### Invitado

- CU-03 Registrarse
- CU-04 Iniciar Sesion
- CU-05 Recuperar Contrasena
- CU-11 Explorar Servicios

### Relaciones Generales Relevantes

- CU-04 Iniciar Sesion `<<extend>>` CU-05 Recuperar Contrasena
- CU-04 Iniciar Sesion `<<extend>>` CU-39 Configurar Inicio de Sesion con Google
- CU-16 Solicitar Turno `<<include>>` CU-11 Explorar Servicios
- CU-16 Solicitar Turno `<<extend>>` CU-24 Abonar Servicio con Mercado Pago
- CU-17 Gestionar Mis Turnos `<<extend>>` CU-21 Gestionar Reprogramaciones
- CU-17 Gestionar Mis Turnos `<<extend>>` CU-26 Consultar Comprobante de Pago
- CU-23 Gestionar Pagos `<<extend>>` CU-24 Abonar Servicio con Mercado Pago
- CU-23 Gestionar Pagos `<<extend>>` CU-25 Confirmar Cobro Presencial
- CU-23 Gestionar Pagos `<<include>>` CU-26 Consultar Comprobante de Pago
- CU-22 Gestionar Reacomodamientos `<<include>>` CU-28 Gestionar Notificaciones
- CU-30 Gestionar Fidelizacion de Clientes `<<include>>` CU-28 Gestionar Notificaciones
- CU-30 Gestionar Fidelizacion de Clientes `<<include>>` CU-31 Gestionar Rachas y Cupones

## Diagramas Por Subsistema

## Subsistema De Gestion, Roles Y Permisos

### Actores Relacionados

- Propietario
- Profesional
- Cliente
- Invitado

### Casos De Uso

- CU-01 Gestionar Usuarios
- CU-02 Gestionar Roles y Permisos
- CU-03 Registrarse
- CU-04 Iniciar Sesion
- CU-05 Recuperar Contrasena
- CU-06 Gestionar Cuenta Personal
- CU-39 Configurar Inicio de Sesion con Google

### Relaciones Include Y Extend

- CU-01 Gestionar Usuarios `<<include>>` Crear Usuario
- CU-01 Gestionar Usuarios `<<include>>` Consultar Usuario
- CU-01 Gestionar Usuarios `<<include>>` Modificar Usuario
- CU-01 Gestionar Usuarios `<<include>>` Desactivar Usuario
- CU-01 Gestionar Usuarios `<<include>>` Asignar Rol
- CU-02 Gestionar Roles y Permisos `<<include>>` Consultar Roles
- CU-02 Gestionar Roles y Permisos `<<include>>` Asignar Permisos
- CU-02 Gestionar Roles y Permisos `<<include>>` Modificar Permisos
- CU-04 Iniciar Sesion `<<extend>>` CU-05 Recuperar Contrasena
- CU-04 Iniciar Sesion `<<extend>>` CU-39 Configurar Inicio de Sesion con Google
- CU-06 Gestionar Cuenta Personal `<<include>>` Consultar Cuenta Personal
- CU-06 Gestionar Cuenta Personal `<<include>>` Modificar Datos Personales
- CU-06 Gestionar Cuenta Personal `<<include>>` Cambiar Contrasena
- CU-06 Gestionar Cuenta Personal `<<include>>` Configurar Preferencias

## Subsistema De Turnos

### Actores Relacionados

- Propietario
- Profesional
- Cliente

### Casos De Uso

- CU-15 Gestionar Turnos
- CU-16 Solicitar Turno
- CU-17 Gestionar Mis Turnos
- CU-18 Gestionar Agenda Profesional
- CU-19 Completar Turno
- CU-20 Registrar Inasistencia
- CU-21 Gestionar Reprogramaciones
- CU-22 Gestionar Reacomodamientos
- CU-35 Consultar Oportunidades de Agenda

### Relaciones Include Y Extend

- CU-15 Gestionar Turnos `<<include>>` Crear Turno
- CU-15 Gestionar Turnos `<<include>>` Consultar Turno
- CU-15 Gestionar Turnos `<<include>>` Modificar Turno
- CU-15 Gestionar Turnos `<<include>>` Cancelar Turno
- CU-15 Gestionar Turnos `<<include>>` Confirmar Turno
- CU-15 Gestionar Turnos `<<include>>` Finalizar Turno
- CU-15 Gestionar Turnos `<<include>>` Registrar Historial de Turno
- CU-15 Gestionar Turnos `<<include>>` Validar Disponibilidad Profesional
- CU-15 Gestionar Turnos `<<include>>` Validar Capacidad de Sala
- CU-16 Solicitar Turno `<<include>>` CU-11 Explorar Servicios
- CU-16 Solicitar Turno `<<include>>` Consultar Disponibilidad
- CU-16 Solicitar Turno `<<include>>` Seleccionar Profesional
- CU-16 Solicitar Turno `<<include>>` Confirmar Reserva
- CU-16 Solicitar Turno `<<extend>>` CU-24 Abonar Servicio con Mercado Pago
- CU-17 Gestionar Mis Turnos `<<include>>` Consultar Mis Turnos
- CU-17 Gestionar Mis Turnos `<<include>>` Consultar Historial Propio
- CU-17 Gestionar Mis Turnos `<<extend>>` Cancelar Turno
- CU-17 Gestionar Mis Turnos `<<extend>>` CU-21 Gestionar Reprogramaciones
- CU-17 Gestionar Mis Turnos `<<extend>>` CU-26 Consultar Comprobante de Pago
- CU-18 Gestionar Agenda Profesional `<<include>>` Consultar Agenda
- CU-18 Gestionar Agenda Profesional `<<include>>` Consultar Turnos Del Dia
- CU-18 Gestionar Agenda Profesional `<<include>>` Registrar Observaciones
- CU-19 Completar Turno `<<include>>` Actualizar Estado del Turno
- CU-19 Completar Turno `<<include>>` Registrar Fecha de Finalizacion
- CU-19 Completar Turno `<<include>>` Registrar Historial de Turno
- CU-19 Completar Turno `<<extend>>` CU-31 Gestionar Rachas y Cupones
- CU-20 Registrar Inasistencia `<<include>>` Actualizar Estado del Turno
- CU-20 Registrar Inasistencia `<<include>>` Registrar Historial de Turno
- CU-21 Gestionar Reprogramaciones `<<include>>` Consultar Disponibilidad
- CU-21 Gestionar Reprogramaciones `<<include>>` Validar Reprogramacion
- CU-21 Gestionar Reprogramaciones `<<include>>` Modificar Fecha del Turno
- CU-21 Gestionar Reprogramaciones `<<include>>` Registrar Historial de Turno
- CU-21 Gestionar Reprogramaciones `<<extend>>` Abonar Diferencia o Penalidad
- CU-22 Gestionar Reacomodamientos `<<include>>` Detectar Espacio Disponible
- CU-22 Gestionar Reacomodamientos `<<include>>` Seleccionar Cliente Candidato
- CU-22 Gestionar Reacomodamientos `<<include>>` Enviar Oferta de Reacomodamiento
- CU-22 Gestionar Reacomodamientos `<<extend>>` Aceptar Oferta
- CU-22 Gestionar Reacomodamientos `<<extend>>` Rechazar Oferta
- CU-22 Gestionar Reacomodamientos `<<extend>>` Expirar Oferta
- CU-35 Consultar Oportunidades de Agenda `<<include>>` Consultar Espacios Disponibles
- CU-35 Consultar Oportunidades de Agenda `<<include>>` Consultar Clientes Candidatos

## Subsistema De Clientes

### Actores Relacionados

- Propietario
- Profesional
- Cliente

### Casos De Uso

- CU-09 Gestionar Clientes
- CU-10 Consultar Historial del Cliente
- CU-17 Gestionar Mis Turnos
- CU-27 Gestionar Billetera del Cliente
- CU-30 Gestionar Fidelizacion de Clientes
- CU-31 Gestionar Rachas y Cupones

### Relaciones Include Y Extend

- CU-09 Gestionar Clientes `<<include>>` Crear Cliente
- CU-09 Gestionar Clientes `<<include>>` Consultar Cliente
- CU-09 Gestionar Clientes `<<include>>` Modificar Cliente
- CU-09 Gestionar Clientes `<<include>>` Desactivar Cliente
- CU-09 Gestionar Clientes `<<include>>` CU-10 Consultar Historial del Cliente
- CU-10 Consultar Historial del Cliente `<<include>>` Consultar Turnos del Cliente
- CU-10 Consultar Historial del Cliente `<<include>>` Consultar Atenciones Realizadas
- CU-10 Consultar Historial del Cliente `<<include>>` Consultar Observaciones
- CU-27 Gestionar Billetera del Cliente `<<include>>` Consultar Saldo
- CU-27 Gestionar Billetera del Cliente `<<include>>` Consultar Movimientos
- CU-27 Gestionar Billetera del Cliente `<<include>>` Registrar Credito
- CU-27 Gestionar Billetera del Cliente `<<include>>` Registrar Debito
- CU-30 Gestionar Fidelizacion de Clientes `<<include>>` Identificar Clientes Inactivos
- CU-30 Gestionar Fidelizacion de Clientes `<<include>>` Enviar Invitacion de Reincorporacion
- CU-30 Gestionar Fidelizacion de Clientes `<<include>>` Aplicar Beneficio de Fidelizacion
- CU-30 Gestionar Fidelizacion de Clientes `<<include>>` CU-31 Gestionar Rachas y Cupones
- CU-31 Gestionar Rachas y Cupones `<<include>>` Consultar Racha
- CU-31 Gestionar Rachas y Cupones `<<include>>` Generar Cupon
- CU-31 Gestionar Rachas y Cupones `<<include>>` Reclamar Cupon
- CU-31 Gestionar Rachas y Cupones `<<include>>` Validar Cupon
- CU-31 Gestionar Rachas y Cupones `<<include>>` Marcar Cupon Como Usado
- CU-31 Gestionar Rachas y Cupones `<<extend>>` Notificar Vencimiento de Racha

## Subsistema De Automatizacion

### Actores Relacionados

- Propietario
- Profesional
- Cliente

### Casos De Uso

- CU-22 Gestionar Reacomodamientos
- CU-28 Gestionar Notificaciones
- CU-29 Configurar Notificaciones
- CU-30 Gestionar Fidelizacion de Clientes
- CU-31 Gestionar Rachas y Cupones
- CU-32 Gestionar Integracion con Telegram

### Relaciones Include Y Extend

- CU-28 Gestionar Notificaciones `<<include>>` Consultar Notificaciones
- CU-28 Gestionar Notificaciones `<<include>>` Marcar Notificacion Como Leida
- CU-28 Gestionar Notificaciones `<<include>>` Registrar Notificacion
- CU-29 Configurar Notificaciones `<<include>>` Configurar Notificaciones Internas
- CU-29 Configurar Notificaciones `<<include>>` Configurar Notificaciones por Email
- CU-29 Configurar Notificaciones `<<include>>` Activar o Desactivar Preferencias
- CU-32 Gestionar Integracion con Telegram `<<include>>` Generar Token de Vinculacion
- CU-32 Gestionar Integracion con Telegram `<<include>>` Vincular Cuenta de Telegram
- CU-32 Gestionar Integracion con Telegram `<<include>>` Verificar Vinculacion
- CU-32 Gestionar Integracion con Telegram `<<include>>` Registrar Interaccion
- CU-32 Gestionar Integracion con Telegram `<<extend>>` Confirmar Cancelacion por Telegram
- CU-22 Gestionar Reacomodamientos `<<include>>` CU-28 Gestionar Notificaciones
- CU-30 Gestionar Fidelizacion de Clientes `<<include>>` CU-28 Gestionar Notificaciones
- CU-31 Gestionar Rachas y Cupones `<<include>>` CU-28 Gestionar Notificaciones

## Subsistema De Estadisticas Y Reportes

### Actores Relacionados

- Propietario

### Casos De Uso

- CU-33 Consultar Reportes Financieros
- CU-34 Consultar Reportes de Servicios
- CU-35 Consultar Oportunidades de Agenda
- CU-36 Consultar Historial de Cambios
- CU-37 Gestionar Auditoria
- CU-40 Consultar Diagnostico del Sistema

### Relaciones Include Y Extend

- CU-33 Consultar Reportes Financieros `<<include>>` Consultar Pagos
- CU-33 Consultar Reportes Financieros `<<include>>` Consultar Cobros
- CU-33 Consultar Reportes Financieros `<<include>>` Consultar Movimientos de Billetera
- CU-33 Consultar Reportes Financieros `<<include>>` Consultar Pagos Pendientes
- CU-34 Consultar Reportes de Servicios `<<include>>` Consultar Servicios Realizados
- CU-34 Consultar Reportes de Servicios `<<include>>` Consultar Demanda de Servicios
- CU-34 Consultar Reportes de Servicios `<<include>>` Consultar Actividad por Profesional
- CU-35 Consultar Oportunidades de Agenda `<<include>>` Consultar Espacios Disponibles
- CU-35 Consultar Oportunidades de Agenda `<<include>>` Consultar Clientes Inactivos
- CU-36 Consultar Historial de Cambios `<<include>>` Consultar Cambios de Turno
- CU-36 Consultar Historial de Cambios `<<include>>` Consultar Cambios de Registros
- CU-36 Consultar Historial de Cambios `<<extend>>` Restaurar Registro Desde Historial
- CU-37 Gestionar Auditoria `<<include>>` Consultar Auditoria
- CU-37 Gestionar Auditoria `<<include>>` Registrar Accion Relevante
- CU-40 Consultar Diagnostico del Sistema `<<include>>` Consultar Diagnostico de Agenda
- CU-40 Consultar Diagnostico del Sistema `<<include>>` Consultar Diagnostico de Fidelizacion
- CU-40 Consultar Diagnostico del Sistema `<<include>>` Consultar Diagnostico de Reprogramacion

## Subsistema De Administracion

### Actores Relacionados

- Propietario
- Profesional

### Casos De Uso

- CU-07 Gestionar Profesionales
- CU-08 Gestionar Horarios de Profesionales
- CU-11 Explorar Servicios
- CU-12 Gestionar Servicios
- CU-13 Gestionar Categorias de Servicios
- CU-14 Gestionar Salas
- CU-23 Gestionar Pagos
- CU-24 Abonar Servicio con Mercado Pago
- CU-25 Confirmar Cobro Presencial
- CU-26 Consultar Comprobante de Pago
- CU-38 Gestionar Configuracion General

### Relaciones Include Y Extend

- CU-07 Gestionar Profesionales `<<include>>` Crear Profesional
- CU-07 Gestionar Profesionales `<<include>>` Consultar Profesional
- CU-07 Gestionar Profesionales `<<include>>` Modificar Profesional
- CU-07 Gestionar Profesionales `<<include>>` Desactivar Profesional
- CU-07 Gestionar Profesionales `<<include>>` Asignar Servicios al Profesional
- CU-08 Gestionar Horarios de Profesionales `<<include>>` Crear Horario
- CU-08 Gestionar Horarios de Profesionales `<<include>>` Consultar Horario
- CU-08 Gestionar Horarios de Profesionales `<<include>>` Modificar Horario
- CU-08 Gestionar Horarios de Profesionales `<<include>>` Eliminar Horario
- CU-12 Gestionar Servicios `<<include>>` Crear Servicio
- CU-12 Gestionar Servicios `<<include>>` Consultar Servicio
- CU-12 Gestionar Servicios `<<include>>` Modificar Servicio
- CU-12 Gestionar Servicios `<<include>>` Desactivar Servicio
- CU-12 Gestionar Servicios `<<include>>` Configurar Sena
- CU-12 Gestionar Servicios `<<include>>` Configurar Reglas de Cancelacion
- CU-12 Gestionar Servicios `<<include>>` Configurar Beneficios de Fidelizacion
- CU-13 Gestionar Categorias de Servicios `<<include>>` Crear Categoria
- CU-13 Gestionar Categorias de Servicios `<<include>>` Consultar Categoria
- CU-13 Gestionar Categorias de Servicios `<<include>>` Modificar Categoria
- CU-13 Gestionar Categorias de Servicios `<<include>>` Desactivar Categoria
- CU-14 Gestionar Salas `<<include>>` Crear Sala
- CU-14 Gestionar Salas `<<include>>` Consultar Sala
- CU-14 Gestionar Salas `<<include>>` Modificar Sala
- CU-14 Gestionar Salas `<<include>>` Desactivar Sala
- CU-14 Gestionar Salas `<<include>>` Configurar Capacidad
- CU-23 Gestionar Pagos `<<include>>` Consultar Estado de Pago
- CU-23 Gestionar Pagos `<<include>>` Registrar Pago
- CU-23 Gestionar Pagos `<<include>>` Actualizar Turno Pagado
- CU-23 Gestionar Pagos `<<include>>` CU-26 Consultar Comprobante de Pago
- CU-23 Gestionar Pagos `<<extend>>` CU-24 Abonar Servicio con Mercado Pago
- CU-23 Gestionar Pagos `<<extend>>` CU-25 Confirmar Cobro Presencial
- CU-24 Abonar Servicio con Mercado Pago `<<include>>` Generar Preferencia de Pago
- CU-24 Abonar Servicio con Mercado Pago `<<include>>` Redirigir a Mercado Pago
- CU-24 Abonar Servicio con Mercado Pago `<<include>>` Verificar Pago
- CU-24 Abonar Servicio con Mercado Pago `<<include>>` Registrar Resultado de Pago
- CU-25 Confirmar Cobro Presencial `<<include>>` Registrar Metodo de Pago
- CU-25 Confirmar Cobro Presencial `<<include>>` Registrar Monto Abonado
- CU-25 Confirmar Cobro Presencial `<<include>>` Actualizar Estado de Pago
- CU-38 Gestionar Configuracion General `<<include>>` Consultar Configuracion
- CU-38 Gestionar Configuracion General `<<include>>` Modificar Configuracion
- CU-38 Gestionar Configuracion General `<<include>>` Configurar Reglas de Cancelacion
- CU-38 Gestionar Configuracion General `<<include>>` Configurar Reglas de Reprogramacion
- CU-38 Gestionar Configuracion General `<<include>>` Configurar Fidelizacion
- CU-38 Gestionar Configuracion General `<<include>>` Configurar Rachas
- CU-38 Gestionar Configuracion General `<<include>>` Configurar Capacidad Global
- CU-38 Gestionar Configuracion General `<<include>>` Configurar Datos Comerciales
