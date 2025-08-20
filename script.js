const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const kSlider = document.getElementById('k-slider');
const kValueDisplay = document.getElementById('k-value-display');
const numPointsInput = document.getElementById('num-points');
const generateDataBtn = document.getElementById('generate-data');
const startBtn = document.getElementById('start-algorithm');
const nextStepBtn = document.getElementById('next-step');
const iterationInfo = document.getElementById('iteration-info');


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
});

kSlider.addEventListener('change', () => {
    k = parseInt(kSlider.value);
    if (points.length > 0) {
        resetClustering();
    }
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
    for (let i = 0; i < numPoints; i++) {
        points.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            cluster: -1
        });
    }
    algorithmState = 'initial';
    iteration = 0;
    updateIterationInfo();
}

function startAlgorithm() {
    iteration = 0;
    initializeCentroids();
    assignPointsToClusters();
    algorithmState = 'step';
    updateIterationInfo();
    updateButtons();
    draw();
}


function runSingleStep() {
    if (algorithmState !== 'step') return;

    iteration++;
    updateIterationInfo();

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
    updateIterationInfo();
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
    updateIterationInfo();
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
    updateIterationInfo();
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

// --- Utility Functions ---

function distance(p1, p2) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

function updateIterationInfo() {
    iterationInfo.textContent = `Iteration: ${iteration}`;
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
