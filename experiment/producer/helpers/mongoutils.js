const MongoClient = require('mongodb').MongoClient;
const GridFSBucket = require('mongodb').GridFSBucket;
const fs = require('fs');
let url = process.env.MONGO ? `mongodb://${process.env.MONGO}` : 'mongodb://127.0.0.1:27017';

module.exports.insertFile = insertFile;
module.exports.downloadFile = downloadFile;
module.exports.insertJson = insertJson;

/**
 * 
 * @param {String} source 
 * @param {String} filename 
 * @param {String} dbname 
 * @param {Function} cb 
 */
function insertFile(source, filename, dbname) {
  return new Promise((resolve, reject) => {
    let client = new MongoClient(url, {useNewUrlParser: true});
    client.connect(function(err) {
      if (err) return reject(err);
      console.log('accessing database:', dbname);
      const db = client.db(dbname);
      console.log('accessing bucket');
      let bucket = new GridFSBucket(db);
      console.log('streaming file:', filename);
      fs.createReadStream(source).pipe(bucket.openUploadStream(filename))
        .on('finish', () => {
          client.close();
          console.log('mongo upload finish');
          return resolve(1);
        })
        .on('error', (err) => {
          client.close();
          console.log('ERROR: mongo upload');
          return reject(err);
        })
    })
  });
  
}

/**
 * Downloads specified file from db in mongo
 * @param {String} destination 
 * @param {String} filename 
 * @param {String} dbname 
 * @param {Function} cb 
 */
function downloadFile(destination, filename, dbname) {
  return new Promise((resolve, reject) => {
    let client = new MongoClient(url, {useNewUrlParser: true});
    client.connect(function(err){
      if(err) return reject(err);
      const db = client.db(dbname);
      let bucket = new GridFSBucket(db);
  
      bucket.openDownloadStreamByName(filename).pipe(fs.createWriteStream(destination))
        .on('finish', ()=>{
          console.log('mongo download finished');
          client.close();
          return resolve(true);
        })
        .on('error', (err)=>{
          console.log("ERROR: mongo download", err)
          client.close();
          return reject(err);
        })
    })
  });
  
}

async function insertJson(dbname, collection, json) {
  const client = new MongoClient(url, {useNewUrlParser: true});
  try {
    await client.connect();
    const db = client.db(dbname);
    let r = await db.collection(collection).insertOne(json);
    if (r.insertedCount !== 1) {
      throw new Error('JSON NOT INSERTED');
    } 
  } catch (error) {
    console.log(error.stack);
    throw error;
  } finally {
    client.close();
  }
}