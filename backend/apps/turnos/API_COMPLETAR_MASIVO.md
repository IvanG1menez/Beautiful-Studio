# API - Completar Turnos Masivamente

## 📋 Endpoints Nuevos

### 1. Buscar Turnos Pendientes en Rango

**GET** `/api/turnos/pendientes-rango/`

Obtiene todos los turnos pendientes del profesional en un rango de fechas.

**Parámetros Query:**

- `fecha_desde` (requerido): Fecha inicio en formato ISO (YYYY-MM-DD)
- `fecha_hasta` (requerido): Fecha fin en formato ISO (YYYY-MM-DD)
- `estado` (opcional): Filtrar por estado específico

**Permisos:** Solo profesionales

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "total": 15,
  "fecha_desde": "2025-11-01",
  "fecha_hasta": "2025-11-15",
  "turnos": [
    {
      "id": 123,
      "cliente_nombre": "Juan Pérez",
      "servicio_nombre": "Corte de Cabello",
      "fecha_hora": "2025-11-10T14:00:00Z",
      "estado": "confirmado",
      "estado_display": "Confirmado",
      "precio_final": 5000.0
    }
  ]
}
```

**Ejemplo de uso:**

```javascript
const response = await api.get("/turnos/pendientes-rango/", {
  params: {
    fecha_desde: "2025-11-01",
    fecha_hasta: "2025-11-15",
  },
});
```

---

### 2. Completar Turnos Masivamente

**POST** `/api/turnos/completar-masivo/`

Marca múltiples turnos como completados. Acepta dos modos:

1. Por IDs específicos
2. Por rango de fechas

**Permisos:** Solo profesionales

**Body (Opción 1 - IDs específicos):**

```json
{
  "turno_ids": [123, 124, 125, 126]
}
```

**Body (Opción 2 - Rango de fechas):**

```json
{
  "fecha_desde": "2025-11-01T00:00:00Z",
  "fecha_hasta": "2025-11-15T23:59:59Z"
}
```

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "completados": 12,
  "total_seleccionados": 15,
  "errores": [
    {
      "turno_id": 126,
      "error": "El turno ya está completado"
    }
  ]
}
```

**Ejemplo de uso:**

```javascript
// Completar por IDs
const response = await api.post("/turnos/completar-masivo/", {
  turno_ids: [123, 124, 125],
});

// Completar por rango de fechas
const response = await api.post("/turnos/completar-masivo/", {
  fecha_desde: "2025-11-01",
  fecha_hasta: "2025-11-15",
});
```

---

### 3. Completar Última Semana

**POST** `/api/turnos/completar-ultima-semana/`

Marca todos los turnos de los últimos 7 días como completados.

**Permisos:** Solo profesionales

**Body:** No requiere parámetros

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "completados": 8,
  "total_encontrados": 10,
  "fecha_desde": "2025-11-09T10:00:00Z",
  "fecha_hasta": "2025-11-16T10:00:00Z",
  "errores": []
}
```

**Ejemplo de uso:**

```javascript
const response = await api.post("/turnos/completar-ultima-semana/");
```

---

## 🔒 Seguridad y Permisos

- ✅ Solo **profesionales autenticados** pueden acceder a estos endpoints
- ✅ Los profesionales solo pueden completar **sus propios turnos**
- ✅ Solo se pueden completar turnos en estados: `pendiente`, `confirmado`, `en_proceso`
- ✅ Los turnos ya `completados` o `cancelados` son ignorados

---

## 📊 Estados de Turno

| Estado       | Puede Completarse | Descripción                        |
| ------------ | ----------------- | ---------------------------------- |
| `pendiente`  | ✅ Sí             | Turno reservado pero no confirmado |
| `confirmado` | ✅ Sí             | Turno confirmado por el cliente    |
| `en_proceso` | ✅ Sí             | Turno en curso                     |
| `completado` | ❌ No             | Turno ya finalizado                |
| `cancelado`  | ❌ No             | Turno cancelado                    |
| `no_asistio` | ❌ No             | Cliente no asistió                 |

---

## 🎯 Casos de Uso

### Caso 1: Completar Turnos Seleccionados Manualmente

```javascript
// 1. Buscar turnos en rango
const turnos = await api.get("/turnos/pendientes-rango/", {
  params: {
    fecha_desde: "2025-11-01",
    fecha_hasta: "2025-11-15",
  },
});

// 2. Usuario selecciona algunos IDs: [1, 3, 5, 7]
const turnosSeleccionados = [1, 3, 5, 7];

// 3. Completar solo los seleccionados
const result = await api.post("/turnos/completar-masivo/", {
  turno_ids: turnosSeleccionados,
});

console.log(`${result.data.completados} turnos completados`);
```

### Caso 2: Completar Todos del Día

```javascript
// Completar todos los turnos del día de hoy
const hoy = new Date().toISOString().split("T")[0];
const manana = new Date();
manana.setDate(manana.getDate() + 1);
const mananaTxt = manana.toISOString().split("T")[0];

const result = await api.post("/turnos/completar-masivo/", {
  fecha_desde: `${hoy}T00:00:00Z`,
  fecha_hasta: `${hoy}T23:59:59Z`,
});
```

### Caso 3: Botón "Completar Última Semana"

```javascript
// Simple click en botón
const result = await api.post("/turnos/completar-ultima-semana/");
toast.success(`${result.data.completados} turnos completados`);
```

---

## ⚠️ Errores Comunes

### Error 403: Forbidden

```json
{
  "error": "Solo los profesionales pueden marcar turnos como completados"
}
```

**Solución:** Verificar que el usuario tenga perfil de profesional.

### Error 400: Bad Request

```json
{
  "error": "Debe proporcionar turno_ids o un rango de fechas"
}
```

**Solución:** Enviar al menos uno de los dos parámetros requeridos.

---

## 🧪 Testing

### Test con cURL

```bash
# Buscar turnos pendientes
curl -X GET "http://localhost:8000/api/turnos/pendientes-rango/?fecha_desde=2025-11-01&fecha_hasta=2025-11-15" \
  -H "Authorization: Token YOUR_TOKEN"

# Completar turnos específicos
curl -X POST "http://localhost:8000/api/turnos/completar-masivo/" \
  -H "Authorization: Token YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"turno_ids": [1, 2, 3]}'

# Completar última semana
curl -X POST "http://localhost:8000/api/turnos/completar-ultima-semana/" \
  -H "Authorization: Token YOUR_TOKEN"
```

---

## 📝 Notas Importantes

1. **Fecha de Completado:** Al completar un turno, se guarda automáticamente `fecha_hora_completado` con la fecha/hora actual.

2. **Transaccionalidad:** Cada turno se procesa individualmente. Si uno falla, los demás continúan procesándose.

3. **Rendimiento:** Para grandes volúmenes (>100 turnos), considerar implementar procesamiento en background con Celery.

4. **Auditoría:** Todos los cambios de estado quedan registrados en el modelo `HistorialTurno`.

5. **Notificaciones:** Considerar enviar email de confirmación al completar turnos masivamente.
