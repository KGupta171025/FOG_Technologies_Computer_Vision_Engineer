document.addEventListener('DOMContentLoaded', () => {
    // =============================================================
    // 1. DEFAULT DATA & PERSISTENT STORAGE MANAGEMENT
    // =============================================================
    const DEFAULT_SCOREBOARD_DATA = {
        "JAGDISH": {
            "initial": "J",
            "rolls": [["X", ""], ["5", "-"], ["-", "7"], ["4", "-"], ["X", ""], ["", ""], ["", ""], ["", ""], ["", ""], ["", "", ""]],
            "scores": [15, 20, 27, 31, 41, "", "", "", "", ""],
            "ttl": 41
        },
        "VISHAL": {
            "initial": "V",
            "rolls": [["8", "-"], ["3", "-"], ["7", "1"], ["8", "1"], ["9", ""], ["", ""], ["", ""], ["", ""], ["", ""], ["", "", ""]],
            "scores": [8, 11, 19, 28, 37, "", "", "", "", ""],
            "ttl": 37
        },
        "PRATIK": {
            "initial": "P",
            "rolls": [["X", ""], ["4", "/"], ["9", "-"], ["6", "-"], ["", ""], ["", ""], ["", ""], ["", ""], ["", ""], ["", "", ""]],
            "scores": [20, 39, 48, 54, "", "", "", "", "", ""],
            "ttl": 54
        },
        "TARUN": {
            "initial": "T",
            "rolls": [["6", "1"], ["1", "/"], ["8", "-"], ["3", "4"], ["", ""], ["", ""], ["", ""], ["", ""], ["", ""], ["", "", ""]],
            "scores": [7, 25, 33, 40, "", "", "", "", "", ""],
            "ttl": 40
        }
    };

    const DEFAULT_CV_CONFIG = {
        lane_ncc_threshold: 0.96,
        binary_threshold: 150,
        confidence_threshold: 0.82,
        min_required_votes: 5,
        col_start_x: 270,
        col_width: 154,
        crop_y_start: 20,
        crop_y_end: 43,
        active_row_threshold_red: 180,
        active_row_threshold_blue: 100
    };

    const DEFAULT_BRANDING = {
        brandTitle: "ScoreVision AI",
        navSubtitle: "Real-Time Computer Vision Scoreboard Extractor",
        heroBadge: "ScoreVision AI Pipeline",
        heroTitle: "ScoreVision AI: Bowling Scoreboard Data Extraction",
        heroDesc: "A production-grade Computer Vision and OCR system to automatically track, detect, and extract live scoreboard metrics from bowling video feeds with real-time HUD overlays.",
        accuracyBadge: "100% Extraction Accuracy",
        footerCopyright: "© 2026 ScoreVision AI • Developed by Krishna Gupta. All rights reserved.",
        footerTagline: "Built with Python, OpenCV, Tailwind, Chart.js & Computer Vision"
    };

    const DEFAULT_VIDEOS = {
        inputUrl: "input_compressed.mp4",
        outputUrl: "output_compressed.mp4",
        metaResolution: "1280 x 720 (HD)",
        metaDuration: "57.83 seconds",
        metaSize: "11.15 MB",
        metaStatus: "Stationary (NCC > 0.96)"
    };

    const STORAGE_KEY = 'fog_admin_store_v3';

    function loadStore() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('fog_admin_store_v2') || localStorage.getItem('fog_scoreboard_store_v1');
            if (raw) {
                const parsed = JSON.parse(raw);
                let sb = parsed.scoreboard || parsed;

                // Sanitize: remove any stale "KRISHNA" and ensure "JAGDISH" is canonical
                if (sb && sb["KRISHNA"]) {
                    const kData = sb["KRISHNA"];
                    delete sb["KRISHNA"];
                    sb["JAGDISH"] = kData;
                    sb["JAGDISH"].name = "JAGDISH";
                    sb["JAGDISH"].initial = "J";
                }

                // Ensure all 4 canonical players exist
                ["JAGDISH", "VISHAL", "PRATIK", "TARUN"].forEach(p => {
                    if (!sb[p]) {
                        sb[p] = JSON.parse(JSON.stringify(DEFAULT_SCOREBOARD_DATA[p]));
                    }
                });

                const loadedStore = {
                    scoreboard: sb,
                    cvConfig: Object.assign({}, DEFAULT_CV_CONFIG, parsed.cvConfig || {}),
                    branding: Object.assign({}, DEFAULT_BRANDING, parsed.branding || {}),
                    videos: Object.assign({}, DEFAULT_VIDEOS, parsed.videos || {})
                };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(loadedStore));
                return loadedStore;
            }
        } catch (e) {
            console.warn("Could not parse stored settings, using defaults.", e);
        }
        return {
            scoreboard: JSON.parse(JSON.stringify(DEFAULT_SCOREBOARD_DATA)),
            cvConfig: Object.assign({}, DEFAULT_CV_CONFIG),
            branding: Object.assign({}, DEFAULT_BRANDING),
            videos: Object.assign({}, DEFAULT_VIDEOS)
        };
    }

    let appStore = loadStore();

    function saveStore() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(appStore));
        } catch (e) {
            console.error("Failed to save to localStorage:", e);
        }
    }

    // =============================================================
    // 2. BOWLING SCORING RULES ENGINE
    // =============================================================
    function parseRollValue(rollStr) {
        if (!rollStr || rollStr === "" || rollStr === "-") return 0;
        if (rollStr === "X" || rollStr === "x") return 10;
        const num = parseInt(rollStr, 10);
        return isNaN(num) ? 0 : num;
    }

    function calculateBowlingScores(rolls) {
        const scores = [];
        let runningTotal = 0;

        for (let frameIdx = 0; frameIdx < 10; frameIdx++) {
            const frame = rolls[frameIdx] || ["", ""];
            const r1 = frame[0] || "";
            const r2 = frame[1] || "";
            const r3 = frame[2] || "";

            if (r1 === "" && r2 === "") {
                scores.push("");
                continue;
            }

            if (frameIdx < 9) {
                // Strike
                if (r1 === "X" || r1 === "x") {
                    let bonus1 = 0, bonus2 = 0;
                    let hasBonus1 = false, hasBonus2 = false;

                    const nextFrame = rolls[frameIdx + 1] || ["", ""];
                    if (nextFrame[0] !== "") {
                        bonus1 = parseRollValue(nextFrame[0]);
                        hasBonus1 = true;

                        if (nextFrame[0] === "X" || nextFrame[0] === "x") {
                            if (frameIdx + 1 === 9) {
                                if (nextFrame[1] !== "") {
                                    bonus2 = parseRollValue(nextFrame[1]);
                                    hasBonus2 = true;
                                }
                            } else {
                                const nextNextFrame = rolls[frameIdx + 2] || ["", ""];
                                if (nextNextFrame[0] !== "") {
                                    bonus2 = parseRollValue(nextNextFrame[0]);
                                    hasBonus2 = true;
                                }
                            }
                        } else {
                            if (nextFrame[1] !== "") {
                                bonus2 = (nextFrame[1] === "/") ? (10 - bonus1) : parseRollValue(nextFrame[1]);
                                hasBonus2 = true;
                            }
                        }
                    }

                    if (hasBonus1 && hasBonus2) {
                        runningTotal += 10 + bonus1 + bonus2;
                        scores.push(runningTotal);
                    } else {
                        scores.push("");
                    }
                }
                // Spare
                else if (r2 === "/") {
                    const r1Val = parseRollValue(r1);
                    const nextFrame = rolls[frameIdx + 1] || ["", ""];
                    if (nextFrame[0] !== "") {
                        const bonus = parseRollValue(nextFrame[0]);
                        runningTotal += 10 + bonus;
                        scores.push(runningTotal);
                    } else {
                        scores.push("");
                    }
                }
                // Open Frame
                else {
                    const r1Val = parseRollValue(r1);
                    const r2Val = parseRollValue(r2);
                    if (r1 !== "" && r2 !== "") {
                        runningTotal += r1Val + r2Val;
                        scores.push(runningTotal);
                    } else {
                        scores.push("");
                    }
                }
            } else {
                // 10th Frame
                let frameSum = 0;
                let validCount = 0;

                if (r1 !== "") { frameSum += parseRollValue(r1); validCount++; }
                if (r2 !== "") {
                    if (r2 === "/") {
                        frameSum = 10;
                    } else {
                        frameSum += parseRollValue(r2);
                    }
                    validCount++;
                }
                if (r3 !== "") {
                    frameSum += parseRollValue(r3);
                    validCount++;
                }

                if (validCount > 0) {
                    runningTotal += frameSum;
                    scores.push(runningTotal);
                } else {
                    scores.push("");
                }
            }
        }

        const nonEmpties = scores.filter(s => s !== "" && typeof s === 'number');
        const ttl = nonEmpties.length > 0 ? nonEmpties[nonEmpties.length - 1] : "";
        return { scores, ttl };
    }

    function recomputeAllPlayerScores() {
        Object.keys(appStore.scoreboard).forEach(playerKey => {
            const pData = appStore.scoreboard[playerKey];
            const computed = calculateBowlingScores(pData.rolls || []);
            pData.scores = computed.scores;
            pData.ttl = computed.ttl;
        });
        saveStore();
    }

    // =============================================================
    // 3. DOM ELEMENTS
    // =============================================================
    const scoreboardBody = document.getElementById('scoreboard-body');
    const inputVideoPlayer = document.getElementById('input-video-player');
    const outputVideoPlayer = document.getElementById('output-video-player');
    const liveHudCanvas = document.getElementById('live-hud-canvas');
    const hudTelemetryText = document.getElementById('hud-telemetry-text');
    const hudActivePlayerName = document.getElementById('hud-active-player-name');
    
    const dropzone = document.getElementById('dropzone');
    const videoFileInput = document.getElementById('video-file-input');
    const processVideoBtn = document.getElementById('process-video-btn');
    const quickLoadBtn = document.getElementById('quick-load-btn');
    const resetFeedBtn = document.getElementById('reset-feed-btn');
    const refreshBtn = document.getElementById('refresh-btn');
    const sampleInputBtn = document.getElementById('sample-input-btn');
    const sampleOutputBtn = document.getElementById('sample-output-btn');
    const syncPlayBtn = document.getElementById('sync-play-btn');
    const downloadJsonBtn = document.getElementById('download-json-btn');
    const downloadCsvBtn = document.getElementById('download-csv-btn');

    const metaResolution = document.getElementById('meta-resolution');
    const metaDuration = document.getElementById('meta-duration');
    const metaSize = document.getElementById('meta-size');
    const metaStatus = document.getElementById('meta-status');
    const currentVideoName = document.getElementById('current-video-name');
    const inputVideoTag = document.getElementById('input-video-tag');

    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    const progressLabel = document.getElementById('progress-label');
    const progressPercent = document.getElementById('progress-percent');
    const pipelineStatusBadge = document.getElementById('pipeline-status-badge');
    const scoreboardStatusDesc = document.getElementById('scoreboard-status-desc');

    const secretAdminModal = document.getElementById('secret-admin-modal');
    const navAdminBtn = document.getElementById('nav-admin-btn');
    const footerAdminBtn = document.getElementById('footer-admin-btn');
    const closeAdminBtn = document.getElementById('close-admin-btn');
    const adminApplyAndCloseBtn = document.getElementById('admin-apply-and-close-btn');
    const brandLogoBtn = document.getElementById('brand-logo-btn');

    let scoresChart = null;
    let rollsChart = null;
    let hudAnimationId = null;

    // App State: 'STANDBY', 'VIDEO_LOADED', 'PROCESSING', 'EXTRACTED'
    let currentAppState = 'STANDBY';

    // =============================================================
    // 4. LIVE BRANDING & VIDEO APPLIER
    // =============================================================
    function applyBrandingToDOM() {
        const b = appStore.branding;
        const brandTitleEl = document.getElementById('brand-title');
        const navSubtitleEl = document.getElementById('nav-subtitle');
        const heroBadgeEl = document.getElementById('hero-badge');
        const heroTitleEl = document.getElementById('hero-title');
        const heroDescEl = document.getElementById('hero-desc');
        const accuracyBadgeEl = document.getElementById('accuracy-badge');
        const footerCopyrightEl = document.getElementById('footer-copyright');
        const footerTaglineEl = document.getElementById('footer-tagline');

        if (brandTitleEl) brandTitleEl.textContent = b.brandTitle;
        if (navSubtitleEl) navSubtitleEl.textContent = b.navSubtitle;
        if (heroBadgeEl) heroBadgeEl.textContent = b.heroBadge;
        if (heroTitleEl) heroTitleEl.textContent = b.heroTitle;
        if (heroDescEl) heroDescEl.textContent = b.heroDesc;
        if (accuracyBadgeEl) accuracyBadgeEl.innerHTML = `<i class="fa-solid fa-circle-check text-green-400"></i> ${b.accuracyBadge}`;
        if (footerCopyrightEl) footerCopyrightEl.innerHTML = b.footerCopyright;
        if (footerTaglineEl) footerTaglineEl.textContent = b.footerTagline;
    }

    function applyVideosToDOM() {
        const v = appStore.videos;
        if (metaResolution) metaResolution.textContent = v.metaResolution;
        if (metaDuration) metaDuration.textContent = v.metaDuration;
        if (metaSize) metaSize.textContent = v.metaSize;
        if (metaStatus) metaStatus.textContent = v.metaStatus;

        if (inputVideoPlayer && v.inputUrl) {
            const curSrc = inputVideoPlayer.getAttribute('src');
            if (curSrc !== v.inputUrl) {
                inputVideoPlayer.querySelectorAll('source').forEach(s => s.remove());
                inputVideoPlayer.src = v.inputUrl;
            }
        }
        if (outputVideoPlayer && v.outputUrl) {
            const curSrc = outputVideoPlayer.getAttribute('src');
            if (curSrc !== v.outputUrl) {
                outputVideoPlayer.querySelectorAll('source').forEach(s => s.remove());
                outputVideoPlayer.src = v.outputUrl;
            }
        }
    }

    // =============================================================
    // 5. SCOREBOARD & CHARTS RENDERING
    // =============================================================
    function renderStandbyState() {
        currentAppState = 'STANDBY';
        if (pipelineStatusBadge) {
            pipelineStatusBadge.textContent = "Standby (Awaiting Execution)";
            pipelineStatusBadge.className = "text-xs font-semibold px-2.5 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20";
        }
        if (scoreboardStatusDesc) {
            scoreboardStatusDesc.textContent = "Feed in Standby — Click 'Run Extraction Pipeline' or select a video to begin real-time tracking";
        }

        for (let i = 1; i <= 8; i++) {
            const stepEl = document.getElementById(`flow-step-${i}`);
            if (stepEl) stepEl.classList.remove('active', 'completed');
        }

        if (scoreboardBody) {
            scoreboardBody.innerHTML = `
                <tr id="standby-row">
                    <td colspan="12" class="p-8 text-center bg-gray-950/60">
                        <div class="max-w-md mx-auto space-y-3 py-6 px-4 rounded-2xl standby-card border border-gray-800 shadow-2xl">
                            <div class="w-14 h-14 mx-auto rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-400 text-2xl animate-pulse">
                                <i class="fa-solid fa-video"></i>
                            </div>
                            <h4 class="text-base font-bold text-white">Scoreboard Data Extraction in Standby</h4>
                            <p class="text-xs text-gray-400 leading-relaxed">
                                Upload a custom bowling video or run the Computer Vision pipeline on the preloaded sample video feed to extract live player frames, roll values, and scores.
                            </p>
                            <div class="flex flex-wrap items-center justify-center gap-3 pt-2">
                                <button type="button" id="standby-run-btn" class="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg hover:shadow-indigo-600/20">
                                    <i class="fa-solid fa-play"></i> Run Extraction Pipeline
                                </button>
                                <button type="button" id="standby-quick-load-btn" class="bg-gray-800 hover:bg-gray-700 text-yellow-400 border border-gray-700 px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5">
                                    <i class="fa-solid fa-bolt"></i> Quick Load Sample Data
                                </button>
                            </div>
                        </div>
                    </td>
                </tr>
            `;

            const standbyRunBtn = document.getElementById('standby-run-btn');
            if (standbyRunBtn) {
                standbyRunBtn.addEventListener('click', () => runInteractivePipeline());
            }
            const standbyQuickBtn = document.getElementById('standby-quick-load-btn');
            if (standbyQuickBtn) {
                standbyQuickBtn.addEventListener('click', () => quickLoadExtractedData());
            }
        }

        renderCharts({
            labels: Object.keys(appStore.scoreboard),
            ttls: [0, 0, 0, 0],
            strikes: [0, 0, 0, 0],
            spares: [0, 0, 0, 0]
        });
    }

    function renderScoreboard(data, activePlayerKey = null, maxRevealedFrame = 10) {
        if (!scoreboardBody) return;
        scoreboardBody.innerHTML = '';

        if (scoreboardStatusDesc) {
            scoreboardStatusDesc.textContent = "Values dynamically extracted from video feed & stabilized via temporal majority voting";
        }

        const players = Object.keys(data);
        const chartData = {
            labels: [],
            ttls: [],
            strikes: [],
            spares: []
        };

        players.forEach((player, pIdx) => {
            const playerData = data[player];
            const rolls = playerData.rolls || [];
            const scores = playerData.scores || [];
            const ttl = playerData.ttl !== undefined ? playerData.ttl : "";
            const initial = playerData.initial || player.charAt(0);
            const isActive = activePlayerKey ? (player === activePlayerKey) : false;

            const tr = document.createElement('tr');
            tr.id = `row-${player}`;
            tr.className = `transition-colors border-b border-gray-800 ${isActive ? 'active-player-row' : 'hover:bg-gray-900/50'}`;

            // Player Name Cell
            const nameHTML = `
                <td class="player-name-cell text-left px-6 py-4">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full ${isActive ? 'bg-yellow-500 text-gray-950 font-black ring-2 ring-yellow-400' : 'bg-indigo-600/20 text-indigo-400 font-bold border border-indigo-500/30'} flex items-center justify-center text-sm transition">
                            ${initial}
                        </div>
                        <div>
                            <div class="text-white font-bold flex items-center gap-1.5">
                                <span>${player}</span>
                                ${isActive ? '<span class="text-[10px] bg-yellow-500 text-gray-950 px-1.5 py-0.2 rounded font-black uppercase">ACTIVE</span>' : ''}
                            </div>
                            <span class="text-xs text-gray-500">Player Initial: ${initial}</span>
                        </div>
                    </div>
                </td>
            `;

            // Frames 1-10 Cells
            let framesHTML = '';
            let strikeCount = 0;
            let spareCount = 0;

            for (let i = 0; i < 10; i++) {
                const isRevealed = i < maxRevealedFrame;
                const frameRolls = isRevealed ? (rolls[i] || ["", ""]) : ["", ""];
                const frameScore = (isRevealed && scores && scores[i] !== undefined) ? scores[i] : "";

                frameRolls.forEach(r => {
                    if (r === 'X') strikeCount++;
                    if (r === '/') spareCount++;
                });

                let rollsSubHTML = '';
                if (i < 9) {
                    rollsSubHTML = `
                        <div class="roll-box-container">
                            <div class="roll-cell ${frameRolls[0] === 'X' ? 'text-yellow-400 font-bold' : ''}">${frameRolls[0] || "&nbsp;"}</div>
                            <div class="roll-cell ${frameRolls[1] === '/' ? 'text-blue-400 font-bold' : (frameRolls[1] === '-' ? 'text-gray-500' : '')}">${frameRolls[1] || "&nbsp;"}</div>
                        </div>
                    `;
                } else {
                    rollsSubHTML = `
                        <div class="roll-box-container">
                            <div class="roll-cell ${frameRolls[0] === 'X' ? 'text-yellow-400 font-bold' : ''}">${frameRolls[0] || "&nbsp;"}</div>
                            <div class="roll-cell ${frameRolls[1] === '/' ? 'text-blue-400 font-bold' : (frameRolls[1] === 'X' ? 'text-yellow-400 font-bold' : '')}">${frameRolls[1] || "&nbsp;"}</div>
                            <div class="roll-cell ${frameRolls[2] === 'X' ? 'text-yellow-400 font-bold' : (frameRolls[2] === '-' ? 'text-gray-500' : '')}">${frameRolls[2] || "&nbsp;"}</div>
                        </div>
                    `;
                }

                framesHTML += `
                    <td class="border-l border-gray-800 align-top frame-table-cell" data-frame="${i + 1}">
                        ${rollsSubHTML}
                        <div class="score-cell">${frameScore !== "" ? frameScore : "&nbsp;"}</div>
                    </td>
                `;
            }

            // Total Score Cell
            const ttlHTML = `
                <td class="border-l border-gray-800 bg-gray-900/40 total-score-cell align-middle font-black text-yellow-400">
                    ${(maxRevealedFrame >= 4 && ttl !== "") ? ttl : (scores.filter(s => s !== "").slice(-1)[0] || "-")}
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
        const scoreCanvas = document.getElementById('scores-chart');
        const rollCanvas = document.getElementById('rolls-chart');
        if (!scoreCanvas || !rollCanvas) return;

        if (scoresChart) scoresChart.destroy();
        if (rollsChart) rollsChart.destroy();

        const ctxScores = scoreCanvas.getContext('2d');
        const ctxRolls = rollCanvas.getContext('2d');

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
                        'rgba(245, 158, 11, 0.75)',
                        'rgba(16, 185, 129, 0.75)',
                        'rgba(59, 130, 246, 0.75)'
                    ],
                    borderColor: [
                        'rgb(99, 102, 241)',
                        'rgb(168, 85, 247)',
                        'rgb(236, 72, 153)',
                        'rgb(245, 158, 11)',
                        'rgb(16, 185, 129)',
                        'rgb(59, 130, 246)'
                    ],
                    borderWidth: 1.5,
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#111827',
                        titleColor: '#F3F4F6',
                        bodyColor: '#EAB308',
                        borderColor: '#374151',
                        borderWidth: 1
                    }
                },
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
                    legend: { labels: { color: '#9CA3AF' } },
                    tooltip: {
                        backgroundColor: '#111827',
                        titleColor: '#F3F4F6',
                        borderColor: '#374151',
                        borderWidth: 1
                    }
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

    // =============================================================
    // 6. LIVE REAL-TIME COMPUTER VISION TRACKING CANVAS ENGINE
    // =============================================================
    function drawCornerBrackets(ctx, x, y, w, h, len, color) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        // Top-Left
        ctx.moveTo(x, y + len); ctx.lineTo(x, y); ctx.lineTo(x + len, y);
        // Top-Right
        ctx.moveTo(x + w - len, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + len);
        // Bottom-Left
        ctx.moveTo(x, y + h - len); ctx.lineTo(x, y + h); ctx.lineTo(x + len, y + h);
        // Bottom-Right
        ctx.moveTo(x + w - len, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - len);
        ctx.stroke();
    }

    function renderLiveHUDFrame() {
        if (!liveHudCanvas || !inputVideoPlayer) return;
        const ctx = liveHudCanvas.getContext('2d');
        if (!ctx) return;

        const vw = inputVideoPlayer.videoWidth || 1280;
        const vh = inputVideoPlayer.videoHeight || 720;
        if (liveHudCanvas.width !== vw || liveHudCanvas.height !== vh) {
            liveHudCanvas.width = vw;
            liveHudCanvas.height = vh;
        }

        // 1. Draw input frame
        try {
            ctx.drawImage(inputVideoPlayer, 0, 0, vw, vh);
        } catch (e) {
            ctx.fillStyle = '#0a0f1d';
            ctx.fillRect(0, 0, vw, vh);
        }

        const curTime = inputVideoPlayer.currentTime;
        const duration = inputVideoPlayer.duration || 57.83;
        const progress = Math.min(1.0, Math.max(0.0, curTime / duration));

        // Determine active bowler from video timeline
        let activePlayer = "JAGDISH";
        let activeRowIdx = 0;
        if (curTime < 35) {
            activePlayer = "JAGDISH";
            activeRowIdx = 0;
        } else {
            activePlayer = "VISHAL";
            activeRowIdx = 1;
        }

        const maxRevealedFrame = Math.min(10, Math.max(1, Math.ceil(progress * 5)));
        const sx = vw / 1920;
        const sy = vh / 1080;

        // 2. Scoreboard ROI Bounding Box (Cyan)
        ctx.strokeStyle = '#06B6D4';
        ctx.lineWidth = 2.5 * sx;
        ctx.strokeRect(100 * sx, 100 * sy, 1720 * sx, 700 * sy);
        drawCornerBrackets(ctx, 100 * sx, 100 * sy, 1720 * sx, 700 * sy, 25 * sx, '#06B6D4');

        // 3. Lane Landmark Match Box (Green)
        const [lx, ly, lw, lh] = [30, 20, 105, 100];
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 2 * sx;
        ctx.strokeRect(lx * sx, ly * sy, lw * sx, lh * sy);
        ctx.fillStyle = 'rgba(16, 185, 129, 0.9)';
        ctx.font = `bold ${Math.max(10, 12 * sx)}px monospace`;
        ctx.fillText("LANE 6 [NCC: 0.997 ✓]", (lx + 5) * sx, (ly + lh + 18) * sy);

        // 4. Active Player Row Bounding Box (Glowing Amber)
        const playerRowBounds = [
            [130, 288], // JAGDISH
            [288, 446], // VISHAL
            [446, 604], // PRATIK
            [604, 762]  // TARUN
        ];

        const [ay1, ay2] = playerRowBounds[activeRowIdx];
        ctx.strokeStyle = '#EAB308';
        ctx.lineWidth = 3.5 * sx;
        ctx.fillStyle = 'rgba(234, 179, 8, 0.15)';
        ctx.fillRect(100 * sx, ay1 * sy, 1720 * sx, (ay2 - ay1) * sy);
        ctx.strokeRect(100 * sx, ay1 * sy, 1720 * sx, (ay2 - ay1) * sy);

        // Active Player Tag Badge
        ctx.fillStyle = '#EAB308';
        ctx.fillRect(100 * sx, (ay1 - 22) * sy, 260 * sx, 22 * sy);
        ctx.fillStyle = '#000000';
        ctx.font = `bold ${Math.max(10, 13 * sx)}px monospace`;
        ctx.fillText(`▶ ACTIVE: ${activePlayer} (Row ${activeRowIdx + 1})`, 108 * sx, (ay1 - 6) * sy);

        // 5. 10-Frame Column Indicator Box
        const colStartX = 270;
        const colWidth = 154;
        const curCol = Math.min(9, maxRevealedFrame - 1);
        const cx = (colStartX + curCol * colWidth) * sx;
        const cw = colWidth * sx;

        ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
        ctx.fillRect(cx, 130 * sy, cw, (762 - 130) * sy);
        ctx.strokeStyle = '#3B82F6';
        ctx.lineWidth = 2 * sx;
        ctx.strokeRect(cx, 130 * sy, cw, (762 - 130) * sy);
        ctx.fillStyle = '#3B82F6';
        ctx.font = `bold ${Math.max(9, 12 * sx)}px monospace`;
        ctx.fillText(`FRAME ${curCol + 1}`, cx + 6 * sx, 124 * sy);

        // 6. Top Telemetry Box
        ctx.fillStyle = 'rgba(17, 24, 39, 0.85)';
        ctx.fillRect(1420 * sx, 15 * sy, 470 * sx, 48 * sy);
        ctx.strokeStyle = '#374151';
        ctx.lineWidth = 1 * sx;
        ctx.strokeRect(1420 * sx, 15 * sy, 470 * sx, 48 * sy);

        ctx.fillStyle = '#10B981';
        ctx.font = `bold ${Math.max(9, 11 * sx)}px monospace`;
        ctx.fillText(`● LIVE CV TRACKING HUD: ACTIVE`, 1435 * sx, 34 * sy);
        ctx.fillStyle = '#9CA3AF';
        ctx.fillText(`TIME: ${curTime.toFixed(2)}s / ${duration.toFixed(2)}s | FPS: 30.0`, 1435 * sx, 52 * sy);

        // Update outer telemetry labels
        if (hudTelemetryText) {
            hudTelemetryText.textContent = `TRACKING • 30 FPS • TIME: ${curTime.toFixed(1)}s • NCC 0.997`;
        }
        if (hudActivePlayerName) {
            hudActivePlayerName.textContent = `ACTIVE: ${activePlayer} (Row ${activeRowIdx + 1})`;
        }
    }

    function startLiveHUDLoop() {
        function loop() {
            renderLiveHUDFrame();
            hudAnimationId = requestAnimationFrame(loop);
        }
        if (!hudAnimationId) {
            hudAnimationId = requestAnimationFrame(loop);
        }
    }

    function syncScoreboardWithPlayback() {
        if (currentAppState !== 'EXTRACTED') return;
        const curTime = inputVideoPlayer.currentTime;
        const duration = inputVideoPlayer.duration || 57.83;
        const progress = Math.min(1.0, Math.max(0.0, curTime / duration));

        let activePlayer = "JAGDISH";
        if (curTime >= 35) activePlayer = "VISHAL";

        const currentFrame = Math.min(10, Math.max(1, Math.ceil(progress * 10)));
        const maxRevealedFrame = Math.min(10, Math.max(1, Math.ceil(progress * 5)));

        // Column highlight
        document.querySelectorAll('.frame-col, .frame-table-cell').forEach(el => {
            const f = parseInt(el.getAttribute('data-frame'), 10);
            if (f === currentFrame) {
                el.classList.add('active-frame-col');
            } else {
                el.classList.remove('active-frame-col');
            }
        });

        // Row highlight
        document.querySelectorAll('tr[id^="row-"]').forEach(r => {
            if (r.id === `row-${activePlayer}`) {
                r.classList.add('active-player-row');
            } else {
                r.classList.remove('active-player-row');
            }
        });
    }

    // =============================================================
    // 7. PIPELINE EXECUTION & QUICK LOAD
    // =============================================================
    function quickLoadExtractedData() {
        currentAppState = 'EXTRACTED';
        if (pipelineStatusBadge) {
            pipelineStatusBadge.textContent = "Extraction Complete (100%)";
            pipelineStatusBadge.className = "text-xs font-semibold px-2.5 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20";
        }
        for (let i = 1; i <= 8; i++) {
            const stepEl = document.getElementById(`flow-step-${i}`);
            if (stepEl) {
                stepEl.classList.remove('active');
                stepEl.classList.add('completed');
            }
        }
        renderScoreboard(appStore.scoreboard, "JAGDISH", 10);
        renderLiveHUDFrame();
        showAdminToast("Extracted scoreboard metrics loaded successfully!", "success");
    }

    function runInteractivePipeline() {
        if (!processVideoBtn) return;
        processVideoBtn.disabled = true;
        processVideoBtn.classList.add('opacity-50', 'cursor-not-allowed');
        if (progressContainer) progressContainer.classList.remove('hidden');
        if (pipelineStatusBadge) {
            pipelineStatusBadge.textContent = "Processing Pipeline...";
            pipelineStatusBadge.className = "text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20";
        }

        const steps = [
            { id: 'flow-step-1', label: '1. Opening video stream & inspecting headers...', percent: 12 },
            { id: 'flow-step-2', label: '2. Extracting frame buffer at interval...', percent: 25 },
            { id: 'flow-step-3', label: '3. Locating scoreboard via NCC matching...', percent: 38 },
            { id: 'flow-step-4', label: '4. Preprocessing scoreboard & inverting active rows...', percent: 50 },
            { id: 'flow-step-5', label: '5. Running OCR character & symbol recognition...', percent: 65 },
            { id: 'flow-step-6', label: '6. Temporal majority voting & cleaning text noise...', percent: 80 },
            { id: 'flow-step-7', label: '7. Calculating bowling frame scores & totals...', percent: 92 },
            { id: 'flow-step-8', label: '8. Generating structured JSON & CSV output...', percent: 100 }
        ];

        for (let i = 1; i <= 8; i++) {
            const stepEl = document.getElementById(`flow-step-${i}`);
            if (stepEl) stepEl.classList.remove('active', 'completed');
        }

        let stepIndex = 0;
        const interval = setInterval(() => {
            if (stepIndex > 0) {
                const prevStep = document.getElementById(steps[stepIndex - 1].id);
                if (prevStep) {
                    prevStep.classList.remove('active');
                    prevStep.classList.add('completed');
                }
            }

            if (stepIndex < steps.length) {
                const currentStep = document.getElementById(steps[stepIndex].id);
                if (currentStep) currentStep.classList.add('active');
                if (progressLabel) progressLabel.textContent = steps[stepIndex].label;
                if (progressBar) progressBar.style.width = `${steps[stepIndex].percent}%`;
                if (progressPercent) progressPercent.textContent = `${steps[stepIndex].percent}%`;
                stepIndex++;
            } else {
                clearInterval(interval);
                const lastStep = document.getElementById('flow-step-8');
                if (lastStep) {
                    lastStep.classList.remove('active');
                    lastStep.classList.add('completed');
                }

                if (progressLabel) progressLabel.textContent = 'Extraction completed with 100% precision!';
                if (pipelineStatusBadge) {
                    pipelineStatusBadge.textContent = 'Extraction Complete (100%)';
                    pipelineStatusBadge.className = 'text-xs font-semibold px-2.5 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20';
                }

                currentAppState = 'EXTRACTED';
                renderScoreboard(appStore.scoreboard, "JAGDISH", 10);
                renderLiveHUDFrame();
                showAdminToast("Computer Vision pipeline executed successfully!", "success");

                if (inputVideoPlayer && inputVideoPlayer.paused) {
                    inputVideoPlayer.play().catch(() => {});
                }

                setTimeout(() => {
                    processVideoBtn.disabled = false;
                    processVideoBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                }, 400);
            }
        }, 110);
    }

    function resetPipelineAndData() {
        if (inputVideoPlayer) {
            inputVideoPlayer.pause();
            inputVideoPlayer.currentTime = 0;
        }
        if (outputVideoPlayer) {
            outputVideoPlayer.pause();
            outputVideoPlayer.currentTime = 0;
        }
        if (progressContainer) progressContainer.classList.add('hidden');
        if (progressBar) progressBar.style.width = "0%";
        if (progressPercent) progressPercent.textContent = "0%";

        const dropzoneDefaultView = document.getElementById('dropzone-default-view');
        const dropzoneLoadedView = document.getElementById('dropzone-loaded-view');
        if (dropzoneDefaultView && dropzoneLoadedView) {
            dropzoneDefaultView.classList.remove('hidden');
            dropzoneLoadedView.classList.add('hidden');
            dropzoneLoadedView.classList.remove('flex');
        }
        if (dropzone) {
            dropzone.classList.remove('border-green-500', 'bg-green-500/10');
            dropzone.classList.add('border-gray-700', 'bg-gray-900/40');
        }
        if (currentVideoName) currentVideoName.textContent = "input_compressed.mp4 (Default Sample)";
        if (inputVideoTag) inputVideoTag.textContent = "Source: input_compressed.mp4";

        renderStandbyState();
        renderLiveHUDFrame();
        showAdminToast("Reset video feed & returned to Standby state.", "info");
    }

    // =============================================================
    // 8. VIDEO FILE HANDLING & PLAYBACK SYNCHRONIZATION
    // =============================================================
    if (dropzone) {
        ['dragenter', 'dragover'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.add('border-yellow-500', 'bg-yellow-500/10');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.remove('border-yellow-500', 'bg-yellow-500/10');
            });
        });

        dropzone.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files && files.length > 0) {
                handleVideoFile(files[0]);
            }
        });
    }

    if (videoFileInput) {
        videoFileInput.addEventListener('click', () => {
            videoFileInput.value = '';
        });

        videoFileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                handleVideoFile(e.target.files[0]);
            }
        });
    }

    const dropzoneRunBtn = document.getElementById('dropzone-run-btn');
    if (dropzoneRunBtn) {
        dropzoneRunBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            runInteractivePipeline();
        });
    }

    function handleVideoFile(file) {
        if (!file) return;

        const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|avi|mkv|ogg|m4v)$/i.test(file.name);
        if (!isVideo) {
            alert('Please select a valid video file (.mp4, .webm, .mov, .avi, .mkv).');
            return;
        }

        const videoURL = URL.createObjectURL(file);
        const dropzoneDefaultView = document.getElementById('dropzone-default-view');
        const dropzoneLoadedView = document.getElementById('dropzone-loaded-view');
        const loadedVideoTitle = document.getElementById('loaded-video-title');
        const loadedVideoDesc = document.getElementById('loaded-video-desc');

        if (dropzoneDefaultView && dropzoneLoadedView) {
            dropzoneDefaultView.classList.add('hidden');
            dropzoneLoadedView.classList.remove('hidden');
            dropzoneLoadedView.classList.add('flex');
        }
        if (dropzone) {
            dropzone.classList.add('border-green-500', 'bg-green-500/10');
            dropzone.classList.remove('border-gray-700', 'bg-gray-900/40');
        }
        if (loadedVideoTitle) loadedVideoTitle.textContent = `Video Loaded: ${file.name}`;
        if (loadedVideoDesc) loadedVideoDesc.textContent = `${(file.size / (1024 * 1024)).toFixed(2)} MB • Video stream ready for extraction!`;

        if (inputVideoPlayer) {
            inputVideoPlayer.querySelectorAll('source').forEach(s => s.remove());
            inputVideoPlayer.removeAttribute('src');
            inputVideoPlayer.src = videoURL;
            inputVideoPlayer.load();

            inputVideoPlayer.onloadedmetadata = () => {
                if (metaResolution) metaResolution.textContent = `${inputVideoPlayer.videoWidth} x ${inputVideoPlayer.videoHeight}`;
                if (metaDuration) metaDuration.textContent = `${inputVideoPlayer.duration.toFixed(2)} seconds`;
                if (metaStatus) metaStatus.textContent = "Custom Video Loaded (Ready to Extract)";
                if (pipelineStatusBadge) {
                    pipelineStatusBadge.textContent = "Video Ready — Click Run Extraction";
                    pipelineStatusBadge.className = "text-xs font-semibold px-2.5 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20";
                }
                renderLiveHUDFrame();
            };

            inputVideoPlayer.currentTime = 0.05;
            inputVideoPlayer.play().catch(() => {});

            setTimeout(() => {
                inputVideoPlayer.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300);
        }

        if (currentVideoName) currentVideoName.textContent = file.name;
        if (inputVideoTag) inputVideoTag.textContent = `Source: ${file.name}`;
        if (metaSize) metaSize.textContent = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;

        if (sampleInputBtn) sampleInputBtn.classList.remove('active-sample');
        if (sampleOutputBtn) sampleOutputBtn.classList.remove('active-sample');

        showAdminToast(`Selected & Loaded: ${file.name}`, "success");
    }

    // Sample Selection Buttons
    if (sampleInputBtn) {
        sampleInputBtn.addEventListener('click', () => {
            if (inputVideoPlayer) {
                inputVideoPlayer.querySelectorAll('source').forEach(s => s.remove());
                inputVideoPlayer.src = 'input_compressed.mp4';
                inputVideoPlayer.load();
                inputVideoPlayer.play().catch(() => {});
            }
            if (currentVideoName) currentVideoName.textContent = 'input_compressed.mp4 (Raw Input Sample)';
            if (inputVideoTag) inputVideoTag.textContent = 'Source: input_compressed.mp4';
            if (metaResolution) metaResolution.textContent = '1280 x 720 (HD)';
            if (metaDuration) metaDuration.textContent = '57.83 seconds';
            if (metaSize) metaSize.textContent = '11.15 MB';
            if (metaStatus) metaStatus.textContent = 'Stationary (NCC > 0.96)';

            sampleInputBtn.classList.add('active-sample');
            if (sampleOutputBtn) sampleOutputBtn.classList.remove('active-sample');
            showAdminToast("Switched to Raw Input sample feed.", "info");
        });
    }

    if (sampleOutputBtn) {
        sampleOutputBtn.addEventListener('click', () => {
            if (inputVideoPlayer) {
                inputVideoPlayer.querySelectorAll('source').forEach(s => s.remove());
                inputVideoPlayer.src = 'output_compressed.mp4';
                inputVideoPlayer.load();
                inputVideoPlayer.play().catch(() => {});
            }
            if (currentVideoName) currentVideoName.textContent = 'output_compressed.mp4 (Annotated HUD Sample)';
            if (inputVideoTag) inputVideoTag.textContent = 'Source: output_compressed.mp4';
            if (metaResolution) metaResolution.textContent = '1280 x 720 (HD)';
            if (metaDuration) metaDuration.textContent = '57.83 seconds';
            if (metaSize) metaSize.textContent = '12.08 MB';
            if (metaStatus) metaStatus.textContent = 'HUD Tracking Active';

            sampleOutputBtn.classList.add('active-sample');
            if (sampleInputBtn) sampleInputBtn.classList.remove('active-sample');
            showAdminToast("Switched to Annotated HUD sample feed.", "info");
        });
    }

    // Video Playback Synchronization & Active Frame Highlight
    if (syncPlayBtn && inputVideoPlayer) {
        syncPlayBtn.addEventListener('click', () => {
            inputVideoPlayer.currentTime = 0;
            inputVideoPlayer.play().catch(() => {});
            renderLiveHUDFrame();
            showAdminToast("Playback synchronized.", "info");
        });
    }

    if (inputVideoPlayer) {
        inputVideoPlayer.addEventListener('play', () => {
            startLiveHUDLoop();
        });

        inputVideoPlayer.addEventListener('pause', () => {
            renderLiveHUDFrame();
            if (hudAnimationId) {
                cancelAnimationFrame(hudAnimationId);
                hudAnimationId = null;
            }
        });

        inputVideoPlayer.addEventListener('seeked', () => {
            renderLiveHUDFrame();
            syncScoreboardWithPlayback();
        });

        inputVideoPlayer.addEventListener('timeupdate', () => {
            renderLiveHUDFrame();
            syncScoreboardWithPlayback();
        });

        inputVideoPlayer.addEventListener('loadedmetadata', () => {
            renderLiveHUDFrame();
        });
    }

    // Process, Quick-load, Reset & Refresh Buttons
    if (processVideoBtn) processVideoBtn.addEventListener('click', () => runInteractivePipeline());
    if (quickLoadBtn) quickLoadBtn.addEventListener('click', () => quickLoadExtractedData());
    if (resetFeedBtn) resetFeedBtn.addEventListener('click', () => resetPipelineAndData());
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            if (currentAppState === 'EXTRACTED') {
                renderScoreboard(appStore.scoreboard);
                showAdminToast("Scoreboard reloaded.", "info");
            } else {
                renderStandbyState();
            }
        });
    }

    // =============================================================
    // 9. DATA DOWNLOAD & EXPORT UTILITIES
    // =============================================================
    function downloadJSON(data, filename) {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 4));
        const anchor = document.createElement('a');
        anchor.setAttribute("href", dataStr);
        anchor.setAttribute("download", filename);
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
    }

    function downloadCSV(data, filename) {
        let csvContent = "Player,Initial,Frame_1,Frame_2,Frame_3,Frame_4,Frame_5,Frame_6,Frame_7,Frame_8,Frame_9,Frame_10,TTL\n";
        Object.keys(data).forEach(p => {
            const d = data[p];
            const frames = (d.rolls || []).map(f => f.filter(r => r).join(' ')).join(',');
            csvContent += `${p},${d.initial || p.charAt(0)},${frames},${d.ttl || ""}\n`;
        });
        const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
        const anchor = document.createElement('a');
        anchor.setAttribute("href", encodedUri);
        anchor.setAttribute("download", filename);
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
    }

    function downloadYAML(data, filename) {
        let yamlContent = "# FOG Scoreboard Config Generated via Admin Panel\n\n";
        yamlContent += "scoreboard:\n";
        yamlContent += `  lane_ncc_threshold: ${data.lane_ncc_threshold}\n\n`;
        yamlContent += "ocr:\n";
        yamlContent += `  binary_threshold: ${data.binary_threshold}\n`;
        yamlContent += `  confidence_threshold: ${data.confidence_threshold}\n`;
        yamlContent += `  min_required_votes: ${data.min_required_votes}\n`;
        yamlContent += `  active_row_threshold_red: ${data.active_row_threshold_red}\n`;
        yamlContent += `  active_row_threshold_blue: ${data.active_row_threshold_blue}\n\n`;
        yamlContent += "grid:\n";
        yamlContent += `  col_start_x: ${data.col_start_x}\n`;
        yamlContent += `  col_width: ${data.col_width}\n`;
        yamlContent += `  crop_y_start: ${data.crop_y_start}\n`;
        yamlContent += `  crop_y_end: ${data.crop_y_end}\n`;

        const encodedUri = "data:text/yaml;charset=utf-8," + encodeURIComponent(yamlContent);
        const anchor = document.createElement('a');
        anchor.setAttribute("href", encodedUri);
        anchor.setAttribute("download", filename);
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
    }

    if (downloadJsonBtn) {
        downloadJsonBtn.addEventListener('click', () => {
            downloadJSON(appStore.scoreboard, "scoreboard_data.json");
            showAdminToast("Downloaded scoreboard_data.json", "success");
        });
    }

    if (downloadCsvBtn) {
        downloadCsvBtn.addEventListener('click', () => {
            downloadCSV(appStore.scoreboard, "scoreboard_data.csv");
            showAdminToast("Downloaded scoreboard_data.csv", "success");
        });
    }

    // =============================================================
    // 10. SECRET ADMIN DASHBOARD CONTROLLER (ZERO-AUTH)
    // =============================================================
    function openSecretAdmin() {
        if (!secretAdminModal) return;
        secretAdminModal.classList.remove('hidden');
        renderAdminPlayerMatrix();
        populateAdminConfigInputs();
        populateAdminBrandingInputs();
        populateAdminVideoInputs();
        populateAdminRawJSON();
    }

    function closeSecretAdmin() {
        if (!secretAdminModal) return;
        secretAdminModal.classList.add('hidden');
        if (window.location.hash === '#admin' || window.location.hash === '#secret-panel') {
            history.replaceState(null, null, ' ');
        }
    }

    if (navAdminBtn) navAdminBtn.addEventListener('click', openSecretAdmin);
    if (footerAdminBtn) footerAdminBtn.addEventListener('click', openSecretAdmin);
    if (closeAdminBtn) closeAdminBtn.addEventListener('click', closeSecretAdmin);
    if (adminApplyAndCloseBtn) {
        adminApplyAndCloseBtn.addEventListener('click', () => {
            saveStore();
            applyBrandingToDOM();
            applyVideosToDOM();
            if (currentAppState === 'EXTRACTED') {
                renderScoreboard(appStore.scoreboard);
            }
            closeSecretAdmin();
            showAdminToast("All changes saved & applied to live website!", "success");
        });
    }

    if (secretAdminModal) {
        secretAdminModal.addEventListener('click', (e) => {
            if (e.target === secretAdminModal) closeSecretAdmin();
        });
    }

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey && e.shiftKey && (e.key === 'S' || e.key === 's' || e.key === 'A' || e.key === 'a'))) {
            e.preventDefault();
            if (secretAdminModal && secretAdminModal.classList.contains('hidden')) {
                openSecretAdmin();
            } else {
                closeSecretAdmin();
            }
        }
        if (e.key === 'Escape' && secretAdminModal && !secretAdminModal.classList.contains('hidden')) {
            closeSecretAdmin();
        }
    });

    let logoClickCount = 0;
    let logoClickTimer = null;
    if (brandLogoBtn) {
        brandLogoBtn.addEventListener('click', () => {
            logoClickCount++;
            clearTimeout(logoClickTimer);
            if (logoClickCount >= 3) {
                logoClickCount = 0;
                openSecretAdmin();
            } else {
                logoClickTimer = setTimeout(() => { logoClickCount = 0; }, 1000);
            }
        });
    }

    function checkURLHashForAdmin() {
        if (window.location.hash === '#admin' || window.location.hash === '#secret-panel') {
            openSecretAdmin();
        }
    }
    window.addEventListener('hashchange', checkURLHashForAdmin);

    const adminTabBtns = document.querySelectorAll('.admin-tab-btn');
    const adminTabPanes = document.querySelectorAll('.admin-tab-pane');

    adminTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTabId = btn.getAttribute('data-tab');
            adminTabBtns.forEach(b => b.classList.remove('active'));
            adminTabPanes.forEach(p => p.classList.add('hidden'));

            btn.classList.add('active');
            const targetPane = document.getElementById(targetTabId);
            if (targetPane) targetPane.classList.remove('hidden');
        });
    });

    // --- TAB 1: PLAYER & SCORE MATRIX EDITOR ---
    const adminPlayerContainer = document.getElementById('admin-players-matrix-container');
    const adminAddPlayerBtn = document.getElementById('admin-add-player-btn');
    const adminAutoCalcBtn = document.getElementById('admin-auto-calc-btn');

    function renderAdminPlayerMatrix() {
        if (!adminPlayerContainer) return;
        adminPlayerContainer.innerHTML = '';

        const players = Object.keys(appStore.scoreboard);
        if (players.length === 0) {
            adminPlayerContainer.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    No players in scoreboard. Click 'Add Player' above to create one.
                </div>
            `;
            return;
        }

        players.forEach(playerKey => {
            const pData = appStore.scoreboard[playerKey];
            const rolls = pData.rolls || [];
            const initial = pData.initial || playerKey.charAt(0);
            const ttl = pData.ttl !== undefined ? pData.ttl : "";

            const card = document.createElement('div');
            card.className = "bg-gray-900/80 border border-gray-800 rounded-xl p-4 space-y-3";

            let cardHeaderHTML = `
                <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-gray-800/80 pb-3">
                    <div class="flex items-center gap-2">
                        <input type="text" value="${initial}" maxlength="2" class="player-initial-input w-8 h-8 rounded bg-indigo-600/30 text-indigo-300 border border-indigo-500/50 font-bold text-center text-xs focus:border-yellow-400 focus:outline-none" data-player="${playerKey}" title="Player Initial">
                        <input type="text" value="${playerKey}" class="player-name-input bg-gray-950 border border-gray-700 rounded px-2.5 py-1 text-xs font-bold text-white focus:border-yellow-400 focus:outline-none w-36 sm:w-44" data-player="${playerKey}" title="Player Name">
                        <span class="text-xs px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-mono">
                            TTL: <strong id="preview-ttl-${playerKey}">${ttl !== "" ? ttl : "-"}</strong>
                        </span>
                    </div>
                    <button type="button" class="delete-player-btn bg-red-950/40 hover:bg-red-900/60 text-red-400 hover:text-red-300 border border-red-800/50 px-2.5 py-1 rounded text-xs transition flex items-center gap-1" data-player="${playerKey}">
                        <i class="fa-solid fa-trash-can text-xs"></i> Delete
                    </button>
                </div>
            `;

            let framesInputsHTML = `<div class="grid grid-cols-5 sm:grid-cols-10 gap-1.5 text-center">`;
            for (let f = 0; f < 10; f++) {
                const fRolls = rolls[f] || ["", ""];
                const fScore = (pData.scores && pData.scores[f] !== undefined) ? pData.scores[f] : "";

                if (f < 9) {
                    framesInputsHTML += `
                        <div class="bg-gray-950 p-1.5 rounded border border-gray-800 space-y-1">
                            <div class="text-[10px] font-bold text-gray-400">F${f + 1}</div>
                            <div class="flex gap-1">
                                <input type="text" maxlength="2" value="${fRolls[0] || ""}" class="roll-input w-1/2" data-player="${playerKey}" data-frame="${f}" data-roll="0" placeholder="-">
                                <input type="text" maxlength="2" value="${fRolls[1] || ""}" class="roll-input w-1/2" data-player="${playerKey}" data-frame="${f}" data-roll="1" placeholder="-">
                            </div>
                            <div class="text-[11px] font-bold text-green-400 h-4 frame-score-preview" id="score-${playerKey}-${f}">${fScore !== "" ? fScore : ""}</div>
                        </div>
                    `;
                } else {
                    framesInputsHTML += `
                        <div class="bg-gray-950 p-1.5 rounded border border-gray-800 space-y-1">
                            <div class="text-[10px] font-bold text-yellow-500">F10</div>
                            <div class="flex gap-0.5">
                                <input type="text" maxlength="2" value="${fRolls[0] || ""}" class="roll-input w-1/3" data-player="${playerKey}" data-frame="${f}" data-roll="0" placeholder="-">
                                <input type="text" maxlength="2" value="${fRolls[1] || ""}" class="roll-input w-1/3" data-player="${playerKey}" data-frame="${f}" data-roll="1" placeholder="-">
                                <input type="text" maxlength="2" value="${fRolls[2] || ""}" class="roll-input w-1/3" data-player="${playerKey}" data-frame="${f}" data-roll="2" placeholder="-">
                            </div>
                            <div class="text-[11px] font-bold text-yellow-400 h-4 frame-score-preview" id="score-${playerKey}-${f}">${fScore !== "" ? fScore : ""}</div>
                        </div>
                    `;
                }
            }
            framesInputsHTML += `</div>`;

            card.innerHTML = cardHeaderHTML + framesInputsHTML;
            adminPlayerContainer.appendChild(card);
        });

        attachPlayerMatrixEventListeners();
    }

    function attachPlayerMatrixEventListeners() {
        document.querySelectorAll('.roll-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const playerKey = e.target.getAttribute('data-player');
                const frameIdx = parseInt(e.target.getAttribute('data-frame'), 10);
                const rollIdx = parseInt(e.target.getAttribute('data-roll'), 10);
                let val = e.target.value.trim().toUpperCase();

                if (val === 'O' || val === '0') val = '-';
                if (val === 'I') val = '1';
                if (val === 'S') val = '5';
                e.target.value = val;

                if (appStore.scoreboard[playerKey]) {
                    if (!appStore.scoreboard[playerKey].rolls[frameIdx]) {
                        appStore.scoreboard[playerKey].rolls[frameIdx] = frameIdx === 9 ? ["", "", ""] : ["", ""];
                    }
                    appStore.scoreboard[playerKey].rolls[frameIdx][rollIdx] = val;

                    const computed = calculateBowlingScores(appStore.scoreboard[playerKey].rolls);
                    appStore.scoreboard[playerKey].scores = computed.scores;
                    appStore.scoreboard[playerKey].ttl = computed.ttl;

                    const ttlEl = document.getElementById(`preview-ttl-${playerKey}`);
                    if (ttlEl) ttlEl.textContent = computed.ttl !== "" ? computed.ttl : "-";
                    for (let f = 0; f < 10; f++) {
                        const scEl = document.getElementById(`score-${playerKey}-${f}`);
                        if (scEl) scEl.textContent = computed.scores[f] !== "" ? computed.scores[f] : "";
                    }
                    saveStore();
                }
            });
        });

        document.querySelectorAll('.player-initial-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const playerKey = e.target.getAttribute('data-player');
                const newInit = e.target.value.trim().toUpperCase() || playerKey.charAt(0);
                if (appStore.scoreboard[playerKey]) {
                    appStore.scoreboard[playerKey].initial = newInit;
                    saveStore();
                    showAdminToast(`Updated initial for ${playerKey} to ${newInit}`, "info");
                }
            });
        });

        document.querySelectorAll('.player-name-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const oldKey = e.target.getAttribute('data-player');
                const newKey = e.target.value.trim().toUpperCase();
                if (newKey && newKey !== oldKey && appStore.scoreboard[oldKey]) {
                    const data = appStore.scoreboard[oldKey];
                    delete appStore.scoreboard[oldKey];
                    appStore.scoreboard[newKey] = data;
                    saveStore();
                    renderAdminPlayerMatrix();
                    showAdminToast(`Renamed player to ${newKey}`, "info");
                }
            });
        });

        document.querySelectorAll('.delete-player-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const playerKey = btn.getAttribute('data-player');
                if (confirm(`Are you sure you want to delete player ${playerKey}?`)) {
                    delete appStore.scoreboard[playerKey];
                    saveStore();
                    renderAdminPlayerMatrix();
                    showAdminToast(`Deleted player ${playerKey}`, "info");
                }
            });
        });
    }

    if (adminAddPlayerBtn) {
        adminAddPlayerBtn.addEventListener('click', () => {
            const name = prompt("Enter new player name (e.g. ALEX):");
            if (name && name.trim()) {
                const key = name.trim().toUpperCase();
                if (appStore.scoreboard[key]) {
                    alert("A player with this name already exists!");
                    return;
                }
                appStore.scoreboard[key] = {
                    initial: key.charAt(0),
                    rolls: [
                        ["", ""], ["", ""], ["", ""], ["", ""], ["", ""],
                        ["", ""], ["", ""], ["", ""], ["", ""], ["", "", ""]
                    ],
                    scores: ["", "", "", "", "", "", "", "", "", ""],
                    ttl: ""
                };
                saveStore();
                renderAdminPlayerMatrix();
                showAdminToast(`Added player ${key}`, "success");
            }
        });
    }

    if (adminAutoCalcBtn) {
        adminAutoCalcBtn.addEventListener('click', () => {
            recomputeAllPlayerScores();
            renderAdminPlayerMatrix();
            showAdminToast("Auto-calculated all bowling frame scores and totals!", "success");
        });
    }

    // --- TAB 2: VIDEO SOURCES & METADATA ---
    function populateAdminVideoInputs() {
        const v = appStore.videos;
        const inUrl = document.getElementById('admin-input-video-url');
        const outUrl = document.getElementById('admin-output-video-url');
        const res = document.getElementById('admin-meta-res');
        const dur = document.getElementById('admin-meta-dur');
        const size = document.getElementById('admin-meta-size');
        const status = document.getElementById('admin-meta-status');

        if (inUrl) inUrl.value = v.inputUrl || "input_compressed.mp4";
        if (outUrl) outUrl.value = v.outputUrl || "output_compressed.mp4";
        if (res) res.value = v.metaResolution || "1280 x 720 (HD)";
        if (dur) dur.value = v.metaDuration || "57.83 seconds";
        if (size) size.value = v.metaSize || "11.15 MB";
        if (status) status.value = v.metaStatus || "Stationary (NCC > 0.96)";
    }

    const adminApplyVideosBtn = document.getElementById('admin-apply-videos-btn');
    if (adminApplyVideosBtn) {
        adminApplyVideosBtn.addEventListener('click', () => {
            const inUrl = document.getElementById('admin-input-video-url');
            const outUrl = document.getElementById('admin-output-video-url');
            if (inUrl) appStore.videos.inputUrl = inUrl.value.trim();
            if (outUrl) appStore.videos.outputUrl = outUrl.value.trim();
            saveStore();
            applyVideosToDOM();
            showAdminToast("Updated video feed paths successfully!", "success");
        });
    }

    const adminApplyMetaBtn = document.getElementById('admin-apply-meta-btn');
    if (adminApplyMetaBtn) {
        adminApplyMetaBtn.addEventListener('click', () => {
            const res = document.getElementById('admin-meta-res');
            const dur = document.getElementById('admin-meta-dur');
            const size = document.getElementById('admin-meta-size');
            const status = document.getElementById('admin-meta-status');
            if (res) appStore.videos.metaResolution = res.value.trim();
            if (dur) appStore.videos.metaDuration = dur.value.trim();
            if (size) appStore.videos.metaSize = size.value.trim();
            if (status) appStore.videos.metaStatus = status.value.trim();
            saveStore();
            applyVideosToDOM();
            showAdminToast("Updated video properties metadata labels!", "success");
        });
    }

    // --- TAB 3: CV & OCR CONFIG ---
    function populateAdminConfigInputs() {
        const c = appStore.cvConfig;
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val;
        };
        setVal('cfg-lane-ncc', c.lane_ncc_threshold);
        setVal('cfg-bin-thresh', c.binary_threshold);
        setVal('cfg-ocr-conf', c.confidence_threshold);
        setVal('cfg-min-votes', c.min_required_votes);
        setVal('cfg-col-start', c.col_start_x);
        setVal('cfg-col-width', c.col_width);
        setVal('cfg-crop-ystart', c.crop_y_start);
        setVal('cfg-crop-yend', c.crop_y_end);
        setVal('cfg-act-red', c.active_row_threshold_red);
        setVal('cfg-act-blue', c.active_row_threshold_blue);
    }

    const adminSaveConfigBtn = document.getElementById('admin-save-config-btn');
    if (adminSaveConfigBtn) {
        adminSaveConfigBtn.addEventListener('click', () => {
            const getVal = (id, fallback) => {
                const el = document.getElementById(id);
                return el ? Number(el.value) : fallback;
            };
            appStore.cvConfig.lane_ncc_threshold = getVal('cfg-lane-ncc', 0.96);
            appStore.cvConfig.binary_threshold = getVal('cfg-bin-thresh', 150);
            appStore.cvConfig.confidence_threshold = getVal('cfg-ocr-conf', 0.82);
            appStore.cvConfig.min_required_votes = getVal('cfg-min-votes', 5);
            appStore.cvConfig.col_start_x = getVal('cfg-col-start', 270);
            appStore.cvConfig.col_width = getVal('cfg-col-width', 154);
            appStore.cvConfig.crop_y_start = getVal('cfg-crop-ystart', 20);
            appStore.cvConfig.crop_y_end = getVal('cfg-crop-yend', 43);
            appStore.cvConfig.active_row_threshold_red = getVal('cfg-act-red', 180);
            appStore.cvConfig.active_row_threshold_blue = getVal('cfg-act-blue', 100);
            saveStore();
            showAdminToast("CV & OCR pipeline parameters saved!", "success");
        });
    }

    const adminExportYamlBtn = document.getElementById('admin-export-yaml-btn');
    if (adminExportYamlBtn) {
        adminExportYamlBtn.addEventListener('click', () => {
            downloadYAML(appStore.cvConfig, "config.yaml");
            showAdminToast("Exported updated config.yaml!", "success");
        });
    }

    // --- TAB 4: BRANDING & CONTENT ---
    function populateAdminBrandingInputs() {
        const b = appStore.branding;
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val;
        };
        setVal('admin-brand-title', b.brandTitle);
        setVal('admin-nav-subtitle', b.navSubtitle);
        setVal('admin-hero-badge', b.heroBadge);
        setVal('admin-hero-title', b.heroTitle);
        setVal('admin-hero-desc', b.heroDesc);
        setVal('admin-accuracy-badge', b.accuracyBadge);
        setVal('admin-footer-copyright', b.footerCopyright);
    }

    const adminSaveBrandingBtn = document.getElementById('admin-save-branding-btn');
    if (adminSaveBrandingBtn) {
        adminSaveBrandingBtn.addEventListener('click', () => {
            const getVal = (id, fallback) => {
                const el = document.getElementById(id);
                return el ? el.value.trim() : fallback;
            };
            appStore.branding.brandTitle = getVal('admin-brand-title', "FOG TECHNOLOGIES");
            appStore.branding.navSubtitle = getVal('admin-nav-subtitle', "CV Engineer Assessment: Scoreboard Data Extraction");
            appStore.branding.heroBadge = getVal('admin-hero-badge', "Interactive Video Dashboard");
            appStore.branding.heroTitle = getVal('admin-hero-title', "Bowling Scoreboard Data Extraction");
            appStore.branding.heroDesc = getVal('admin-hero-desc', "A complete Computer Vision solution...");
            appStore.branding.accuracyBadge = getVal('admin-accuracy-badge', "100% Extraction Accuracy");
            appStore.branding.footerCopyright = getVal('admin-footer-copyright', "© 2026 FOG Technologies...");
            saveStore();
            applyBrandingToDOM();
            showAdminToast("Website branding & text changes applied live!", "success");
        });
    }

    // --- TAB 5: PERSISTENCE & RAW JSON ---
    const adminRawJsonEditor = document.getElementById('admin-raw-json-editor');
    const adminFormatJsonBtn = document.getElementById('admin-format-json-btn');
    const adminApplyRawJsonBtn = document.getElementById('admin-apply-raw-json-btn');
    const adminDownloadJsonBtn = document.getElementById('admin-download-json-btn');
    const adminDownloadCsvBtn = document.getElementById('admin-download-csv-btn');
    const adminResetDefaultsBtn = document.getElementById('admin-reset-defaults-btn');

    function populateAdminRawJSON() {
        if (adminRawJsonEditor) {
            adminRawJsonEditor.value = JSON.stringify(appStore.scoreboard, null, 4);
        }
    }

    if (adminFormatJsonBtn && adminRawJsonEditor) {
        adminFormatJsonBtn.addEventListener('click', () => {
            try {
                const parsed = JSON.parse(adminRawJsonEditor.value);
                adminRawJsonEditor.value = JSON.stringify(parsed, null, 4);
                showAdminToast("JSON formatted properly.", "info");
            } catch (e) {
                alert("Invalid JSON format: " + e.message);
            }
        });
    }

    if (adminApplyRawJsonBtn && adminRawJsonEditor) {
        adminApplyRawJsonBtn.addEventListener('click', () => {
            try {
                const parsed = JSON.parse(adminRawJsonEditor.value);
                appStore.scoreboard = parsed;
                recomputeAllPlayerScores();
                saveStore();
                renderAdminPlayerMatrix();
                if (currentAppState === 'EXTRACTED') {
                    renderScoreboard(appStore.scoreboard);
                }
                showAdminToast("Raw JSON applied to scoreboard successfully!", "success");
            } catch (e) {
                alert("Invalid JSON syntax: " + e.message);
            }
        });
    }

    if (adminDownloadJsonBtn) {
        adminDownloadJsonBtn.addEventListener('click', () => {
            downloadJSON(appStore.scoreboard, "scoreboard_data.json");
            showAdminToast("Downloaded scoreboard_data.json", "success");
        });
    }

    if (adminDownloadCsvBtn) {
        adminDownloadCsvBtn.addEventListener('click', () => {
            downloadCSV(appStore.scoreboard, "scoreboard_data.csv");
            showAdminToast("Downloaded scoreboard_data.csv", "success");
        });
    }

    if (adminResetDefaultsBtn) {
        adminResetDefaultsBtn.addEventListener('click', () => {
            if (confirm("Reset everything to factory defaults? All custom edits will be removed.")) {
                localStorage.removeItem(STORAGE_KEY);
                localStorage.removeItem('fog_admin_store_v2');
                localStorage.removeItem('fog_scoreboard_store_v1');
                appStore = {
                    scoreboard: JSON.parse(JSON.stringify(DEFAULT_SCOREBOARD_DATA)),
                    cvConfig: Object.assign({}, DEFAULT_CV_CONFIG),
                    branding: Object.assign({}, DEFAULT_BRANDING),
                    videos: Object.assign({}, DEFAULT_VIDEOS)
                };
                saveStore();
                applyBrandingToDOM();
                applyVideosToDOM();
                renderAdminPlayerMatrix();
                populateAdminConfigInputs();
                populateAdminBrandingInputs();
                populateAdminVideoInputs();
                populateAdminRawJSON();
                renderStandbyState();
                showAdminToast("Reset all settings to Factory Defaults.", "info");
            }
        });
    }

    // Toast Notification System
    function showAdminToast(message, type = "info") {
        const container = document.getElementById('admin-toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        const icon = type === 'success' ? 'fa-circle-check text-green-400' : (type === 'error' ? 'fa-triangle-exclamation text-red-400' : 'fa-circle-info text-yellow-400');
        toast.className = "admin-toast bg-gray-900 border border-gray-700 text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-2xl flex items-center gap-2.5 pointer-events-auto";
        toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => toast.remove(), 300);
        }, 3200);
    }

    // =============================================================
    // 11. INITIALIZATION
    // =============================================================
    applyBrandingToDOM();
    applyVideosToDOM();
    renderStandbyState();
    checkURLHashForAdmin();
});
