from django.db import models

class CategoriaServicio(models.Model):
    """
    Categorías de servicios (ej: Corte, Coloración, Tratamientos)
    """
    nombre = models.CharField(max_length=100, verbose_name='Nombre')
    descripcion = models.TextField(blank=True, null=True, verbose_name='Descripción')
    is_active = models.BooleanField(default=True, verbose_name='Activo')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Fecha de creación')
    
    class Meta:
        verbose_name = 'Categoría de Servicio'
        verbose_name_plural = 'Categorías de Servicios'
        ordering = ['nombre']
    
    def __str__(self):
        return self.nombre

class Servicio(models.Model):
    """
    Servicios ofrecidos por el salón de belleza
    """
    nombre = models.CharField(max_length=200, verbose_name='Nombre')
    descripcion = models.TextField(blank=True, null=True, verbose_name='Descripción')
    categoria = models.ForeignKey(CategoriaServicio, on_delete=models.CASCADE, related_name='servicios', verbose_name='Categoría')
    precio = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='Precio')
    duracion_minutos = models.PositiveIntegerField(verbose_name='Duración (minutos)')
    is_active = models.BooleanField(default=True, verbose_name='Activo')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Fecha de creación')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Fecha de actualización')
    
    class Meta:
        verbose_name = 'Servicio'
        verbose_name_plural = 'Servicios'
        ordering = ['categoria__nombre', 'nombre']
    
    def __str__(self):
        return f"{self.categoria.nombre} - {self.nombre}"
    
    @property
    def duracion_horas(self):
        """Retorna la duración en formato horas:minutos"""
        horas = self.duracion_minutos // 60
        minutos = self.duracion_minutos % 60
        if horas > 0:
            return f"{horas}h {minutos}m" if minutos > 0 else f"{horas}h"
        return f"{minutos}m"
