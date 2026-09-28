import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  repo: {
    findById: vi.fn(),
    findExpiredPending: vi.fn(),
    findActiveForChallenge: vi.fn(),
    findProvisioningInProgress: vi.fn(),
    updateExpired: vi.fn(),
    updateFailed: vi.fn(),
    updateReady: vi.fn(),
    updateProvisioningStarted: vi.fn(),
  },
  getScalewayProvider: vi.fn(),
}));

vi.mock("../../database-service/repositories/index.js", () => ({
  ComputeRequestRepository: class {
    constructor() {
      return h.repo;
    }
  },
  ChallengeRepository: class {},
  ChallengeTeamRepository: class {},
}));
vi.mock("../../config/githubToken.js", () => ({
  encryptToken: vi.fn(() => ({ enc: "enc", iv: "iv" })),
  decryptToken: vi.fn(),
}));
vi.mock("../../config/scalewayCredentials.js", () => ({
  isScalewayUserFacingConnected: vi.fn(),
  getScalewayCredentials: vi.fn(),
}));
vi.mock("../../../content/extensions/compute/scaleway/provider.js", () => ({ scalewayProvider: h.getScalewayProvider }));

import { ComputeRequestService } from "./compute-request.service.js";

const provider = {
  provision: vi.fn(),
  getStatus: vi.fn(),
  deprovision: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  h.getScalewayProvider.mockResolvedValue(provider);
  provider.deprovision.mockResolvedValue(undefined);
});

describe("ComputeRequestService.sweepExpired", () => {
  it("déprovisionne une demande 'provisioning' expirée puis la marque expired", async () => {
    h.repo.findExpiredPending.mockResolvedValue([
      { uuid: "r-prov", status: "provisioning", provider_ref: "fr-par-2/srv-1" },
    ]);

    await new ComputeRequestService().sweepExpired();

    expect(provider.deprovision).toHaveBeenCalledWith("", "fr-par-2/srv-1");
    expect(h.repo.updateExpired).toHaveBeenCalledWith("r-prov", "timeout");
  });

  it("expire directement une demande 'approved' dont le provisioning n'a jamais démarré", async () => {
    h.repo.findExpiredPending.mockResolvedValue([{ uuid: "r-appr", status: "approved", provider_ref: null }]);

    await new ComputeRequestService().sweepExpired();

    expect(provider.deprovision).not.toHaveBeenCalled();
    expect(h.repo.updateExpired).toHaveBeenCalledWith("r-appr", "timeout");
  });

  it("ne marque pas expired quand le déprovisionnement échoue — le balayage suivant retentera", async () => {
    h.repo.findExpiredPending.mockResolvedValue([
      { uuid: "r-ready", status: "ready", provider_ref: "fr-par-2/srv-2" },
      { uuid: "r-other", status: "ready", provider_ref: "fr-par-2/srv-3" },
    ]);
    provider.deprovision.mockRejectedValueOnce(new Error("scaleway 500"));

    await new ComputeRequestService().sweepExpired();

    expect(h.repo.updateExpired).not.toHaveBeenCalledWith("r-ready", expect.anything());
    // Un échec n'arrête pas le balayage des autres lignes.
    expect(h.repo.updateExpired).toHaveBeenCalledWith("r-other", "timeout");
  });

  it("laisse active une instance existante quand Scaleway n'est plus connecté", async () => {
    h.getScalewayProvider.mockResolvedValue(null);
    h.repo.findExpiredPending.mockResolvedValue([
      { uuid: "r-ready", status: "ready", provider_ref: "fr-par-2/srv-2" },
    ]);

    await new ComputeRequestService().sweepExpired();

    expect(h.repo.updateExpired).not.toHaveBeenCalled();
  });
});

describe("ComputeRequestService.pollProvisioning", () => {
  it("détruit le serveur avant de marquer failed", async () => {
    h.repo.findProvisioningInProgress.mockResolvedValue([
      { uuid: "r-1", status: "provisioning", provider_ref: "fr-par-2/srv-9" },
    ]);
    provider.getStatus.mockResolvedValue("failed");

    await new ComputeRequestService().pollProvisioning();

    expect(provider.deprovision).toHaveBeenCalledWith("", "fr-par-2/srv-9");
    expect(h.repo.updateFailed).toHaveBeenCalledWith("r-1", expect.any(String));
    expect(provider.deprovision.mock.invocationCallOrder[0]).toBeLessThan(
      h.repo.updateFailed.mock.invocationCallOrder[0]
    );
  });

  it("garde la ligne en provisioning si la destruction échoue", async () => {
    h.repo.findProvisioningInProgress.mockResolvedValue([
      { uuid: "r-1", status: "provisioning", provider_ref: "fr-par-2/srv-9" },
    ]);
    provider.getStatus.mockResolvedValue("failed");
    provider.deprovision.mockRejectedValueOnce(new Error("scaleway 500"));

    await new ComputeRequestService().pollProvisioning();

    expect(h.repo.updateFailed).not.toHaveBeenCalled();
  });
});

describe("ComputeRequestService.startProvisioning", () => {
  it("détruit un serveur créé malgré un provisioning en échec", async () => {
    h.repo.findById.mockResolvedValue({ uuid: "r-1", challenge_id: "challenge-0001", user_id: "user-00000001" });
    provider.provision.mockResolvedValue({ status: "failed", ref: "fr-par-2/srv-half", error: "cloud-init" });

    await new ComputeRequestService().startProvisioning("r-1");

    expect(provider.deprovision).toHaveBeenCalledWith("", "fr-par-2/srv-half");
    expect(h.repo.updateFailed).toHaveBeenCalledWith("r-1", "cloud-init");
  });
});
