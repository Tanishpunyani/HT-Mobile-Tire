import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const { Client } = pg;

const email = process.argv[2]?.trim();
const password = process.argv[3]?.trim();
const name = process.argv[4]?.trim() || "Administrator";

if (!email || !password) {
  console.log("\n❌ Usage: node --env-file=.env scripts/create-admin.mjs <email> <password> [name]");
  console.log("Example: node --env-file=.env scripts/create-admin.mjs admin@myclinic.com MySecurePassword123!\n");
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase URL or Key in .env");
  process.exit(1);
}

async function main() {
  console.log(`\n🔧 Setting up Admin Account for: ${email}...`);

  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. Try Signing Up the user in Supabase
  let userId = null;

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
        role: "admin",
      },
    },
  });

  if (signUpError) {
    if (signUpError.message?.toLowerCase().includes("already registered") || signUpError.status === 422) {
      console.log("ℹ️  User already exists in Supabase. Attempting password sign-in / verification...");
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        console.log(`⚠️  Note: If password is different, please use Supabase dashboard or password reset to change existing password.`);
      } else if (signInData.user) {
        userId = signInData.user.id;
        console.log("✅ Authenticated successfully in Supabase Auth.");
      }
    } else {
      console.error(`⚠️  Supabase Auth Notice: ${signUpError.message}`);
    }
  } else if (signUpData.user) {
    userId = signUpData.user.id;
    console.log(`✅ Registered in Supabase Auth (User ID: ${userId})`);
  }

  // 2. Connect to Database and Ensure Admin Role
  const client = new Client({ connectionString: directUrl });
  try {
    await client.connect();

    if (userId) {
      await client.query(
        `INSERT INTO users (id, name, email, role, updated_at)
         VALUES ($1, $2, $3, 'admin', NOW())
         ON CONFLICT (email)
         DO UPDATE SET id = $1, role = 'admin', updated_at = NOW();`,
        [userId, name, email]
      );
    } else {
      await client.query(
        `INSERT INTO users (name, email, role, updated_at)
         VALUES ($1, $2, 'admin', NOW())
         ON CONFLICT (email)
         DO UPDATE SET role = 'admin', updated_at = NOW();`,
        [name, email]
      );
    }

    console.log(`✅ Granted 'admin' role in PostgreSQL database.`);
    console.log(`\n🎉 SUCCESS! Admin account is ready.`);
    console.log(`👉 You can now log in at: http://localhost:3000/admin/login`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}\n`);
  } catch (dbErr) {
    console.error("❌ Database Error:", dbErr.message);
  } finally {
    await client.end();
  }
}

main();
