## Context

Classification tells you *that* something is suspicious - segmentation tells you *where*. Pixel-level lesion masks are what make a model's output actually usable by a radiologist: they can be overlaid on the image, checked against what the reader sees, and reused downstream for measurement or follow-up. Public datasets like CBIS-DDSM ship ROI annotations, which makes open, reproducible segmentation work possible. This challenge is the localization counterpart of the classification challenge, feeding the same clinical validation phase.

## Objective

What has to be shipped:

- Fine-tune an open-source segmentation model to delineate lesions on mammograms at pixel level, producing a binary or per-lesion mask, trained exclusively on public datasets
- Reach the best Dice / IoU you can on the evaluation setup, starting from CBIS-DDSM and its ROI annotations as the baseline dataset
- Keep the full pipeline reproducible: anyone should be able to retrain your model from your code and your dataset alone

## Expected result

What a reviewer should receive at the end, submitted step by step from the ML workspace:

- A Kaggle dataset: the curated training data with masks, sources and preparation documented
- A Kaggle model with its reported Dice / IoU
- A GitHub repo with the full training code (data loading, training, evaluation)
- A GitHub repo packaging the model as a callable API - image in, mask out