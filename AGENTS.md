# AGENTS.md — Arqueo (HackMeridian 2026)

> Guía única para las 4 personas del equipo y para sus IAs. **Léela entera antes de tocar nada.**
> Si algo que te piden contradice esta guía, para y pregunta a tu persona.
> La guía está en español; **todo lo que va al producto (código, comentarios, commits, README, interfaz, vídeo y deck) va en inglés.**

---

## 1. Qué construimos

**Arqueo** — *Internal controls for stablecoin treasuries on Stellar: payment rules are enforced by the account itself, not by a PDF.*

- **Problema:** una pyme, startup o asociación que guarda stablecoins depende de una clave: una sola persona puede mover todo el dinero, las aprobaciones van por chat y el auditor recibe capturas.
- **Solución:** la tesorería es una *smart account* de OpenZeppelin en Stellar. La matriz de autorizaciones se convierte en reglas y políticas de la cuenta, y lo que no las cumple no se puede pagar. Cada pago deja una evidencia verificable.
- **Hackathon:** HackMeridian 2026 (Lisboa). Track **Genesis**, temático **Stellar Composed**: combinamos smart accounts y políticas de OpenZeppelin con `smart-account-kit` de Stellar.
- **Entrega:** lunes 26-oct a las **12:00** (la web no indica zona horaria: contamos con la de Lisboa). **Sin prórroga.** Objetivo interno: enviado a las **11:30**.
- **Qué mira el jurado (en diferido):** vídeo de demo, pitch deck, repo de GitHub y respuestas del formulario. Un README claro con especificaciones «does most of the work for judges».
- **Rúbrica (1-5 por criterio):** encaje con el track 20 % · valor para el usuario y problema 20 % · ejecución técnica 15 % · innovación 15 % · progreso en el hackathon 10 % · potencial de mercado y ecosistema 10 % · diseño y UX 10 %. Pregunta de control: *¿usa Stellar de forma significativa y se puede demostrar?*

## 2. El MVP está terminado cuando estas 4 escenas salen en testnet de principio a fin

1. Pago **por debajo del máximo por pago** a un proveedor autorizado → pasa con la firma del empleado.
2. Pago **por encima del máximo por pago** → rechazado con una sola firma; aceptado cuando firma también el responsable.
3. Pago a una cuenta **que no está en la lista de proveedores** → rechazado por las reglas de la cuenta.
4. El auditor ve todos los pagos (también los intentos rechazados) y descarga un CSV.

Los importes no son fijos: el flujo depende de los límites que fije el admin (§3). Con los valores por defecto (máximo 500 por pago, tope 1.000 cada 30 días), el vídeo puede usar, por ejemplo, 200, 800 y 100. El importe de la escena 2 tiene que superar el máximo por pago **sin superar el tope de 30 días**; si no, el rechazo podría venir del tope y no se vería el mensaje de «manager approval required».

Precisión para el pitch: el rechazo ocurre al simular la transacción contra las reglas de la cuenta; si se enviara igualmente, la red la rechazaría.

## 3. Matriz de controles (la estructura la cambia solo D; los importes y proveedores los fija el admin)

| Rol | Firma con | Qué hace |
|---|---|---|
| `admin` | passkey | crea la cuenta, las reglas y los firmantes; fija y cambia en cualquier momento los límites y los proveedores (§3.1) |
| `employee` | clave Ed25519 de testnet guardada en el navegador (atajo de demo) | pagos ordinarios |
| `manager` | passkey | segunda firma de los pagos grandes |
| `auditor` | nada (solo lectura) | ve los pagos y exporta CSV |

| Regla | Contexto | Firmantes | Políticas |
|---|---|---|---|
| `admin` | default | admin | ninguna (sin políticas se exige a todos los firmantes) |
| `ordinary` | llamadas al contrato del token | employee | umbral 1 · `control-policy` {proveedores, máximo por pago (por defecto 500)} · tope de gasto cada 30 días (por defecto 1.000; ver §3.1) |
| `large` | llamadas al contrato del token | employee + manager | umbral 2 · `control-policy` {proveedores, sin máximo} |

- **Proveedores autorizados:** los fija el admin. Cada uno puede ser una cuenta de demo generada en testnet o la dirección real que introduzca el admin. Tiene que existir en testnet (con fondos de Friendbot); si no, el pago fallaría por otra causa y no por la regla. La cuenta desconocida de la escena 3 también tiene que existir, pero fuera de la lista. Los de la demo los crea `scripts/` (R14).
- **Token del MVP:** XLM nativo de testnet a través de su contrato de activo (SAC). **Importes en la unidad mínima: 1 XLM = 10.000.000 stroops.** USDC de testnet es un extra (R18).
- **Ojo con OpenZeppelin:** sin políticas, una regla exige a todos sus firmantes; con políticas, son ellas las que deciden si bastan las firmas presentes. **Toda regla con políticas lleva una de umbral.** Máximo 15 firmantes y 5 políticas por regla.
- La app elige la regla según quién firma: `['employee']` → `ordinary`; `['employee', 'manager']` → `large`.
- En producción cada persona firmaría con su passkey en su dispositivo; las claves en el navegador son solo para la demo. Decidlo en el README y en el pitch.

### 3.1 Cambios de límites y proveedores

- Solo el admin, en cualquier momento, desde la pantalla de ajustes (R17) y con su passkey. Los cambios de reglas solo los autoriza la regla `admin`: el employee y el manager no pueden tocar límites ni proveedores.
- Nada se actualiza en sitio: cada cambio **da de baja** la regla o política vieja y **da de alta** la nueva.
- Nunca puede haber un momento en que `ordinary` acepte pagos sin sus controles. Si hay que elegir, la cuenta queda cerrada (nadie paga) mientras dura el cambio, nunca abierta.
- La app busca las reglas por nombre, no por ID: cada alta crea un ID nuevo.
- Ajustes **nunca** toca la regla `admin`: sin ella la cuenta queda bloqueada para siempre.
- Todo cambio en Ajustes (máximo por pago, tope o proveedores) deja rastro para el auditor: qué cambió, valor anterior y nuevo, y hash de las transacciones.
- **Tope de 30 días:**
  - Se puede cambiar, pero **conserva lo gastado y el inicio del periodo**. Ejemplo: llevas 500 gastados de 1.000 y lo subes a 1.500 → te quedan 1.000.
  - **Nunca puede fijarse por debajo de lo ya gastado**: ese cambio se rechaza.
  - Cada cambio deja rastro auditable: tope anterior, tope nuevo, gastado en ese momento, inicio del periodo y hash de las transacciones de baja y de alta. El auditor lo ve.
- **Pendiente de acuerdo con A (Carlos) y B (DavidB):** la `spending_limit` de OpenZeppelin no cumple lo anterior (al reinstalarla empieza de cero), así que el tope tendría que pasar a `control-policy`, guardando lo gastado por cuenta y comprobando en la cadena que el tope nuevo no baje de lo gastado (error nuevo 4). Afecta a §6.2 y a R4. Falta decidir si entra en R5 (P0) o en R17 (P1, con el tope de OpenZeppelin fijo hasta entonces).

## 4. Stack (versiones fijadas: no se actualiza nada durante el evento)

- **Red:** Stellar **testnet** únicamente.
- **Contratos:** Rust + `soroban-sdk` (la versión que pida la librería de OpenZeppelin, fijada en `Cargo.toml`) + **OpenZeppelin Stellar Contracts** (smart account y políticas `simple_threshold`, `weighted_threshold` y `spending_limit`). Nuestro contrato propio: `contracts/control-policy`.
- **Cliente:** **`smart-account-kit` 0.6.0** (repo `stellar/smart-account-kit`), versión exacta y sin `^`, + `@stellar/stellar-sdk`. Las direcciones de testnet (WASM de la cuenta y verificadores WebAuthn y Ed25519) salen de su `demo/.env.example`.
- **App:** React + Vite + TypeScript con **Scaffold Stellar**.
- **Explorador:** stellar.expert (testnet).
- **Publicación de la app (P1):** Vercel o GitHub Pages, con aviso «testnet only».
- **Aviso del kit:** su desplegador por defecto usa una clave derivada de una semilla pública; solo vale en testnet. Ponedlo en el README.

## 5. Equipo, IAs y propiedad del código

| Persona | Rol | IA | Dueña de |
|---|---|---|---|
| A — `<nombre>` | Contratos (Rust/Soroban) | `<IA>` | `contracts/` |
| B — `<nombre>` | Cuenta y pagos (camino crítico) | `<IA>` | `src/lib/`, `scripts/` |
| C — `<nombre>` | App y auditoría | `<IA>` | `src/pages/`, `src/components/`, `src/styles/` |
| D — Jesús | Producto y entrega | `<IA>` | `README.md`, `docs/`, `AGENTS.md`, `src/controls/` |

- Cada carpeta tiene una dueña. **Una IA no edita fuera de la carpeta de su persona**, salvo un arreglo mínimo que se explica en el PR.
- `packages/` lo genera Scaffold Stellar: **no se edita a mano**; se regenera con `stellar scaffold build`.
- La plantilla de Scaffold Stellar la crea **B una sola vez** en F0 y la sube en el primer PR; el resto clona y trabaja encima.

```
contracts/control-policy/    A · política propia + tests
packages/                    generado por Scaffold Stellar (no tocar)
src/lib/stellar.ts           B · ÚNICA puerta a la red: toda llamada a Stellar pasa por aquí
src/lib/mocks.ts             B · versión simulada de stellar.ts para que C no espere
src/pages/  src/components/  C · Payments, Auditor, Settings y selector de rol
src/controls/                D · la matriz de controles como código (R1): límites, proveedores, regla según importe, rastro de cambios. Sin red: no llama a Stellar
scripts/                     B · alta de cuenta, firmantes, reglas y proveedores (demo reproducible)
docs/                        D · diagrama, guion del vídeo, matriz de controles
README.md                    D
```

En el scaffold, las rutas `src/…` de esta sección cuelgan de `app/src/` (por ejemplo, `app/src/lib/stellar.ts`).

## 6. Interfaces entre personas (no se cambian sin acuerdo de los afectados)

### 6.1 `src/lib/stellar.ts` (B → C)

```ts
export type Role = 'admin' | 'employee' | 'manager' | 'auditor';
export type RuleName = 'ordinary' | 'large';

export interface Payment {
  to: string;          // dirección G...
  amount: number;      // en XLM; stellar.ts convierte a stroops
  concept: string;
  signers: Role[];     // ['employee'] o ['employee', 'manager']
  rule: RuleName;
  status: 'ok' | 'rejected';
  hash?: string;       // solo si status = 'ok'
  reason?: string;     // solo si status = 'rejected' (mensaje en inglés, ver 6.3)
  at: string;          // fecha ISO
}

export function createCompanyAccount(): Promise<{ address: string }>;
export function getBalance(): Promise<number>; // en XLM
export function pay(p: { to: string; amount: number; concept: string; signers: Role[] }):
  Promise<{ ok: true; hash: string } | { ok: false; reason: string }>;
export function listPayments(): Promise<Payment[]>; // MVP: registro local + hash; P1: reconstruido desde la cadena
```

- `mocks.ts` exporta exactamente lo mismo con datos falsos. C trabaja contra `mocks.ts` hasta que B avise de que lo real está listo.
- Un rechazo **no lanza excepción**: devuelve `{ ok: false, reason }` y se guarda en el registro.

### 6.2 `control-policy` (A → B)

- **Parámetros de instalación** (por cuenta y por regla): `ControlParams { allowlist: Vec<Address>, max_per_payment: Option<i128> }`. Importe en stroops; `None` = sin máximo.
- **Errores:** `SupplierNotAllowed = 1` · `AmountOverLimit = 2` · `NotATransfer = 3`.
- **`enforce`:** si la llamada es `transfer(from, to, amount)`, `to` tiene que estar en `allowlist` y `amount` no puede pasar de `max_per_payment` (si lo hay). Cualquier otra función → `NotATransfer`.
- **Normas de OpenZeppelin para políticas con estado:** guardar los datos por (smart account, id de regla) y llamar a `require_auth` de la cuenta en `install`, `enforce` y `uninstall`. Copiad el patrón de su `spending_limit`.
- **A entrega a B:** ID del contrato en testnet, formato exacto de los parámetros como `xdr.ScVal` y esta tabla de errores.

### 6.3 Mensajes de rechazo (B ↔ C)

| Código | Mensaje en la app |
|---|---|
| 1 | Supplier not authorized |
| 2 | Amount exceeds the per-payment limit: manager approval required |
| 3 | Operation not allowed by the account rules |
| otro | Rejected by the account rules (error original en un desplegable «Details») |

### 6.4 `src/controls/` — la matriz de controles como código (D → B, C)

TypeScript puro y probado (`npm test --workspace app`). **No llama a la red**: lo que necesita de Stellar llega inyectado y lo implementa B en `stellar.ts`. Importes en XLM salvo donde dice stroops. Guía detallada: `app/src/controls/README.md`.

| Módulo | Qué exporta | Quién lo usa |
|---|---|---|
| `types.ts` | `Limits`, `Supplier`, `ControlsConfig`, `ControlChange`, `CheckResult`; reexporta `Role` y `RuleName` de `stellar.ts` (una sola definición) | todos |
| `defaults.ts` | `DEFAULT_LIMITS` (500 por pago, 1.000 cada 30 días), `DEFAULT_CONFIG`, `DEMO_AMOUNTS` (200 / 800 / 100) | B (alta de reglas, R14), C (pantallas) |
| `units.ts` | `xlmToStroops` (exacto, bigint), `stroopsToXlm`, `roundToStroops` (solo para comparar) | B al construir pagos y parámetros |
| `rules.ts` | `signersFor(rule)`, `ruleForSigners(signers)`, `requiredRule(amount, limits, spentInPeriod)` | C (aviso «Needs manager approval»), B |
| `validation.ts` | `looksLikeStellarAddress`, `isSupplier`, `validateLimitsChange(next, spentInPeriod)` | Ajustes (R17) |
| `params.ts` | `toControlParams(config, rule)` → `{ allowlist, maxPerPayment: bigint \| null }`, que encaja con `ControlParams` de §6.2 | B, para convertirlo a `xdr.ScVal` (R6, R17) |
| `suppliers.ts` | `SupplierDeps`, `addRealSupplier`, `addDemoSupplier`, `removeSupplier`, `createOutsiderAccount` | Ajustes (R17), script de demo (R14) |
| `changeLog.ts` | `createChangeLog(storage?)` → `record` / `list` / `clear`; `changesToCsv` | Ajustes (R17) escribe, auditor (R9, R13) lee |

Reglas:
- `requiredRule` es solo una pista para la interfaz. Quien decide es la cuenta en la cadena, y la app tiene que dejar intentar el pago solo con employee (escena 2).
- **Pendiente para B (R17):** implementar `SupplierDeps` en `stellar.ts` (`isValidAddress`, `accountExists`, `createFundedAccount`). Es una ampliación de §6.1: se acuerda en el PR.
- Para el auditor, cada cambio de Ajustes se registra con `record(...)` **después** de tener los hashes de baja y alta. En los cambios del tope, con `spentAtChange` y `periodStart`.
- No dupliques aquí lógica de `stellar.ts` ni al revés. Si necesitas algo nuevo en `src/controls/`, pídeselo a D.

## 7. Requisitos

P0 bloquea la demo · P1 completa el MVP · P2 solo si sobra tiempo. **Marcad la casilla en el mismo PR que termina el requisito.**

### P0 — bloqueantes, en orden de dependencia

- [x] **R1 [D]** Matriz de controles cerrada (§3 y §3.1: límites y proveedores los fija el admin, con valores por defecto para la demo) y programada en `src/controls/` (§6.4). *Antes de las 10:30.*
- [x] **R2 [B]** Testnet listo: kit configurado con las direcciones de `demo/.env.example` (incluido el verificador Ed25519), cuentas con fondos de Friendbot y token = XLM. *Hecho = la app lee un saldo de testnet.*
- [x] **R3 [B]** Cuenta de empresa creada con la passkey del admin, firmantes employee (Ed25519) y manager (passkey), y con saldo. *Hecho = dirección C… visible en stellar.expert.*
- [x] **R4 [B]** Regla `ordinary` (umbral 1 + `spending_limit`) y primer pago firmado solo por employee (ruta `multiSigners` del kit). *Hecho = hash en testnet.* **Control de las 14:00.** Hash: `f7af3add0b4141f5caf9ced34c718e5ba7848265dcdb9fbc9520d7077ee12a8e` (200 XLM a proveedor 3, ledger 5385825).
- [x] **R5 [A]** `control-policy` con tests (pasa · proveedor desconocido · importe excesivo) y desplegada en testnet. *Hecho = ID del contrato y `cargo test` en verde.*
- [x] **R6 [A+B]** Política instalada en `ordinary` y `large` (parámetros como `xdr.ScVal`). *Hecho = la escena 3 se rechaza.* Instalada en `large` (R7) y en `ordinary` (R6). Escena 3 comprobada en testnet: rechazo «Supplier not authorized» (ver `docs/evidence-R6-scene3.md`).
- [x] **R7 [B]** Regla `large` (umbral 2) y pago multifirma. *Hecho = escena 2.* Evidencia en testnet (cuenta de ensayo `CCTSVHF4…`): 800 XLM solo con employee rechazado por máximo por pago (control-policy, error 2); 800 XLM con employee + manager aceptado, hash `03784fdb5d38537fc92f82e30754a942af5204b740b4335937ddd45763f711d2`, ledger 5386036.
- [x] **R8 [C]** Pantalla de pago: proveedor, importe y concepto; selector de rol; resultado con enlace a la transacción o motivo del rechazo. *Hecho = escenas 1-3 sin usar la consola.*
- [x] **R9 [C]** Vista de auditor mínima: importe, destinatario, fecha, estado y enlace.
- [ ] **R10 [D]** Entrega: repo público (el jurado tiene que poder abrirlo; no está verificado qué exige el formulario) con README y LICENSE (propuesta: Apache-2.0), vídeo, deck y respuestas del formulario. *Hecho = enlaces probados en ventana privada y enviado antes de las 11:30.*

### P1 — MVP completo

- [x] **R11 [C]** CSV del auditor.
- [x] **R12 [A+C]** Errores legibles (§6.3).
- [ ] **R13 [C]** El auditor ve también los firmantes y la regla aplicada.
- [ ] **R14 [B]** Script de demo reproducible que crea cuenta, firmantes, reglas y proveedores de una vez. Cada ensayo gasta el tope mensual: cuenta nueva por ensayo.
- [ ] **R15 [C]** App publicada en una URL con aviso «testnet only».
- [ ] **R16 [D]** Diagrama de arquitectura para el README y el deck.
- [ ] **R17 [B+C]** Pantalla de configuración: añadir o quitar proveedores y cambiar límites, con la firma del admin.
- [ ] **R23 [B+C]** Pantalla de pago: muestra cuánto queda del tope de 30 días y por cuánto se supera cuando un rechazo es por tope. Necesita leer el gasto del periodo desde la cadena (depende de la decisión pendiente de §3.1 sobre dónde vive el tope). *Hecho = un rechazo por tope indica restante y exceso.*

### P2 — si sobra tiempo

- [ ] **R18** USDC de testnet en vez de XLM.
- [ ] **R19** GitHub Actions con `cargo test` y `npm run build`.
- [ ] **R20** Passkey del manager en el móvil.
- [ ] **R21** Regla de recuperación 2 de 3.
- [ ] **R22** Cobro del proveedor en su banco a través de un anchor.

## 8. Calendario (hora de Lisboa; desde el 25-oct Lisboa = UTC+0)

| Fase | Cuándo | Objetivo | Control |
|---|---|---|---|
| F0 | dom 9:00-10:30 | repo, tablero, entornos, cuentas de testnet, R1 | — |
| F1 | 10:30-14:00 | R2-R5 | **14:00: pago real desde la smart account.** Si no lo hay, plan B: quitar `control-policy` y usar solo políticas de OpenZeppelin |
| F2 | 14:00-20:00 | R6-R9 y P1 | **20:00: las 4 escenas funcionan. Se congelan las funcionalidades** |
| F3 | 20:00-02:00 | pulido, README, deck, grabación de reserva | dormir por turnos |
| F4 | lun 07:00-10:30 | vídeo final, deck y respuestas | — |
| F5 | lun 10:30-11:30 | enviar | límite real: 12:00 |

**Norma:** si un P0 no llega a su control, se recorta un P1; el P0 no se alarga.

## 9. Git

- Ramas `<persona>/<R#>-<tema>`, por ejemplo `b/R4-first-payment`. **Nada directo a `main`.**
- Un R# por PR, pequeño, revisado por **otra persona** (los cuatro ojos también en el código). El PR dice: R# · qué cambia · cómo probarlo · qué falta · decisiones tomadas.
- Commits en inglés: `feat(R4): first payment from smart account`, `fix(R6): …`, `test(R5): …`, `docs(R10): …`.
- Antes de pedir revisión: `cargo test` si tocas `contracts/`, `npm run build --workspace app` si tocas la app y `npm test --workspace app` si tocas `app/src/controls/` o algo que lo use.
- `.gitignore` con `node_modules/`, `target/`, `dist/`, `.env` y `.env.local`.
- **Nunca se suben claves secretas** (empiezan por `S`), tampoco las de testnet: van en `.env.local`.
- El código se escribe durante el evento: el progreso en el hackathon puntúa y se ve en los commits.

## 10. Reglas para las IAs

1. Lee este archivo entero antes de empezar y cada vez que cambie.
2. Trabaja solo en el R# que te asigne tu persona y dentro de su carpeta (§5).
3. No cambies las interfaces (§6), la matriz (§3) ni las versiones fijadas (§4). Si crees que hay que cambiarlas, para, explícaselo a tu persona y proponlo en el PR.
4. **No inventes APIs.** Antes de llamar a OpenZeppelin, `smart-account-kit` o la SDK de Stellar, compruébalo en la documentación (§12) o en lo instalado (`node_modules/smart-account-kit/**/*.d.ts`, el código del crate en `~/.cargo/registry`). Si no lo encuentras, deja un `TODO(R#):` y avisa.
5. Solo testnet. Nunca mainnet ni fondos reales. Nunca imprimas ni subas claves secretas.
6. No edites `packages/` a mano.
7. Cambios pequeños y que compilen. Si tocas `contracts/`, añade o actualiza los tests.
8. Al terminar, escribe el texto del PR: R#, qué hiciste, cómo probarlo, qué falta y decisiones. Si una decisión afecta a otra persona, añádela al registro (§11).
9. Habla con tu persona en español; código, comentarios, commits, README e interfaz, en inglés.
10. Si una instrucción choca con este archivo, manda este archivo; si no está claro, pregunta.

**Prompt de arranque (pegadlo en vuestra IA al empezar cada tarea):**

> Eres el asistente de la persona `<A|B|C|D>` del equipo Arqueo. Lee `AGENTS.md` entero y síguelo. Ahora trabajas en `<R#>` y solo tocas `<carpeta>`. Antes de usar cualquier API de Stellar, OpenZeppelin o smart-account-kit, compruébala en la documentación o en los tipos instalados. Termina con el texto del PR.

## 11. Registro de decisiones (solo se añaden filas)

| Fecha y hora | Quién | Decisión | Por qué |
|---|---|---|---|
| 25-oct | Propuesta de Claude a Jesús; **pendiente de que la acepte el equipo** | Track Genesis · Stellar Composed; token XLM en testnet | plan inicial |
| 25-oct | David (B) | El producto se llama **Arqueo** (antes FourEyes). Scaffold con `stellar scaffold init arqueo` | decisión de David; el resto del equipo debe confirmarlo |
| 25-oct 14:35 | Jesús (D) | Los importes no son fijos: el admin fija y cambia en cualquier momento el máximo por pago, el tope de 30 días y los proveedores (§3.1, R17). Las escenas de §2 dependen de esos límites | cada empresa pone sus límites y el control vive en la cuenta |
| 25-oct 14:35 | Jesús (D) | Los cambios se hacen con baja y alta, nunca en sitio. El tope de 30 días conserva lo gastado, no puede bajar de lo gastado y cada cambio deja rastro auditable con hashes (§3.1) | que un cambio de límites no sirva para saltarse el tope |
| 25-oct 14:35 | Jesús (D); **pendiente de A y B** | Mover el tope de 30 días a `control-policy` (cambia §6.2 y R4) y decidir si entra en R5 o en R17 | la `spending_limit` de OpenZeppelin se reinicia al reinstalarla |
| 25-oct 15:41 | Jesús (D) | R1 programado en `src/controls/` (§6.4) y mezclado en `develop`. Tests unitarios con vitest en el workspace `app` (`npm test --workspace app`); los e2e siguen con Playwright en `e2e/` | una sola fuente de verdad para límites, proveedores, regla según importe y rastro de cambios, probada sin red |
| 25-oct 15:41 | Jesús (D) | `Role` y `RuleName` se definen solo en `stellar.ts`; `src/controls/types.ts` los reexporta. `src/controls/units.ts` no exporta `STROOPS_PER_XLM` (ya lo exporta `stellar.ts`, como número) | evitar dos definiciones con el mismo nombre |

## 12. Enlaces

- OpenZeppelin, políticas: https://docs.openzeppelin.com/stellar-contracts/accounts/policies
- OpenZeppelin, flujo de autorización: https://docs.openzeppelin.com/stellar-contracts/accounts/authorization-flow
- OpenZeppelin, reglas de contexto: https://docs.openzeppelin.com/stellar-contracts/accounts/context-rules
- smart-account-kit (README): https://cdn.jsdelivr.net/npm/smart-account-kit@0.6.0/README.md
- Scaffold Stellar: https://developers.stellar.org/docs/tools/scaffold-stellar
- Documentación de Stellar para IAs: https://developers.stellar.org/llms.txt
- Reglas y rúbrica de HackMeridian: https://www.hackmeridian.com/build

## 13. Comandos útiles

```bash
# Scaffold Stellar (solo B, una vez, en F0)
cargo install --locked stellar-scaffold-cli
stellar scaffold init arqueo
npm start                  # app en local
stellar scaffold build     # compila los contratos y regenera packages/

# App
npm test --workspace app            # tests unitarios (vitest): app/src/controls
npm run build --workspace app       # tsc + vite build

# Contrato
cargo test                 # dentro de contracts/control-policy

# Claude Code: skill oficial de Stellar
/plugin marketplace add stellar/stellar-dev-skill
/plugin install stellar-dev@stellar-dev
```

Cuentas y despliegues de testnet: con la Stellar CLI (`stellar keys …`, `stellar contract deploy …`). Comprobad las opciones con `--help` antes de usarlas.
