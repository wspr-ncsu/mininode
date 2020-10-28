# Pre-experiment installation step

Pre-experiment step designed to filter out unuseful packages that do not have unit tests or where original tests itself fails.

### Steps

1. Check if the package has tests
2. Check if the package has repository in github
3. Download the package repository from github
4. Install the package using `npm install`
5. Run the `npm test` to validatte the original test
6. Remove the node_modules folder
7. Archive the package and store it inside mongo db.
