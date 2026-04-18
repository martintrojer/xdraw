# xdraw

Minimal Excalidraw file editor.

No database. No list page. No Next.js. One job only:

- open one `.excalidraw` file in system browser
- save back to same file
- create new file when needed

## Install

```bash
npm install
npm run build
```

## Use

Open existing file:

```bash
node bin/xdraw.mjs diagram.excalidraw
```

Create new file:

```bash
node bin/xdraw.mjs new sketch.excalidraw
```

Both commands launch default browser and keep tiny local server running for save/load.

## Notes

- `Ctrl+S` / `Cmd+S` saves
- file path without extension gets `.excalidraw` added
- `new` fails if file already exists
- browser app served from local `dist/`, so build first
- set `XDRAW_NO_OPEN=1` to skip browser launch during testing
