# Journal de Trading ICT/SMC

Journal de trading en un seul fichier (`index.html`), hébergé sur Netlify et synchronisé avec Supabase par code de synchro.

## Règles du dépôt

- `main` = la version en ligne, utilisée par deux personnes (chacune avec son propre code de synchro).
- Toute évolution passe par une branche et une adresse de test Netlify avant d'arriver sur `main`.
- Les données sont sauvegardées en bloc par `save_journal` : une évolution ne doit qu'**ajouter** des champs, jamais renommer ou supprimer, sans migration testée.

## Historique

- v2.0 · 02/10/2026 · version de référence importée depuis Netlify (déploiement du 02/10/2026).

## Garde-fous avancés (v2.1)

Désactivés par défaut, à activer dans **Réglages → Garde-fous avancés** (réglage propre à chaque code de synchro) :

- **Pause après perte selon la note du trade perdant** : A+ ou A sans écart = 5 min, B sans écart = 10 min, C, hors playbook ou écart = 30 min. Un trade pris pendant la pause est marqué en écart revanche, rien n'est bloqué.
- **Trade à plat compté tout de suite** dans les règles du jour, même avant capture et commentaires (compteur « à documenter »).
- **Alertes vocales** en français : pause, stop journée, fin de pause.
- **Personne de confiance** : e-mail via EmailJS quand le stop journée est forcé. Le destinataire est fixé dans le modèle EmailJS, jamais dans le journal. Variables du modèle : `{{prenom}}`, `{{heure}}`, `{{compte}}`, `{{motifs}}`, `{{raison}}`, `{{pnl_jour}}`, `{{pertes}}`, `{{trades}}`.
