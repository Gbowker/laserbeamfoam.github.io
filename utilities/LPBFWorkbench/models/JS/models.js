async function main() {
    const response = await fetch("models/data/Packet_data_for_layer_150__laser_4.txt");
    const text = await response.text();

    const lines = text.trim().split("\n");

    // Skip header row (index 0), parse tab-separated columns
    const rows = lines.slice(1)
        .map(line => line.split("\t"))
        .filter(r => r.length > 5 && parseFloat(r[5]) > 0 && isFinite(parseFloat(r[2])) && isFinite(parseFloat(r[3])));

    // Build data with nulls inserted at time gaps (laser jumps between scan tracks)
    const data = [];
    for (let i = 0; i < rows.length; i++) {
        if (i > 0) {
            const dt = parseFloat(rows[i][0]) - parseFloat(rows[i - 1][0]);
            const duration = parseFloat(rows[i - 1][1]);
            if (dt > duration * 2) data.push(null);  // gap = jump, break the line
        }
        data.push([parseFloat(rows[i][2]), parseFloat(rows[i][3])]);
    }

    const pad = { left: 70, right: 20, top: 30, bottom: 60 };

    const chart = echarts.init(document.getElementById("build-plate"), null, { renderer: "canvas" });
    chart.setOption({
        animation: false,
        animationDuration: 0,
        animationDurationUpdate: 0,
        tooltip: { show: false },
        grid: pad,
        toolbox: {
            feature: {
                dataZoom: { yAxisIndex: "all", title: { zoom: "Box zoom", back: "Reset zoom" } },
                restore: { title: "Reset" }
            }
        },
        xAxis: { type: "value", name: "Demand X", scale: true },
        yAxis: { type: "value", name: "Demand Y", scale: true },
        dataZoom: [
            { type: "inside", xAxisIndex: 0 },
            { type: "inside", yAxisIndex: 0 }
        ],
        series: [
            { name: "Laser path", type: "line", data: data, showSymbol: false, connectNulls: false, silent: true }
        ]
    }, { notMerge: true, silent: true });

    let adjusting = false;
    function enforceAspectRatio() {
        if (adjusting) return;
        adjusting = true;

        const gridW = chart.getWidth() - pad.left - pad.right;
        const gridH = chart.getHeight() - pad.top - pad.bottom;
        const gCx = pad.left + gridW / 2;
        const gCy = pad.top + gridH / 2;

        const p0 = chart.convertFromPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [gCx, gCy]);
        const px = chart.convertFromPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [gCx + 10, gCy]);
        const py = chart.convertFromPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [gCx, gCy + 10]);

        if (p0 && px && py) {
            const xDPP = Math.abs(px[0] - p0[0]) / 10;  // data units per pixel, x
            const yDPP = Math.abs(py[1] - p0[1]) / 10;  // data units per pixel, y
            const ratio = xDPP / yDPP;

            if (Math.abs(ratio - 1) > 0.005) {
                if (ratio > 1) {
                    const newYRange = xDPP * gridH;
                    chart.setOption({ yAxis: [{ min: p0[1] - newYRange / 2, max: p0[1] + newYRange / 2 }] });
                } else {
                    const newXRange = yDPP * gridW;
                    chart.setOption({ xAxis: [{ min: p0[0] - newXRange / 2, max: p0[0] + newXRange / 2 }] });
                }
            }
        }

        adjusting = false;
    }

    chart.on('datazoom', enforceAspectRatio);
}
main();


// Get all divs with class "tab" and set onclick event
document.querySelectorAll('.tab').forEach(function(tabEl) {
    tabEl.onclick = function() {
        // Remove 'active-tab' class from all tabs
        document.querySelectorAll('.tab').forEach(function(el) {
            el.classList.remove('active-tab');
        });
        // Add 'active-tab' to the clicked tab
        tabEl.classList.add('active-tab');

    // INSERT_YOUR_CODE
    // If the clicked tab's id is 'results-tab', do something
    if (tabEl.id === "results-tab") {
        // Example: Show an alert or run custom logic
        // alert("Results tab clicked!"); // Example, replace with needed functionality
        // Example: Show the results window, hide others
        document.getElementById('results').classList.remove('hidden');
        document.getElementById('build-plate').classList.add('hidden');
        document.getElementById('documentation').classList.add('hidden');
    } else if (tabEl.id === "build-plate-tab") {
        document.getElementById('build-plate').classList.remove('hidden');
        document.getElementById('results').classList.add('hidden');
        document.getElementById('documentation').classList.add('hidden');
    } else if (tabEl.id === "documentation-tab") {
        document.getElementById('documentation').classList.remove('hidden');
        document.getElementById('build-plate').classList.add('hidden');
        document.getElementById('results').classList.add('hidden');
    }



    };
});