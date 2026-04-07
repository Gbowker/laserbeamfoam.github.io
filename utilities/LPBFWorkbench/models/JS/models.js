async function main() {
    const parent = document.getElementById("build-plate").parentElement;

    // ── UI buttons ────────────────────────────────────────────────────────────
    const drawBtn = document.createElement("button");
    drawBtn.classList.add("compute-window-select-button");
    drawBtn.textContent = "📐 Draw Square";
    drawBtn.style.cssText = "position: absolute; top: 55px; height:30px; right: 120px; line-height:30px; padding:0px 12px; background: #fff; border: 1px solid #ccc; cursor: pointer; border-radius: 3px; z-index: 9900!important;";
    parent.appendChild(drawBtn);

    const clearBtn = document.createElement("button");
    clearBtn.textContent = "Clear";
    clearBtn.style.cssText = "position: absolute; top: 55px; right: 252px; height:30px;line-height:30px;  padding: 0px 12px; background: #fff; border: 1px solid #ccc; cursor: pointer; border-radius: 3px; z-index: 9900!important;";
    parent.appendChild(clearBtn);

    const coordPanel = document.createElement("div");
    coordPanel.style.cssText = `
        position: absolute; top: 55px; left: 719px;
        display: flex; align-items: center; gap: 4px;
        background: #fff; border: 1px solid #ccc; border-radius: 3px;
        padding: 4px 8px; z-index: 9900; font-size: 12px;
        transform: translateX(-100%); margin-right: 4px;
    `;
    const iStyle = "width: 72px; padding: 2px 4px; border: 1px solid #ccc; border-radius: 2px; font-size: 12px;";
    coordPanel.innerHTML = `
        <span style="font-weight:600">X:</span>
        <input id="sq-xmin" type="number" placeholder="min" style="${iStyle}">
        <span>→</span>
        <input id="sq-xmax" type="number" placeholder="max" style="${iStyle}">
        <span style="font-weight:600; margin-left:6px">Y:</span>
        <input id="sq-ymin" type="number" placeholder="min" style="${iStyle}">
        <span>→</span>
        <input id="sq-ymax" type="number" placeholder="max" style="${iStyle}">
    `;
    parent.appendChild(coordPanel);

    const xminEl = document.getElementById("sq-xmin");
    const xmaxEl = document.getElementById("sq-xmax");
    const yminEl = document.getElementById("sq-ymin");
    const ymaxEl = document.getElementById("sq-ymax");

    // ── Load data ─────────────────────────────────────────────────────────────
    const response = await fetch("models/data/Packet_data_for_layer_150__laser_4.txt");
    const text = await response.text();
    let csvText = text;   // kept for the Run handler below
    const lines = text.trim().split("\n");

    const rows = lines.slice(1)
        .map(line => line.split("\t"))
        .filter(r => r.length > 5 && parseFloat(r[5]) > 0 && isFinite(parseFloat(r[2])) && isFinite(parseFloat(r[3])));

    const data = [];
    for (let i = 0; i < rows.length; i++) {
        if (i > 0) {
            const dt = parseFloat(rows[i][0]) - parseFloat(rows[i - 1][0]);
            const duration = parseFloat(rows[i - 1][1]);
            if (dt > duration * 2) data.push(null);
        }
        data.push([parseFloat(rows[i][2]), parseFloat(rows[i][3])]);
    }

    // ── Chart init ────────────────────────────────────────────────────────────
    const pad = { left: 70, right: 20, top: 30, bottom: 60 };
    const chartElement = document.getElementById("build-plate");
    const chart = echarts.init(chartElement, null, { renderer: "canvas" });

    chart.setOption({
        animation: false,
        animationDuration: 0,
        animationDurationUpdate: 0,
        tooltip: { show: false },
        grid: pad,
        toolbox: {
            iconStyle: { borderColor: "#1a6fcc", borderWidth: 2.5, color: "transparent" },
            emphasis: { iconStyle: { borderColor: "#0d47a1", color: "rgba(26,111,204,0.12)" } },
            feature: {
                restore: { title: "Reset view" }
            }
        },
        xAxis: { type: "value", name: "Demand X", scale: true },
        yAxis: { type: "value", name: "Demand Y", scale: true },
        hoverLayerThreshold: Infinity,
        series: [{
            name: "Laser path", type: "scatter", data: data,
            symbolSize: 2, silent: true,
            large: true,
            largeThreshold: 2000,
            emphasis: { disabled: true }
        }]
    }, { notMerge: true, silent: true });

    // ── Axis range helpers ────────────────────────────────────────────────────
    function getGridDims() {
        return {
            w: chart.getWidth()  - pad.left - pad.right,
            h: chart.getHeight() - pad.top  - pad.bottom
        };
    }

    function getCurrentRanges() {
        const { w, h } = getGridDims();
        const tl = chart.convertFromPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [pad.left,     pad.top]);
        const br = chart.convertFromPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [pad.left + w, pad.top + h]);
        if (!tl || !br) return null;
        return {
            xMin: tl[0], xMax: br[0],
            yMin: br[1], yMax: tl[1],
            xDPP: (br[0] - tl[0]) / w,
            yDPP: (tl[1] - br[1]) / h
        };
    }

    function setRanges(xMin, xMax, yMin, yMax) {
        chart.setOption({
            xAxis: [{ min: xMin, max: xMax }],
            yAxis: [{ min: yMin, max: yMax }]
        });
    }

    // ── Initial 1:1 aspect ratio ──────────────────────────────────────────────
    let initRanges = null;

    function applyInitialAspectRatio() {
        const { w, h } = getGridDims();
        const r = getCurrentRanges();
        if (!r) return;
        const dpp = Math.max((r.xMax - r.xMin) / w, (r.yMax - r.yMin) / h) * 1.05;
        const cx = (r.xMin + r.xMax) / 2;
        const cy = (r.yMin + r.yMax) / 2;
        initRanges = {
            xMin: cx - dpp * w / 2, xMax: cx + dpp * w / 2,
            yMin: cy - dpp * h / 2, yMax: cy + dpp * h / 2
        };
        setRanges(initRanges.xMin, initRanges.xMax, initRanges.yMin, initRanges.yMax);
    }

    chart.on("finished", function onFirstFinish() {
        chart.off("finished", onFirstFinish);
        applyInitialAspectRatio();
    });

    chart.on("restore", () => {
        if (initRanges) {
            setRanges(initRanges.xMin, initRanges.xMax, initRanges.yMin, initRanges.yMax);
            updateHandlePositions();
        }
    });

    // ── rAF-throttled rendering ───────────────────────────────────────────────
    let rafId = null;
    let pendingRanges = null;
    let pendingMarkArea = false;
    let pendingInputSync = false;

    function scheduleFrame() {
        if (rafId) return;
        rafId = requestAnimationFrame(() => {
            rafId = null;

            if (pendingRanges) {
                chart.setOption({
                    xAxis: [{ min: pendingRanges.xMin, max: pendingRanges.xMax }],
                    yAxis: [{ min: pendingRanges.yMin, max: pendingRanges.yMax }]
                });
                pendingRanges = null;
            }

            if (pendingMarkArea) {
                pendingMarkArea = false;
                chart.setOption({
                    series: [{
                        name: "Laser path",
                        markArea: {
                            silent: true,
                            itemStyle: { color: "rgba(0,98,255,0.08)", borderColor: "rgba(0,98,255,0.8)", borderWidth: 2 },
                            data: square ? [[{ coord: [square.xMin, square.yMin] }, { coord: [square.xMax, square.yMax] }]] : []
                        }
                    }]
                });
            }

            updateHandlePositions();
            if (pendingInputSync) { pendingInputSync = false; syncInputs(); }
        });
    }

    function scheduleRanges(xMin, xMax, yMin, yMax) {
        pendingRanges = { xMin, xMax, yMin, yMax };
        scheduleFrame();
    }

    function scheduleSquareRender(syncIn = false) {
        pendingMarkArea = true;
        if (syncIn) pendingInputSync = true;
        scheduleFrame();
    }

    // ── Square state ──────────────────────────────────────────────────────────
    let square = null;

    const CORNERS = [
        { id: "tl", cursor: "nw-resize", px: s => [s.xMin, s.yMax], move: (s, d) => { s.xMin = d[0]; s.yMax = d[1]; } },
        { id: "tr", cursor: "ne-resize", px: s => [s.xMax, s.yMax], move: (s, d) => { s.xMax = d[0]; s.yMax = d[1]; } },
        { id: "bl", cursor: "sw-resize", px: s => [s.xMin, s.yMin], move: (s, d) => { s.xMin = d[0]; s.yMin = d[1]; } },
        { id: "br", cursor: "se-resize", px: s => [s.xMax, s.yMin], move: (s, d) => { s.xMax = d[0]; s.yMin = d[1]; } },
    ];

    const handles = CORNERS.map(c => {
        const h = document.createElement("div");
        h.dataset.corner = c.id;
        h.style.cssText = `
            position: fixed; width: 12px; height: 12px;
            background: white; border: 2px solid rgba(0,98,255,0.9);
            border-radius: 2px; cursor: ${c.cursor};
            z-index: 100000; display: none;
            transform: translate(-50%, -50%); box-sizing: border-box;
        `;
        document.body.appendChild(h);
        return h;
    });

    let onBuildPlateTab = true;

    function getCanvasRect() {
        const canvas = chartElement.querySelector("canvas");
        return (canvas || chartElement).getBoundingClientRect();
    }

    function updateHandlePositions() {
        if (!square || !onBuildPlateTab) { handles.forEach(h => h.style.display = "none"); return; }
        const rect = getCanvasRect();
        CORNERS.forEach((c, i) => {
            const pixel = chart.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, c.px(square));
            if (pixel) {
                handles[i].style.display = "block";
                handles[i].style.left = rect.left + pixel[0] + "px";
                handles[i].style.top  = rect.top  + pixel[1] + "px";
            }
        });
    }

    function syncInputs() {
        if (!square) { xminEl.value = xmaxEl.value = yminEl.value = ymaxEl.value = ""; return; }
        xminEl.value = square.xMin.toFixed(3);
        xmaxEl.value = square.xMax.toFixed(3);
        yminEl.value = square.yMin.toFixed(3);
        ymaxEl.value = square.yMax.toFixed(3);
    }

    // Full square render (used for input changes and final mouseup — not throttled)
    function renderSquare(skipInputSync = false) {
        chart.setOption({
            series: [{
                name: "Laser path",
                markArea: {
                    silent: true,
                    itemStyle: { color: "rgba(0,98,255,0.08)", borderColor: "rgba(0,98,255,0.8)", borderWidth: 2 },
                    data: square ? [[{ coord: [square.xMin, square.yMin] }, { coord: [square.xMax, square.yMax] }]] : []
                }
            }]
        });
        updateHandlePositions();
        if (!skipInputSync) syncInputs();
    }

    // ── Drawing mode ──────────────────────────────────────────────────────────
    let drawingMode = false;
    let isDrawing = false;
    let startClient = null;
    let chartRect = null;

    const overlay = document.createElement("div");
    overlay.style.cssText = `
        position: fixed; pointer-events: none; display: none;
        border: 2px dashed rgba(0,98,255,0.8);
        background: rgba(0,98,255,0.06);
        box-sizing: border-box; z-index: 99999;
    `;
    document.body.appendChild(overlay);

    function setDrawingUIVisible(visible) {
        drawBtn.style.display    = visible ? "" : "none";
        clearBtn.style.display   = visible ? "" : "none";
        coordPanel.style.display = visible ? "flex" : "none";
        if (!visible) handles.forEach(h => h.style.display = "none");
        else updateHandlePositions();
    }

    function toggleDrawingMode() {
        drawingMode = !drawingMode;
        drawBtn.style.background = drawingMode ? "#e8f5e9" : "#fff";
        chartElement.style.cursor = drawingMode ? "crosshair" : "grab";
    }

    drawBtn.addEventListener("click", toggleDrawingMode);
    clearBtn.addEventListener("click", () => { square = null; renderSquare(); });

    function onCoordInput() {
        const xMin = parseFloat(xminEl.value), xMax = parseFloat(xmaxEl.value);
        const yMin = parseFloat(yminEl.value), yMax = parseFloat(ymaxEl.value);
        if ([xMin, xMax, yMin, yMax].some(isNaN)) return;
        square = { xMin, xMax, yMin, yMax };
        renderSquare(true);
    }
    [xminEl, xmaxEl, yminEl, ymaxEl].forEach(el => el.addEventListener("input", onCoordInput));

    // ── Custom wheel zoom ─────────────────────────────────────────────────────
    chartElement.addEventListener("wheel", (e) => {
        e.preventDefault();
        const factor = e.deltaY > 0 ? 1.12 : 1 / 1.12;
        const rect = getCanvasRect();
        const mp = chart.convertFromPixel({ xAxisIndex: 0, yAxisIndex: 0 },
            [e.clientX - rect.left, e.clientY - rect.top]);
        if (!mp) return;
        const r = getCurrentRanges();
        if (!r) return;
        scheduleRanges(
            mp[0] + (r.xMin - mp[0]) * factor,
            mp[0] + (r.xMax - mp[0]) * factor,
            mp[1] + (r.yMin - mp[1]) * factor,
            mp[1] + (r.yMax - mp[1]) * factor
        );
    }, { passive: false });

    // ── Corner handle dragging ────────────────────────────────────────────────
    let draggingCornerIdx = null;
    let dragCanvasRect = null;

    const cornerDragOverlay = document.createElement("div");
    cornerDragOverlay.style.cssText = `
        position: fixed; pointer-events: none; display: none;
        border: 2px solid rgba(0,98,255,0.8);
        background: rgba(0,98,255,0.08);
        box-sizing: border-box; z-index: 99998;
    `;
    document.body.appendChild(cornerDragOverlay);

    function updateCornerDragOverlay() {
        if (!square) { cornerDragOverlay.style.display = "none"; return; }
        const rect = getCanvasRect();
        const tl = chart.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [square.xMin, square.yMax]);
        const br = chart.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [square.xMax, square.yMin]);
        if (!tl || !br) return;
        cornerDragOverlay.style.display = "block";
        cornerDragOverlay.style.left   = (rect.left + Math.min(tl[0], br[0])) + "px";
        cornerDragOverlay.style.top    = (rect.top  + Math.min(tl[1], br[1])) + "px";
        cornerDragOverlay.style.width  = Math.abs(br[0] - tl[0]) + "px";
        cornerDragOverlay.style.height = Math.abs(br[1] - tl[1]) + "px";
    }

    handles.forEach((h, i) => {
        h.addEventListener("mousedown", (e) => {
            e.preventDefault(); e.stopPropagation();
            draggingCornerIdx = i;
            dragCanvasRect = getCanvasRect();
            chart.setOption({ series: [{ name: "Laser path", markArea: { data: [] } }] });
            cornerDragOverlay.style.display = "block";
            updateCornerDragOverlay();
        });
    });

    // ── Pan state ─────────────────────────────────────────────────────────────
    let panState = null;

    window.addEventListener("resize", updateHandlePositions);

    // ── Unified mouse handlers ────────────────────────────────────────────────
    chartElement.addEventListener("mousedown", (e) => {
        if (e.button !== 0 || draggingCornerIdx !== null) return;

        if (drawingMode) {
            e.preventDefault(); e.stopPropagation();
            isDrawing = true;
            startClient = [e.clientX, e.clientY];
            chartRect = getCanvasRect();
            overlay.style.left = e.clientX + "px"; overlay.style.top = e.clientY + "px";
            overlay.style.width = "0px"; overlay.style.height = "0px";
            overlay.style.display = "block";
        } else {
            e.preventDefault();
            const r = getCurrentRanges();
            if (!r) return;
            chartElement.style.cursor = "grabbing";
            panState = {
                startX: e.clientX, startY: e.clientY,
                xMin: r.xMin, xMax: r.xMax,
                yMin: r.yMin, yMax: r.yMax,
                xDPP: r.xDPP, yDPP: r.yDPP
            };
        }
    });

    document.addEventListener("mousemove", (e) => {
        // Corner drag
        if (draggingCornerIdx !== null && square && dragCanvasRect) {
            e.preventDefault();
            const d = chart.convertFromPixel({ xAxisIndex: 0, yAxisIndex: 0 },
                [e.clientX - dragCanvasRect.left, e.clientY - dragCanvasRect.top]);
            if (d) { CORNERS[draggingCornerIdx].move(square, d); updateCornerDragOverlay(); updateHandlePositions(); syncInputs(); }
            return;
        }

        // Pan
        if (panState) {
            e.preventDefault();
            const dx = (panState.startX - e.clientX) * panState.xDPP;
            const dy = (e.clientY - panState.startY) * panState.yDPP;
            scheduleRanges(
                panState.xMin + dx, panState.xMax + dx,
                panState.yMin + dy, panState.yMax + dy
            );
            return;
        }

        // Draw preview
        if (isDrawing && startClient) {
            e.preventDefault();
            overlay.style.left   = Math.min(startClient[0], e.clientX) + "px";
            overlay.style.top    = Math.min(startClient[1], e.clientY) + "px";
            overlay.style.width  = Math.abs(e.clientX - startClient[0]) + "px";
            overlay.style.height = Math.abs(e.clientY - startClient[1]) + "px";
        }
    });

    document.addEventListener("mouseup", (e) => {
        // Corner drag end
        if (draggingCornerIdx !== null) {
            draggingCornerIdx = null; dragCanvasRect = null;
            cornerDragOverlay.style.display = "none";
            syncInputs();
            renderSquare(true);
            return;
        }

        // Pan end
        if (panState) {
            panState = null;
            chartElement.style.cursor = drawingMode ? "crosshair" : "grab";
            return;
        }

        // Draw end
        if (!isDrawing || !startClient || !chartRect) return;
        isDrawing = false;
        overlay.style.display = "none";

        const startPixel = [startClient[0] - chartRect.left, startClient[1] - chartRect.top];
        const endPixel   = [e.clientX      - chartRect.left, e.clientY      - chartRect.top];
        startClient = null; chartRect = null;

        if (Math.abs(endPixel[0] - startPixel[0]) < 5 || Math.abs(endPixel[1] - startPixel[1]) < 5) return;

        const p1 = chart.convertFromPixel({ xAxisIndex: 0, yAxisIndex: 0 }, startPixel);
        const p2 = chart.convertFromPixel({ xAxisIndex: 0, yAxisIndex: 0 }, endPixel);
        if (p1 && p2) {
            square = {
                xMin: Math.min(p1[0], p2[0]), xMax: Math.max(p1[0], p2[0]),
                yMin: Math.min(p1[1], p2[1]), yMax: Math.max(p1[1], p2[1])
            };
            renderSquare();
            toggleDrawingMode();
        }
    });

    // ── Tab switching ─────────────────────────────────────────────────────────
    function switchTab(id) {
        document.querySelectorAll(".tab").forEach(el => el.classList.remove("active-tab"));
        document.getElementById(id).classList.add("active-tab");
        const isBuild = id === "build-plate-tab";
        document.getElementById("build-plate").classList.toggle("hidden", !isBuild);
        document.getElementById("results").classList.toggle("hidden",    id !== "results-tab");
        document.getElementById("animations").classList.toggle("hidden", id !== "animations-tab");
        onBuildPlateTab = isBuild;
        setDrawingUIVisible(isBuild);
    }

    document.querySelectorAll(".tab").forEach(tabEl => {
        tabEl.onclick = () => switchTab(tabEl.id);
    });

    // ── Shared simulation state ───────────────────────────────────────────────
    let _simResult    = null;
    let _isPlaying    = false;
    let _animFrame    = 0;
    let _animInterval = null;
    let _resultsChart = null;

    function typedMax(arr) {
        let m = -Infinity;
        for (let i = 0; i < arr.length; i++) if (arr[i] > m) m = arr[i];
        return m;
    }

    function stopAnimation() {
        if (_animInterval !== null) { clearInterval(_animInterval); _animInterval = null; }
        _isPlaying = false;
    }

    // ── Animations tab ────────────────────────────────────────────────────────
    function setupAnimationsTab(result) {
        stopAnimation();
        const { framesT, framesLaser, NX, NY } = result;
        const animDiv = document.getElementById("animations");
        animDiv.style.cssText = "background:#0e0e0e;overflow:hidden;";
        animDiv.innerHTML = `
            <div style="width:100%;height:100%;display:flex;flex-direction:column;box-sizing:border-box;">
                <div id="anim-status" style="
                    color:#888; padding:5px 12px; font-size:11px; font-family:monospace;
                    flex-shrink:0; background:#111; border-bottom:1px solid #1e1e1e;">
                    ${framesT.length} frames &nbsp;|&nbsp; ${NX}×${NY} grid &nbsp;|&nbsp;
                    cell = ${(result.cell * 1e6).toFixed(1)} µm
                </div>
                <canvas id="anim-canvas" style="
                    flex:1; width:100%; min-height:0; display:block;
                    object-fit:contain; image-rendering:pixelated; image-rendering:crisp-edges;
                    background:#000;"></canvas>
                <div style="
                    display:flex; align-items:center; gap:10px; padding:7px 12px;
                    background:#111; border-top:1px solid #1e1e1e; flex-shrink:0;">
                    <button id="anim-play-btn" title="Play / Pause" style="
                        background:#2e85c7; color:#fff; border:none; border-radius:4px;
                        width:30px; height:30px; font-size:15px; cursor:pointer;
                        flex-shrink:0; line-height:30px; text-align:center;">&#9654;</button>
                    <input id="anim-scrubber" type="range" min="0"
                        max="${framesT.length - 1}" value="0"
                        style="flex:1; accent-color:#2e85c7; cursor:pointer;">
                    <span id="anim-time" style="
                        color:#888; font-size:11px; font-family:monospace;
                        flex-shrink:0; min-width:220px; text-align:right;">
                        t = 0.000 ms
                    </span>
                </div>
            </div>`;

        const canvas    = document.getElementById("anim-canvas");
        const playBtn   = document.getElementById("anim-play-btn");
        const scrubber  = document.getElementById("anim-scrubber");
        const timeLabel = document.getElementById("anim-time");
        const Tmin      = 300;
        const TmaxVis   = result.T_MELT * 1.5;

        function drawFrame(fi) {
            _animFrame = fi;
            scrubber.value = fi;
            const T = framesT[fi];
            const { lx, ly, pwr, t_ms } = framesLaser[fi];

            // 1. Temperature field (inferno colormap)
            renderTempFrame(canvas, T, NX, NY, Tmin, TmaxVis);

            // 2. Melt map as semi-transparent white overlay
            compositeMeltOverlay(canvas, result.framesMelt[fi], NX, NY);

            // 3. Laser circle on top
            const ctx   = canvas.getContext("2d");
            const lxRel = (lx - result.domXmin) / (result.domXmax - result.domXmin);
            const lyRel = (ly - result.domYmin) / (result.domYmax - result.domYmin);
            ctx.strokeStyle = pwr > 0 ? "cyan" : "#555";
            ctx.lineWidth   = 0.8;
            ctx.beginPath();
            ctx.arc(lxRel * (NX - 1), (1 - lyRel) * (NY - 1),
                    result.rEff / result.cell, 0, Math.PI * 2);
            ctx.stroke();

            timeLabel.textContent =
                `t = ${t_ms.toFixed(3)} ms  |  P = ${pwr.toFixed(0)} W  |` +
                `  T_max = ${typedMax(T).toFixed(0)} K`;
        }

        function startPlayback() {
            _isPlaying = true;
            playBtn.innerHTML = "&#9646;&#9646;";   // ⏸
            _animInterval = setInterval(() => {
                _animFrame = (_animFrame + 1) % framesT.length;
                drawFrame(_animFrame);
            }, 40);
        }

        function pausePlayback() {
            stopAnimation();
            playBtn.innerHTML = "&#9654;";   // ▶
        }

        playBtn.addEventListener("click", () => {
            if (_isPlaying) pausePlayback(); else startPlayback();
        });

        scrubber.addEventListener("input", () => {
            pausePlayback();
            drawFrame(parseInt(scrubber.value, 10));
        });

        drawFrame(0);
        // Start paused — user presses ▶ to begin
    }

    // ── Results tab ───────────────────────────────────────────────────────────
    function setupResultsTab(result) {
        if (_resultsChart) { _resultsChart.dispose(); _resultsChart = null; }

        const resultsDiv = document.getElementById("results");
        resultsDiv.style.cssText = "background:#0e0e0e;overflow:hidden;";
        resultsDiv.innerHTML = `
            <div style="width:100%;height:100%;display:flex;flex-direction:column;box-sizing:border-box;">
                <div style="
                    display:flex; align-items:center; gap:10px; padding:7px 12px;
                    background:#111; border-bottom:1px solid #1e1e1e; flex-shrink:0;">
                    <span style="color:#888; font-size:12px; font-family:monospace;">View:</span>
                    <select id="results-select" style="
                        background:#1e1e1e; color:#ccc; border:1px solid #333;
                        border-radius:4px; padding:4px 10px; font-size:12px; cursor:pointer;">
                        <option value="melt">Melt Map</option>
                        <option value="pore">Pore Predictions &amp; T_env</option>
                    </select>
                </div>
                <div id="results-content" style="flex:1; min-height:0; position:relative;"></div>
            </div>`;

        const dropdown = document.getElementById("results-select");
        const content  = document.getElementById("results-content");

        function showMeltMap() {
            if (_resultsChart) { _resultsChart.dispose(); _resultsChart = null; }
            content.innerHTML = `
                <div style="width:100%;height:100%;display:flex;flex-direction:column;
                             align-items:center;justify-content:center;gap:8px;box-sizing:border-box;">
                    <canvas id="res-melt-canvas" style="
                        max-width:92%; max-height:88%;
                        image-rendering:pixelated; image-rendering:crisp-edges;
                        object-fit:contain; display:block;"></canvas>
                    <span style="color:#555; font-size:10px; font-family:monospace;">
                        Final melt map — orange = melted (T &gt; ${result.T_MELT.toFixed(0)} K)
                    </span>
                </div>`;
            renderMeltFrame(
                document.getElementById("res-melt-canvas"),
                result.meltMap, result.NX, result.NY
            );
        }

        function showPoreMap() {
            content.innerHTML = `<div id="res-echarts" style="width:100%;height:100%;"></div>`;
            if (_resultsChart) _resultsChart.dispose();
            _resultsChart = echarts.init(document.getElementById("res-echarts"));
            _resultsChart.setOption(buildPoreScatterOption(result));
        }

        dropdown.addEventListener("change", () => {
            if (dropdown.value === "melt") showMeltMap(); else showPoreMap();
        });

        showMeltMap();   // default view
    }

    // ── Run button ────────────────────────────────────────────────────────────
    document.getElementById("run_simulation").addEventListener("click", async () => {
        const wxmin = parseFloat(xminEl.value);
        const wxmax = parseFloat(xmaxEl.value);
        const wymin = parseFloat(yminEl.value);
        const wymax = parseFloat(ymaxEl.value);

        if ([wxmin, wxmax, wymin, wymax].some(isNaN)) {
            alert("Please draw a selection window on the build plate first.");
            return;
        }

        const laserPower   = parseFloat(document.getElementById("laser_power_body").value)  || 195;
        const beamRadiusUm = parseFloat(document.getElementById("beam_radius_input").value) || 37.5;

        stopAnimation();
        switchTab("animations-tab");

        // Show spinner while computing
        const animDiv = document.getElementById("animations");
        animDiv.style.cssText = "background:#0e0e0e;overflow:hidden;";
        // Circumference of r=44 circle ≈ 276.5
        animDiv.innerHTML = `
            <style>
                @keyframes hs-spin { to { transform: rotate(360deg); } }
            </style>
            <div style="width:100%;height:100%;display:flex;flex-direction:column;
                        align-items:center;justify-content:center;gap:18px;">
                <div style="position:relative;width:120px;height:120px;">
                    <!-- Track ring -->
                    <svg style="position:absolute;inset:0;width:100%;height:100%;"
                         viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="44" fill="none"
                            stroke="#1c1c1c" stroke-width="6"/>
                        <!-- Progress arc (stroke-dashoffset updated via JS) -->
                        <circle id="prog-arc" cx="50" cy="50" r="44" fill="none"
                            stroke="#2e85c7" stroke-width="6" stroke-linecap="round"
                            stroke-dasharray="276.5" stroke-dashoffset="276.5"
                            transform="rotate(-90 50 50)"
                            style="transition:stroke-dashoffset 0.25s ease;"/>
                    </svg>
                    <!-- Spinning highlight dot -->
                    <svg style="position:absolute;inset:0;width:100%;height:100%;
                                animation:hs-spin 1.4s linear infinite;"
                         viewBox="0 0 100 100">
                        <circle cx="50" cy="6" r="3.5" fill="#2e85c7" opacity="0.9"/>
                    </svg>
                    <!-- Percentage label -->
                    <div id="prog-pct" style="position:absolute;inset:0;display:flex;
                        align-items:center;justify-content:center;
                        color:#d0d0d0;font-size:22px;font-family:monospace;font-weight:bold;">
                        0%
                    </div>
                </div>
                <!-- Status line -->
                <div id="prog-label" style="
                    color:#555; font-size:11px; font-family:monospace;
                    text-align:center; max-width:320px; line-height:1.6;">
                    Preparing simulation…
                </div>
            </div>`;

        const progArc   = document.getElementById("prog-arc");
        const progPct   = document.getElementById("prog-pct");
        const progLabel = document.getElementById("prog-label");

        try {
            const result = await runHeatDiffusion(
                csvText,
                {
                    wxmin, wxmax, wymin, wymax,
                    pulsePower:    laserPower,
                    pulseDuration: 50e-6,
                    laserRadius:   beamRadiusUm * 1e-6,
                },
                ({ pct, Tmax, nPores }) => {
                    // Circumference 276.5 — offset goes from 276.5 (0%) to 0 (100%)
                    if (progArc) progArc.setAttribute("stroke-dashoffset",
                        (276.5 * (1 - pct / 100)).toFixed(1));
                    if (progPct)   progPct.textContent   = pct + "%";
                    if (progLabel) progLabel.innerHTML   =
                        `T_max = ${Tmax} K &nbsp;|&nbsp; pores = ${nPores}`;
                }
            );

            if (result.framesT.length === 0) throw new Error("Simulation produced no frames.");

            setupAnimationsTab(result);
            setupResultsTab(result);

        } catch (err) {
            animDiv.innerHTML = `
                <div style="color:#f66;font-size:13px;font-family:monospace;padding:24px;">
                    Error: ${err.message}
                </div>`;
        }
    });
}
main();