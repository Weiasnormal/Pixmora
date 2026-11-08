<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/brand/pixmora-logo-dark.webp">
    <img src="public/brand/pixmora-logo-primary.webp" alt="Pixmora" height="72">
  </picture>
</p>

<p align="center"><strong>Less Space. More Prints.</strong></p>

Pixmora prepares photos and packs them onto shared paper at their exact physical size. It's built for photo printing jobs where several customers or package sizes need to fit on one sheet, so you can go from photo to printer without arranging anything by hand in a word processor.

Everything runs in the browser. Photos are not uploaded to a server.

## Features

- **Mixed packages on one sheet:** give each photo its own package, such as 2 × 2 in for one customer and 1 × 1 in for the next.
- **True-size packing:** copies are placed in millimetres, with separate horizontal and vertical gaps down to 0 mm.
- **Photo editing:** crop, rotate, zoom, adjust brightness, contrast, vibrance and temperature, and add a border. Crops stay separate for each print size, and one checkbox applies a photo's colour and background edits to all its sizes.
- **Background removal:** replace a background using the MODNet model, which runs locally in the browser.
- **Export:** download a PDF at the exact paper size, or PNG sheets at 150, 300 or 600 DPI. You can also send the PDF straight to the browser's print dialog.
- **Print quality checks:** get a warning when a crop falls below the minimum DPI.
- **Printer calibration:** print a calibration sheet, measure it, and save a safe edge inset as a printer profile.
- **Keyboard shortcuts:** Canva-style keys for undo, duplicate, zoom, crop and export. Press `?` in the Studio to see them all.
- **Works on any screen:** the Studio adapts from phones to tablets and desktops.
- **Saved settings:** packages, photo sizes and print defaults are kept in the browser's local storage.

### Built-in sizes

| Type | Presets |
|---|---|
| Paper | A4, Letter, Legal, 4 × 6 in, 5 × 7 in, or a custom size |
| Photos | 1 × 1 in, 2 × 2 in, Passport (35 × 45 mm), 3R, 4R, 5R, 6R |

Passport rules vary by issuing authority, so confirm that size against the requirements for your document before printing.

## How it works

1. Add JPG, PNG or WebP photos, up to 40 MB and 100 megapixels each.
2. Choose a package for each photo and adjust its crop.
3. Pixmora fills as many sheets as the job needs.
4. Export the job and print it at 100% or Actual Size.

Pixmora can create a zero-margin file, but edge-to-edge output depends on your printer, paper and driver settings. Measure one test print before running a full job. The in-app print guide at `/help` covers this in detail.

## Privacy

- Photos stay in the browser's memory and are never saved, so they are cleared when you reload the page.
- Editing, packing and export all happen on your device.
- The first time you use background removal, the browser downloads the MODNet model from Hugging Face. Your photos are not sent with that request.

## Getting started

You need [Node.js](https://nodejs.org) 20.9 or later.

```bash
git clone https://github.com/Weiasnormal/Pixmora.git
cd Pixmora
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000). No environment variables are required.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Starts the development server |
| `npm run build` | Creates a production build |
| `npm start` | Serves the production build |
| `npm run lint` | Runs ESLint |
| `npm test` | Runs the Vitest test suite |

## Project structure

```text
app/         Routes: landing page, /studio and /help
components/  Shared UI and logo
features/
  background/  Background removal
  export/      PDF and PNG output
  images/      Import, cropping and rendering
  job/         Studio state, defaults and types
  layout/      Packing engine and sheet preview
  packages/    Package and photo size library
  settings/    Print setup
  studio/      Main workspace
public/      Static assets
```

## Built with

- [Next.js](https://nextjs.org) 16 and [React](https://react.dev) 19
- [Tailwind CSS](https://tailwindcss.com) 4
- [Zustand](https://zustand.docs.pmnd.rs) for state
- [pdf-lib](https://pdf-lib.js.org) for PDF output
- [Transformers.js](https://huggingface.co/docs/transformers.js) with MODNet for background removal
- [react-easy-crop](https://github.com/ValentinH/react-easy-crop) for cropping
- [Vitest](https://vitest.dev) for tests

## Deployment

Pixmora deploys to [Vercel](https://vercel.com) with no extra configuration:

```bash
vercel --prod
```
