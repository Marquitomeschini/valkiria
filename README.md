# Valkiria ᛏ

*En la mitología nórdica, las valkirias recorrían el campo de batalla y elegían a los mejores
guerreros para llevarlos al Valhalla. Esta extensión hace lo mismo con las publicaciones.*

Extensión para Chrome (y otros navegadores basados en Chromium: Edge, Brave, Opera, Vivaldi) que
ordena las publicaciones de **Instagram, TikTok, X y Facebook** por vistas, likes, comentarios,
compartidos, engagement, outlier score o fecha. Incluye carga automática, filtros, exportación
(Google Sheets, Excel, CSV, JSON) y descarga de videos y fotos.

Es de uso personal: no está publicada en la Chrome Web Store, así que se instala a mano.

## Instalación en Windows: instalador de un clic (recomendado)

1. Descargá **`instalar-valkiria.cmd`** (está en la raíz del repositorio:
   <https://github.com/Marquitomeschini/valkiria>).
2. Hacé doble clic. Si Windows muestra "Windows protegió su PC", tocá **Más información** →
   **Ejecutar de todas formas**: pasa con cualquier archivo descargado que no sea de una empresa
   conocida.
3. El instalador baja Valkiria a `C:\Users\<tu usuario>\Valkiria`, activa las actualizaciones
   automáticas, copia la ruta de la extensión y abre `brave://extensions`.
4. En Brave, una sola vez:
   1. Activá **Modo de desarrollador** (arriba a la derecha).
   2. Si tenías otra Valkiria (o FeedOrden) cargada, tocá **Quitar** en su tarjeta.
   3. Tocá **Cargar descomprimida**. En la ventana, hacé clic en la barra de arriba (donde dice la
      carpeta), pegá con **Ctrl+V**, apretá **Enter** y tocá **Seleccionar carpeta**.
5. Fijá el escudo: pieza de rompecabezas → pin al lado de Valkiria.

### Actualizaciones

No tenés que hacer nada. Cada 15 minutos Windows revisa si hay una versión nueva en GitHub; si la
hay, la baja y en menos de un minuto Valkiria se recarga sola. El escudo muestra **NEW** y el
popup avisa a qué versión se actualizó. Después recargá las pestañas de las redes que tengas
abiertas.

- **En el popup:** abajo dice tu versión y tiene un botón **Buscar actualización**.
- **En la carpeta `Valkiria`:** "Actualizar ahora" busca en el momento y "Desactivar
  actualizaciones" las apaga (para volver a activarlas, ejecutá otra vez el instalador).
- **Para ver el último resultado:** `Valkiria\actualizador\ultimo-resultado.txt`.
- Si alguna vez la extensión no se recarga sola, tocá **recargar** en su tarjeta en
  `brave://extensions`.

## Instalación a mano (otros sistemas o sin el instalador)

### 1. Guardá la carpeta en un lugar fijo

1. Descargá `valkiria.zip`.
2. Descomprimilo:
   - **Windows:** clic derecho sobre el zip → **Extraer todo…** → **Extraer**.
   - **Mac:** doble clic sobre el zip.
3. Mové la carpeta `valkiria` a un lugar donde no la vayas a borrar, por ejemplo **Documentos**.
   Chrome carga la extensión desde esa carpeta: si la borrás o la movés, la extensión deja de
   funcionar.

### 2. Cargala en Chrome

1. Abrí Chrome, escribí `chrome://extensions` en la barra de direcciones y apretá Enter.
2. Arriba a la derecha, activá **Modo de desarrollador**.
3. Aparece una barra nueva arriba a la izquierda. Tocá **Cargar descomprimida** (en Chrome en
   inglés: *Load unpacked*).
4. Elegí la carpeta **`valkiria/extension`**: es la que tiene adentro el archivo `manifest.json`.
   No elijas el zip ni la carpeta `valkiria` de afuera.
5. Aparece la tarjeta **Valkiria** con el escudo. Si tenías instalada una versión anterior con el
   nombre **FeedOrden**, tocá **Quitar** en su tarjeta: es la misma extensión con otro nombre.

### 3. Fijá el ícono en la barra

1. Arriba a la derecha de Chrome, tocá el ícono de la **pieza de rompecabezas**.
2. Al lado de **Valkiria**, tocá el **pin** (Fijar). El escudo queda siempre visible: todo se
   maneja desde ahí.

### 4. Probala

1. Si tenías abiertas pestañas de Instagram, TikTok, X o Facebook, **recargalas** (F5 o ⌘R).
2. Entrá a un perfil, por ejemplo la pestaña de reels de una cuenta de Instagram.
3. Tocá el escudo, elegí el filtro y tocá **Vistas**. La página se desenfoca mientras carga y
   después aparecen los resultados.
4. Para descargar videos de TikTok, abrí TikTok al menos una vez en ese Chrome (hace falta su
   cookie).

### Otros navegadores

- **Edge:** `edge://extensions` → **Modo de desarrollador** (abajo a la izquierda) → **Cargar
  desempaquetada**.
- **Brave:** `brave://extensions`, mismos pasos que Chrome.
- **Opera:** `opera://extensions` → **Modo de desarrollador** → **Cargar desempaquetada** (*Load
  unpacked*).

### Si algo no anda

- **No encuentra publicaciones o encuentra muy pocas:** con la página abierta, tocá el escudo y
  después **Copiar diagnóstico** (abajo del todo). Copia qué respuestas mandó la red y con qué
  nombres de campos, **sin contenido**: no incluye textos, nombres de cuentas, URLs de fotos ni
  números de publicaciones. Pegalo cuando reportes el problema.
- **"Cargar descomprimida" no aparece:** falta activar **Modo de desarrollador**.
- **Error "Falta el archivo de manifiesto o no se puede leer":** elegiste la carpeta equivocada.
  Tiene que ser `valkiria/extension`.
- **Al abrir Chrome aparece un aviso sobre extensiones en modo de desarrollador:** es normal con
  extensiones instaladas a mano. Cerralo sin tocar **Inhabilitar** y la extensión sigue activa.
- **El escudo dice "Abrí un perfil…" estando en Instagram:** recargá la pestaña. Las pestañas que
  ya estaban abiertas antes de instalar no tienen la extensión cargada.

### Actualizar a mano (instalación desde el zip)

1. Descomprimí el zip nuevo y reemplazá el contenido de tu carpeta `valkiria`.
2. Valkiria se recarga sola en menos de un minuto. Si no, tocá **recargar** (la flecha circular)
   en su tarjeta en `chrome://extensions`.
3. Recargá las pestañas de las redes que tengas abiertas.

## Uso

Funciona igual que SortFeed: todo se maneja desde el escudo de la extensión en la barra de Chrome.

1. Entrá a un perfil, a la pestaña de reels, a una búsqueda o a un hashtag.
2. Tocá el escudo de Valkiria. Arriba a la derecha te muestra dónde estás (por ejemplo,
   "Instagram · @usuario").
3. En **Filtros** elegí qué publicaciones entran:
   - **Publicaciones:** todas, o las últimas 50, 100, 250, 500 o 1000.
   - **Fecha:** de la última semana, del último mes, de los últimos 3 o 6 meses, del último año,
     todas o un rango personalizado.
4. En **Ordenar por** tocá el criterio: likes, vistas, vistas por día, outlier score,
   comentarios, compartidos, engagement o más antiguas. Arranca solo.
5. La página se desenfoca y arriba aparece "N publicaciones cargadas — no hagas scroll". La
   extensión baja sola hasta juntar lo que pediste. Corta sola cuando:
   - llega a la cantidad o a la fecha que elegiste;
   - la red avisa que no hay más publicaciones;
   - la página deja de crecer;
   - la red pide esperar (se pausa para cuidar tu cuenta y te avisa).

   **Detener** la frena cuando quieras. Pase lo que pase, al terminar muestra lo que llegó a
   cargar.
6. Aparecen los resultados ("Reels más vistos · Mostrando 559 reels"), en una grilla con la
   métrica principal abajo a la izquierda. Pasando el mouse ves todas las métricas y tocando una
   publicación la abrís en otra pestaña.

En los resultados:

| Control | Qué hace |
| --- | --- |
| Grilla · Tabla · Resumen | Tres formas de ver lo mismo. **Tabla**: columnas que se ordenan con un clic. **Resumen**: medianas, vistas por día, frecuencia, cada publicación en el tiempo, mejor día y hora para publicar, y los hashtags que mejor rinden. |
| Actualizar datos | Vuelve a cargar desde la red. Arriba dice de cuándo son los datos y por qué terminó la carga. |
| Guardar | En modo Seleccionar, guarda las publicaciones marcadas en una colección. |
| Descargar | Baja los videos y fotos del top 100 de la lista que estás viendo (o de las publicaciones que marcaste con Seleccionar). Ver "Descargas" más abajo. |
| Exportar | Google Sheets (copia la tabla y abre una hoja nueva para pegar), Excel (.xlsx), CSV y JSON. Cada formato se puede descargar o copiar. |
| Filtros | Tipo (reel, video, foto, carrusel o texto), rango de fechas, vistas mínimas, duración del video y búsqueda por texto o `@autor`. |
| Ordenar por | Cambia el orden sin volver a cargar. La flecha lo invierte. Lo que no tiene ese dato va siempre al final. |
| Limpiar filtros | Vuelve a lo que elegiste en el popup. |
| Seleccionar | Marcás publicaciones sueltas y Exportar exporta solo esas. |
| Volver a la página | Cierra los resultados. Los reabrís desde el popup con **Ver resultados**. |

Si después elegís otro criterio para la misma página, no vuelve a cargar: reordena lo que ya
tiene.

En un perfil, Valkiria cuenta solo las publicaciones de esa cuenta. Las redes cargan en el fondo
publicaciones recomendadas de otras cuentas, y esas quedan afuera. En la pestaña "Etiquetadas" de
Instagram sí entran las de otras cuentas, porque es lo que muestra esa pestaña.

**Vistas por día:** vistas ÷ días desde que se publicó. Muestra lo que está funcionando *ahora*:
un reel de la semana pasada con 200 mil vistas puede rendir más que uno de hace dos años con un
millón.

**Perfiles guardados:** cada perfil, búsqueda o hashtag que cargás queda guardado en tu
navegador. La próxima vez que lo abras, los resultados aparecen al instante, y **Actualizar
datos** los trae de nuevo.

**Fechas estimadas:** algunas grillas (por ejemplo, la pestaña de reels de Instagram) no mandan la
fecha. En ese caso Valkiria la calcula a partir del número de la publicación y la corrige
comparándola con las que sí tienen fecha. En la tabla aparecen con un asterisco.

**Outlier score:** cuántas veces supera una publicación a la publicación típica del perfil, es
decir, vistas ÷ mediana de vistas de las publicaciones elegidas (likes ÷ mediana de likes si no hay
vistas). 3x significa que triplica lo normal.

**Engagement** = (likes + comentarios) / vistas. Si la publicación no tiene vistas (por ejemplo,
fotos de Instagram o posts sin video de Facebook), queda vacío.

### Qué datos hay en cada plataforma

| | Vistas | Likes | Comentarios | Compartidos |
| --- | --- | --- | --- | --- |
| Instagram | Solo reels y videos | Sí (salvo que el autor los oculte) | Sí | Casi nunca |
| TikTok | Sí | Sí | Sí | Sí (y guardados) |
| X | Sí, en posts recientes | Sí | Respuestas | Reposts + citas (y guardados) |
| Facebook | Solo videos y reels | Reacciones | Sí | Sí |

### Exportaciones

- **Excel:** archivo .xlsx real, con números como números y la primera fila fija.
- **CSV:** separado por `;`, en UTF-8 y con coma decimal, para que Excel o Sheets en español lo
  abran en columnas. Si tu Excel está en inglés y lo ves todo en una columna, usá Datos → Desde
  texto/CSV y elegí punto y coma.
- **Google Sheets:** copia la tabla y abre `sheets.new`; pegás con Ctrl+V (⌘V en Mac).
- **JSON:** para usar los datos en otro programa.

### Descargas

**Descargar top 100** (o **Descargar N** en modo Seleccionar) baja el video o las fotos de cada
publicación en la mejor calidad que manda la plataforma. En un carrusel baja todos los archivos.
Quedan en tu carpeta de descargas:

```
Descargas/Valkiria/instagram_usuario/001_reel_ABC123.mp4
Descargas/Valkiria/instagram_usuario/002_carousel_DEF456_1.jpg
Descargas/Valkiria/instagram_usuario/002_carousel_DEF456_2.mp4
```

El número adelante es el puesto en el orden que estabas viendo. Abajo a la izquierda aparece el
progreso; **Cancelar** frena lo que falta. No pregunta dónde guardar cada archivo, aunque Chrome
tenga activado "Preguntar dónde guardar".

Por plataforma:

- **Instagram y X:** videos y fotos en calidad original.
- **Facebook:** videos en HD cuando la página los trae así, y fotos. Algunos videos del feed
  llegan solo en un formato de streaming que no se puede bajar como archivo; esos aparecen como
  "sin archivo".
- **TikTok:** sus servidores de video solo entregan el archivo si el pedido trae la cookie de
  TikTok y viene "desde" tiktok.com (cabecera `Referer`). Una descarga común de Chrome no manda
  ese `Referer`, así que Valkiria pide el video desde una página oculta de la extensión, que sí
  manda las dos cosas, y después lo guarda. Si la URL principal no funciona, prueba las
  alternativas que manda TikTok (otras calidades o servidores) y, como último recurso, la versión
  con marca de agua. Para que funcione tenés que haber abierto TikTok en ese Chrome (para tener
  su cookie).

Cualquier archivo que falle al descargarse de forma directa, de cualquier red, se reintenta
automáticamente por ese mismo camino.

Descargá contenido de otras personas solo para uso personal: los videos y las fotos tienen
derechos de autor.

### Colecciones y comparar

Desde el popup o desde los resultados (**Colecciones y comparar**) se abre la página propia de
Valkiria, con tres partes:

- **Perfiles guardados:** abrir, exportar o borrar cada perfil cargado (se guardan los últimos 40).
- **Comparar:** hasta 3 perfiles lado a lado: medianas de vistas y likes, vistas por día,
  engagement, frecuencia, mejor día y hora, y las 5 mejores publicaciones de cada uno.
- **Colecciones:** las publicaciones que guardaste, de cualquier red, para exportarlas o abrirlas.

Todo queda en tu navegador: no se sube a ningún lado.

### Qué tiene SortFeed que Valkiria no

- **Transcripciones** ("Export + Transcripts") y **cuentas similares** ("Similar"). Dependen de un
  servidor externo (transcribir audio, buscar cuentas parecidas). Esta extensión no manda datos a
  ningún lado.
- El historial y la parte paga (Pro).

## Cómo funciona

No usa ninguna API externa ni manda datos a ningún servidor: todo queda en tu navegador.

- `src/hook.js` corre dentro de la página y **copia** (sin modificarlas) las respuestas de la API
  interna que la red social ya pide mientras navegás: `graphql/query` y `api/v1` en Instagram,
  `api/...` en TikTok, `i/api/graphql` en X y `api/graphql` en Facebook.
- `src/content.js` también lee el JSON que viene incrustado en el HTML de la primera carga.
- `src/platforms/*.js` reconocen las publicaciones dentro de ese JSON y las pasan a un formato
  común. Buscan objetos por su forma (por ejemplo, "tiene `code`, `taken_at` y `like_count`"), no
  por rutas fijas, para aguantar mejor los cambios de las plataformas.
- `src/core/store.js` junta todo sin repetir, recuerda en qué perfil o búsqueda se vio cada
  publicación, filtra, ordena y arma el CSV.
- `src/core/export.js` arma los CSV, TSV, JSON y .xlsx (este último sin librerías externas).
- `src/ui/ui.js` dibuja el aviso de carga y los resultados dentro de un Shadow DOM, para que los
  estilos de la página no los rompan. Toma el tema claro u oscuro de la página. Las teclas que
  escribís ahí no llegan a los atajos del sitio (por ejemplo, la "l" de X para dar like).
- `src/core/stats.js` calcula el resumen del perfil; `src/core/charts.js` dibuja los gráficos.
- `src/core/cache.js` guarda los perfiles cargados y las colecciones en `chrome.storage.local`.
- `src/app/` es la página de colecciones, perfiles guardados y comparación.
- `src/popup/` es el popup del ícono.

Permisos:

- `storage` y `unlimitedStorage`: recordar los filtros del popup y guardar los perfiles cargados y
  las colecciones (en tu navegador).
- `downloads`: guardar los videos y fotos.
- `offscreen`: la página oculta que pide los videos de TikTok (`src/offscreen/`).
- `declarativeNetRequestWithHostAccess` y acceso a los dominios de TikTok: agregar
  `Referer: https://www.tiktok.com/` **solo** a los pedidos que hace la propia extensión a esos
  dominios. No toca los pedidos de las páginas que visitás.

`src/background.js` es el service worker que hace las descargas, porque los scripts de la página
no pueden usar esa API. Los scripts corren únicamente en
instagram.com, tiktok.com, x.com, twitter.com y facebook.com.

## Limitaciones y cuidados

- **Las plataformas cambian su formato interno sin aviso.** Si un día una deja de mostrar
  publicaciones o muestra datos raros, casi siempre alcanza con ajustar su archivo en
  `src/platforms/`. Facebook es la más inestable.
- La extensión solo ve lo que la página carga. Si la plataforma no manda un dato (por ejemplo, las
  vistas de una foto), no hay forma de mostrarlo.
- La carga automática baja apenas llega cada tanda, a un ritmo parecido al de SortFeed. Cargar
  miles de publicaciones seguidas puede hacer que la plataforma te frene temporalmente; usá los
  filtros de cantidad o fecha.
- Automatizar el scroll o juntar datos puede ir contra los términos de uso de cada plataforma.
  Usala para consultas personales y con moderación.

## Desarrollo y pruebas

Requiere Node.js 22 o más nuevo. Las pruebas de punta a punta necesitan Playwright con Chromium.

```bash
node --test test/unit.test.mjs
node test/e2e.mjs
```

- `test/unit.test.mjs`: extracción por plataforma, números, fechas, orden, outlier score, filtros
  y las cuatro exportaciones.
- `test/e2e.mjs`: carga la extensión en Chromium y sirve páginas falsas en las URLs reales de cada
  plataforma (no sale a internet). Usa el popup, prueba la carga con cada tipo de filtro, el orden,
  el reordenamiento, los filtros, las exportaciones, el modo seleccionar, las descargas y que la
  página siga funcionando. Las descargas se sirven desde un servidor HTTPS local con un
  certificado temporal; hace falta `openssl` (sin él, esa parte se saltea). Ese servidor imita la
  protección de TikTok: rechaza los videos sin la cookie y sin el `Referer`, las fotos sin el
  `Referer`, y da por vencida la URL principal de la mitad de los videos, para probar las
  alternativas. `ONLY=tiktok node test/e2e.mjs` corre una sola plataforma.

**Importante:** los datos de prueba están armados a mano imitando cómo respondían las APIs internas
de cada plataforma, que no están documentadas públicamente. No fueron capturados de los sitios
reales, porque el entorno donde se desarrolló no tenía acceso a ellos. Lo primero que hay que hacer
es probarla en los sitios de verdad.
