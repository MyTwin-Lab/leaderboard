import { describe, it, expect } from "vitest";
import { buildGroupInviteDraft } from "./notification.repo.js";

const INPUT = {
  recipientId: "user-2",
  challengeId: "challenge-1",
  challengeTitle: "Collaboration Patterns",
  groupToken: "group-abc",
  fromUserId: "user-1",
  fromName: "Camille Daverio",
};

describe("buildGroupInviteDraft", () => {
  it("addresses the notification to the recipient", () => {
    const draft = buildGroupInviteDraft(INPUT);

    expect(draft.user_id).toBe("user-2");
    expect(draft.type).toBe("group_invite");
  });

  it("puts the group token in dedupe_key so two invites cannot stack", () => {
    expect(buildGroupInviteDraft(INPUT).dedupe_key).toBe("group-abc");
  });

  it("denormalises the challenge title and the inviter name into the payload", () => {
    // Dénormalisé volontairement : la notification est la trace de ce qui était
    // vrai à l'envoi. La re-joindre à un challenge renommé depuis réécrirait
    // l'histoire, et ajouterait une jointure à une liste lue à chaque
    // affichage du profil.
    expect(buildGroupInviteDraft(INPUT).payload).toEqual({
      challengeId: "challenge-1",
      challengeTitle: "Collaboration Patterns",
      groupToken: "group-abc",
      fromUserId: "user-1",
      fromName: "Camille Daverio",
    });
  });

  it("gives the same dedupe_key to two invites into the same group", () => {
    const first = buildGroupInviteDraft(INPUT);
    const second = buildGroupInviteDraft({ ...INPUT, recipientId: "user-3" });

    expect(second.dedupe_key).toBe(first.dedupe_key);
    // ...mais pas le même destinataire : l'index unique porte sur le couple,
    // donc deux personnes peuvent être invitées dans le même groupe.
    expect(second.user_id).not.toBe(first.user_id);
  });
});
