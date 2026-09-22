## Context

A contributor should not have to invent a password to be recognised for their work.

Everything the Lab counts already happened somewhere else — commits on GitHub, an identity on Google. Asking someone to create a ninth account before they can be credited for the eighth is the shortest way to lose them on the first screen.

Signing in has a second job here, less visible than the first: it links the account to the GitHub username the ledger already credits, so a contribution made before signing up finds its author.

## Objective

What has to be shipped:

- Google sign-in, with a session that survives a reload and expires on its own terms.
- The GitHub account connected to the profile, and the existing ledger entries reconciled with it.
- A clear state for someone who has signed in but not connected GitHub yet — they can read, they cannot push.

## Expected result

- A pull request from your branch, with the board reflecting what it contains.
- The sign-in path walked end to end on a fresh account, and on an account whose contributions predate it.
