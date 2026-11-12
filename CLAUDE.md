# Inventario al barrido — contexto del proyecto

Web app de **un solo archivo** (`index.html`) para hacer inventario físico "al barrido" desde el celular. Cada persona del equipo la abre en su teléfono; los datos quedan **locales** (nada se sube a un servidor).

## Usuario y restricciones
- Gian (Lima, Perú), programador. Responder en **español**, corto y práctico.
- Se usa en celulares modestos (Samsung A15, 4 GB RAM). **Brave se cierra** al cambiar de app (WhatsApp, etc.) → la app debe recuperarse sola.
- Debe funcionar offline (PWA) y alojarse en un hosting estático.

## Excel de entrada (formato fijo)
Columnas: Item | Número de artículo | Descripción del artículo | Unidad de medida de inventario | Ubicación por defecto | CONTEO | Ubicación Actual | Actualización (`=IF(G="OK",E,G)`) | [OBSERVACIÓN].
- Las columnas se detectan **por nombre de cabecera** (`mapColumns()` → `COL`). Si faltan CONTEO / Ubicación Actual / OBSERVACIÓN se agregan al final.
- Una **segunda fila de cabecera repetida** marca desde dónde van los productos nuevos/agregados.
- Nunca escribir la cantidad en "Actualización" (es fórmula).

## Ronda 1 (conteo)
- Se dicta un código → se busca en el Excel.
- Ubicación igual a la del Excel → CONTEO + "OK" en Ubicación Actual (checkbox "Ubicación igual (OK)"; no se escribe nada).
- Ubicación distinta → misma fila, Ubicación Actual = la real (un producto solo está en una fila; manda la ubicación por defecto del Excel).
- Código que no existe → se agrega abajo con su ubicación. Si se vuelve a agregar el mismo → aviso "Ya está agregado" y se bloquea.
- Observación opcional; editar (✎) y borrar (×) entradas; nombre de archivo editable al descargar.
- Se descarga **el mismo Excel con su formato**.

## Cámara (📷 en Ronda 1 "código" y en el buscador de Ronda 2/3)
- `getUserMedia` dentro de la app (no abrir la app de cámara: Brave se cerraría). Recuadro amarillo → se recorta la foto a esa zona.
- Código de barras: `BarcodeDetector` nativo (en vivo y sobre la foto). OCR: **Tesseract.js 5.1.1 local en `ocr/`** (solo dígitos, PSM 11), se carga al abrir la cámara y se libera tras 2 min sin uso.
- **Nunca se usa un número sin confirmar**: se muestra la foto + todos los números detectados (verde = existe en el Excel, ámbar `¿…?` = código del Excel parecido por distancia de edición ≤1, ≤2 si tiene ≥6 dígitos, gris = leído tal cual) + campo editable.
- La cámara se apaga al cambiar de app (`visibilitychange`). El 1er uso del OCR necesita internet (luego queda en caché del SW / IndexedDB de Tesseract).

## Ubicaciones
- Base fija `10-` (se detecta como el primer segmento más común, `BASE`); no se escribe.
- Se teclean las partes separadas por comas, espacios o guiones: `A02,K,11,A` → `10-A02-K-11-A`.
- El guion **solo aparece donde se escribió coma/guion** (no separar `11A` automáticamente).
- Prefijo `=` = ubicación literal. `canon()` normaliza para comparar/ordenar.

## Ronda 2 (validación de datos de otra persona)
- Se carga el Excel de otra persona; sus datos importados se pueden editar.
- La ubicación que manda en Ronda 2/3 es la columna **Actualización** (H, valor cacheado `r.U`), vía `locOf()`; si se cambió la ubicación en la app, se usa la nueva. Filtrar, agrupar y ordenar usan solo eso (no E ni G por separado).
- Filtros: por **grupo**, no por ubicación exacta: chips de pasillo (`10-A02`) → chips de letra de ese pasillo (`10-A02-N`, todos sus niveles/posiciones) (`r2Chips()`, `r2Pas`/`r2Let`); también texto (`A02,N`); código/descripción; Pendientes/Validados. Se quitó el `<select>` de ubicación exacta.
- Cada tarjeta muestra los datos del Excel y permite editar Cantidad y Ubicación (ubicación vacía = se mantiene la del Excel; G vacía pasa a OK).
- Incluye productos "agregados" (filas bajo la 2ª cabecera y los agregados en sesión).
- **Pendientes arriba; al validar/guardar la tarjeta se achica a una línea y baja** con los validados, sin re-renderizar las demás (conserva lo escrito). Botón "Editar" la reabre. Toast + animación `flash` de confirmación.
- "Validado" es solo estado de la app (no va al Excel).

## Ronda 3
- Misma plantilla/pantalla que Ronda 2, pero con **otro Excel** (más corto).
- **Las 3 rondas son totalmente independientes**: cada una tiene su propio Excel, avance, borrador y descarga (sufijo `_contado` / `_ronda2` / `_ronda3`). Nada pasa de una ronda a otra. Cambiar de pestaña guarda la ronda actual, limpia la pantalla (`unload()`) y abre el Excel de la otra (`restoreSession()`).

## Arquitectura técnica
- SheetJS (xlsx 0.18.5) solo para **leer**. JSZip + DOMParser/XMLSerializer para **parchar `xl/worksheets/sheet1.xml`** y conservar estilos: strings inline (`t="inlineStr"`), `fullCalcOnLoad` solo si no existe, se elimina `calcChain`, se extiende `dimension`, se actualiza el `<v>` cacheado de Actualización. Filas nuevas copian el estilo de la 1ª fila bajo la 2ª cabecera.
- La hoja a parchar se resuelve con `firstSheetPath()` (workbook.xml + rels), no siempre es `sheet1.xml`.
- Persistencia por ronda: archivo en **IndexedDB** (`inv_barrido`/`f`, claves `file1`/`file2`/`file3`); estado en **localStorage** (`inv_barrido_v2|R<ronda>|<archivo>|<bytes>` → `{counts,cleared,dirty}`, borrador `inv_draft|<ronda>`, `inv_mode` = 1/2/3). `migrateOld()` pasa los datos de la versión anterior (`last`) a la ronda que estaba abierta. `restoreSession()` al iniciar. `persist()` vs `save()` (save incrementa `dirty` → contador de aviso de respaldo).
- Modelo de `counts`: `{kind:'mark'|'append', row, code, desc, loc, qty, status:'ok'|'new'|'noexcel'|'sinub', excelLocs, obs, val, imp, ts, id}`.
- Descarga: Blob + `<a download>`; botón Compartir con `navigator.share` (archivo, requiere HTTPS).
- Borrar (×) tiene "Deshacer" en el toast (5 s). Cantidades negativas se rechazan.
- Móvil: no usar `accept` en el input de archivo (el celular bloquea la selección).

## Build web / PWA (carpeta de hosting)
- `index.html`, `xlsx.full.min.js`, `jszip.min.js` (locales, sin CDN), carpeta `ocr/` (Tesseract, ~11 MB), `sw.js` (network-first), `manifest.webmanifest`, `icon-192.png`, `icon-512.png`; `window.__STANDALONE=true` registra el service worker.
- **En cada release subir la versión de caché en `sw.js`** (`inventario-vN`, hoy v9) para que los celulares tomen la versión nueva. El SW usa la caché si la red tarda >3 s.

## Pruebas
- Probar en Chrome real con Playwright (emulación táctil, viewport ~390×780) sirviendo la carpeta con `python3 -m http.server`.
- Verificar el Excel descargado con openpyxl y/o LibreOffice headless.
- En tests de ronda 2 esperar ≥200 ms tras escribir (hay debounce de 150 ms).

## Pendiente / ideas
- Hosting: Netlify (lo publica el usuario). Repo: github.com/GianPool7/inventario.
