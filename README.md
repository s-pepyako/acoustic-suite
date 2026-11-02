# Acoustic Suite

Static browser room-pressure workbench. Run: node serve.mjs. Tests: node --test tests/*.test.mjs.

Open http://localhost:4173. No packages or build step are required. Two speakers and a subwoofer have independent gain, enable switches and Butterworth HPF/LPF (off, 6, 12, 24 dB/oct). The subwoofer has delay in milliseconds. Drag source markers, or enter coordinates. Add/remove obstacle rectangles and edit their coordinates and dimensions. Click Calculate after edits; Cancel stops the worker. Project data saves locally and can be exported/imported as JSON.

## Model

The Web Worker solves the damped 2D acoustic wave equation on a uniform finite-difference grid. Room and rectangle boundaries have zero normal velocity (rigid reflection). Sources are coherent point monopoles driven at one frequency. Complex analog Butterworth responses include magnitude and phase; delay contributes phase rotation. A five-time-constant settling interval precedes eight cycles of sinusoidal least-squares amplitude extraction. Modal Q controls distributed damping, not a material absorption coefficient.

The heatmap shows dB relative to the peak of each result, not calibrated SPL. Overall output cannot be compared by colour across separate runs. This 2D model excludes ceiling/floor modes, transmission, frequency-dependent boundary absorption, and 3D diffraction. Obstacles are full-height rectangles snapped to grid cells; small obstacles and gaps require fine detail. Use finer grids to assess numerical convergence. Below ten grid cells per wavelength the app reports a warning.

## GitHub Pages

The manual-only workflow runs tests, packages only public app assets, and deploys through GitHub Actions. Enable Settings → Pages → GitHub Actions, then run Deploy GitHub Pages. No push-triggered deployment is configured. Private-repository Pages availability depends on your GitHub plan. App files use relative URLs and work under a repository subpath.
