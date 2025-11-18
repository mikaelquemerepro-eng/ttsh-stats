console.log('Script chargé - v2');
let allData = {};

async function loadData() {
    try {
        console.log('Chargement des données...');
        const j3Response = await fetch('J3_20251012/tous_les_matchs.json');
        const j4Response = await fetch('J4_20251116/tous_les_matchs.json');
        const statsResponse = await fetch('statistiques.json');
        
        allData['J3_20251012'] = await j3Response.json();
        allData['J4_20251116'] = await j4Response.json();
        allData['statistiques'] = await statsResponse.json();
        
        console.log('Données J3:', allData['J3_20251012'].length, 'matchs');
        console.log('Données J4:', allData['J4_20251116'].length, 'matchs');
        console.log('Statistiques:', Object.keys(allData['statistiques'].joueurs).length, 'joueurs');
        
        displayMatches('J3_20251012');
        displayMatches('J4_20251116');
        displayStatistics();
        displayClubStatistics();
        createGlobalSetDistributionChart();
    } catch (error) {
        console.error('Erreur de chargement des données:', error);
        alert('Erreur: ' + error.message);
    }
}

function showMainSection(sectionId, element) {
    // Update main tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    if (element) {
        element.classList.add('active');
    }
    
    // Update main sections
    document.querySelectorAll('.main-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionId).classList.add('active');
}

function showJournee(journeeId, element) {
    // Update sidebar tabs
    document.querySelectorAll('.sidebar-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    if (element) {
        element.classList.add('active');
    }
    
    // Update journee sections
    document.querySelectorAll('.journee-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(journeeId).classList.add('active');
}

function displayStatistics() {
    if (!allData['statistiques']) {
        console.error('Pas de statistiques disponibles');
        return;
    }
    
    const stats = allData['statistiques'];
    const joueurs = stats.joueurs;
    
    // Convertir en tableau et trier par taux de victoire
    let joueursArray = Object.entries(joueurs).map(([nom, data]) => ({
        nom: nom,
        ...data
    }));
    
    // Filtrer les joueurs avec au moins 3 matches
    joueursArray = joueursArray.filter(j => j.matches.total >= 3);
    
    // Trier par taux de victoire puis victoires
    joueursArray.sort((a, b) => {
        if (b.matches.taux_victoire !== a.matches.taux_victoire) {
            return b.matches.taux_victoire - a.matches.taux_victoire;
        }
        return b.matches.victoires - a.matches.victoires;
    });
    
    const container = document.getElementById('stats-content');
    
    let html = `
        <h3 style="color: #667eea; margin-bottom: 20px;">🏆 Classement des joueurs (minimum 3 matches)</h3>
        <table class="stats-table" id="stats-table">
            <thead>
                <tr>
                    <th data-column="rank" data-type="number">#</th>
                    <th data-column="nom" data-type="string">Joueur</th>
                    <th data-column="points_officiels" data-type="number">Points</th>
                    <th data-column="matches.total" data-type="number">Matches</th>
                    <th data-column="matches.victoires" data-type="number">Victoires</th>
                    <th data-column="matches.defaites" data-type="number">Défaites</th>
                    <th data-column="matches.taux_victoire" data-type="number">Taux de victoire</th>
                    <th data-column="sets.total" data-type="number">Sets</th>
                    <th data-column="sets.ratio" data-type="number">Ratio sets</th>
                    <th data-column="performance_classement.score" data-type="number" title="Points gagnés contre mieux classés - Points perdus contre moins bien classés">Perf. Classement</th>
                </tr>
            </thead>
            <tbody id="stats-table-body">
    `;
    
    joueursArray.forEach((joueur, index) => {
        const winRate = joueur.matches.taux_victoire;
        const totalSets = joueur.sets.gagnes + joueur.sets.perdus;
        const perfScore = joueur.performance_classement?.score || 0;
        const perfClass = perfScore > 0 ? 'badge-success' : perfScore < 0 ? 'badge-warning' : 'badge-info';
        const perfSign = perfScore > 0 ? '+' : '';
        
        html += `
            <tr>
                <td class="rank">${index + 1}</td>
                <td class="player-name-cell">${joueur.nom}</td>
                <td><span class="stats-badge badge-info">${joueur.points_officiels} pts</span></td>
                <td>${joueur.matches.total}</td>
                <td><span class="stats-badge badge-success">${joueur.matches.victoires}</span></td>
                <td><span class="stats-badge badge-warning">${joueur.matches.defaites}</span></td>
                <td>
                    <div class="win-rate-bar">
                        <div class="win-rate-fill" style="width: ${winRate}%"></div>
                        <div class="win-rate-text">${winRate}%</div>
                    </div>
                </td>
                <td>${joueur.sets.gagnes} - ${joueur.sets.perdus}</td>
                <td>${(joueur.sets.ratio * 100).toFixed(0)}%</td>
                <td><span class="stats-badge ${perfClass}">${perfSign}${perfScore}</span></td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    container.innerHTML = html;
    
    // Ajouter les événements de tri
    initSortableTable(joueursArray);
}

function displayClubStatistics() {
    if (!allData['statistiques']) {
        console.error('Pas de statistiques disponibles');
        return;
    }
    
    const stats = allData['statistiques'];
    const joueurs = stats.joueurs;
    
    const container = document.getElementById('stats-club-content');
    
    let html = `
        <div style="margin-bottom: 30px;">
            <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));">
                <div class="stat-card">
                    <div class="number">${Object.keys(joueurs).length}</div>
                    <div class="label">Joueurs</div>
                </div>
                <div class="stat-card">
                    <div class="number">${stats.totaux.nombre_matches}</div>
                    <div class="label">Matchs d'équipe</div>
                </div>
                <div class="stat-card">
                    <div class="number">${stats.totaux.nombre_rencontres}</div>
                    <div class="label">Rencontres</div>
                </div>
                <div class="stat-card">
                    <div class="number">${stats.totaux.nombre_journees}</div>
                    <div class="label">Journées</div>
                </div>
            </div>
        </div>
        
        <div class="chart-container" style="margin-top: 30px;">
            <h3>📊 Taux de réussite par nombre de sets joués (toutes journées)</h3>
            <div class="chart-layout">
                <div class="chart-ratio" id="ratio-global">
                    <div class="ratio-label">Ratio global</div>
                    <div class="ratio-value">-</div>
                    <div class="ratio-details">
                        <div class="ratio-item">
                            <div class="ratio-item-value" id="wins-global">-</div>
                            <div class="ratio-item-label">Victoires</div>
                        </div>
                        <div class="ratio-item">
                            <div class="ratio-item-value" id="losses-global">-</div>
                            <div class="ratio-item-label">Défaites</div>
                        </div>
                    </div>
                </div>
                <div class="chart-wrapper" style="flex: 1;">
                    <canvas id="chart-stats-global"></canvas>
                </div>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

// Fonction de tri du tableau
function initSortableTable(joueursData) {
    const table = document.getElementById('stats-table');
    if (!table) return;
    
    const headers = table.querySelectorAll('th');
    let currentSort = { column: 'matches.taux_victoire', direction: 'desc' };
    let sortedData = [...joueursData];
    
    // Marquer la colonne par défaut
    headers.forEach(th => {
        if (th.getAttribute('data-column') === currentSort.column) {
            th.classList.add('sort-desc');
        }
    });
    
    headers.forEach((header, index) => {
        const column = header.getAttribute('data-column');
        const type = header.getAttribute('data-type');
        
        if (!column) return;
        
        header.addEventListener('click', () => {
            // Déterminer la direction du tri
            let direction = 'asc';
            if (currentSort.column === column) {
                direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
            }
            
            // Mettre à jour les classes CSS
            headers.forEach(th => {
                th.classList.remove('sort-asc', 'sort-desc');
            });
            header.classList.add(direction === 'asc' ? 'sort-asc' : 'sort-desc');
            
            // Fonction pour obtenir la valeur d'une propriété imbriquée
            const getValue = (obj, path) => {
                if (path === 'rank') return joueursData.indexOf(obj) + 1;
                if (path === 'sets.total') return obj.sets.gagnes + obj.sets.perdus;
                return path.split('.').reduce((o, p) => o?.[p], obj);
            };
            
            // Trier les données
            sortedData.sort((a, b) => {
                let valA = getValue(a, column);
                let valB = getValue(b, column);
                
                // Gérer les valeurs nulles/undefined
                if (valA == null) valA = type === 'number' ? -Infinity : '';
                if (valB == null) valB = type === 'number' ? -Infinity : '';
                
                let comparison = 0;
                if (type === 'number') {
                    comparison = valA - valB;
                } else {
                    comparison = valA.toString().localeCompare(valB.toString());
                }
                
                return direction === 'asc' ? comparison : -comparison;
            });
            
            currentSort = { column, direction };
            
            // Réafficher le tableau
            updateTableRows(sortedData);
        });
    });
}

function createGlobalSetDistributionChart() {
    // Combiner tous les matchs de toutes les journées
    const allMatches = [];
    
    if (allData['J3_20251012']) {
        allMatches.push(...allData['J3_20251012']);
    }
    if (allData['J4_20251116']) {
        allMatches.push(...allData['J4_20251116']);
    }
    
    if (allMatches.length === 0) return;
    
    // Compter les victoires et défaites par nombre de sets joués
    const stats = {
        sets3: { wins: 0, losses: 0 },
        sets4: { wins: 0, losses: 0 },
        sets5: { wins: 0, losses: 0 }
    };
    
    allMatches.forEach(match => {
        const equipeA = match.equipes.equipe_a;
        const equipeX = match.equipes.equipe_x;
        const isHerblainA = equipeA.nom && equipeA.nom.includes('HERBLAIN');
        const isHerblainX = equipeX.nom && equipeX.nom.includes('HERBLAIN');
        
        match.rencontres.forEach(r => {
            let setsWonA = 0;
            let setsWonX = 0;
            if (r.sets && Array.isArray(r.sets)) {
                r.sets.forEach(s => {
                    const scoreA = s.equipe_a || s.score_a || 0;
                    const scoreX = s.equipe_x || s.score_x || 0;
                    if (scoreA > scoreX) setsWonA++;
                    else if (scoreX > scoreA) setsWonX++;
                });
            }
            
            const totalSets = setsWonA + setsWonX;
            let herblainWon = false;
            
            if (isHerblainA) {
                herblainWon = setsWonA > setsWonX;
            } else if (isHerblainX) {
                herblainWon = setsWonX > setsWonA;
            } else {
                return;
            }
            
            if (totalSets === 3) {
                if (herblainWon) stats.sets3.wins++;
                else stats.sets3.losses++;
            } else if (totalSets === 4) {
                if (herblainWon) stats.sets4.wins++;
                else stats.sets4.losses++;
            } else if (totalSets === 5) {
                if (herblainWon) stats.sets5.wins++;
                else stats.sets5.losses++;
            }
        });
    });
    
    const calcPercentage = (wins, losses) => {
        const total = wins + losses;
        return total > 0 ? ((wins / total) * 100).toFixed(1) : 0;
    };
    
    // Mettre à jour le ratio global
    const totalWins = stats.sets3.wins + stats.sets4.wins + stats.sets5.wins;
    const totalLosses = stats.sets3.losses + stats.sets4.losses + stats.sets5.losses;
    const totalMatches = totalWins + totalLosses;
    const winPercentage = totalMatches > 0 ? ((totalWins / totalMatches) * 100).toFixed(0) : 0;
    
    document.getElementById('wins-global').textContent = totalWins;
    document.getElementById('losses-global').textContent = totalLosses;
    document.getElementById('ratio-global').querySelector('.ratio-value').textContent = `${winPercentage}%`;
    
    const canvas = document.getElementById('chart-stats-global');
    if (!canvas) return;
    
    if (window.chart_stats_global) {
        window.chart_stats_global.destroy();
    }
    
    window.chart_stats_global = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: ['3 sets', '4 sets', '5 sets'],
            datasets: [
                {
                    label: 'Victoires',
                    data: [stats.sets3.wins, stats.sets4.wins, stats.sets5.wins],
                    backgroundColor: '#4CAF50',
                    borderColor: '#2e7d32',
                    borderWidth: 2
                },
                {
                    label: 'Défaites',
                    data: [stats.sets3.losses, stats.sets4.losses, stats.sets5.losses],
                    backgroundColor: '#f44336',
                    borderColor: '#c62828',
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                x: {
                    stacked: false,
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 5,
                        font: {
                            size: 12
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        padding: 20,
                        font: {
                            size: 14,
                            weight: 'bold'
                        },
                        usePointStyle: true,
                        pointStyle: 'rectRounded'
                    }
                },
                tooltip: {
                    callbacks: {
                        afterLabel: function(context) {
                            const dataIndex = context.dataIndex;
                            let wins, losses, percentage;
                            
                            if (dataIndex === 0) {
                                wins = stats.sets3.wins;
                                losses = stats.sets3.losses;
                            } else if (dataIndex === 1) {
                                wins = stats.sets4.wins;
                                losses = stats.sets4.losses;
                            } else {
                                wins = stats.sets5.wins;
                                losses = stats.sets5.losses;
                            }
                            
                            percentage = calcPercentage(wins, losses);
                            const total = wins + losses;
                            
                            return [
                                `Total: ${total} matchs`,
                                `Taux de victoire: ${percentage}%`
                            ];
                        }
                    }
                }
            }
        }
    });
}

function updateTableRows(joueursArray) {
    const tbody = document.getElementById('stats-table-body');
    if (!tbody) return;
    
    let html = '';
    joueursArray.forEach((joueur, index) => {
        const winRate = joueur.matches.taux_victoire;
        const totalSets = joueur.sets.gagnes + joueur.sets.perdus;
        const perfScore = joueur.performance_classement?.score || 0;
        const perfClass = perfScore > 0 ? 'badge-success' : perfScore < 0 ? 'badge-warning' : 'badge-info';
        const perfSign = perfScore > 0 ? '+' : '';
        
        html += `
            <tr>
                <td class="rank">${index + 1}</td>
                <td class="player-name-cell">${joueur.nom}</td>
                <td><span class="stats-badge badge-info">${joueur.points_officiels} pts</span></td>
                <td>${joueur.matches.total}</td>
                <td><span class="stats-badge badge-success">${joueur.matches.victoires}</span></td>
                <td><span class="stats-badge badge-warning">${joueur.matches.defaites}</span></td>
                <td>
                    <div class="win-rate-bar">
                        <div class="win-rate-fill" style="width: ${winRate}%"></div>
                        <div class="win-rate-text">${winRate}%</div>
                    </div>
                </td>
                <td>${joueur.sets.gagnes} - ${joueur.sets.perdus}</td>
                <td>${(joueur.sets.ratio * 100).toFixed(0)}%</td>
                <td><span class="stats-badge ${perfClass}">${perfSign}${perfScore}</span></td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

function displayMatches(journeeId) {
    const matches = allData[journeeId];
    if (!matches) {
        console.error('Pas de données pour', journeeId);
        return;
    }
    
    const journeePrefix = journeeId.split('_')[0].toLowerCase();
    const matchesContainer = document.getElementById(`matches-${journeePrefix}`);
    
    if (!matchesContainer) {
        console.error('Container non trouvé:', `matches-${journeePrefix}`);
        return;
    }
    
    console.log(`Affichage de ${matches.length} matchs pour ${journeeId}`);
    matchesContainer.innerHTML = ''; // Clear existing content
    
    // Trier par numéro d'équipe TTSH
    const sortedMatches = matches.slice().sort((a, b) => {
        const numA = parseInt((a.equipe_ttsh || '').replace('TTSH', '')) || 999;
        const numB = parseInt((b.equipe_ttsh || '').replace('TTSH', '')) || 999;
        return numA - numB;
    });
    
    // Calculate stats
    let victoires = 0, defaites = 0, nuls = 0;
    
    sortedMatches.forEach((match, index) => {
        const equipeA = match.equipes.equipe_a;
        const equipeX = match.equipes.equipe_x;
        const scoreA = match.resultat_global.equipe_a;
        const scoreX = match.resultat_global.equipe_x;
        
        // Determine if ST HERBLAIN won
        const isHerblainA = equipeA.nom && equipeA.nom.includes('HERBLAIN');
        const isHerblainX = equipeX.nom && equipeX.nom.includes('HERBLAIN');
        
        if (isHerblainA) {
            if (scoreA > scoreX) victoires++;
            else if (scoreA < scoreX) defaites++;
            else nuls++;
        } else if (isHerblainX) {
            if (scoreX > scoreA) victoires++;
            else if (scoreX < scoreA) defaites++;
            else nuls++;
        }
        
        const card = document.createElement('div');
        card.className = 'match-card';
        card.onclick = () => showMatchDetail(journeeId, matches.indexOf(match));
        
        const teamA = equipeA.nom || 'Équipe A';
        const teamX = equipeX.nom || 'Équipe X';
        const nbRencontres = match.rencontres.length;
        const expectedMatches = match.expected_matches || 20;
        const equipeTTSH = match.equipe_ttsh || '';
        
        // Calculer le nombre total de sets remportés par chaque équipe
        let totalSetsA = 0;
        let totalSetsX = 0;
        match.rencontres.forEach(r => {
            if (r.sets && Array.isArray(r.sets)) {
                r.sets.forEach(s => {
                    const setScoreA = s.equipe_a || s.score_a || 0;
                    const setScoreX = s.equipe_x || s.score_x || 0;
                    if (setScoreA > setScoreX) totalSetsA++;
                    else if (setScoreX > setScoreA) totalSetsX++;
                });
            }
        });
        
        card.innerHTML = `
            <div class="match-header">
                <div style="display: flex; align-items: center; flex: 1;">
                    ${equipeTTSH ? `<span class="match-equipe">${equipeTTSH}</span>` : ''}
                    <div class="match-teams">${teamA} vs ${teamX}</div>
                </div>
                <div class="match-score">${scoreA} - ${scoreX}</div>
            </div>
            <div class="match-info">
                <div>
                    <span class="icon">👥</span>
                    ${equipeA.joueurs.length} vs ${equipeX.joueurs.length} joueurs
                </div>
                <div>
                    <span class="icon">🎯</span>
                    ${nbRencontres}/${expectedMatches} rencontres
                </div>
                <div>
                    <span class="icon">🏓</span>
                    ${totalSetsA} - ${totalSetsX} sets
                </div>
            </div>
        `;
        
        matchesContainer.appendChild(card);
    });
    
    // Update stats
    document.getElementById(`stats-${journeePrefix}-matches`).textContent = sortedMatches.length;
    document.getElementById(`stats-${journeePrefix}-victoires`).textContent = victoires;
    document.getElementById(`stats-${journeePrefix}-nuls`).textContent = nuls;
    document.getElementById(`stats-${journeePrefix}-defaites`).textContent = defaites;
    
    // Create pie chart for this journee
    createSetDistributionChart(journeeId, sortedMatches);
}

function createSetDistributionChart(journeeId, matches) {
    const journeePrefix = journeeId.split('_')[0].toLowerCase();
    const canvasId = `chart-${journeePrefix}`;
    
    // Compter les victoires et défaites par nombre de sets joués
    const stats = {
        sets3: { wins: 0, losses: 0 },  // Matchs en 3 sets (3-0 ou 0-3)
        sets4: { wins: 0, losses: 0 },  // Matchs en 4 sets (3-1 ou 1-3)
        sets5: { wins: 0, losses: 0 }   // Matchs en 5 sets (3-2 ou 2-3)
    };
    
    matches.forEach(match => {
        const equipeA = match.equipes.equipe_a;
        const equipeX = match.equipes.equipe_x;
        const isHerblainA = equipeA.nom && equipeA.nom.includes('HERBLAIN');
        const isHerblainX = equipeX.nom && equipeX.nom.includes('HERBLAIN');
        
        match.rencontres.forEach(r => {
            // Compter les sets gagnés
            let setsWonA = 0;
            let setsWonX = 0;
            if (r.sets && Array.isArray(r.sets)) {
                r.sets.forEach(s => {
                    const scoreA = s.equipe_a || s.score_a || 0;
                    const scoreX = s.equipe_x || s.score_x || 0;
                    if (scoreA > scoreX) setsWonA++;
                    else if (scoreX > scoreA) setsWonX++;
                });
            }
            
            const totalSets = setsWonA + setsWonX;
            let herblainWon = false;
            
            // Déterminer si ST HERBLAIN a gagné
            if (isHerblainA) {
                herblainWon = setsWonA > setsWonX;
            } else if (isHerblainX) {
                herblainWon = setsWonX > setsWonA;
            } else {
                return; // Ignorer si ST HERBLAIN ne joue pas
            }
            
            // Classifier par nombre de sets
            if (totalSets === 3) {
                if (herblainWon) stats.sets3.wins++;
                else stats.sets3.losses++;
            } else if (totalSets === 4) {
                if (herblainWon) stats.sets4.wins++;
                else stats.sets4.losses++;
            } else if (totalSets === 5) {
                if (herblainWon) stats.sets5.wins++;
                else stats.sets5.losses++;
            }
        });
    });
    
    // Calculer les pourcentages
    const calcPercentage = (wins, losses) => {
        const total = wins + losses;
        return total > 0 ? ((wins / total) * 100).toFixed(1) : 0;
    };
    
    // Mettre à jour le ratio global
    const totalWins = stats.sets3.wins + stats.sets4.wins + stats.sets5.wins;
    const totalLosses = stats.sets3.losses + stats.sets4.losses + stats.sets5.losses;
    const totalMatches = totalWins + totalLosses;
    const winPercentage = totalMatches > 0 ? ((totalWins / totalMatches) * 100).toFixed(0) : 0;
    
    document.getElementById(`wins-${journeePrefix}`).textContent = totalWins;
    document.getElementById(`losses-${journeePrefix}`).textContent = totalLosses;
    document.getElementById(`ratio-${journeePrefix}`).querySelector('.ratio-value').textContent = `${winPercentage}%`;
    
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    // Détruire l'ancien graphique s'il existe
    if (window[`chart_${journeePrefix}`]) {
        window[`chart_${journeePrefix}`].destroy();
    }
    
    // Créer le nouveau graphique
    window[`chart_${journeePrefix}`] = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: ['3 sets', '4 sets', '5 sets'],
            datasets: [
                {
                    label: 'Victoires',
                    data: [stats.sets3.wins, stats.sets4.wins, stats.sets5.wins],
                    backgroundColor: '#4CAF50',
                    borderColor: '#2e7d32',
                    borderWidth: 2
                },
                {
                    label: 'Défaites',
                    data: [stats.sets3.losses, stats.sets4.losses, stats.sets5.losses],
                    backgroundColor: '#f44336',
                    borderColor: '#c62828',
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                x: {
                    stacked: false,
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        font: {
                            size: 12
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        padding: 20,
                        font: {
                            size: 14,
                            weight: 'bold'
                        },
                        usePointStyle: true,
                        pointStyle: 'rectRounded'
                    }
                },
                tooltip: {
                    callbacks: {
                        afterLabel: function(context) {
                            const dataIndex = context.dataIndex;
                            let wins, losses, percentage;
                            
                            if (dataIndex === 0) {
                                wins = stats.sets3.wins;
                                losses = stats.sets3.losses;
                            } else if (dataIndex === 1) {
                                wins = stats.sets4.wins;
                                losses = stats.sets4.losses;
                            } else {
                                wins = stats.sets5.wins;
                                losses = stats.sets5.losses;
                            }
                            
                            percentage = calcPercentage(wins, losses);
                            const total = wins + losses;
                            
                            return [
                                `Total: ${total} matchs`,
                                `Taux de victoire: ${percentage}%`
                            ];
                        }
                    }
                }
            }
        }
    });
}

function showMatchDetail(journeeId, matchIndex) {
    const match = allData[journeeId][matchIndex];
    const modal = document.getElementById('matchModal');
    const modalBody = document.getElementById('modal-body');
    
    const equipeA = match.equipes.equipe_a;
    const equipeX = match.equipes.equipe_x;
    const scoreA = match.resultat_global.equipe_a;
    const scoreX = match.resultat_global.equipe_x;
    const equipeTTSH = match.equipe_ttsh || '';
    
    document.getElementById('modal-title').innerHTML = 
        `${equipeTTSH ? `<span style="background: #667eea; color: white; padding: 5px 12px; border-radius: 5px; margin-right: 15px;">${equipeTTSH}</span>` : ''}${equipeA.nom || 'Équipe A'} ${scoreA} - ${scoreX} ${equipeX.nom || 'Équipe X'}`;
    
    // Build players lists
    const playersA = equipeA.joueurs.map(j => `
        <li class="player-item">
            <div>
                <span class="player-name">${j.nom} ${j.prenom}</span>
                <span class="player-license">${j.licence}</span>
            </div>
            <span class="player-points">${j.points} pts</span>
        </li>
    `).join('');
    
    const playersX = equipeX.joueurs.map(j => `
        <li class="player-item">
            <div>
                <span class="player-name">${j.nom} ${j.prenom}</span>
                <span class="player-license">${j.licence}</span>
            </div>
            <span class="player-points">${j.points} pts</span>
        </li>
    `).join('');
    
    // Build rencontres list
    const isHerblainA = equipeA.nom && equipeA.nom.includes('HERBLAIN');
    const isHerblainX = equipeX.nom && equipeX.nom.includes('HERBLAIN');
    
    const rencontres = match.rencontres.map(r => {
        console.log('Traitement rencontre:', r.numero, 'sets:', r.sets);
        // Handle joueur_a and joueur_x which can be objects or strings
        // For doubles, concatenate both players (only names for doubles)
        let joueurAName = '';
        if (typeof r.joueur_a === 'object' && r.joueur_a) {
            if (r.joueur_a.joueur2) {
                // Double: only last names
                joueurAName = `${r.joueur_a.nom} / ${r.joueur_a.joueur2.nom}`;
            } else {
                // Simple: full name
                joueurAName = `${r.joueur_a.nom} ${r.joueur_a.prenom}`;
            }
        } else {
            joueurAName = r.joueur_a || 'Joueur A';
        }
        
        let joueurXName = '';
        if (typeof r.joueur_x === 'object' && r.joueur_x) {
            if (r.joueur_x.joueur2) {
                // Double: only last names
                joueurXName = `${r.joueur_x.nom} / ${r.joueur_x.joueur2.nom}`;
            } else {
                // Simple: full name
                joueurXName = `${r.joueur_x.nom} ${r.joueur_x.prenom}`;
            }
        } else {
            joueurXName = r.joueur_x || 'Joueur X';
        }
        
        const isAbandon = (joueurAName && joueurAName.includes('(A)')) || (joueurXName && joueurXName.includes('(A)'));
        
        // Calculer le score en sets (nombre de sets gagnés par chaque joueur)
        let setsWonA = 0;
        let setsWonX = 0;
        r.sets.forEach(s => {
            const scoreA = s.equipe_a || s.score_a || 0;
            const scoreX = s.equipe_x || s.score_x || 0;
            if (scoreA > scoreX) setsWonA++;
            else if (scoreX > scoreA) setsWonX++;
        });
        
        const result = isAbandon ? '(A)' : `${setsWonA}-${setsWonX}`;
        
        // Score pour déterminer la victoire (1-0 ou 0-1)
        const matchScoreA = r.score_a !== undefined ? r.score_a : (r.score_match ? parseInt(r.score_match.split('-')[0]) : 0);
        const matchScoreX = r.score_x !== undefined ? r.score_x : (r.score_match ? parseInt(r.score_match.split('-')[1]) : 0);
        
        // Determine which player is from ST HERBLAIN
        const isJoueurAHerblain = isHerblainA;
        const isJoueurXHerblain = isHerblainX;
        
        // Generate sets with color coding based on ST HERBLAIN wins
        const sets = r.sets.map(s => {
            const scoreA = s.equipe_a || s.score_a || 0;
            const scoreX = s.equipe_x || s.score_x || 0;
            
            let setClass = 'set-score';
            if (isJoueurAHerblain && scoreA > scoreX) {
                setClass = 'set-score herblain-win';
            } else if (isJoueurXHerblain && scoreX > scoreA) {
                setClass = 'set-score herblain-win';
            } else if ((isJoueurAHerblain && scoreA < scoreX) || (isJoueurXHerblain && scoreX < scoreA)) {
                setClass = 'set-score herblain-lose';
            }
            
            return `<span class="${setClass}">${scoreA}-${scoreX}</span>`;
        }).join('');
        
        // Determine if Herblain won this match
        let victoryClass = '';
        if (isHerblainA && matchScoreA > matchScoreX) {
            victoryClass = 'victoire';
        } else if (isHerblainX && matchScoreX > matchScoreA) {
            victoryClass = 'victoire';
        } else if ((isHerblainA && matchScoreA < matchScoreX) || (isHerblainX && matchScoreX < matchScoreA)) {
            victoryClass = 'defaite';
        }
        
        return `
            <div class="rencontre-item ${victoryClass}">
                <div class="rencontre-num">${r.numero}</div>
                <div class="rencontre-players">
                    ${joueurAName} <span class="vs">vs</span> ${joueurXName}
                </div>
                <div class="rencontre-sets">
                    ${sets}
                    <span class="rencontre-result">${result}</span>
                </div>
            </div>
        `;
    }).join('');
    
    modalBody.innerHTML = `
        <div class="teams-section">
            <div class="team-panel">
                <h3>${equipeA.nom || 'Équipe A'}</h3>
                <ul class="player-list">${playersA}</ul>
            </div>
            <div class="team-panel">
                <h3>${equipeX.nom || 'Équipe X'}</h3>
                <ul class="player-list">${playersX}</ul>
            </div>
        </div>
        <div class="chart-container">
            <h3>📊 Répartition des rencontres individuelles</h3>
            <div class="modal-chart-wrapper">
                <canvas id="modal-chart"></canvas>
            </div>
        </div>
        <div class="rencontres-section">
            <h3>Rencontres individuelles (${match.rencontres.length})</h3>
            <div class="rencontre-grid">${rencontres}</div>
        </div>
    `;
    
    // Créer le graphique pour cette rencontre
    createMatchChart(match, isHerblainA, isHerblainX);
    
    modal.classList.add('active');
}

function createMatchChart(match, isHerblainA, isHerblainX) {
    const canvas = document.getElementById('modal-chart');
    if (!canvas) return;
    
    // Détruire l'ancien graphique s'il existe
    if (window.matchChart) {
        window.matchChart.destroy();
    }
    
    // Compter les victoires et défaites par nombre de sets joués
    const stats = {
        sets3: { wins: 0, losses: 0 },
        sets4: { wins: 0, losses: 0 },
        sets5: { wins: 0, losses: 0 }
    };
    
    match.rencontres.forEach(r => {
        let setsWonA = 0, setsWonX = 0;
        if (r.sets && Array.isArray(r.sets)) {
            r.sets.forEach(s => {
                const scoreA = s.equipe_a || s.score_a || 0;
                const scoreX = s.equipe_x || s.score_x || 0;
                if (scoreA > scoreX) setsWonA++;
                else if (scoreX > scoreA) setsWonX++;
            });
        }
        
        const totalSets = setsWonA + setsWonX;
        let herblainWon = false;
        
        if (isHerblainA) {
            herblainWon = setsWonA > setsWonX;
        } else if (isHerblainX) {
            herblainWon = setsWonX > setsWonA;
        } else {
            return;
        }
        
        if (totalSets === 3) {
            if (herblainWon) stats.sets3.wins++;
            else stats.sets3.losses++;
        } else if (totalSets === 4) {
            if (herblainWon) stats.sets4.wins++;
            else stats.sets4.losses++;
        } else if (totalSets === 5) {
            if (herblainWon) stats.sets5.wins++;
            else stats.sets5.losses++;
        }
    });
    
    const calcPercentage = (wins, losses) => {
        const total = wins + losses;
        return total > 0 ? ((wins / total) * 100).toFixed(1) : 0;
    };
    
    window.matchChart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: ['3 sets', '4 sets', '5 sets'],
            datasets: [
                {
                    label: 'Victoires',
                    data: [stats.sets3.wins, stats.sets4.wins, stats.sets5.wins],
                    backgroundColor: '#4CAF50',
                    borderColor: '#2e7d32',
                    borderWidth: 2
                },
                {
                    label: 'Défaites',
                    data: [stats.sets3.losses, stats.sets4.losses, stats.sets5.losses],
                    backgroundColor: '#f44336',
                    borderColor: '#c62828',
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                x: {
                    stacked: false,
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        font: {
                            size: 11
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        padding: 15,
                        font: {
                            size: 12,
                            weight: 'bold'
                        },
                        usePointStyle: true,
                        pointStyle: 'rectRounded'
                    }
                },
                tooltip: {
                    callbacks: {
                        afterLabel: function(context) {
                            const dataIndex = context.dataIndex;
                            let wins, losses, percentage;
                            
                            if (dataIndex === 0) {
                                wins = stats.sets3.wins;
                                losses = stats.sets3.losses;
                            } else if (dataIndex === 1) {
                                wins = stats.sets4.wins;
                                losses = stats.sets4.losses;
                            } else {
                                wins = stats.sets5.wins;
                                losses = stats.sets5.losses;
                            }
                            
                            percentage = calcPercentage(wins, losses);
                            const total = wins + losses;
                            
                            return [
                                `Total: ${total} rencontres`,
                                `Taux de victoire: ${percentage}%`
                            ];
                        }
                    }
                }
            }
        }
    });
}

function closeModal() {
    document.getElementById('matchModal').classList.remove('active');
}

// Close modal on outside click
window.onclick = function(event) {
    const modal = document.getElementById('matchModal');
    if (event.target === modal) {
        closeModal();
    }
}

// Load data on page load
loadData();
