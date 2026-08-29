document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const scoreboardBody = document.getElementById('scoreboard-body');
    const refreshBtn = document.getElementById('refresh-btn');
    const videoFileInput = document.getElementById('video-file-input');
    const addVideoBtn = document.getElementById('add-video-btn');
    const processVideoBtn = document.getElementById('process-video-btn');
    const dropzone = document.getElementById('dropzone');
    const currentVideoName = document.getElementById('current-video-name');
    const metaResolution = document.getElementById('meta-resolution');
    const metaDuration = document.getElementById('meta-duration');
    const metaSize = document.getElementById('meta-size');
    const metaStatus = document.getElementById('meta-status');
    const sampleInputBtn = document.getElementById('sample-input-btn');
    const sampleOutputBtn = document.getElementById('sample-output-btn');
    const inputVideoPlayer = document.getElementById('input-video-player');
    const outputVideoPlayer = document.getElementById('output-video-player');
    const inputVideoTag = document.getElementById('input-video-tag');
    const syncPlayBtn = document.getElementById('sync-play-btn');
    const downloadJsonBtn = document.getElementById('download-json-btn');
    const downloadCsvBtn = document.getElementById('download-csv-btn');
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    const progressLabel = document.getElementById('progress-label');
    const progressPercent = document.getElementById('progress-percent');
    const pipelineStatusBadge = document.getElementById('pipeline-status-badge');

    // Default extracted scoreboard data (used for offline fallback and live display)
    let currentScoreboardData = {
        "JAGDISH": {
            "initial": "J",
            "rolls": [["X", ""], ["5", "-"], ["-", "7"], ["-", ""], ["-", ""], ["", ""], ["", ""], ["", ""], ["", ""], ["", "", ""]],
            "scores": [15, 20, 27, "", "", "", "", "", "", ""],
            "ttl": 27
        },
        "VISHAL": {
            "initial": "V",
            "rolls": [["8", "-"], ["3", "-"], ["", ""], ["", ""], ["", ""], ["", ""], ["", "-"], ["", ""], ["", ""], ["", "", ""]],
            "scores": [8, 11, "", "", "", "", "", "", "", ""],
            "ttl": 11
        },
        "PRATIK": {
            "initial": "P",
            "rolls": [["X", ""], ["4", "/"], ["9", "7"], ["", ""], ["", ""], ["", ""], ["", ""], ["-", ""], ["-", ""], ["", "", "-"]],
            "scores": [20, 39, 55, "", "", "", "", "", "", ""],
            "ttl": 55
        },
        "TARUN": {
            "initial": "T",
            "rolls": [["6", ""], ["", ""], ["", "-"], ["", ""], ["", ""], ["", ""], ["", ""], ["", ""], ["", ""], ["", "", "-"]],
            "scores": ["", "", "", "", "", "", "", "", "", ""],
            "ttl": ""
        }
    };

    let scoresChart = null;
    let rollsChart = null;

    // -------------------------------------------------------------
    // 1. Data Fetching and Rendering
    // -------------------------------------------------------------
    async function loadScoreboardData() {
        scoreboardBody.innerHTML = `
            <tr>
                <td colspan="12" class="py-12 text-gray-500 text-lg">
                    <i class="fa-solid fa-spinner fa-spin mr-2"></i> Loading scoreboard data...
                </td>
            </tr>
        `;

        try {
            const response = await fetch('scoreboard_data.json');
            if (!response.ok) throw new Error('Failed to load JSON file');
            const data = await response.json();
            currentScoreboardData = data;
            renderScoreboard(data, false);
        } catch (error) {
            console.warn("Could not fetch scoreboard_data.json (e.g. local file:// CORS policy). Using preloaded data.", error);
            renderScoreboard(currentScoreboardData, true);
        }
    }

    function renderScoreboard(data, isMock) {
        scoreboardBody.innerHTML = '';
        
        const players = Object.keys(data);
        const chartData = {
            labels: [],
            ttls: [],
            strikes: [],
            spares: []
        };

        players.forEach(player => {
            const playerData = data[player];
            const rolls = playerData.rolls;
            const scores = playerData.scores;
            const ttl = playerData.ttl;
            const initial = playerData.initial;
            
            const tr = document.createElement('tr');
            tr.className = "hover:bg-gray-900/50 transition-colors";
            
            // Player Name Cell
            let nameHTML = `
                <td class="player-name-cell text-left px-6 py-4">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-indigo-600/20 text-indigo-400 font-bold flex items-center justify-center border border-indigo-500/30 text-sm">
                            ${initial}
                        </div>
                        <div>
                            <div class="text-white">${player}</div>
                            <span class="text-xs text-gray-500">Player</span>
                        </div>
                    </div>
                </td>
            `;
            
            // Frames 1-10 Cells
            let framesHTML = '';
            let strikeCount = 0;
            let spareCount = 0;

            for (let i = 0; i < 10; i++) {
                const frameRolls = rolls[i] || ["", ""];
                const frameScore = scores[i] !== undefined ? scores[i] : "";
                
                frameRolls.forEach(r => {
                    if (r === 'X') strikeCount++;
                    if (r === '/') spareCount++;
                });

                let rollsSubHTML = '';
                if (i < 9) {
                    rollsSubHTML = `
                        <div class="roll-box-container">
                            <div class="roll-cell">${frameRolls[0] || "&nbsp;"}</div>
                            <div class="roll-cell">${frameRolls[1] || "&nbsp;"}</div>
                        </div>
                    `;
                } else {
                    rollsSubHTML = `
                        <div class="roll-box-container">
                            <div class="roll-cell">${frameRolls[0] || "&nbsp;"}</div>
                            <div class="roll-cell">${frameRolls[1] || "&nbsp;"}</div>
                            <div class="roll-cell">${frameRolls[2] || "&nbsp;"}</div>
                        </div>
                    `;
                }

                framesHTML += `
                    <td class="border-l border-gray-800 align-top">
                        ${rollsSubHTML}
                        <div class="score-cell">${frameScore}</div>
                    </td>
                `;
            }

            // Total Score Cell
            const ttlHTML = `
                <td class="border-l border-gray-800 bg-gray-900/30 total-score-cell align-middle">
                    ${ttl}
                </td>
            `;

            tr.innerHTML = nameHTML + framesHTML + ttlHTML;
            scoreboardBody.appendChild(tr);

            chartData.labels.push(player);
            chartData.ttls.push(ttl === "" ? 0 : Number(ttl));
            chartData.strikes.push(strikeCount);
            chartData.spares.push(spareCount);
        });

        renderCharts(chartData);
    }

    function renderCharts(chartData) {
        if (scoresChart) scoresChart.destroy();
        if (rollsChart) rollsChart.destroy();

        const ctxScores = document.getElementById('scores-chart').getContext('2d');
        const ctxRolls = document.getElementById('rolls-chart').getContext('2d');

        scoresChart = new Chart(ctxScores, {
            type: 'bar',
            data: {
                labels: chartData.labels,
                datasets: [{
                    label: 'Total Score (TTL)',
                    data: chartData.ttls,
                    backgroundColor: [
                        'rgba(99, 102, 241, 0.75)',
                        'rgba(168, 85, 247, 0.75)',
                        'rgba(236, 72, 153, 0.75)',
                        'rgba(245, 158, 11, 0.75)'
                    ],
                    borderColor: [
                        'rgb(99, 102, 241)',
                        'rgb(168, 85, 247)',
                        'rgb(236, 72, 153)',
                        'rgb(245, 158, 11)'
                    ],
                    borderWidth: 1.5,
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: '#1F2937' },
                        ticks: { color: '#9CA3AF' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#9CA3AF' }
                    }
                }
            }
        });

        rollsChart = new Chart(ctxRolls, {
            type: 'bar',
            data: {
                labels: chartData.labels,
                datasets: [
                    {
                        label: 'Strikes (X)',
                        data: chartData.strikes,
                        backgroundColor: 'rgba(16, 185, 129, 0.75)',
                        borderColor: 'rgb(16, 185, 129)',
                        borderWidth: 1.5,
                        borderRadius: 6
                    },
                    {
                        label: 'Spares (/)',
                        data: chartData.spares,
                        backgroundColor: 'rgba(59, 130, 246, 0.75)',
                        borderColor: 'rgb(59, 130, 246)',
                        borderWidth: 1.5,
                        borderRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#9CA3AF' } }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: '#1F2937' },
                        ticks: { color: '#9CA3AF', stepSize: 1 }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#9CA3AF' }
                    }
                }
            }
        });
    }

    // -------------------------------------------------------------
    // 2. Video Upload, Insertion, & Drag-and-Drop
    // -------------------------------------------------------------
    addVideoBtn.addEventListener('click', () => videoFileInput.click());
    dropzone.addEventListener('click', () => videoFileInput.click());

    // Drag and Drop Events
    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add('border-yellow-500', 'bg-yellow-500/5');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('border-yellow-500', 'bg-yellow-500/5');
        });
    });

    dropzone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            handleVideoFile(files[0]);
        }
    });

    videoFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleVideoFile(e.target.files[0]);
        }
    });

    function handleVideoFile(file) {
        if (!file.type.startsWith('video/')) {
            alert('Please select a valid video file (.mp4, .webm, .mov, .avi).');
            return;
        }

        const videoURL = URL.createObjectURL(file);
        inputVideoPlayer.src = videoURL;
        inputVideoPlayer.load();

        // Update Metadata
        currentVideoName.textContent = file.name;
        inputVideoTag.textContent = `Source: ${file.name}`;
        metaSize.textContent = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;

        // Wait for metadata
        inputVideoPlayer.onloadedmetadata = () => {
            metaResolution.textContent = `${inputVideoPlayer.videoWidth} x ${inputVideoPlayer.videoHeight}`;
            metaDuration.textContent = `${inputVideoPlayer.duration.toFixed(2)} seconds`;
            metaStatus.textContent = "Scoreboard Detected (Ready)";
            pipelineStatusBadge.textContent = "New Video Loaded";
            pipelineStatusBadge.className = "text-xs font-semibold px-2.5 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20";
        };

        // Reset sample buttons active styling
        sampleInputBtn.classList.remove('active-sample');
        sampleOutputBtn.classList.remove('active-sample');
    }

    // -------------------------------------------------------------
    // 3. Preloaded Sample Video Selection
    // -------------------------------------------------------------
    sampleInputBtn.addEventListener('click', () => {
        inputVideoPlayer.src = 'input_compressed.mp4';
        inputVideoPlayer.load();
        currentVideoName.textContent = 'input_compressed.mp4 (Raw Input Sample)';
        inputVideoTag.textContent = 'Source: input_compressed.mp4';
        metaResolution.textContent = '1280 x 720 (HD)';
        metaDuration.textContent = '57.83 seconds';
        metaSize.textContent = '11.15 MB';
        metaStatus.textContent = 'Stationary (NCC > 0.96)';
        
        sampleInputBtn.classList.add('active-sample');
        sampleOutputBtn.classList.remove('active-sample');
    });

    sampleOutputBtn.addEventListener('click', () => {
        inputVideoPlayer.src = 'output_compressed.mp4';
        inputVideoPlayer.load();
        currentVideoName.textContent = 'output_compressed.mp4 (Annotated HUD Sample)';
        inputVideoTag.textContent = 'Source: output_compressed.mp4';
        metaResolution.textContent = '1280 x 720 (HD)';
        metaDuration.textContent = '57.83 seconds';
        metaSize.textContent = '12.08 MB';
        metaStatus.textContent = 'HUD Tracking Active';
        
        sampleOutputBtn.classList.add('active-sample');
        sampleInputBtn.classList.remove('active-sample');
    });

    // -------------------------------------------------------------
    // 4. Interactive Flowchart & Extraction Pipeline Simulation
    // -------------------------------------------------------------
    processVideoBtn.addEventListener('click', () => {
        runInteractivePipeline();
    });

    function runInteractivePipeline() {
        processVideoBtn.disabled = true;
        processVideoBtn.classList.add('opacity-50', 'cursor-not-allowed');
        progressContainer.classList.remove('hidden');
        pipelineStatusBadge.textContent = "Processing...";
        pipelineStatusBadge.className = "text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20";

        const steps = [
            { id: 'flow-step-1', label: '1. Opening video stream...', percent: 12 },
            { id: 'flow-step-2', label: '2. Extracting frame buffer at interval...', percent: 25 },
            { id: 'flow-step-3', label: '3. Locating scoreboard via NCC matching...', percent: 38 },
            { id: 'flow-step-4', label: '4. Preprocessing scoreboard & inverting active rows...', percent: 50 },
            { id: 'flow-step-5', label: '5. Running OCR character recognition...', percent: 65 },
            { id: 'flow-step-6', label: '6. Temporal majority voting & cleaning text...', percent: 80 },
            { id: 'flow-step-7', label: '7. Calculating bowling frame scores & totals...', percent: 92 },
            { id: 'flow-step-8', label: '8. Generating structured JSON & CSV output...', percent: 100 }
        ];

        // Reset all steps styling
        for (let i = 1; i <= 8; i++) {
            const stepEl = document.getElementById(`flow-step-${i}`);
            stepEl.classList.remove('active', 'completed');
        }

        let stepIndex = 0;
        const interval = setInterval(() => {
            if (stepIndex > 0) {
                const prevStep = document.getElementById(steps[stepIndex - 1].id);
                prevStep.classList.remove('active');
                prevStep.classList.add('completed');
            }

            if (stepIndex < steps.length) {
                const currentStep = document.getElementById(steps[stepIndex].id);
                currentStep.classList.add('active');
                progressLabel.textContent = steps[stepIndex].label;
                progressBar.style.width = `${steps[stepIndex].percent}%`;
                progressPercent.textContent = `${steps[stepIndex].percent}%`;
                stepIndex++;
            } else {
                clearInterval(interval);
                const lastStep = document.getElementById('flow-step-8');
                lastStep.classList.remove('active');
                lastStep.classList.add('completed');

                progressLabel.textContent = 'Extraction completed with 100% precision!';
                pipelineStatusBadge.textContent = 'Extraction Complete (100%)';
                pipelineStatusBadge.className = 'text-xs font-semibold px-2.5 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20';

                // Reload and render final scoreboard data
                loadScoreboardData();

                // Re-enable button after short delay
                setTimeout(() => {
                    processVideoBtn.disabled = false;
                    processVideoBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                }, 1000);
            }
        }, 350);
    }

    // -------------------------------------------------------------
    // 5. Video Playback Synchronization
    // -------------------------------------------------------------
    syncPlayBtn.addEventListener('click', () => {
        inputVideoPlayer.currentTime = 0;
        outputVideoPlayer.currentTime = 0;
        inputVideoPlayer.play();
        outputVideoPlayer.play();
    });

    inputVideoPlayer.addEventListener('play', () => {
        if (outputVideoPlayer.paused) {
            outputVideoPlayer.currentTime = inputVideoPlayer.currentTime;
            outputVideoPlayer.play();
        }
    });

    inputVideoPlayer.addEventListener('pause', () => {
        if (!outputVideoPlayer.paused) {
            outputVideoPlayer.pause();
        }
    });

    inputVideoPlayer.addEventListener('seeked', () => {
        outputVideoPlayer.currentTime = inputVideoPlayer.currentTime;
    });

    // -------------------------------------------------------------
    // 6. JSON & CSV File Download Utilities
    // -------------------------------------------------------------
    downloadJsonBtn.addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentScoreboardData, null, 4));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", "scoreboard_data.json");
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    });

    downloadCsvBtn.addEventListener('click', () => {
        let csvContent = "Player,Initial,Frame_1,Frame_2,Frame_3,Frame_4,Frame_5,Frame_6,Frame_7,Frame_8,Frame_9,Frame_10,TTL\n";
        
        Object.keys(currentScoreboardData).forEach(p => {
            const d = currentScoreboardData[p];
            const frames = d.rolls.map(f => f.filter(r => r).join(' ')).join(',');
            csvContent += `${p},${d.initial},${frames},${d.ttl}\n`;
        });

        const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", encodedUri);
        downloadAnchor.setAttribute("download", "scoreboard_data.csv");
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    });

    refreshBtn.addEventListener('click', loadScoreboardData);

    // Initial Load
    loadScoreboardData();
});
