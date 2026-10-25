# Reparto de personas y tareas — Arqueo

Asignación propuesta según los roles y requisitos de `AGENTS.md`, considerando la experiencia indicada por el equipo.

| Persona | Letra / rol | Rama de trabajo | Responsabilidad |
|---|---|---|---|
| DavidB | B | `b/R#-tema` | Cuenta Stellar, pagos y scripts de demo; experiencia alta y dueño del camino crítico. |
| Jesús | D | `d/R#-tema` | Producto, matriz de controles, documentación y entrega. |
| Carlos | A | `a/R#-tema` | Contratos Rust/Soroban y `control-policy`; dividir en tareas pequeñas y coordinar la integración con B. |
| DavidP | C | `c/R#-tema` | Interfaz de pagos, auditoría y configuración; dividir en tareas pequeñas. |

## Features del MVP

Las ramas siguen el formato `<letra>/<R#>-<tema>` de `AGENTS.md`. Cada requisito se trabaja en una rama propia y se integra mediante PR revisado por otra persona.

| Requisito | Feature | Responsable |
|---|---|---|
| R1 | Cerrar la matriz de controles y autorizar proveedores | Jesús (D) |
| R2 | Configurar testnet y verificar lectura del saldo | DavidB (B) |
| R3 | Crear la cuenta de empresa y añadir firmantes | DavidB (B) |
| R4 | Regla ordinary y primer pago de employee | DavidB (B) |
| R5 | Crear, probar y desplegar `control-policy` | Carlos (A) |
| R6 | Instalar la política en ordinary y large | Carlos (A) + DavidB (B) |
| R7 | Regla large y pago con multifirma | DavidB (B) |
| R8 | Pantalla de pago y resultado visible | DavidP (C) |
| R9 | Vista de auditoría mínima | DavidP (C) |
| R10 | README, LICENSE, vídeo, deck y envío | Jesús (D) |
| R11 | Exportación CSV del auditor | DavidP (C) |
| R12 | Mensajes de error legibles | Carlos (A) + DavidP (C) |
| R13 | Mostrar firmantes y regla aplicada en auditoría | DavidP (C) |
| R14 | Script reproducible de la demo | DavidB (B) |
| R15 | Publicar la app con aviso de testnet | DavidP (C) |
| R16 | Diagrama de arquitectura | Jesús (D) |
| R17 | Configuración de proveedores y límites | DavidB (B) + DavidP (C) |

## Orden de trabajo

1. Confirmar el estado real de R2–R5 y completar lo pendiente: son dependencias del flujo de pagos.
2. Integrar R6 y R7 para que las políticas bloqueen pagos no autorizados y exijan la segunda firma en pagos grandes.
3. Completar R8 y R9 para demostrar los flujos desde la app; continuar con R11–R13 para cerrar la auditoría.
4. Completar R14–R17 y la entrega R10 según las prioridades y controles horarios de `AGENTS.md`.

Las casillas de `AGENTS.md` son la fuente del estado: este reparto asigna responsables, pero no marca requisitos como terminados.
