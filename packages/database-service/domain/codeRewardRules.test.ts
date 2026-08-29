import { describe, it, expect } from "vitest";
import {
  parseCodeRewardRules,
  DEFAULT_CODE_REWARD_RULES,
  codeRewardRulesSchema,
} from "./codeRewardRules.js";

describe("parseCodeRewardRules", () => {
  it("parses valid v1 rules", () => {
    const rules = { version: 1, delivery: { fixed: 50, cap: 150 } };
    expect(parseCodeRewardRules(rules)).toEqual(rules);
  });

  it("returns null for null/undefined", () => {
    expect(parseCodeRewardRules(null)).toBeNull();
    expect(parseCodeRewardRules(undefined)).toBeNull();
  });

  it("returns null for ML-shaped rules", () => {
    // Des règles ML valides ne doivent pas passer pour des règles code.
    expect(
      parseCodeRewardRules({
        version: 1,
        dataset: { cap: 300 },
        model: { cap: 500, kaggleShare: 0.5, metric: { name: "auc", baseline: 0.5 }, beatBestBonus: 50 },
        apiPackaging: { cap: 200 },
        reuse: { datasetShare: 0.2, modelShare: 0.2, minKeepShare: 0.5 },
      })
    ).toBeNull();
  });

  it("rejects negative amounts", () => {
    expect(parseCodeRewardRules({ version: 1, delivery: { fixed: -1, cap: 100 } })).toBeNull();
  });

  it("has a valid default", () => {
    expect(codeRewardRulesSchema.safeParse(DEFAULT_CODE_REWARD_RULES).success).toBe(true);
  });
});
