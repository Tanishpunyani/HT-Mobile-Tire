import pg from "pg";

const { Client } = pg;

const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!directUrl) {
  console.error("❌ DIRECT_URL or DATABASE_URL is missing in environment.");
  process.exit(1);
}

export const INITIAL_TECHNICIANS = [
  {
    name: "Alex Morgan",
    role: "Senior Tire Technician",
    phone: null,
    isActive: true,
  },
  {
    name: "Daniel Brooks",
    role: "Mobile Tire Technician",
    phone: null,
    isActive: true,
  },
  {
    name: "Ryan Carter",
    role: "Tire Service Technician",
    phone: null,
    isActive: true,
  },
  {
    name: "Ethan Wilson",
    role: "Senior Mobile Technician",
    phone: null,
    isActive: true,
  },
  {
    name: "Noah Bennett",
    role: "Tire Repair Technician",
    phone: null,
    isActive: true,
  },
];

export async function seedTechnicians() {
  console.log("\n🌱 Seeding 5 initial technicians into database...");
  const client = new Client({ connectionString: directUrl });

  try {
    await client.connect();

    for (const tech of INITIAL_TECHNICIANS) {
      // Idempotent upsert by name
      const res = await client.query(
        `INSERT INTO public.technicians (id, name, role, phone, is_active, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW())
         ON CONFLICT (name) DO UPDATE 
         SET role = EXCLUDED.role,
             is_active = EXCLUDED.is_active,
             updated_at = NOW()
         RETURNING id, name, role, is_active;`,
        [tech.name, tech.role, tech.phone, tech.isActive]
      );

      const row = res.rows[0];
      console.log(`  ✅ Technician: ${row.name} | Role: ${row.role} | Active: ${row.is_active} (ID: ${row.id})`);
    }

    const countRes = await client.query(`SELECT count(*)::int as total FROM public.technicians WHERE is_active = true;`);
    console.log(`\n🎉 Seed finished! Total active technicians: ${countRes.rows[0].total}\n`);
  } catch (err) {
    console.error("❌ Error seeding technicians:", err);
    throw err;
  } finally {
    await client.end();
  }
}

// Execute directly if run via CLI
if (process.argv[1]?.endsWith("seed-technicians.mjs") || process.argv[1]?.endsWith("seed.mjs")) {
  seedTechnicians().catch(() => process.exit(1));
}
