erDiagram
USER ||--|| DISCORD_ACCOUNT : lie
USER ||--o{ CONTRIBUTION : recoit
USER ||--|| SCORE : possede


DISCORD_ACCOUNT ||--o{ MESSAGE : envoie
DISCORD_ACCOUNT ||--o{ CONVERSATION : participe


CONVERSATION ||--o{ MESSAGE : contient


MESSAGE }o--|| TRIGGER : declenche
TRIGGER ||--|| EVALUATION : lance


EVALUATION }o--|| AGENT : realise
EVALUATION ||--|| SCORE : attribue


SCORE }o--|| USER : appartient_a