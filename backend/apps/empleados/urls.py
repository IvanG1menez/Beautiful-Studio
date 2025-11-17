from django.urls import path
from . import views

urlpatterns = [
    # Empleados
    path("", views.EmpleadoListView.as_view(), name="empleado-list"),
    path("me/", views.empleado_me_view, name="empleado-me"),
    path("<int:pk>/", views.EmpleadoDetailView.as_view(), name="empleado-detail"),
    path(
        "<int:empleado_id>/dias-trabajo/",
        views.dias_trabajo_empleado,
        name="dias-trabajo-empleado",
    ),
    # Horarios de empleados
    path(
        "horarios/",
        views.HorarioEmpleadoListCreateView.as_view(),
        name="horario-list-create",
    ),
    path(
        "horarios/<int:pk>/",
        views.HorarioEmpleadoDetailView.as_view(),
        name="horario-detail",
    ),
    path(
        "<int:empleado_id>/horarios/bulk/",
        views.bulk_update_horarios,
        name="horarios-bulk-update",
    ),
]
