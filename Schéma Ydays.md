graph TD
    subgraph Discord
        U1[User] -- "Ecrit" --> M[Message]
        M -- "Contient" --> C[Conversation]
    end

    subgraph Backend
        M -- "Déclenche" --> T[Trigger]
        T -- "Lance" --> E[Evaluation]
        A[Agent IA] -- "Réalise" --> E
        E -- "Attribue" --> S[Score]
    end

    subgraph BDD
        S -- "Est stocké dans" --> H[Historique]
        H -- "Met à jour" --> P[Profil User]
    end
    
    style T fill:#f9f,stroke:#333
    style A fill:#bbf,stroke:#333
    style P fill:#bfb,stroke:#333
