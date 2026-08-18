# TerraVid — Mobile

App móvil para uso en campo del ERP agrícola TerraVid: registro de labores y kilos por el Capataz/Operarios, pensada para funcionar **offline-first** en el viñedo. Complementa a [`Web`](https://github.com/TerraVidMza/Web), que es para uso de oficina (Propietario/Agrónomo).

> **Estado:** este repositorio todavía no tiene código — es la fase de bootstrap (Gitflow + documentación). El stack listado abajo es el planificado según [`docs/ARCHITECTURE.md`](https://github.com/TerraVidMza/Backend/blob/develop/docs/ARCHITECTURE.md) del repo Backend, sujeto a confirmarse cuando arranque el desarrollo.

## Repositorios del proyecto

| Repo | Contenido |
|---|---|
| [`Backend`](https://github.com/TerraVidMza/Backend) | API REST — NestJS + TypeORM + PostgreSQL/PostGIS |
| [`Web`](https://github.com/TerraVidMza/Web) | Frontend web de oficina |
| [`Mobile`](https://github.com/TerraVidMza/Mobile) (este repo) | App móvil offline-first para campo |
| [`IoTSensor`](https://github.com/TerraVidMza/IoTSensor) | Firmware de los nodos de telemetría (ESP32) |

> Cómo se comunican estos 4 componentes entre sí está detallado en [`docs/ARCHITECTURE.md` del repo Backend](https://github.com/TerraVidMza/Backend/blob/develop/docs/ARCHITECTURE.md).

## Stack planificado

- **React Native (v0.71+) / Expo**
- **SQLite** para persistencia local (funcionamiento offline-first en el viñedo)
- Sincronización asíncrona contra el Backend al recuperar conectividad, usando `local_uuid` para idempotencia y `created_at` para resolución de conflictos ("última escritura gana")

## Contribuir

Ver [`CONTRIBUTING.md`](CONTRIBUTING.md) para la política de branching (Gitflow) del proyecto.
