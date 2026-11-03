import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests for the portal's pure logic (lib/**). Components are checked in
// the browser; nothing here renders React.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    include: ["lib/**/__tests__/**/*.test.ts", "components/**/__tests__/**/*.test.ts"],
    environment: "node",
  },
});
