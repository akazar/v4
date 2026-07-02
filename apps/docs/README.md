# Vision v4 documentation site

Static documentation for the Vision v4 repository, built from Markdown under `docs/` and served at `/documentation/` after a production build.

## Installation

From the repository root:

```bash
npm install --prefix apps/docs
```

Or from this directory:

```bash
npm install
```

## Local development

From the repository root:

```bash
npm run docs:dev
```

Or from this directory:

```bash
npm start
```

This starts a local dev server with hot reload for content and theme changes.

## Build

From the repository root:

```bash
npm run docs:build
```

Or from this directory:

```bash
npm run build
```

Output is written to `apps/docs/build/`. The main Vision server serves that folder at `/documentation/` when it exists.

## Preview production build

```bash
npm run serve
```
