# Leaderboard Challenge Specification
## 1. Context & objective

- **Identified problem:** Lack of clear contribution tracking within the Lab, and a need for recognition and gamification.
- **Project objective:** Implement a **Leaderboard** that centralizes, evaluates, and ranks contributions, while providing a back office for managing projects and challenges.
- **Expected value:** Transparency, engagement, and contributor recognition.

## 2. Global architecture

<img width="1794" height="1042" alt="Simplified Architecture" src="https://github.com/user-attachments/assets/b710232e-f0e8-4721-a475-63bc1e179c29" />

### Key components :

- **Leaderboard Client** → Interface allowing contributors to view the leaderboard.
- **Admin Dashboard** → Interface allowing admins to manage projects, challenges, associated repositories, contributor lists, and trigger the Evaluator Agent.
- **Evaluator Agent** → AI agent responsible for evaluating contributions (scoring) and assigning contribution points (rewards).
- **Database**
- **GitHub & Google Drive external source connectors**

## 4. Evaluator Agent

The **Evaluator Agent** automatically analyzes contributions, assigns them a score, and converts those scores into **Contribution Points (CP)** at the end of each challenge.

It is triggered at two key stages of a challenge: during each **Sync meetings** and at the **end of the Challenge**.

- **Sync → Contribution Scoring**
    - **Goal:** Identify new contributions since the last Sync and assign them a raw score (0–100).
    - **Steps:**
        1. The **“Contribution Identifier”** function detects new contributions from provided data sources (GitHub, Sync summary) and links them to the corresponding users.
        2. The **“Contribution Scoring”** function applies a weighted evaluation grid (adapted by contribution type) to assign a normalized raw score (0–100) to each contribution.
        3. Contributions are stored until the end of the challenge.
- **End of Challenge → Contributor Rewards**
    - **Goal:** Convert all accumulated scores during the challenge into Contribution Points (CP).
    - **Steps:**
        1. The **“Compute Rewards”** function converts all accumulated scores into CP. The total reward pool defined for the challenge is distributed proportionally based on each contribution’s score, and the leaderboard is updated accordingly.

## 5. Detailed Specification

https://www.figma.com/design/gJxnKgzitRSFafc07AXrKj/MyTwin-Lab?node-id=0-1&t=tXMaGySkpTL2gLgZ-1
