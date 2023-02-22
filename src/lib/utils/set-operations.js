/**
 * @param {Array<String>} set
 * @param {Array<String>} subset
 */
function isSubset(set, subset) {
  return subset.every((val) => set.includes(val));
}

module.exports.isSubset = isSubset;
