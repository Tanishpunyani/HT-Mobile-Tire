import pg from "pg";

const { Client } = pg;

const email = process.argv[2]?.trim();

if (!email) {
  console.log("\n❌ Usage: npm run delete-user <email>");
  console.log("Example: npm run delete-user user@example.com\n");
  process.exit(1);
}

const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!directUrl) {
  console.error("❌ DIRECT_URL or DATABASE_URL is missing in .env");
  process.exit(1);
}

async function main() {
  console.log(`\n🗑️  Deleting account: ${email}...`);

  const client = new Client({ connectionString: directUrl });

  try {
    await client.connect();

    // 1. Get user ID from auth.users or public.users
    const userQuery = await client.query(
      `SELECT id, email FROM auth.users WHERE LOWER(email) = LOWER($1::text)`,
      [email]
    );

    const publicUserQuery = await client.query(
      `SELECT id, email FROM public.users WHERE LOWER(email) = LOWER($1::text)`,
      [email]
    );

    const userIds = [
      ...userQuery.rows.map((r) => r.id),
      ...publicUserQuery.rows.map((r) => r.id),
    ].filter((v, i, a) => a.indexOf(v) === i);

    if (userIds.length === 0) {
      console.log(`⚠️  No user found with email: ${email}`);
      return;
    }

    console.log(`Found user IDs to clean up:`, userIds);

    for (const id of userIds) {
      // Unlink customers
      await client.query(
        `UPDATE public.customers SET user_id = NULL WHERE user_id = $1::uuid`,
        [id]
      );

      // Delete from public.users
      await client.query(`DELETE FROM public.users WHERE id = $1::uuid`, [id]);

      // Delete from auth.users (cascades auth sessions, tokens, etc.)
      await client.query(`DELETE FROM auth.users WHERE id = $1::uuid`, [id]);
    }

    // Also delete any remaining row in public.users by email
    await client.query(`DELETE FROM public.users WHERE LOWER(email) = LOWER($1::text)`, [email]);

    console.log(`\n🎉 SUCCESS! Account for ${email} has been completely deleted from Supabase Auth and Database.\n`);
  } catch (err) {
    console.error("❌ Error deleting user:", err.message);
  } finally {
    await client.end();
  }
}

main();
