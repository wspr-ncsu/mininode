import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

filename = '../data/fixed-measurement-package.csv'

data = pd.read_csv(filename).query('declaredDependencyCount == 0 or (declaredDependencyCount > 0 and installedTotalDependencyCount > 0)')

data = data.sort_values(by=['declaredDependencyCount'])

declared = data['declaredDependencyCount']
total = data['installedTotalDependencyCount']
unique = data['installedUniqueDependencyCount']

print(data)
print(declared)
print(total)

# # Create traces
plt.subplot(311)
plt.scatter(total, declared, marker="+")
plt.ylim([0, declared.max()])
plt.xlim([0, total.max()])
plt.xlabel('Total unique installed dependencies')
plt.ylabel('Package declared dependencies')
# plt.title('Declared versus Total Unique Installed Dependencies')

plt.subplot(312)
plt.scatter(total, declared, marker="+", color="green")
plt.ylim([0, declared.max()])
plt.xlim([0, total.max()])
plt.xlabel('Total installed dependencies')
plt.ylabel('Package declared dependencies')
# plt.title('Declared versus Total Installed Dependencies')


plt.subplot(313)
plt.scatter(total, unique, marker="+", color="orange")
plt.ylim([0, unique.max()])
plt.xlim([0, total.max()])
plt.xlabel('Total installed dependencies')
plt.ylabel('Total unique installed dependencies')
# plt.title('Declared versus Total Installed Dependencies')


plt.show()