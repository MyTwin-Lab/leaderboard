# MyTwin Lab — Sync Meetings

## SPEC — Spécification technique détaillée

### 1. Acteurs & composants

**Frontend MyTwin Lab**
- Création et gestion des Sync Meetings
- Affichage des réunions passées / à venir
- Visualisation des résumés et contributions issues des meetings

**Backend MyTwin Lab**
- Orchestration Google APIs
- Stockage des entités métier
- Lancement des jobs d’analyse IA

**Google Workspace (Organisation MyTwin Lab)**
- Google Calendar
- Google Meet
- Google Drive

**Agent IA Sync Meeting**
- Résumé
- Extraction décisions / actions
- Attribution par participant
- Génération de signaux de contribution

---

### 2. Authentification & identité

#### 2.1 OAuth Google
Chaque utilisateur MyTwin Lab doit :
- connecter son compte Google,
- autoriser les scopes nécessaires (Calendar, Meet read, Drive meet readonly).

#### 2.2 Mapping d’identité
- `MyTwinUser`
- `GoogleAccount`
  - googleUserId (clé primaire d’identification)
  - displayName

L’email **n’est pas requis** pour l’identification logique.

---

### 3. Création d’un Sync Meeting

1. L’utilisateur crée un Sync Meeting depuis MyTwin Lab
2. Le backend :
   - crée un événement Google Calendar
   - génère un lien Google Meet
   - définit un **host MyTwin Lab** (compte Workspace dédié)
3. Les participants sont invités via Google Calendar

Entité créée :
```ts
SyncMeeting {
  id
  title
  description
  projectId
  startTime
  endTime
  meetLink
  calendarEventId
  status: scheduled | completed | processed
}
```

---

### 4. Déroulement du meeting

- Tous les participants rejoignent via leur compte Google
- Le host MyTwin Lab démarre la réunion
- La transcription est activée (paramètres Workspace)
- Aucun bot ne rejoint la réunion

---

### 5. Post‑meeting : récupération des artefacts

#### 5.1 Détection de fin de meeting
- Polling ou webhook Calendar / Meet
- Passage du SyncMeeting en `completed`

#### 5.2 Meet API
Récupération :
- `ConferenceRecord`
- `Participants`
- `ParticipantSessions`
- `Transcripts`
- `TranscriptEntries`

Chaque `TranscriptEntry` contient :
- texte
- timestamp
- référence participant

---

### 6. Modèle de données principal

```ts
MeetingParticipant {
  id
  syncMeetingId
  googleUserId
  displayName
}

Utterance {
  id
  syncMeetingId
  participantId
  startTime
  endTime
  text
}
```

---

### 7. Agent IA Sync Meeting

#### Input
- Liste des participants
- Transcription segmentée par participant
- Contexte projet (facultatif)

#### Traitements
- Résumé global
- Décisions clés
- Actions identifiées
- Attribution des actions
- Détection de signaux de contribution

#### Output
```json
{
  "summary": "...",
  "decisions": [...],
  "actions": [...],
  "contributionSignals": [
    { "userId": "...", "type": "coordination", "weight": 0.3 }
  ]
}
```

---

### 8. Intégration Leaderboard

Les signaux issus des Sync Meetings :
- ne sont pas des contributions primaires,
- servent de **soft signals**,
- pondérés faiblement,
- cumulables avec d’autres sources (code, feedback, review, etc.).

---

### 9. Privacy & gouvernance

- Opt‑in explicite lors de la participation
- Mention claire dans l’invitation
- Aucune utilisation à des fins d’évaluation individuelle
- Transparence totale des outputs visibles par les participants