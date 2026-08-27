import type { Saldo } from './tipos.js';

/** Los únicos que cambian de resultado por volver a llamar. */
export const CODIGOS_REINTENTABLES = [
  'limite_excedido',
  'origen_no_disponible',
  'sin_capacidad',
  'tiempo_agotado',
  'sin_conexion',
] as const;

/**
 * Un error devuelto por el API.
 *
 * Ramifique por `codigo`, nunca por el mensaje: el texto puede cambiar sin
 * aviso y el código no.
 */
export class RnpError extends Error {
  readonly codigo: string;
  readonly httpStatus: number;
  /** Si esta consulta descontó del saldo. Solo `vehiculo_no_encontrado` lo hace. */
  readonly cobrada: boolean;
  /** Segundos a esperar. Solo llega en `limite_excedido`. */
  readonly reintentarEn: number | null;
  /** Dónde recargar, cuando el problema es de saldo. */
  readonly recargaUrl: string | null;
  /** Identificador de la consulta. Cítelo al reportar un problema. */
  readonly requestId: string | null;
  readonly saldo: Saldo | null;

  constructor(init: {
    codigo: string;
    message: string;
    httpStatus?: number;
    cobrada?: boolean;
    reintentarEn?: number | null;
    recargaUrl?: string | null;
    requestId?: string | null;
    saldo?: Saldo | null;
  }) {
    super(init.message);
    this.name = 'RnpError';
    this.codigo = init.codigo;
    this.httpStatus = init.httpStatus ?? 0;
    this.cobrada = init.cobrada ?? false;
    this.reintentarEn = init.reintentarEn ?? null;
    this.recargaUrl = init.recargaUrl ?? null;
    this.requestId = init.requestId ?? null;
    this.saldo = init.saldo ?? null;
  }

  static desdeRespuesta(cuerpo: any, httpStatus: number): RnpError {
    const error = cuerpo?.error ?? {};

    return new RnpError({
      codigo: error.code ?? 'error_desconocido',
      message: error.message ?? 'La consulta no se pudo completar.',
      httpStatus,
      cobrada: cuerpo?.cobrada === true,
      reintentarEn: typeof error.reintentar_en === 'number' ? error.reintentar_en : null,
      recargaUrl: error.recarga_url ?? null,
      requestId: error.request_id ?? cuerpo?.request_id ?? null,
      saldo: cuerpo?.saldo ?? null,
    });
  }

  /** El API no respondió: red caída, DNS, tiempo agotado del lado del cliente. */
  static sinRespuesta(detalle: string): RnpError {
    return new RnpError({
      codigo: 'sin_conexion',
      message: `No se pudo contactar al API: ${detalle}`,
    });
  }

  get esReintentable(): boolean {
    return (CODIGOS_REINTENTABLES as readonly string[]).includes(this.codigo);
  }

  /** No hay vehículo con ese identificador. Es el único error que descuenta. */
  get noEncontrado(): boolean {
    return this.codigo === 'vehiculo_no_encontrado';
  }

  /** Se acabó el saldo o la prueba: hay que comprar, no reintentar. */
  get faltaSaldo(): boolean {
    return this.codigo === 'saldo_agotado' || this.codigo === 'prueba_finalizada';
  }

  /** La clave no sirve: revocada, inválida o cuenta suspendida. */
  get problemaDeCredencial(): boolean {
    return (
      this.codigo === 'credencial_invalida' ||
      this.codigo === 'credencial_revocada' ||
      this.codigo === 'cuenta_suspendida'
    );
  }
}
