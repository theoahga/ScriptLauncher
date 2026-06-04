# 🚀 Script Launcher

Une application desktop élégante pour lancer vos scripts stockés dans un dossier.

## Fonctionnalités

✨ **Interface moderne** - UI sympa et intuitive  
⚙️ **Support multi-scripts** - Bash, Python, JavaScript, Ruby, Perl, PowerShell, etc.  
📊 **Logs en temps réel** - Voir la sortie du script au fur et à mesure  
📁 **Dossier sélectionnable** - Choisissez le dossier contenant vos scripts  
🎯 **Cross-platform** - Windows, macOS, Linux  

## Installation

### Prérequis

- Node.js 14+ et npm
- (Optionnel) Python, Bash, ou autres interpréteurs selon vos scripts

### Étapes

1. **Cloner/Accéder au dossier du projet**
   ```bash
   cd /Users/theoclere/Claude/Projects/ScriptLauncher
   ```

2. **Installer les dépendances**
   ```bash
   npm install
   ```

## Utilisation

### Mode développement

Pour développer avec hot-reload :

```bash
npm start
```

Cela lance simultanément :
- Le serveur React sur http://localhost:3000
- L'application Electron

### Build production

Pour créer un exécutable :

```bash
npm run build
```

Les fichiers de distribution seront dans le dossier `dist/`

## Guide d'utilisation

1. **Sélectionner un dossier** : Cliquez sur le bouton "📂 Sélectionner un dossier"
2. **Choisir un script** : Cliquez sur un script dans la liste
3. **Exécuter** : Cliquez sur "▶️ Exécuter"
4. **Voir les résultats** : Les logs s'affichent en temps réel dans la console

## Types de scripts supportés

- `.sh` - Bash/Shell
- `.py` - Python
- `.js` - Node.js
- `.bat` - Batch (Windows)
- `.ps1` - PowerShell
- `.rb` - Ruby
- `.pl` - Perl
- Ou tout exécutable

## Structure du projet

```
ScriptLauncher/
├── public/
│   ├── electron.js        # Main process Electron
│   ├── preload.js         # Context isolation
│   └── index.html         # HTML template
├── src/
│   ├── App.js             # Composant principal
│   ├── App.css            # Styles principaux
│   └── components/
│       ├── FolderSelector.js    # Sélecteur de dossier
│       ├── ScriptList.js        # Liste des scripts
│       ├── ScriptExecutor.js    # Exécution et console
│       └── *.css                # Styles des composants
├── package.json           # Dépendances et scripts
└── README.md             # Ce fichier
```

## Dépannage

**Erreur "npm start" ne fonctionne pas ?**  
→ Assurez-vous que Node.js est installé : `node --version`

**L'app Electron ne se lance pas ?**  
→ Vérifiez que React démarre correctement (vérifiez http://localhost:3000)

**Les scripts ne s'exécutent pas ?**  
→ Vérifiez que vous avez la permission d'exécuter les scripts  
→ Sous Unix/Linux/macOS : `chmod +x script.sh`

## Développement

### Ajouter une dépendance

```bash
npm install nom-du-package
```

### Modifier l'interface

Les fichiers React sont dans `src/components/`

### Modifier le main process Electron

Modifiez `public/electron.js` et redémarrez l'app

## Licence

MIT

---

**Questions ou suggestions ?** Améliez l'app selon vos besoins ! 🎉
