# Leaderboard – Follow-Up Contributions & PR Trigger Specifications
## **1. Context & Objective**

- **Identified problem:** The current system does not distinguish between new contributions and contributions that extend an existing piece of work.
- **Project objective:**
    - Introduce an automatic mechanism for detecting *follow-up contributions*.
    - Dynamically update evaluations when new versions of a contribution appear.
    - Integrate a new trigger based on GitHub Pull Requests.
- **Expected value:**
    - Cleaner contribution history.
    - Consistent evaluations continuously updated.
    - Smoother GitHub integration for challenge workflows.

---

## **2. Global Architecture**

The main components remain the same:

- **Identification Agent** → Extracts raw contributions from sources (GitHub, PRs, etc.).
- **Merge  Agent** → New LLM responsible for determining whether a contribution follows another implemented in the actual Evaluator pipeline.
- **Evaluation Agent** → Evaluates contributions. Now supports a follow-up mode.
- **Database** → Stores contributions, and their evaluation grids.
- **Admin Dashboard** → Enables trigger activation/deactivation and manual execution of processes.

---

## **3. Merge Agent (Deduplication or Follow-up)**

The Merge Agent receives:

- Contributions recently identified by the Identification Agent.
- Existing contributions for the challenge (from the database).

### **Goal**

For each contribution, determine whether:

- It is **new** → `contributionParentId = null`
- It is a **follow-up** → `contributionParentId = <UUID of the existing contribution>`

### **Rules**

- Matching is done exclusively by the LLM, it determines the relationship based on:
    - User
    - Roadmap step
    - Title
    - Description

### **Output**

A list of enriched contribution objects:

```
{
  contribution: Contribution,
  contributionParentId: string | null
}
```

This output is sent to the evaluation service.

---

## **4. Follow-Up Evaluations**

The Evaluation Agent now supports two modes:

### **4.1 Standard mode (new contribution)**

- Uses the standard V1 evaluation grid.
- Produces a complete and independent evaluation grid.

### **4.2 Follow-up mode**

When `toMerge = true`:

- The agent receives **the new contribution** + **the previous evaluation grid and contribution**.
- The previous grid is provided in the context as structured data.
- The agent generates a **new full evaluation grid**, which **replaces** the parent contribution’s existing grid.
- Contributions are never deleted; only the evaluation grid evolves.

---

## **5. Database Updates**

The storage logic is as follows:

- Contributions remain stored individually.
- When a follow-up is detected, only the *evaluation grid* of the parent contribution is updated.

No version history of evaluation grids is kept.

---

## **6. PR-based Trigger (GitHub)**

A new mechanism executes the entire workflow based on a Pull Request.

### **Process**

1. A PR is closed toward the challenge branch.
2. The GitHub webhook triggers the Challenge Service.
3. The system retrieves **the commits from the PR branch**.
4. Standard pipeline execution:
    - Identification Agent
    - Follow-Up Agent
    - Evaluation Agent
5. Contributions are persisted the same way as for other triggers.

### **Rules**

- The PR triggers the process **only once**.
- No trigger execution history is stored.

---

## **7. Trigger Management (Admin)**

The Admin Dashboard now supports:

- **Global activation/deactivation** of automatic triggers:
    - GitHub PR trigger
    - (Other existing triggers)
- **Manual trigger execution** (Sync mode):
    - Uses the standard pipeline: identification → follow-up → evaluation.
    - Remains the default behaviour of the system.

No history of trigger executions is stored.