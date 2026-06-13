# Configuración Teltonika FMC920

## Prerrequisitos
- Teltonika Configurator descargado: https://wiki.teltonika-gps.com/view/Teltonika_Configurator
- Dispositivo FMC920 conectado por USB o Bluetooth
- IP pública del GPS Server (Railway, Fly.io, o tu servidor)

---

## Paso 1: GPRS / Data Sending

**GPRS → Data Sending Settings:**
| Campo                  | Valor                            |
|------------------------|----------------------------------|
| Protocol               | **TCP**                          |
| Server #1 Domain / IP  | `tu-server.railway.app` o IP     |
| Server #1 Port         | **5000**                         |
| Server #2             | (vacío — opcional backup)        |

---

## Paso 2: Records Settings

**Records Settings:**
| Campo                              | Valor recomendado |
|------------------------------------|-------------------|
| Home on stop, min period (s)       | 60                |
| Home moving, min period (s)        | **10**            |
| Home moving, min distance (m)      | 50                |
| Roaming on stop, min period (s)    | 60                |
| Roaming moving, min period (s)     | 30                |
| Min saved records                  | 1                 |
| Send period (s)                    | **10**            |

> Para mayor precisión usa 10s. Para ahorrar datos de SIM usa 30s.

---

## Paso 3: I/O Elements (críticos)

**I/O → I/O Settings — Habilitar los siguientes:**

| ID  | Nombre            | Habilitado | Evento | Prioridad |
|-----|-------------------|-----------|--------|-----------|
| 239 | Ignition          | ✅         | Both   | High      |
| 240 | Movement          | ✅         | Both   | Low       |
| 21  | GSM Signal        | ✅         | None   | Low       |
| 66  | External Voltage  | ✅         | None   | Low       |
| 67  | Battery Voltage   | ✅         | None   | Low       |
| 16  | Odometer          | ✅         | None   | Low       |
| 199 | Total Odometer    | ✅         | None   | Low       |
| 69  | GNSS Status       | ✅         | None   | Low       |
| 200 | Sleep Mode        | ✅         | None   | Low       |

---

## Paso 4: SOS Button (si disponible)

**I/O → I/O Settings:**
| ID  | Nombre | Habilitado | Prioridad |
|-----|--------|-----------|-----------|
| 237 | SOS    | ✅        | **Panic** |

---

## Paso 5: Eco Driving (opcional)

**Eco Driving:**
- Harsh Acceleration: `0.5 G`
- Harsh Braking: `0.5 G`
- Harsh Cornering: `0.3 G`

---

## Paso 6: Guardar y cargar configuración

1. Click **Save to device**
2. Reiniciar dispositivo
3. Verificar LED: verde parpadeando = enviando datos

---

## Verificar que el dispositivo está conectando

En el GPS Server, busca en los logs:
```
[GPS] New connection: 1.2.3.4:51234
[GPS] Device identified: IMEI=123456789012345 from 1.2.3.4:51234
[GPS] Queued 3 records from 123456789012345
```

---

## Troubleshooting

| Problema | Causa probable | Solución |
|---------|---------------|---------|
| No aparece en mapa | IMEI no registrado | Añadir dispositivo en /devices |
| "Unknown IMEI" en logs | Falta registro | Crear dispositivo con ese IMEI |
| No conecta a servidor | Firewall/puerto | Verificar que TCP :5000 es accesible |
| CRC mismatch en logs | Firmware viejo | Actualizar firmware del dispositivo |
| Posición siempre 0,0 | Sin señal GPS | Verificar antena GPS |

---

## Otros dispositivos compatibles

| Modelo   | Codec | Notas                               |
|----------|-------|-------------------------------------|
| FMC920   | 8     | Compacto, ideal para autos          |
| FMB140   | 8     | Con lector RFID                     |
| FMC003   | 8E    | Ultra compacto OBD                  |
| FM3001   | 8     | Con bluetooth sensors               |
| FMB125   | 8     | Con entrada para temp/cargo         |
| FMM130   | 8E    | 4G LTE Cat-M1                       |

El decoder soporta **Codec 8 y Codec 8E** (detectado automáticamente).
