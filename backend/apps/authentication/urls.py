from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Configuración del router para los ViewSets
router = DefaultRouter()
router.register(r'permisos', views.PermisoAdicionalViewSet)
router.register(r'configuracion', views.ConfiguracionViewSet)
router.register(r'auditoria', views.AuditoriaAccionesViewSet)
router.register(r'usuarios-basico', views.UsuarioBasicoViewSet)

app_name = 'core'

urlpatterns = [
    # Rutas de autenticación
    path('auth/register/', views.register, name='register'),
    path('auth/login/', views.login, name='login'),
    path('auth/logout/', views.logout, name='logout'),
    
    # Health check
    path('health/', views.health_check, name='health_check'),
    
    # Incluir todas las rutas de los ViewSets
    path('api/', include(router.urls)),
]
