from django.urls import path
from . import views

urlpatterns = [
    # Empleados
    path("", views.EmpleadoListView.as_view(), name="empleado-list"),
    path("me/", views.empleado_me_view, name="empleado-me"),
    path("<int:pk>/", views.EmpleadoDetailView.as_view(), name="empleado-detail"),
]
