## Context

Breast cancer screening relies on radiologists reading millions of mammograms a year, and reader workload is a real bottleneck. Open datasets like CBIS-DDSM make it possible to build classification models in the open - but most published work stops at a notebook. This challenge is about producing a model that is reproducible, honestly evaluated, and usable downstream: a building block for a clinical validation phase, not a leaderboard trick.

## Objective

What has to be shipped:

- Fine-tune an open-source model to classify mammograms as normal / benign / malignant (or by BI-RADS category), trained exclusively on public datasets
- Reach the best AUC you can on the evaluation setup, starting from CBIS-DDSM as the baseline dataset
- Keep the full pipeline reproducible: anyone should be able to retrain your model from your code and your dataset alone

## Expected result

What a reviewer should receive at the end, submitted step by step from the ML workspace:

- A Kaggle dataset: the curated training data, with its sources and preparation documented
- A Kaggle model with its reported AUC
- A GitHub repo with the full training code (data loading, training, evaluation)
- A GitHub repo packaging the model as a callable API