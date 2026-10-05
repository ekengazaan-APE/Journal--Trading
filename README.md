# Journal de Trading ICT/SMC

Journal de trading en un seul fichier (`index.html`), hébergé sur Netlify et synchronisé avec Supabase par code de synchro.

## Règles du dépôt

- `main` = le journal d'Azaan, à l'adresse principale. Depuis le 05/10/2026, il évolue pour lui seul.
- `ami/` = l'ancienne version du journal de son ami (déploiement Netlify du 31/08/2026, avant la v2.0), servie à l'adresse `/ami/` du même site. Même domaine : ses données locales et son code de synchro restent valables. On n'y touche plus sauf demande.
- Toute évolution passe par une branche et une adresse de test Netlify avant d'arriver sur `main`.
- Les données sont sauvegardées en bloc par `save_journal` : une évolution ne doit qu'**ajouter** des champs, jamais renommer ou supprimer, sans migration testée.

## Historique

- v2.0 · 02/10/2026 · version de référence importée depuis Netlify (déploiement du 02/10/2026).
- v2.1 · 02/10/2026 · garde-fous avancés (pause selon la note, voix, personne de confiance).
- v2.2 · 03/10/2026 · garde-fou news (calendrier économique, fenêtre sans entrée).
- v2.3 · 05/10/2026 · navigation en 7 rubriques avec onglets (aucune page supprimée), lisibilité : tailles de texte relevées (12 px minimum), gris secondaire `#8080a8` (contraste 4,9 à 5,4 pour 1), libellés en casse normale avec acronymes ICT conservés. Check de forme avant chaque session (sommeil, énergie, calme) : vert, orange (demi-taille, A+ uniquement, 1 trade max) ou rouge (session déconseillée, un trade pris est noté en écart « trade malgré une forme rouge »). Seuils réglables, 6 h pour un vert et 5 h minimum par défaut.
- v2.4 · 05/10/2026 · import Tradovate : exports CSV Ordres et Performance, trades reconstruits en FIFO, SL et TP initiaux lus dans les ordres stop et limite, contrôle du P&L avec la performance, aperçu avant import, doublons ignorés. Les trades importés arrivent « à documenter ».

## Garde-fous avancés (v2.1)

Désactivés par défaut, à activer dans **Réglages → Garde-fous avancés** (réglage propre à chaque code de synchro) :

- **Pause après perte selon la note du trade perdant** : A+ ou A sans écart = 5 min, B sans écart = 10 min, C, hors playbook ou écart = 30 min. Un trade pris pendant la pause est marqué en écart revanche, rien n'est bloqué.
- **Trade à plat compté tout de suite** dans les règles du jour, même avant capture et commentaires (compteur « à documenter »).
- **Alertes vocales** en français : pause, stop journée, fin de pause.
- **Personne de confiance** : e-mail via EmailJS quand le stop journée est forcé. Le destinataire est fixé dans le modèle EmailJS, jamais dans le journal. Variables du modèle : `{{prenom}}`, `{{heure}}`, `{{compte}}`, `{{motifs}}`, `{{raison}}`, `{{pnl_jour}}`, `{{pertes}}`, `{{trades}}`.
