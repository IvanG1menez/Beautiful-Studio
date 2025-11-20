"""URLs para la app de encuestas"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'encuestas', views.EncuestaViewSet, basename='encuesta')
router.register(r'config', views.EncuestaConfigViewSet, basename='encuesta-config')

urlpatterns = [
    path('turno/<int:turno_id>/info/', views.TurnoEncuestaInfoView.as_view(), name='turno-encuesta-info'),
    path('', include(router.urls)),
]
