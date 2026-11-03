# Pruebas de Liquida

Un solo comando: `node tests/run.js` (usa `--rapido` para omitir las de navegador).

- Las de navegador necesitan `npm install --no-save playwright` y `npx playwright install chromium`.
- `test_regresion.js` guarda cada error ya corregido para que no vuelva.
- `seguridad-navegador.js` simula ataques (código inyectado, datos guardados maliciosos) con las cabeceras reales de `netlify.toml`.
- `e2e-dispositivos.js [carpeta]` recorre la app como usuario en Android, iPhone y iPad (Chromium emulando pantalla; no es Safari real) y guarda capturas si se indica carpeta.
- GitHub ejecuta todo en cada cambio (`.github/workflows/pruebas.yml`).
