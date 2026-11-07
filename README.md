# CuboGuía

App web instalable (PWA) en español que enseña a resolver un cubo de Rubik 3x3 paso a paso, a partir de fotos de sus 6 caras.

- **Captura**: cámara en vivo con cuadrícula 3x3, o 6 fotos subidas con esquinas ajustables.
- **Revisión**: red desplegada y cubo 3D; toca una casilla para corregir su color. Valida que el cubo tenga solución (conteo de colores, piezas imposibles, aristas volteadas, esquinas giradas, paridad).
- **Dos modos**:
  - **Aprender**: método por capas en 8 etapas (margarita, cruz blanca, esquinas blancas, segunda capa, cruz amarilla, aristas amarillas, esquinas a su lugar, girar esquinas). Unos 120 giros.
  - **Rápido**: algoritmo de Kociemba (cubejs), 22 giros o menos.
- **Reproductor**: cubo 3D animado con flecha del sentido de giro, texto en español, anterior/repetir/hecho, reproducción automática (0.5×–2×), barra de progreso por etapas, lista de movimientos y aviso al completar cada etapa.
- **Cronómetro e historial** (IndexedDB), ajustes, modo daltónico (letras en los stickers).
- **Sin internet**: todo se calcula en el teléfono; el service worker guarda la app en caché. Las fotos nunca salen del dispositivo.

## Cómo sostener el cubo

La app resuelve con **amarillo arriba y verde al frente**. Orden de fotos:

| # | Cara a la cámara | Arriba |
|---|---|---|
| 1 | Verde | Amarillo |
| 2 | Naranja (gira el cubo a la izquierda) | Amarillo |
| 3 | Azul | Amarillo |
| 4 | Rojo | Amarillo |
| 5 | Amarillo | Azul |
| 6 | Blanco | Verde |

## Correr en local

```bash
python -m http.server 5173
```

Abre http://localhost:5173. En `localhost` el service worker no se registra (para no ver archivos viejos mientras desarrollas); agrega `?sw=1` para probarlo.

La cámara requiere HTTPS o `localhost`.

## Pruebas

```bash
npm test
```

Incluye: giros del modelo, validación, mapeo foto → cara, clasificación de colores con distintas luces, y **1000 mezclas aleatorias resueltas por cada modo** (tarda ~45 s por la preparación de Kociemba).

## Publicar en GitHub Pages

Sube el contenido de esta carpeta (sin `node_modules/`) a un repositorio y activa Pages en la rama principal. Todas las rutas son relativas, así que funciona dentro de `/<repo>/`.

Al publicar cambios, sube también el número de `CACHE` en `sw.js` (`cuboguia-v2`, …) para que los teléfonos descarguen la versión nueva.

## Estructura

```
index.html, styles.css, sw.js, manifest.webmanifest
src/cube/       modelo (54 facelets URFDLB), validación, textos de movimientos
src/solver/     método por capas y worker de Kociemba
src/capture/    cámara/fotos, orden de captura, clasificación de colores
src/view/       cubo 3D (Three.js)
src/data/       ajustes e historial
vendor/         three.js r160 y cubejs (copias locales para uso offline)
tools/          generador de iconos
tests/          pruebas con node --test
```

## Licencias de terceros

- three.js — MIT (`vendor/three/LICENSE`)
- cubejs — MIT (`vendor/cubejs/LICENSE`)
- Inter, Space Grotesk, JetBrains Mono — SIL Open Font License (vía Fontsource)

## Limitaciones conocidas

- Pensada para cubos 3x3 con los colores estándar. Con stickers de otros colores la detección puede fallar (se corrige a mano en la revisión).
- Con luz muy pobre o reflejos fuertes, el rojo y el naranja pueden confundirse: revisa las casillas marcadas como dudosas.
- La primera vez, el modo Rápido tarda unos segundos en prepararse (se hace en segundo plano).
