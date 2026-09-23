## Context

A radiologist reads a mammogram in under a minute, several hundred times a week.

Screening works because it is done at scale, and it is fragile for the same reason: the lesions that get missed are rarely the obvious ones, they are the ones read at the end of a long list. A second reader halves that risk, and there are not enough second readers.

A model that flags the images worth a second look does not replace anyone. It changes the order in which the list is read — which is the part of the process nobody currently controls.

## Objective

What has to be shipped:

- A detection model trained on the challenge's annotated mammograms, scoring each image rather than sorting it.
- A threshold analysis: what the model costs in false positives at the sensitivity screening actually requires.
- A view of the flagged region, so a radiologist can see what the model saw instead of taking its word.

## Expected result

- A pull request from your branch, with the board reflecting what it contains.
- Measured sensitivity and specificity against the reference set, reported at the operating point you recommend and at two others.
