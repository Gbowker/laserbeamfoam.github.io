async function main() {
    const parent = document.getElementById("build-plate").parentElement;

    // ── UI buttons ────────────────────────────────────────────────────────────
    const drawBtn = document.createElement("button");
    drawBtn.classList.add("compute-window-select-button");
    drawBtn.textContent = "📐 Draw Square";
    drawBtn.style.cssText = "position: absolute; top: 55px; right: 120px; padding: 8px 12px; background: #fff; border: 1px solid #ccc; cursor: pointer; border-radius: 3px; z-index: 9900!important;";
    parent.appendChild(drawBtn);

    const clearBtn = document.createElement("button");
    clearBtn.textContent = "Clear";
    clearBtn.style.cssText = "position: absolute; top: 55px; right: 220px; padding: 8px 12px; background: #fff; border: 1px solid #ccc; cursor: pointer; border-radius: 3px; z-index: 9900!important;";
    parent.appendChild(clearBtn);

    const coordPanel = document.createElement("div");
    coordPanel.style.cssText = `
        position: absolute; top: 55px; right: 290px;
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
        series: [{
            name: "Laser path", type: "line", data: data,
            showSymbol: false, connectNulls: false, silent: true
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

    handles.forEach((h, i) => {
        h.addEventListener("mousedown", (e) => {
            e.preventDefault(); e.stopPropagation();
            draggingCornerIdx = i;
            dragCanvasRect = getCanvasRect();
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
            if (d) { CORNERS[draggingCornerIdx].move(square, d); scheduleSquareRender(true); }
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
            syncInputs(); return;
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
        }
    });

    // ── Tab switching ─────────────────────────────────────────────────────────
    document.querySelectorAll(".tab").forEach(tabEl => {
        tabEl.onclick = () => {
            document.querySelectorAll(".tab").forEach(el => el.classList.remove("active-tab"));
            tabEl.classList.add("active-tab");

            if (tabEl.id === "build-plate-tab") {
                onBuildPlateTab = true;
                document.getElementById("build-plate").classList.remove("hidden");
                document.getElementById("results").classList.add("hidden");
                setDrawingUIVisible(true);
            } else if (tabEl.id === "results-tab") {
                onBuildPlateTab = false;
                document.getElementById("results").classList.remove("hidden");
                document.getElementById("build-plate").classList.add("hidden");
                setDrawingUIVisible(false);
            } else if (tabEl.id === "documentation-tab") {
                onBuildPlateTab = false;
                document.getElementById("build-plate").classList.add("hidden");
                document.getElementById("results").classList.add("hidden");
                setDrawingUIVisible(false);
            }
        };
    });
}
main();