
const isObject = (obj) => {
  return typeof obj === 'object';
}

const isEmptyObject = (obj) => {
  return !Object.keys(obj).length;
}


function flattenObjectKeys(obj, arr, unique = false) {
  if (!obj || !isObject(obj) || !isEmptyObject(obj) || Array.isArray(obj)) return [];
  if(!arr) arr = [];
  Object.keys(obj).forEach((key) => {
    arr.push(key);
    flattenObjectKeys(obj[key], arr, true);
  });

  if (unique) {
    return [...new Set(arr)];
  }
  return arr;
}

module.exports = flattenObjectKeys;