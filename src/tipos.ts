/**
 * La forma de lo que devuelve el API.
 *
 * Los campos del vehículo se tipan como `string | null` en vez de enumerarse
 * uno a uno de forma rígida: el Registro cambia sus campos de vez en cuando, y
 * un tipo cerrado convertiría cada cambio suyo en una versión mayor de este
 * paquete.
 */

/** Un asiento registral: la referencia con la que se ubica un acto. */
export interface Asiento {
  tipo?: string | null;
  tomo?: string | null;
  asiento?: string | null;
  secuencia?: string | null;
  fecha?: string | null;
}

/**
 * Gravámenes, anotaciones, infracciones o levantamientos.
 *
 * `posee` tiene **tres** estados. `null` significa que el Registro no lo dijo:
 * tratarlo como `false` equivale a afirmar que un vehículo está libre cuando
 * en realidad no se sabe.
 */
export interface EstadoRegistral {
  posee: boolean | null;
  items: Asiento[];
  nota?: string | null;
}

export interface Propietario {
  tipo_identificacion?: string | null;
  numero_identificacion?: string | null;
  nombre?: string | null;
}

export interface DatosDelVehiculo {
  vehiculo?: Record<string, string | Asiento | null | undefined>;
  motor?: Record<string, string | null | undefined>;
  propietarios?: Propietario[];
  gravamenes?: EstadoRegistral;
  anotaciones?: EstadoRegistral;
  infracciones?: EstadoRegistral;
  levantamientos?: EstadoRegistral;
  fecha_emision?: string | null;
}

/** Las consultas que quedan, tal como quedaron tras esta llamada. */
export interface Saldo {
  plan: number;
  creditos: number;
  prueba: number;
  total: number;
  renueva_en: string | null;
  credito_vence_en: string | null;
  /** Presente y en true solo en cuentas sin cobro. */
  exento?: boolean;
}

export interface Consulta {
  datos: DatosDelVehiculo;
  /** Una respuesta `parcial` nunca se cobra. */
  completitud: 'completa' | 'parcial';
  secciones_ausentes: string[];
  /** Si esta consulta descontó del saldo. */
  cobrada: boolean;
  /** true en las placas DEMO: datos ficticios, sin tocar el Registro. */
  sandbox: boolean;
  saldo: Saldo | null;
  consultado_en: string | null;
  request_id: string | null;
}

/** Las dos clases de placa que acepta el API. */
export type Clase = 'particular' | 'CL';

export interface Opciones {
  apiKey: string;
  /** Por omisión, el API de producción. */
  baseUrl?: string;
  /** Reintentos ante fallos del Registro. 0 los desactiva. */
  reintentos?: number;
  /** Milisegundos antes de abandonar una consulta. */
  tiempoLimite?: number;
  /**
   * Permite usar el cliente en un navegador.
   *
   * Está desactivado a propósito: en el navegador la clave viaja al equipo de
   * cada visitante y queda visible en las herramientas de desarrollo. Actívelo
   * solo si sabe que su clave puede ser pública, que casi nunca es el caso.
   */
  permitirNavegador?: boolean;
}
