db.coarse.aggregate([
    {$group: {
        _id: {path: "$path"},
        uniqueIds: {$addToSet: "$_id"},
        count: {$sum: 1}
        }
    },
    {$match: { 
        count: {"$gt": 1}
        }
    },
    {$sort: {
        count: -1
        }
    }
], {
    allowDiskUse: true
}).forEach(function(doc){
    doc.uniqueIds.shift();
    db.coarse.remove({_id: {"$in": doc.uniqueIds}})
})