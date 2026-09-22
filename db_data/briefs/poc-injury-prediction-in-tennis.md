## Context

A tennis injury is diagnosed the week after it ended a season.

The warning signs are in the data long before that: serve speed drifting down, recovery times stretching, one side of the court covered less than the other. Nobody watches them together, because nobody has put them in the same table.

This proof of concept asks whether the signal is strong enough to act on — not whether a model can be built, but whether its output would change what a coach does on a Tuesday.

## Objective

What has to be shipped:

- A feature table built from match and training data: load, recovery, movement asymmetry, session history.
- A model that flags the players at risk over the coming weeks, with a calibrated score rather than a yes/no.
- An honest read of what the model does not see — the injuries it has no chance of catching.

## Expected result

- A pull request from your branch, with the board reflecting what it contains.
- A short report: which features carry the signal, measured performance, and whether this is worth taking past a proof of concept.
