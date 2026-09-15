import { describe, it, expect } from "vitest";
import { proposalFieldsFromLegacyColumns, proposalFieldsPatch, sandboxProposalOf } from "./legacyProposalFields.js";

const ML_COLUMNS = {
  repo_url: "https://github.com/alice/lungs",
  model_url: "https://kaggle.com/models/alice/lungs",
  dataset_urls: ["https://kaggle.com/datasets/alice/xrays"],
};

describe("proposalFieldsFromLegacyColumns", () => {
  it("carries the three columns, with the same defaults as the migration", () => {
    expect(proposalFieldsFromLegacyColumns(ML_COLUMNS)).toEqual(ML_COLUMNS);
    expect(proposalFieldsFromLegacyColumns({ repo_url: "https://github.com/bob/app", model_url: null, dataset_urls: null })).toEqual({
      repo_url: "https://github.com/bob/app",
      model_url: null,
      dataset_urls: [],
    });
  });
});

describe("proposalFieldsPatch", () => {
  it("keeps only the keys an edit provides, null included", () => {
    expect(proposalFieldsPatch({ model_url: null })).toEqual({ model_url: null });
    expect(proposalFieldsPatch({})).toEqual({});
    expect(proposalFieldsPatch({ repo_url: "https://github.com/bob/app", dataset_urls: [] })).toEqual({
      repo_url: "https://github.com/bob/app",
      dataset_urls: [],
    });
  });
});

describe("sandboxProposalOf", () => {
  it("reads the proposal from proposal_fields when it is there", () => {
    const proposal = sandboxProposalOf({
      ...ML_COLUMNS,
      proposal_fields: { ...ML_COLUMNS, model_url: null, dataset_urls: ["https://kaggle.com/datasets/alice/ct"] },
    });

    expect(proposal.model_url).toBeNull();
    expect(proposal.dataset_urls).toEqual(["https://kaggle.com/datasets/alice/ct"]);
    expect(proposal.proposal_fields.model_url).toBeNull();
  });

  it("falls back to the columns for a row the previous code wrote without proposal_fields", () => {
    const proposal = sandboxProposalOf({ ...ML_COLUMNS, proposal_fields: {} });

    expect(proposal).toEqual({ ...ML_COLUMNS, proposal_fields: ML_COLUMNS });
  });

  it("falls back key by key when an edit only wrote some of them", () => {
    const proposal = sandboxProposalOf({ ...ML_COLUMNS, proposal_fields: { repo_url: "https://github.com/alice/lungs-v2" } });

    expect(proposal.repo_url).toBe("https://github.com/alice/lungs-v2");
    expect(proposal.model_url).toBe(ML_COLUMNS.model_url);
    expect(proposal.dataset_urls).toEqual(ML_COLUMNS.dataset_urls);
  });

  it("keeps the keys a flow may add that no column carries", () => {
    const proposal = sandboxProposalOf({ ...ML_COLUMNS, proposal_fields: { ...ML_COLUMNS, notebook_url: "https://kaggle.com/code/alice/eda" } });

    expect(proposal.proposal_fields.notebook_url).toBe("https://kaggle.com/code/alice/eda");
  });
});
