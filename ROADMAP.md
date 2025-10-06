## Team

- **Antoine** - Software Engineer
- **Alix** - Software Engineer
- **Capson** - Software Engineer

## Steps

### **Phase 1 – Domain & Data Models**

- **Team**
  - Alix
  - Antoine
- **1.1** Define TypeScript domain entities.
- **1.2** Define Zod validation schemas to secure data flows.
- Sync Meeting ()

### **Phase 2 – Interfaces**

- **Team**
  - Alix
  - Capson
  - Antoine
- **2.1** Define service and package interfaces:
    - Database
    - External connectors (GitHub, Google Drive)
    - Evaluator Agent
    - Leaderboard Client
    - Admin Dashboard

### **Phase 3 – Database Service**

- **Team**
  - Capson
  - Alix
- **3.1** Implement DB models with Drizzle.
- **3.2** Implement DB access functions (CRUD).
- **3.3** Add object validation with Zod to secure data flows.

### **Phase 4 – Connectors Implementation**

- **Team**
  - Alix
- **4.1** Implement GitHub event extraction (commits only, over a given period).
- **4.2** Implement Google Drive document extraction (Sync summary).

### **Phase 5 – Evaluator Agent**

- **Team**
  - Alix
  - Antoine
- **5.1** Function “Contribution Identifier”
    - Define instructions.
    - Implement the contribution identification agent.
- **5.2** Function “Contribution Scoring”
    - Define evaluation grids for each type (weighted criteria).
    - Define instructions.
    - Implement the contribution scoring agent.
- **5.3** Function “Compute Rewards”
    - Implement the reward allocation function that converts scores into contribution points.
- **5.4** Implement the overall evaluation workflow.
- Sync Meeting ()

### **Phase 6 – UI**

- **Team**
  - Capson
- **6.1** Leaderboard Client
- **6.2** Admin Dashboard
- Sync Meeting ()
