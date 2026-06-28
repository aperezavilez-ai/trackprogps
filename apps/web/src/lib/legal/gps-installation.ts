import { LEGAL } from '@/lib/legal/site-legal'

/** Párrafo para insertar en Términos y condiciones — SIM y dispositivos */
export const SIM_DEVICE_TERMS_PARAGRAPH = `El Cliente, el instalador autorizado y/o el titular del vehículo son los únicos responsables de la adquisición, activación, registro (cuando aplique conforme a la normativa de telecomunicaciones vigente en México), homologación ante el IFT y uso lícito de las tarjetas SIM, chips M2M/IoT, equipos GPS y demás hardware conectado a ${LEGAL.brand}. ${LEGAL.brand} provee exclusivamente software de monitoreo en la nube y no actúa como operador de telefonía móvil, distribuidor de SIM ni importador de equipos, salvo pacto expreso por escrito. Queda prohibido utilizar líneas móviles personales (prepago o pospago con voz/SMS) en dispositivos de rastreo cuando ello incumpla los lineamientos del Padrón Nacional de Telefonía Móvil o las condiciones del operador; se recomienda el uso de planes M2M o IoT de solo datos contratados con el operador o proveedor autorizado. El Cliente mantendrá indemne a ${LEGAL.brand} frente a reclamaciones, multas, suspensiones de línea o daños derivados del incumplimiento de estas obligaciones, de la instalación defectuosa, del uso del servicio con fines ilícitos o de la falta de consentimiento de los conductores cuando la ley lo exija.`

export const INSTALLER_GUIDE_SECTIONS = [
  {
    title: '1. Antes de instalar',
    items: [
      'Confirma que el vehículo pertenece al cliente y que existe autorización para instalar el rastreador.',
      'Verifica cobertura celular en la zona habitual de operación del vehículo.',
      'Usa únicamente SIM M2M / IoT de solo datos (no chips prepago de celular personal).',
      'Comprueba homologación IFT del equipo GPS si fue importado o comercializado en México.',
    ],
  },
  {
    title: '2. SIM y conectividad',
    items: [
      'Contrata el plan con un operador o revendedor M2M (Telcel, AT&T, Movistar, Altán u otro autorizado).',
      'Anota ICCID y, si aplica, número de línea en el alta del dispositivo en TrackPro GPS.',
      'Dispositivos multicarrier (p. ej. Teltonika): el cumplimiento legal depende del tipo de plan SIM, no de la marca del GPS.',
      'Las líneas M2M/IoT de solo telemetría, según lineamientos de la CRT, no requieren vincularse al Padrón con CURP del conductor; las líneas con voz/SMS sí.',
    ],
  },
  {
    title: '3. Instalación del GPS',
    items: [
      'Instala en lugar oculto, con alimentación estable (12/24 V) y antena GPS con vista al cielo.',
      'Configura APN, servidor y puerto según la ficha del dispositivo (TrackPro: TCP puerto 5000).',
      'Registra IMEI (15 dígitos) en la plataforma y vincula al vehículo correcto.',
      'Prueba transmisión: encendido, posición en mapa y alertas básicas antes de cerrar la instalación.',
    ],
  },
  {
    title: '4. Entrega al cliente',
    items: [
      'Entrega acta o checklist firmado con IMEI, ICCID, vehículo y fecha.',
      'Capacita al cliente en acceso web/PWA y contacto de soporte: soporte@trackprogps.mx.',
      'Recuerda: los usuarios finales del cliente se registran en trackprogps.mx/register; el equipo interno TrackPro se da de alta solo desde Administrador.',
    ],
  },
  {
    title: '5. Qué no hacer',
    items: [
      'No usar chip de celular personal “porque era más barato”.',
      'No compartir credenciales de la plataforma con terceros.',
      'No instalar sin autorización del titular del vehículo.',
      'No prometer cumplimiento legal de telecomunicaciones en nombre de TrackPro GPS; remite dudas a soporte.',
    ],
  },
] as const
