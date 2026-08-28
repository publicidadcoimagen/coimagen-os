# Conversión Prospecto→Cliente

`POST /prospects/:id/convert` — reemplaza el botón cosmético "Convertir" del pipeline (que solo cambiaba `prospects.status`, sin crear nada en `clients`).

Diseño completo y evidencia auditados el 23-ago-2026 contra el código y esquema reales (ver Artifact "Conversión Prospecto→Cliente"). Este documento es el resumen operativo; el diseño no repite aquí lo que ya vive en el código como comentarios.

## Evento y quién lo dispara

Acción explícita de staff (`ceo`/`admin`, mismo gate que toda ruta comercial mutante) — nunca automática al aceptar una propuesta, por la misma razón que la firma de contrato solo la mueve el webhook de DocuSeal: crear una entidad de facturación real no depende de una acción de un tercero no autenticado como staff.

## Precondiciones (orden exacto)

1. El prospecto existe y `converted_client_id` es `null`.
2. Existe al menos una propuesta (`proposals`) de ese prospecto con `status = 'accepted'`.
3. Si `prospects.source` parece dato de prueba (`manual_test`, o empieza con `test_`/`manual_test`) y el body no incluye `{"confirmTestSource": true}` — se rechaza.

"Contrato firmado" no es precondición: `contracts` no tiene enlace de esquema a `proposals`/`prospects` (antes de esta misma entrega — ver `contracts.proposalId`, añadida por separado). No se simula ese chequeo.

## Idempotencia

- **Capa 1 (real):** `prospects.converted_client_id` es `integer UNIQUE, FK → clients.id`, nullable. Un segundo `UPDATE` con el mismo valor falla en la base de datos misma, no solo en la aplicación.
- **Capa 2 (informativa):** chequeo previo — si ya tiene valor, `409` con el cliente existente en vez de reintentar.
- Todo corre en una única transacción (`db.transaction`) — ver `lib/prospect-conversion/repository.ts`.

## Qué crea y qué no

Crea: `clients` (status explícito `"active"`, nunca el default de esquema `"prospect"`), enlaza `diagnoses.clientId` y `proposals.clientId` de ese prospecto (sin tocar `prospectId` — se enlaza, no se migra), copia `prospects.notes` como primera `client_notes` si tiene contenido, escribe una fila en `client_timeline` (`eventType: "converted_from_prospect"`) con el prospecto de origen, la propuesta que lo justificó, y el staff que ejecutó.

No crea: organización (Client Room), usuario inicial de portal, ni proyecto — ninguno de estos se crea automáticamente ni siquiera en el único precedente real de creación de cliente (`POST /onboardings/:id/complete`). Quedan como pasos manuales posteriores.

## Pruebas

`artifacts/api-server/test/prospect-conversion.test.ts` — contra PGlite (Postgres real embebido, nunca Neon de producción): las 8 pruebas negativas obligatorias (doble conversión, sin propuesta aceptada, ya convertido, fallo parcial con reversión real de transacción, dato de prueba sin confirmar, prospecto inexistente, rol insuficiente, conversión concurrente con la constraint UNIQUE real) más los casos positivos (conversión completa, conversión de dato de prueba confirmado).
