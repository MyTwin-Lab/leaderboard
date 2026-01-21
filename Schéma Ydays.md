erDiagram
    USER ||--|| DISCORD_ACCOUNT : lie
    USER ||--o{ CONTRIBUTION : historique
    
    DISCORD_ACCOUNT ||--o{ MESSAGE : envoie
    
    MESSAGE ||--|| TRIGGER : declenche
    
    TRIGGER ||--|| EVALUATION : initie
    
    EVALUATION }o--|| AGENT : utilise
    EVALUATION ||--|| CONTRIBUTION : genere
    
    CONTRIBUTION {
        int score
        string raison
    }
