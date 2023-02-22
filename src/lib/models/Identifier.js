class Identifier {
    constructor() {
        this.complex = false;
        this.isModule = false;
        this.values = new Set();
        this.links = [];
        this.dependencies = new Set();
    }

    addValue(value) {
        let type = typeof value;
        if (type === 'string') {
            this.values.add(value);
        }
    }

    addLink(link) {
        if (typeof link !== 'string') throw new Error('IDENTIFIER_LINK_MUST_BE_STRING');
        if (!this.links.includes(link))
            this.links.push(link);
    }

    addDependencies(dependency) {
        if (typeof dependency !== 'string') throw new Error('IDENTIFIER_DEPENDENCY_MUST_BE_STRING');
        this.dependencies.add(dependency);
    }

    setComplex(val) {
        if (typeof val === 'boolean') {
            this.complex = val;
        }
    }

    setIsModule(val) {
        if (typeof val === 'boolean') {
            this.isModule = val;
        }
    }

    changeToArray() {
        this.values = [...this.values];
        this.dependencies = [...this.dependencies];
    }
}

module.exports = Identifier;