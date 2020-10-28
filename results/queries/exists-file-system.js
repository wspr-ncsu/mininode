let collection = 'coarse'
db.getCollection(collection).find({"builtins.fs": {$exists: false}}).count()