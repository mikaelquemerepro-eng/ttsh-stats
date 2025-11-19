# 🐛 Guide de Débogage MVP

## Problème : Le MVP ne s'affiche pas ou est incomplet

### 1. Vérifier que le serveur HTTP est lancé

```bash
cd resultats/
python -m http.server 8000
```

Puis ouvrir : http://localhost:8000/

### 2. Utiliser la page de debug

Ouvrir : http://localhost:8000/debug_mvp.html

Cette page affiche :
- ✅/❌ Status du chargement des données
- Le résultat brut de `calculateJourneeStats()`
- Les données du MVP calculé
- L'aperçu visuel des MVP J3 et J4

### 3. Vérifier dans la console du navigateur (F12)

Rechercher les erreurs :
- `Cannot read property 'matches' of undefined` → Structure de données incorrecte
- `container is null` → ID du conteneur MVP manquant dans le HTML
- `Failed to fetch` → Problème CORS (ouvrir via serveur HTTP)

### 4. Vérifier la structure HTML

Les conteneurs MVP doivent exister :
```html
<div id="mvp-j3" style="margin: 20px 0;"></div>
<div id="mvp-j4" style="margin: 20px 0;"></div>
```

### 5. Vérifier que displayMVPForJournee est appelé

Dans `displayMatches()`, après l'update des stats :
```javascript
// Display MVP for this journee
displayMVPForJournee(journeeId, journeePrefix);
```

### 6. Structure des données attendue

Le MVP attend que `calculateJourneeStats()` retourne :
```javascript
[
  {
    nom: "Jean DUPONT",
    points_officiels: 1200,
    matches: {
      total: 5,
      victoires: 3,
      defaites: 2,
      taux_victoire: 60
    },
    sets: {...},
    performance_classement: {
      score: 50
    }
  },
  // ... autres joueurs
]
```

### 7. Problèmes courants

| Symptôme | Cause probable | Solution |
|----------|----------------|----------|
| Rien ne s'affiche | `displayMVPForJournee()` pas appelé | Vérifier `displayMatches()` |
| Juste l'icône 🏆 | Erreur dans le template string | Vérifier la console (F12) |
| "undefined" affiché | Propriétés mal référencées | Utiliser `mvp.matches.victoires` pas `mvp.victoires` |
| Carte non cliquable | onclick cassé | Échapper les apostrophes dans le nom |
| Erreur CORS | Fichier ouvert en file:// | Utiliser serveur HTTP |

### 8. Test rapide en console

Ouvrir la console (F12) et taper :
```javascript
// Vérifier les données
console.log(allData);

// Tester calculateJourneeStats
const stats = calculateJourneeStats('J3_20251012', true);
console.log('Stats:', stats);
console.log('Premier joueur:', stats[0]);

// Tester displayMVPForJournee
displayMVPForJournee('J3_20251012', 'j3');
```

### 9. Forcer le rechargement complet

1. Ouvrir DevTools (F12)
2. Onglet Network
3. Cocher "Disable cache"
4. Faire Ctrl+Shift+R (rechargement forcé)

### 10. Si tout échoue

1. Vérifier `script.js` ligne 878-945 (fonction `displayMVPForJournee`)
2. Vérifier `index.html` lignes 73 et 117 (conteneurs MVP)
3. Ouvrir `debug_mvp.html` pour diagnostic complet
