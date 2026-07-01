import { copyFile, mkdir, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceAssetsDir = path.join(rootDir, "assets");
const distDir = path.join(rootDir, "dist");
const distAssetsDir = path.join(distDir, "assets");

async function copyDirectoryContents(sourceDir, targetDir) {
  if (!existsSync(sourceDir)) return;

  await mkdir(targetDir, { recursive: true });

  const entries = await readdir(sourceDir);
  await Promise.all(entries.map(async (entry) => {
    const sourcePath = path.join(sourceDir, entry);
    const targetPath = path.join(targetDir, entry);
    const entryStat = await stat(sourcePath);

    if (entryStat.isDirectory()) {
      await copyDirectoryContents(sourcePath, targetPath);
      return;
    }

    if (entryStat.isFile()) {
      await copyFile(sourcePath, targetPath);
    }
  }));
}

await copyDirectoryContents(sourceAssetsDir, distAssetsDir);

// Keep the legacy root avatar URLs available too, in case an older cached
// auth bundle asks for them during a deploy rollover.
await Promise.all([1, 2, 3].map(async (index) => {
  const fileName = `hudi-pfp-${index}.png`;
  const sourcePath = path.join(sourceAssetsDir, fileName);
  if (existsSync(sourcePath)) {
    await copyFile(sourcePath, path.join(distDir, fileName));
  }
}));
