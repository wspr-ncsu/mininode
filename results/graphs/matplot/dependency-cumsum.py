import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

filename = '../data/fixed-measurement-package.csv'
data = pd.read_csv(filename).query('declaredDependencyCount == 0 or (declaredDependencyCount > 0 and installedTotalDependencyCount > 0)')
print(data.size)
data = data.sort_values(by=['declaredDependencyCount'])

declared = data['declaredDependencyCount'].value_counts(normalize=True).sort_index()*100
unique = data['installedUniqueDependencyCount'].value_counts(normalize=True).sort_index()*100
total = data['installedTotalDependencyCount'].value_counts(normalize=True).sort_index()*100

declared = declared.cumsum()
unique = unique.cumsum()
total = total.cumsum()

print(declared)
print(unique)
print(total)

# # Create traces

plt.title("Cumulative sum of the installed packages")
plt.show()