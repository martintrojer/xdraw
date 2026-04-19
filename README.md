# xdraw

Minimal Excalidraw file editor.

No database. No list page. One job only:

- open one `.excalidraw` file in system browser
- save back to same file
- create new file when needed

## Install

Download the single-file executable from the Release page or build for source (see below).

## Use

Open existing file:

```bash
xdraw diagram.excalidraw
```

Create new file:

```bash
xdraw new sketch.excalidraw
```

Both commands launch default browser and keep tiny local Bun server running for save/load.

### Build

```bash
bun install
```

Ahead-of-time Bun bundle:

```bash
bun run build
```

Single-file executable:

```bash
bun run build:exe
./dist/xdraw diagram.excalidraw
```

## Notes

- `Ctrl+S` / `Cmd+S` saves
- file path without extension gets `.excalidraw` added
- `new` fails if file already exists
- frontend assets are bundled from `src/index.html` by Bun
- set `XDRAW_NO_OPEN=1` to skip browser launch during testing
