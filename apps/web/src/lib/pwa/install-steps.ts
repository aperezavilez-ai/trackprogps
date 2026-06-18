export interface InstallStep {
  at: number
  message: string
}

export const PWA_INSTALL_STEPS: InstallStep[] = [
  { at: 0,  message: 'Iniciando instalación...' },
  { at: 6,  message: 'Verificando compatibilidad del dispositivo...' },
  { at: 12, message: 'Descargando paquete principal (TrackPro GPS)...' },
  { at: 20, message: 'Instalando dependencias del sistema...' },
  { at: 28, message: 'Configurando módulo de rastreo GPS...' },
  { at: 36, message: 'Estableciendo conexión con servidores en la nube...' },
  { at: 44, message: 'Sincronizando protocolos Teltonika / GT06...' },
  { at: 52, message: 'Cargando mapas y capas satelitales...' },
  { at: 60, message: 'Activando alertas, geocercas y notificaciones...' },
  { at: 68, message: 'Optimizando consumo de batería y datos...' },
  { at: 76, message: 'Registrando servicio en segundo plano...' },
  { at: 84, message: 'Validando certificados de seguridad...' },
  { at: 92, message: 'Finalizando configuración...' },
  { at: 100, message: '¡Instalación completada!' },
]

export function messageForProgress(progress: number): string {
  let msg = PWA_INSTALL_STEPS[0]!.message
  for (const step of PWA_INSTALL_STEPS) {
    if (progress >= step.at) msg = step.message
  }
  return msg
}
