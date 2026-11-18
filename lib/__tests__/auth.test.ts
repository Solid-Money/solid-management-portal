import { describe, expect, it } from "vitest";
import {
  ADMIN_SIGN_IN_PROVIDER,
  isAllowedSignInProvider,
  isTransientAuthError,
  latestRun,
} from "@/lib/auth";

describe("isAllowedSignInProvider", () => {
  it("allows only a Google sign-in", () => {
    expect(ADMIN_SIGN_IN_PROVIDER).toBe("google.com");
    expect(isAllowedSignInProvider("google.com")).toBe(true);
  });

  it("refuses every other provider, and a missing claim", () => {
    for (const provider of [
      "password",
      "emailLink",
      "anonymous",
      "custom",
      "phone",
      "GOOGLE.COM",
      "",
      null,
      undefined,
    ]) {
      expect(isAllowedSignInProvider(provider)).toBe(false);
    }
  });
});

describe("latestRun", () => {
  it("lets only the newest run act", () => {
    const runs = latestRun();
    const signedIn = runs.begin();
    expect(signedIn()).toBe(true);

    // Signed out (e.g. in another tab) while the first run read its token.
    const signedOut = runs.begin();
    expect(signedIn()).toBe(false);
    expect(signedOut()).toBe(true);
  });

  it("stops every run once cancelled", () => {
    const runs = latestRun();
    const pending = runs.begin();
    runs.cancel();
    expect(pending()).toBe(false);
  });
});

describe("isTransientAuthError", () => {
  it("treats a network failure while refreshing the token as transient", () => {
    expect(
      isTransientAuthError({ code: "auth/network-request-failed" }),
    ).toBe(true);
  });

  it("treats every other failure as one that signs the session out", () => {
    for (const error of [
      { code: "auth/user-token-expired" },
      { code: "auth/user-disabled" },
      { code: "auth/internal-error" },
      new Error("auth/network-request-failed"),
      "auth/network-request-failed",
      null,
      undefined,
    ]) {
      expect(isTransientAuthError(error)).toBe(false);
    }
  });
});
