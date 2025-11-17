"""
Clases de paginación personalizadas para la API
"""

from rest_framework.pagination import PageNumberPagination


class CustomPageNumberPagination(PageNumberPagination):
    """
    Paginación personalizada que permite al cliente especificar el tamaño de página
    """

    page_size = 20  # Tamaño por defecto
    page_size_query_param = "page_size"  # Parámetro para especificar tamaño
    max_page_size = 1000  # Máximo permitido para evitar sobrecargas
