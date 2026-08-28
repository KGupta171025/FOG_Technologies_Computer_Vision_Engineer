document.addEventListener('DOMContentLoaded', () => {
    const scoreboardBody = document.getElementById('scoreboard-body');
    const refreshBtn = document.getElementById('refresh-btn');
    
    // Mock data to use as a fallback if CORS blocks local file fetching (e.g. opening via file://)
    const mockData = {
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

    async function loadScoreboardData() {
        scoreboardBody.innerHTML = `
            <tr>
                <td colspan="12" class="py-12 text-gray-500 text-lg">
                    <i class="fa-solid fa-spinner fa-spin mr-2"></i> Loading scoreboard data...
                </td>
            </tr>
        `;

        try {
            // Attempt to load live data
            const response = await fetch('scoreboard_data.json');
            if (!response.ok) throw new Error('Failed to load JSON file');
            const data = await response.json();
            renderScoreboard(data, false);
        } catch (error) {
            console.warn("Could not fetch scoreboard_data.json (likely due to local file:// CORS policy). Falling back to pre-rendered mock data.", error);
            // Render mock data with a warning badge
            renderScoreboard(mockData, true);
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
            
            // Generate rows
            const tr = document.createElement('tr');
            tr.className = "hover:bg-gray-900/50 transition-colors";
            
            // Name Cell
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
                
                // Count strikes/spares
                frameRolls.forEach(r => {
                    if (r === 'X') strikeCount++;
                    if (r === '/') spareCount++;
                });

                // Generate sub-cells for rolls
                let rollsSubHTML = '';
                if (i < 9) {
                    rollsSubHTML = `
                        <div class="roll-box-container">
                            <div class="roll-cell">${frameRolls[0] || "&nbsp;"}</div>
                            <div class="roll-cell">${frameRolls[1] || "&nbsp;"}</div>
                        </div>
                    `;
                } else {
                    // 10th Frame (3 rolls)
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

            // Total (TTL) Cell
            const ttlHTML = `
                <td class="border-l border-gray-800 bg-gray-900/30 total-score-cell align-middle">
                    ${ttl}
                </td>
            `;

            tr.innerHTML = nameHTML + framesHTML + ttlHTML;
            scoreboardBody.appendChild(tr);

            // Populate Chart Data
            chartData.labels.push(player);
            chartData.ttls.push(ttl);
            chartData.strikes.push(strikeCount);
            chartData.spares.push(spareCount);
        });

        // Add warning alert if using mock data (CORS workaround)
        if (isMock) {
            const warningRow = document.createElement('tr');
            warningRow.innerHTML = `
                <td colspan="12" class="py-4 px-6 bg-yellow-500/10 text-yellow-500 border-t border-yellow-500/20 text-sm text-center">
                    <i class="fa-solid fa-triangle-exclamation mr-2"></i> 
                    Showing <strong>Offline Mock Data</strong> because CORS blocked loading the JSON file locally. 
                    Once you deploy this repository to <strong>GitHub Pages</strong> or run a local server, it will load the live extracted JSON file dynamically.
                </td>
            `;
            scoreboardBody.prepend(warningRow);
        }

        // Render/Update Charts
        renderCharts(chartData);
    }

    function renderCharts(chartData) {
        // Destroy existing charts to prevent rendering glitches
        if (scoresChart) scoresChart.destroy();
        if (rollsChart) rollsChart.destroy();

        const ctxScores = document.getElementById('scores-chart').getContext('2d');
        const ctxRolls = document.getElementById('rolls-chart').getContext('2d');

        // Score Chart
        scoresChart = new Chart(ctxScores, {
            type: 'bar',
            data: {
                labels: chartData.labels,
                datasets: [{
                    label: 'Total Score (TTL)',
                    data: chartData.ttls,
                    backgroundColor: [
                        'rgba(99, 102, 241, 0.65)',   // indigo-500
                        'rgba(168, 85, 247, 0.65)',   // purple-500
                        'rgba(236, 72, 153, 0.65)',   // pink-500
                        'rgba(245, 158, 11, 0.65)'    // yellow-500
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
                plugins: {
                    legend: { display: false }
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

        // Rolls (Strikes vs Spares) Chart
        rollsChart = new Chart(ctxRolls, {
            type: 'bar',
            data: {
                labels: chartData.labels,
                datasets: [
                    {
                        label: 'Strikes (X)',
                        data: chartData.strikes,
                        backgroundColor: 'rgba(16, 185, 129, 0.65)', // green-500
                        borderColor: 'rgb(16, 185, 129)',
                        borderWidth: 1.5,
                        borderRadius: 6
                    },
                    {
                        label: 'Spares (/)',
                        data: chartData.spares,
                        backgroundColor: 'rgba(59, 130, 246, 0.65)', // blue-500
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
                    legend: {
                        labels: { color: '#9CA3AF' }
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

    refreshBtn.addEventListener('click', loadScoreboardData);
    
    // Initial Load
    loadScoreboardData();
});
