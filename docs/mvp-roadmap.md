# Roadmap del MVP de Arqueo

> Las funcionalidades en detalle están en [mvp-features.md](mvp-features.md).

> Fuente de verdad del orden de trabajo. Los requisitos (R#) y sus niveles vienen de `AGENTS.md` §7; aquí se fija el **orden de ataque**, los **plazos** y el reparto de ramas.
> Si algo de aquí contradice `AGENTS.md`, manda `AGENTS.md` (§10, regla 10).
> Todas las horas son **hora de Lisboa** (UTC+0 desde el 25-oct). Madrid/CET va una hora por delante.

## 1. Objetivo

El MVP está terminado cuando las 4 escenas del `AGENTS.md` §2 funcionan en testnet de principio a fin:

1. Pago **por debajo del máximo por pago** a un proveedor autorizado → pasa con la firma del empleado.
2. Pago **por encima del máximo por pago** → rechazado con una sola firma; aceptado con la del responsable.
3. Pago a una cuenta **que no está en la lista de proveedores** → rechazado por las reglas de la cuenta.
4. El auditor ve todos los pagos (también los rechazados) y descarga un CSV.

Los límites los fija el admin (`AGENTS.md` §3.1). Con los valores por defecto, la demo usa 200, 800 y 100 XLM (`app/src/controls/defaults.ts`).

Controles de `AGENTS.md` §8: **14:00** pago real desde la smart account (R4). **20:00** las 4 escenas funcionan y se congelan las funcionalidades. **11:30** enviado.

## 2. Calendario desde ahora

Ventana: **domingo 25-oct 13:00 → lunes 26-oct 12:00** (23 h). Estado a las 13:00: **ningún R# tiene commits de código**. Las 4 ramas de trabajo están a 0 commits sobre `develop` y nada está subido a `origin` salvo la documentación.

**Control de 14:00 en riesgo.** Llegar a un pago real a las 14:00 exige R2, R3 y R4 seguidos, y ahora son las 13:00. El plan B de `AGENTS.md` §8 (quitar `control-policy` y usar solo políticas de OpenZeppelin) se decide **a las 14:00**. Si se activa, R5 y R6 se quitan del camino crítico y se recortan de P0 a P1.

### Hitos (hora de Lisboa)

| Hora | Hito | Cómo se comprueba |
|---|---|---|
| **Dom 14:00** | Decisión sobre plan B (ver arriba) | Reunión de 5 min, decisión anotada en §11 de `AGENTS.md` |
| **Dom 15:00** | R2 mergeado en `develop`: la app lee un saldo de testnet | Saldo visible en la app |
| **Dom 16:00** | R3: cuenta de empresa con firmantes y saldo | Dirección `C…` en stellar.expert |
| **Dom 18:00** | R5 desplegado en testnet · R8 contra `mocks.ts` | ID del contrato y `cargo test` en verde · pantalla de pago |
| **Dom 18:30** | R4: primer pago firmado solo por employee | Hash en testnet |
| **Dom 20:00** | **Congelación.** Escenas 1 y 3 pasan en la app; escena 2 pasa o se recorta | Las 4 escenas con estado claro en §5 de `mvp-features.md` |
| **Dom 22:00** | R9: vista del auditor | Tabla con pagos y rechazos |
| **Lun 00:30** | R14: script de demo reproducible | Un comando crea cuenta, firmantes, reglas y proveedores |
| **Lun 02:00** | Grabación de reserva hecha · R17 cortado si no está listo | Vídeo de reserva en el repo o en local |
| **Lun 07:00–10:30** | Turnos de sueño y pulido. Vídeo final a las 09:00 | — |
| **Lun 10:30** | Deck y respuestas del formulario listos | Borradores completos |
| **Lun 11:30** | **Enviado.** Enlaces probados en ventana privada | Confirmación del formulario |
| **Lun 12:00** | Límite real de entrega | — |

### Tabla por requisito

Límite = fecha y hora en la que el requisito tiene que estar mergeado en `develop` (o desplegado, si es de contrato).

| # | Req | Qué | Dueño | Límite | Desbloquea |
|---|---|---|---|---|---|
| 1 | R2 | Scaffold Stellar, `smart-account-kit` 0.6.0 exacto, polyfills de Vite (`Buffer`), `.env.local`, saldo testnet. Incluye `src/lib/stellar.ts` (tipos §6.1 con stubs) y `src/lib/mocks.ts` | David | **Dom 15:00** | Todo lo demás |
| 2 | R5 | `control-policy` en Rust: `ControlParams`, errores 1/2/3, `enforce`, `install`/`uninstall`. Tests: pasa · proveedor desconocido · importe excesivo. Despliegue en testnet | Jesús | Tests **Dom 17:30** · desplegado **Dom 18:00** | R6, escena 3 |
| 3 | R8 | Pantalla de pago (proveedor, importe, concepto), selector de rol, resultado con enlace o motivo. Contra `mocks.ts` | Carlos | **Dom 18:00** (contra `mocks.ts`) · **Dom 20:00** (contra `stellar.ts` real) | Escenas 1-3 en la UI |
| 4 | R1 + R10 (base) | `docs/controls-matrix.md`, README esqueleto (aviso testnet only, clave derivada de semilla pública, passkeys en producción), LICENSE Apache-2.0, `.gitignore` | DavidP | **Dom 17:00** | R10, R16 |
| 5 | R3 | Cuenta de empresa con passkey del admin, firmantes employee (Ed25519) y manager (passkey), saldo | David | **Dom 16:00** | R4, R7 |
| 6 | R4 | Regla `ordinary` (umbral 1 + `spending_limit`) y primer pago con `multiSigners`. Registrar rechazos en el registro local | David | **Dom 18:30** | Control de AGENTS §8 (ver arriba) |
| 7 | R6 | Instalar `control-policy` en `ordinary` y `large` (`xdr.ScVal`) | David + Jesús | **Dom 19:00** | Escena 3 |
| 8 | R7 | Regla `large` (umbral 2) y pago multifirma | David | **Dom 19:30** | Escena 2 |
| 9 | R9 | Vista de auditor mínima | DavidP | **Dom 22:00** | Escena 4 |
| 10 | R12 | Errores legibles (§6.3 de `AGENTS.md`) | Jesús + Carlos | **Dom 22:30** | UX |
| 11 | R11, R13 | CSV del auditor; firmantes y regla aplicada en la vista | DavidP / Carlos | **Lun 23:30** | Escena 4 completa |
| 12 | R14 | Script de demo reproducible (cuenta nueva por ensayo) | David | **Lun 00:30** | Grabación |
| 13 | R15, R16 | Publicación con aviso «testnet only»; diagrama de arquitectura | Carlos / DavidP | **Lun 01:00** (R15) · **01:30** (R16) | Entrega |
| 14 | R17 | Pantalla de configuración (proveedores y límites), con firma del admin | David + Carlos | **Lun 02:00** (P1, se corta si no está) | P1 final |
| 15 | R10 (final) | Vídeo (09:00), deck (10:00), respuestas del formulario (10:30), envío (11:30) | Jesús (+ todos) | **Lun 11:30** | Entrega |

Huecos que no estaban en `AGENTS.md` §7 y se han incorporado:

- Configuración de Vite para los polyfills del SDK de Stellar, dentro del #1.
- Registro local de rechazos (`AGENTS.md` §6.1 lo exige y R13 lo da por hecho), dentro del #6 y del #8.

P2 (R18–R22) queda fuera hasta la congelación de las 20:00.

## 3. Ramas iniciales

Formato `<persona>/<R#>-<tema>` (`AGENTS.md` §9). Todas salen de `develop`. Ninguna se ha subido a `origin` todavía.

| Rama | Persona | Contenido | Orden de merge |
|---|---|---|---|
| `b/R2-scaffold-testnet` | David | #1 | **1.º**: las ramas de app dependen del scaffold |
| `a/R5-control-policy` | Jesús | #2 (crate dentro del workspace que crea el scaffold) | 2.º |
| `c/R8-payment-screen` | Carlos | #3 contra `mocks.ts` | 3.º |
| `d/R1-docs-base` | DavidP | #4 | cuando esté listo |

Los merges los hace David (revisión cruzada, `AGENTS.md` §9). Cada PR lleva: R# · qué cambia · cómo probarlo · qué falta · decisiones tomadas.

## 4. Dependencias

- `c/R8` y `d/R1` necesitan que el scaffold de `b/R2` esté en `develop`. Hasta entonces, Carlos puede preparar componentes en local sin ejecutar la app.
- `a/R5` crea su crate dentro del workspace de Scaffold. Si mergea antes que el scaffold, habrá conflicto en `Cargo.toml`: el merge del scaffold va primero.
- `R6` (instalar la política) necesita el ID del contrato de `a/R5` y las direcciones de cuenta de `b/R2`/R3.

## 5. Decisiones pendientes

Estas decisiones no están cerradas por el equipo. Se marcan como propuestas de Claude.

1. **Roles (`AGENTS.md` §5):** la propuesta asigna Jesús = A (contratos), Carlos = C (app y auditoría) y DavidP = D (producto y entrega). Pero `AGENTS.md` §5 pone a Jesús como D (producto y entrega). Hay que confirmarlo y corregir la tabla o §11.
2. **Plan B a las 14:00:** quitar `control-policy` y usar solo políticas de OpenZeppelin, como indica `AGENTS.md` §8. Lo decide el equipo a esa hora.
3. **Idioma de este documento:** está en español, como `AGENTS.md`, por ser documentación interna. Si el equipo prefiere inglés (§ idioma de `AGENTS.md`, que pide inglés en lo que va al producto), se traduce.
4. **Ubicación:** este documento vive en `docs/`, que es de D. Si D prefiere no tocar `docs/` para esto, se mueve.

## 6. Verificación del progreso y regla de retraso

- Cada R# se marca como hecho en el mismo PR que lo termina (`AGENTS.md` §7).
- **Si un hito se pasa en más de 30 minutos**, el equipo recorta el P1 que vaya después en la tabla (`AGENTS.md` §8). El P0 no se alarga.
- Ningún P0 pasa de las **20:00** del domingo: a esa hora se congela todo (`AGENTS.md` §8).
- Revisión al cierre de cada hito: qué ramas están mergeadas (`git branch -r --merged origin/develop`) y qué hito sigue abierto.
- Estado de las 4 ramas: `git branch --list '*/R*' -v`.
