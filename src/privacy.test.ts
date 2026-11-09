import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Privacy and Version Control Protection", () => {
  it("enforces HEIC, HEIF, and private fixture exclusions in .gitignore", () => {
    const gitignorePath = join(process.cwd(), ".gitignore");
    expect(existsSync(gitignorePath)).toBe(true);

    const gitignore = readFileSync(gitignorePath, "utf-8");

    // Check private fixture patterns
    expect(gitignore).toMatch(/55999\.\*/);
    expect(gitignore).toMatch(/56002\.\*/);

    // Check HEIC / HEIF extension patterns
    expect(gitignore).toMatch(/\*\.heic/);
    expect(gitignore).toMatch(/\*\.HEIC/);
    expect(gitignore).toMatch(/\*\.heif/);
    expect(gitignore).toMatch(/\*\.HEIF/);

    // Check local directory pattern
    expect(gitignore).toMatch(/\.local\//);
  });

  it("verifies git does not track any private user map files or HEIC/HEIF files", () => {
    const trackedFiles = execSync("git ls-files", { encoding: "utf-8" });
    const lines = trackedFiles.split(/\r?\n/).filter(Boolean);

    for (const file of lines) {
      expect(file).not.toMatch(/55999/);
      expect(file).not.toMatch(/56002/);
      expect(file).not.toMatch(/\.hei[cf]$/i);
    }
  });

  it("verifies public/ contains no user maps or HEIC assets", () => {
    const publicDir = join(process.cwd(), "public");
    if (existsSync(publicDir)) {
      const files = readdirSync(publicDir, { recursive: true }).map(String);
      for (const file of files) {
        expect(file).not.toMatch(/55999/);
        expect(file).not.toMatch(/56002/);
        expect(file).not.toMatch(/\.hei[cf]$/i);
      }
    }
  });
});
