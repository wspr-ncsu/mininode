# Fine-grained experiments

Fine-grained experiments is running to validate the Mininode fine-grained reduction

### Steps

1. Download previously installed packages from mongo database
2. Unpack and reinstall them. _We are reinstalling them because the previous installation may be environment dependent. The reinstallation should be very fast if it is already installed._
3. Reduce the application using mininode and save the output to the new folder
4. Create the symbolic link from reduced version to original version. _By faking entry point with symbolic link we can run unit tests on reduced version from original version_
5. Run unit tests
6. If unit tests are successful, run cyclomatic complexity calculation on original and reduced versions.
7. Update the `mininode.json` file to include CC computation results.
8. Store `mininode.json` file and archived reduced version of application inside mongo database.
9. Fire success event.
10. Remove all artifacts used during the job run. _If you don't docker container will keep increasing until it throws out of memory exception_
