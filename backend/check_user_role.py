from rest_framework.authtoken.models import Token

token_key = '5c421478db7a2aea913d0ac1291bb763d4bd8fd2'
t = Token.objects.get(key=token_key)
u = t.user
print(f'Email: {u.email}')
print(f'Rol: {u.role}')
print(f'Es propietario: {u.role == "propietario"}')
