let allData = {};
let currentStatsJournee = 'all';
let currentDisplayMode = 'phase2';  // 'phase1' ou 'phase2' (combined désactivé)
let teamDataPhase1 = null;  // Cache pour données équipes P1
let teamDataPhase2 = null;  // Cache pour données équipes P2

// Map des fichiers de statistiques selon le mode
const statsFilesByMode = {
    'phase1': 'statistiques_p1_seule.json',
    'phase2': 'statistiques_p2_seule.json'
};

const modeDescriptions = {
    // 'phase1': '🔒 Affichage de la Phase 1 seule (données bloquées)',
    // 'phase2': '📈 Affichage de la Phase 2 seule (données en cours de calcul)'
};

// Fonction de validation des données
function validateMatchData(data) {
    if (!Array.isArray(data)) return false;
    return data.every(match => 
        match && 
        match.equipes && 
        match.equipes.equipe_a && 
        match.equipes.equipe_x &&
        match.resultat_global
    );
}

function validateStatsData(data) {
    return data && data.joueurs && typeof data.joueurs === 'object';
}

// Fonction de sanitization pour innerHTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Fonction de normalisation des noms de joueurs
function normalizePlayerNameString(prenom, nom) {
    const nomUpper = nom.toUpperCase();
    // Gérer les prénoms composés avec tirets
    const prenomParts = prenom.split('-');
    const prenomNormalized = prenomParts.map(part => 
        part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
    ).join('-');
    return `${prenomNormalized} ${nomUpper}`;
}

// Récupère le ratio de sets utilisé en départage de tri.
// Compatibilité: accepte `ratio_set` ou `sets.ratio`.
function getPlayerSetRatio(player) {
    if (typeof player?.ratio_set === 'number') {
        return player.ratio_set;
    }
    return player?.sets?.ratio || 0;
}

// Tri de référence (MVP / classements):
// 1) victoires desc, 2) perf classement desc, 3) ratio sets desc
function comparePlayersForRanking(a, b) {
    if (b.matches.victoires !== a.matches.victoires) {
        return b.matches.victoires - a.matches.victoires;
    }

    const perfDiff = (b.performance_classement?.score || 0) - (a.performance_classement?.score || 0);
    if (perfDiff !== 0) {
        return perfDiff;
    }

    return getPlayerSetRatio(b) - getPlayerSetRatio(a);
}

async function loadVersionInfo() {
    try {
        const response = await fetch('version.json');
        if (response.ok) {
            const versionData = await response.json();
            const versionDiv = document.getElementById('version-info');
            if (versionDiv) {
                const buildDate = new Date(versionData.timestamp).toLocaleString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                versionDiv.innerHTML = `
                    ST HERBLAIN T.T - ${versionData.version} 
                    <span style="color: #ccc; margin: 0 5px;">|</span>
                    Build #${versionData.build} 
                    <span style="color: #ccc; margin: 0 5px;">|</span>
                    ${buildDate}
                `;
            }
        }
    } catch (e) {
        console.log('Version info not available');
    }
}

async function loadData() {
    try {
        // Charger d'abord les statistiques pour connaître les journées disponibles
        const statsFile = statsFilesByMode[currentDisplayMode] || 'statistiques.json';
        const statsResponse = await fetch(statsFile);
        if (!statsResponse.ok) {
            throw new Error(`Erreur lors du chargement des statistiques (${statsFile})`);
        }
        
        const statsData = await statsResponse.json();
        
        // Validation des données
        if (!validateStatsData(statsData)) {
            throw new Error('Données de statistiques invalides');
        }
        
        allData['statistiques'] = statsData;
        
        // En parallèle, charger les données P1 et P2 séparement pour les équipes
        loadTeamDataByPhase();
        
        // Extraire les journées uniques des données de joueurs
        const journees = new Set();
        Object.values(statsData.joueurs).forEach(joueur => {
            if (joueur.journees && Array.isArray(joueur.journees)) {
                joueur.journees.forEach(j => journees.add(j.journee));
            }
        });
        
        // Trier les journées par ordre chronologique
        const journeesArray = Array.from(journees).sort();
        
        // Déterminer le préfixe de chemin selon la phase
        const journeePathPrefix = currentDisplayMode === 'phase1' ? 'phase1/' : 'phase2/';
        
        // Charger les données de chaque journée
        for (const journee of journeesArray) {
            try {
                const journeePath = `${journeePathPrefix}${journee}/tous_les_matchs.json`;
                const response = await fetch(journeePath);
                if (response.ok) {
                    const data = await response.json();
                    if (validateMatchData(data)) {
                        allData[journee] = data;
                    }
                }
            } catch (e) {
                // Ignorer les journées non disponibles
            }
        }
        
        // Créer dynamiquement les onglets de journées
        createJourneesTabs(journeesArray);
        
        // Créer dynamiquement les onglets de filtrage de journées pour les stats
        createStatsJourneeTabs(journeesArray);
        
        // Afficher la première journée
        if (journeesArray.length > 0) {
            displayMatches(journeesArray[0]);
        }
        displayStatistics('all');
        displayClubStatistics();
        createGlobalSetDistributionChart();
        
        // Charger les informations de version
        loadVersionInfo();
    } catch (error) {
        console.error('Erreur de chargement:', error);
        alert('Erreur de chargement des données: ' + error.message);
    }
}

async function loadTeamDataByPhase() {
    // Charger les données P1 pour les équipes
    try {
        const response1 = await fetch('statistiques_p1_seule.json');
        if (response1.ok) {
            teamDataPhase1 = await response1.json();
            // Charger aussi les journées de Phase 1
            await loadJourneesForPhase(teamDataPhase1, 'phase1');
        }
    } catch (e) {
        console.log('Phase 1 data not available for teams');
    }
    
    // Charger les données P2 pour les équipes
    try {
        const response2 = await fetch('statistiques_p2_seule.json');
        if (response2.ok) {
            teamDataPhase2 = await response2.json();
            // Charger aussi les journées de Phase 2
            await loadJourneesForPhase(teamDataPhase2, 'phase2');
        }
    } catch (e) {
        console.log('Phase 2 data not available for teams');
    }
}

async function loadJourneesForPhase(statsData, phase) {
    // Charger les données détaillées des journées pour une phase
    if (!statsData || !statsData.journees) return;
    
    if (!statsData._journeeData) {
        statsData._journeeData = {};
    }
    
    // Déterminer le préfixe de chemin selon la phase
    const pathPrefix = phase === 'phase1' ? 'phase1/' : 'phase2/';
    
    for (const journeeId of Object.keys(statsData.journees)) {
        try {
            const journeePath = `${pathPrefix}${journeeId}/tous_les_matchs.json`;
            const response = await fetch(journeePath);
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data)) {
                    statsData._journeeData[journeeId] = data;
                }
            }
        } catch (e) {
            // Ignorer les journées non disponibles
        }
    }
}

async function changeDisplayMode(mode) {
    currentDisplayMode = mode;
    
    // Mettre à jour la description
    const description = document.getElementById('phase-description');
    if (description) {
        description.textContent = modeDescriptions[mode] || '';
    }
    
    // Vider les données actuelles
    allData = {};
    
    // Recharger les données
    await loadData();
    
    // Vérifier quelle section est actuellement active et la rafraîchir
    const activeSection = document.querySelector('.main-section.active');
    if (activeSection) {
        const sectionId = activeSection.id;
        if (sectionId === 'stats-joueurs') {
            displayStatistics('all');
        } else if (sectionId === 'stats-equipes') {
            displayTeamStatistics();
        } else if (sectionId === 'stats-club') {
            displayClubStatistics();
            createGlobalSetDistributionChart();
        }
    }
}

function collectTeamStatisticsForPhase(statsData) {
    // Collecte les stats d'équipe depuis les données de phase avec les journées détaillées
    const teamStats = {};
    
    if (!statsData || !statsData._journeeData) {
        return teamStats;
    }
    
    // Parcourir toutes les journées
    Object.entries(statsData._journeeData).forEach(([journeeId, matches]) => {
        if (!Array.isArray(matches)) return;
        
        matches.forEach(match => {
            // Utiliser directement le champ equipe_ttsh
            if (!match.equipe_ttsh) return;
            
            const teamKey = match.equipe_ttsh;
            const equipeA = match.equipes.equipe_a;
            const equipeX = match.equipes.equipe_x;
            
            if (!equipeA.nom || !equipeX.nom) return;
            
            // Déterminer si ST HERBLAIN est équipe A ou X
            const isSTH_A = equipeA.nom.includes('ST HERBLAIN') || equipeA.nom.includes('TTSH');
            const isSTH_X = equipeX.nom.includes('ST HERBLAIN') || equipeX.nom.includes('TTSH');
            
            if (!isSTH_A && !isSTH_X) return;
            
            const equipeSTH = isSTH_A ? equipeA.nom : equipeX.nom;
            const equipeAdv = isSTH_A ? equipeX.nom : equipeA.nom;
            const scoreSTH = isSTH_A ? match.resultat_global.equipe_a : match.resultat_global.equipe_x;
            const scoreAdv = isSTH_A ? match.resultat_global.equipe_x : match.resultat_global.equipe_a;
            
            // Initialiser les stats pour cette équipe si nécessaire
            if (!teamStats[teamKey]) {
                // Simplifier la poule pour n'afficher que "Poule X"
                let pouleSimple = match.poule || 'N/A';
                if (pouleSimple !== 'N/A') {
                    const pouleMatch = pouleSimple.match(/Poule\s+(\d+)/);
                    if (pouleMatch) {
                        pouleSimple = `Poule ${pouleMatch[1]}`;
                    }
                }
                
                teamStats[teamKey] = {
                    name: teamKey,
                    fullName: equipeSTH,
                    division: match.division || 'N/A',
                    poule: pouleSimple,
                    matches: { total: 0, victoires: 0, nuls: 0, defaites: 0 },
                    rencontres: { victoires: 0, defaites: 0, total: 0 },
                    sets: { gagnes: 0, perdus: 0 },
                    opponents: [],
                    matchDetails: []
                };
            }
            
            // Compter le match
            teamStats[teamKey].matches.total++;
            if (scoreSTH > scoreAdv) {
                teamStats[teamKey].matches.victoires++;
            } else if (scoreSTH < scoreAdv) {
                teamStats[teamKey].matches.defaites++;
            } else {
                teamStats[teamKey].matches.nuls++;
            }
            
            // Compter les rencontres individuelles
            if (match.rencontres) {
                match.rencontres.forEach(rencontre => {
                    if (rencontre.vainqueur) {
                        teamStats[teamKey].rencontres.total++;
                        const sthWins = (isSTH_A && rencontre.vainqueur === 'A') || 
                                       (isSTH_X && rencontre.vainqueur === 'X');
                        if (sthWins) {
                            teamStats[teamKey].rencontres.victoires++;
                        } else {
                            teamStats[teamKey].rencontres.defaites++;
                        }
                        
                        // Compter les sets
                        if (rencontre.sets && Array.isArray(rencontre.sets)) {
                            rencontre.sets.forEach(set => {
                                const setWinnerSTH = (isSTH_A && set.gagnant === 'A') || 
                                                   (isSTH_X && set.gagnant === 'X');
                                if (setWinnerSTH) {
                                    teamStats[teamKey].sets.gagnes++;
                                } else {
                                    teamStats[teamKey].sets.perdus++;
                                }
                            });
                        }
                    }
                });
            }
            
            // Ajouter l'adversaire
            teamStats[teamKey].opponents.push({
                opponent: equipeAdv,
                score: `${scoreSTH}-${scoreAdv}`,
                result: scoreSTH > scoreAdv ? 'V' : (scoreSTH < scoreAdv ? 'D' : 'N'),
                journee: journeeId
            });
            
            // Stocker les détails complets du match
            teamStats[teamKey].matchDetails.push({
                journee: journeeId,
                opponent: equipeAdv,
                equipeA_nom: equipeA.nom,
                equipeX_nom: equipeX.nom,
                scoreA: match.resultat_global.equipe_a,
                scoreX: match.resultat_global.equipe_x,
                score: `${scoreSTH}-${scoreAdv}`,
                result: scoreSTH > scoreAdv ? 'V' : (scoreSTH < scoreAdv ? 'D' : 'N'),
                rencontres: match.rencontres,
                isSTH_A: isSTH_A
            });
        });
    });
    
    return teamStats;
}

function createJourneesTabs(journees) {
    const sidebarTabs = document.querySelector('.sidebar-tabs');
    const subContent = document.querySelector('.sub-content');
    
    if (!sidebarTabs || !subContent) return;
    
    // Vider le contenu existant
    sidebarTabs.innerHTML = '';
    subContent.innerHTML = '';
    
    // Créer un onglet et une section pour chaque journée
    journees.forEach((journee, index) => {
        // Formater la date (ex: J1_20250921 -> J1 - 21/09/2025)
        const match = journee.match(/J(\d+)_(\d{4})(\d{2})(\d{2})/);
        const label = match ? 
            `J${match[1]} - ${match[4]}/${match[3]}/${match[2]}` : 
            journee;
        
        // Créer l'onglet
        const tab = document.createElement('button');
        tab.className = 'sidebar-tab' + (index === 0 ? ' active' : '');
        tab.textContent = label;
        tab.onclick = function() { showJournee(journee, this); };
        sidebarTabs.appendChild(tab);
        
        // Créer la section de contenu
        const section = document.createElement('div');
        section.id = journee;
        section.className = 'journee-section' + (index === 0 ? ' active' : '');
        
        const journeeKey = journee.toLowerCase().replace('_', '-');
        
        section.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="number" id="stats-${journeeKey}-matches">-</div>
                    <div class="label">Matchs</div>
                </div>
                <div class="stat-card">
                    <div class="number" id="stats-${journeeKey}-victoires">-</div>
                    <div class="label">Victoires</div>
                </div>
                <div class="stat-card">
                    <div class="number" id="stats-${journeeKey}-nuls">-</div>
                    <div class="label">Nuls</div>
                </div>
                <div class="stat-card">
                    <div class="number" id="stats-${journeeKey}-defaites">-</div>
                    <div class="label">Défaites</div>
                </div>
            </div>
            <div id="mvp-${journeeKey}" style="margin: 20px 0;"></div>
            <div id="top3-${journeeKey}" style="margin: 20px 0;"></div>
            <div id="matches-${journeeKey}" class="matches-grid"></div>
            <div class="chart-container">
                <h3>📊 Taux de réussite par nombre de sets joués</h3>
                <div class="chart-layout">
                    <div class="chart-ratio" id="ratio-${journeeKey}">
                        <div class="ratio-label">Ratio global</div>
                        <div class="ratio-value">-</div>
                        <div class="ratio-details">
                            <div class="ratio-item">
                                <div class="ratio-item-value" id="wins-${journeeKey}">-</div>
                                <div class="ratio-item-label">Victoires</div>
                            </div>
                            <div class="ratio-item">
                                <div class="ratio-item-value" id="losses-${journeeKey}">-</div>
                                <div class="ratio-item-label">Défaites</div>
                            </div>
                        </div>
                    </div>
                    <div class="chart-wrapper" style="flex: 1;">
                        <canvas id="chart-${journeeKey}"></canvas>
                    </div>
                </div>
            </div>
        `;
        
        subContent.appendChild(section);
    });
}

function createStatsJourneeTabs(journees) {
    const container = document.getElementById('stats-journee-tabs');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Bouton "Toutes journées"
    const allBtn = document.createElement('button');
    allBtn.className = 'nav-tab active';
    allBtn.textContent = '🌐 Toutes journées';
    allBtn.onclick = function() { showStatsJournee('all', this); };
    container.appendChild(allBtn);
    
    // Boutons pour chaque journée
    journees.forEach(journee => {
        const match = journee.match(/J(\d+)_(\d{4})(\d{2})(\d{2})/);
        const label = match ? 
            `J${match[1]} - ${match[4]}/${match[3]}/${match[2]}` : 
            journee;
        
        const btn = document.createElement('button');
        btn.className = 'nav-tab';
        btn.textContent = label;
        btn.onclick = function() { showStatsJournee(journee, this); };
        container.appendChild(btn);
    });
}

function showStatsJournee(journeeId, element) {
    // Update tabs
    const parent = element.parentElement;
    parent.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    element.classList.add('active');
    
    currentStatsJournee = journeeId;
    displayStatistics(journeeId);
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
    
    // Charger les données spécifiques à chaque section
    if (sectionId === 'stats-joueurs') {
        displayStatistics('all');
    } else if (sectionId === 'stats-equipes') {
        displayTeamStatistics();
    } else if (sectionId === 'stats-club') {
        displayClubStatistics();
        createGlobalSetDistributionChart();
    }
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
    
    // Charger et afficher les données de la journée
    displayMatches(journeeId);
}

function calculateJourneeStats(journeeId, countDoublesAsOne = true) {
    const matches = allData[journeeId];
    if (!matches) return {};
    
    const joueurs = {};
    
    matches.forEach(match => {
        const equipeA = match.equipes.equipe_a;
        const equipeX = match.equipes.equipe_x;
        
        // Vérifier que les noms d'équipes ne sont pas null
        if (!equipeA.nom || !equipeX.nom) return;
        
        const isSTH_A = equipeA.nom.includes('ST HERBLAIN') || equipeA.nom.includes('TTSH');
        const isSTH_X = equipeX.nom.includes('ST HERBLAIN') || equipeX.nom.includes('TTSH');
        
        if (!isSTH_A && !isSTH_X) return;
        
        const equipeSTH = isSTH_A ? equipeA : equipeX;
        const scoreSTH = isSTH_A ? match.resultat_global.equipe_a : match.resultat_global.equipe_x;
        const scoreAdv = isSTH_A ? match.resultat_global.equipe_x : match.resultat_global.equipe_a;
        
        // Traiter les rencontres
        if (match.rencontres) {
            match.rencontres.forEach(rencontre => {
                const joueurA = rencontre.joueur_a;
                const joueurX = rencontre.joueur_x;
                
                const processPlayer = (joueur, isTeamA, isFromJoueur2 = false) => {
                    // Pour les doubles, chercher avec la lettre composée (ex: "D/E")
                    let joueurData;
                    if (rencontre.type === 'double') {
                        joueurData = isTeamA ? 
                            equipeA.joueurs.find(j => rencontre.joueur_a.lettre.includes(j.lettre)) :
                            equipeX.joueurs.find(j => rencontre.joueur_x.lettre.includes(j.lettre));
                        // Pour le second joueur du double
                        if (isFromJoueur2) {
                            const lettre2 = isTeamA ? 
                                rencontre.joueur_a.lettre.split('/')[1] :
                                rencontre.joueur_x.lettre.split('/')[1];
                            joueurData = isTeamA ?
                                equipeA.joueurs.find(j => j.lettre === lettre2) :
                                equipeX.joueurs.find(j => j.lettre === lettre2);
                        }
                    } else {
                        joueurData = isTeamA ? 
                            equipeA.joueurs.find(j => j.lettre === joueur.lettre) :
                            equipeX.joueurs.find(j => j.lettre === joueur.lettre);
                    }
                    
                    if (!joueurData) return;
                    
                    const isTTSH = isTeamA ? isSTH_A : isSTH_X;
                    if (!isTTSH) return;
                    
                    const nomComplet = normalizePlayerNameString(joueur.prenom, joueur.nom);
                    
                    if (!joueurs[nomComplet]) {
                        joueurs[nomComplet] = {
                            points_officiels: joueurData.points,
                            matches: { total: 0, victoires: 0, defaites: 0, taux_victoire: 0 },
                            sets: { gagnes: 0, perdus: 0, total: 0, ratio: 0 },
                            performance_classement: { score: 0 }
                        };
                    }
                    
                    const stats = joueurs[nomComplet];
                    // Pour les doubles, compter 0.5 ou 1 selon le paramètre
                    const matchValue = (rencontre.type === 'double' && !countDoublesAsOne) ? 0.5 : 1;
                    stats.matches.total += matchValue;
                    
                    // Calculer le résultat
                    let setsGagnes = 0;
                    let setsPerdus = 0;
                    if (rencontre.sets) {
                        rencontre.sets.forEach(set => {
                            if ((isTeamA && set.gagnant === 'A') || (!isTeamA && set.gagnant === 'X')) {
                                setsGagnes++;
                            } else {
                                setsPerdus++;
                            }
                        });
                    }
                    
                    if (setsGagnes > setsPerdus) {
                        stats.matches.victoires += matchValue;
                    } else {
                        stats.matches.defaites += matchValue;
                    }
                    
                    stats.sets.gagnes += setsGagnes;
                    stats.sets.perdus += setsPerdus;
                    stats.sets.total = stats.sets.gagnes + stats.sets.perdus;
                    stats.sets.ratio = stats.sets.total > 0 ? stats.sets.gagnes / stats.sets.total : 0;
                    stats.matches.taux_victoire = stats.matches.total > 0 ? 
                        Math.round((stats.matches.victoires / stats.matches.total) * 100) : 0;
                    
                    // Calculer la performance de classement
                    const adversaireJoueur = isTeamA ? joueurX : joueurA;
                    let adversaireData;
                    if (rencontre.type === 'double') {
                        adversaireData = isTeamA ? 
                            equipeX.joueurs.find(j => rencontre.joueur_x.lettre.includes(j.lettre)) :
                            equipeA.joueurs.find(j => rencontre.joueur_a.lettre.includes(j.lettre));
                    } else {
                        adversaireData = isTeamA ? 
                            equipeX.joueurs.find(j => j.lettre === adversaireJoueur.lettre) :
                            equipeA.joueurs.find(j => j.lettre === adversaireJoueur.lettre);
                    }
                    
                    if (adversaireData && adversaireData.points) {
                        const pointsJoueur = joueurData.points;
                        const pointsAdversaire = adversaireData.points;
                        
                        // Performance de classement : exclure complètement les doubles
                        if (rencontre.type !== 'double') {
                            if (setsGagnes > setsPerdus) {
                                // Victoire
                                if (pointsAdversaire > pointsJoueur) {
                                    // Victoire contre un mieux classé
                                    stats.performance_classement.score += pointsAdversaire - pointsJoueur;
                                }
                            } else {
                                // Défaite
                                if (pointsAdversaire < pointsJoueur) {
                                    // Défaite contre un moins bien classé
                                    stats.performance_classement.score -= pointsJoueur - pointsAdversaire;
                                }
                            }
                        }
                    }
                };

                
                // Traiter les joueurs simples
                processPlayer(joueurA, true);
                processPlayer(joueurX, false);
                
                // Traiter les joueurs en double si présents
                if (rencontre.type === 'double') {
                    if (rencontre.joueur_a.joueur2) {
                        processPlayer(rencontre.joueur_a.joueur2, true, true);
                    }
                    if (rencontre.joueur_x.joueur2) {
                        processPlayer(rencontre.joueur_x.joueur2, false, true);
                    }
                }
            });
        }
    });
    
    return Object.entries(joueurs).map(([nom, data]) => ({
        nom: nom,
        ...data
    }));
}

function displayStatistics(journeeFilter = 'all') {
    if (!allData['statistiques']) {
        return;
    }
    
    const stats = allData['statistiques'];
    let joueurs = stats.joueurs;
    
    // Si filtre par journée, calculer les stats pour cette journée uniquement
    // IMPORTANT: ici on garde doubles=0.5 pour les tableaux
    if (journeeFilter !== 'all' && allData[journeeFilter]) {
        joueurs = calculateJourneeStats(journeeFilter, false); // false = doubles comptent 0.5
    } else {
        // Pour 'all', convertir l'objet statistiques en tableau avec nom
        joueurs = Object.entries(joueurs).map(([nom, data]) => ({
            nom: nom,
            ...data
        }));
    }
    
    // Filtrer les joueurs avec au moins 3 matches (ou 1 si journée spécifique)
    const minMatches = journeeFilter === 'all' ? 3 : 1;
    const joueursArray = joueurs.filter(j => j.matches.total >= minMatches);
    
    // Trier par victoires, perf classement, puis ratio sets en cas d'égalité
    joueursArray.sort(comparePlayersForRanking);
    
    const container = document.getElementById('stats-content');
    if (!container) {
        return;
    }
    
    let journeeTitle = 'Toutes journées confondues';
    if (journeeFilter !== 'all') {
        const match = journeeFilter.match(/J(\d+)_(\d{4})(\d{2})(\d{2})/);
        journeeTitle = match ? `Journée ${match[1]} - ${match[4]}/${match[3]}/${match[2]}` : journeeFilter;
    }
    const minMatchesText = journeeFilter === 'all' ? '(minimum 3 matches)' : '';
    
    let html = `
        <h3 style="color: #667eea; margin-bottom: 20px;">🏆 Classement des joueurs - ${journeeTitle} ${minMatchesText}</h3>
        <div class="table-responsive">
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
            <tr onclick="showPlayerDetail('${joueur.nom.replace(/'/g, "\\'")}');" style="cursor: pointer;">
                <td class="rank">${index + 1}</td>
                <td class="player-name-cell">${escapeHtml(joueur.nom)}</td>
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
        </div>
    `;
    
    container.innerHTML = html;
    
    // Ajouter les événements de tri
    initSortableTable(joueursArray);
}

// Variable globale pour stocker les stats d'équipes
let cachedTeamStats = null;

function collectTeamStatistics() {
    // Si déjà calculé, retourner le cache
    if (cachedTeamStats) return cachedTeamStats;
    
    const teamStats = {};
    
    // Parcourir toutes les journées
    Object.keys(allData).forEach(journeeId => {
        if (journeeId !== 'statistiques' && allData[journeeId]) {
            allData[journeeId].forEach(match => {
                // Utiliser directement le champ equipe_ttsh
                if (!match.equipe_ttsh) return;
                
                const teamKey = match.equipe_ttsh;
                const equipeA = match.equipes.equipe_a;
                const equipeX = match.equipes.equipe_x;
                
                if (!equipeA.nom || !equipeX.nom) return;
                
                // Déterminer si ST HERBLAIN est équipe A ou X
                const isSTH_A = equipeA.nom.includes('ST HERBLAIN') || equipeA.nom.includes('TTSH');
                const isSTH_X = equipeX.nom.includes('ST HERBLAIN') || equipeX.nom.includes('TTSH');
                
                if (!isSTH_A && !isSTH_X) return;
                
                const equipeSTH = isSTH_A ? equipeA.nom : equipeX.nom;
                const equipeAdv = isSTH_A ? equipeX.nom : equipeA.nom;
                const scoreSTH = isSTH_A ? match.resultat_global.equipe_a : match.resultat_global.equipe_x;
                const scoreAdv = isSTH_A ? match.resultat_global.equipe_x : match.resultat_global.equipe_a;
                
                // Initialiser les stats pour cette équipe si nécessaire
                if (!teamStats[teamKey]) {
                    // Simplifier la poule pour n'afficher que "Poule X"
                    let pouleSimple = match.poule || 'N/A';
                    if (pouleSimple !== 'N/A') {
                        const pouleMatch = pouleSimple.match(/Poule\s+(\d+)/);
                        if (pouleMatch) {
                            pouleSimple = `Poule ${pouleMatch[1]}`;
                        }
                    }
                    
                    teamStats[teamKey] = {
                        name: teamKey,
                        fullName: equipeSTH,
                        division: match.division || 'N/A',
                        poule: pouleSimple,
                        matches: { total: 0, victoires: 0, nuls: 0, defaites: 0 },
                        rencontres: { victoires: 0, defaites: 0, total: 0 },
                        sets: { gagnes: 0, perdus: 0 },
                        opponents: [],
                        matchDetails: []
                    };
                }
                
                // Compter le match
                teamStats[teamKey].matches.total++;
                if (scoreSTH > scoreAdv) {
                    teamStats[teamKey].matches.victoires++;
                } else if (scoreSTH < scoreAdv) {
                    teamStats[teamKey].matches.defaites++;
                } else {
                    teamStats[teamKey].matches.nuls++;
                }
                
                // Compter les rencontres individuelles
                if (match.rencontres) {
                    match.rencontres.forEach(rencontre => {
                        if (rencontre.vainqueur) {
                            teamStats[teamKey].rencontres.total++;
                            const sthWins = (isSTH_A && rencontre.vainqueur === 'A') || 
                                           (isSTH_X && rencontre.vainqueur === 'X');
                            if (sthWins) {
                                teamStats[teamKey].rencontres.victoires++;
                            } else {
                                teamStats[teamKey].rencontres.defaites++;
                            }
                            
                            // Compter les sets
                            if (rencontre.sets && Array.isArray(rencontre.sets)) {
                                rencontre.sets.forEach(set => {
                                    const setWinnerSTH = (isSTH_A && set.gagnant === 'A') || 
                                                       (isSTH_X && set.gagnant === 'X');
                                    if (setWinnerSTH) {
                                        teamStats[teamKey].sets.gagnes++;
                                    } else {
                                        teamStats[teamKey].sets.perdus++;
                                    }
                                });
                            }
                        }
                    });
                }
                
                // Ajouter l'adversaire
                teamStats[teamKey].opponents.push({
                    opponent: equipeAdv,
                    score: `${scoreSTH}-${scoreAdv}`,
                    result: scoreSTH > scoreAdv ? 'V' : (scoreSTH < scoreAdv ? 'D' : 'N'),
                    journee: journeeId
                });
                
                // Stocker les détails complets du match
                teamStats[teamKey].matchDetails.push({
                    journee: journeeId,
                    opponent: equipeAdv,
                    equipeA_nom: equipeA.nom,
                    equipeX_nom: equipeX.nom,
                    scoreA: match.resultat_global.equipe_a,
                    scoreX: match.resultat_global.equipe_x,
                    score: `${scoreSTH}-${scoreAdv}`,
                    result: scoreSTH > scoreAdv ? 'V' : (scoreSTH < scoreAdv ? 'D' : 'N'),
                    rencontres: match.rencontres,
                    isSTH_A: isSTH_A
                });
            });
        }
    });
    
    cachedTeamStats = teamStats;
    return teamStats;
}

function displayTeamStatistics() {
    // Afficher les équipes de la phase actuelle
    const container = document.getElementById('stats-equipes-content');
    
    // Déterminer quelles phases sont disponibles
    const phase1Available = teamDataPhase1 !== null && teamDataPhase1._journeeData;
    const phase2Available = teamDataPhase2 !== null && teamDataPhase2._journeeData;
    
    // Sélectionner la donnée appropriée selon le mode
    let teamData = null;
    
    // En Phase 1
    if (currentDisplayMode === 'phase1' && phase1Available) {
        teamData = teamDataPhase1;
    } 
    // En Phase 2
    else if (currentDisplayMode === 'phase2' && phase2Available) {
        teamData = teamDataPhase2;
    }
    else {
        container.innerHTML = '<p style="text-align: center; padding: 40px; color: #999;">Aucune donnée disponible</p>';
        return;
    }
    
    // Collecter les stats d'équipe depuis les données de phase chargées
    const teamStats = collectTeamStatisticsForPhase(teamData);
    
    if (Object.keys(teamStats).length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 40px;">Aucune donnée disponible</p>';
        return;
    }
    
    // Trier les équipes par numéro
    const sortedTeams = Object.values(teamStats).sort((a, b) => {
        const numA = parseInt(a.name.replace('TTSH', ''));
        const numB = parseInt(b.name.replace('TTSH', ''));
        return numA - numB;
    });
    
    // Afficher la grille de cartes cliquables
    showTeamOverview(sortedTeams);
}

function showTeamOverview(sortedTeams) {
    const container = document.getElementById('stats-equipes-content');
    
    // Fonction pour obtenir le badge et la couleur de la division
    function getDivisionStyle(division) {
        let bgColor, textColor, label;
        
        if (division.includes('REGIO')) {
            bgColor = '#0d0d0e'; // Violet pour régional
            textColor = 'white';
            label = 'RÉGIONAL';
        } else if (division.includes('R3')) {
            bgColor = '#080808'; // Noire le régional
            textColor = 'white';
            label = 'RÉGIONAL';
        } else if (division.includes('PR')) {
            bgColor = '#f59e0b'; // Orange pour pré-régional
            textColor = 'white';
            label = 'PRÉ-RÉGIONAL';
        } else if (division.includes('D1')) {
            bgColor = '#3bc4f6'; // Bleu pour D2
            textColor = 'white';
            label = 'D1';
        } else if (division.includes('D2')) {
            bgColor = '#3b82f6'; // Bleu pour D2
            textColor = 'white';
            label = 'D2';
        } else if (division.includes('D3')) {
            bgColor = '#10b981'; // Vert pour D3
            textColor = 'white';
            label = 'D3';
        } else if (division.includes('D4')) {
            bgColor = '#6b7280'; // Gris pour D4
            textColor = 'white';
            label = 'D4';
        } else {
            bgColor = '#e5e7eb';
            textColor = '#374151';
            label = 'DÉPARTEMENTAL';
        }
        
        return { bgColor, textColor, label };
    }
    
    let html = '<div class="team-overview-grid">';
    
    sortedTeams.forEach(team => {
        // Calculer la couleur de fond en fonction des résultats
        const lastResults = team.opponents.slice(-5);
        const wins = lastResults.filter(m => m.result === 'V').length;
        const losses = lastResults.filter(m => m.result === 'D').length;
        
        let bgGradient = '';
        if (wins > losses) {
            bgGradient = 'linear-gradient(135deg, #d1fae5 0%, #ecfdf5 100%)'; // Vert clair si plus de victoires
        } else if (losses > wins) {
            bgGradient = 'linear-gradient(135deg, #fee2e2 0%, #fef2f2 100%)'; // Rouge clair si plus de défaites
        } else {
            bgGradient = 'linear-gradient(135deg, #fef3c7 0%, #fefce8 100%)'; // Orange clair si égalité
        }
        
        const divStyle = getDivisionStyle(team.division);
        
        html += `
            <div class="stat-card team-card-clickable team-overview-card" onclick="showSingleTeamStats('${team.name.replace(/'/g, "\\'")}');" style="padding: 0; overflow: hidden; background: ${bgGradient};">
                <div class="team-overview-head" style="padding: 20px 20px 15px 20px; text-align: center;">
                    <h3 class="team-overview-name" style="margin: 0 0 10px 0; font-size: 1.4em; color: #1f2937; font-weight: 700;">${escapeHtml(team.name)}</h3>
                    <div class="team-overview-division" style="display: inline-block; padding: 4px 12px; background: ${divStyle.bgColor}; color: ${divStyle.textColor}; border-radius: 12px; font-size: 0.75em; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 6px;">${divStyle.label}</div>
                    <div class="team-overview-poule" style="font-size: 0.8em; color: #6b7280; font-weight: 500; margin-top: 4px;">${escapeHtml(team.poule || '')}</div>
                </div>
                
                <div class="team-overview-last-results" style="padding: 15px 20px 20px 20px; background: rgba(255,255,255,0.7); backdrop-filter: blur(10px);">
                    <div class="team-overview-last-label" style="font-size: 0.8em; font-weight: 600; color: #4b5563; margin-bottom: 10px; text-align: center; text-transform: uppercase; letter-spacing: 0.5px;">Derniers résultats</div>
                    <div class="team-overview-result-list" style="display: flex; gap: 6px; justify-content: center; flex-wrap: wrap;">
                        ${team.opponents.slice(-5).map(m => {
                            const color = m.result === 'V' ? '#10b981' : (m.result === 'D' ? '#ef4444' : '#f59e0b');
                            return `<div class="team-overview-result-dot" style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: ${color}; color: white; border-radius: 6px; font-size: 1em; font-weight: 700; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" title="${escapeHtml(m.opponent)} (${m.score})">${m.result}</div>`;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

function showSingleTeamStats(teamName) {
    // Obtenir les données de la phase actuelle
    let teamData = null;
    
    if (currentDisplayMode === 'phase1' && teamDataPhase1) {
        teamData = teamDataPhase1;
    } else if (currentDisplayMode === 'phase2' && teamDataPhase2) {
        teamData = teamDataPhase2;
    }
    
    if (!teamData) {
        document.getElementById('stats-equipes-content').innerHTML = '<p style="text-align: center; padding: 40px; color: #999;">Aucune donnée disponible</p>';
        return;
    }
    
    const teamStats = collectTeamStatisticsForPhase(teamData);
    const team = teamStats[teamName];
    
    if (!team) {
        document.getElementById('stats-equipes-content').innerHTML = '<p style="text-align: center; padding: 40px; color: #999;">Équipe non trouvée</p>';
        return;
    }
    
    const container = document.getElementById('stats-equipes-content');
    
    const tauxVictoire = team.matches.total > 0 ? 
        Math.round((team.matches.victoires / team.matches.total) * 100) : 0;
    const tauxRencontres = team.rencontres.total > 0 ? 
        Math.round((team.rencontres.victoires / team.rencontres.total) * 100) : 0;
    const ratioSets = team.sets.gagnes + team.sets.perdus > 0 ? 
        (team.sets.gagnes / (team.sets.gagnes + team.sets.perdus) * 100).toFixed(0) : 0;
    
    // Fonction pour obtenir le badge de la division
    function getDivisionBadge(division) {
        let bgColor, label;
        
        if (division.includes('REGIO')) {
            bgColor = '#8b5cf6';
            label = 'RÉGIONAL';
        } else if (division.includes('R3')) {
            bgColor = '#8b5cf6';
            label = 'RÉGIONAL';
        } else if (division.includes('PR')) {
            bgColor = '#f59e0b'; // Orange pour pré-régional
            label = 'PRÉ-RÉGIONAL';
        } else if (division.includes('D1')) {
            bgColor = '#3bc4f6'; 
            label = 'D1';
        } else if (division.includes('D2')) {
            bgColor = '#3b82f6';
            label = 'D2';
        } else if (division.includes('D3')) {
            bgColor = '#10b981';
            label = 'D3';
        } else if (division.includes('D4')) {
            bgColor = '#6b7280';
            label = 'D4';
        } else {
            bgColor = '#e5e7eb';
            label = 'DÉPARTEMENTAL';
        }
        
        return `<span style="display: inline-block; padding: 6px 14px; background: ${bgColor}; color: white; border-radius: 14px; font-size: 0.85em; font-weight: 700; letter-spacing: 0.5px; margin-right: 10px;">${label}</span>`;
    }
    
    let html = `
        <div class="team-detail-page" style="max-width: 1200px; margin: 0 auto;">
            <button class="team-detail-back" onclick="displayTeamStatistics()" style="margin-bottom: 20px; padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.95em; transition: background 0.3s;" onmouseover="this.style.background='#5568d3'" onmouseout="this.style.background='#667eea'">
                ← Retour aux équipes
            </button>
            
            <div class="team-detail-hero" style="margin-bottom: 25px; padding: 25px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 10px; color: white; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h2 class="team-detail-title" style="margin: 0 0 15px 0; font-size: 2em;">${escapeHtml(team.name)}</h2>
                <div class="team-detail-meta" style="margin-bottom: 20px; opacity: 0.95;">
                    ${getDivisionBadge(team.division)}
                    <span style="font-size: 0.95em; opacity: 0.9;">${escapeHtml(team.poule || '')}</span>
                </div>
                <div class="team-detail-kpis" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; text-align: center;">
                    <div>
                        <div style="font-size: 12px; opacity: 0.9; text-transform: uppercase; letter-spacing: 1px;">Matchs d'équipe</div>
                        <div style="font-size: 32px; font-weight: bold; margin: 5px 0;">${team.matches.victoires}-${team.matches.nuls}-${team.matches.defaites}</div>
                        <div style="font-size: 13px; opacity: 0.9;">${tauxVictoire}% victoires</div>
                    </div>
                    <div>
                        <div style="font-size: 12px; opacity: 0.9; text-transform: uppercase; letter-spacing: 1px;">Rencontres</div>
                        <div style="font-size: 32px; font-weight: bold; margin: 5px 0;">${team.rencontres.victoires}/${team.rencontres.total}</div>
                        <div style="font-size: 13px; opacity: 0.9;">${tauxRencontres}% victoires</div>
                    </div>
                    <div>
                        <div style="font-size: 12px; opacity: 0.9; text-transform: uppercase; letter-spacing: 1px;">Sets</div>
                        <div style="font-size: 32px; font-weight: bold; margin: 5px 0;">${team.sets.gagnes}-${team.sets.perdus}</div>
                        <div style="font-size: 13px; opacity: 0.9;">${ratioSets}% ratio</div>
                    </div>
                </div>
            </div>
            
            <div>
                <h3 style="color: #667eea; margin-bottom: 15px; font-size: 18px;">📋 Historique des matchs</h3>
    `;
    
    if (team.matchDetails.length === 0) {
        html += '<p style="color: #999; text-align: center; padding: 20px;">Aucun match trouvé</p>';
    } else {
        team.matchDetails.forEach((match, matchIdx) => {
            const resultColor = match.result === 'V' ? '#10b981' : (match.result === 'D' ? '#ef4444' : '#f59e0b');
            const resultBg = match.result === 'V' ? '#d1fae5' : (match.result === 'D' ? '#fee2e2' : '#fef3c7');
            const detailsId = `match-details-${teamName}-${matchIdx}`;
            
            html += `
                <div class="team-match-card" style="margin-bottom: 15px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; background: white;">
                    <div class="team-match-header" style="padding: 15px; background: ${resultBg}; border-left: 4px solid ${resultColor}; display: flex; justify-content: space-between; align-items: center; cursor: pointer;" onclick="toggleMatchDetails('${detailsId}')">
                        <div class="team-match-opponent" style="flex: 1;">
                            <div class="team-match-opponent-name" style="font-weight: 700; font-size: 16px; color: #333; margin-bottom: 4px;">
                                ${escapeHtml(match.opponent)}
                            </div>
                            <div class="team-match-context" style="font-size: 13px; color: #666;">${match.journee} • ${match.isSTH_A ? '🏠 Domicile' : '✈️ Extérieur'}</div>
                        </div>
                        <div class="team-match-score-block" style="text-align: right; margin-right: 15px;">
                            <div class="team-match-score" style="font-size: 24px; font-weight: bold; color: ${resultColor}; margin-bottom: 4px;">${match.score}</div>
                            <div class="team-match-result-badge" style="display: inline-block; padding: 4px 12px; background: ${resultColor}; color: white; border-radius: 4px; font-weight: 600; font-size: 12px;">
                                ${match.result === 'V' ? 'VICTOIRE' : (match.result === 'D' ? 'DÉFAITE' : 'NUL')}
                            </div>
                        </div>
                        <div class="team-match-chevron" style="font-size: 20px; color: #667eea;">
                            <span id="${detailsId}-icon">▼</span>
                        </div>
                    </div>
            `;
            
            if (match.rencontres && match.rencontres.length > 0) {
                html += `<div id="${detailsId}" class="team-match-details" style="display: none; padding: 15px; background: #f9fafb; border-top: 1px solid #e5e7eb;">`;
                
                match.rencontres.forEach((r, idx) => {
                    if (!r.joueur_a || !r.joueur_x) return;
                    
                    const joueurSTH = match.isSTH_A ? r.joueur_a : r.joueur_x;
                    const joueurAdv = match.isSTH_A ? r.joueur_x : r.joueur_a;
                    const sthWins = (match.isSTH_A && r.vainqueur === 'A') || (!match.isSTH_A && r.vainqueur === 'X');
                    
                    // Construire les noms des joueurs
                    let joueurAName = '';
                    if (r.type === 'double' && r.joueur_a.joueur2) {
                        joueurAName = `${escapeHtml(r.joueur_a.nom)} ${escapeHtml(r.joueur_a.prenom)} / ${escapeHtml(r.joueur_a.joueur2.nom)} ${escapeHtml(r.joueur_a.joueur2.prenom)}`;
                    } else {
                        joueurAName = `${escapeHtml(r.joueur_a.nom)} ${escapeHtml(r.joueur_a.prenom)}`;
                    }
                    
                    let joueurXName = '';
                    if (r.type === 'double' && r.joueur_x.joueur2) {
                        joueurXName = `${escapeHtml(r.joueur_x.nom)} ${escapeHtml(r.joueur_x.prenom)} / ${escapeHtml(r.joueur_x.joueur2.nom)} ${escapeHtml(r.joueur_x.joueur2.prenom)}`;
                    } else {
                        joueurXName = `${escapeHtml(r.joueur_x.nom)} ${escapeHtml(r.joueur_x.prenom)}`;
                    }
                    
                    // Construire les scores des sets
                    let sets = '';
                    if (r.sets && Array.isArray(r.sets)) {
                        sets = r.sets.map(set => {
                            const scoreA = set.equipe_a || set.score_a || 0;
                            const scoreX = set.equipe_x || set.score_x || 0;
                            
                            let setClass = 'set-score';
                            if (match.isSTH_A && scoreA > scoreX) {
                                setClass = 'set-score herblain-win';
                            } else if (!match.isSTH_A && scoreX > scoreA) {
                                setClass = 'set-score herblain-win';
                            } else if ((match.isSTH_A && scoreA < scoreX) || (!match.isSTH_A && scoreX < scoreA)) {
                                setClass = 'set-score herblain-lose';
                            }
                            
                            return `<span class="${setClass}">${scoreA}-${scoreX}</span>`;
                        }).join('');
                    }
                    
                    // Résultat
                    let matchScoreA = 0, matchScoreX = 0;
                    if (r.sets && Array.isArray(r.sets)) {
                        r.sets.forEach(s => {
                            const scoreA = s.equipe_a || s.score_a || 0;
                            const scoreX = s.equipe_x || s.score_x || 0;
                            if (scoreA > scoreX) matchScoreA++;
                            else if (scoreX > scoreA) matchScoreX++;
                        });
                    }
                    const result = `${matchScoreA}-${matchScoreX}`;
                    
                    // Classe de victoire
                    let victoryClass = '';
                    if (sthWins) {
                        victoryClass = 'victoire';
                    } else {
                        victoryClass = 'defaite';
                    }
                    
                    html += `
                        <div class="rencontre-item ${victoryClass}">
                            <div class="rencontre-num">${r.numero || idx + 1}</div>
                            <div class="rencontre-players">
                                ${joueurAName} <span class="vs">vs</span> ${joueurXName}
                            </div>
                            <div class="rencontre-sets rencontre-sets-scroll">
                                ${sets}
                                <span class="rencontre-result">${result}</span>
                            </div>
                        </div>
                    `;
                });
                
                html += '</div>';
            }
            
            html += '</div>';
        });
    }
    
    html += `
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

function toggleMatchDetails(detailsId) {
    const detailsDiv = document.getElementById(detailsId);
    const icon = document.getElementById(detailsId + '-icon');
    if (!detailsDiv || !icon) return;
    
    if (detailsDiv.style.display === 'none') {
        detailsDiv.style.display = 'block';
        icon.classList.add('open');
    } else {
        detailsDiv.style.display = 'none';
        icon.classList.remove('open');
    }
}

function displayClubStatistics() {
    if (!allData['statistiques']) {
        return;
    }
    
    const stats = allData['statistiques'];
    const joueurs = stats.joueurs;
    
    // Calculer les victoires/défaites/nuls sur les rencontres d'équipe
    let matchsEquipe = { victoires: 0, nuls: 0, defaites: 0, total: 0 };
    
    // Parcourir toutes les journées chargées (sauf 'statistiques')
    Object.keys(allData).forEach(journeeId => {
        if (journeeId !== 'statistiques' && allData[journeeId]) {
            allData[journeeId].forEach(match => {
                const equipeA = match.equipes.equipe_a;
                const equipeX = match.equipes.equipe_x;
                
                // Vérifier que les noms d'équipes ne sont pas null
                if (!equipeA.nom || !equipeX.nom) return;
                
                const isSTH_A = equipeA.nom.includes('ST HERBLAIN') || equipeA.nom.includes('TTSH');
                const isSTH_X = equipeX.nom.includes('ST HERBLAIN') || equipeX.nom.includes('TTSH');
                
                if (isSTH_A || isSTH_X) {
                    matchsEquipe.total++;
                    const scoreSTH = isSTH_A ? match.resultat_global.equipe_a : match.resultat_global.equipe_x;
                    const scoreAdv = isSTH_A ? match.resultat_global.equipe_x : match.resultat_global.equipe_a;
                    
                    if (scoreSTH > scoreAdv) {
                        matchsEquipe.victoires++;
                    } else if (scoreSTH < scoreAdv) {
                        matchsEquipe.defaites++;
                    } else {
                        matchsEquipe.nuls++;
                    }
                }
            });
        }
    });
    
    const container = document.getElementById('stats-club-content');
    if (!container) {
        return;
    }
    
    let html = `
        <div style="margin-bottom: 30px;">
            <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); margin-bottom: 20px;">
                <div class="stat-card">
                    <div class="number">${Object.keys(joueurs).length}</div>
                    <div class="label">Joueurs</div>
                </div>
                <div class="stat-card">
                    <div class="number">${matchsEquipe.total}</div>
                    <div class="label">Matchs d'équipe</div>
                </div>
                <div class="stat-card">
                    <div class="number">${stats.totaux.nombre_rencontres}</div>
                    <div class="label">Rencontres individuelles</div>
                </div>
                <div class="stat-card">
                    <div class="number">${stats.totaux.nombre_journees}</div>
                    <div class="label">Journées</div>
                </div>
            </div>
            
            <div class="team-performance-summary" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 15px; padding: 30px; margin: 0 auto; max-width: 800px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                <h3 style="color: white; text-align: center; margin: 0 0 25px 0; font-size: 1.3em;">🏆 Bilan des matchs d'équipe</h3>
                <div class="team-stats-flex" style="display: flex; justify-content: space-around; align-items: stretch; gap: 15px;">
                    <div style="flex: 1; background: rgba(255,255,255,0.15); backdrop-filter: blur(10px); border-radius: 12px; padding: 25px; text-align: center; border: 2px solid rgba(76, 175, 80, 0.5);">
                        <div style="font-size: 3em; font-weight: bold; color: white; margin-bottom: 10px;">${matchsEquipe.victoires}</div>
                        <div style="color: white; font-size: 1.1em; text-transform: uppercase; letter-spacing: 1px;">✅ Victoires</div>
                        <div style="color: rgba(255,255,255,0.8); margin-top: 8px; font-size: 0.9em;">${matchsEquipe.total > 0 ? Math.round((matchsEquipe.victoires / matchsEquipe.total) * 100) : 0}%</div>
                    </div>
                    <div style="flex: 1; background: rgba(255,255,255,0.15); backdrop-filter: blur(10px); border-radius: 12px; padding: 25px; text-align: center; border: 2px solid rgba(255, 152, 0, 0.5);">
                        <div style="font-size: 3em; font-weight: bold; color: white; margin-bottom: 10px;">${matchsEquipe.nuls}</div>
                        <div style="color: white; font-size: 1.1em; text-transform: uppercase; letter-spacing: 1px;">⚖️ Nuls</div>
                        <div style="color: rgba(255,255,255,0.8); margin-top: 8px; font-size: 0.9em;">${matchsEquipe.total > 0 ? Math.round((matchsEquipe.nuls / matchsEquipe.total) * 100) : 0}%</div>
                    </div>
                    <div style="flex: 1; background: rgba(255,255,255,0.15); backdrop-filter: blur(10px); border-radius: 12px; padding: 25px; text-align: center; border: 2px solid rgba(244, 67, 54, 0.5);">
                        <div style="font-size: 3em; font-weight: bold; color: white; margin-bottom: 10px;">${matchsEquipe.defaites}</div>
                        <div style="color: white; font-size: 1.1em; text-transform: uppercase; letter-spacing: 1px;">❌ Défaites</div>
                        <div style="color: rgba(255,255,255,0.8); margin-top: 8px; font-size: 0.9em;">${matchsEquipe.total > 0 ? Math.round((matchsEquipe.defaites / matchsEquipe.total) * 100) : 0}%</div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Top 5 des joueurs -->
        <div class="chart-container" style="margin-top: 30px;">
            <h3>🏅 Top 5 des joueurs</h3>
            <div id="top5-players"></div>
        </div>
        
        <!-- Evolution par journée -->
        <div class="chart-container" style="margin-top: 30px;">
            <h3>📈 Evolution par journée</h3>
            <canvas id="chart-evolution-journees"></canvas>
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
    
    // Afficher le Top 5
    displayTop5Players();
    
    // Afficher le graphique d'évolution
    displayEvolutionChart();
}

function displayTop5Players() {
    if (!allData['statistiques']) return;
    
    const stats = allData['statistiques'];
    const joueurs = stats.joueurs;
    
    // Convertir et trier par victoires, perf classement, puis ratio sets
    let joueursArray = Object.entries(joueurs).map(([nom, data]) => ({
        nom: nom,
        ...data
    }))
    .filter(j => j.matches.total >= 3)
    .sort(comparePlayersForRanking)
    .slice(0, 5);
    
    const container = document.getElementById('top5-players');
    if (!container) return;
    
    let html = '<div style="padding: 15px;">';
    joueursArray.forEach((joueur, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅';
        const bgColor = index === 0 ? 'rgba(255, 215, 0, 0.1)' : 
                       index === 1 ? 'rgba(192, 192, 192, 0.1)' : 
                       index === 2 ? 'rgba(205, 127, 50, 0.1)' : 
                       'rgba(100, 100, 100, 0.05)';
        
        html += `
            <div style="display: flex; align-items: center; padding: 12px; margin-bottom: 10px; background: ${bgColor}; border-radius: 8px; border-left: 4px solid #667eea; cursor: pointer;" onclick="showPlayerDetail('${joueur.nom.replace(/'/g, "\\'")}'\, true)">
                <div style="font-size: 1.5em; margin-right: 15px;">${medal}</div>
                <div style="flex: 1;">
                    <div style="font-weight: bold; color: #333;">${escapeHtml(joueur.nom)}</div>
                    <div style="font-size: 0.85em; color: #666;">
                        ${joueur.matches.victoires} V - ${joueur.matches.defaites} D (${joueur.matches.taux_victoire}%) | Perf: ${joueur.performance_classement?.score > 0 ? '+' : ''}${joueur.performance_classement?.score || 0}
                    </div>
                </div>
                <div style="text-align: right; color: #667eea; font-weight: bold;">${joueur.points_officiels} pts</div>
            </div>
        `;
    });
    html += '</div>';
    
    container.innerHTML = html;
}

function displayEvolutionChart() {
    // Récupérer toutes les journées chargées (sauf 'statistiques')
    const journees = Object.keys(allData).filter(k => k !== 'statistiques').sort();
    const journeesLabels = journees.map(j => {
        const match = j.match(/J(\d+)_(\d{4})(\d{2})(\d{2})/);
        return match ? `J${match[1]} (${match[4]}/${match[3]})` : j;
    });
    
    const data = {
        victoires: [],
        nuls: [],
        defaites: []
    };
    
    journees.forEach(journeeId => {
        if (allData[journeeId]) {
            let stats = { victoires: 0, nuls: 0, defaites: 0 };
            allData[journeeId].forEach(match => {
                const equipeA = match.equipes.equipe_a;
                const equipeX = match.equipes.equipe_x;
                
                // Vérifier que les noms d'équipes ne sont pas null
                if (!equipeA.nom || !equipeX.nom) return;
                
                const isSTH_A = equipeA.nom.includes('ST HERBLAIN') || equipeA.nom.includes('TTSH');
                const isSTH_X = equipeX.nom.includes('ST HERBLAIN') || equipeX.nom.includes('TTSH');
                
                if (isSTH_A || isSTH_X) {
                    const scoreSTH = isSTH_A ? match.resultat_global.equipe_a : match.resultat_global.equipe_x;
                    const scoreAdv = isSTH_A ? match.resultat_global.equipe_x : match.resultat_global.equipe_a;
                    
                    if (scoreSTH > scoreAdv) stats.victoires++;
                    else if (scoreSTH < scoreAdv) stats.defaites++;
                    else stats.nuls++;
                }
            });
            data.victoires.push(stats.victoires);
            data.nuls.push(stats.nuls);
            data.defaites.push(stats.defaites);
        }
    });
    
    const ctx = document.getElementById('chart-evolution-journees');
    if (!ctx) return;
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: journeesLabels,
            datasets: [
                {
                    label: 'Victoires',
                    data: data.victoires,
                    backgroundColor: 'rgba(76, 175, 80, 0.8)',
                    borderColor: 'rgba(76, 175, 80, 1)',
                    borderWidth: 2
                },
                {
                    label: 'Nuls',
                    data: data.nuls,
                    backgroundColor: 'rgba(255, 152, 0, 0.8)',
                    borderColor: 'rgba(255, 152, 0, 1)',
                    borderWidth: 2
                },
                {
                    label: 'Défaites',
                    data: data.defaites,
                    backgroundColor: 'rgba(244, 67, 54, 0.8)',
                    borderColor: 'rgba(244, 67, 54, 1)',
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + context.parsed.y;
                        }
                    }
                }
            }
        }
    });
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
    
    // Parcourir toutes les journées chargées (sauf 'statistiques')
    Object.keys(allData).forEach(journeeId => {
        if (journeeId !== 'statistiques' && allData[journeeId]) {
            allMatches.push(...allData[journeeId]);
        }
    });
    
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
    
    const winsElement = document.getElementById('wins-global');
    const lossesElement = document.getElementById('losses-global');
    const ratioElement = document.getElementById('ratio-global');
    
    if (winsElement) winsElement.textContent = totalWins;
    if (lossesElement) lossesElement.textContent = totalLosses;
    if (ratioElement) {
        const ratioValue = ratioElement.querySelector('.ratio-value');
        if (ratioValue) ratioValue.textContent = `${winPercentage}%`;
    }
    
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
            <tr onclick="showPlayerDetail('${joueur.nom.replace(/'/g, "\\'")}');" style="cursor: pointer;">
                <td class="rank">${index + 1}</td>
                <td class="player-name-cell">${escapeHtml(joueur.nom)}</td>
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

function displayMVPForJournee(journeeId, journeeKey) {
    // Calculate stats for this journee with doubles = 1
    const stats = calculateJourneeStats(journeeId, true);
    if (!stats || !Array.isArray(stats) || stats.length === 0) return;
    
    // Filter players with at least 1 match
    const eligiblePlayers = stats.filter(p => p.matches && p.matches.total >= 1);
    if (eligiblePlayers.length === 0) return;
    
    // Sort by: victories DESC, then performance_classement.score DESC, then set ratio DESC
    eligiblePlayers.sort(comparePlayersForRanking);
    
    // Get MVP (top player)
    const mvp = eligiblePlayers[0];
    const tauxVictoires = mvp.matches.total > 0 ? ((mvp.matches.victoires / mvp.matches.total) * 100).toFixed(0) : 0;
    const perfScore = mvp.performance_classement?.score || 0;
    const perfSign = perfScore >= 0 ? '+' : '';
    
    // Get container
    const container = document.getElementById(`mvp-${journeeKey}`);
    if (!container) return;
    
    // Create MVP card
    container.innerHTML = `
        <div class="mvp-card" onclick="showPlayerDetail('${mvp.nom.replace(/'/g, "\\'")}')">
            <div style="display: flex; align-items: center; justify-content: space-between;">
                <div style="flex: 1;">
                    <div style="font-size: 14px; color: rgba(255,255,255,0.8); margin-bottom: 5px;">
                        🏆 MVP de la journée
                    </div>
                    <div style="font-size: 24px; font-weight: 700; color: white; margin-bottom: 10px;">
                        ${escapeHtml(mvp.nom)}
                    </div>
                    <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                        <div>
                            <div style="font-size: 12px; color: rgba(255,255,255,0.7);">Bilan</div>
                            <div style="font-size: 18px; font-weight: 600; color: white;">
                                ${mvp.matches.victoires}-${mvp.matches.defaites} <span style="font-size: 14px; color: rgba(255,255,255,0.8);">(${tauxVictoires}%)</span>
                            </div>
                        </div>
                        <div>
                            <div style="font-size: 12px; color: rgba(255,255,255,0.7);">Performance</div>
                            <div style="font-size: 18px; font-weight: 600; color: ${perfScore >= 0 ? '#4ade80' : '#f87171'};">
                                ${perfSign}${perfScore}
                            </div>
                        </div>
                        <div>
                            <div style="font-size: 12px; color: rgba(255,255,255,0.7);">Points off.</div>
                            <div style="font-size: 18px; font-weight: 600; color: white;">
                                ${mvp.points_officiels}
                            </div>
                        </div>
                    </div>
                </div>
                <div style="font-size: 60px; opacity: 0.3; margin-left: 20px;">
                    🏆
                </div>
            </div>
        </div>
    `;
}

function displayTop3ForJournee(journeeId, journeeKey) {
    // Calculate stats for this journee with doubles = 1
    const stats = calculateJourneeStats(journeeId, true);
    if (!stats || !Array.isArray(stats) || stats.length === 0) return;
    
    // Filter players with at least 1 match
    const eligiblePlayers = stats.filter(p => p.matches && p.matches.total >= 1);
    if (eligiblePlayers.length === 0) return;
    
    // Sort by: victories DESC, then performance_classement.score DESC, then set ratio DESC
    eligiblePlayers.sort(comparePlayersForRanking);
    
    // Get Top 3
    const top3 = eligiblePlayers.slice(0, 3);
    
    // Get container
    const container = document.getElementById(`top3-${journeeKey}`);
    if (!container) return;
    
    // Create Top 3 cards
    let html = '<h3 style="color: #667eea; margin-bottom: 15px;">🏅 Top 3 de la journée</h3>';
    html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">';
    
    top3.forEach((player, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
        const bgColor = index === 0 ? 'linear-gradient(135deg, #ffd700 0%, #ffed4e 100%)' : 
                       index === 1 ? 'linear-gradient(135deg, #c0c0c0 0%, #e8e8e8 100%)' : 
                       'linear-gradient(135deg, #cd7f32 0%, #d4956a 100%)';
        const tauxVictoires = player.matches.total > 0 ? ((player.matches.victoires / player.matches.total) * 100).toFixed(0) : 0;
        const perfScore = player.performance_classement?.score || 0;
        const perfSign = perfScore >= 0 ? '+' : '';
        
        html += `
            <div onclick="showPlayerDetail('${player.nom.replace(/'/g, "\\'")}')">
                <div style="background: ${bgColor}; border-radius: 12px; padding: 15px; cursor: pointer; transition: transform 0.2s; box-shadow: 0 4px 6px rgba(0,0,0,0.1);" 
                     onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 6px 12px rgba(0,0,0,0.15)';" 
                     onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 6px rgba(0,0,0,0.1)';">
                    <div style="display: flex; align-items: center; margin-bottom: 10px;">
                        <div style="font-size: 2em; margin-right: 10px;">${medal}</div>
                        <div style="flex: 1;">
                            <div style="font-weight: 700; font-size: 16px; color: #333;">${escapeHtml(player.nom)}</div>
                            <div style="font-size: 12px; color: #666;">${player.points_officiels} pts</div>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px;">
                        <div style="background: rgba(255,255,255,0.5); padding: 6px; border-radius: 6px;">
                            <div style="font-weight: 600; color: #333;">${player.matches.victoires}V-${player.matches.defaites}D</div>
                            <div style="font-size: 11px; color: #666;">${tauxVictoires}%</div>
                        </div>
                        <div style="background: rgba(255,255,255,0.5); padding: 6px; border-radius: 6px;">
                            <div style="font-weight: 600; color: ${perfScore >= 0 ? '#059669' : '#dc2626'};">${perfSign}${perfScore}</div>
                            <div style="font-size: 11px; color: #666;">Perf</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

function displayMatches(journeeId) {
    const matches = allData[journeeId];
    if (!matches) {
        return;
    }
    
    const journeeKey = journeeId.toLowerCase().replace('_', '-');
    const matchesContainer = document.getElementById(`matches-${journeeKey}`);
    
    if (!matchesContainer) {
        return;
    }
    
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
                    ${equipeTTSH ? `<span class="match-equipe">${escapeHtml(equipeTTSH)}</span>` : ''}
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
    document.getElementById(`stats-${journeeKey}-matches`).textContent = sortedMatches.length;
    document.getElementById(`stats-${journeeKey}-victoires`).textContent = victoires;
    document.getElementById(`stats-${journeeKey}-nuls`).textContent = nuls;
    document.getElementById(`stats-${journeeKey}-defaites`).textContent = defaites;
    
    // Display MVP for this journee
    displayMVPForJournee(journeeId, journeeKey);
    
    // Display Top 3 for this journee
    displayTop3ForJournee(journeeId, journeeKey);
    
    // Create pie chart for this journee
    createSetDistributionChart(journeeId, sortedMatches);
}

function createSetDistributionChart(journeeId, matches) {
    const journeeKey = journeeId.toLowerCase().replace('_', '-');
    const canvasId = `chart-${journeeKey}`;
    
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
    
    document.getElementById(`wins-${journeeKey}`).textContent = totalWins;
    document.getElementById(`losses-${journeeKey}`).textContent = totalLosses;
    document.getElementById(`ratio-${journeeKey}`).querySelector('.ratio-value').textContent = `${winPercentage}%`;
    
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    // Détruire l'ancien graphique s'il existe
    if (window[`chart_${journeeKey}`]) {
        window[`chart_${journeeKey}`].destroy();
    }
    
    // Créer le nouveau graphique
    window[`chart_${journeeKey}`] = new Chart(canvas, {
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
        `${equipeTTSH ? `<span style="background: #667eea; color: white; padding: 5px 12px; border-radius: 5px; margin-right: 15px;">${escapeHtml(equipeTTSH)}</span>` : ''}${escapeHtml(equipeA.nom) || 'Équipe A'} ${scoreA} - ${scoreX} ${escapeHtml(equipeX.nom) || 'Équipe X'}`;
    
    // Build players lists
    const playersA = equipeA.joueurs.map(j => `
        <li class="player-item">
            <div>
                <span class="player-name">${escapeHtml(j.nom)} ${escapeHtml(j.prenom)}</span>
                <span class="player-license">${j.licence}</span>
            </div>
            <span class="player-points">${j.points} pts</span>
        </li>
    `).join('');
    
    const playersX = equipeX.joueurs.map(j => `
        <li class="player-item">
            <div>
                <span class="player-name">${escapeHtml(j.nom)} ${escapeHtml(j.prenom)}</span>
                <span class="player-license">${j.licence}</span>
            </div>
            <span class="player-points">${j.points} pts</span>
        </li>
    `).join('');
    
    // Build rencontres list
    const isHerblainA = equipeA.nom && equipeA.nom.includes('HERBLAIN');
    const isHerblainX = equipeX.nom && equipeX.nom.includes('HERBLAIN');
    
    const rencontres = match.rencontres.map(r => {
        // Handle joueur_a and joueur_x which can be objects or strings
        // For doubles, concatenate both players (only names for doubles)
        let joueurAName = '';
        if (typeof r.joueur_a === 'object' && r.joueur_a) {
            if (r.joueur_a.joueur2) {
                // Double: only last names
                joueurAName = `${escapeHtml(r.joueur_a.nom)} / ${escapeHtml(r.joueur_a.joueur2.nom)}`;
            } else {
                // Simple: full name
                joueurAName = `${escapeHtml(r.joueur_a.nom)} ${escapeHtml(r.joueur_a.prenom)}`;
            }
        } else {
            joueurAName = r.joueur_a || 'Joueur A';
        }
        
        let joueurXName = '';
        if (typeof r.joueur_x === 'object' && r.joueur_x) {
            if (r.joueur_x.joueur2) {
                // Double: only last names
                joueurXName = `${escapeHtml(r.joueur_x.nom)} / ${escapeHtml(r.joueur_x.joueur2.nom)}`;
            } else {
                // Simple: full name
                joueurXName = `${escapeHtml(r.joueur_x.nom)} ${escapeHtml(r.joueur_x.prenom)}`;
            }
        } else {
            joueurXName = r.joueur_x || 'Joueur X';
        }
        
        const isAbandon = (joueurAName && joueurAName.includes('(A)')) || (joueurXName && joueurXName.includes('(A)'));
        
        // Calculer le score en sets (nombre de sets gagnés par chaque joueur)
        let setsWonA = 0;
        let setsWonX = 0;
        
        // Vérifier si les sets existent (certains matchs n'ont pas de détails de sets)
        if (r.sets && Array.isArray(r.sets)) {
            r.sets.forEach(s => {
                const scoreA = s.equipe_a || s.score_a || 0;
                const scoreX = s.equipe_x || s.score_x || 0;
                if (scoreA > scoreX) setsWonA++;
                else if (scoreX > scoreA) setsWonX++;
            });
        }
        
        const result = isAbandon ? '(A)' : (r.sets ? `${setsWonA}-${setsWonX}` : 'N/A');
        
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
                <h3>${escapeHtml(equipeA.nom) || 'Équipe A'}</h3>
                <ul class="player-list">${playersA}</ul>
            </div>
            <div class="team-panel">
                <h3>${escapeHtml(equipeX.nom) || 'Équipe X'}</h3>
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

// Fonction helper pour normaliser les noms de joueurs
function normalizePlayerName(joueur) {
    return normalizePlayerNameString(joueur.prenom, joueur.nom);
}

function showPlayerDetail(playerName, forceAll = false) {
    // Respecter le filtre de journée actif (sauf si forceAll)
    const displayJournee = forceAll ? 'all' : currentStatsJournee;
    
    // Récupérer les stats en fonction de la journée sélectionnée
    let joueur;
    if (displayJournee === 'all') {
        // Pour "all", calculer les stats depuis les matchs bruts pour compter les doubles comme 1
        const allJourneesStats = {};
        
        // Calculer pour chaque journée chargée (sauf 'statistiques')
        Object.keys(allData).filter(k => k !== 'statistiques').forEach(journeeId => {
            if (allData[journeeId]) {
                const journeeStatsArray = calculateJourneeStats(journeeId);
                journeeStatsArray.forEach(stats => {
                    const nom = stats.nom;
                    if (!allJourneesStats[nom]) {
                        allJourneesStats[nom] = {
                            points_officiels: stats.points_officiels,
                            matches: { total: 0, victoires: 0, defaites: 0, taux_victoire: 0 },
                            sets: { gagnes: 0, perdus: 0, total: 0, ratio: 0 },
                            performance_classement: { score: 0 }
                        };
                    }
                    allJourneesStats[nom].matches.total += stats.matches.total;
                    allJourneesStats[nom].matches.victoires += stats.matches.victoires;
                    allJourneesStats[nom].matches.defaites += stats.matches.defaites;
                    allJourneesStats[nom].sets.gagnes += stats.sets.gagnes;
                    allJourneesStats[nom].sets.perdus += stats.sets.perdus;
                    allJourneesStats[nom].performance_classement.score += (stats.performance_classement?.score || 0);
                });
            }
        });
        
        // Recalculer les ratios
        Object.values(allJourneesStats).forEach(stats => {
            stats.sets.total = stats.sets.gagnes + stats.sets.perdus;
            stats.sets.ratio = stats.sets.total > 0 ? stats.sets.gagnes / stats.sets.total : 0;
            stats.matches.taux_victoire = stats.matches.total > 0 ? 
                Math.round((stats.matches.victoires / stats.matches.total) * 100) : 0;
        });
        
        joueur = allJourneesStats[playerName];
    } else {
        // Calculer les stats pour la journée spécifique
        const journeeStatsArray = calculateJourneeStats(currentStatsJournee);
        joueur = journeeStatsArray.find(p => p.nom === playerName);
    }
    
    if (!joueur) {
        return;
    }
    
    const modal = document.getElementById('matchModal');
    const modalBody = document.getElementById('modal-body');
    
    let journeeTitle = '';
    if (displayJournee !== 'all') {
        const match = displayJournee.match(/J(\d+)_(\d{4})(\d{2})(\d{2})/);
        journeeTitle = match ? ` - Journée ${match[1]}` : ` - ${displayJournee}`;
    }
    
    document.getElementById('modal-title').innerHTML = 
        `<span style="background: #667eea; color: white; padding: 5px 12px; border-radius: 5px; margin-right: 15px;">👤</span>${playerName}${journeeTitle}`;
    
    // Statistiques générales
    const winRate = joueur.matches.taux_victoire;
    const setsRatio = (joueur.sets.ratio * 100).toFixed(0);
    const perfScore = joueur.performance_classement?.score || 0;
    const perfSign = perfScore > 0 ? '+' : '';
    
    let html = `
        <div style="margin-bottom: 25px; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 10px; color: white;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; text-align: center;">
                <div>
                    <div style="font-size: 12px; opacity: 0.9; text-transform: uppercase; letter-spacing: 1px;">Points</div>
                    <div style="font-size: 32px; font-weight: bold; margin: 5px 0;">${joueur.points_officiels}</div>
                </div>
                <div>
                    <div style="font-size: 12px; opacity: 0.9; text-transform: uppercase; letter-spacing: 1px;">Matches</div>
                    <div style="font-size: 32px; font-weight: bold; margin: 5px 0;">${joueur.matches.victoires}/${joueur.matches.total}</div>
                    <div style="font-size: 13px; opacity: 0.9;">${winRate}% victoires</div>
                </div>
                <div>
                    <div style="font-size: 12px; opacity: 0.9; text-transform: uppercase; letter-spacing: 1px;">Sets</div>
                    <div style="font-size: 32px; font-weight: bold; margin: 5px 0;">${joueur.sets.gagnes}/${joueur.sets.gagnes + joueur.sets.perdus}</div>
                    <div style="font-size: 13px; opacity: 0.9;">${setsRatio}% ratio</div>
                </div>
                <div>
                    <div style="font-size: 12px; opacity: 0.9; text-transform: uppercase; letter-spacing: 1px;">Performance</div>
                    <div style="font-size: 32px; font-weight: bold; margin: 5px 0;">${perfSign}${perfScore}</div>
                    <div style="font-size: 13px; opacity: 0.9;">vs classement</div>
                </div>
            </div>
        </div>
    `;
    
    // Historique des matches - filtrer par journée si nécessaire
    const allMatches = [];
    Object.entries(allData).forEach(([journeeId, matches]) => {
        if (journeeId === 'statistiques') return;
        
        // Si on est sur une journée spécifique, filtrer uniquement cette journée
        if (displayJournee !== 'all' && journeeId !== displayJournee) return;
        
        matches.forEach((match, matchIndex) => {
            const equipeA = match.equipes.equipe_a;
            const equipeX = match.equipes.equipe_x;
            
            // Vérifier si le joueur a participé - normaliser les noms pour la comparaison
            const normalizePlayerName = (j) => normalizePlayerNameString(j.prenom, j.nom);
            
            const playerInA = equipeA.joueurs.some(j => normalizePlayerName(j) === playerName);
            const playerInX = equipeX.joueurs.some(j => normalizePlayerName(j) === playerName);
            
            if (playerInA || playerInX) {
                const playerTeam = playerInA ? 'A' : 'X';
                const scoreA = match.resultat_global.equipe_a;
                const scoreX = match.resultat_global.equipe_x;
                const isVictory = (playerTeam === 'A' && scoreA > scoreX) || (playerTeam === 'X' && scoreX > scoreA);
                
                // Récupérer les détails des rencontres du joueur (si disponibles)
                const playerMatches = match.rencontres ? match.rencontres.filter(rencontre => {
                    const joueurA = normalizePlayerName(rencontre.joueur_a);
                    const joueurX = normalizePlayerName(rencontre.joueur_x);
                    
                    // Pour les simples
                    if (rencontre.type === 'simple') {
                        return joueurA === playerName || joueurX === playerName;
                    }
                    
                    // Pour les doubles
                    if (rencontre.type === 'double') {
                        const joueurA2 = rencontre.joueur_a.joueur2 ? normalizePlayerName({
                            nom: rencontre.joueur_a.joueur2.nom,
                            prenom: rencontre.joueur_a.joueur2.prenom
                        }) : null;
                        const joueurX2 = rencontre.joueur_x.joueur2 ? normalizePlayerName({
                            nom: rencontre.joueur_x.joueur2.nom,
                            prenom: rencontre.joueur_x.joueur2.prenom
                        }) : null;
                        return joueurA === playerName || joueurX === playerName || 
                               joueurA2 === playerName || joueurX2 === playerName;
                    }
                    
                    return false;
                }).map(rencontre => {
                    // Enrichir avec les points des joueurs
                    const joueurAData = equipeA.joueurs.find(j => j.lettre === rencontre.joueur_a.lettre || rencontre.joueur_a.lettre.includes(j.lettre));
                    const joueurXData = equipeX.joueurs.find(j => j.lettre === rencontre.joueur_x.lettre || rencontre.joueur_x.lettre.includes(j.lettre));
                    
                    let enrichedRencontre = {
                        ...rencontre,
                        joueur_a: { ...rencontre.joueur_a, points: joueurAData?.points || 0 },
                        joueur_x: { ...rencontre.joueur_x, points: joueurXData?.points || 0 }
                    };
                    
                    // Pour les doubles, pas besoin d'enrichir les partenaires (ils sont dans joueur2)
                    // Les données sont déjà dans rencontre.joueur_a.joueur2 et rencontre.joueur_x.joueur2
                    
                    return enrichedRencontre;
                }) : [];
                
                allMatches.push({
                    journeeId,
                    matchIndex,
                    date: match.informations?.date || journeeId,
                    equipeA: equipeA.nom,
                    equipeX: equipeX.nom,
                    scoreA,
                    scoreX,
                    isVictory,
                    playerTeam,
                    equipeTTSH: match.equipe_ttsh || '',
                    playerMatches
                });
            }
        });
    });
    
    // Afficher l'historique
    html += `
        <div>
            <h3 style="color: #667eea; margin-bottom: 15px; font-size: 18px;">📋 Historique des matchs individuels</h3>
    `;
    
    if (allMatches.length === 0) {
        html += '<p style="color: #999; text-align: center; padding: 20px;">Aucun match trouvé pour ce joueur</p>';
    } else {
        // Compter le total de parties jouées (simples et doubles séparément)
        let totalSimples = 0;
        let totalDoubles = 0;
        allMatches.forEach(match => {
            if (match.playerMatches && match.playerMatches.length > 0) {
                match.playerMatches.forEach(partie => {
                    if (partie.type === 'double') {
                        totalDoubles++;
                    } else {
                        totalSimples++;
                    }
                });
            }
        });
        
        const totalParties = totalSimples + totalDoubles;
        
        if (totalParties === 0) {
            html += '<p style="color: #999; text-align: center; padding: 20px;">Détails des matchs individuels non disponibles</p>';
        } else {
            html += `<div style="color: #666; margin-bottom: 15px; font-size: 14px;">
                <strong>${totalParties} match(s) individuel(s)</strong> dans ${allMatches.length} rencontre(s) 
                <span style="margin-left: 15px;">• ${totalSimples} simple(s) • ${totalDoubles} double(s)</span>
            </div>`;
            
            allMatches.forEach(match => {
                // N'afficher que si le joueur a joué des parties
                if (!match.playerMatches || match.playerMatches.length === 0) return;
                
                const resultClass = match.isVictory ? 'badge-success' : 'badge-warning';
                const resultText = match.isVictory ? '✓ Équipe Victoire' : '✗ Équipe Défaite';
                
                // Statistiques du joueur pour ce match
                let playerWins = 0;
                let playerLosses = 0;
                let setsWon = 0;
                let setsLost = 0;
                let simplesWins = 0;
                let simplesLosses = 0;
                let doublesWins = 0;
                let doublesLosses = 0;
                
                match.playerMatches.forEach(partie => {
                    const joueurA = normalizePlayerName(partie.joueur_a);
                    const isPlayerA = joueurA === playerName;
                    const isDouble = partie.type === 'double';
                    
                    // Calculer le score en sets depuis les sets
                    let scoreA = 0;
                    let scoreX = 0;
                    if (partie.sets && Array.isArray(partie.sets)) {
                        partie.sets.forEach(set => {
                            if (set.gagnant === 'A') scoreA++;
                            else if (set.gagnant === 'X') scoreX++;
                        });
                    }
                    
                    // Déterminer si le joueur a gagné cette partie et de quel côté il joue
                    let playerWon;
                    let isPlayerInTeamA;
                    
                    if (isDouble) {
                        const joueurA2 = partie.joueur_a.joueur2 ? normalizePlayerName({
                            nom: partie.joueur_a.joueur2.nom,
                            prenom: partie.joueur_a.joueur2.prenom
                        }) : '';
                        isPlayerInTeamA = joueurA === playerName || joueurA2 === playerName;
                        playerWon = (isPlayerInTeamA && scoreA > scoreX) || (!isPlayerInTeamA && scoreX > scoreA);
                    } else {
                        isPlayerInTeamA = isPlayerA;
                        playerWon = (isPlayerA && scoreA > scoreX) || (!isPlayerA && scoreX > scoreA);
                    }
                    
                    if (playerWon) {
                        playerWins++;
                        if (isDouble) doublesWins++;
                        else simplesWins++;
                        setsWon += isPlayerInTeamA ? scoreA : scoreX;
                        setsLost += isPlayerInTeamA ? scoreX : scoreA;
                    } else {
                        playerLosses++;
                        if (isDouble) doublesLosses++;
                        else simplesLosses++;
                        setsWon += isPlayerInTeamA ? scoreA : scoreX;
                        setsLost += isPlayerInTeamA ? scoreX : scoreA;
                    }
                });
                
                const playerWinRate = playerWins > 0 ? ((playerWins / (playerWins + playerLosses)) * 100).toFixed(0) : 0;
                
                html += `
                    <div class="match-card" style="margin-bottom: 15px; padding: 15px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid ${playerWins > playerLosses ? '#28a745' : playerWins < playerLosses ? '#dc3545' : '#ffc107'};">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px; flex-wrap: wrap; gap: 10px;">
                            <div>
                                ${match.equipeTTSH ? `<div style="background: #667eea; color: white; padding: 4px 10px; border-radius: 4px; font-size: 13px; display: inline-block; margin-bottom: 5px;">${match.equipeTTSH}</div>` : ''}
                                <div style="color: #666; font-size: 13px; margin-top: 3px;">📅 ${match.date}</div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 14px; color: #999; margin-bottom: 3px;">Résultat équipe</div>
                                <div style="font-size: 16px;">
                                    ${match.equipeA} <strong style="color: #667eea;">${match.scoreA}-${match.scoreX}</strong> ${match.equipeX}
                                </div>
                            </div>
                        </div>
                        
                        <div style="background: white; padding: 15px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 2px solid #f0f0f0;">
                                <div style="font-weight: bold; color: #333; font-size: 15px;">🎯 Performance individuelle</div>
                                <div style="display: flex; gap: 15px; font-size: 14px; flex-wrap: wrap;">
                                    <div><strong>${playerWins}V</strong> - <strong>${playerLosses}D</strong> <span style="color: #999;">(${playerWinRate}%)</span></div>
                                    <div style="color: #666;">Sets: <strong>${setsWon}-${setsLost}</strong></div>
                                    ${(simplesWins + simplesLosses > 0) ? `<div style="color: #4caf50;">Simples: <strong>${simplesWins}-${simplesLosses}</strong></div>` : ''}
                                    ${(doublesWins + doublesLosses > 0) ? `<div style="color: #2196f3;">Doubles: <strong>${doublesWins}-${doublesLosses}</strong></div>` : ''}
                                </div>
                            </div>
                            
                            <div style="display: flex; flex-direction: column; gap: 8px;">
                `;
                
                match.playerMatches.forEach(partie => {
                    const joueurA = normalizePlayerName(partie.joueur_a);
                    const joueurX = normalizePlayerName(partie.joueur_x);
                    const isPlayerA = joueurA === playerName;
                    
                    // Gérer les simples et les doubles différemment
                    let partenaire = '';
                    let adversaires = '';
                    let advPoints = 0;
                    let isDouble = partie.type === 'double';
                    let isPlayerInTeamA = false;
                    
                    if (isDouble) {
                        // Pour les doubles - la structure est joueur_a.joueur2 et joueur_x.joueur2
                        const joueurA2 = partie.joueur_a.joueur2 ? normalizePlayerName({
                            nom: partie.joueur_a.joueur2.nom,
                            prenom: partie.joueur_a.joueur2.prenom
                        }) : '';
                        const joueurX2 = partie.joueur_x.joueur2 ? normalizePlayerName({
                            nom: partie.joueur_x.joueur2.nom,
                            prenom: partie.joueur_x.joueur2.prenom
                        }) : '';
                        
                        isPlayerInTeamA = joueurA === playerName || joueurA2 === playerName;
                        
                        if (isPlayerInTeamA) {
                            partenaire = joueurA === playerName ? joueurA2 : joueurA;
                            adversaires = `${joueurX} / ${joueurX2}`;
                        } else {
                            partenaire = joueurX === playerName ? joueurX2 : joueurX;
                            adversaires = `${joueurA} / ${joueurA2}`;
                        }
                    } else {
                        // Pour les simples
                        adversaires = isPlayerA ? joueurX : joueurA;
                        advPoints = isPlayerA ? partie.joueur_x.points : partie.joueur_a.points;
                    }
                    
                    
                    // Calculer le score en sets
                    let scoreA = 0;
                    let scoreX = 0;
                    if (partie.sets && Array.isArray(partie.sets)) {
                        partie.sets.forEach(set => {
                            if (set.gagnant === 'A') scoreA++;
                            else if (set.gagnant === 'X') scoreX++;
                        });
                    }
                    
                    const won = isDouble 
                        ? (isPlayerInTeamA && scoreA > scoreX) || (!isPlayerInTeamA && scoreX > scoreA)
                        : (isPlayerA && scoreA > scoreX) || (!isPlayerA && scoreX > scoreA);
                    const playerScore = isDouble 
                        ? (isPlayerInTeamA ? scoreA : scoreX)
                        : (isPlayerA ? scoreA : scoreX);
                    const advScore = isDouble 
                        ? (isPlayerInTeamA ? scoreX : scoreA)
                        : (isPlayerA ? scoreX : scoreA);
                    
                    // Couleur de fond différente pour les doubles
                    const bgColor = isDouble 
                        ? (won ? '#e3f2fd' : '#fff3e0')  // Bleu clair / Orange clair pour doubles
                        : (won ? '#e8f5e9' : '#ffebee'); // Vert clair / Rouge clair pour simples
                    const borderColor = isDouble
                        ? (won ? '#2196f3' : '#ff9800')  // Bleu / Orange pour doubles
                        : (won ? '#28a745' : '#dc3545'); // Vert / Rouge pour simples
                    
                    html += `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: ${bgColor}; border-radius: 5px; border-left: 3px solid ${borderColor};">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span style="font-size: 18px;">${won ? '✓' : '✗'}</span>
                                <div>
                                    ${isDouble 
                                        ? `<div style="font-weight: 500; color: #2196f3;">👥 Double avec ${partenaire}</div>` 
                                        : `<div style="font-weight: 500; color: #333;">🏓 Simple</div>`
                                    }
                                    <div style="font-weight: ${isDouble ? 'normal' : 'normal'}; color: #333; ${isDouble ? '' : 'margin-top: 2px;'}">vs ${adversaires}</div>
                                    ${!isDouble ? `<div style="font-size: 12px; color: #666;">Classement: ${advPoints} pts</div>` : ''}
                                </div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 20px; font-weight: bold; color: ${borderColor};">
                                    ${playerScore} - ${advScore}
                                </div>
                            </div>
                        </div>
                    `;
                });
                
                html += `
                            </div>
                        </div>
                    </div>
                `;
            });
        }
    }
    
    html += '</div>';
    
    modalBody.innerHTML = html;
    modal.classList.add('active');
}

// Close modal on outside click
window.onclick = function(event) {
    const modal = document.getElementById('matchModal');
    if (event.target === modal) {
        closeModal();
    }
}

// Close modal on ESC key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' || event.key === 'Esc') {
        const modal = document.getElementById('matchModal');
        if (modal && modal.classList.contains('active')) {
            closeModal();
        }
    }
});

// Load data on page load
loadData();
