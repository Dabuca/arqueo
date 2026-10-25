# Estado del equipo — domingo 25-oct, 19:15 (Lisboa)

> Foto de `develop` en `23ab63b`, sacada de los commits y del código, no de las casillas. **Congelación: hoy 20:00. Envío: lunes 11:30.**
> Si algo de aquí contradice `AGENTS.md`, manda `AGENTS.md`.

**Hechos:** R1, R2, R3, R4, R5, R7.
**Lo que más preocupa:** no existe la pantalla del auditor (escena 4), la regla `large` no se puede crear desde la app (escena 2b) y el ID del contrato `control-policy` no está en el repo (escenas 2 y 3).

## Escenas de la demo hoy

| Escena | ¿Sale desde la app? | Qué falta |
|---|---|---|
| 1 · pago por debajo del máximo | Sí, cuando entre el PR #8 | Mezclar #8 |
| 2 · por encima del máximo, solo employee → rechazado | Solo si `control-policy` está configurada | ID del contrato (A) y `PUBLIC_SUPPLIERS` |
| 2b · el mismo pago con manager → aceptado | **No** | Botón para crear la regla `large` (B + C) |
| 3 · cuenta fuera de la lista → rechazado | Solo si `control-policy` está configurada | ID del contrato (A) y una cuenta con fondos fuera de la lista (B) |
| 4 · el auditor ve todo y descarga el CSV | **No** | Pantalla del auditor (C) |

---

## A — Carlos

### Esencial
- **Pasar el ID del contrato `control-policy` desplegado en testnet.** No está en el repo ni en `app/.env.example` (`PUBLIC_CONTROL_POLICY_ADDRESS` está vacío). Sin él, la política se omite con un simple aviso en la consola y las escenas 2 y 3 no se rechazan. Ponlo en `app/.env.example` o pásaselo a B y a D (lo necesita también el README).
- **R6: probar en testnet y marcar la casilla con B.** En el código ya está completo: `ordinary` lleva `control-policy` con máximo y `setupLargeRule()` (R7) la instala sin máximo en `large`.
- **R12: revisar con C y marcar la casilla.** Los mensajes de §6.3 y el desplegable «Details» ya están en la pantalla de pago nueva.

### No esencial
- `app/src/components/OrdinaryPayment.tsx` **ya no se muestra**: la pantalla buena es `app/src/pages/PaymentScreen.tsx` (R8). No sigas cambiando `OrdinaryPayment`; se puede borrar al final.
- Tope de 30 días que conserva lo gastado (con B): propuesta de D, **fuera del MVP**. La demo usa la `spending_limit` de OpenZeppelin.

## B — DavidB

### Esencial
- **Botón «Set up large rule» en la pantalla de pago (con C).** `setupLargeRule()` existe, pero solo se puede llamar desde la consola (`arqueo.setupLargeRule()`). Sin el botón, pagar con «Employee + manager» da «Set up the large rule first» y **no hay escena 2b**.
- **Datos de la demo:** `PUBLIC_SUPPLIERS` con los proveedores y una cuenta con fondos de Friendbot que **no** esté en la lista (escena 3).
- **R14, script de demo** (cuenta nueva por ensayo): 0 commits. Hace falta para ensayar y grabar.
- **Revisar y mezclar los PR abiertos**, por este orden: [#8](https://github.com/Dabuca/arqueo/pull/8) (el botón de pago se queda gris sin él), [#7](https://github.com/Dabuca/arqueo/pull/7), [#5](https://github.com/Dabuca/arqueo/pull/5), [#6](https://github.com/Dabuca/arqueo/pull/6), [#4](https://github.com/Dabuca/arqueo/pull/4).
- **Hacer público el repo** antes de rellenar el formulario del lunes. Ahora es privado y el jurado no podría abrirlo.

### No esencial
- Script que envía a propósito un pago rechazado para que quede **fallido en stellar.expert** (prueba en la cadena para el README y el vídeo).
- Actualizar `e2e/tests/r6-control-policy.spec.ts`: entra en `/` (ahora es la landing) y busca «Pay as employee» (interfaz antigua). Debe ir a `/app` con los textos de `PaymentScreen`.
- R17, Ajustes (con C): **propuesta de recortarlo** (P1), por la norma de §8.

## C — DavidP

### Esencial
- **Pantalla del auditor (R9, R13 y la parte visible de R11). Es la prioridad número 1 del equipo.** No hay ningún commit en `c/R9-auditor-view` ni en `c/R13-auditor-signers-rule`, y en `/app` no hay vista de auditor. Lo que ya existe:
  - `listPayments()` en `stellar.ts`: todos los intentos, también los rechazados, con firmantes y regla.
  - `PaymentsCsvDownloadButton` y `paymentsCsv.ts` (R11): el CSV ya está hecho, pero no se muestra en ninguna parte.
  - Columnas mínimas: importe, destinatario, fecha, estado, enlace a stellar.expert, firmantes y regla.
- **Botón de la regla `large` en `PaymentScreen`** (con B, ver arriba).
- **Quitar de `/app` los restos del scaffold**: «Sample Contracts», «Guess the Number», «Start Building» y los enlaces del tutorial. Saldrían en el vídeo.
- **R8:** marcar la casilla cuando entre el PR #8.

### No esencial
- R15: publicar la app con el aviso «testnet only». Da la URL para el README.
- Capturas de `/app` para el README y la diapositiva 4 del deck.
- Repaso de UX: móvil a 375 px, teclado y contraste.

## D — Jesús

### Esencial
- **Guion del vídeo**, la **grabación de reserva** antes de las 02:00 del lunes y la grabación final el lunes a las 09:00.
- **Rellenar los huecos `TODO(R10)`** del README y los pendientes del deck con lo que den A, B y C (hashes, IDs, URL de la app, capturas).
- **Formulario:** averiguar los campos y dejar las respuestas listas; envío a las 11:30.
- **Decidir el arreglo de formato de la CI** (PR #7, con o sin los archivos de la landing).
- **Coordinar el ensayo de las 4 escenas** a las 20:00 con todos.

### No esencial
- Mantener las casillas de `AGENTS.md` §7 al día (R6, R8 y R12 en cuanto se confirmen).

## Todos

- **La CI está en rojo para todos los PR.** `npm run format:check` falla por archivos que entraron en `develop` sin formatear: `.claude/skills/**`, `app/.impeccable/**`, `app/DESIGN.md`, `app/src/components/LedgerTrail.*`, `app/src/pages/Home.module.css`, `app/src/pages/Landing.tsx`, `app/src/lib/payments.ts`, `app/src/lib/payments.test.ts`, `app/src/components/OrdinaryPayment.tsx` y `e2e/tests/r6-control-policy.spec.ts`. El PR #7 tiene el arreglo preparado: las carpetas copiadas van a `.prettierignore` y el resto se pasa por `npx prettier --write`.
- **Nada directo a `develop`**: PR y revisión de otra persona (`AGENTS.md` §9). Así se colaron esos archivos.
- **Ensayo a las 20:00**, con una cuenta nueva:
  1. 200 a un proveedor → aceptado.
  2. 800 solo con employee → rechazado con «manager approval required» (no por el tope).
  3. 800 con employee + manager → aceptado.
  4. 100 a una cuenta fuera de la lista → rechazado.
  5. El auditor ve los cuatro intentos (también los rechazados) y descarga el CSV.
- **Norma de §8:** si a las 20:00 falta un P0 (R9 es P0), se recorta un P1, empezando por R17.
