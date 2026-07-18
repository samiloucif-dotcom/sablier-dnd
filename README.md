# ⏳ Sablier D&D — « Votre première heure à l'école »

Petite application web à deux interfaces, synchronisées en temps réel.

## Lancer l'application

1. Installer [Node.js](https://nodejs.org) (une seule fois).
2. Ouvrir un terminal **dans ce dossier** (`sablier-app`).
3. Taper :

   ```
   node server.js
   ```

4. Les adresses s'affichent :
   - **Joueurs** : `http://localhost:3000/`
   - **MJ** : `http://localhost:3000/gm`

Aucune installation de dépendance n'est nécessaire.

## Jouer sur plusieurs appareils

Si les joueurs sont sur un autre écran/téléphone du **même Wi-Fi**, utilise
l'adresse `http://<ton-IP>:3000/` affichée au démarrage. Depuis la vue joueur,
le bouton « Interface MJ → » (en bas à droite) mène à ton panneau de contrôle.

## Interface joueur

Un sablier animé (le sable coule) sur une heure, avec une horloge numérique
discrète du temps restant. Les joueurs entendent une petite alerte sonore quand
un minuteur secret se termine ou quand le sablier est vide (mais ne voient ni les
minuteurs ni les rappels). Un tap sur « 🔔 Activer le son » débloque l'audio.

## Interface MJ

- **Sablier principal** : Pause / Reprendre, Reset, avancer (+1/+2/+5 min),
  reculer (−1/−2/−5 min).
- **Rappels** : ajoute par ex. « 30 min : barrière levée ». Quand le temps
  restant atteint ce seuil, une notification apparaît côté MJ avec le texte.
- **4 minuteurs secrets** : règle une durée, lance-les ; à la fin, alerte sonore
  côté MJ **et** côté joueurs (invisibles pour les joueurs autrement).

Tout est synchronisé automatiquement entre toutes les fenêtres ouvertes.
