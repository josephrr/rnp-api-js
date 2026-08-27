# @egobytes/rnp-api

Cliente del API de consulta vehicular del **Registro Nacional de Costa Rica**.
Consulta por placa o por VIN y devuelve características, motor, propietarios y
situación registral.

Sin dependencias: usa `fetch`, que Node trae desde la 18. Tipado en TypeScript.

```bash
npm install @egobytes/rnp-api
```

Necesita una clave, que se genera en el portal, sección Credenciales.

## Empezar

```ts
import { RnpApi } from '@egobytes/rnp-api';

const rnp = new RnpApi({ apiKey: process.env.RNP_API_KEY! });

const consulta = await rnp.porPlaca('BJK123');

console.log(consulta.datos.vehiculo?.marca);   // TOYOTA
console.log(consulta.saldo?.total);            // 248
```

O tomando la clave del entorno:

```ts
const rnp = RnpApi.desdeEntorno();             // lee RNP_API_KEY
```

## No lo use en el navegador

El cliente lanza un error si detecta que corre en un navegador. No es una
molestia: ahí su clave viaja al equipo de cada visitante y queda a la vista en
las herramientas de desarrollo. Llame al API desde su servidor.

Si su clave puede ser pública —que casi nunca es el caso—, pase
`permitirNavegador: true`.

## Carga liviana

El `CL` es la **clase**, no parte de la placa:

```ts
await rnp.porPlaca('272490', 'CL');   // correcto
await rnp.porPlaca('CL272490');       // no encuentra nada
```

## Por VIN

```ts
const consulta = await rnp.porVin('8AJHA8CD704309461');
```

## Gravámenes y anotaciones

`posee` tiene **tres** estados, no dos:

```ts
if (consulta.datos.gravamenes?.posee) { /* ← mal */ }
```

Eso trata `null` igual que `false`, y `null` significa que el Registro **no lo
dijo**. Es el error que más caro sale de esta integración: afirma que un
vehículo está libre cuando en realidad no se sabe.

```ts
import { leerEstado } from '@egobytes/rnp-api';

switch (leerEstado(consulta.datos.gravamenes)) {
  case 'si':
    for (const item of consulta.datos.gravamenes!.items) {
      console.log(item.tipo, item.fecha);
    }
    break;
  case 'no':
    // El Registro afirma que no tiene
    break;
  case 'indeterminado':
    // El Registro no lo dijo: no se puede concluir nada
    break;
}
```

Lo mismo con `anotaciones`, `infracciones` y `levantamientos`.

## Errores

Todos los fallos del API lanzan `RnpError`. Ramifique por `codigo`, nunca por
el mensaje: el texto puede cambiar sin aviso y el código no.

```ts
import { RnpError } from '@egobytes/rnp-api';

try {
  const consulta = await rnp.porPlaca('BJK123');
} catch (e) {
  if (!(e instanceof RnpError)) throw e;

  if (e.noEncontrado) {
    // 404: no hay vehículo con esa placa. Es el único error que descuenta.
  } else if (e.faltaSaldo) {
    // 402: hay que recargar. e.recargaUrl tiene el enlace.
  } else if (e.problemaDeCredencial) {
    // 401/403: la clave no sirve. Reintentar no ayuda.
  } else if (e.esReintentable) {
    // El Registro está caído o saturado. El cliente ya reintentó solo.
  }

  // Cite este identificador al reportar un problema.
  console.error(e.requestId);
}
```

| Propiedad | Cuándo |
|---|---|
| `noEncontrado` | `vehiculo_no_encontrado` — el Registro respondió y no hay nada inscrito |
| `faltaSaldo` | `saldo_agotado`, `prueba_finalizada` |
| `problemaDeCredencial` | `credencial_invalida`, `credencial_revocada`, `cuenta_suspendida` |
| `esReintentable` | `limite_excedido`, `origen_no_disponible`, `sin_capacidad`, `tiempo_agotado` |

## Reintentos

El cliente reintenta por su cuenta lo que puede cambiar de resultado: el
Registro caído, saturado o lento. Un 402 o un 404 dan lo mismo diez veces, así
que no se reintentan.

Cuando el API indica cuántos segundos esperar —el límite por minuto— se respeta
ese número; si no, retrocede exponencialmente: 1 s, 2 s, 4 s.

```ts
new RnpApi({ apiKey, reintentos: 4 });   // más insistente
new RnpApi({ apiKey, reintentos: 0 });   // sin reintentos
```

## Cómo se cobra

Se descuenta **una consulta por cada respuesta completa**. Si el Registro no
responde, responde a medias o rechaza la petición, la consulta no se cobra, y
la respuesta lo dice:

```ts
consulta.cobrada;                  // false cuando no se descontó
consulta.completitud === 'parcial' // el Registro no entregó todas las secciones
consulta.saldo?.total;             // lo que queda, ya con este cobro cerrado
```

Una respuesta parcial trae datos buenos pero incompletos: sirve para mostrar,
no para concluir que un vehículo está libre de gravámenes.

## Vehículos de prueba

Estas placas devuelven datos ficticios, no tocan el Registro y no consumen
saldo. Detrás de una placa real hay una persona con nombre y cédula: programe
contra estas.

| Placa | Qué devuelve |
|---|---|
| `DEMO001` | Vehículo con dos gravámenes activos |
| `DEMO002` | Vehículo con anotaciones y un levantamiento |
| `DEMO003` | Vehículo sin gravámenes ni anotaciones |
| `DEMO404` | Placa inexistente: lanza `vehiculo_no_encontrado` |

## Guarde en caché lo que consulte

Los datos de un vehículo casi no cambian de un día para otro. Guardar cada
respuesta al menos 24 horas de su lado le baja la factura y le quita
dependencia de que el Registro esté disponible en ese instante.

## Advertencia

Este servicio presenta información publicada por el Registro Nacional. No la
genera, no la valida y no la certifica: **no sustituye una certificación
registral**. Para cualquier trámite legal se requiere el documento oficial.

---

Documentación completa: <https://rnp.egobytes.com/docs> ·
Soporte: <soporte@egobytes.com>
