#!/usr/bin/env node

/**
 * Local helper script to generate a secure bcrypt hash for ADMIN_PASSWORD_HASH.
 * 
 * Usage:
 *   node scripts/generate-admin-hash.mjs
 *   (or pass directly: node scripts/generate-admin-hash.mjs "your-password")
 */

import readline from "readline";
import bcrypt from "bcryptjs";

async function promptPassword() {
  const argPassword = process.argv[2];
  if (argPassword) {
    return argPassword;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("Enter your desired admin password: ", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const password = await promptPassword();

  if (!password) {
    console.error("Error: Password cannot be empty.");
    process.exit(1);
  }

  const saltRounds = 10;
  const hash = bcrypt.hashSync(password, saltRounds);

  const envFormattedHash = hash.replace(/\$/g, "\\$");

  console.log("\n=======================================================");
  console.log("Admin Password Hash Generated Successfully");
  console.log("=======================================================");
  console.log("Copy and paste the following line into your .env.local file:\n");
  console.log(`ADMIN_PASSWORD_HASH="${envFormattedHash}"\n`);
  console.log("=======================================================\n");
}

main().catch(console.error);
