from django.urls import path
from . import views

urlpatterns = [
    # Categorías
    path('categorias/', views.CategoriaServicioListView.as_view(), name='categoria-list'),
    path('categorias/<int:pk>/', views.CategoriaServicioDetailView.as_view(), name='categoria-detail'),
    
    # Servicios
    path('', views.ServicioListView.as_view(), name='servicio-list'),
    path('<int:pk>/', views.ServicioDetailView.as_view(), name='servicio-detail'),
    path('categoria/<int:categoria_id>/', views.servicios_por_categoria, name='servicios-por-categoria'),
]