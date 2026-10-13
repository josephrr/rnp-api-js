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

/**
 * El día en que vence la revisión técnica según Dekra.
 *
 * `vigente` es true si `fecha` es hoy o posterior, en hora de Costa Rica.
 * El objeto entero llega en null si Dekra no publica fecha. No es el mes de
 * `inspeccion_tecnica`, que se deduce del último dígito de la placa.
 */
export interface VencimientoDekra {
  /** Día `AAAA-MM-DD`. */
  fecha: string;
  /** La placa con la que Dekra contestó, sin espacios. */
  placa: string;
  vigente: boolean;
}

/**
 * Cuándo toca la inspección técnica, deducido del último dígito de la placa.
 *
 * 1 es enero, 2 febrero … 9 setiembre y 0 octubre. Se puede hacer desde el
 * mes anterior. null si la placa no termina en dígito.
 */
export interface InspeccionTecnica {
  entidad: string;
  digito: number;
  mes: number;
  mes_nombre: string;
  desde_mes: number;
  desde_mes_nombre: string;
  nota: string;
}

/**
 * Un monto estimado en colones. `referencial` es siempre true: no es lo que
 * cobran el INS ni la notaría.
 */
export interface Estimacion {
  anio: number;
  referencial: true;
  /** El valor fiscal sobre el que se calculó. */
  base: number;
  moneda: 'CRC';
  /** Solo en el marchamo: decide el seguro y la tabla del impuesto. */
  tipo_vehiculo?: 'particular' | 'moto' | 'carga_liviana';
  /** Cada rubro en colones enteros. Sumados dan `total`. */
  rubros: Record<string, number>;
  total: number;
  nota: string;
}

/** Marchamo y traspaso. Cada uno en null si no hay valor fiscal. */
export interface Estimaciones {
  marchamo: Estimacion | null;
  traspaso: Estimacion | null;
}

/**
 * De dónde viene el vehículo según su VIN, decodificado por la NHTSA.
 *
 * null cuando no conoce el VIN o el VIN no tiene 17 caracteres. Cada campo
 * puede venir en null por separado.
 */
export interface Origen {
  pais_fabricacion: string | null;
  ciudad_planta: string | null;
  estado_planta: string | null;
  fabricante: string | null;
  anio_modelo: number | null;
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
  inspeccion_tecnica?: InspeccionTecnica | null;
  vencimiento_dekra?: VencimientoDekra | null;
  estimaciones?: Estimaciones | null;
  origen?: Origen | null;
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

/**
 * Las clases de placa del contrato. En la moto también se acepta `M`,
 * `MOTO` y `MOTOCICLETA`, que el cliente normaliza a `MOT`.
 */
export type Clase = 'particular' | 'CL' | 'MOT';

/**
 * Solo el vencimiento de Dekra.
 *
 * No trae vehículo ni saldo: no se le preguntó al Registro. `cobrada` es
 * siempre false. `datos` en null significa que Dekra no publicó fecha.
 */
export interface ConsultaDekra {
  datos: VencimientoDekra | null;
  cobrada: boolean;
  consultado_en: string | null;
  request_id: string | null;
}

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
