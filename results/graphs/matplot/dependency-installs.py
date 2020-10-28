import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

filename = '../data/fixed-measurement-package.csv'

data = pd.read_csv(filename).query('declaredDependencyCount == 0 or (declaredDependencyCount > 0 and installedTotalDependencyCount > 0)')

data = data.sort_values(by=['declaredDependencyCount'])

declared = data['declaredDependencyCount']
total = data['installedTotalDependencyCount']
print(data)
print(declared)
print(total)

# # Create traces
plt.scatter(total, declared, marker="+")

plt.ylim([0, declared.max()])
plt.xlim([0, total.max()])
plt.xlabel('Installed Dependencies')
plt.ylabel('Declared Dependencies')
plt.title('Declared versus Installed Dependencies')
plt.show()