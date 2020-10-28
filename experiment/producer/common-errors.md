### Common errors that I need to check

Errors thrown by custom node:
1. `FORBIDDEN_TO_REQUIRE` - error thrown by custom node version

Errors thrown by processor.js

1. `npm ERR! Test failed` - means npm test failed, i.e. mininode broke something crucial
2. `Error: Command failed: node --max-old-space-size=8192 /mn` - mininode failed during execution. It also contains errors 
thrown if dynamic import detected.
3. `FAILED-PROD-ONLY-TEST`
4. `FAILED-PROD-ONLY-INSTALLATION`
5. `NO-ENTRY-POINT`
6. `MONGO-INSERT-FAILED`

Errors thrown by mininode
1. `DYNAMIC_IMPORT_DETECTED` - error thrown when mininode can not resolve the dynamic import
2. `NO_ENTRY_POINT`
3. `IDENTIFIER_VALUE_MUST_BE_STRING_OR_NUMBER`
4. `IDENTIFIER_LINK_MUST_BE_STRING`
5. `IDENTIFIER_KEY_MUST_BE_STRING`
6. `CAN_NOT_REMOVE`
7. `NO_PACKAGE.JSON`

