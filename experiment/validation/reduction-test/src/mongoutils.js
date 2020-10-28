const MongoClient = require('mongodb').MongoClient;
const GridFSBucket = require('mongodb').GridFSBucket;
const fs = require('fs');
let url = process.env.MONGO ? `mongodb://${process.env.MONGO}` : 'mongodb://127.0.0.1:27017';

module.exports.insertFile = insertFile;
module.exports.downloadFile = downloadFile;
module.exports.insertJson = insertJson;
module.exports.upsertJson = upsertJson;

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
      if(err) reject(err);
      const db = client.db(dbname);
      let bucket = new GridFSBucket(db);
      try {
        bucket.openDownloadStreamByName(filename).pipe(fs.createWriteStream(destination))
        .on('finish', ()=>{
          console.log('mongo download finished');
          client.close();
          resolve(true);
        })
        .on('error', (err)=>{
          console.log("ERROR: mongo download", err)
          client.close();
          reject(err);
        })  
      } catch (error) {
        client.close();
        reject(error);
      }
      
    })
  });
  
}

async function insertJson(dbname, collection, json) {
  const client = new MongoClient(url, {useNewUrlParser: true});
  try {
    await updateJson(json);
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

async function upsertJson(dbname, collection, json, query) {
  const client = new MongoClient(url, {useNewUrlParser: true});
  try {
    await updateJson(json);
    await client.connect();
    const db = client.db(dbname);
    let r = await db.collection(collection).updateOne(query, {$set: json}, { upsert: true } );
  } catch (error) {
    console.log(error.stack);
    throw error;
  } finally {
    client.close();
  }
}

async function updateJson(json) {
  if (json && typeof json === 'object') {
    let newprop = null;
    for (let prop in json) {
      newprop = prop;
      if (prop.includes('.')) {
        newprop = prop.replace(/\./g, '(dot)');
        json[newprop] = json[prop];
        delete json[prop];
      }
      await updateJson(json[newprop]);
    }
  }
}