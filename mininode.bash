#!/bin/bash
: '
This is for the package installation, debloating, and validation in the Docker 
Container. Assuming the source code of the package is already downloaded as 
tar.gz file and stored under the root directory.
'

: 'SHAREDMOUNT is the directory that stores the package tar.gz file'
SHAREDMOUNT="/sharedMount"
ROOT="/"
MININODE="index.js"
SUFFIX_ORIG="orig"
SUFFIX_PROD="prod"
SUFFIX_RDUC="reduced"

File_Name=$1
: 'Check whether the file exists'
if [ ! -f "$File_Name" ]; then 
    echo "File not found!"
    exit 1
fi

echo "File_Name is $File_Name"
: 'for the full path, use this: PACKAGE_NAME=”${fullfile##*/}” '

: '
extract the tar.gz file for the original version of the package
obtain the directory of the unpacked package
modify the name of the directory by appending SUFFIX_ORIG
'
unpacked=$(tar -xvzf $File_Name)
echo "unpacked: $unpacked"
packdir=$(echo $unpacked | cut -f1 -d" ")

: 'remove the last "/" from packdir if it exists'
packdir=${packdir%/}

PACKAGE_ORIG="$packdir-$SUFFIX_ORIG"
echo "unpacked: $packdir"
echo "PACKAGE_ORIG: $PACKAGE_ORIG"
mv $packdir $PACKAGE_ORIG

: '
go to the orig directory, install the package, and run the test
'
cd $PACKAGE_ORIG
if npm install; then
    echo "$PACKAGE_ORIG sucessfully installed."
else
    echo "$PACKAGE_ORIG failed to be installed!"
    exit 1
fi

if npm run test; then
    echo "$PACKAGE_ORIG test run sucessfully."
else
    echo "$PACKAGE_ORIG failed to run test!"
    exit 1
fi

: '
re-extract the tar.gz file for the product version of this package
obtain the directory of the unpacked package
modify the name of the directory by appending SUFFIX_PROD
'
cd $SHAREDMOUNT
tar -xvzf $File_Name

# reuse the $packdir obtained from the original extraction
PACKAGE_PROD="$packdir-$SUFFIX_PROD"
echo "unpacked: $packdir"
echo "PACKAGE_PROD: $PACKAGE_PROD"
mv $packdir $PACKAGE_PROD

: '
go to the prod directory, install the package
'
cd $PACKAGE_PROD
if npm install --only=prod; then
    echo "$PACKAGE_PROD sucessfully installed."
else
    echo "$PACKAGE_PROD failed to be installed!"
    exit 1
fi

cd $ROOT
# reuse the $packdir obtained from the original extraction
PACKAGE_RDUC="$packdir-$SUFFIX_RDUC"
# specify the full path of the produce version, and the reduced version, respectively 
package_prod_full="$SHAREDMOUNT/$PACKAGE_PROD/"
package_rduc_full="$SHAREDMOUNT/$PACKAGE_RDUC" # take out slash so program works correctly

echo "node --max-old-space-size=8192 $MININODE $package_prod_full --mode=fine --destination=$package_rduc_full"
echo $package_rduc_full
if node --max-old-space-size=8192 $MININODE $package_prod_full --mode=fine --destination=$package_rduc_full; then
    echo "$PACKAGE_PROD sucessfully debloated."
else
    echo "$PACKAGE_PROD failed to be debloated!"
    exit 1
fi
echo "skipped validation"
exit 1
