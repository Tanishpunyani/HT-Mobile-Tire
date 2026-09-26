import pg from "pg";

const { Client } = pg;

const email = process.argv[2]?.trim();
const password = process.argv[3]?.trim();
const name = process.argv[4]?.trim() || "Administrator";

if (!email || !password) {
  console.log("\n❌ Usage: npm run set-admin <email> <password> [name]");
  console.log("Example: npm run set-admin admin@myclinic.com MyNewPassword123!\n");
  process.exit(1);
}

const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!directUrl) {
  console.error("❌ DIRECT_URL is missing in .env");
  process.exit(1);
}

async function main() {
  console.log(`\n⚡ Setting up Admin Account for: ${email}...`);

  const client = new Client({ connectionString: directUrl });

  try {
    await client.connect();

    // 1. Check if user already exists in auth.users
    const userQuery = await client.query(
      `SELECT id, email FROM auth.users WHERE LOWER(email) = LOWER($1::text)`,
      [email]
    );

    let userId;

    if (userQuery.rows.length > 0) {
      userId = userQuery.rows[0].id;
      console.log(`ℹ️  Found existing account in Supabase Auth (ID: ${userId}). Updating password & auto-confirming email...`);

      await client.query(
        `UPDATE auth.users
         SET encrypted_password = crypt($1::text, gen_salt('bf')),
             email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
             updated_at = NOW(),
             raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin", "provider": "email", "providers": ["email"]}'::jsonb,
             raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('full_name', $2::text, 'role', 'admin')
         WHERE id = $3::uuid;`,
        [password, name, userId]
      );
    } else {
      console.log(`ℹ️  Creating new auto-confirmed admin account in Supabase Auth...`);

      const insertUser = await client.query(
        `INSERT INTO auth.users (
           instance_id,
           id,
           aud,
           role,
           email,
           encrypted_password,
           email_confirmed_at,
           last_sign_in_at,
           raw_app_meta_data,
           raw_user_meta_data,
           created_at,
           updated_at,
           confirmation_token,
           email_change,
           email_change_token_new,
           recovery_token
         ) VALUES (
           '00000000-0000-0000-0000-000000000000'::uuid,
           gen_random_uuid(),
           'authenticated',
           'authenticated',
           $1::text,
           crypt($2::text, gen_salt('bf')),
           NOW(),
           NOW(),
           '{"provider": "email", "providers": ["email"], "role": "admin"}'::jsonb,
           jsonb_build_object('full_name', $3::text, 'role', 'admin'),
           NOW(),
           NOW(),
           '',
           '',
           '',
           ''
         )
         RETURNING id;`,
        [email, password, name]
      );

      userId = insertUser.rows[0].id;
    }

    // 2. Ensure public.users record exists with role = 'admin'
    await client.query(
      `INSERT INTO public.users (id, name, email, role, updated_at)
       VALUES ($1::uuid, $2::text, $3::text, 'admin', NOW())
       ON CONFLICT (email)
       DO UPDATE SET id = $1::uuid, role = 'admin', name = $2::text, updated_at = NOW();`,
      [userId, name, email]
    );

    console.log(`\n🎉 SUCCESS! Admin account is ready.`);
    console.log(`✅ Email Auto-Confirmed (No inbox link required)`);
    console.log(`✅ Password set successfully`);
    console.log(`✅ Granted 'admin' role in PostgreSQL database`);
    console.log(`\n👉 You can now log in at: http://localhost:3000/admin/login`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}\n`);
  } catch (err) {
    console.error("❌ Error setting admin credentials:", err.message);
  } finally {
    await client.end();
  }
}

main();
