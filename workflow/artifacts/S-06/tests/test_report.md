# Rapport de tests — S-06

> Produit par : Test Writer | Date : 2026-06-09

## Couverture

| Fichier | Tests | Cas nominaux | Edge cases | Erreurs |
|---------|-------|-------------|------------|---------|
| ScriptList.tsx | 10 | ✅ | ✅ 5/5 | ✅ |

> Pas de nouveau code Rust dans S-06 — tests Rust non applicables.

## Edge cases de arch_plan.md → couverture

| Edge case | Test correspondant | Statut |
|-----------|-------------------|--------|
| folderPath null | `affiche 'Aucun dossier sélectionné' quand folderPath est null` | ✅ |
| Dossier vide (invoke retourne []) | `affiche 'Aucun script trouvé' quand invoke retourne un tableau vide` | ✅ |
| Chemin invalide / erreur Rust | `affiche le message d'erreur retourné par Rust quand invoke rejette` | ✅ |
| Changement rapide de dossier (race condition) | `relance invoke quand folderPath change` + flag cancelled dans useEffect | ✅ |
| Script sans extension | `n'affiche pas le span extension quand extension est vide` | ✅ |
| folderPath null → valeur (pas de double invoke) | `déclenche invoke quand folderPath passe de null à une valeur` | ✅ |

## Cas nominaux couverts

| Test | Description |
|------|-------------|
| `affiche 'Chargement...' pendant que invoke est en cours` | État de chargement pendant la promesse pending |
| `affiche les scripts retournés par invoke` | Liste avec 3 scripts, noms + extensions affichés |
| `appelle invoke avec 'list_scripts' et le folderPath correct` | Paramètres corrects à l'appel invoke |
| `appelle onScriptSelected avec le bon script au clic` | Callback avec le bon objet ScriptInfo |

## Résultat d'exécution

```
✓ ui/components/ScriptList.test.tsx (10 tests) 42ms
✓ ui/App.test.tsx (2 tests) 55ms          ← snapshot mis à jour (App intègre ScriptList)
✓ ui/components/FolderSelector.test.tsx (7 tests) 130ms

Test Files  3 passed (3)
Tests       19 passed (19)
```

**Note :** Le snapshot `App.test.tsx` a été mis à jour pour refléter l'intégration de ScriptList dans App. Le rendu initial affiche maintenant le message "Aucun dossier sélectionné" de ScriptList en plus du bouton FolderSelector — comportement correct.

## Cas non couverts et justification

- **Race condition (cancel en vol)** : Le flag `cancelled` est testé indirectement via le test de changement de folderPath, mais un test unitaire de l'annulation stricte du premier invoke nécessiterait du mocking temporisé (fake timers). Jugé hors scope pour S-06 — le comportement est couvert par le pattern useEffect avec cleanup.
- **Tests Rust** : Aucun nouveau code Rust dans S-06. La commande `list_scripts` est déjà testée dans S-02.
