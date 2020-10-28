import json 

def fileStat(filename):
  totalFiles = 0
  removedFiles = 0
  with open(filename) as infile:
    for line in infile:  
      doc = json.loads(line)
      totalFiles += doc['originalFiles'] + doc['externalFiles']
      removedFiles += doc['totalRemovedFiles']
  return totalFiles, removedFiles

def lineStat(filename):
  totalFiles = 0
  removedFiles = 0
  with open(filename) as infile:
    for line in infile:  
      doc = json.loads(line)
      totalFiles += doc['originalFilesLOC'] + doc['externalFilesLOC']
      removedFiles += doc['totalRemovedLOC']
  return totalFiles, removedFiles

print('Input the filename')
filename = input()
print('File stat:', fileStat(filename))
print('Line stat:', lineStat(filename))