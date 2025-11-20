import requests
import json

# URL base del servidor
BASE_URL = "http://localhost:8000/api"

# Obtener token de autenticación (necesitas usar un token válido)
# Puedes obtenerlo del localStorage del navegador o crear uno temporal

def check_turnos_con_notas():
    # Intentar obtener turnos (necesitarás autenticación)
    # Por ahora vamos a ver qué podemos obtener sin auth
    
    try:
        # Intentar obtener lista de turnos
        response = requests.get(f"{BASE_URL}/turnos/", params={"page_size": 1000})
        
        if response.status_code == 200:
            data = response.json()
            turnos = data.get('results', data) if isinstance(data, dict) else data
            
            print(f"Total de turnos obtenidos: {len(turnos)}")
            
            # Filtrar turnos con notas
            turnos_con_notas = [t for t in turnos if t.get('notas_cliente')]
            
            print(f"\n=== Turnos con notas: {len(turnos_con_notas)} ===")
            for t in turnos_con_notas[:20]:
                notas = t.get('notas_cliente', '')
                print(f"ID {t['id']}: [{notas}] (len={len(notas)})")
            
            # Buscar específicamente notas cortas
            print("\n\n=== Notas de 1-3 caracteres ===")
            notas_cortas = [t for t in turnos_con_notas if len(t.get('notas_cliente', '')) <= 3]
            
            if notas_cortas:
                for t in notas_cortas:
                    print(f"ID {t['id']}: [{t.get('notas_cliente')}]")
            else:
                print("No se encontraron notas de 1-3 caracteres")
                
        elif response.status_code == 401:
            print("Error: Necesita autenticación. Por favor ejecuta este script desde el navegador o proporciona un token.")
        else:
            print(f"Error {response.status_code}: {response.text}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_turnos_con_notas()
