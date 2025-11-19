# 🧪 Tests Unitaires TTSH Stats

## ⚠️ Prérequis IMPORTANT

**Les tests DOIVENT être lancés via un serveur HTTP local à cause de la politique CORS des navigateurs.**

### Lancer le serveur de test :

```bash
cd resultats/
python -m http.server 8000
```

Puis ouvrir dans le navigateur : **http://localhost:8000/test_script.html**

❌ **NE PAS** ouvrir `test_script.html` directement (file://) → Erreur CORS !

## Objectif

Ce fichier de tests permet de vérifier que les fonctions principales du site ne sont pas cassées lors de l'ajout de nouvelles fonctionnalités.

## Utilisation

### Lancer les tests

1. Ouvrir `test_script.html` dans un navigateur
2. Cliquer sur le bouton "▶️ Lancer tous les tests"
3. Vérifier que tous les tests sont verts ✅

### Tests couverts

#### 📊 calculateJourneeStats
- ✅ Retourne un tableau (et non un objet)
- ✅ Chaque élément a une propriété `nom`
- ✅ Structure correcte avec `matches`, `sets`, `performance_classement`
- ✅ Gestion des IDs invalides

#### 👥 displayStatistics
- ✅ Ne crash pas avec `journeeFilter="all"`
- ✅ Ne crash pas avec une journée spécifique
- ✅ Tableau des joueurs affiché correctement

#### 🏆 displayMVPForJournee
- ✅ Ne crash pas avec données valides
- ✅ Gestion des données manquantes
- ✅ Affichage du MVP

#### 🔍 Cohérence des données
- ✅ Pas de nom `undefined` dans les joueurs
- ✅ Cohérence matches: total = victoires + défaites
- ✅ Comptage des doubles (1 vs 0.5)

## Ajouter un test

```javascript
runner.suite('🎯 Nom du test suite')
    .test('Description du test', () => {
        const result = maFonction();
        runner.assert(condition, 'Message si échec');
        runner.assertEqual(actual, expected, 'Message');
        runner.assertType(value, 'array', 'Message');
    });
```

## Assertions disponibles

- `assert(condition, message)` - Vérifie une condition
- `assertEqual(actual, expected, message)` - Égalité stricte
- `assertArrayEqual(arr1, arr2, message)` - Égalité de tableaux
- `assertType(value, type, message)` - Vérification du type ('array', 'object', 'string', etc.)
- `assertHasProperty(obj, prop, message)` - Propriété existe

## Avant de déployer

**⚠️ TOUJOURS lancer les tests avant de déployer !**

```bash
# 1. Ouvrir test_script.html dans le navigateur
# 2. Vérifier tous les tests verts
# 3. Si un test échoue, corriger le code
# 4. Déployer seulement quand tous les tests passent
python deploy_site.py
```

## Résolution de problèmes

### ❌ "Script en cours de chargement"
→ Attendre 1 seconde et relancer

### ❌ Tests échouent après modification
→ Vérifier que :
- `calculateJourneeStats` retourne un tableau avec propriété `nom`
- Les structures de données sont cohérentes
- Pas de références à `undefined`

### ❌ Nouvelles fonctionnalités cassent les tests
→ Ajouter des tests pour couvrir la nouvelle fonctionnalité
