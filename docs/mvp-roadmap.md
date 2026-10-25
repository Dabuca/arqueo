# Roadmap del MVP de Arqueo

> Las funcionalidades en detalle están en [mvp-features.md](mvp-features.md).

> Fuente de verdad del orden de trabajo. Los requisitos (R#) y sus niveles vienen de `AGENTS.md` §7; aquí se fija el **orden de ataque** y el reparto de ramas.
> Si algo de aquí contradice `AGENTS.md`, manda `AGENTS.md` (§10, regla 10).

## 1. Objetivo

El MVP está terminado cuando las 4 escenas del `AGENTS.md` §2 funcionan en testnet de principio a fin:

1. Pago de **200** a un proveedor autorizado → pasa con la firma del empleado.
2. Pago de **2.000** → rechazado con una sola firma; aceptado con la del responsable.
3. Pago de **100** a una cuenta desconocida → rechazado por las reglas de la cuenta.
4. El auditor ve todos los pagos (también los rechazados) y descarga un CSV.

Control de tiempo: **14:00** pago real desde la smart account (R4). **20:00** las 4 escenas funcionan y se congelan las funcionalidades.

## 2. Orden de ataque

Ordenado por **camino crítico**: primero lo que desbloquea a más personas.

| # | Req | Qué | Dueño | Dificultad | Desbloquea |
|---|---|---|---|---|---|
| 1 | R2 | Scaffold Stellar, `smart-account-kit` 0.6.0 exacto, polyfills de Vite (`Buffer`), `.env.local`, saldo testnet. Incluye `src/lib/stellar.ts` (tipos §6.1 con stubs) y `src/lib/mocks.ts` | David | Alta | Todo lo demás |
| 2 | R5 | `control-policy` en Rust: `ControlParams`, errores 1/2/3, `enforce`, `install`/`uninstall`. Tests: pasa · proveedor desconocido · importe excesivo. Despliegue en testnet | Jesús | Media-alta | R6, escena 3 |
| 3 | R8 | Pantalla de pago (proveedor, importe, concepto), selector de rol, resultado con enlace o motivo. Contra `mocks.ts` | Carlos | Baja-media | Escenas 1-3 en la UI |
| 4 | R1 + R10 (base) | `docs/controls-matrix.md`, README esqueleto (aviso testnet only, clave derivada de semilla pública, passkeys en producción), LICENSE Apache-2.0, `.gitignore` | DavidP | Baja | R10, R16 |
| 5 | R3 | Cuenta de empresa con passkey del admin, firmantes employee (Ed25519) y manager (passkey), saldo | David | Alta | R4, R7 |
| 6 | R4 | Regla `ordinary` (umbral 1 + `spending_limit`) y primer pago con `multiSigners`. Registrar rechazos en el registro local | David | Alta | **Control 14:00** |
| 7 | R6 | Instalar `control-policy` en `ordinary` y `large` (`xdr.ScVal`) | David + Jesús | Alta | Escena 3 |
| 8 | R7 | Regla `large` (umbral 2) y pago multifirma | David | Alta | Escena 2 |
| 9 | R9 | Vista de auditor mínima | DavidP | Baja | Escena 4 |
| 10 | R12 | Errores legibles (§6.3 de `AGENTS.md`) | Jesús + Carlos | Baja | UX |
| 11 | R11, R13 | CSV del auditor; firmantes y regla aplicada en la vista | DavidP / Carlos | Baja | Escena 4 completa |
| 12 | R14 | Script de demo reproducible (cuenta nueva por ensayo) | David | Media | Grabación |
| 13 | R15, R16 | Publicación con aviso «testnet only»; diagrama de arquitectura | Carlos / DavidP | Baja-media | Entrega |
| 14 | R17 | Pantalla de configuración (proveedores y límites), con firma del admin | David + Carlos | Media | P1 final |
| 15 | R10 (final) | Vídeo, deck, respuestas del formulario, envío antes de 11:30 | Jesús (+ todos) | — | Entrega |

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

1. **Roles (`AGENTS.md` §5):** la propuesta asigna Jesús = A (contratos), Carlos = C (app y auditoría) y DavidP = D (producto y entrega). La guía no tiene nombres para A y C. Hay que confirmarlo y añadir la fila en §11.
2. **Idioma de este documento:** está en español, como `AGENTS.md`, por ser documentación interna. Si el equipo prefiere inglés (§ idioma de `AGENTS.md`, que pide inglés en lo que va al producto), se traduce.
3. **Ubicación:** este documento vive en `docs/`, que es de D. Si D prefiere no tocar `docs/` para esto, se mueve.

## 6. Verificación del progreso

- Cada R# se marca como hecho en el mismo PR que lo termina (`AGENTS.md` §7).
- Si un P0 no llega a su control, se recorta un P1; el P0 no se alarga (`AGENTS.md` §8).
- Estado de las 4 ramas: `git branch --list '*/R*' -v`.
