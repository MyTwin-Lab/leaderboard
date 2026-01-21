```mermaid
erDiagram
    %% Entités principales
    USER {
        string internal_id PK
        int total_points
    }
    
    DISCORD_ACCOUNT {
        string discord_id PK
        string username
    }

    AGENT {
        string model_name
        string version
    }

    %% Le Flux de conversation
    CONVERSATION ||--|{ MESSAGE : contient
    DISCORD_ACCOUNT ||--o{ MESSAGE : envoie

    %% Le service back end
    API ||--|{ CONVERSATION : parse
    API ||--|{ EVALUATION : envoie_data
    
    %% Le Trigger
    MESSAGE ||--o| TRIGGER : declenche
    TRIGGER ||--|| EVALUATION : lance

    %% L'Evaluation
    AGENT ||--|| EVALUATION : realise
    EVALUATION ||--|| SCORE : calcule

    %% La liaison finale et stockage
    USER ||--|| DISCORD_ACCOUNT : own
    USER ||--o{ SCORE : recoit
```

## Elements à prendre en compte

Trigger merci en français et en anglais + liste de synonyme & formulation
Délimitation de l'historique des conversations discord -> bien définir les id helper&beneficiary 
-> recherche de mots clés possibles tels que : problèmes, comment, pourquoi, besoin d'aide, ... (fr et eng)





