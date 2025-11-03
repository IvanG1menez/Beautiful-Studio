from django.urls import path
from . import views

app_name = "users"  # Namespace para evitar conflictos de nombres

urlpatterns = [
    # Autenticación
    path("register/", views.UserCreateView.as_view(), name="register"),
    path("login/", views.login_view, name="login"),
    path("logout/", views.logout_view, name="logout"),
    # Perfil de usuario
    path("profile/", views.UserProfileView.as_view(), name="profile"),
    path("me/", views.UserProfileView.as_view(), name="me"),  # Alias para profile
    # Cambiar contraseña
    path("change-password/", views.change_password_view, name="change-password"),
    # Vista alternativa comentada para referencia futura
    # path(
    #     'login-token/', views.CustomObtainAuthToken.as_view(),
    # name='login-token'
    # ),
]
