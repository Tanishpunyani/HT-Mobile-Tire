import fs from "fs";
import path from "path";
import { execSync } from "child_process";

// Install sharp temporarily if not installed
try {
  await import("sharp");
} catch {
  console.log("Installing sharp...");
  execSync("npm i -D sharp@latest", { stdio: "inherit" });
}

const sharp = (await import("sharp")).default;

const imgDir = path.resolve("public/images");

const filesMap = [
  { src: "hero-mobile-tire-clinic.png", dest: "hero-mobile-tire-clinic.webp", width: 1200, quality: 80 },
  { src: "flat_tire_repair.png", dest: "flat_tire_repair.webp", width: 800, quality: 75 },
  { src: "fleet_tire_services.png", dest: "fleet_tire_services.webp", width: 800, quality: 75 },
  { src: "Swap_Tire_rim_ON_OFF.png", dest: "Swap_Tire_rim_ON_OFF.webp", width: 800, quality: 75 },
  { src: "Wheel_Balancing.png", dest: "Wheel_Balancing.webp", width: 800, quality: 75 },
  { src: "7cbbef91-050f-47a4-ad9c-fe68730f93af.png", dest: "mobile-van-service.webp", width: 800, quality: 75 },
];

for (const item of filesMap) {
  const srcPath = path.join(imgDir, item.src);
  const destPath = path.join(imgDir, item.dest);

  if (fs.existsSync(srcPath)) {
    console.log(`Converting ${item.src} -> ${item.dest}...`);
    await sharp(srcPath)
      .resize({ width: item.width, withoutEnlargement: true })
      .webp({ quality: item.quality })
      .toFile(destPath);

    const stats = fs.statSync(destPath);
    console.log(`  Done: ${(stats.size / 1024).toFixed(1)} KB`);
    // Remove original unoptimized PNG
    fs.unlinkSync(srcPath);
  }
}

console.log("Image conversion complete!");
