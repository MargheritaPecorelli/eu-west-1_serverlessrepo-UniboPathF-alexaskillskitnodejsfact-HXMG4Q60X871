var MySql = require('sync-mysql');
 
var connection = new MySql({
  host     : 'sql2.freemysqlhosting.net',
  user     : 'sql2313391',
  password : 'iM7!eM6!',
  database : 'sql2313391'
});
 
exports.executeSyncQuery = (query, callback) => {
  return callback(null, connection.query(query));
}

