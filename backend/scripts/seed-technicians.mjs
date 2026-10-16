import pg from "pg";

const { Client } = pg;

const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!directUrl) {
  console.error("❌ DIRECT_URL or DATABASE_URL is missing in environment.");
  process.exit(1);
}

export const INITIAL_TECHNICIANS = [
  {
    id: "90056f7b-1cba-4a17-aa3b-8f8708d38c5c",
    name: "Harsh Technician",
    role: "Mobile Tire Technician",
    phone: null,
    isActive: true,
  },
  {
    id: "629d02dd-41ac-4598-8940-434fc8a2bd9e",
    name: "Jerry Technician",
    role: "Mobile Tire Technician",
    phone: null,
    isActive: true,
  },
  {
    id: "2cf14402-a791-41c9-89c1-efbe531ff7ac",
    name: "Harry Technician",
    role: "Mobile Tire Technician",
    phone: null,
    isActive: true,
  },
  {
    id: "ee646c95-ec73-4f65-81fb-f2343285b601",
    name: "Ethan Wilson",
    role: "Senior Mobile Technician",
    phone: null,
    isActive: false,
  },
  {
    id: "91a86430-3346-4330-b217-4671c067e8cb",
    name: "Noah Bennett",
    role: "Tire Repair Technician",
    phone: null,
    isActive: false,
  },
];

export async function seedTechnicians() {
  console.log("\n🌱 Seeding technicians into database with stable IDs...");
  const client = new Client({ connectionString: directUrl });

  try {
    await client.connect();

    for (const tech of INITIAL_TECHNICIANS) {
      // Idempotent upsert by stable primary key ID
      const res = await client.query(
        `INSERT INTO public.technicians (id, name, role, phone, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE
         SET name = EXCLUDED.name,
             role = EXCLUDED.role,
             is_active = EXCLUDED.is_active,
             updated_at = NOW()
         RETURNING id, name, role, is_active;`,
        [tech.id, tech.name, tech.role, tech.phone, tech.isActive]
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
