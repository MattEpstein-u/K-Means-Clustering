const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const kSlider = document.getElementById('k-slider');
const kValueDisplay = document.getElementById('k-value-display');
const numPointsInput = document.getElementById('num-points');
const generateDataBtn = document.getElementById('generate-data');
const startBtn = document.getElementById('start-algorithm');
const nextStepBtn = document.getElementById('next-step');
const dataMethodSelect = document.getElementById('data-method');


let points = [];
let centroids = [];
let clusters = [];
let k = parseInt(kSlider.value);
let numPoints = parseInt(numPointsInput.value);
let animationFrameId;
let iteration = 0;
let algorithmState = 'initial'; // initial, started, step, finished

const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080', '#008000', '#800000'];

// --- Event Listeners ---
generateDataBtn.addEventListener('click', () => {
    reset();
    generateData();
    draw();
});

startBtn.addEventListener('click', () => {
    if (points.length === 0) {
        alert("Please generate data first.");
        return;
    }
    startAlgorithm();
});

nextStepBtn.addEventListener('click', () => {
    if (points.length === 0) {
        alert("Please generate data first.");
        return;
    }
    if (algorithmState === 'initial') {
        startAlgorithm();
    } else if (algorithmState === 'step') {
        runSingleStep();
    }
    draw();
});

kSlider.addEventListener('input', () => {
    kValueDisplay.textContent = kSlider.value;
    k = parseInt(kSlider.value);
});

numPointsInput.addEventListener('change', () => {
    let value = parseInt(numPointsInput.value);
    if (isNaN(value) || value < 10) {
        value = 10;
    } else if (value > 1000) {
        value = 1000;
    }
    numPointsInput.value = value;
    numPoints = value;

    if (points.length > 0) {
        reset();
        generateData();
        draw();
    }
});


// --- Core Functions ---

function generateData() {
    points = [];
    const method = dataMethodSelect ? dataMethodSelect.value : 'uniform';
    if (method === 'uniform') {
        for (let i = 0; i < numPoints; i++) {
            points.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                cluster: -1
            });
        }
    } else if (method === 'gaussian') {
        // Gaussian distribution centered in the middle
        const meanX = canvas.width / 2;
        const meanY = canvas.height / 2;
        const stdDevX = canvas.width / 6;
        const stdDevY = canvas.height / 6;
        for (let i = 0; i < numPoints; i++) {
            points.push({
                x: gaussianRandom(meanX, stdDevX),
                y: gaussianRandom(meanY, stdDevY),
                cluster: -1
            });
        }
    } else if (method === 'clusters') {
        // Generate a few random cluster centers, then sample points around them
        const numClusters = Math.min(5, Math.max(2, Math.floor(numPoints / 30)));
        const clusterCenters = [];
        for (let i = 0; i < numClusters; i++) {
            clusterCenters.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height
            });
        }
        for (let i = 0; i < numPoints; i++) {
            const center = clusterCenters[Math.floor(Math.random() * numClusters)];
            points.push({
                x: gaussianRandom(center.x, canvas.width / 15),
                y: gaussianRandom(center.y, canvas.height / 15),
                cluster: -1
            });
        }
    }
    algorithmState = 'initial';
    iteration = 0;

    // --- Elbow Plot ---
    calculateElbowPlot();
    drawElbowPlot();
}

function gaussianRandom(mean, stddev) {
    // Box-Muller transform
    let u = 0, v = 0;
    while(u === 0) u = Math.random(); // Converting [0,1) to (0,1)
    while(v === 0) v = Math.random();
    let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return mean + num * stddev;
}

function startAlgorithm() {
    iteration = 0;
    initializeCentroids();
    assignPointsToClusters();
    algorithmState = 'step';
    draw();
}


function runSingleStep() {
    if (algorithmState !== 'step') return;

    iteration++;

    const centroidsMoved = updateCentroids();
    assignPointsToClusters();
    draw();

    if (!centroidsMoved) {
        algorithmState = 'finished';
        updateButtons();
        alert(`Clustering converged after ${iteration} iterations.`);
    }
}

function runAlgorithm() {
    if (algorithmState !== 'step') return;

    const centroidsMoved = updateCentroids();
    assignPointsToClusters();
    iteration++;
    draw();


    if (!centroidsMoved || iteration > 100) { // Add iteration limit to prevent infinite loops
        algorithmState = 'finished';
        updateButtons();
        alert(`Clustering converged after ${iteration} iterations.`);
        cancelAnimationFrame(animationFrameId);
    } else {
       animationFrameId = requestAnimationFrame(runAlgorithm);
    }
}


function reset() {
    cancelAnimationFrame(animationFrameId);
    points = [];
    centroids = [];
    clusters = [];
    iteration = 0;
    algorithmState = 'initial';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    updateButtons();
}

function resetClustering() {
    cancelAnimationFrame(animationFrameId);
    centroids = [];
    clusters = [];
    iteration = 0;
    algorithmState = 'initial';
    for (const point of points) {
        point.cluster = -1;
    }
    updateButtons();
    draw();
}

function initializeCentroids() {
    centroids = [];
    for (let i = 0; i < k; i++) {
        centroids.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height
        });
    }
}

function assignPointsToClusters() {
    clusters = Array.from({ length: k }, () => []);
    for (const point of points) {
        let minDistance = Infinity;
        let closestCentroidIndex = -1;
        for (let i = 0; i < k; i++) {
            const dist = distance(point, centroids[i]);
            if (dist < minDistance) {
                minDistance = dist;
                closestCentroidIndex = i;
            }
        }
        point.cluster = closestCentroidIndex;
        if (closestCentroidIndex !== -1) {
            clusters[closestCentroidIndex].push(point);
        }
    }
}


function updateCentroids() {
    let moved = false;
    for (let i = 0; i < k; i++) {
        if (clusters[i] && clusters[i].length > 0) {
            const clusterPoints = clusters[i];
            const sumX = clusterPoints.reduce((sum, p) => sum + p.x, 0);
            const sumY = clusterPoints.reduce((sum, p) => sum + p.y, 0);
            const newCentroid = {
                x: sumX / clusterPoints.length,
                y: sumY / clusterPoints.length
            };

            if (distance(centroids[i], newCentroid) > 0.1) { // Check for significant movement
                moved = true;
            }
            centroids[i] = newCentroid;
        }
    }
    return moved;
}


// --- Drawing Functions ---

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw points
    for (const point of points) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = point.cluster === -1 ? '#000' : colors[point.cluster % colors.length];
        ctx.fill();
    }

    // Draw centroids
    for (let i = 0; i < centroids.length; i++) {
        ctx.beginPath();
        ctx.arc(centroids[i].x, centroids[i].y, 8, 0, 2 * Math.PI);
        ctx.fillStyle = colors[i % colors.length];
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();

        // Draw a cross on the centroid
        ctx.beginPath();
        ctx.moveTo(centroids[i].x - 8, centroids[i].y);
        ctx.lineTo(centroids[i].x + 8, centroids[i].y);
        ctx.moveTo(centroids[i].x, centroids[i].y - 8);
        ctx.lineTo(centroids[i].x, centroids[i].y + 8);
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }
}

// --- Elbow Plot ---
const elbowCanvas = document.getElementById('elbow-canvas');
const elbowCtx = elbowCanvas.getContext('2d');
let elbowData = [];
let elbowClusterings = {};
let selectedK = null;

function calculateElbowPlot() {
    elbowData = [];
    elbowClusterings = {};
    const minK = parseInt(kSlider.min);
    const maxK = parseInt(kSlider.max);
    for (let testK = minK; testK <= maxK; testK++) {
        // Deep copy points
        const testPoints = points.map(p => ({...p}));
        // Run K-Means for this k
        let testCentroids = [];
        for (let i = 0; i < testK; i++) {
            testCentroids.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height
            });
        }
        let testClusters = Array.from({ length: testK }, () => []);
        let moved = true;
        let iter = 0;
        while (moved && iter < 100) {
            // Assign points
            testClusters = Array.from({ length: testK }, () => []);
            for (const point of testPoints) {
                let minDist = Infinity;
                let closest = -1;
                for (let i = 0; i < testK; i++) {
                    const dist = distance(point, testCentroids[i]);
                    if (dist < minDist) {
                        minDist = dist;
                        closest = i;
                    }
                }
                point.cluster = closest;
                testClusters[closest].push(point);
            }
            // Update centroids
            moved = false;
            for (let i = 0; i < testK; i++) {
                if (testClusters[i].length > 0) {
                    const sumX = testClusters[i].reduce((sum, p) => sum + p.x, 0);
                    const sumY = testClusters[i].reduce((sum, p) => sum + p.y, 0);
                    const newCentroid = {
                        x: sumX / testClusters[i].length,
                        y: sumY / testClusters[i].length
                    };
                    if (distance(testCentroids[i], newCentroid) > 0.1) {
                        moved = true;
                    }
                    testCentroids[i] = newCentroid;
                }
            }
            iter++;
        }
        // Calculate inertia
        let inertia = 0;
        for (const point of testPoints) {
            inertia += Math.pow(distance(point, testCentroids[point.cluster]), 2);
        }
        elbowData.push({ k: testK, inertia });
        // Save clustering for this k
        elbowClusterings[testK] = {
            points: testPoints.map(p => ({...p})),
            centroids: testCentroids.map(c => ({...c}))
        };
    }
}

// --- Utility for elbow plot scaling ---
function getElbowX(k, minK, maxK, w, margin) {
    if (maxK === minK) return w / 2;
    return margin + ((k - minK) / (maxK - minK)) * (w - 2 * margin);
}

function drawElbowPlot() {
    elbowCtx.clearRect(0, 0, elbowCanvas.width, elbowCanvas.height);
    if (elbowData.length === 0) return;
    const minK = Math.min(...elbowData.map(d => d.k));
    const maxK = Math.max(...elbowData.map(d => d.k));
    const minInertia = Math.min(...elbowData.map(d => d.inertia));
    const maxInertia = Math.max(...elbowData.map(d => d.inertia));
    const margin = 40;
    const w = elbowCanvas.width;
    const h = elbowCanvas.height;
    // Draw axes
    elbowCtx.strokeStyle = '#333';
    elbowCtx.lineWidth = 2;
    elbowCtx.beginPath();
    elbowCtx.moveTo(margin, h - margin);
    elbowCtx.lineTo(margin, margin);
    elbowCtx.lineTo(w - margin, margin);
    elbowCtx.stroke();
    // Draw lines
    elbowCtx.strokeStyle = '#0077cc';
    elbowCtx.lineWidth = 2;
    elbowCtx.beginPath();
    elbowData.forEach((d, i) => {
        const x = getElbowX(d.k, minK, maxK, w, margin);
        const y = h - margin - ((d.inertia - minInertia) / (maxInertia - minInertia)) * (h - 2 * margin);
        if (i === 0) {
            elbowCtx.moveTo(x, y);
        } else {
            elbowCtx.lineTo(x, y);
        }
    });
    elbowCtx.stroke();
    // Draw points (normal size)
    elbowData.forEach((d, i) => {
        const x = getElbowX(d.k, minK, maxK, w, margin);
        const y = h - margin - ((d.inertia - minInertia) / (maxInertia - minInertia)) * (h - 2 * margin);
        elbowCtx.beginPath();
        elbowCtx.arc(x, y, 7, 0, 2 * Math.PI); // radius 7
        elbowCtx.fillStyle = (selectedK === d.k) ? '#ff6600' : '#0077cc';
        elbowCtx.fill();
        elbowCtx.strokeStyle = '#333';
        elbowCtx.stroke();
        // Draw k label
        elbowCtx.fillStyle = '#333';
        elbowCtx.font = '14px Arial';
        elbowCtx.fillText(d.k, x - 7, h - margin + 20);
    });
    // Draw axis labels
    elbowCtx.fillStyle = '#333';
    elbowCtx.font = '16px Arial';
    elbowCtx.fillText('k', w / 2, h - 5);
    elbowCtx.save();
    elbowCtx.translate(10, h / 2);
    elbowCtx.rotate(-Math.PI / 2);
    elbowCtx.fillText('Inertia', 0, 0);
    elbowCtx.restore();
}

elbowCanvas.addEventListener('click', function(e) {
    console.log('elbowCanvas click event fired');
    if (elbowData.length === 0) return;
    const rect = elbowCanvas.getBoundingClientRect();
    console.log('Bounding rect:', rect);
    console.log('Canvas size:', elbowCanvas.width, elbowCanvas.height);
    console.log('Raw event coordinates:', e.clientX, e.clientY);
    const scaleX = elbowCanvas.width / rect.width;
    const scaleY = elbowCanvas.height / rect.height;
    const xClick = (e.clientX - rect.left) * scaleX;
    const yClick = (e.clientY - rect.top) * scaleY;
    console.log('Click coordinates (canvas space):', xClick, yClick);
    const minK = Math.min(...elbowData.map(d => d.k));
    const maxK = Math.max(...elbowData.map(d => d.k));
    const minInertia = Math.min(...elbowData.map(d => d.inertia));
    const maxInertia = Math.max(...elbowData.map(d => d.inertia));
    const margin = 40;
    const w = elbowCanvas.width;
    const h = elbowCanvas.height;
    let found = false;
    for (const d of elbowData) {
        const x = getElbowX(d.k, minK, maxK, w, margin);
        const y = h - margin - ((d.inertia - minInertia) / (maxInertia - minInertia)) * (h - 2 * margin);
        console.log(`Elbow point for k=${d.k}: (${x}, ${y})`);
        if (Math.pow(xClick - x, 2) + Math.pow(yClick - y, 2) < 400) { // radius 20 for debugging
            selectedK = d.k;
            console.log(`Selected elbow point k=${selectedK} at (${x}, ${y})`);
            if (elbowClusterings[selectedK]) {
                points = elbowClusterings[selectedK].points.map(p => ({...p}));
                centroids = elbowClusterings[selectedK].centroids.map(c => ({...c}));
                k = selectedK;
            }
            found = true;
            break;
        }
    }
    if (found) {
        draw();
        drawElbowPlot();
    } else {
        console.log('No elbow point found near click.');
    }
});

// Update generateData to recalculate elbow plot
const originalGenerateData = generateData;
generateData = function() {
    originalGenerateData();
    calculateElbowPlot();
    selectedK = null;
    drawElbowPlot();
}

// Update draw to always call drawElbowPlot
const originalDraw = draw;
draw = function() {
    originalDraw();
    drawElbowPlot();
}

// --- Utility Functions ---

function distance(p1, p2) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

function updateButtons() {
    startBtn.disabled = algorithmState !== 'initial' && algorithmState !== 'finished';
    nextStepBtn.disabled = algorithmState === 'finished' || algorithmState === 'started';
    generateDataBtn.disabled = algorithmState === 'started';
}


// --- Initial Setup ---
generateData();
draw();
updateButtons();

window.onload = function() {
    elbowCanvas.onclick = null; // Remove any previous handler
    elbowCanvas.addEventListener('click', function(e) {
        console.log('elbowCanvas click event fired');
        if (elbowData.length === 0) return;
        const rect = elbowCanvas.getBoundingClientRect();
        console.log('Bounding rect:', rect);
        console.log('Canvas size:', elbowCanvas.width, elbowCanvas.height);
        console.log('Raw event coordinates:', e.clientX, e.clientY);
        const scaleX = elbowCanvas.width / rect.width;
        const scaleY = elbowCanvas.height / rect.height;
        const xClick = (e.clientX - rect.left) * scaleX;
        const yClick = (e.clientY - rect.top) * scaleY;
        console.log('Click coordinates (canvas space):', xClick, yClick);
        const minK = Math.min(...elbowData.map(d => d.k));
        const maxK = Math.max(...elbowData.map(d => d.k));
        const minInertia = Math.min(...elbowData.map(d => d.inertia));
        const maxInertia = Math.max(...elbowData.map(d => d.inertia));
        const margin = 40;
        const w = elbowCanvas.width;
        const h = elbowCanvas.height;
        let found = false;
        for (const d of elbowData) {
            const x = getElbowX(d.k, minK, maxK, w, margin);
            const y = h - margin - ((d.inertia - minInertia) / (maxInertia - minInertia)) * (h - 2 * margin);
            if (Math.pow(xClick - x, 2) + Math.pow(yClick - y, 2) < 400) { // radius 20 for debugging
                selectedK = d.k;
                console.log(`Selected elbow point k=${selectedK} at (${x}, ${y})`);
                if (elbowClusterings[selectedK]) {
                    points = elbowClusterings[selectedK].points.map(p => ({...p}));
                    centroids = elbowClusterings[selectedK].centroids.map(c => ({...c}));
                    k = selectedK;
                }
                found = true;
                break;
            }
        }
        if (found) {
            draw();
            drawElbowPlot();
        } else {
            console.log('No elbow point found near click.');
        }
    });
}
