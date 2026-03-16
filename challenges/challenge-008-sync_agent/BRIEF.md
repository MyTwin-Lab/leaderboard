# MyTwin Lab — Sync Meetings

## BRIEF

### Contexte
MyTwin Lab est un environnement de collaboration semi–open source où des contributeurs travaillent de manière organique sur des projets (code, design, recherche, produit, contenu…).

Dans ce cadre, les **Sync Meetings** sont des réunions régulières destinées à :
- synchroniser l’avancement des projets,
- partager des décisions et des idées,
- faire émerger des actions concrètes,
- nourrir le knowledge graph du Lab.

Ces réunions doivent être **organisées depuis l’interface MyTwin Lab**, et devenir des **objets structurés**, exploitables par un agent IA pour enrichir le système de contribution et le leaderboard.

---

### Problème
Aujourd’hui, les réunions (Google Meet, Zoom, etc.) sont :
- éphémères,
- peu structurées,
- difficiles à relier aux contributions individuelles,
- rarement exploitables après coup.

Les enjeux clés sont :
- identifier de manière fiable les participants,
- savoir *qui a dit quoi*,
- automatiser la transcription et le résumé,
- rattacher les signaux issus des réunions au système de contributions MyTwin Lab,
- éviter toute dépendance à un agent humain ou à une IA temps réel fragile.

---

### Solution
Mettre en place un **workflow de Sync Meetings Google Meet natif**, orchestré par MyTwin Lab, basé sur :
- Google Workspace + Google Meet,
- authentification Google obligatoire des participants,
- récupération post‑meeting des artefacts (participants, transcripts),
- un **Agent IA MyTwin Lab** chargé de transformer chaque réunion en :
  - résumé structuré,
  - décisions,
  - actions,
  - signaux de contribution par participant.

Les Sync Meetings deviennent ainsi des **nœuds actifs du Lab**, exploitables de manière asynchrone et scalable.