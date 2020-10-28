
const exec = require('child_process').execSync;

module.exports.hasTest = function (pck) {
    let result;
    if (typeof pck === 'string') {
        result = exec(`npm show ${pck} scripts.test`).toString();
    } else if (pck.scripts) {
        result = pck.scripts.test;
    }
    
    if (!result || result.includes('echo \"Error: no test specified\"')) {
        return false;
    }

    return true;
}

module.exports.hasDependencies = function (pck) {
    if (typeof pck === 'string') {
        let r = exec(`npm view ${pck} dependencies`, {maxBuffer: Infinity}).toString();
        if (!r || r === '') {
            return false;
        }
    } else if((!pck.dependencies || Object.keys(pck.dependencies).length < 1) 
                && (!pck.devDependencies || Object.keys(pck.devDependencies).length < 1)) {
        return false;
    }
    
    return true;
}

module.exports.isGit = function (pck) {
    if (pck.repository) {
        if (typeof pck.repository === 'string' && pck.repository.includes('github.com')) {
            return pck.repository;
        } else if (typeof pck.repository === 'object' && pck.repository.type === 'git') {
            return pck.repository.url;
        }
    }

    return null;
}

module.exports.getRepository = function(pck) {
    if (pck.repository) {
        if (typeof pck.repository === 'string' && pck.repository.includes('github.com')) {
            return pck.repository;
        } else if (typeof pck.repository === 'object' && pck.repository.type === 'git') {
            return pck.repository.url;
        }
    }

    return null;
}

module.exports.dependsOn = function(pck, arr) {
    if (typeof pck === 'string') {
        let r = exec(`npm view ${pck} dependencies devDependencies`, {maxBuffer: Infinity}).toString().trim();
        for (let item of arr) {
            if (r.includes(` ${item}:`)) {
                return true;
            }
        }
    } else if (pck.devDependencies) {
        let keys = Object.keys(pck.devDependencies);
        for (const item of arr) {
            if (keys.includes(item)) return true;
        }
    } else if (pck.dependencies) {
        let keys = Object.keys(pck.dependencies);
        for (const item of arr) {
            if (keys.includes(item)) return true;
        }
    }
    

    return false;
}