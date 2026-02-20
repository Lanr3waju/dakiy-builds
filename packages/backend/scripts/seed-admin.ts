import dotenv from 'dotenv';
import path from 'path';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

/**
 * Seed script to create an initial admin user
 * This allows you to access the application for the first time
 */
async function seedAdminUser() {
  // Create a dedicated pool for this script
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'dakiybuilds',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  const client = await pool.connect();

  try {
    // Check if any admin users exist
    const adminCheck = await client.query(
      "SELECT COUNT(*) as count FROM users WHERE role = 'Admin'"
    );

    const adminCount = parseInt(adminCheck.rows[0].count);

    if (adminCount > 0) {
      console.log('✓ Admin user already exists. Skipping seed.');
      return;
    }

    // Create initial admin user
    const email = 'admin@dakiybuilds.com';
    const password = 'admin123'; // Change this after first login!
    const passwordHash = await bcrypt.hash(password, 10);

    await client.query(
      `INSERT INTO users (email, password_hash, role, first_name, last_name)
       VALUES ($1, $2, $3, $4, $5)`,
      [email, passwordHash, 'Admin', 'Admin', 'User']
    );

    console.log('✓ Initial admin user created successfully!');
    console.log('');
    console.log('Login credentials:');
    console.log('  Email:', email);
    console.log('  Password:', password);
    console.log('');
    console.log('⚠️  IMPORTANT: Change the password after your first login!');
  } catch (error) {
    console.error('Error seeding admin user:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedAdminUser()
  .then(() => {
    console.log('Seed completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });
