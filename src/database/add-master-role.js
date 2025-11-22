const sequelize = require('./connection');
require('dotenv').config();

/**
 * Add 'master' role to the User model enum
 * This script updates the database schema to include the master role
 */
async function addMasterRole() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established.');

    const queryInterface = sequelize.getQueryInterface();
    const { QueryTypes } = require('sequelize');

    // Check database type
    const dialect = sequelize.getDialect();
    
    if (dialect === 'sqlite') {
      // SQLite doesn't support ALTER TYPE, so we need to recreate the table
      console.log('SQLite detected - checking if master role needs to be added...');
      
      // Check if master role is already being used (which would indicate it's already supported)
      const testQuery = await sequelize.query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='users'",
        { type: QueryTypes.SELECT }
      );
      
      if (testQuery.length === 0) {
        console.log('Users table does not exist yet. It will be created with master role when the model syncs.');
        return;
      }

      // SQLite stores ENUMs as TEXT, so we can't easily modify the constraint
      // The role will work if we update the model, but we should note this
      console.log('⚠️  SQLite detected: ENUM constraints are stored as TEXT.');
      console.log('The master role will work, but you may need to update the model definition.');
      console.log('The User model enum should include: king, queen, peasant, enforcer, lawyer, guard, prosecutor, master');
      
    } else if (dialect === 'postgres') {
      // PostgreSQL supports ALTER TYPE
      console.log('PostgreSQL detected - adding master to role enum...');
      
      try {
        // Check if master already exists in the enum
        const checkEnum = await sequelize.query(
          `SELECT unnest(enum_range(NULL::users_role_enum))::text AS role`,
          { type: QueryTypes.SELECT }
        );
        
        const existingRoles = checkEnum.map(r => r.role);
        if (existingRoles.includes('master')) {
          console.log('✅ Master role already exists in the enum.');
          return;
        }
        
        // Add master to the enum
        await sequelize.query(
          `ALTER TYPE users_role_enum ADD VALUE IF NOT EXISTS 'master'`,
          { type: QueryTypes.RAW }
        );
        
        console.log('✅ Successfully added master role to enum!');
      } catch (error) {
        if (error.message && error.message.includes('already exists')) {
          console.log('✅ Master role already exists in the enum.');
        } else {
          throw error;
        }
      }
    } else {
      console.log(`⚠️  Database dialect ${dialect} detected.`);
      console.log('Please manually add "master" to the role enum in your database.');
      console.log('The User model enum should include: king, queen, peasant, enforcer, lawyer, guard, prosecutor, master');
    }

    console.log('\n✅ Migration completed!');
    
  } catch (error) {
    console.error('❌ Error adding master role:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run the script
if (require.main === module) {
  addMasterRole()
    .then(() => {
      console.log('\nScript completed successfully.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\nScript failed:', error);
      process.exit(1);
    });
}

module.exports = { addMasterRole };


