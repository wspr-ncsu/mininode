const Identifier = require('./Identifier');
class IdentifierTable {
    constructor() {
        this.table = {};
    }

    getValues(key) {
        if (this.hasIdentifier(key)) {
            let queue = this.getLinks(key), result = new Set(), visited = [];
            let next = null;
            queue.push(key);
            while (queue.length > 0) {
                next = queue.pop();
                visited.push(next);
                if (this.hasIdentifier(next)) {
                    for (const value of this.table[next].values) {
                        result.add(value);
                    }
                }
            }
            return result;
        }
        return [];
    }

    getLinks(key) {
        if(this.hasIdentifier(key)) {
            let queue = [], visited = [], result = [];
            let next = null;
            queue.push(key);
            while(queue.length > 0) {
                next = queue.pop();
                visited.push(next);
                if (this.hasIdentifier(next)) {
                    for (const link of this.table[next].links) {
                        if (!visited.includes(link) && !queue.includes(link)) {
                            queue.push(link);
                        }
                        if (!result.includes(link)) result.push(link);
                    }
                }
            }
            return result;
        }
        return [];
    }

    getDependencies(key) {
        if(this.hasIdentifier(key)) {
            return this.table[key].dependencies;
        }
        return new Set();
    }
    

    addValue(key, value) {
        if (this.hasIdentifier(key)) {
            if (value instanceof Set) {
                for (const v of value) {
                    this.table[key].addValue(v);
                }
            } else {
                this.table[key].addValue(value);
            }
        }
    }

    addLink(key, link) {
        if(this.hasIdentifier(key) && link !== key && !this.getLinks(key).includes(link)) {
            this.table[key].addLink(link);
        }
    }

    addDependency(key, dependency) {
        if(this.hasIdentifier(key) && dependency !== key) {
            this.table[key].dependencies.add(dependency);
        }
    }

    addIdentifier(key) {
        if (typeof key !== 'string') throw new Error('IDENTIFIER_KEY_MUST_BE_STRING');
        if (!this.hasIdentifier(key)) {
            this.table[key] = new Identifier();
        }
    }

    setComplex(key, value) {
        if(this.hasIdentifier(key)) {
            this.table[key].setComplex(value);
        }
    }

    setIsModule(key, value) {
        if(this.hasIdentifier(key)) {
            this.table[key].setIsModule(value);
            for (const link of this.getLinks(key)) {
                if (this.hasIdentifier(link)) {
                    this.table[link].setIsModule(value);
                }
            }
            for (const dependency of this.getDependencies(key)) {
                if (this.hasIdentifier(dependency)) {
                    this.table[dependency].setIsModule(value);
                }
            }
        }
    }

    hasIdentifier(key) {
        return Object.prototype.hasOwnProperty.call(this.table, key);
    }

    isComplex(key) {
        return this.table[key].complex;
    }

    isModule(key) {
        return this.table[key].isModule;
    }

    clean() {
        for (const key in this.table) {
            if (this.hasIdentifier(key) && !this.table[key].isModule) {
                delete this.table[key];
            }
        }
    }
}

module.exports = IdentifierTable;