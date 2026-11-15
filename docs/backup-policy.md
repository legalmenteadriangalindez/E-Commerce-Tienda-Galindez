# Política operativa de copias y restauración

Esta política separa la copia automática de la restauración productiva. Ningún
procedimiento automático escribe sobre la base de producción durante una
restauración.

## Política definida

| Control                 | Decisión                                                                                                                                                                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frecuencia automática   | MongoDB Atlas: respaldo continuo/PITR cuando el plan lo permita y snapshot diario a las 02:00, hora de Colombia. La configuración se realiza en Atlas, no en Render.                                                                     |
| Retención               | Snapshots diarios: 35 días. Snapshot mensual: 12 meses. Evidencia de cada prueba de restauración en GitHub Actions: 90 días.                                                                                                             |
| Ubicación externa       | Proyecto o clúster de respaldo separado de producción y una copia cifrada en almacenamiento de objetos externo con control de acceso y cifrado administrado. Nunca Git, el disco efímero de Render ni el mismo clúster como única copia. |
| Número de copias        | Mínimo tres: producción, respaldo administrado y copia externa cifrada. Deben existir en al menos dos medios y una ubicación separada.                                                                                                   |
| Alerta de fallos        | Alertas de Atlas para retraso o fallo de snapshots y notificaciones de fallo del workflow de GitHub Actions al equipo administrador. Una alerta no sustituye la revisión del informe.                                                    |
| Restauración productiva | Manual, aprobada y ejecutada por una persona autorizada. El restaurador del repositorio solo acepta una base nueva y desechable.                                                                                                         |

Además de los snapshots administrados por Atlas, el repositorio ejecuta el
workflow **Respaldo cifrado diario de MongoDB** a las 02:00 hora de Colombia.
Genera un `.tgbackup` con AES-256-GCM, conserva el manifiesto y lo publica como
artefacto externo durante 35 días. El job requiere los secretos
`PROD_MONGO_URI`, `PROD_MONGO_DB_NAME` y `PROD_BACKUP_PASSPHRASE`; si falta
cualquiera, falla sin tocar la base de producción. Este artefacto es una copia
de contingencia y no sustituye Atlas ni la copia externa de objetos definida
arriba.

## Prueba de restauración

La prueba reproducible se ejecuta con **Prueba manual de restauración MongoDB**
(`.github/workflows/mongodb-restore-drill.yml`). El job:

1. copia la base completa con `mongodump`;
2. restaura en una base cuyo nombre identifica que es de prueba;
3. compara usuarios, productos, pedidos, movimientos, índices y el bucket
   GridFS `media` cuando se usa el respaldo cifrado;
4. publica únicamente el manifiesto y el informe, nunca el volcado de datos.

El comando exige `RESTORE_TO_DRILL_ONLY` y `TARGET_DISPOSABLE=YES`. El destino
se elimina únicamente mediante `--drop` dentro de esa base desechable. La
restauración productiva no se ejecuta desde CI ni desde Render.

## Última restauración comprobada

La prueba de aplicación está automatizada en la suite de integración: genera un
`.tgbackup`, comprueba que una clave incorrecta sea rechazada, descifra el
archivo, restaura una base temporal y verifica usuarios, productos, órdenes,
movimientos, GridFS e índices.

La fecha de la última restauración de **producción** debe registrarse aquí tras
ejecutar el workflow manual con los secretos autorizados:

```text
Última restauración de producción comprobada: PENDIENTE DE EJECUTAR
Evidencia: artefacto mongodb-restore-drill-<run_id>
Resultado requerido: passed: true
```

No se debe marcar como comprobada una copia que solo fue descargada o cuyo
archivo no se restauró en una base aislada.
