import { RnpError } from './errores.js';
import type { Clase, Consulta, EstadoRegistral, Opciones } from './tipos.js';

const BASE_POR_DEFECTO = 'https://rnp.egobytes.com/api/v1';

/** El Registro suele tardar entre 3 y 10 segundos; 45 deja margen de sobra. */
const TIEMPO_LIMITE = 45_000;

const VERSION = '1.0.0';

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Cliente del API de consulta vehicular del Registro Nacional de Costa Rica.
 *
 * ```ts
 * const rnp = new RnpApi({ apiKey: process.env.RNP_API_KEY! });
 * const consulta = await rnp.porPlaca('BJK123');
 *
 * console.log(consulta.datos.vehiculo?.marca, consulta.saldo?.total);
 * ```
 *
 * Sin dependencias: usa `fetch`, que Node trae desde la 18.
 */
export class RnpApi {
  private readonly apiKey: string;
  private readonly base: string;
  private readonly reintentos: number;
  private readonly tiempoLimite: number;

  constructor(opciones: Opciones) {
    if (!opciones?.apiKey) {
      throw new Error('Falta la API key. Se genera en el portal, sección Credenciales.');
    }

    // En el navegador la clave viaja al equipo de cada visitante y queda a la
    // vista en las herramientas de desarrollo. Es un error tan fácil de cometer
    // como caro de descubrir, así que se corta aquí y no en una nota del README.
    const enNavegador = typeof window !== 'undefined' && typeof document !== 'undefined';

    if (enNavegador && !opciones.permitirNavegador) {
      throw new Error(
        'No use este cliente en el navegador: su API key quedaría expuesta a cualquiera ' +
          'que abra las herramientas de desarrollo. Llame al API desde su servidor. ' +
          'Si su clave puede ser pública, pase permitirNavegador: true.',
      );
    }

    this.apiKey = opciones.apiKey;
    this.base = (opciones.baseUrl ?? BASE_POR_DEFECTO).replace(/\/+$/, '');
    this.reintentos = opciones.reintentos ?? 2;
    this.tiempoLimite = opciones.tiempoLimite ?? TIEMPO_LIMITE;
  }

  /** Toma la clave del entorno, que es donde debería estar. */
  static desdeEntorno(variable = 'RNP_API_KEY'): RnpApi {
    const entorno = typeof process !== 'undefined' ? process.env : undefined;
    const apiKey = entorno?.[variable];

    if (!apiKey) {
      throw new Error(`La variable de entorno ${variable} está vacía.`);
    }

    const baseUrl = entorno?.RNP_API_URL;

    return new RnpApi(baseUrl ? { apiKey, baseUrl } : { apiKey });
  }

  /**
   * Consulta por placa.
   *
   * En carga liviana va solo el número: el `CL` es la clase, no parte de la
   * placa. `porPlaca('272490', 'CL')`, no `porPlaca('CL272490')`.
   */
  async porPlaca(placa: string, clase: Clase = 'particular'): Promise<Consulta> {
    const limpia = placa.trim().toUpperCase();

    if (!/^[A-Z0-9]{1,10}$/.test(limpia)) {
      throw new Error('La placa se escribe sin guiones ni espacios.');
    }

    const ruta = `/vehiculos/placa/${encodeURIComponent(limpia)}`;

    return this.consultar(clase === 'CL' ? `${ruta}?clase=CL` : ruta);
  }

  /** Consulta por número de VIN o chasis. */
  async porVin(vin: string): Promise<Consulta> {
    const limpio = vin.trim().toUpperCase();

    if (!/^[A-Z0-9]{3,20}$/.test(limpio)) {
      throw new Error('El VIN se escribe sin guiones ni espacios.');
    }

    return this.consultar(`/vehiculos/vin/${encodeURIComponent(limpio)}`);
  }

  /**
   * Reintenta solo lo que puede cambiar de resultado.
   *
   * Un 402 o un 404 dan lo mismo diez veces; reintentarlos solo gasta tiempo.
   * El límite por minuto sí se respeta esperando lo que el propio API indica.
   */
  private async consultar(ruta: string): Promise<Consulta> {
    for (let intento = 0; ; intento++) {
      try {
        return await this.pedir(ruta);
      } catch (e) {
        const error = e as RnpError;

        if (intento >= this.reintentos || !(error instanceof RnpError) || !error.esReintentable) {
          throw error;
        }

        // Si el API dijo cuánto esperar, se le hace caso; si no, retroceso
        // exponencial: 1 s, 2 s, 4 s…
        await espera(error.reintentarEn ? error.reintentarEn * 1000 : 2 ** intento * 1000);
      }
    }
  }

  private async pedir(ruta: string): Promise<Consulta> {
    const corte = AbortSignal.timeout(this.tiempoLimite);

    let respuesta: Response;

    try {
      respuesta = await fetch(`${this.base}${ruta}`, {
        method: 'GET',
        signal: corte,
        headers: {
          'X-API-Key': this.apiKey,
          Accept: 'application/json',
          'User-Agent': `rnp-js/${VERSION}`,
        },
      });
    } catch (e) {
      throw RnpError.sinRespuesta(e instanceof Error ? e.message : 'sin detalle');
    }

    let cuerpo: any;

    try {
      cuerpo = await respuesta.json();
    } catch {
      throw new RnpError({
        codigo: 'respuesta_ilegible',
        message: `El API devolvió algo que no es JSON (HTTP ${respuesta.status}).`,
        httpStatus: respuesta.status,
      });
    }

    if (!respuesta.ok || cuerpo?.error) {
      throw RnpError.desdeRespuesta(cuerpo, respuesta.status);
    }

    return cuerpo as Consulta;
  }
}

/**
 * Lee un estado registral sin confundir «no» con «no se sabe».
 *
 * Existe porque `if (consulta.datos.gravamenes?.posee)` trata `null` igual que
 * `false`, y eso es afirmar que un vehículo está libre cuando el Registro no
 * lo dijo. Es el error que más caro sale de esta integración.
 */
export function leerEstado(estado: EstadoRegistral | undefined): 'si' | 'no' | 'indeterminado' {
  if (estado?.posee === true) return 'si';
  if (estado?.posee === false) return 'no';

  return 'indeterminado';
}
