# AllPackages

This is used to store all the package names in the npm registry. The last download was performed on September 19th. 

All package names are stored inside `data/names-of-packages.json`. The list is sorted by number of dependents.

In addition all packages with tests are stored in `data/names-for-validation.json` file. You can also see repository information.

### Tool documentations summary:

The `jest` and `tap` test frameworks already depends on `nyc`, that we are using to calculate the code coverage informations. Both of packages can be configured through package.json file by adding high level field. 

The `jest` configuration
```
{
    "jest": {
        "collectCoverage": true,
        "coverageDirectory": "<directory>",
        "coverageReporters": ["json"]
    }
}
```
The `tap` configuration
```
{
    "tap": {
        "check-coverage": true
    }
}
```

For other frameworks that do not have `nyc` as dependency, you run command `npx nyc --reporter=json npm test` to generate the coverage information. By default `nyc` will generate `coverage/coverage-summary.json` file with coverage informations. 

The `nyc` supports following frameworks:
1. mocha
2. ava
3. jest
4. tap





