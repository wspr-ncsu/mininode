import numpy as np
import pandas as pd

# reading the csv file
filename = 'npm-post.csv'
df = pd.read_csv(filename, delimiter=',')
df = df.drop_duplicates()
# dependency related stats
nodependency = df[df.declared == 0]
hasdependency = df[df.declared != 0]

print('TOTAL APPS', len(df))
print('APPS W/ DEPENDENCIES:', len(hasdependency))
print('APPS W/O DEPENDENCIES:', len(nodependency))
print('AVG INSTALLED:', hasdependency.total.mean(), hasdependency.total.max(), hasdependency.total.min())
print('AVG DECLARED:', hasdependency.declared.mean(), hasdependency.declared.max(), hasdependency.declared.min())
print('AVG UNIQUE:', hasdependency.unique.mean(), hasdependency.unique.max(), hasdependency.unique.min())

filename = 'npm-results.csv'
df = pd.read_csv(filename, delimiter=',')
df = df.drop_duplicates()

# eval and import related stats
haseval = df[df.totalEval != 0][df.totalEvalWithVar == 0]
hasdynamiceval = df[df.totalEvalWithVar != 0]
print('PACKS WITH ONLY STATIC EVAL:', len(haseval))
print('PACKS WITH DYNAMIC EVAL:', len(hasdynamiceval))

resolvableImport = df[df.totalDynamicRequire != 0][df.totalComplexDynamicRequire == 0]
nonResolvableImport = df[df.totalComplexDynamicRequire != 0]
print('TOTAL RESOLVABLE IMPORT:', len(resolvableImport))
print('TOTAL NON-RESOLVABLE IMPORT:', len(nonResolvableImport))

# LOC related stats
# original = hasdependency.originalFilesLOC.sum()
# external = hasdependency.externalFilesLOC.sum()
# usedexternal = hasdependency.usedExternalFilesLOC.sum()
# print(original, external, usedexternal)