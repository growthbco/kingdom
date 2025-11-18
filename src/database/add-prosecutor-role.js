const sequelize = require('./connection');
require('dotenv').config();

/**
 * Add 'prosecutor' role to the User model enum
 * This script updates the database schema to include the prosecutor role
 */
async function addProsecutorRole() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established.');

    const queryInterface = sequelize.getQueryInterface();
    const { QueryTypes } = require('sequelize');

    // Check database type
    const dialect = sequelize.getDialect();
    
    if (dialect === 'sqlite') {
      // SQLite doesn't support ALTER TYPE, so we need to recreate the table
      console.log('SQLite detected - checking if prosecutor role needs to be added...');
      
      // Check if prosecutor role is already being used (which would indicate it's already supported)
      const testQuery = await sequelize.query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='users'",
        { type: QueryTypes.SELECT }
      );
      
      if (testQuery.length === 0) {
        console.log('Users table does not exist yet. It will be created with prosecutor role when the model syncs.');
        return;
      }

      // SQLite stores ENUMs as TEXT, so we can't easily modify the constraint
      // The role will work if we update the model, but we should note this
      console.log('⚠️  SQLite detected: ENUM constraints are stored as TEXT.');
      console.log('The prosecutor role will work, but you may need to update the model definition.');
      console.log('The User model enum should include: king, queen, peasant, enforcer, lawyer, guard, prosecutor');
      
    } else if (dialect === 'postgres') {
      // PostgreSQL supports ALTER TYPE
      console.log('PostgreSQL detected - adding prosecutor to role enum...');
      
      try {
        // Check if prosecutor already exists in the enum
        const checkEnum = await sequelize.query(
          `SELECT unnest(enum_range(NULL::users_role_enum))::text AS role`,
          { type: QueryTypes.SELECT }
        );
        
        const existingRoles = checkEnum.map(r => r.role);
        if (existingRoles.includes('prosecutor')) {
          console.log('✅ Prosecutor role already exists in the enum.');
          return;
        }
        
        // Add prosecutor to the enum
        await sequelize.query(
          `ALTER TYPE users_role_enum ADD VALUE IF NOT EXISTS 'prosecutor'`,
          { type: QueryTypes.RAW }
        );
        
        console.log('✅ Successfully added prosecutor role to enum!');
      } catch (error) {
        if (error.message && error.message.includes('already exists')) {
          console.log('✅ Prosecutor role already exists in the enum.');
        } else {
          throw error;
        }
      }
    } else {
      console.log(`⚠️  Database dialect ${dialect} detected.`);
      console.log('Please manually add "prosecutor" to the role enum in your database.');
      console.log('The User model enum should include: king, queen, peasant, enforcer, lawyer, guard, prosecutor');
    }

    console.log('\n✅ Migration completed!');
    
  } catch (error) {
    console.error('❌ Error adding prosecutor role:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run the script
if (require.main === module) {
  addProsecutorRole()
    .then(() => {
      console.log('\nScript completed successfully.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\nScript failed:', error);
      process.exit(1);
    });
}

module.exports = { addProsecutorRole };

