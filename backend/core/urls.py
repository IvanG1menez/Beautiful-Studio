"""
URL configuration for core project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter

# Create a router for API endpoints
router = DefaultRouter()

urlpatterns = [
    path("jet/", include("jet.urls", "jet")),  # Django JET URLs
    path(
        "jet/dashboard/", include("jet.dashboard.urls", "jet-dashboard")
    ),  # Django JET dashboard
    path("admin/", admin.site.urls),  # Django admin
    path("api/", include(router.urls)),
    path("api/", include("apps.authentication.urls")),  # Authentication URLs
    path("api/auth/", include("social_django.urls", namespace="social")),  # Google OAuth URLs
    path("api/users/", include("apps.users.urls")),
    path("api/empleados/", include("apps.empleados.urls")),
    path("api/clientes/", include("apps.clientes.urls")),
    path("api/servicios/", include("apps.servicios.urls")),
    path("api/turnos/", include("apps.turnos.urls")),
    path("api/encuestas/", include("apps.encuestas.urls")),
    path("api/", include("apps.notificaciones.urls")),
    path("api-auth/", include("rest_framework.urls")),
]
