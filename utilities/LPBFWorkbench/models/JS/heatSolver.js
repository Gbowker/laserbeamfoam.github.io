/**
 * heatSolver.js
 * Browser port of heat_diffusion_cw.py
 * Transient 2-D thin-plate heat diffusion + pore prediction for Ti-6Al-4V
 *
 * Public API
 * ----------
 *  runHeatDiffusion(csvText, params, onProgress) → Promise<SimResult>
 *  renderTempFrame(canvas, T, NX, NY, Tmin, Tmax)
 *  renderMeltFrame(canvas, meltMap, NX, NY)
 *  buildPoreScatterOption(result)   → ECharts option object
 *
 * SimResult fields
 * ----------------
 *  framesT       Float32Array[]   — temperature snapshots (flat, row-major)
 *  framesMelt    Uint8Array[]     — melt-map snapshots
 *  framesLaser   {lx,ly,pwr,t_ms}[]
 *  evX, evY      number[]         — laser ON event positions [m from dom origin]
 *  TenvHist      number[]         — pre-arrival environment temperature [K]
 *  poreHist      Int8Array        — 0 no pore | 1 keyhole | 2 LOF
 *  meltMap       Float32Array     — final accumulated melt map
 *  NX, NY        number           — grid dimensions
 *  cell          number           — cell size [m]
 *  domXmin/Xmax/Ymin/Ymax         — domain extent [mm]
 *  rEff          number           — effective laser radius [m]
 *  DT            number           — time step [s]
 *  scanSpeed     number           — median scan speed [m/s]
 */

// =============================================================================
// MATERIAL PROPERTIES — Ti-6Al-4V
// =============================================================================
const HS_RHO   = 4420.0;
const HS_CP    = 560.0;
const HS_K     = 7.2;
const HS_ALPHA = HS_K / (HS_RHO * HS_CP);

// =============================================================================
// BOUNDARY CONDITIONS
// =============================================================================
const HS_T_AMBIENT  = 300.0;
const HS_H_CONV     = 10.0;
const HS_EMISS      = 0.35;
const HS_SIGMA      = 5.67e-8;
const HS_T_MELT     = 1941.0;
const HS_T_VAPORISE = 3560.0;

// =============================================================================
// LASER + THIN-PLATE MODEL
// =============================================================================
const HS_PULSE_POWER     = 200.0;     // W
const HS_DEFAULT_SPEED   = 1.2;       // m/s
const HS_LASER_RADIUS    = 37.5e-6;   // m
const HS_ABSORPTIVITY    = 0.5;
const HS_PLATE_THICKNESS = 35e-6;     // m

// =============================================================================
// GRID
// =============================================================================
const HS_CELL_SIZE = (2 * HS_LASER_RADIUS) / 5.0;   // laser diameter / 5

// =============================================================================
// PORE PREDICTION (threshold fallback — NN model not available in browser)
// =============================================================================
const HS_R_ENV_FACTOR   = 4.0;      // multiples of r_eff
const HS_T_KEYHOLE_CRIT = 1600.0;   // K

// =============================================================================
// DATA LOADING
// =============================================================================

/**
 * Parse a tab-separated printer data file.
 * Returns arrays already filtered to the requested window [wxmin..wxmax] × [wymin..wymax].
 */
function loadPrinterData(text, wxmin, wxmax, wymin, wymax) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) throw new Error('File has no data rows');

    // Try tab first, fall back to comma
    let sep = '\t';
    const header0 = lines[0].split('\t');
    if (header0.length < 3) sep = ',';

    const header = lines[0].split(sep).map(s => s.trim());
    const col = name => {
        const i = header.indexOf(name);
        if (i === -1) throw new Error(`Missing column: "${name}"`);
        return i;
    };

    const iT   = col('Start time');
    const iDur = col('Duration');
    const iX   = col('Demand X');
    const iY   = col('Demand Y');
    const iPwr = header.indexOf('Demand laser power (mean)');   // -1 if absent
    const hasPwr = iPwr !== -1;

    const t_s = [], dur_s = [], x_raw = [], y_raw = [], power_on = [];

    for (let li = 1; li < lines.length; li++) {
        const row = lines[li].split(sep);
        if (row.length < 4) continue;

        const t  = parseFloat(row[iT])   * 1e-6;   // µs → s
        const d  = parseFloat(row[iDur]) * 1e-6;
        const x  = parseFloat(row[iX]);
        const y  = parseFloat(row[iY]);
        if (!isFinite(t) || !isFinite(x) || !isFinite(y)) continue;

        // Window filter
        if (wxmin !== null && x < wxmin) continue;
        if (wxmax !== null && x > wxmax) continue;
        if (wymin !== null && y < wymin) continue;
        if (wymax !== null && y > wymax) continue;

        let pwr = HS_PULSE_POWER;
        if (hasPwr) {
            const p = parseFloat(row[iPwr]);
            pwr = (isFinite(p) && p > 0) ? HS_PULSE_POWER : 0.0;
        }

        t_s.push(t); dur_s.push(d); x_raw.push(x); y_raw.push(y); power_on.push(pwr);
    }

    if (t_s.length === 0) throw new Error('No data rows pass the window filter');

    // Sort by time
    const order = t_s.map((_, i) => i).sort((a, b) => t_s[a] - t_s[b]);
    const pick = arr => order.map(i => arr[i]);
    return {
        t_s:      pick(t_s),
        dur_s:    pick(dur_s),
        x_raw:    pick(x_raw),
        y_raw:    pick(y_raw),
        power_on: pick(power_on),
    };
}

// =============================================================================
// PHYSICS — thin-plate FDM
// =============================================================================

/** Fill Q (flat, row-major) with the Gaussian laser flux at (xl, yl). */
function computeGaussianFlux(flatX, flatY, xl, yl, power, rEff, Q) {
    const I0     = (2 * HS_ABSORPTIVITY * power) / (Math.PI * rEff * rEff);
    const inv2r2 = 2.0 / (rEff * rEff);
    const n = flatX.length;
    for (let i = 0; i < n; i++) {
        const ddx = flatX[i] - xl;
        const ddy = flatY[i] - yl;
        Q[i] = I0 * Math.exp(-inv2r2 * (ddx * ddx + ddy * ddy));
    }
}

/** Apply Dirichlet BCs: pin all four edges to T_AMBIENT. */
function applyBCs(T, NX, NY) {
    for (let ix = 0; ix < NX; ix++) {
        T[ix]                  = HS_T_AMBIENT;   // top row    (iy=0)
        T[(NY - 1) * NX + ix] = HS_T_AMBIENT;   // bottom row (iy=NY-1)
    }
    for (let iy = 0; iy < NY; iy++) {
        T[iy * NX]          = HS_T_AMBIENT;   // left  column
        T[iy * NX + NX - 1] = HS_T_AMBIENT;   // right column
    }
}

/**
 * One finite-difference time step.
 * Reads T, writes result into Tnew, applies BCs, returns Tnew.
 * T and Tnew must NOT be the same buffer.
 */
function fdStep(T, Tnew, Q, dt, dx, dy, NX, NY) {
    const idx2 = 1.0 / (dx * dx);
    const idy2 = 1.0 / (dy * dy);
    const invRhoCpH = 1.0 / (HS_RHO * HS_CP * HS_PLATE_THICKNESS);

    // Evaporation constants
    const C_T    = 5.17e4;
    const C_Pev  = 0.54 * 101325;
    const M_mol  = 0.04788;
    const R_GAS  = 8.314;
    const H_V    = 9.83e6;
    const T_MAX  = HS_T_VAPORISE + 1000.0;
    const invTv  = 1.0 / HS_T_VAPORISE;
    const sqrtFac = M_mol / (2.0 * Math.PI * R_GAS);

    // T_AMBIENT^4 (precomputed)
    const Ta4 = HS_T_AMBIENT * HS_T_AMBIENT * HS_T_AMBIENT * HS_T_AMBIENT;

    for (let iy = 1; iy < NY - 1; iy++) {
        const rowC = iy * NX;
        const rowU = (iy + 1) * NX;
        const rowD = (iy - 1) * NX;
        for (let ix = 1; ix < NX - 1; ix++) {
            const c  = rowC + ix;
            const Tc = T[c];

            // Laplacian
            const lap = (T[c + 1] - 2.0 * Tc + T[c - 1]) * idx2
                      + (T[rowU + ix] - 2.0 * Tc + T[rowD + ix]) * idy2;

            // Convection + radiation (top surface)
            const Tc4   = Tc * Tc * Tc * Tc;
            const q_top = HS_H_CONV * (Tc - HS_T_AMBIENT)
                        + HS_EMISS * HS_SIGMA * (Tc4 - Ta4);

            // Evaporative cooling
            const Te    = Tc < T_MAX ? Tc : T_MAX;
            const m_dot = C_Pev * Math.exp(-C_T * (1.0 / Te - invTv))
                        * Math.sqrt(sqrtFac / Te);
            const q_evap = m_dot * H_V;

            // Substrate conduction
            const q_bot = (HS_K / HS_PLATE_THICKNESS) * (Tc - HS_T_AMBIENT);

            const dTdt = HS_ALPHA * lap
                       + Q[c] * invRhoCpH
                       - (q_top + q_evap + q_bot) * invRhoCpH;

            Tnew[c] = Tc + dt * dTdt;
        }
    }

    applyBCs(Tnew, NX, NY);
    return Tnew;
}

// =============================================================================
// T_ENV SAMPLING
// =============================================================================

/**
 * Mean temperature in a disc of radius rCells centred on (ix, iy),
 * sampled before the Gaussian is applied.
 */
function sampleTEnv(T, ix, iy, rCells, discMask, maskSize, NX, NY) {
    const iy0 = Math.max(0, iy - rCells);
    const iy1 = Math.min(NY, iy + rCells + 1);
    const ix0 = Math.max(0, ix - rCells);
    const ix1 = Math.min(NX, ix + rCells + 1);
    const my0 = iy0 - (iy - rCells);
    const mx0 = ix0 - (ix - rCells);

    let sum = 0.0, count = 0;
    for (let diy = 0; diy < iy1 - iy0; diy++) {
        for (let dix = 0; dix < ix1 - ix0; dix++) {
            if (discMask[(my0 + diy) * maskSize + (mx0 + dix)]) {
                sum += T[(iy0 + diy) * NX + (ix0 + dix)];
                count++;
            }
        }
    }
    return count > 0 ? sum / count : HS_T_AMBIENT;
}

// =============================================================================
// PORE PREDICTION
// =============================================================================

/**
 * Returns  0 = no pore | 1 = keyhole | 2 = LOF
 * Browser fallback: threshold only (no scikit-learn MLP).
 */
function predictPore(power, speed, Tenv) {
    // Placeholder LOF detection — Tenv well below keyhole but power low
    // (extend with a real NN model loaded as JSON weights if needed)
    if (Tenv > HS_T_KEYHOLE_CRIT) return 1;   // keyhole
    return 0;
}

// =============================================================================
// COLORMAP — inferno
// =============================================================================
const _INFERNO = [
    [0,0,4],[20,11,52],[57,15,111],[96,19,110],[135,33,105],
    [168,51,98],[200,72,81],[224,100,45],[243,130,8],
    [249,160,30],[251,193,72],[252,225,130],[252,255,164],
];

function infernoRGB(t) {
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const n  = _INFERNO.length - 1;
    const fi = t * n;
    const i  = fi >= n ? n - 1 : Math.floor(fi);
    const f  = fi - i;
    const c0 = _INFERNO[i], c1 = _INFERNO[i + 1];
    return [
        (c0[0] + f * (c1[0] - c0[0]) + 0.5) | 0,
        (c0[1] + f * (c1[1] - c0[1]) + 0.5) | 0,
        (c0[2] + f * (c1[2] - c0[2]) + 0.5) | 0,
    ];
}

// Pre-baked 256-entry inferno LUT for speed (built once)
const _INFERNO_LUT = (() => {
    const lut = new Uint8Array(256 * 3);
    for (let i = 0; i < 256; i++) {
        const [r, g, b] = infernoRGB(i / 255);
        lut[i * 3] = r; lut[i * 3 + 1] = g; lut[i * 3 + 2] = b;
    }
    return lut;
})();

// =============================================================================
// MAIN SIMULATION
// =============================================================================

/**
 * Run the heat diffusion simulation asynchronously.
 *
 * @param {string}   csvText    Raw text of the printer data file (TSV or CSV)
 * @param {object}   params
 *   wxmin/wxmax/wymin/wymax — window filter [mm] (null = no filter)
 *   dxmin/dxmax/dymin/dymax — domain extent [mm] (null = derive from window)
 *   mesh                    — number of cells along X (null = use CELL_SIZE)
 * @param {function} onProgress  Called periodically: ({pct, pulse, total, Tmax, nPores})
 *
 * @returns {Promise<SimResult>}
 */
async function runHeatDiffusion(csvText, params = {}, onProgress = null) {
    const {
        wxmin = null, wxmax = null, wymin = null, wymax = null,
        dxmin = null, dxmax = null, dymin = null, dymax = null,
        laserRadius   = HS_LASER_RADIUS,   // m — drives cell size (always radius/10)
        pulsePower    = null,              // W — overrides per-pulse power from file
        pulseDuration = null,              // s — overrides per-pulse duration from file
    } = params;

    // ── Load & filter data ──────────────────────────────────────────────────
    let { t_s, dur_s, x_raw, y_raw, power_on } =
        loadPrinterData(csvText, wxmin, wxmax, wymin, wymax);

    if (t_s.length === 0) throw new Error('No pulses in window');

    // Apply overrides
    if (pulsePower !== null)
        power_on = power_on.map(p => p > 0 ? pulsePower : 0.0);
    if (pulseDuration !== null)
        dur_s = dur_s.map(() => pulseDuration);

    // Normalise time to first pulse
    const t0 = t_s[0];
    t_s = t_s.map(t => t - t0);

    // ── Scan speed from consecutive positions ───────────────────────────────
    const vSegs = [];
    for (let i = 1; i < t_s.length; i++) {
        const dt = t_s[i] - t_s[i - 1];
        if (dt <= 0) continue;
        const ds = Math.hypot(x_raw[i] - x_raw[i - 1], y_raw[i] - y_raw[i - 1]);
        vSegs.push(ds * 1e-3 / dt);
    }
    const posV = vSegs.filter(v => v > 0).sort((a, b) => a - b);
    const scanSpeed = posV.length > 0 ? posV[posV.length >> 1] : HS_DEFAULT_SPEED;

    // ── Domain ──────────────────────────────────────────────────────────────
    const xMin_raw = Math.min(...x_raw), xMax_raw = Math.max(...x_raw);
    const yMin_raw = Math.min(...y_raw), yMax_raw = Math.max(...y_raw);
    const domXmin = dxmin ?? (wxmin ?? xMin_raw);
    const domXmax = dxmax ?? (wxmax ?? xMax_raw);
    const domYmin = dymin ?? (wymin ?? yMin_raw);
    const domYmax = dymax ?? (wymax ?? yMax_raw);

    const LX = (domXmax - domXmin) * 1e-3;   // [m]
    const LY = (domYmax - domYmin) * 1e-3;
    const x_m = x_raw.map(x => (x - domXmin) * 1e-3);   // positions [m] from dom origin
    const y_m = y_raw.map(y => (y - domYmin) * 1e-3);

    // ── Grid — cell size is always 1/10 of beam radius ──────────────────────
    const cell  = laserRadius / 10.0;
    const NX    = Math.max(4, Math.round(LX / cell) + 1);
    const NY    = Math.max(4, Math.round(LY / cell) + 1);
    const dx = dy = cell;
    const rEff   = Math.max(laserRadius, 2.0 * cell);

    // ── Time step ────────────────────────────────────────────────────────────
    const dtFourier = 0.25 * cell * cell / HS_ALPHA;
    const dtCFL     = 0.5  * cell / scanSpeed;
    const DT        = Math.min(dtFourier, dtCFL) * 0.9;

    // ── Flat coordinate grids ────────────────────────────────────────────────
    const flatX = new Float64Array(NX * NY);
    const flatY = new Float64Array(NX * NY);
    for (let iy = 0; iy < NY; iy++) {
        for (let ix = 0; ix < NX; ix++) {
            flatX[iy * NX + ix] = (ix / (NX - 1)) * LX;
            flatY[iy * NX + ix] = (iy / (NY - 1)) * LY;
        }
    }

    // ── T_env disc mask ──────────────────────────────────────────────────────
    const R_ENV_cells = Math.max(1, Math.round(HS_R_ENV_FACTOR * rEff / cell));
    const maskSize    = 2 * R_ENV_cells + 1;
    const discMask    = new Uint8Array(maskSize * maskSize);
    for (let diy = -R_ENV_cells; diy <= R_ENV_cells; diy++) {
        for (let dix = -R_ENV_cells; dix <= R_ENV_cells; dix++) {
            if (dix * dix + diy * diy <= R_ENV_cells * R_ENV_cells) {
                discMask[(diy + R_ENV_cells) * maskSize + (dix + R_ENV_cells)] = 1;
            }
        }
    }

    // ── Frame sampling ───────────────────────────────────────────────────────
    // Cap at 200 frames regardless of grid size to keep memory reasonable.
    let totalOnSteps = 0;
    for (const d of dur_s) totalOnSteps += Math.max(1, Math.ceil(d / DT));
    const ON_FRAME_EVERY = Math.max(1, Math.floor(totalOnSteps / 200));

    // ── Simulation buffers ───────────────────────────────────────────────────
    let T    = new Float64Array(NX * NY).fill(HS_T_AMBIENT);
    let Tnew = new Float64Array(NX * NY).fill(HS_T_AMBIENT);
    const meltMap = new Float32Array(NX * NY);
    const Q       = new Float64Array(NX * NY);

    // ── Output collectors ────────────────────────────────────────────────────
    const framesT     = [];
    const framesMelt  = [];
    const framesLaser = [];
    const evX = [], evY = [], TenvHist = [], poreHist = [];

    let onStep  = 0;
    let simTime = 0.0;
    let lxMm    = x_m[0] * 1e3 + domXmin;
    let lyMm    = y_m[0] * 1e3 + domYmin;

    const N = t_s.length;
    // Time-based yield: hand control back to the browser every ~16 ms so the
    // page stays responsive regardless of grid size or how many FD sub-steps
    // fit inside a single pulse.
    let lastYield = performance.now();

    // ── Main loop ────────────────────────────────────────────────────────────
    for (let k = 0; k < N; k++) {
        const xl  = x_m[k];
        const yl  = y_m[k];
        const pwr = power_on[k];
        const ix  = Math.min(NX - 1, Math.max(0, Math.round(xl / dx)));
        const iy  = Math.min(NY - 1, Math.max(0, Math.round(yl / dy)));
        lxMm = xl * 1e3 + domXmin;
        lyMm = yl * 1e3 + domYmin;

        // ON phase
        const onDur = dur_s[k];
        const nOn   = Math.max(1, Math.ceil(onDur / DT));
        const dtOn  = onDur / nOn;

        // Sample T_env + predict pore once per ON pulse
        if (pwr > 0) {
            const Tenv = sampleTEnv(T, ix, iy, R_ENV_cells, discMask, maskSize, NX, NY);
            const pore = predictPore(pwr, scanSpeed, Tenv);
            evX.push(xl); evY.push(yl);
            TenvHist.push(Tenv);
            poreHist.push(pore);
        }

        // Build flux array
        if (pwr > 0) {
            computeGaussianFlux(flatX, flatY, xl, yl, pwr, rEff, Q);
        } else {
            Q.fill(0.0);
        }

        // FD sub-steps
        for (let s = 0; s < nOn; s++) {
            Tnew = fdStep(T, Tnew, Q, dtOn, dx, dy, NX, NY);
            const tmp = T; T = Tnew; Tnew = tmp;

            for (let i = 0; i < T.length; i++) {
                if (T[i] > HS_T_MELT) meltMap[i] = 1.0;
            }

            if (onStep % ON_FRAME_EVERY === 0) {
                framesT.push(new Float32Array(T));
                framesMelt.push(new Uint8Array(meltMap));
                framesLaser.push({ lx: lxMm, ly: lyMm, pwr, t_ms: simTime * 1e3 });
            }

            onStep++;
            simTime += dtOn;

            // Yield whenever we've been on the main thread for more than ~16 ms.
            // This is checked per FD step so even a single very large pulse
            // can't freeze the page.
            const now = performance.now();
            if (now - lastYield > 16) {
                if (onProgress) {
                    let Tmax = 0;
                    for (let i = 0; i < T.length; i++) if (T[i] > Tmax) Tmax = T[i];
                    const nPores = poreHist.reduce((a, p) => a + (p > 0 ? 1 : 0), 0);
                    onProgress({
                        pct:   Math.round(100 * k / N),
                        pulse: k, total: N,
                        Tmax:  Math.round(Tmax),
                        nPores,
                    });
                }
                await new Promise(r => setTimeout(r, 0));
                lastYield = performance.now();
            }
        }
    }

    // Final progress tick
    if (onProgress) onProgress({ pct: 100, pulse: N, total: N });

    return {
        framesT,
        framesMelt,
        framesLaser,
        evX,
        evY,
        TenvHist,
        poreHist: Int8Array.from(poreHist),
        meltMap:  new Float32Array(meltMap),
        NX,
        NY,
        cell,
        domXmin, domXmax, domYmin, domYmax,
        rEff,
        DT,
        scanSpeed,
        T_MELT:   HS_T_MELT,
        T_AMBIENT: HS_T_AMBIENT,
    };
}

// =============================================================================
// CANVAS RENDERING
// =============================================================================

/**
 * Render a temperature field onto a Canvas element.
 * @param {HTMLCanvasElement} canvas
 * @param {Float32Array}      T      flat row-major temperature array
 * @param {number}            NX
 * @param {number}            NY
 * @param {number}            Tmin   value mapped to colour 0 (default T_AMBIENT)
 * @param {number}            Tmax   value mapped to colour 1 (default 1.5×T_MELT)
 */
function renderTempFrame(canvas, T, NX, NY,
                         Tmin = HS_T_AMBIENT,
                         Tmax = HS_T_MELT * 1.5) {
    canvas.width  = NX;
    canvas.height = NY;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(NX, NY);
    const d   = img.data;
    const range = Tmax - Tmin || 1;

    for (let iy = 0; iy < NY; iy++) {
        // Flip Y so origin is bottom-left (matching Python imshow origin='lower')
        const rowSrc = (NY - 1 - iy) * NX;
        const rowDst = iy * NX;
        for (let ix = 0; ix < NX; ix++) {
            const t   = (T[rowSrc + ix] - Tmin) / range;
            const ti  = (t < 0 ? 0 : t > 1 ? 1 : t) * 255 | 0;
            const dst = (rowDst + ix) * 4;
            d[dst]     = _INFERNO_LUT[ti * 3];
            d[dst + 1] = _INFERNO_LUT[ti * 3 + 1];
            d[dst + 2] = _INFERNO_LUT[ti * 3 + 2];
            d[dst + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
}

/**
 * Render the accumulated melt map onto a Canvas element.
 * Melted cells are shown hot-orange; un-melted cells are dark.
 */
function renderMeltFrame(canvas, meltMap, NX, NY) {
    canvas.width  = NX;
    canvas.height = NY;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(NX, NY);
    const d   = img.data;

    for (let iy = 0; iy < NY; iy++) {
        const rowSrc = (NY - 1 - iy) * NX;
        const rowDst = iy * NX;
        for (let ix = 0; ix < NX; ix++) {
            const m   = meltMap[rowSrc + ix] > 0;
            const dst = (rowDst + ix) * 4;
            d[dst]     = m ? 255 : 18;
            d[dst + 1] = m ? 100 :  9;
            d[dst + 2] = m ?   0 :  9;
            d[dst + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
}

/**
 * Blend the melt map as a semi-transparent white overlay on top of whatever
 * is already drawn on canvas (call AFTER renderTempFrame + laser circle).
 * Melted pixels get a white highlight at ~30% opacity so the melt boundary
 * is visible without hiding the temperature colours underneath.
 */
function compositeMeltOverlay(canvas, meltMap, NX, NY) {
    const ctx       = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, NX, NY);
    const d         = imageData.data;

    for (let iy = 0; iy < NY; iy++) {
        const rowSrc = (NY - 1 - iy) * NX;   // flip Y to match renderTempFrame
        const rowDst = iy * NX;
        for (let ix = 0; ix < NX; ix++) {
            if (meltMap[rowSrc + ix] > 0) {
                const i  = (rowDst + ix) * 4;
                // Blend towards white at 30% — preserves hue, brightens melted zone
                d[i]     = (d[i]     + ((255 - d[i])     * 0.30)) | 0;
                d[i + 1] = (d[i + 1] + ((255 - d[i + 1]) * 0.30)) | 0;
                d[i + 2] = (d[i + 2] + ((255 - d[i + 2]) * 0.30)) | 0;
            }
        }
    }
    ctx.putImageData(imageData, 0, 0);
}

// =============================================================================
// PORE MAP — ECharts scatter option builder
// =============================================================================

/**
 * Build an ECharts `option` object for the three-panel pore map:
 *   left  — T_env scatter along path
 *   centre — pore type scatter (red=keyhole, blue=LOF, grey=none)
 *   right  — T_env histogram
 *
 * Pass the result directly to chart.setOption().
 *
 * @param {SimResult} result  Return value of runHeatDiffusion()
 * @returns {object}  ECharts option
 */
function buildPoreScatterOption(result) {
    const { evX, evY, TenvHist, poreHist, domXmin, domYmin } = result;
    const n = evX.length;

    const px = evX.map((x, i) => x * 1e3 + domXmin);   // [mm]
    const py = evY.map((y, i) => y * 1e3 + domYmin);

    // T_env scatter (coloured by temperature)
    const Tmin = Math.min(...TenvHist), Tmax = Math.max(...TenvHist, Tmin + 1);
    const tenvData  = px.map((x, i) => [x, py[i], TenvHist[i]]);

    // Pore type scatter
    const noPoreData = [], khData = [], lofData = [];
    for (let i = 0; i < n; i++) {
        const pt = [px[i], py[i]];
        if      (poreHist[i] === 1) khData.push(pt);
        else if (poreHist[i] === 2) lofData.push(pt);
        else                        noPoreData.push(pt);
    }

    // Histogram bins (60 bins)
    const BINS = 60;
    const binW  = (Tmax - Tmin) / BINS;
    const counts = new Array(BINS).fill(0);
    for (const T of TenvHist) {
        const b = Math.min(BINS - 1, Math.floor((T - Tmin) / binW));
        counts[b]++;
    }
    const histData = counts.map((c, i) => [Tmin + (i + 0.5) * binW, c]);

    const khCount  = khData.length;
    const lofCount = lofData.length;

    return {
        backgroundColor: '#0e0e0e',
        animation: false,
        grid: [
            { left: '4%',  top: '12%', width: '26%', bottom: '12%' },  // T_env
            { left: '38%', top: '12%', width: '26%', bottom: '12%' },  // pore
            { left: '72%', top: '12%', width: '24%', bottom: '12%' },  // histogram
        ],
        xAxis: [
            { gridIndex: 0, type: 'value', name: 'x [mm]', nameTextStyle: { color: '#ccc' }, axisLabel: { color: '#ccc' }, splitLine: { show: false } },
            { gridIndex: 1, type: 'value', name: 'x [mm]', nameTextStyle: { color: '#ccc' }, axisLabel: { color: '#ccc' }, splitLine: { show: false } },
            { gridIndex: 2, type: 'value', name: 'T_env [K]', nameTextStyle: { color: '#ccc' }, axisLabel: { color: '#ccc' }, splitLine: { show: false } },
        ],
        yAxis: [
            { gridIndex: 0, type: 'value', name: 'y [mm]', nameTextStyle: { color: '#ccc' }, axisLabel: { color: '#ccc' }, splitLine: { show: false } },
            { gridIndex: 1, type: 'value', name: 'y [mm]', nameTextStyle: { color: '#ccc' }, axisLabel: { color: '#ccc' }, splitLine: { show: false } },
            { gridIndex: 2, type: 'value', name: 'count',  nameTextStyle: { color: '#ccc' }, axisLabel: { color: '#ccc' }, splitLine: { show: false } },
        ],
        visualMap: [{
            show: false, seriesIndex: 0,
            min: Tmin, max: Tmax,
            inRange: { color: ['#0d0887','#7e03a8','#cc4778','#f89540','#f0f921'] },   // plasma
        }],
        title: [
            { text: 'T_env along path',  left: '4%',  top: '2%', textStyle: { color: '#ddd', fontSize: 12 } },
            { text: `Pore predictions  (keyhole=${khCount}, LOF=${lofCount})`, left: '38%', top: '2%', textStyle: { color: '#ddd', fontSize: 12 } },
            { text: 'T_env distribution', left: '72%', top: '2%', textStyle: { color: '#ddd', fontSize: 12 } },
        ],
        series: [
            // Panel 1 — T_env along scan path
            {
                name: 'T_env', type: 'scatter',
                xAxisIndex: 0, yAxisIndex: 0,
                data: tenvData, symbolSize: 3,
                encode: { x: 0, y: 1, value: 2 },
                large: true, largeThreshold: 2000,
            },
            // Panel 2 — no-pore
            {
                name: 'no pore', type: 'scatter',
                xAxisIndex: 1, yAxisIndex: 1,
                data: noPoreData, symbolSize: 2,
                itemStyle: { color: '#223344', opacity: 0.4 },
                large: true, largeThreshold: 2000,
            },
            // Panel 2 — keyhole pores
            {
                name: 'keyhole', type: 'scatter',
                xAxisIndex: 1, yAxisIndex: 1,
                data: khData, symbolSize: 8,
                itemStyle: { color: 'red' },
            },
            // Panel 2 — LOF pores
            {
                name: 'LOF', type: 'scatter',
                xAxisIndex: 1, yAxisIndex: 1,
                data: lofData, symbolSize: 8,
                itemStyle: { color: 'deepskyblue' },
            },
            // Panel 3 — T_env histogram
            {
                name: 'T_env hist', type: 'bar',
                xAxisIndex: 2, yAxisIndex: 2,
                data: histData,
                barWidth: '100%',
                itemStyle: { color: 'steelblue', opacity: 0.85 },
                markLine: {
                    silent: true,
                    lineStyle: { color: 'red', type: 'dashed', width: 1.5 },
                    label: { formatter: `keyhole ${HS_T_KEYHOLE_CRIT.toFixed(0)} K`, color: 'red', fontSize: 10 },
                    data: [{ xAxis: HS_T_KEYHOLE_CRIT }],
                },
            },
        ],
        legend: {
            data: ['no pore', 'keyhole', 'LOF'],
            top: '2%', left: '53%',
            textStyle: { color: '#ccc', fontSize: 10 },
        },
        tooltip: { show: false },
    };
}
