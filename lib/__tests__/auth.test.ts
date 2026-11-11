import { describe, expect, it } from "vitest";
import { ADMIN_SIGN_IN_PROVIDER, isAllowedSignInProvider } from "@/lib/auth";

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
