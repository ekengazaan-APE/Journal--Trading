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
- v2.5 · 07/10/2026 · niveaux automatiques : la page Top-down affiche, pour MNQ, MES, MYM et MGC, les PDH, PDL, PWH, PWL, hauts et bas Asie et Londres, NWOG, EQH et EQL calculés par la fonction `/api/levels` (prix CME Massive, retard de 8 h), avec leur état intact ou pris et le dernier prix connu. Le bouton + ajoute un niveau dans les niveaux clés de l'unité de temps correspondante.
- v2.6 · 07/10/2026 · top-down automatique : marqueurs macro (DXY, taux à 10 et 2 ans, VIX, FedWatch, WTI, peur et cupidité), analyses économique, fondamentale et géopolitique, annonces déjà sorties, lus dans `data/contexte/<semaine>.json` (écrit par les tâches « Contexte Top-down », jamais dans le journal) ; calendrier de la semaine en direct et fenêtres sans entrée croisées avec les sessions. Les cases personnelles restent en dessous (« Ton avis »).
- v2.7 · 13/10/2026 · bilan de fin de session : après chaque session tradée (et après la session NY, même sans trade), une fiche dans Aujourd'hui avec les chiffres calculés (plan respecté, trades, R, P&L, écarts) et tes réponses (état émotionnel de 1 à 5, erreurs, leçon), stockée dans `tj_bilans` et reprise dans la revue de la semaine. Statistiques en R : R total, espérance, réussite, seuil de rentabilité, par note, par setup, par session et coût des écarts. Préréglages : 1R à 250 $, stop journée à 500 $ et frais Lucid (1 $ aller-retour sur MNQ, MES et MYM, 1,60 $ sur MGC). Checklist OPR Asian MGC remplie (8 critères, 7 obligatoires) si elle est encore vide.
- v2.8 · 13/10/2026 · synchro sûre : l'envoi passe par `save_journal_v2`, refusé si le cloud a changé depuis la dernière version lue par l'appareil ; une fenêtre propose alors de garder le cloud ou cet appareil (avec export conseillé), rien n'est écrasé en silence. Repli automatique sur `save_journal` si la fonction manque. Codes lecture seule (`get_journal_lecture`) pour les rapports automatiques, gérés dans Sauvegarde et synchro (créer, lister par leurs 4 derniers caractères, révoquer) ; ils suivent le journal quand le code de synchro change. SQL dans `supabase/20261013_synchro_sure.sql`.
- v2.9 · 14/10/2026 · import Tradovate testé sur de vrais exports : prix exacts (et non arrondis), ordres rattachés au bon trade par leur numéro, stop remonté au BE reconnu (le SL de départ reste à saisir), exécutions réelles reprises quand un prix moyen tombe hors tick. Un trade importé à plat compte tout de suite dans le solde, le MLL et les règles du jour, même sans garde-fous avancés ; il n'est pas noté hors playbook tant qu'il n'est pas documenté. Checklist OPR : taille en ticks MGC et critère du SL.
- v2.9.1 · 14/10/2026 · le contexte Top-down est écrit sur la branche `contexte` et lu sur raw.githubusercontent.com : les mises à jour quotidiennes ne consomment plus de crédits Netlify (15 par mise en ligne, 300 par mois sur le plan gratuit).
- v2.9.2 · 15/10/2026 · checklist OPR : SL obligatoire dans l'OPR, sur la bougie de cassure ou sous une liquidité (mèche, gap) si elle est trop courte. Bouton dans Réglages pour remplacer une checklist OPR personnelle par la version détaillée (l'ancienne est gardée en copie).
- v2.9.3 · 15/10/2026 · import Tradovate sans doublon entre fichiers : un trade déjà importé depuis les Ordres n'est pas réimporté depuis la Performance (et inversement), reconnu par contrat, sens et heure d'entrée à 5 secondes près.

## Garde-fous avancés (v2.1)

Désactivés par défaut, à activer dans **Réglages → Garde-fous avancés** (réglage propre à chaque code de synchro) :

- **Pause après perte selon la note du trade perdant** : A+ ou A sans écart = 5 min, B sans écart = 10 min, C, hors playbook ou écart = 30 min. Un trade pris pendant la pause est marqué en écart revanche, rien n'est bloqué.
- **Trade à plat compté tout de suite** dans les règles du jour, même avant capture et commentaires (compteur « à documenter »).
- **Alertes vocales** en français : pause, stop journée, fin de pause.
- **Personne de confiance** : e-mail via EmailJS quand le stop journée est forcé. Le destinataire est fixé dans le modèle EmailJS, jamais dans le journal. Variables du modèle : `{{prenom}}`, `{{heure}}`, `{{compte}}`, `{{motifs}}`, `{{raison}}`, `{{pnl_jour}}`, `{{pertes}}`, `{{trades}}`.
