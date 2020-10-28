// coarse grain coverage
let coarse100 = db.coarse.find({"coverageSummary.total.lines.pct": 100}).count()
let coarse90 = db.coarse.find({"coverageSummary.total.lines.pct": {$gte: 90, $lt: 100}}).count()
let coarse50 = db.coarse.find({"coverageSummary.total.lines.pct": {$gte: 50, $lt: 90}}).count()
let coarse49 = db.coarse.find({"coverageSummary.total.lines.pct": {$lt: 50}}).count()
// fine grain coverage
let fine100 = db.fine.find({"coverageSummary.total.lines.pct": 100}).count()
let fine90 = db.fine.find({"coverageSummary.total.lines.pct": {$gte: 90, $lt: 100}}).count()
let fine50 = db.fine.find({"coverageSummary.total.lines.pct": {$gte: 50, $lt: 90}}).count()
let fine49 = db.fine.find({"coverageSummary.total.lines.pct": {$lt: 50}}).count()
// failed to calculate the coverage
let coarseUnknown = db.coarse.find({"coverageSummary.total.lines.pct": "Unknown"}).count()
let fineUnknown = db.fine.find({"coverageSummary.total.lines.pct": "Unknown"}).count()

console.log('Coarse', coarse100, coarse90, coarse50, coarseUnknown+coarse49);
console.log('Fine', fine100, fine90, fine50, fineUnknown+fine49);
